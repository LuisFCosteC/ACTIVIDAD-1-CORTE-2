import { useDeferredValue, useEffect, useMemo, useState } from 'react';
import { childrenOf, type ASTNode } from './compiler/ast';
import { compile } from './compiler/pipeline';
import { PRESETS } from './compiler/presets';
import type { SemanticError } from './compiler/semantic';
import { ChomskyModal } from './components/ChomskyModal';
import { CodeEditor, PresetSelector } from './components/CodeEditor';
import { HeaderHero } from './components/HeaderHero';
import { KnuthAttributesViewer } from './components/KnuthAttributesViewer';
import { LexicalPhase, PipelineStepper, SemanticPhase, SyntacticPhase } from './components/PipelineViewer';
import { SymbolTableViewer } from './components/SymbolTableViewer';

function findNode(root: ASTNode, id: string): ASTNode | null {
  if (root.id === id) return root;
  for (const c of childrenOf(root)) {
    const hit = findNode(c.node, id);
    if (hit) return hit;
  }
  return null;
}

function hash(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (Math.imul(31, h) + s.charCodeAt(i)) | 0;
  return h;
}

export default function App() {
  const [presetId, setPresetId] = useState<string | null>(PRESETS[0].id);
  const [code, setCode] = useState(PRESETS[0].code);
  const [selectedToken, setSelectedToken] = useState<number | null>(null);
  const [selectedNode, setSelectedNode] = useState<string | null>(null);
  const [chomskyOpen, setChomskyOpen] = useState(false);

  const source = useDeferredValue(code);
  const result = useMemo(() => compile(source), [source]);

  // Tras cada compilación, enfocar el primer nodo con error (o la raíz).
  useEffect(() => {
    setSelectedNode(result.semantic?.errors[0]?.nodeId ?? result.ast?.id ?? null);
  }, [result]);

  const errorLines = useMemo(() => {
    const lines = new Set<number>();
    result.lexErrors.forEach((e) => lines.add(e.line));
    result.syntaxErrors.forEach((e) => lines.add(e.line));
    result.semantic?.errors.forEach((e) => lines.add(e.line));
    return lines;
  }, [result]);

  const node = result.ast && selectedNode ? findNode(result.ast, selectedNode) : null;

  const loadPreset = (id: string) => {
    const p = PRESETS.find((x) => x.id === id)!;
    setPresetId(id);
    setCode(p.code);
    setSelectedToken(null);
  };

  const onEdit = (v: string) => {
    setCode(v);
    setSelectedToken(null);
    if (presetId && PRESETS.find((p) => p.id === presetId)?.code !== v) setPresetId(null);
  };

  const focusError = (e: SemanticError) => setSelectedNode(e.nodeId);

  return (
    <div className="min-h-screen bg-slate-900">
      <HeaderHero onOpenChomsky={() => setChomskyOpen(true)} />

      <main className="mx-auto grid max-w-[1600px] gap-6 px-4 py-6 sm:px-6 xl:grid-cols-[minmax(0,1fr)_480px]">
        <div className="min-w-0 space-y-5">
          <section aria-label="Casos de prueba">
            <h2 className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-400">Casos de prueba · carga en 1 clic</h2>
            <PresetSelector active={presetId} onSelect={loadPreset} />
          </section>

          <CodeEditor
            value={code}
            onChange={onEdit}
            onReset={() => loadPreset(presetId ?? PRESETS[0].id)}
            tokens={result.tokens}
            errorLines={errorLines}
            selectedToken={selectedToken}
            timeMs={result.timeMs}
          />

          <PipelineStepper status={result.status} />
          <LexicalPhase result={result} selected={selectedToken} onSelect={setSelectedToken} />
          <SyntacticPhase result={result} selectedNode={selectedNode} onSelectNode={setSelectedNode} version={hash(source)} />
          <SemanticPhase result={result} onFocusError={focusError} />
        </div>

        <aside className="min-w-0 space-y-5 xl:sticky xl:top-4 xl:max-h-[calc(100vh-2rem)] xl:self-start xl:overflow-y-auto xl:pr-1">
          <SymbolTableViewer semantic={result.semantic} />
          <KnuthAttributesViewer semantic={result.semantic} node={node} onSelectNode={setSelectedNode} />
        </aside>
      </main>

      <footer className="border-t border-slate-800 px-4 py-5 text-center text-xs text-slate-500">
        Vanessa Cruz Penna (857613) · Luis Fernando Coste Contreras (853227) — Laboratorio de Análisis Semántico
      </footer>

      <ChomskyModal open={chomskyOpen} onClose={() => setChomskyOpen(false)} />
    </div>
  );
}
