import { ArrowRight, Binary, CheckCircle2, ChevronRight, GitFork, ScanText, ShieldAlert, ShieldCheck, ShieldQuestion } from 'lucide-react';
import { Fragment } from 'react';
import type { Token } from '../compiler/lexer';
import { GRAMMAR } from '../compiler/parser';
import type { CompileResult, PhaseStatus } from '../compiler/pipeline';
import type { MemoryCell, SemanticError } from '../compiler/semantic';
import { AstGraph } from './AstGraph';
import { Empty, PhaseCard, TOKEN_STYLE } from './ui';

// ─── Stepper ────────────────────────────────────────────────────────────
export function PipelineStepper({ status }: { status: CompileResult['status'] }) {
  const steps: [string, string, PhaseStatus][] = [
    ['Léxico', 'AFD · Tipo 3', status.lexical],
    ['Sintáctico', 'Descendente recursivo · Tipo 2', status.syntactic],
    ['Semántico', 'Atributos + Tabla de Símbolos', status.semantic],
  ];
  const dot: Record<PhaseStatus, string> = { ok: 'bg-emerald-400', error: 'bg-rose-400 animate-pulse', blocked: 'bg-slate-600' };
  return (
    <ol className="flex flex-col gap-2 sm:flex-row sm:items-center">
      {steps.map(([name, detail, st], i) => (
        <Fragment key={name}>
          <li className="flex flex-1 items-center gap-3 rounded-xl border border-slate-700/70 bg-slate-800/40 px-4 py-2.5">
            <span className={`size-2.5 shrink-0 rounded-full ${dot[st]}`} />
            <span className="min-w-0">
              <span className="block text-sm font-semibold text-slate-100">
                {i + 1}. {name}
              </span>
              <span className="block truncate text-xs text-slate-400">{detail}</span>
            </span>
          </li>
          {i < steps.length - 1 && <ArrowRight className="hidden size-4 shrink-0 text-slate-600 sm:block" />}
        </Fragment>
      ))}
    </ol>
  );
}

// ─── Fase 1 ─────────────────────────────────────────────────────────────
function TokenDetail({ token }: { token: Token }) {
  const reclassified = token.path[token.path.length - 1] === 'qId' && token.type !== 'IDENTIFIER';
  return (
    <div className="mt-4 rounded-xl border border-slate-700 bg-slate-950/60 p-4 text-sm">
      <p className="mb-2 text-slate-300">
        <span className="font-mono text-slate-100">«{token.lexeme}»</span> en línea {token.line}, columna {token.col} → <span className="font-mono text-indigo-300">{token.type}</span>
      </p>
      <p className="mb-1 text-xs font-semibold uppercase tracking-wider text-slate-500">Recorrido del AFD</p>
      <div className="flex flex-wrap items-center gap-1 font-mono text-xs">
        {token.path.map((s, i) => (
          <Fragment key={i}>
            {i > 0 && (
              <span className="flex items-center text-slate-500">
                <ChevronRight className="size-3" />
                <span className="text-slate-400">'{token.lexeme[i - 1] === ' ' ? '␣' : token.lexeme[i - 1]}'</span>
                <ChevronRight className="size-3" />
              </span>
            )}
            <span className={`rounded-md border px-1.5 py-0.5 ${i === token.path.length - 1 && token.type !== 'ERROR' ? 'border-emerald-500/60 bg-emerald-500/10 text-emerald-200 ring-1 ring-emerald-500/30' : 'border-slate-600 text-slate-300'}`}>
              {s}
            </span>
          </Fragment>
        ))}
      </div>
      {reclassified && (
        <p className="mt-2 text-xs text-slate-400">
          El AFD aceptó en <span className="font-mono">qId</span> (IDENTIFIER); la tabla de palabras reservadas lo reclasifica como{' '}
          <span className="font-mono text-slate-200">{token.type}</span>.
        </p>
      )}
    </div>
  );
}

