import { Box, Braces, Check, Database, FunctionSquare, Minus, Variable, X } from 'lucide-react';
import type { ReactNode } from 'react';
import type { SemanticResult } from '../compiler/semantic';
import type { SymbolEntry, SymbolKind } from '../compiler/symbolTable';
import { Empty, Panel, SCOPE_STYLE } from './ui';

const KIND_ICON: Record<SymbolKind, ReactNode> = {
  variable: <Variable className="size-3.5 text-sky-300" />,
  parámetro: <Variable className="size-3.5 text-teal-300" />,
  función: <FunctionSquare className="size-3.5 text-orange-300" />,
  clase: <Box className="size-3.5 text-fuchsia-300" />,
  campo: <Braces className="size-3.5 text-amber-300" />,
};

const CELL_TONES = ['bg-indigo-500/60', 'bg-sky-500/60', 'bg-teal-500/60', 'bg-violet-500/60', 'bg-amber-500/60', 'bg-emerald-500/60'];

interface Region {
  title: string;
  total: number;
  cells: { name: string; offset: number; size: number; type: string }[];
}

/** Barra de bytes de una región de memoria (.data, marco de pila, objeto) con relleno de alineación visible. */
function MemoryStrip({ region }: { region: Region }) {
  const total = Math.max(region.total, 1);
  return (
    <div className="w-full max-w-full overflow-hidden">
      <p className="mb-1 flex items-center justify-between text-[11px] text-slate-400 gap-2">
        <span className="font-mono truncate" title={region.title}>{region.title}</span>
        <span className="font-mono shrink-0 font-semibold text-slate-300">{region.total} B</span>
      </p>
      <div className="relative h-7 w-full overflow-hidden rounded-md border border-slate-700 bg-[repeating-linear-gradient(135deg,rgb(51_65_85/0.35)_0_4px,transparent_4px_8px)] select-none">
        {region.cells.map((c, i) => (
          <div
            key={`${c.name}-${c.offset}`}
            title={`${c.name}: ${c.type} · offset ${c.offset} · ${c.size} B`}
            className={`absolute inset-y-0 flex items-center justify-center overflow-hidden border-r border-slate-900 px-1 font-mono text-[9px] sm:text-[10px] text-white transition-opacity hover:opacity-90 ${CELL_TONES[i % CELL_TONES.length]}`}
            style={{ left: `${(c.offset / total) * 100}%`, width: `${(c.size / total) * 100}%` }}
          >
            <span className="truncate">{c.name}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function regions(sem: SemanticResult): Region[] {
  const out: Region[] = [];
  const globals = sem.symbols.filter((s) => s.base === '.data');
  if (globals.length) {
    out.push({ title: 'Segmento .data (Global)', total: sem.dataSegmentSize, cells: globals.map((s) => ({ name: s.name, offset: s.offset!, size: s.size, type: s.type })) });
  }
  const frames = new Map<string, SymbolEntry[]>();
  for (const s of sem.symbols.filter((s) => s.base === 'frame')) frames.set(s.scopeName, [...(frames.get(s.scopeName) ?? []), s]);
  for (const [name, syms] of frames) {
    const last = syms[syms.length - 1];
    out.push({ title: `Marco de pila · ${name}`, total: last.offset! + last.size, cells: syms.map((s) => ({ name: s.name, offset: s.offset!, size: s.size, type: s.type })) });
  }
  for (const c of sem.classes) {
    out.push({ title: `Layout de objeto · ${c.name}`, total: c.size, cells: c.fields.map((f) => ({ ...f })) });
  }
  return out;
}

function InitCell({ s }: { s: SymbolEntry }) {
  if (s.kind === 'clase') return <Minus className="mx-auto size-3.5 text-slate-600" />;
  if (s.kind === 'función') {
    return <span className={`text-[11px] ${s.initialized ? 'text-emerald-300' : 'text-amber-300'}`}>{s.initialized ? 'definida' : 'prototipo'}</span>;
  }
  return s.initialized ? <Check className="mx-auto size-4 text-emerald-400" aria-label="sí" /> : <X className="mx-auto size-4 text-rose-400" aria-label="no" />;
}

export function SymbolTableViewer({ semantic }: { semantic: SemanticResult | null }) {
  return (
    <Panel>
      <header className="flex items-center gap-2 border-b border-slate-700/70 px-4 py-3">
        <Database className="size-4 text-indigo-300" />
        <h2 className="font-display text-[15px] font-bold text-slate-100">Tabla de Símbolos</h2>
        <span className="ml-auto text-xs text-slate-500">pila de ámbitos Γ</span>
      </header>
      <div className="p-4">
        {!semantic ? (
          <Empty>La fase semántica no se ejecutó: no hay entornos que mostrar.</Empty>
        ) : semantic.symbols.length === 0 ? (
          <Empty>Sin declaraciones.</Empty>
        ) : (
          <>
            <div className="-mx-4 max-w-[calc(100%+2rem)] overflow-x-auto px-4 scrollbar-thin">
              <table className="w-full min-w-[340px] text-left text-xs sm:text-sm">
                <thead>
                  <tr className="border-b border-slate-700 text-[10px] sm:text-[11px] uppercase tracking-wider text-slate-500">
                    <th className="py-2 pr-1.5 font-semibold">Nombre</th>
                    <th className="py-2 pr-1.5 font-semibold">Tipo</th>
                    <th className="py-2 pr-1.5 font-semibold">Ámbito</th>
                    <th className="py-2 pr-1.5 text-center font-semibold">Init.</th>
                    <th className="py-2 pr-1.5 font-semibold">Offset</th>
                    <th className="py-2 text-right font-semibold">Tamaño</th>
                  </tr>
                </thead>
                <tbody>
                  {semantic.symbols.map((s, i) => (
                    <tr key={`${s.name}-${s.scopeName}-${i}`} className="border-b border-slate-800 last:border-0 hover:bg-slate-800/30">
                      <td className="py-2 pr-1.5">
                        <span className="flex items-center gap-1.5 font-mono text-slate-100" title={`${s.kind}: ${s.name}`}>
                          {KIND_ICON[s.kind]}
                          <span className="truncate max-w-[5.5rem] sm:max-w-none">{s.name}</span>
                        </span>
                      </td>
                      <td className="max-w-[5.5rem] sm:max-w-[7rem] truncate py-2 pr-1.5 font-mono text-[11px] sm:text-xs text-violet-200" title={s.type}>
                        {s.type}
                      </td>
                      <td className="py-2 pr-1.5">
                        <span className={`inline-block max-w-[5rem] sm:max-w-[6.5rem] truncate rounded border px-1.5 py-0.5 text-[10px] sm:text-[11px] ${SCOPE_STYLE[s.scope]}`} title={s.scopeName}>
                          {s.scopeName}
                        </span>
                      </td>
                      <td className="py-2 pr-1.5 text-center">
                        <InitCell s={s} />
                      </td>
                      <td className="py-2 pr-1.5 font-mono text-[11px] sm:text-xs text-slate-300 whitespace-nowrap">{s.offset === null ? '—' : `${s.base}+${s.offset}`}</td>
                      <td className="py-2 text-right font-mono text-[11px] sm:text-xs text-slate-300 whitespace-nowrap">{s.size} B</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {regions(semantic).length > 0 && (
              <div className="mt-4 space-y-3 border-t border-slate-800 pt-4">
                <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">Memoria relativa (offsets alineados a su tamaño)</p>
                {regions(semantic).map((r) => (
                  <MemoryStrip key={r.title} region={r} />
                ))}
                <p className="text-[11px] text-slate-500 break-words leading-relaxed">
                  int / float = 4 B · String y referencias = puntero 8 B · rayado = relleno de alineación.
                </p>
              </div>
            )}
          </>
        )}
      </div>
    </Panel>
  );
}
