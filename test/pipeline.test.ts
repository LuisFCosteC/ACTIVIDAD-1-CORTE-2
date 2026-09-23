import { describe, it, expect } from 'vitest';
import { compile } from '../src/compiler/pipeline';
import { PRESETS } from '../src/compiler/presets';

describe('Laboratorio de Análisis Semántico - Suite de Casos de Estudio', () => {
  it('Caso 1: Incompatibilidad de tipos (TYPE_MISMATCH · T-Init)', () => {
    const res = compile(PRESETS[0].code);
    expect(res.status.lexical).toBe('ok');
    expect(res.status.syntactic).toBe('ok');
    expect(res.status.semantic).toBe('error');
    expect(res.semantic).not.toBeNull();
    expect(res.semantic!.errors.length).toBe(1);

    const err = res.semantic!.errors[0];
    expect(err.code).toBe('TYPE_MISMATCH');
    expect(err.ruleName).toBe('T-Init');
    expect(err.identifier).toBe('edad');
    expect(err.memory).toBeDefined();
    // 32 bits int vs 64 bits puntero String
    expect(err.memory!.expected.bits).toBe(32);
    expect(err.memory!.actual.bits).toBe(64);
  });

  it('Caso 2: Variable no declarada (UNDECLARED · T-VarScope)', () => {
    const res = compile(PRESETS[1].code);
    expect(res.status.lexical).toBe('ok');
    expect(res.status.syntactic).toBe('ok');
    expect(res.status.semantic).toBe('error');
    expect(res.semantic).not.toBeNull();
    expect(res.semantic!.errors.length).toBe(1);

    const err = res.semantic!.errors[0];
    expect(err.code).toBe('UNDECLARED');
    expect(err.ruleName).toBe('T-VarScope');
    expect(err.identifier).toBe('b');
  });

  it('Caso 3: Argumentos incorrectos (ARG_TYPE · T-App)', () => {
    const res = compile(PRESETS[2].code);
    expect(res.status.lexical).toBe('ok');
    expect(res.status.syntactic).toBe('ok');
    expect(res.status.semantic).toBe('error');
    expect(res.semantic).not.toBeNull();
    expect(res.semantic!.errors.length).toBe(1);

    const err = res.semantic!.errors[0];
    expect(err.code).toBe('ARG_TYPE');
    expect(err.ruleName).toBe('T-App');
  });

  it('Caso 4: Miembro inexistente (UNKNOWN_MEMBER · T-FieldLookup)', () => {
    const res = compile(PRESETS[3].code);
    expect(res.status.lexical).toBe('ok');
    expect(res.status.syntactic).toBe('ok');
    expect(res.status.semantic).toBe('error');
    expect(res.semantic).not.toBeNull();
    expect(res.semantic!.errors.length).toBe(1);

    const err = res.semantic!.errors[0];
    expect(err.code).toBe('UNKNOWN_MEMBER');
    expect(err.ruleName).toBe('T-FieldLookup');
    expect(err.identifier).toContain('edad');
  });

  it('Caso 5: Caso válido completo (ACEPTADO)', () => {
    const res = compile(PRESETS[4].code);
    expect(res.status.lexical).toBe('ok');
    expect(res.status.syntactic).toBe('ok');
    expect(res.status.semantic).toBe('ok');
    expect(res.semantic).not.toBeNull();
    expect(res.semantic!.errors.length).toBe(0);
    expect(res.ast).not.toBeNull();
    expect(Object.keys(res.semantic!.decorations).length).toBeGreaterThan(0);
  });

  it('Caso 6: Ámbitos Global / Local y clases (Caso Scopes / Extra)', () => {
    const res = compile(PRESETS[5].code);
    expect(res.status.lexical).toBe('ok');
    expect(res.status.syntactic).toBe('ok');
    expect(res.status.semantic).toBe('ok');
    expect(res.semantic).not.toBeNull();
    expect(res.semantic!.errors.length).toBe(0);

    // Layout de objetos
    const punto = res.semantic!.classes.find((c) => c.name === 'Punto');
    expect(punto).toBeDefined();
    expect(punto!.fields.length).toBe(3); // x, y, peso

    // Marcos de pila y segmento .data
    const frames = res.semantic!.symbols.filter((s) => s.base === 'frame');
    expect(frames.length).toBeGreaterThan(0);

    const globals = res.semantic!.symbols.filter((s) => s.base === '.data');
    expect(globals.length).toBeGreaterThan(0);
  });
});
