/**
 * FASE 2 — Análisis Sintáctico.
 *
 * Parser descendente recursivo LL(1) (con un token extra de anticipación
 * para distinguir `Persona p` de `p.edad`). Reconoce una Gramática Libre de
 * Contexto (Tipo 2 de Chomsky) y construye el AST crudo. Por diseño NO
 * verifica tipos ni declaraciones: eso es sensible al contexto.
 */
import type { Token, TokenType } from './lexer';
import type {
  AssignmentNode,
  CallNode,
  ClassDeclNode,
  ExprNode,
  FieldDeclNode,
  FuncDeclNode,
  Loc,
  ParamNode,
  ProgramNode,
  StmtNode,
  VarDeclNode,
} from './ast';

export const GRAMMAR = [
  ['Program', 'Stmt* EOF'],
  ['Stmt', 'ClassDecl | Decl | Return | Assign | Call ;'],
  ['ClassDecl', "'class' ID '{' (Type ID ';')* '}' ';'?"],
  ['Decl', "Type ID ( ('=' Expr)? ';' | '(' Params? ')' (';' | Block) )"],
  ['Params', 'Type ID (\',\' Type ID)*'],
  ['Block', "'{' Stmt* '}'"],
  ['Assign', "Postfix '=' Expr ';'"],
  ['Expr', "Term (('+' | '-') Term)*"],
  ['Term', "Factor (('*' | '/') Factor)*"],
  ['Factor', "INT | FLOAT | STRING | 'new' ID '(' ')' | Postfix | '(' Expr ')'"],
  ['Postfix', "ID ( '.' ID | '(' Args? ')' )*"],
  ['Type', "'int' | 'float' | 'String' | 'void' | ID"],
] as const;

export interface SyntaxDiagnostic {
  line: number;
  col: number;
  message: string;
  found: string;
}

export interface ParseResult {
  ast: ProgramNode;
  errors: SyntaxDiagnostic[];
}

class ParseError extends Error {}

const describe = (t: Token) => (t.type === 'EOF' ? 'fin de archivo' : `'${t.lexeme}' (${t.type})`);

export class Parser {
  private pos = 0;
  private nextId = 0;
  private readonly errors: SyntaxDiagnostic[] = [];

  constructor(private readonly tokens: Token[]) {}

  parse(): ParseResult {
    const body: StmtNode[] = [];
    const loc = this.loc();
    while (!this.check('EOF')) {
      const stmt = this.safeStatement();
      if (stmt) body.push(stmt);
    }
    return { ast: { id: this.id(), kind: 'Program', loc, body }, errors: this.errors };
  }

  // ─── utilidades ────────────────────────────────────────────────────────
  private id() {
    return `n${this.nextId++}`;
  }
  private peek(offset = 0): Token {
    return this.tokens[Math.min(this.pos + offset, this.tokens.length - 1)];
  }
  private loc(): Loc {
    const t = this.peek();
    return { line: t.line, col: t.col };
  }
  private check(type: TokenType, lexeme?: string): boolean {
    const t = this.peek();
    return t.type === type && (lexeme === undefined || t.lexeme === lexeme);
  }
  private advance(): Token {
    const t = this.peek();
    if (t.type !== 'EOF') this.pos++;
    return t;
  }
  private match(type: TokenType, lexeme?: string): boolean {
    if (!this.check(type, lexeme)) return false;
    this.advance();
    return true;
  }
  private expect(type: TokenType, what: string): Token {
    if (this.check(type)) return this.advance();
    throw this.error(`Se esperaba ${what}`);
  }
  private error(message: string): ParseError {
    const t = this.peek();
    this.errors.push({ line: t.line, col: t.col, message: `${message}, se encontró ${describe(t)}.`, found: t.lexeme });
    return new ParseError(message);
  }

  /** Recuperación en modo pánico: descarta tokens hasta ';' o '}'. */
  private safeStatement(): StmtNode | null {
    const start = this.pos;
    try {
      return this.statement();
    } catch (e) {
      if (!(e instanceof ParseError)) throw e;
      if (this.pos === start) this.advance();
      while (!this.check('EOF') && !this.check('SEMICOLON') && !this.check('RBRACE')) this.advance();
      this.advance();
      return null;
    }
  }

  // ─── producciones ─────────────────────────────────────────────────────
  private statement(): StmtNode {
    if (this.check('CLASS')) return this.classDecl();
    if (this.check('KEYWORD_TYPE') || (this.check('IDENTIFIER') && this.peek(1).type === 'IDENTIFIER')) {
      return this.declaration();
    }
    if (this.check('RETURN')) {
      const loc = this.loc();
      this.advance();
      const value = this.check('SEMICOLON') ? null : this.expr();
      this.expect('SEMICOLON', "';' tras return");
      return { id: this.id(), kind: 'Return', loc, value };
    }
    return this.assignOrCall();
  }

  private parseType(): Token {
    if (this.check('KEYWORD_TYPE') || this.check('IDENTIFIER')) return this.advance();
    throw this.error('Se esperaba un tipo (int, float, String, void o nombre de clase)');
  }

