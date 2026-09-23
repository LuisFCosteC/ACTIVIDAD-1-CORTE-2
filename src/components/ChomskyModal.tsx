import { Check, Layers, X } from 'lucide-react';
import { useEffect, useMemo, useState, type ReactNode } from 'react';

type Tab = 'jerarquia' | 'wcw' | 'tabla';

const LEVELS = [
  { type: 'Tipo 0', name: 'Recursivamente enumerables', machine: 'Máquina de Turing', rule: 'α → β', phase: 'Ejecución del programa', cls: 'border-slate-500/50 bg-slate-500/5' },
  { type: 'Tipo 1', name: 'Sensibles al contexto', machine: 'Autómata linealmente acotado', rule: 'αAβ → αγβ', phase: 'Fase 3 · Semántica (declaración ↔ uso, tipos)', cls: 'border-rose-500/50 bg-rose-500/5' },
  { type: 'Tipo 2', name: 'Libres de contexto', machine: 'Autómata de pila', rule: 'A → γ', phase: 'Fase 2 · Sintáctica (parser)', cls: 'border-indigo-500/50 bg-indigo-500/5' },
  { type: 'Tipo 3', name: 'Regulares', machine: 'Autómata finito (AFD)', rule: 'A → aB | a', phase: 'Fase 1 · Léxica (scanner)', cls: 'border-emerald-500/50 bg-emerald-500/5' },
];

interface PdaStep {
  read: string;
  top: string;
  ok: boolean;
}

function simulate(input: string) {
  if (!input) {
    return { error: 'empty' as const };
  }
  const cCount = (input.match(/c/g) || []).length;
  if (cCount === 0) {
    return { error: 'missing_c' as const };
  }
  if (cCount > 1) {
    return { error: 'multiple_c' as const };
  }
  if (!/^[ab]*c[ab]*$/.test(input)) {
    return { error: 'invalid_chars' as const };
  }
  const [w1, w2] = input.split('c');
  const stack = [...w1];
  const steps: PdaStep[] = [];
  let rejected = false;
  for (const ch of w2) {
    const top = stack.pop() ?? '∅';
    const ok = top === ch;
    steps.push({ read: ch, top, ok });
    if (!ok) {
      rejected = true;
      break;
    }
  }
  const remainingStack = [...stack];
  return {
    error: null,
    w1,
    w2,
    steps,
    remainingStack,
    inWcwR: !rejected && remainingStack.length === 0 && w1.length === w2.length,
    inWcw: w1 === w2,
  };
}

function Hierarchy() {
  const nest = (i: number): ReactNode => {
    const l = LEVELS[i];
    return (
      <div className={`rounded-2xl border p-3 sm:p-4 ${l.cls} ${i === 2 ? 'ring-2 ring-indigo-400/40' : ''}`}>
        <div className="mb-3 flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
          <p className="font-display text-sm font-bold text-slate-100">
            {l.type} · {l.name}
          </p>
          <p className="text-xs text-slate-400">
            {l.machine} · <span className="font-mono text-slate-300">{l.rule}</span>
          </p>
        </div>
        <p className="mb-3 text-xs text-slate-300">↳ {l.phase}</p>
        {i < LEVELS.length - 1 && nest(i + 1)}
      </div>
    );
  };
  return (
    <div className="space-y-4">
      {nest(0)}
      <p className="text-sm leading-relaxed text-slate-300">
        Cada fase del front-end trabaja con el nivel más bajo que le basta. El parser del laboratorio reconoce una gramática{' '}
        <strong className="text-indigo-300">Tipo 2</strong>: sabe que <code className="font-mono text-slate-100">int edad = "veinte";</code>{' '}
        tiene la forma <code className="font-mono text-slate-100">Tipo ID = Expr ;</code>, pero una producción libre de contexto{' '}
        <code className="font-mono">A → γ</code> reescribe <code className="font-mono">A</code> sin mirar a su alrededor, así que no puede
        exigir que el tipo de la derecha coincida con el declarado a la izquierda. Esa restricción pertenece al{' '}
        <strong className="text-rose-300">Tipo 1</strong>.
      </p>
    </div>
  );
}

