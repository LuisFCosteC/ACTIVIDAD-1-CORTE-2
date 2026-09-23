/**
 * Tipos del dominio semántico compartidos entre el analizador y la UI:
 * errores con su regla formal y la decoración del AST con atributos de Knuth.
 */
import type { ClassInfo, SymbolEntry } from './symbolTable';

export type SemanticErrorCode =
  | 'TYPE_MISMATCH'
  | 'UNDECLARED'
  | 'UNINITIALIZED'
  | 'ARG_TYPE'
  | 'ARG_COUNT'
  | 'NOT_A_FUNCTION'
  | 'UNKNOWN_MEMBER'
  | 'NOT_AN_OBJECT'
  | 'UNKNOWN_TYPE'
  | 'REDECLARATION'
  | 'BAD_OPERANDS'
  | 'RETURN_TYPE'
  | 'VOID_VARIABLE';

export interface MemoryCell {
  label: string;
  type: string;
  bits: number;
}

export interface SemanticError {
  code: SemanticErrorCode;
  title: string;
  /** Nombre corto de la regla de tipado, p. ej. "T-Decl". */
  ruleName: string;
  /** Regla formal genérica, p. ej. "T(expr) == T(id)". */
  rule: string;
  /** La regla instanciada con los valores concretos que la violan. */
  ruleInstance: string;
  line: number;
  col: number;
  identifier: string;
  message: string;
  lowLevel: string;
  nodeId: string;
  /** Comparación de celdas de memoria (destino vs. origen) cuando aplica. */
  memory?: { expected: MemoryCell; actual: MemoryCell };
}

export type AttrDirection = 'inherited' | 'synthesized';

export interface AttrEntry {
  name: string;
  value: string;
  /** Ecuación semántica que definió el atributo. */
  rule: string;
  step: number;
}

export interface NodeDecoration {
  inherited: AttrEntry[];
  synthesized: AttrEntry[];
  hasError: boolean;
}

export type DecorationMap = Record<string, NodeDecoration>;

export interface EvalEvent {
  step: number;
  nodeId: string;
  nodeTitle: string;
  nodeLabel: string;
  direction: AttrDirection;
  name: string;
  value: string;
}

export interface SemanticResult {
  errors: SemanticError[];
  decorations: DecorationMap;
  events: EvalEvent[];
  symbols: SymbolEntry[];
  classes: ClassInfo[];
  dataSegmentSize: number;
}

/** Tipo "error" (⊥): se propaga sin generar errores en cascada. */
export const ERROR_TYPE = '⊥';
