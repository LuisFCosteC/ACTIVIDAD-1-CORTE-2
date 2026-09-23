import { ArrowDown, ArrowUp, Sigma } from 'lucide-react';
import { useEffect, useRef } from 'react';
import { nodeLabel, nodeTitle, type ASTNode } from '../compiler/ast';
import type { AttrEntry, SemanticResult } from '../compiler/semantic';
import { Empty, Panel } from './ui';

function AttrList({ entries, dir }: { entries: AttrEntry[]; dir: 'inherited' | 'synthesized' }) {
  const inh = dir === 'inherited';
  return (
    <div className={`rounded-xl border p-3 ${inh ? 'border-sky-500/30 bg-sky-500/5' : 'border-emerald-500/30 bg-emerald-500/5'}`}>
      <p className={`mb-2 flex items-center gap-1.5 text-xs font-semibold ${inh ? 'text-sky-300' : 'text-emerald-300'}`}>
        {inh ? <ArrowDown className="size-3.5" /> : <ArrowUp className="size-3.5" />}
        {inh ? 'Heredados · top-down' : 'Sintetizados · bottom-up'}
      </p>
      {entries.length === 0 ? (
        <p className="text-xs text-slate-500">—</p>
      ) : (
        <ul className="space-y-2">
          {entries.map((a) => (
            <li key={a.step}>
              <p className="flex items-baseline gap-2 font-mono text-[13px]">
                <span className="text-slate-400">{a.name}</span>
                <span className="text-slate-600">=</span>
                <span className={`truncate ${a.value === '⊥' || a.value === 'false' ? 'text-rose-300' : 'text-slate-100'}`} title={a.value}>
                  {a.value}
                </span>
                <span className="ml-auto shrink-0 text-[10px] text-slate-500">#{a.step}</span>
              </p>
              <p className="break-words font-mono text-[11px] leading-snug text-slate-500">{a.rule}</p>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export function KnuthAttributesViewer(props: {
  semantic: SemanticResult | null;
  node: ASTNode | null;
  onSelectNode: (id: string) => void;
}) {
  const { semantic, node } = props;
  const listRef = useRef<HTMLOListElement>(null);
  const deco = node && semantic ? semantic.decorations[node.id] : undefined;

  useEffect(() => {
    const first = listRef.current?.querySelector('[data-active="true"]');
    first?.scrollIntoView({ block: 'nearest' });
  }, [node]);

  return (
    <Panel>
      <header className="flex items-center gap-2 border-b border-slate-700/70 px-4 py-3">
        <Sigma className="size-4 text-emerald-300" />
        <h2 className="font-display text-[15px] font-bold text-slate-100">Inspector de Atributos de Knuth</h2>
      </header>
      <div className="space-y-4 p-4">
        {!semantic ? (
          <Empty>El AST aún no se ha decorado.</Empty>
        ) : !node ? (
          <Empty>Seleccione un nodo del AST.</Empty>
        ) : (
          <>
            <div className="flex items-center gap-2 rounded-lg bg-slate-900/70 px-3 py-2">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">{nodeTitle(node)}</span>
              <span className="truncate font-mono text-sm text-slate-100">{nodeLabel(node)}</span>
              <span className="ml-auto font-mono text-xs text-slate-500">L{node.loc.line}</span>
            </div>
            <div className="grid gap-3">
              <AttrList dir="inherited" entries={deco?.inherited ?? []} />
              <AttrList dir="synthesized" entries={deco?.synthesized ?? []} />
            </div>
            <div>
              <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                Orden de evaluación · recorrido en profundidad (L-atribuida)
              </p>
              <ol ref={listRef} className="max-h-64 space-y-0.5 overflow-y-auto pr-1 font-mono text-[11px]">
                {semantic.events.map((e) => {
                  const active = e.nodeId === node.id;
                  const inh = e.direction === 'inherited';
                  return (
                    <li key={e.step} data-active={active}>
                      <button
                        onClick={() => props.onSelectNode(e.nodeId)}
                        className={`flex w-full items-center gap-2 rounded px-2 py-1 text-left ${active ? 'bg-indigo-500/20' : 'hover:bg-slate-800'}`}
                      >
                        <span className="w-6 shrink-0 text-right text-slate-500">{e.step}</span>
                        <span className={inh ? 'text-sky-300' : 'text-emerald-300'}>{inh ? '↓' : '↑'}</span>
                        <span className="truncate text-slate-300">
                          {e.nodeTitle.replace('Node', '')}.<span className="text-slate-100">{e.name}</span> = {e.value}
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ol>
            </div>
          </>
        )}
      </div>
    </Panel>
  );
}