function WcwLab() {
  const [input, setInput] = useState('abcab');
  const sim = useMemo(() => simulate(input.trim()), [input]);
  return (
    <div className="space-y-5">
      <div className="rounded-xl border border-slate-700 bg-slate-950/60 p-4 text-center">
        <p className="font-mono text-lg text-slate-100">
          L = {'{'} w c w | w ∈ {'{'}a, b{'}'}* {'}'}
        </p>
        <p className="mt-1 text-xs text-slate-400">No es libre de contexto (se demuestra con el lema de bombeo para LLC).</p>
      </div>

      <p className="text-sm leading-relaxed text-slate-300">
        Un autómata de pila sólo recuerda lo último que apiló (LIFO). Si apila <code className="font-mono">w</code> y luego desapila al leer
        la segunda mitad, compara los símbolos <em>en orden inverso</em>: reconoce <code className="font-mono">w c wᴿ</code> (el palíndromo), pero
        no <code className="font-mono">w c w</code>. Pruébalo:
      </p>

      <div className="flex flex-wrap items-center gap-2">
        <input
          value={input}
          placeholder="ej. abcab"
          onChange={(e) => setInput(e.target.value.replace(/[^abc]/g, ''))}
          aria-label="Cadena sobre {a, b, c}"
          className="w-48 rounded-lg border border-slate-600 bg-slate-900 px-3 py-2 font-mono text-slate-100 placeholder:text-slate-600 outline-none focus:border-indigo-400"
        />
        {[
          { text: 'c', desc: 'ε c ε (caso borde)' },
          { text: 'abcab', desc: 'w c w' },
          { text: 'abcba', desc: 'w c wᴿ' },
          { text: 'abbcabb', desc: 'w c w' },
          { text: 'abcb', desc: '|w₁| ≠ |w₂|' },
        ].map((item) => (
          <button
            key={item.text}
            onClick={() => setInput(item.text)}
            title={item.desc}
            className="rounded-lg border border-slate-700 bg-slate-800/40 px-2.5 py-1.5 font-mono text-xs text-slate-300 hover:border-slate-500 hover:bg-slate-800 hover:text-white transition"
          >
            {item.text}
          </button>
        ))}
      </div>

      {sim.error === 'empty' ? (
        <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-3.5 text-sm text-amber-200">
          <p className="font-semibold">Cadena vacía</p>
          <p className="text-xs text-amber-300/80 mt-0.5">
            Escriba una cadena o elija un preset. Debe contener caracteres sobre el alfabeto {'{'}a, b{'}'} separados por un delimitador central 'c'.
          </p>
        </div>
      ) : sim.error === 'missing_c' ? (
        <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-3.5 text-sm text-amber-200">
          <p className="font-semibold">Falta el delimitador central 'c'</p>
          <p className="text-xs text-amber-300/80 mt-0.5">
            El lenguaje exige el formato <code className="font-mono">w c w</code>. Inserte el carácter 'c' para delimitar la primera y segunda mitad.
          </p>
        </div>
      ) : sim.error === 'multiple_c' ? (
        <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 p-3.5 text-sm text-rose-200">
          <p className="font-semibold">Múltiples delimitadores 'c'</p>
          <p className="text-xs text-rose-300/80 mt-0.5">
            La definición formal establece exactamente una 'c' central: <code className="font-mono">w ∈ {'{'}a, b{'}'}*</code>.
          </p>
        </div>
      ) : sim.error === 'invalid_chars' ? (
        <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 p-3.5 text-sm text-rose-200">
          <p className="font-semibold">Caracteres no permitidos</p>
          <p className="text-xs text-rose-300/80 mt-0.5">Sólo se permiten símbolos del alfabeto {'{'}a, b, c{'}'}.</p>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          <div className="rounded-xl border border-slate-700 bg-slate-900/60 p-4">
            <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-400">Autómata de pila (desapila al leer w₂)</p>
            <p className="mb-3 font-mono text-sm text-slate-300">
              pila tras apilar w₁ = «{sim.w1 || 'ε'}»: [{[...sim.w1].join(', ')}] ← tope
            </p>
            <ol className="space-y-1 font-mono text-sm">
              {sim.steps.map((s, i) => (
                <li key={i} className={s.ok ? 'text-emerald-300' : 'text-rose-300'}>
                  lee '{s.read}', desapila '{s.top}' → {s.ok ? 'coincide' : 'no coincide'}
                </li>
              ))}
              {sim.steps.length === 0 && (
                <li className="text-slate-400">
                  {sim.w2.length === 0 ? '(w₂ = ε: no hay caracteres que leer tras la c)' : ''}
                </li>
              )}
              {sim.remainingStack.length > 0 && (
                <li className="text-rose-300 font-semibold mt-1">
                  ✗ Pila no vacía: quedaron [{sim.remainingStack.join(', ')}] sin emparejar.
                </li>
              )}
            </ol>
          </div>
          <div className="space-y-3">
            <Verdict
              label="w c wᴿ  (libre de contexto · Tipo 2)"
              ok={sim.inWcwR}
              note="La pila basta: la disciplina LIFO (Last-In, First-Out) invierte naturalmente el orden al desapilar."
            />
            <Verdict
              label="w c w  (sensible al contexto · Tipo 1)"
              ok={sim.inWcw}
              note="Requiere comparar en orden original (FIFO / acceso directo): imposible para un autómata de pila determinista o no determinista."
            />
          </div>
        </div>
      )}

      <details className="rounded-xl border border-slate-700 bg-slate-900/40 p-4 text-sm text-slate-300">
        <summary className="cursor-pointer font-semibold text-slate-200">Esbozo: lema de bombeo</summary>
        <p className="mt-2 leading-relaxed">
          Suponga que L es libre de contexto con constante p. Tome s = aᵖbᵖ c aᵖbᵖ ∈ L. Toda partición s = uvxyz con |vxy| ≤ p y |vy| ≥ 1 deja
          que vxy toque a lo sumo dos bloques adyacentes. Si vy contiene la c, uv⁰xy⁰z no tiene c. Si no, bombear cambia la cantidad de a o de b
          en una sola mitad (o en el final de la primera y el inicio de la segunda de forma desigual), y uv²xy²z deja de tener la forma w c w.
          Contradicción: L no es Tipo 2.
        </p>
      </details>
    </div>
  );
}

