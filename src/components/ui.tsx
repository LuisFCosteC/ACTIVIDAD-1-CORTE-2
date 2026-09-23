import type { ReactNode } from 'react';
import type { TokenType } from '../compiler/lexer';
import type { PhaseStatus } from '../compiler/pipeline';
import type { ScopeKind } from '../compiler/symbolTable';

/** Paleta por tipo de token: [borde/fondo del chip, color de texto en el editor]. */
export const TOKEN_STYLE: Record<TokenType, { chip: string; text: string }> = {
  KEYWORD_TYPE: { chip: 'border-violet-500/40 bg-violet-500/10 text-violet-200', text: 'text-violet-300' },
  CLASS: { chip: 'border-fuchsia-500/40 bg-fuchsia-500/10 text-fuchsia-200', text: 'text-fuchsia-300' },
  NEW: { chip: 'border-fuchsia-500/40 bg-fuchsia-500/10 text-fuchsia-200', text: 'text-fuchsia-300' },
  RETURN: { chip: 'border-fuchsia-500/40 bg-fuchsia-500/10 text-fuchsia-200', text: 'text-fuchsia-300' },
  IDENTIFIER: { chip: 'border-sky-500/40 bg-sky-500/10 text-sky-200', text: 'text-sky-300' },
  INT_LITERAL: { chip: 'border-amber-500/40 bg-amber-500/10 text-amber-200', text: 'text-amber-300' },
  FLOAT_LITERAL: { chip: 'border-amber-500/40 bg-amber-500/10 text-amber-200', text: 'text-amber-300' },
  STRING_LITERAL: { chip: 'border-emerald-500/40 bg-emerald-500/10 text-emerald-200', text: 'text-emerald-300' },
  ASSIGN: { chip: 'border-rose-400/40 bg-rose-400/10 text-rose-200', text: 'text-rose-300' },
  OPERATOR: { chip: 'border-rose-400/40 bg-rose-400/10 text-rose-200', text: 'text-rose-300' },
  DOT: { chip: 'border-slate-500/50 bg-slate-500/10 text-slate-200', text: 'text-slate-300' },
  COMMA: { chip: 'border-slate-500/50 bg-slate-500/10 text-slate-200', text: 'text-slate-400' },
  SEMICOLON: { chip: 'border-slate-500/50 bg-slate-500/10 text-slate-200', text: 'text-slate-400' },
  LPAREN: { chip: 'border-slate-500/50 bg-slate-500/10 text-slate-200', text: 'text-slate-300' },
  RPAREN: { chip: 'border-slate-500/50 bg-slate-500/10 text-slate-200', text: 'text-slate-300' },
  LBRACE: { chip: 'border-slate-500/50 bg-slate-500/10 text-slate-200', text: 'text-slate-300' },
  RBRACE: { chip: 'border-slate-500/50 bg-slate-500/10 text-slate-200', text: 'text-slate-300' },
  ERROR: { chip: 'border-red-500 bg-red-500/20 text-red-100', text: 'text-red-300 underline decoration-wavy decoration-red-500' },
  EOF: { chip: 'border-slate-600 bg-slate-800 text-slate-400', text: '' },
};

export const SCOPE_STYLE: Record<ScopeKind, string> = {
  Global: 'bg-indigo-500/15 text-indigo-200 border-indigo-500/30',
  Local: 'bg-teal-500/15 text-teal-200 border-teal-500/30',
  Clase: 'bg-amber-500/15 text-amber-200 border-amber-500/30',
};

const STATUS_STYLE: Record<PhaseStatus, { cls: string; text: string }> = {
  ok: { cls: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30', text: 'Aceptado' },
  error: { cls: 'bg-rose-500/15 text-rose-300 border-rose-500/30', text: 'Error' },
  blocked: { cls: 'bg-slate-700/60 text-slate-400 border-slate-600', text: 'Bloqueado' },
};

export function StatusBadge({ status }: { status: PhaseStatus }) {
  const s = STATUS_STYLE[status];
  return <span className={`rounded-full border px-2.5 py-0.5 text-xs font-medium ${s.cls}`}>{s.text}</span>;
}

export function Panel({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <section className={`rounded-2xl border border-slate-700/70 bg-slate-800/40 shadow-lg shadow-black/20 ${className}`}>{children}</section>;
}

export function PhaseCard(props: {
  phase: number;
  title: string;
  subtitle: string;
  status: PhaseStatus;
  icon: ReactNode;
  children: ReactNode;
  aside?: ReactNode;
}) {
  return (
    <Panel>
      <header className="flex flex-wrap items-center gap-3 border-b border-slate-700/70 px-5 py-3.5">
        <span className="flex size-9 items-center justify-center rounded-xl bg-slate-900 text-indigo-300 ring-1 ring-slate-700">{props.icon}</span>
        <div className="min-w-0 flex-1">
          <h2 className="font-display text-[15px] font-bold text-slate-100">
            <span className="text-indigo-400">Fase {props.phase}</span> · {props.title}
          </h2>
          <p className="text-xs text-slate-400">{props.subtitle}</p>
        </div>
        {props.aside}
        <StatusBadge status={props.status} />
      </header>
      <div className="p-5">{props.children}</div>
    </Panel>
  );
}

export function Empty({ children }: { children: ReactNode }) {
  return <div className="rounded-xl border border-dashed border-slate-700 px-4 py-8 text-center text-sm text-slate-500">{children}</div>;
}
