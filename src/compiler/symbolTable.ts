/**
 * Tabla de Símbolos como pila de entornos (Γ₀ ⊂ Γ₁ ⊂ …).
 *
 * Es la "memoria" que la gramática libre de contexto no tiene: permite
 * comprobar que el `w` usado coincide con el `w` declarado (L = { wcw }).
 * Cada símbolo guarda tipo, ámbito, estado de inicialización y su
 * dirección relativa (offset alineado a su tamaño) dentro del segmento
 * de datos global, del marco de pila de la función o del objeto.
 */

export type ScopeKind = 'Global' | 'Local' | 'Clase';
export type SymbolKind = 'variable' | 'parámetro' | 'función' | 'clase' | 'campo';
export type AddressBase = '.data' | 'frame' | 'obj';

export interface ParamSig {
  name: string;
  type: string;
}

export interface SymbolEntry {
  name: string;
  kind: SymbolKind;
  type: string;
  scope: ScopeKind;
  scopeName: string;
  level: number;
  initialized: boolean;
  /** null para funciones y clases (viven en el segmento de código / son metadatos). */
  offset: number | null;
  base: AddressBase | null;
  size: number;
  line: number;
  signature?: { params: ParamSig[]; returnType: string };
}

export interface FieldLayout {
  name: string;
  type: string;
  offset: number;
  size: number;
}

export interface ClassInfo {
  name: string;
  fields: FieldLayout[];
  size: number;
}

export const PRIMITIVE_SIZES: Record<string, number> = { int: 4, float: 4, String: 8, void: 0 };
/** Toda referencia (String, instancias de clase) es un puntero de 64 bits. */
export const POINTER_SIZE = 8;

const BASE_OF: Record<ScopeKind, AddressBase> = { Global: '.data', Local: 'frame', Clase: 'obj' };

export class Scope {
  readonly symbols = new Map<string, SymbolEntry>();
  nextOffset = 0;

  constructor(
    readonly name: string,
    readonly kind: ScopeKind,
    readonly level: number,
  ) {}

  /** Reserva `size` bytes alineados a su propio tamaño y devuelve el offset. */
  allocate(size: number): number {
    if (size === 0) return this.nextOffset;
    const offset = Math.ceil(this.nextOffset / size) * size;
    this.nextOffset = offset + size;
    return offset;
  }
}

export type DeclareInput = Omit<SymbolEntry, 'scope' | 'scopeName' | 'level' | 'offset' | 'base' | 'size'> & {
  /** Las funciones y clases no ocupan espacio en el segmento de datos. */
  storage: boolean;
  size?: number;
};

export class SymbolTable {
  private readonly stack: Scope[] = [];
  /** Todos los símbolos declarados (incluso de ámbitos ya cerrados), para la UI. */
  readonly history: SymbolEntry[] = [];
  readonly classes = new Map<string, ClassInfo>();
  globalSize = 0;

  constructor() {
    this.enterScope('Global', 'Global');
  }

  get current(): Scope {
    return this.stack[this.stack.length - 1];
  }

  get depth(): number {
    return this.stack.length;
  }

  enterScope(name: string, kind: ScopeKind): Scope {
    const scope = new Scope(name, kind, this.stack.length);
    this.stack.push(scope);
    return scope;
  }

  exitScope(): Scope {
    const scope = this.stack.pop()!;
    if (scope.kind === 'Global') this.globalSize = scope.nextOffset;
    return scope;
  }

  isType(name: string): boolean {
    return name in PRIMITIVE_SIZES || this.classes.has(name);
  }

  sizeOf(type: string): number {
    return type in PRIMITIVE_SIZES ? PRIMITIVE_SIZES[type] : POINTER_SIZE;
  }

  /** Inserta en el ámbito actual. Devuelve el símbolo previo si hay conflicto. */
  declare(input: DeclareInput): { ok: true; entry: SymbolEntry } | { ok: false; existing: SymbolEntry } {
    const scope = this.current;
    const existing = scope.symbols.get(input.name);
    if (existing) return { ok: false, existing };

    const { storage, size: explicitSize, ...rest } = input;
    const size = explicitSize ?? (storage ? this.sizeOf(input.type) : 0);
    const entry: SymbolEntry = {
      ...rest,
      scope: scope.kind,
      scopeName: scope.name,
      level: scope.level,
      offset: storage ? scope.allocate(size) : null,
      base: storage ? BASE_OF[scope.kind] : null,
      size,
    };
    scope.symbols.set(entry.name, entry);
    this.history.push(entry);
    if (scope.kind === 'Global') this.globalSize = scope.nextOffset;
    return { ok: true, entry };
  }

  /** Búsqueda desde el ámbito más interno hacia el global (regla de anidamiento léxico). */
  lookup(name: string): SymbolEntry | undefined {
    for (let i = this.stack.length - 1; i >= 0; i--) {
      const s = this.stack[i];
      if (s.kind === 'Clase') continue;
      const hit = s.symbols.get(name);
      if (hit) return hit;
    }
    return undefined;
  }

  lookupLocal(name: string): SymbolEntry | undefined {
    return this.current.symbols.get(name);
  }

  scopeChain(): string[] {
    return this.stack.map((s) => s.name);
  }
}