function Verdict({ label, ok, note }: { label: string; ok: boolean; note: string }) {
  return (
    <div className={`rounded-xl border p-3 ${ok ? 'border-emerald-500/40 bg-emerald-500/10' : 'border-rose-500/40 bg-rose-500/10'}`}>
      <p className="flex items-center gap-2 font-mono text-sm text-slate-100">
        {ok ? <Check className="size-4 text-emerald-300" /> : <X className="size-4 text-rose-300" />}
        {ok ? '∈' : '∉'} {label}
      </p>
      <p className="mt-1 text-xs text-slate-400">{note}</p>
    </div>
  );
}

function WhyTable() {
  return (
    <div className="space-y-5 text-sm leading-relaxed text-slate-300">
      <p>
        <code className="font-mono">w c w</code> es exactamente la forma de un programa que declara un nombre y después lo usa:
      </p>
      <pre className="overflow-x-auto rounded-xl border border-slate-700 bg-slate-950/70 p-4 font-mono text-[13px] leading-6">
        <span className="text-violet-300">int</span> <span className="rounded bg-sky-500/20 px-1 text-sky-200">contador</span>
        <span className="text-slate-500">;          ← primera w (declaración)</span>
        {'\n'}
        <span className="text-slate-500">// … cualquier cantidad de código …     ← c</span>
        {'\n'}
        <span className="rounded bg-sky-500/20 px-1 text-sky-200">contador</span> = 5;
        <span className="text-slate-500">          ← segunda w (uso): ¿es el mismo identificador?</span>
      </pre>
      <ul className="grid gap-3 md:grid-cols-3">
        <li className="rounded-xl border border-slate-700 bg-slate-900/60 p-4">
          <p className="mb-1 font-semibold text-slate-100">1. El límite</p>
          Ninguna gramática Tipo 2 puede verificar que cada uso coincide con una declaración previa, ni que su tipo es compatible: eso es{' '}
          <code className="font-mono">wcw</code>.
        </li>
        <li className="rounded-xl border border-slate-700 bg-slate-900/60 p-4">
          <p className="mb-1 font-semibold text-slate-100">2. La salida práctica</p>
          En lugar de subir a un parser Tipo 1 (costoso), el compilador mantiene la gramática Tipo 2 y agrega una{' '}
          <strong className="text-indigo-300">Tabla de Símbolos</strong>: una memoria con búsqueda por nombre en O(1) promedio.
        </li>
        <li className="rounded-xl border border-slate-700 bg-slate-900/60 p-4">
          <p className="mb-1 font-semibold text-slate-100">3. La formalización</p>
          Las <strong className="text-emerald-300">Gramáticas de Atributos de Knuth</strong> adjuntan ecuaciones a cada producción: atributos
          heredados bajan el entorno, sintetizados suben los tipos. El contexto viaja por los atributos, no por la gramática.
        </li>
      </ul>
    </div>
  );
}

export function ChomskyModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [tab, setTab] = useState<Tab>('jerarquia');

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  const tabs: [Tab, string][] = [
    ['jerarquia', 'Jerarquía'],
    ['wcw', 'L = { wcw }'],
    ['tabla', '¿Por qué una Tabla de Símbolos?'],
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-slate-950/80 p-3 backdrop-blur-sm sm:p-8" onMouseDown={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="chomsky-title"
        onMouseDown={(e) => e.stopPropagation()}
        className="w-full max-w-4xl rounded-2xl border border-slate-700 bg-slate-900 shadow-2xl"
      >
        <header className="flex items-center gap-3 border-b border-slate-800 px-5 py-4">
          <Layers className="size-5 text-indigo-300" />
          <h2 id="chomsky-title" className="flex-1 font-display text-lg font-bold text-white">
            Jerarquía de Chomsky y el límite de las gramáticas Tipo 2
          </h2>
          <button onClick={onClose} aria-label="Cerrar" className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-800 hover:text-white">
            <X className="size-5" />
          </button>
        </header>
        <nav className="flex gap-1 overflow-x-auto border-b border-slate-800 px-3 pt-2">
          {tabs.map(([id, label]) => (
            <button
              key={id}
              onClick={() => setTab(id)}
              className={`whitespace-nowrap rounded-t-lg px-3.5 py-2 text-sm font-medium transition ${tab === id ? 'bg-slate-800 text-white' : 'text-slate-400 hover:text-slate-200'}`}
            >
              {label}
            </button>
          ))}
        </nav>
        <div className="p-5 sm:p-6">
          {tab === 'jerarquia' && <Hierarchy />}
          {tab === 'wcw' && <WcwLab />}
          {tab === 'tabla' && <WhyTable />}
        </div>
      </div>
    </div>
  );
}
