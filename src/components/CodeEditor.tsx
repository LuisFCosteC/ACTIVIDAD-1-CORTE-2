import { FileCode2, RotateCcw } from 'lucide-react';
import { useMemo, useRef, type KeyboardEvent } from 'react';
import type { Token } from '../compiler/lexer';
import { PRESETS } from '../compiler/presets';
import { Panel, TOKEN_STYLE } from './ui';

interface Segment {
  text: string;
  cls: string;
  tokenIndex: number | null;
}

/** Parte el código en líneas de segmentos coloreados según los tokens del scanner. */
function highlight(source: string, tokens: Token[]): Segment[][] {
  const segs: Segment[] = [];
  let pos = 0;
  tokens.forEach((t, i) => {
    if (t.type === 'EOF') return;
    if (t.start > pos) segs.push({ text: source.slice(pos, t.start), cls: 'text-slate-500', tokenIndex: null });
    segs.push({ text: source.slice(t.start, t.end), cls: TOKEN_STYLE[t.type].text, tokenIndex: i });
    pos = t.end;
  });
  if (pos < source.length) segs.push({ text: source.slice(pos), cls: 'text-slate-500', tokenIndex: null });

  const lines: Segment[][] = [[]];
  for (const seg of segs) {
    seg.text.split('\n').forEach((part, i) => {
      if (i > 0) lines.push([]);
      if (part) lines[lines.length - 1].push({ ...seg, text: part });
    });
  }
  return lines;
}

export function PresetSelector({ active, onSelect }: { active: string | null; onSelect: (id: string) => void }) {
  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 2xl:grid-cols-6">
      {PRESETS.map((p) => {
        const on = p.id === active;
        return (
          <button
            key={p.id}
            onClick={() => onSelect(p.id)}
            aria-pressed={on}
            className={`group rounded-xl border px-3 py-2.5 text-left transition ${
              on ? 'border-indigo-400 bg-indigo-500/15 ring-1 ring-indigo-400/50' : 'border-slate-700 bg-slate-800/40 hover:border-slate-500 hover:bg-slate-800'
            }`}
          >
            <span className="flex items-center gap-2">
              <span className={`size-2 rounded-full ${p.expected === 'ok' ? 'bg-emerald-400' : 'bg-rose-400'}`} />
              <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">{p.label}</span>
            </span>
            <span className="mt-0.5 block text-sm font-semibold text-slate-100">{p.title}</span>
            <span className="mt-0.5 line-clamp-2 block text-xs text-slate-400">{p.summary}</span>
          </button>
        );
      })}
    </div>
  );
}

export function CodeEditor(props: {
  value: string;
  onChange: (v: string) => void;
  onReset: () => void;
  tokens: Token[];
  errorLines: Set<number>;
  selectedToken: number | null;
  timeMs: number;
}) {
  const { value, onChange, tokens, errorLines, selectedToken } = props;
  const taRef = useRef<HTMLTextAreaElement>(null);
  const preRef = useRef<HTMLDivElement>(null);
  const lines = useMemo(() => highlight(value, tokens), [value, tokens]);

  const syncScroll = () => {
    if (taRef.current && preRef.current) {
      preRef.current.scrollTop = taRef.current.scrollTop;
      preRef.current.scrollLeft = taRef.current.scrollLeft;
    }
  };

  const onKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key !== 'Tab') return;
    e.preventDefault();
    const ta = e.currentTarget;
    const { selectionStart: s, selectionEnd: end } = ta;
    onChange(value.slice(0, s) + '  ' + value.slice(end));
    requestAnimationFrame(() => ta.setSelectionRange(s + 2, s + 2));
  };

  return (
    <Panel className="overflow-hidden">
      <div className="flex items-center gap-2 border-b border-slate-700/70 bg-slate-900/60 px-4 py-2.5">
        <FileCode2 className="size-4 text-slate-400" />
        <span className="font-mono text-sm text-slate-300">programa.src</span>
        <span className="ml-auto hidden text-xs text-slate-500 sm:inline">compilación en vivo · {props.timeMs.toFixed(2)} ms</span>
        <button onClick={props.onReset} className="inline-flex items-center gap-1.5 rounded-lg px-2 py-1 text-xs text-slate-400 hover:bg-slate-800 hover:text-slate-100">
          <RotateCcw className="size-3.5" /> Restablecer
        </button>
      </div>
      <div className="relative flex h-64 bg-slate-950/50">
        <div aria-hidden className="editor-layer w-11 shrink-0 select-none overflow-hidden border-r border-slate-800 py-3 text-right">
          {lines.map((_, i) => (
            <div key={i} className={`pr-2.5 ${errorLines.has(i + 1) ? 'bg-rose-500/20 font-semibold text-rose-300' : 'text-slate-600'}`}>
              {i + 1}
            </div>
          ))}
        </div>
        <div className="relative min-w-0 flex-1">
          <div ref={preRef} aria-hidden className="editor-layer pointer-events-none absolute inset-0 overflow-hidden whitespace-pre py-3">
            {lines.map((segs, i) => (
              <div key={i} className={`px-3 ${errorLines.has(i + 1) ? 'bg-rose-500/10' : ''}`}>
                {segs.map((s, j) => (
                  <span key={j} className={`${s.cls} ${s.tokenIndex !== null && s.tokenIndex === selectedToken ? 'rounded-sm bg-indigo-400/30 ring-1 ring-indigo-300' : ''}`}>
                    {s.text}
                  </span>
                ))}
                {'​'}
              </div>
            ))}
          </div>
          <textarea
            ref={taRef}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            onScroll={syncScroll}
            onKeyDown={onKeyDown}
            spellCheck={false}
            autoCapitalize="off"
            autoComplete="off"
            aria-label="Código fuente"
            className="editor-layer absolute inset-0 resize-none overflow-auto whitespace-pre bg-transparent px-3 py-3 text-transparent caret-indigo-300 outline-none selection:bg-indigo-500/40"
            wrap="off"
          />
        </div>
      </div>
    </Panel>
  );
}
