/**
 * Definición del Árbol de Sintaxis Abstracta (AST) como unión discriminada.
 * El AST "crudo" que produce el parser no contiene tipos: esos atributos los
 * calcula el analizador semántico y se guardan aparte (DecorationMap).
 */

export interface Loc {
  line: number;
  col: number;
}

interface Base {
  id: string;
  loc: Loc;
}

export interface ProgramNode extends Base {
  kind: 'Program';
  body: StmtNode[];
}

export interface ClassDeclNode extends Base {
  kind: 'ClassDecl';
  name: string;
  fields: FieldDeclNode[];
}

export interface FieldDeclNode extends Base {
  kind: 'FieldDecl';
  typeName: string;
  name: string;
}

export interface FuncDeclNode extends Base {
  kind: 'FuncDecl';
  returnType: string;
  name: string;
  params: ParamNode[];
  /** null ⇒ prototipo (declaración sin cuerpo). */
  body: StmtNode[] | null;
}

export interface ParamNode extends Base {
  kind: 'Param';
  typeName: string;
  name: string;
}

export interface VarDeclNode extends Base {
  kind: 'VarDecl';
  typeName: string;
  name: string;
  init: ExprNode | null;
}

export interface AssignmentNode extends Base {
  kind: 'Assignment';
  target: IdentifierNode | MemberAccessNode;
  value: ExprNode;
}

export interface ReturnNode extends Base {
  kind: 'Return';
  value: ExprNode | null;
}

export interface CallNode extends Base {
  kind: 'Call';
  callee: string;
  args: ExprNode[];
}

export interface MemberAccessNode extends Base {
  kind: 'MemberAccess';
  object: ExprNode;
  member: string;
}

export interface BinaryNode extends Base {
  kind: 'Binary';
  op: string;
  left: ExprNode;
  right: ExprNode;
}

export interface NewNode extends Base {
  kind: 'New';
  className: string;
}

export interface IdentifierNode extends Base {
  kind: 'Identifier';
  name: string;
}

export interface LiteralNode extends Base {
  kind: 'Literal';
  litType: 'int' | 'float' | 'String';
  raw: string;
}

export type ExprNode = CallNode | MemberAccessNode | BinaryNode | NewNode | IdentifierNode | LiteralNode;
export type StmtNode = ClassDeclNode | FuncDeclNode | VarDeclNode | AssignmentNode | ReturnNode | CallNode;
export type ASTNode = ProgramNode | StmtNode | ExprNode | FieldDeclNode | ParamNode;

export interface ChildEdge {
  label: string;
  node: ASTNode;
}

/** Hijos de un nodo con la etiqueta de la arista (para el grafo del AST). */
export function childrenOf(node: ASTNode): ChildEdge[] {
  switch (node.kind) {
    case 'Program':
      return node.body.map((n, i) => ({ label: `stmt[${i}]`, node: n }));
    case 'ClassDecl':
      return node.fields.map((n) => ({ label: 'campo', node: n }));
    case 'FuncDecl':
      return [
        ...node.params.map((n) => ({ label: 'param', node: n as ASTNode })),
        ...(node.body ?? []).map((n) => ({ label: 'cuerpo', node: n as ASTNode })),
      ];
    case 'VarDecl':
      return node.init ? [{ label: 'init', node: node.init }] : [];
    case 'Assignment':
      return [
        { label: 'lvalue', node: node.target },
        { label: 'rvalue', node: node.value },
      ];
    case 'Return':
      return node.value ? [{ label: 'valor', node: node.value }] : [];
    case 'Call':
      return node.args.map((n, i) => ({ label: `arg${i + 1}`, node: n }));
    case 'MemberAccess':
      return [{ label: 'objeto', node: node.object }];
    case 'Binary':
      return [
        { label: 'izq', node: node.left },
        { label: 'der', node: node.right },
      ];
    default:
      return [];
  }
}

/** Nombre de la clase de nodo tal como se muestra en la UI. */
export function nodeTitle(node: ASTNode): string {
  const titles: Record<ASTNode['kind'], string> = {
    Program: 'ProgramNode',
    ClassDecl: 'ClassDeclNode',
    FieldDecl: 'FieldDeclNode',
    FuncDecl: 'FuncDeclNode',
    Param: 'ParamNode',
    VarDecl: 'VarDeclNode',
    Assignment: 'AssignmentNode',
    Return: 'ReturnNode',
    Call: 'CallNode',
    MemberAccess: 'MemberAccessNode',
    Binary: 'BinaryExpr',
    New: 'NewExpr',
    Identifier: 'IdentifierNode',
    Literal: 'LiteralNode',
  };
  return titles[node.kind];
}

/** Resumen textual del contenido del nodo. */
export function nodeLabel(node: ASTNode): string {
  switch (node.kind) {
    case 'Program':
      return `${node.body.length} sentencia(s)`;
    case 'ClassDecl':
      return `class ${node.name}`;
    case 'FieldDecl':
    case 'Param':
    case 'VarDecl':
      return `${node.typeName} ${node.name}`;
    case 'FuncDecl':
      return `${node.returnType} ${node.name}(${node.params.map((p) => p.typeName).join(', ')})`;
    case 'Assignment':
      return '=';
    case 'Return':
      return 'return';
    case 'Call':
      return `${node.callee}(…)`;
    case 'MemberAccess':
      return `.${node.member}`;
    case 'Binary':
      return node.op;
    case 'New':
      return `new ${node.className}()`;
    case 'Identifier':
      return node.name;
    case 'Literal':
      return node.raw;
  }
}
