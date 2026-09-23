import type { ProgramNode } from './ast';
import { tokenize, type LexError, type Token } from './lexer';
import { parse, type SyntaxDiagnostic } from './parser';
import type { SemanticResult } from './semantic';
import { analyze } from './semanticAnalyzer';

export type PhaseStatus = 'ok' | 'error' | 'blocked';

export interface CompileResult {
  tokens: Token[];
  lexErrors: LexError[];
  ast: ProgramNode | null;
  syntaxErrors: SyntaxDiagnostic[];
  semantic: SemanticResult | null;
  status: { lexical: PhaseStatus; syntactic: PhaseStatus; semantic: PhaseStatus };
  timeMs: number;
}

/**
 * Front-end completo: Léxico → Sintáctico → Semántico.
 * Cada fase sólo se ejecuta si la anterior terminó sin errores.
 */
export function compile(source: string): CompileResult {
  const t0 = performance.now();
  const { tokens, errors: lexErrors } = tokenize(source);
  const lexical: PhaseStatus = lexErrors.length ? 'error' : 'ok';

  let ast: ProgramNode | null = null;
  let syntaxErrors: SyntaxDiagnostic[] = [];
  let syntactic: PhaseStatus = 'blocked';
  if (lexical === 'ok') {
    const res = parse(tokens);
    ast = res.ast;
    syntaxErrors = res.errors;
    syntactic = syntaxErrors.length ? 'error' : 'ok';
  }

  let semantic: SemanticResult | null = null;
  let semStatus: PhaseStatus = 'blocked';
  if (ast && syntactic === 'ok') {
    semantic = analyze(ast);
    semStatus = semantic.errors.length ? 'error' : 'ok';
  }

  return {
    tokens,
    lexErrors,
    ast,
    syntaxErrors,
    semantic,
    status: { lexical, syntactic, semantic: semStatus },
    timeMs: performance.now() - t0,
  };
}