export function LexicalPhase({ result, selected, onSelect }: { result: CompileResult; selected: number | null; onSelect: (i: number | null) => void }) {
  const tokens = result.tokens.filter((t) => t.type !== 'EOF');
  return (
    <PhaseCard
      phase={1}
      title="Análisis Léxico"
      subtitle="Scanner AFD con coincidencia más larga · flujo de tokens"
      status={result.status.lexical}
      icon={<ScanText className="size-5" />}
      aside={<span className="font-mono text-xs text-slate-400">{tokens.length} tokens</span>}
    >
      {tokens.length === 0 ? (
        <Empty>Escriba código para ver el flujo de tokens.</Empty>
      ) : (
        <div className="flex max-h-56 flex-wrap gap-1.5 overflow-y-auto pr-1">
          {result.tokens.map((t, i) =>
            t.type === 'EOF' ? null : (
              <button
                key={i}
                onClick={() => onSelect(selected === i ? null : i)}
                title={`${t.type} · L${t.line}:${t.col}`}
                className={`flex flex-col items-start rounded-lg border px-2 py-1 text-left transition hover:brightness-125 ${TOKEN_STYLE[t.type].chip} ${selected === i ? 'ring-2 ring-indigo-300' : ''}`}
              >
                <span className="text-[9px] font-semibold uppercase tracking-wider opacity-70">{t.type}</span>
                <span className="font-mono text-sm leading-tight">{t.lexeme}</span>
              </button>
            ),
          )}
        </div>
      )}
      {selected !== null && result.tokens[selected] && <TokenDetail token={result.tokens[selected]} />}
      {result.lexErrors.map((e, i) => (
        <p key={i} className="mt-3 rounded-lg border border-rose-500/40 bg-rose-500/10 px-3 py-2 text-sm text-rose-200">
          <strong>Error léxico</strong> (L{e.line}:{e.col}): {e.message}
        </p>
      ))}
    </PhaseCard>
  );
}

// ─── Fase 2 ─────────────────────────────────────────────────────────────
export function SyntacticPhase(props: { result: CompileResult; selectedNode: string | null; onSelectNode: (id: string) => void; version: number }) {
  const { result } = props;
  return (
    <PhaseCard
      phase={2}
      title="Análisis Sintáctico"
      subtitle="Parser descendente recursivo (CFG Tipo 2) · AST estructural"
      status={result.status.syntactic}
      icon={<GitFork className="size-5" />}
    >
      {!result.ast ? (
        <Empty>Fase bloqueada: el scanner reportó errores léxicos.</Empty>
      ) : (
        <>
          {result.syntaxErrors.map((e, i) => (
            <p key={i} className="mb-3 rounded-lg border border-rose-500/40 bg-rose-500/10 px-3 py-2 text-sm text-rose-200">
              <strong>Error sintáctico</strong> (L{e.line}:{e.col}): {e.message}
            </p>
          ))}
          <AstGraph
            ast={result.ast}
            decorations={result.semantic?.decorations ?? null}
            selectedId={props.selectedNode}
            onSelect={props.onSelectNode}
            version={props.version}
          />
          <p className="mt-2 text-xs text-slate-500">
            Haga clic en un nodo para inspeccionar sus atributos de Knuth. {result.semantic ? 'Los nodos muestran el atributo sintetizado ↑tipo.' : 'AST crudo: sin decorar.'}
          </p>
          <details className="mt-3 rounded-xl border border-slate-700 bg-slate-950/40 px-4 py-3">
            <summary className="cursor-pointer text-sm font-semibold text-slate-300">Gramática libre de contexto (EBNF)</summary>
            <dl className="mt-3 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 font-mono text-xs">
              {GRAMMAR.map(([lhs, rhs]) => (
                <Fragment key={lhs}>
                  <dt className="text-right text-indigo-300">{lhs}</dt>
                  <dd className="text-slate-300">→ {rhs}</dd>
                </Fragment>
              ))}
            </dl>
          </details>
        </>
      )}
    </PhaseCard>
  );
}