  private classDecl(): ClassDeclNode {
    const loc = this.loc();
    this.advance(); // 'class'
    const name = this.expect('IDENTIFIER', 'el nombre de la clase').lexeme;
    this.expect('LBRACE', "'{' tras el nombre de la clase");
    const fields: FieldDeclNode[] = [];
    while (!this.check('RBRACE') && !this.check('EOF')) {
      const floc = this.loc();
      const typeName = this.parseType().lexeme;
      const fname = this.expect('IDENTIFIER', 'el nombre del campo').lexeme;
      this.expect('SEMICOLON', "';' tras la declaración del campo");
      fields.push({ id: this.id(), kind: 'FieldDecl', loc: floc, typeName, name: fname });
    }
    this.expect('RBRACE', "'}' para cerrar la clase");
    this.match('SEMICOLON');
    return { id: this.id(), kind: 'ClassDecl', loc, name, fields };
  }

  private declaration(): VarDeclNode | FuncDeclNode {
    const loc = this.loc();
    const typeName = this.parseType().lexeme;
    const name = this.expect('IDENTIFIER', 'un identificador tras el tipo').lexeme;

    if (this.match('LPAREN')) {
      const params: ParamNode[] = [];
      if (!this.check('RPAREN')) {
        do {
          const ploc = this.loc();
          const ptype = this.parseType().lexeme;
          const pname = this.expect('IDENTIFIER', 'el nombre del parámetro').lexeme;
          params.push({ id: this.id(), kind: 'Param', loc: ploc, typeName: ptype, name: pname });
        } while (this.match('COMMA'));
      }
      this.expect('RPAREN', "')' al cerrar la lista de parámetros");
      let body: StmtNode[] | null = null;
      if (this.match('LBRACE')) {
        body = [];
        while (!this.check('RBRACE') && !this.check('EOF')) {
          const s = this.safeStatement();
          if (s) body.push(s);
        }
        this.expect('RBRACE', "'}' al final del cuerpo de la función");
      } else {
        this.expect('SEMICOLON', "';' o '{' tras la cabecera de la función");
      }
      return { id: this.id(), kind: 'FuncDecl', loc, returnType: typeName, name, params, body };
    }

    const init = this.match('ASSIGN') ? this.expr() : null;
    this.expect('SEMICOLON', "';' al final de la declaración");
    return { id: this.id(), kind: 'VarDecl', loc, typeName, name, init };
  }

  private assignOrCall(): AssignmentNode | CallNode {
    const loc = this.loc();
    if (!this.check('IDENTIFIER')) throw this.error('Se esperaba una sentencia');
    const target = this.postfix();
    if (this.match('ASSIGN')) {
      if (target.kind !== 'Identifier' && target.kind !== 'MemberAccess') {
        throw this.error('El lado izquierdo de la asignación no es un L-value');
      }
      const value = this.expr();
      this.expect('SEMICOLON', "';' al final de la asignación");
      return { id: this.id(), kind: 'Assignment', loc, target, value };
    }
    if (target.kind === 'Call') {
      this.expect('SEMICOLON', "';' tras la llamada");
      return target;
    }
    throw this.error("Se esperaba '=' o una llamada a función");
  }

  private expr(): ExprNode {
    let left = this.term();
    while (this.check('OPERATOR', '+') || this.check('OPERATOR', '-')) {
      const loc = this.loc();
      const op = this.advance().lexeme;
      left = { id: this.id(), kind: 'Binary', loc, op, left, right: this.term() };
    }
    return left;
  }

  private term(): ExprNode {
    let left = this.factor();
    while (this.check('OPERATOR', '*') || this.check('OPERATOR', '/')) {
      const loc = this.loc();
      const op = this.advance().lexeme;
      left = { id: this.id(), kind: 'Binary', loc, op, left, right: this.factor() };
    }
    return left;
  }

  private factor(): ExprNode {
    const loc = this.loc();
    const t = this.peek();
    if (t.type === 'INT_LITERAL' || t.type === 'FLOAT_LITERAL' || t.type === 'STRING_LITERAL') {
      this.advance();
      const litType = t.type === 'INT_LITERAL' ? 'int' : t.type === 'FLOAT_LITERAL' ? 'float' : 'String';
      return { id: this.id(), kind: 'Literal', loc, litType, raw: t.lexeme };
    }
    if (this.match('NEW')) {
      const className = this.expect('IDENTIFIER', "el nombre de la clase tras 'new'").lexeme;
      this.expect('LPAREN', "'(' tras el nombre de la clase");
      this.expect('RPAREN', "')'");
      return { id: this.id(), kind: 'New', loc, className };
    }
    if (this.check('IDENTIFIER')) return this.postfix();
    if (this.match('LPAREN')) {
      const inner = this.expr();
      this.expect('RPAREN', "')'");
      return inner;
    }
    throw this.error('Se esperaba una expresión');
  }

  private postfix(): ExprNode {
    const loc = this.loc();
    const name = this.expect('IDENTIFIER', 'un identificador').lexeme;
    let node: ExprNode = { id: this.id(), kind: 'Identifier', loc, name };
    for (;;) {
      if (this.match('DOT')) {
        const member = this.expect('IDENTIFIER', "el nombre del miembro tras '.'").lexeme;
        node = { id: this.id(), kind: 'MemberAccess', loc, object: node, member };
      } else if (this.check('LPAREN')) {
        if (node.kind !== 'Identifier') throw this.error('Solo se pueden invocar funciones por nombre');
        this.advance();
        const args: ExprNode[] = [];
        if (!this.check('RPAREN')) {
          do args.push(this.expr());
          while (this.match('COMMA'));
        }
        this.expect('RPAREN', "')' al cerrar los argumentos");
        node = { id: this.id(), kind: 'Call', loc, callee: node.name, args };
      } else {
        return node;
      }
    }
  }
}

export function parse(tokens: Token[]): ParseResult {
  return new Parser(tokens).parse();
}
