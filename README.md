# ACTIVIDAD-1-CORTE-2

## Laboratorio de Análisis Semántico: Del texto bien escrito al programa con sentido operacional

Laboratorio interactivo de compiladores (front-end): Léxico → Sintáctico → Semántico.

**Autores:** Vanessa Cruz Penna (ID 857613) · Luis Fernando Coste Contreras (ID 853227)

## Ejecutar

```bash
npm install
npm run dev     # http://localhost:3000
npm run build   # tsc --noEmit + vite build
```

## Estructura

| Archivo | Rol |
|---|---|
| `src/compiler/lexer.ts` | Scanner AFD explícito (δ, estados de aceptación, coincidencia más larga) |
| `src/compiler/parser.ts` | Parser descendente recursivo (CFG Tipo 2) → AST crudo |
| `src/compiler/ast.ts` | Nodos del AST (`ProgramNode`, `VarDeclNode`, `AssignmentNode`, `CallNode`, `MemberAccessNode`, …) |
| `src/compiler/symbolTable.ts` | Pila de ámbitos (Global / Local / Clase), tamaños y offsets alineados |
| `src/compiler/semanticAnalyzer.ts` | Recorrido post-orden con gramática de atributos L-atribuida (heredados ↓ / sintetizados ↑) |
| `src/compiler/semantic.ts` | Tipos de errores semánticos y decoraciones |
| `src/compiler/pipeline.ts` | Orquesta las 3 fases |
| `src/components/*` | UI: editor, presets, stream de tokens, AST (React Flow), semáforo, tabla de símbolos, inspector de Knuth, modal de Chomsky |

El código anterior (exportado de AI Studio) está respaldado en `.legacy-aistudio/`.
