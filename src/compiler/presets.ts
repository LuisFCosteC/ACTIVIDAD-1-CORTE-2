export interface Preset {
  id: string;
  label: string;
  title: string;
  code: string;
  expected: 'error' | 'ok';
  summary: string;
}

export const PRESETS: Preset[] = [
  {
    id: 'type-mismatch',
    label: 'Caso 1',
    title: 'Incompatibilidad de tipos',
    code: 'int edad = "veinte";',
    expected: 'error',
    summary: 'Sintaxis impecable, pero un String no cabe en un int.',
  },
  {
    id: 'undeclared',
    label: 'Caso 2',
    title: 'Variable no declarada',
    code: 'int a = 10;\nb = a + 5;',
    expected: 'error',
    summary: "'b' nunca entró en la Tabla de Símbolos.",
  },
  {
    id: 'bad-args',
    label: 'Caso 3',
    title: 'Argumentos incorrectos',
    code: 'void sumar(int x, int y);\nsumar(1, "dos");',
    expected: 'error',
    summary: 'La firma exige (int, int); se pasa (int, String).',
  },
  {
    id: 'unknown-member',
    label: 'Caso 4',
    title: 'Miembro inexistente',
    code: 'class Persona { String nombre; }\nPersona p = new Persona();\np.edad = 30;',
    expected: 'error',
    summary: "Persona sólo tiene 'nombre'; 'edad' no tiene offset.",
  },
  {
    id: 'valid',
    label: 'Caso 5',
    title: 'Caso válido',
    code: 'int x = 10;\nint y = x + 20;\nString mensaje = "Compilador OK";',
    expected: 'ok',
    summary: 'Todas las reglas de tipado se satisfacen.',
  },
  {
    id: 'scopes',
    label: 'Extra',
    title: 'Ámbitos Global / Local',
    code: [
      'class Punto { int x; int y; float peso; }',
      'Punto origen = new Punto();',
      'float escala = 2;',
      '',
      'int area(int base, int alto) {',
      '  int doble = base * alto;',
      '  return doble / 2;',
      '}',
      '',
      'int total = area(3, 4);',
      'origen.x = total;',
    ].join('\n'),
    expected: 'ok',
    summary: 'Marco de pila local, layout de objeto y ensanchamiento int → float.',
  },
];
