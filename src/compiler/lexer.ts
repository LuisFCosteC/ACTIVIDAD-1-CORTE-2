/**
 * FASE 1 — Análisis Léxico.
 *
 * Scanner implementado como un Autómata Finito Determinista (AFD) explícito:
 * una función de transición δ(estado, clase-de-carácter) → estado y la regla
 * de la coincidencia más larga (maximal munch). Al alcanzar un estado de
 * aceptación, el lexema se clasifica; los identificadores se reclasifican
 * contra la tabla de palabras reservadas.
 */

export type TokenType =
  | 'KEYWORD_TYPE'
  | 'IDENTIFIER'
  | 'ASSIGN'
  | 'STRING_LITERAL'
  | 'INT_LITERAL'
  | 'FLOAT_LITERAL'
  | 'SEMICOLON'
  | 'CLASS'
  | 'NEW'
  | 'RETURN'
  | 'DOT'
  | 'COMMA'
  | 'LPAREN'
  | 'RPAREN'
  | 'LBRACE'
  | 'RBRACE'
  | 'OPERATOR'
  | 'ERROR'
  | 'EOF';

export interface Token {
  type: TokenType;
  lexeme: string;
  line: number;
  col: number;
  /** Desplazamiento absoluto (inicio inclusive, fin exclusivo) en el código fuente. */
  start: number;
  end: number;
  /** Secuencia de estados del AFD recorrida para reconocer el lexema. */
  path: DfaState[];
}

export interface LexError {
  line: number;
  col: number;
  lexeme: string;
  message: string;
}

export interface LexResult {
  tokens: Token[];
  errors: LexError[];
}

export type DfaState =
  | 'q0'
  | 'qId'
  | 'qInt'
  | 'qIntDot'
  | 'qFloat'
  | 'qStr'
  | 'qStrEnd'
  | 'qAssign'
  | 'qOp'
  | 'qSlash'
  | 'qComment'
  | 'qSemi'
  | 'qDot'
  | 'qComma'
  | 'qLParen'
  | 'qRParen'
  | 'qLBrace'
  | 'qRBrace';

/** Estados de aceptación F ⊆ Q y el tipo de token que emiten. */
const ACCEPTING: Partial<Record<DfaState, TokenType | 'COMMENT'>> = {
  qId: 'IDENTIFIER',
  qInt: 'INT_LITERAL',
  qFloat: 'FLOAT_LITERAL',
  qStrEnd: 'STRING_LITERAL',
  qAssign: 'ASSIGN',
  qOp: 'OPERATOR',
  qSlash: 'OPERATOR',
  qComment: 'COMMENT',
  qSemi: 'SEMICOLON',
  qDot: 'DOT',
  qComma: 'COMMA',
  qLParen: 'LPAREN',
  qRParen: 'RPAREN',
  qLBrace: 'LBRACE',
  qRBrace: 'RBRACE',
};

export const KEYWORD_TYPES = new Set(['int', 'float', 'String', 'void']);

const RESERVED: Record<string, TokenType> = {
  class: 'CLASS',
  new: 'NEW',
  return: 'RETURN',
};

const isLetter = (c: string) => /[A-Za-z_]/.test(c);
const isDigit = (c: string) => c >= '0' && c <= '9';

/** Función de transición δ : Q × Σ → Q (null = transición indefinida). */
export function delta(state: DfaState, c: string): DfaState | null {
  switch (state) {
    case 'q0':
      if (isLetter(c)) return 'qId';
      if (isDigit(c)) return 'qInt';
      if (c === '"') return 'qStr';
      if (c === '=') return 'qAssign';
      if (c === '/') return 'qSlash';
      if (c === '+' || c === '-' || c === '*') return 'qOp';
      if (c === ';') return 'qSemi';
      if (c === '.') return 'qDot';
      if (c === ',') return 'qComma';
      if (c === '(') return 'qLParen';
      if (c === ')') return 'qRParen';
      if (c === '{') return 'qLBrace';
      if (c === '}') return 'qRBrace';
      return null;
    case 'qId':
      return isLetter(c) || isDigit(c) ? 'qId' : null;
    case 'qInt':
      if (isDigit(c)) return 'qInt';
      if (c === '.') return 'qIntDot';
      return null;
    case 'qIntDot':
    case 'qFloat':
      return isDigit(c) ? 'qFloat' : null;
    case 'qStr':
      if (c === '"') return 'qStrEnd';
      if (c === '\n') return null;
      return 'qStr';
    case 'qSlash':
      return c === '/' ? 'qComment' : null;
    case 'qComment':
      return c === '\n' ? null : 'qComment';
    default:
      return null;
  }
}

export function tokenize(source: string): LexResult {
  const tokens: Token[] = [];
  const errors: LexError[] = [];
  let pos = 0;
  let line = 1;
  let col = 1;

  const advanceTo = (target: number) => {
    while (pos < target) {
      if (source[pos] === '\n') {
        line++;
        col = 1;
      } else {
        col++;
      }
      pos++;
    }
  };

  while (pos < source.length) {
    const c = source[pos];
    if (c === ' ' || c === '\t' || c === '\r' || c === '\n') {
      advanceTo(pos + 1);
      continue;
    }

    // Simulación del AFD con coincidencia más larga.
    let state: DfaState = 'q0';
    const path: DfaState[] = ['q0'];
    let i = pos;
    let lastAccept: { end: number; state: DfaState; pathLen: number } | null = null;

    while (i < source.length) {
      const next = delta(state, source[i]);
      if (next === null) break;
      state = next;
      path.push(state);
      i++;
      if (ACCEPTING[state]) lastAccept = { end: i, state, pathLen: path.length };
    }

    const startLine = line;
    const startCol = col;
    const start = pos;

    if (!lastAccept) {
      // Ningún prefijo alcanza un estado de aceptación → error léxico.
      const unterminated = state === 'qStr';
      const end = unterminated ? i : pos + 1;
      const lexeme = source.slice(start, end);
      const message = unterminated
        ? 'Literal de cadena sin cerrar: el AFD quedó en qStr (estado no final) al llegar al fin de línea.'
        : `Carácter '${lexeme}' fuera del alfabeto Σ: δ(q0, '${lexeme}') no está definida.`;
      errors.push({ line: startLine, col: startCol, lexeme, message });
      tokens.push({ type: 'ERROR', lexeme, line: startLine, col: startCol, start, end, path: path.slice(0, Math.max(1, path.length)) });
      advanceTo(end);
      continue;
    }

    const lexeme = source.slice(start, lastAccept.end);
    const accepted = ACCEPTING[lastAccept.state]!;
    advanceTo(lastAccept.end);
    if (accepted === 'COMMENT') continue;

    let type: TokenType = accepted;
    if (type === 'IDENTIFIER') {
      if (KEYWORD_TYPES.has(lexeme)) type = 'KEYWORD_TYPE';
      else if (RESERVED[lexeme]) type = RESERVED[lexeme];
    }

    tokens.push({
      type,
      lexeme,
      line: startLine,
      col: startCol,
      start,
      end: lastAccept.end,
      path: path.slice(0, lastAccept.pathLen),
    });
  }

  tokens.push({ type: 'EOF', lexeme: '', line, col, start: pos, end: pos, path: ['q0'] });
  return { tokens, errors };
}
