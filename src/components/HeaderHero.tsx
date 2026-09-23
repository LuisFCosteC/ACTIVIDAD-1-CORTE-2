import { BookOpenText, Cpu, GraduationCap } from 'lucide-react';

const AUTHORS = [
  { name: 'Vanessa Cruz Penna', id: '857613' },
  { name: 'Luis Fernando Coste Contreras', id: '853227' },
];

export function HeaderHero({ onOpenChomsky }: { onOpenChomsky: () => void }) {
  return (
    <header className="border-b border-slate-800 bg-gradient-to-b from-slate-950 to-slate-900">
      <div className="mx-auto flex max-w-[1600px] flex-col gap-5 px-4 py-6 sm:px-6 lg:flex-row lg:items-end lg:justify-between">
        <div className="min-w-0">
          <p className="mb-2 inline-flex items-center gap-2 rounded-full border border-indigo-500/30 bg-indigo-500/10 px-3 py-1 text-xs font-medium text-indigo-200">
            <Cpu className="size-3.5" /> Laboratorio de Análisis Semántico · Teoría de Compiladores
          </p>
          <h1 className="font-display text-2xl font-extrabold leading-tight tracking-tight text-white sm:text-3xl">
            Análisis Semántico:{' '}
            <span className="bg-gradient-to-r from-indigo-300 via-sky-300 to-emerald-300 bg-clip-text text-transparent">
              Del texto bien escrito al programa con sentido operacional
            </span>
          </h1>
          <ul className="mt-3 flex flex-wrap gap-2">
            {AUTHORS.map((a) => (
              <li key={a.id} className="inline-flex items-center gap-2 rounded-lg border border-slate-700 bg-slate-800/60 px-3 py-1.5 text-sm text-slate-200">
                <GraduationCap className="size-4 text-slate-400" />
                {a.name}
                <span className="font-mono text-xs text-slate-400">ID {a.id}</span>
              </li>
            ))}
          </ul>
        </div>
        <button
          onClick={onOpenChomsky}
          className="inline-flex shrink-0 items-center justify-center gap-2 rounded-xl bg-indigo-500 px-4 py-2.5 text-sm font-semibold text-white shadow-lg shadow-indigo-500/20 transition hover:bg-indigo-400 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-300"
        >
          <BookOpenText className="size-4" />
          Jerarquía de Chomsky
        </button>
      </div>
    </header>
  );
}