// ─── Fase 3 ─────────────────────────────────────────────────────────────
function TrafficLight({ status }: { status: PhaseStatus }) {
  const lamps = [
    {
      id: 'error',
      active: status === 'error',
      label: 'Rechazado',
      activeClass: 'bg-rose-500 shadow-[0_0_24px_5px_rgba(244,63,94,0.7)] ring-2 ring-rose-400',
      inactiveClass: 'bg-rose-950/40 border-rose-900/30 opacity-40',
      textActive: 'text-rose-300 font-bold',
    },
    {
      id: 'blocked',
      active: status === 'blocked',
      label: 'Bloqueado',
      activeClass: 'bg-amber-400 shadow-[0_0_24px_5px_rgba(251,191,36,0.6)] ring-2 ring-amber-300',
      inactiveClass: 'bg-amber-950/40 border-amber-900/30 opacity-40',
      textActive: 'text-amber-300 font-bold',
    },
    {
      id: 'ok',
      active: status === 'ok',
      label: 'Aceptado',
      activeClass: 'bg-emerald-400 shadow-[0_0_24px_5px_rgba(52,211,153,0.7)] ring-2 ring-emerald-300',
      inactiveClass: 'bg-emerald-950/40 border-emerald-900/30 opacity-40',
      textActive: 'text-emerald-300 font-bold',
    },
  ];

  return (
    <div
      className="flex flex-row sm:flex-col items-center justify-center gap-3 rounded-2xl border border-slate-700/80 bg-slate-950/90 p-3 shadow-xl"
      aria-label={`Semáforo de validación semántica: estado ${status}`}
    >
      {lamps.map((lamp) => (
        <div key={lamp.id} className="flex flex-col items-center gap-1">
          <span
            className={`size-9 rounded-full border border-black/50 transition-all duration-300 ${lamp.active ? lamp.activeClass : `${lamp.inactiveClass} bg-slate-900`}`}
            title={lamp.label}
          />
          <span className={`text-[10px] uppercase tracking-wider transition-colors ${lamp.active ? lamp.textActive : 'text-slate-600'}`}>
            {lamp.label}
          </span>
        </div>
      ))}
    </div>
  );
}

function MemoryCompare({ expected, actual }: { expected: MemoryCell; actual: MemoryCell }) {
  const max = Math.max(expected.bits, actual.bits, 32);
  const row = (c: MemoryCell, tone: string, other: number) => (
    <div className="grid grid-cols-[minmax(0,9rem)_1fr] items-center gap-3">
      <span className="truncate font-mono text-xs text-slate-300" title={c.label}>
        {c.label} <span className="text-slate-500">: {c.type}</span>
      </span>
      <div className="flex h-6 gap-0.5">
        {Array.from({ length: max / 8 }, (_, i) => {
          const used = i < c.bits / 8;
          const overflow = used && i >= other / 8;
          return (
            <span
              key={i}
              className={`flex-1 rounded-sm ${!used ? 'border border-dashed border-slate-700' : overflow ? 'bg-rose-500/70' : tone}`}
              title={used ? `byte ${i}` : 'sin usar'}
            />
          );
        })}
        <span className="ml-2 w-14 shrink-0 font-mono text-xs leading-6 text-slate-400">{c.bits} bits</span>
      </div>
    </div>
  );
  return (
    <div className="space-y-1.5 rounded-lg border border-slate-700 bg-slate-950/60 p-3">
      {row(expected, 'bg-sky-500/70', Infinity)}
      {row(actual, 'bg-amber-500/70', expected.bits)}
      <p className="text-[11px] text-slate-500">Cada bloque = 1 byte. En rojo, los bytes que no caben en la celda destino.</p>
    </div>
  );
}

function ErrorCard({ err, onFocus }: { err: SemanticError; onFocus: (e: SemanticError) => void }) {
  return (
    <article className="overflow-hidden rounded-xl border border-rose-500/40 bg-rose-950/20 shadow-lg">
      <button onClick={() => onFocus(err)} className="flex w-full flex-wrap items-center gap-2 border-b border-rose-500/30 bg-rose-500/10 px-4 py-2.5 text-left transition hover:bg-rose-500/20">
        <ShieldAlert className="size-4 text-rose-300 shrink-0" />
        <span className="font-semibold text-rose-100">{err.title}</span>
        <span className="ml-auto inline-flex items-center rounded-md border border-rose-400/40 bg-rose-500/20 px-2 py-0.5 font-mono text-[11px] font-bold text-rose-200">
          {err.code}
        </span>
      </button>
      <div className="grid gap-4 p-4 md:grid-cols-2">
        <div className="md:col-span-2">
          <div className="mb-1.5 flex flex-wrap items-center justify-between gap-2">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">Regla formal de tipado</span>
            <span className="inline-flex items-center rounded-md border border-indigo-400/40 bg-indigo-500/15 px-2.5 py-0.5 font-mono text-xs font-bold text-indigo-300">
              Violación: {err.ruleName}
            </span>
          </div>
          <div className="rounded-lg border border-indigo-500/30 bg-slate-950/80 p-3.5 font-mono shadow-inner">
            <p className="text-sm sm:text-base font-semibold text-indigo-200">{err.rule}</p>
            <p className="mt-1.5 text-xs sm:text-sm text-rose-300 bg-rose-950/30 rounded px-2 py-1 border border-rose-500/20">
              ✗ {err.ruleInstance}
            </p>
          </div>
        </div>
        <div>
          <p className="mb-1 text-[11px] font-semibold uppercase tracking-wider text-slate-400">Ubicación en código</p>
          <p className="font-mono text-slate-100">
            Línea {err.line}
            <span className="text-slate-500"> : Columna {err.col}</span>
          </p>
        </div>
        <div>
          <p className="mb-1 text-[11px] font-semibold uppercase tracking-wider text-slate-400">Identificador causante</p>
          <p className="font-mono text-amber-200 font-semibold">{err.identifier}</p>
        </div>
        <p className="text-sm text-slate-300 md:col-span-2 leading-relaxed">{err.message}</p>
        <div className="md:col-span-2">
          <p className="mb-1 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-slate-400">
            <Binary className="size-3.5 text-slate-400" /> Explicación de bajo nivel (Arquitectura & Memoria)
          </p>
          <p className="text-sm leading-relaxed text-slate-300 rounded-lg border border-slate-800 bg-slate-950/40 p-3">{err.lowLevel}</p>
        </div>
        {err.memory && (
          <div className="md:col-span-2">
            <p className="mb-1 text-[11px] font-semibold uppercase tracking-wider text-slate-400">Conflicto en representación binaria</p>
            <MemoryCompare expected={err.memory.expected} actual={err.memory.actual} />
          </div>
        )}
      </div>
    </article>
  );
}

export function SemanticPhase({ result, onFocusError }: { result: CompileResult; onFocusError: (e: SemanticError) => void }) {
  const status = result.status.semantic;
  const sem = result.semantic;
  const headline =
    status === 'ok'
      ? { icon: <ShieldCheck className="size-6 text-emerald-300" />, title: 'Programa ACEPTADO', text: 'Todas las reglas de tipado se satisfacen: el programa tiene sentido operacional y el AST decorado puede pasar a generación de código intermedio.', cls: 'text-emerald-200' }
      : status === 'error'
        ? { icon: <ShieldAlert className="size-6 text-rose-300" />, title: `Programa RECHAZADO · ${sem!.errors.length} error(es) semántico(s)`, text: 'El texto está bien escrito (léxico y sintaxis correctos), pero no significa nada ejecutable.', cls: 'text-rose-200' }
        : { icon: <ShieldQuestion className="size-6 text-amber-300" />, title: 'Análisis semántico BLOQUEADO', text: 'Corrija primero los errores léxicos o sintácticos: sólo un AST completo puede decorarse.', cls: 'text-amber-200' };

  return (
    <PhaseCard
      phase={3}
      title="Análisis Semántico"
      subtitle="Recorrido post-orden · Gramática de Atributos de Knuth · Tabla de Símbolos"
      status={status}
      icon={<CheckCircle2 className="size-5" />}
    >
      <div className="flex flex-col gap-5 sm:flex-row sm:items-center">
        <TrafficLight status={status} />
        <div className="min-w-0 flex-1">
          <p className={`flex items-center gap-2 font-display text-lg font-bold ${headline.cls}`}>
            {headline.icon}
            {headline.title}
          </p>
          <p className="mt-1 text-sm text-slate-400">{headline.text}</p>
          {sem && (
            <dl className="mt-3 flex flex-wrap gap-x-6 gap-y-1 text-sm">
              <div>
                <dt className="inline text-slate-500">Símbolos: </dt>
                <dd className="inline font-mono text-slate-200">{sem.symbols.length}</dd>
              </div>
              <div>
                <dt className="inline text-slate-500">Segmento .data: </dt>
                <dd className="inline font-mono text-slate-200">{sem.dataSegmentSize} B</dd>
              </div>
              <div>
                <dt className="inline text-slate-500">Atributos evaluados: </dt>
                <dd className="inline font-mono text-slate-200">{sem.events.length}</dd>
              </div>
            </dl>
          )}
        </div>
      </div>
      {sem && sem.errors.length > 0 && (
        <div className="mt-5 space-y-4">
          {sem.errors.map((e, i) => (
            <ErrorCard key={i} err={e} onFocus={onFocusError} />
          ))}
        </div>
      )}
    </PhaseCard>
  );
}
