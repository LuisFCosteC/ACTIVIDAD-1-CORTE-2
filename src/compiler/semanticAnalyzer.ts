/**
 * FASE 3 — Análisis Semántico.
 *
 * Decora el AST con una Gramática de Atributos (Knuth, 1968) L-atribuida:
 *   • Atributos HEREDADOS (↓): fluyen del padre (o hermanos izquierdos) al
 *     hijo antes de visitarlo: entorno, tipoEsperado, rol, tipoRetorno.
 *   • Atributos SINTETIZADOS (↑): se calculan en post-orden, después de
 *     visitar a los hijos: tipo, ancho, lvalue, ok…
 * Al ser L-atribuida basta un único recorrido en profundidad de izquierda a
 * derecha; el orden de evaluación queda registrado en `events`.
 */
import {
  nodeLabel,
  nodeTitle,
  type ASTNode,
  type AssignmentNode,
  type CallNode,
  type ClassDeclNode,
  type ExprNode,
  type FuncDeclNode,
  type MemberAccessNode,
  type ProgramNode,
  type StmtNode,
  type VarDeclNode,
} from './ast';
import { ERROR_TYPE, type AttrDirection, type DecorationMap, type EvalEvent, type MemoryCell, type SemanticError, type SemanticResult } from './semantic';
import { SymbolTable, type FieldLayout, type SymbolEntry } from './symbolTable';

interface Inh {
  entorno: string;
  tipoEsperado?: string;
  rol?: 'l-value' | 'r-value';
  tipoRetorno?: string;
}

type InhRules = Partial<Record<keyof Inh, string>>;

const NUMERIC = new Set(['int', 'float']);
const INT_REGS = [
  ['RDI', 'EDI'],
  ['RSI', 'ESI'],
  ['RDX', 'EDX'],
  ['RCX', 'ECX'],
  ['R8', 'R8D'],
  ['R9', 'R9D'],
];

export class SemanticAnalyzer {
  private readonly table = new SymbolTable();
  private readonly errors: SemanticError[] = [];
  private readonly decorations: DecorationMap = {};
  private readonly events: EvalEvent[] = [];
  private step = 0;

  analyze(program: ProgramNode): SemanticResult {
    const inh: Inh = { entorno: 'Global' };
    this.record(program, 'inherited', 'entorno', 'Global', 'Program.entorno := Γ₀ (tabla global vacía)');
    for (const stmt of program.body) {
      this.descend(stmt, program, inh);
      this.visitStmt(stmt, inh);
    }
    this.table.exitScope();
    this.record(program, 'synthesized', 'errores', String(this.errors.length), 'Program.errores := Σ errores(stmtᵢ)');
    this.record(program, 'synthesized', 'segmentoDatos', `${this.table.globalSize} B`, 'Program.segmentoDatos := Σ tamaño(símbolos globales) + relleno');
    this.record(program, 'synthesized', 'ok', String(this.errors.length === 0), 'Program.ok := ∧ ok(stmtᵢ)');

    return {
      errors: this.errors,
      decorations: this.decorations,
      events: this.events,
      symbols: this.table.history,
      classes: [...this.table.classes.values()],
      dataSegmentSize: this.table.globalSize,
    };
  }

  // ─── registro de atributos ────────────────────────────────────────────
  private record(node: ASTNode, dir: AttrDirection, name: string, value: string, rule: string) {
    const deco = (this.decorations[node.id] ??= { inherited: [], synthesized: [], hasError: false });
    const step = ++this.step;
    (dir === 'inherited' ? deco.inherited : deco.synthesized).push({ name, value, rule, step });
    this.events.push({ step, nodeId: node.id, nodeTitle: nodeTitle(node), nodeLabel: nodeLabel(node), direction: dir, name, value });
  }

  /** Copia los atributos heredados al hijo antes de visitarlo (flujo ↓). */
  private descend(child: ASTNode, parent: ASTNode, inh: Inh, rules: InhRules = {}) {
    const p = parent.kind;
    const c = child.kind;
    for (const key of Object.keys(inh) as (keyof Inh)[]) {
      const value = inh[key];
      if (value === undefined) continue;
      this.record(child, 'inherited', key, value, rules[key] ?? `${c}.${key} := ${p}.${key}`);
    }
  }

  private fail(node: ASTNode, err: Omit<SemanticError, 'nodeId' | 'line' | 'col'>) {
    this.errors.push({ ...err, nodeId: node.id, line: node.loc.line, col: node.loc.col });
    (this.decorations[node.id] ??= { inherited: [], synthesized: [], hasError: false }).hasError = true;
  }

  // ─── utilidades de tipos ──────────────────────────────────────────────
  private bits(type: string): number {
    return this.table.sizeOf(type) * 8;
  }

  private cell(label: string, type: string): MemoryCell {
    return { label, type, bits: this.bits(type) };
  }

  private repr(type: string): string {
    if (type === 'int') return 'un entero de 32 bits en complemento a dos (4 bytes)';
    if (type === 'float') return 'un real IEEE-754 binary32 (4 bytes: signo, exponente, mantisa)';
    if (type === 'String') return 'un puntero de 64 bits (8 bytes) a un objeto cadena en el heap';
    if (type === 'void') return 'la ausencia de valor (0 bits)';
    return `una referencia de 64 bits (8 bytes) a una instancia de ${type} en el heap`;
  }

  /** Compatibilidad de asignación τ_src ⊑ τ_dst (con ensanchamiento int → float). */
  private assignable(dst: string, src: string): boolean {
    if (dst === ERROR_TYPE || src === ERROR_TYPE) return true;
    return dst === src || (dst === 'float' && src === 'int');
  }

  /** Explicación de bajo nivel de por qué dos representaciones no se pueden copiar. */
  private mismatchDetail(dst: string, src: string): string {
    const dstNum = NUMERIC.has(dst);
    const srcNum = NUMERIC.has(src);
    if (src === 'void') {
      return 'Una función void no deja ningún valor en el registro de retorno (RAX/XMM0): no hay bits que copiar al destino.';
    }
    if (dstNum && !srcNum) {
      return `Copiar un puntero de 64 bits en una celda de ${this.bits(dst)} bits truncaría la dirección (se pierden los 32 bits altos) y el patrón restante se interpretaría como ${dst === 'int' ? 'un número entero' : 'un float'}. No existe instrucción de conversión (no hay coerción ${src} → ${dst}), así que el generador de código no puede emitir un MOV válido.`;
    }
    if (!dstNum && srcNum) {
      return `El destino espera una dirección de memoria. Guardar allí ${this.bits(src)} bits numéricos haría que el runtime desreferenciara ese número como si fuera un puntero: acceso a una dirección arbitraria (segmentation fault).`;
    }
    if (dst === 'int' && src === 'float') {
      return 'Pasar de IEEE-754 a entero exige la instrucción CVTTSS2SI y descarta la parte fraccionaria: es una conversión con pérdida (estrechamiento) que el lenguaje no aplica de forma implícita. Además, los floats viven en registros XMM y los enteros en registros de propósito general.';
    }
    return `Ambos valores son punteros de 64 bits, pero apuntan a layouts de memoria distintos: los offsets de los campos de ${src} no tienen sentido dentro de ${dst}, así que cualquier acceso posterior leería bytes equivocados.`;
  }

  // ─── sentencias ───────────────────────────────────────────────────────
  private visitStmt(node: StmtNode, inh: Inh): void {
    switch (node.kind) {
      case 'ClassDecl':
        return this.visitClass(node);
      case 'FuncDecl':
        return this.visitFunc(node, inh);
      case 'VarDecl':
        return this.visitVarDecl(node, inh);
      case 'Assignment':
        return this.visitAssignment(node, inh);
      case 'Call': {
        const t = this.visitCall(node, inh);
        this.record(node, 'synthesized', 'ok', String(t !== ERROR_TYPE), 'CallStmt.ok := tipo ≠ ⊥');
        return;
      }
      case 'Return': {
        const expected = inh.tipoRetorno ?? 'void';
        let t = 'void';
        if (node.value) {
          this.descend(node.value, node, { ...inh, tipoEsperado: expected, rol: 'r-value' }, { tipoEsperado: 'valor.tipoEsperado := Return.tipoRetorno' });
          t = this.visitExpr(node.value, { ...inh, tipoEsperado: expected, rol: 'r-value' });
        }
        const ok = this.assignable(expected, t);
        if (!ok) {
          this.fail(node, {
            code: 'RETURN_TYPE',
            title: 'Tipo de retorno incompatible',
            ruleName: 'T-Return',
            rule: 'T(expr) == T_ret(f)',
            ruleInstance: `T(expr) = ${t}  ≠  ${expected} = T_ret`,
            identifier: 'return',
            message: `La función declara retornar ${expected} pero la expresión es de tipo ${t}.`,
            lowLevel: `El llamador leerá el resultado en ${expected === 'float' ? 'XMM0' : 'RAX/EAX'} esperando ${this.repr(expected)}, pero el callee dejaría ${this.repr(t)}. ${this.mismatchDetail(expected, t)}`,
            memory: { expected: this.cell('retorno', expected), actual: this.cell('expr', t) },
          });
        }
        this.record(node, 'synthesized', 'ok', String(ok), 'Return.ok := T(valor) ⊑ Return.tipoRetorno');
        return;
      }
    }
  }

  private checkTypeExists(node: ASTNode, type: string, owner: string): boolean {
    if (this.table.isType(type)) return true;
    this.fail(node, {
      code: 'UNKNOWN_TYPE',
      title: 'Tipo no declarado',
      ruleName: 'T-Type',
      rule: 'T ∈ Tipos(Γ)',
      ruleInstance: `${type} ∉ {int, float, String, void${[...this.table.classes.keys()].map((c) => ', ' + c).join('')}}`,
      identifier: type,
      message: `El tipo '${type}' usado en '${owner}' no es primitivo ni una clase declarada previamente.`,
      lowLevel: `Sin conocer el tipo, el compilador no sabe cuántos bytes reservar para '${owner}' ni cómo alinearlo: no puede asignarle un offset en memoria.`,
    });
    return false;
  }

  private redeclared(node: ASTNode, name: string, existing: SymbolEntry) {
    this.fail(node, {
      code: 'REDECLARATION',
      title: 'Identificador redeclarado',
      ruleName: 'T-Unique',
      rule: 'id ∉ dom(Γ_actual)',
      ruleInstance: `${name} ∈ dom(Γ_${existing.scopeName}) (línea ${existing.line})`,
      identifier: name,
      message: `'${name}' ya fue declarado como ${existing.kind} de tipo ${existing.type} en este mismo ámbito.`,
      lowLevel: `El nombre '${name}' ya está ligado a ${existing.offset !== null ? `la dirección ${existing.base}+${existing.offset}` : 'otra entidad'}. Una segunda ligadura en el mismo ámbito haría ambigua cada referencia: el compilador no sabría a qué dirección traducir '${name}'.`,
    });
  }

  private visitClass(node: ClassDeclNode) {
    const decl = this.table.declare({ name: node.name, kind: 'clase', type: 'class', initialized: true, line: node.loc.line, storage: false });
    if (!decl.ok) {
      this.redeclared(node, node.name, decl.existing);
      this.record(node, 'synthesized', 'ok', 'false', 'ClassDecl.ok := nombre ∉ dom(Γ)');
      return;
    }
    // Se registra antes de los campos para permitir referencias a sí misma.
    const info = { name: node.name, fields: [] as FieldLayout[], size: 0 };
    this.table.classes.set(node.name, info);

    const scope = this.table.enterScope(`Clase ${node.name}`, 'Clase');
    const childInh: Inh = { entorno: scope.name };
    for (const field of node.fields) {
      this.descend(field, node, childInh, { entorno: `campo.entorno := nuevoÁmbito(${node.name})` });
      if (!this.checkTypeExists(field, field.typeName, field.name)) continue;
      const res = this.table.declare({ name: field.name, kind: 'campo', type: field.typeName, initialized: true, line: field.loc.line, storage: true });
      if (!res.ok) {
        this.redeclared(field, field.name, res.existing);
        continue;
      }
      info.fields.push({ name: field.name, type: field.typeName, offset: res.entry.offset!, size: res.entry.size });
      this.record(field, 'synthesized', 'tipo', field.typeName, 'FieldDecl.tipo := Tipo.lexema');
      this.record(field, 'synthesized', 'offset', `+${res.entry.offset}`, 'FieldDecl.offset := alinear(ClassDecl.tamaño, tamaño(tipo))');
    }
    info.size = scope.nextOffset;
    this.table.exitScope();
    const entry = this.table.history.find((s) => s.kind === 'clase' && s.name === node.name);
    if (entry) entry.size = info.size;

    this.record(node, 'synthesized', 'tipo', node.name, 'ClassDecl.tipo := nuevoTipo(ID)');
    this.record(node, 'synthesized', 'tamaño', `${info.size} B`, 'ClassDecl.tamaño := Σ tamaño(campoᵢ) + relleno');
  }

  private visitFunc(node: FuncDeclNode, inh: Inh) {
    this.checkTypeExists(node, node.returnType, node.name);
    const params = node.params.map((p) => ({ name: p.name, type: p.typeName }));
    const decl = this.table.declare({
      name: node.name,
      kind: 'función',
      type: `(${params.map((p) => p.type).join(', ')}) → ${node.returnType}`,
      initialized: node.body !== null,
      line: node.loc.line,
      storage: false,
      signature: { params, returnType: node.returnType },
    });
    if (!decl.ok) this.redeclared(node, node.name, decl.existing);

    const local = node.body !== null ? this.table.enterScope(`Local (${node.name})`, 'Local') : null;
    const childInh: Inh = { entorno: local?.name ?? inh.entorno, tipoRetorno: node.returnType };
    const rules: InhRules = {
      entorno: local ? `hijo.entorno := nuevoÁmbito(${node.name})` : undefined,
      tipoRetorno: 'hijo.tipoRetorno := FuncDecl.tipoRetorno',
    };

    for (const p of node.params) {
      this.descend(p, node, childInh, rules);
      const exists = this.checkTypeExists(p, p.typeName, p.name);
      if (local && exists) {
        const res = this.table.declare({ name: p.name, kind: 'parámetro', type: p.typeName, initialized: true, line: p.loc.line, storage: true });
        if (!res.ok) this.redeclared(p, p.name, res.existing);
      }
      this.record(p, 'synthesized', 'tipo', p.typeName, 'Param.tipo := Tipo.lexema');
    }

    for (const stmt of node.body ?? []) {
      this.descend(stmt, node, childInh, rules);
      this.visitStmt(stmt, childInh);
    }
    if (local) {
      this.table.exitScope();
      this.record(node, 'synthesized', 'marco', `${local.nextOffset} B`, 'FuncDecl.marco := Σ tamaño(locales ∪ params)');
    }
    this.record(node, 'synthesized', 'tipo', decl.ok ? decl.entry.type : ERROR_TYPE, 'FuncDecl.tipo := (T(param₁)…T(paramₙ)) → T_ret');
  }

  private visitVarDecl(node: VarDeclNode, inh: Inh) {
    let ok = this.checkTypeExists(node, node.typeName, node.name);
    if (ok && node.typeName === 'void') {
      ok = false;
      this.fail(node, {
        code: 'VOID_VARIABLE',
        title: 'Variable de tipo void',
        ruleName: 'T-Void',
        rule: 'T(id) ≠ void',
        ruleInstance: `T(${node.name}) = void`,
        identifier: node.name,
        message: `'${node.name}' no puede declararse void: void no tiene valores.`,
        lowLevel: 'sizeof(void) = 0: no existe celda de memoria que reservar ni valor que almacenar.',
      });
    }

    // El inicializador se analiza ANTES de insertar el símbolo: `int x = x;` es un uso no declarado.
    let initType: string | null = null;
    if (node.init) {
      const childInh: Inh = { ...inh, tipoEsperado: node.typeName, rol: 'r-value' };
      this.descend(node.init, node, childInh, { tipoEsperado: 'init.tipoEsperado := VarDecl.tipo', rol: "init.rol := 'r-value'" });
      initType = this.visitExpr(node.init, childInh);
    }

    const res = this.table.declare({ name: node.name, kind: 'variable', type: node.typeName, initialized: node.init !== null, line: node.loc.line, storage: ok });
    if (!res.ok) {
      this.redeclared(node, node.name, res.existing);
      ok = false;
    }

    if (ok && initType !== null && !this.assignable(node.typeName, initType)) {
      ok = false;
      if (res.ok) res.entry.initialized = false;
      const where = res.ok && res.entry.offset !== null ? ` en ${res.entry.base}+${res.entry.offset}` : '';
      this.fail(node, {
        code: 'TYPE_MISMATCH',
        title: 'Incompatibilidad de tipos en la inicialización',
        ruleName: 'T-Init',
        rule: 'T(expr) ⊑ T(id)   (T-Init)',
        ruleInstance: `T(${nodeLabel(node.init!)}) = ${initType}  ⋢  ${node.typeName} = T(${node.name})`,
        identifier: node.name,
        message: `No se puede inicializar '${node.name}' (${node.typeName}) con una expresión de tipo ${initType}. La sintaxis "Tipo ID = Expr ;" es correcta; el significado no.`,
        lowLevel: `'${node.name}' tiene reservada${where} una celda de ${this.bits(node.typeName)} bits para ${this.repr(node.typeName)}. La expresión sintetiza ${this.repr(initType)}. ${this.mismatchDetail(node.typeName, initType)}`,
        memory: { expected: this.cell(node.name, node.typeName), actual: this.cell(nodeLabel(node.init!), initType) },
      });
    }

    if (res.ok && res.entry.offset !== null) {
      this.record(node, 'synthesized', 'offset', `${res.entry.base}+${res.entry.offset}`, 'VarDecl.offset := alinear(Γ.siguienteOffset, tamaño(tipo))');
    }
    this.record(node, 'synthesized', 'ok', String(ok), 'VarDecl.ok := T(id) ∈ Tipos ∧ id ∉ Γ ∧ T(init) ⊑ T(id)');
  }

  private visitAssignment(node: AssignmentNode, inh: Inh) {
    const lInh: Inh = { entorno: inh.entorno, rol: 'l-value', tipoRetorno: inh.tipoRetorno };
    this.descend(node.target, node, lInh, { rol: "lvalue.rol := 'l-value'" });
    const targetType = this.visitExpr(node.target, lInh);

    const rInh: Inh = { entorno: inh.entorno, tipoEsperado: targetType, rol: 'r-value', tipoRetorno: inh.tipoRetorno };
    this.descend(node.value, node, rInh, {
      tipoEsperado: 'rvalue.tipoEsperado := lvalue.tipo   (hermano izquierdo → L-atribuida)',
      rol: "rvalue.rol := 'r-value'",
    });
    const valueType = this.visitExpr(node.value, rInh);

    let ok = targetType !== ERROR_TYPE && valueType !== ERROR_TYPE;
    const targetName = node.target.kind === 'Identifier' ? node.target.name : `${nodeLabel(node.target.object)}.${node.target.member}`;
    if (ok && !this.assignable(targetType, valueType)) {
      ok = false;
      this.fail(node, {
        code: 'TYPE_MISMATCH',
        title: 'Incompatibilidad de tipos en la asignación',
        ruleName: 'T-Assign',
        rule: 'T(expr) == T(id)',
        ruleInstance: `T(${nodeLabel(node.value)}) = ${valueType}  ≠  ${targetType} = T(${targetName})`,
        identifier: targetName,
        message: `No se puede asignar un valor ${valueType} a '${targetName}', que es ${targetType}.`,
        lowLevel: `'${targetName}' es ${this.repr(targetType)}; el valor es ${this.repr(valueType)}. ${this.mismatchDetail(targetType, valueType)}`,
        memory: { expected: this.cell(targetName, targetType), actual: this.cell(nodeLabel(node.value), valueType) },
      });
    }
    if (ok && node.target.kind === 'Identifier') {
      const sym = this.table.lookup(node.target.name);
      if (sym) sym.initialized = true;
    }
    this.record(node, 'synthesized', 'ok', String(ok), 'Assign.ok := lvalue.tipo ≠ ⊥ ∧ T(rvalue) ⊑ T(lvalue)');
  }

  // ─── expresiones (devuelven el atributo sintetizado `tipo`) ──────────
  private synthType(node: ExprNode, type: string, rule: string): string {
    this.record(node, 'synthesized', 'tipo', type, rule);
    if (type !== ERROR_TYPE && type !== 'void') {
      this.record(node, 'synthesized', 'ancho', `${this.bits(type)} bits`, `${node.kind}.ancho := 8 · sizeof(${node.kind}.tipo)`);
    }
    return type;
  }

  private visitExpr(node: ExprNode, inh: Inh): string {
    switch (node.kind) {
      case 'Literal':
        return this.synthType(node, node.litType, `Literal.tipo := tipoLéxico(${node.litType === 'int' ? 'INT_LITERAL' : node.litType === 'float' ? 'FLOAT_LITERAL' : 'STRING_LITERAL'})`);

      case 'Identifier': {
        const sym = this.table.lookup(node.name);
        if (!sym || sym.kind === 'clase' || sym.kind === 'función') {
          if (sym) {
            this.fail(node, {
              code: 'UNDECLARED',
              title: `'${node.name}' no es una variable`,
              ruleName: 'T-VarScope',
              rule: 'Γ(id) = variable : τ   (T-VarScope)',
              ruleInstance: `Γ(${node.name}) = ${sym.kind}`,
              identifier: node.name,
              message: `'${node.name}' es una ${sym.kind}, no una variable: no puede usarse como valor.`,
              lowLevel: `Una ${sym.kind} no ocupa una celda en el segmento de datos: no hay dirección de la que leer ni en la que escribir.`,
            });
          } else {
            const chain = this.table.scopeChain().join(' → ');
            this.fail(node, {
              code: 'UNDECLARED',
              title: 'Variable no declarada',
              ruleName: 'T-VarScope',
              rule: 'lookup(id) ≠ ⊥   (id ∈ dom(Γ))   (T-VarScope)',
              ruleInstance: `lookup(${node.name}) = ⊥   en la cadena de ámbitos [${chain}]`,
              identifier: node.name,
              message: `'${node.name}' se usa como ${inh.rol ?? 'r-value'} pero no existe en ningún ámbito visible. El parser aceptó la sentencia porque "ID = Expr ;" es sintácticamente válido.`,
              lowLevel: `'${node.name}' no tiene entrada en la Tabla de Símbolos ⇒ no tiene dirección asignada (ni offset en .data ni en el marco de pila) ni tamaño conocido. Para traducir la sentencia, el generador de código necesita emitir algo como MOV DWORD [base+offset], valor; sin offset no existe operando de memoria posible, y sin tipo no sabe si mover 4 u 8 bytes.`,
            });
          }
          return this.synthType(node, ERROR_TYPE, `Identifier.tipo := ⊥   (lookup(${node.name}) falla)`);
        }
        if (inh.rol !== 'l-value' && !sym.initialized) {
          this.fail(node, {
            code: 'UNINITIALIZED',
            title: 'Uso de variable no inicializada',
            ruleName: 'T-Init',
            rule: 'init(id) = true  para todo uso como r-value',
            ruleInstance: `init(${node.name}) = false`,
            identifier: node.name,
            message: `'${node.name}' está declarada pero se lee antes de recibir un valor.`,
            lowLevel: `'${node.name}' tiene dirección ${sym.base}+${sym.offset}, pero esa celda nunca fue escrita: leerla devuelve los bits residuales que hubiera en memoria (basura), un comportamiento no determinista.`,
          });
        }
        this.record(node, 'synthesized', 'lvalue', String(inh.rol === 'l-value'), "Identifier.lvalue := (rol = 'l-value')");
        if (sym.offset !== null) {
          this.record(node, 'synthesized', 'dirección', `${sym.base}+${sym.offset}`, `Identifier.dirección := Γ(${node.name}).offset`);
        }
        return this.synthType(node, sym.type, `Identifier.tipo := Γ(${node.name}).tipo`);
      }

      case 'Binary': {
        const childInh: Inh = { entorno: inh.entorno, rol: 'r-value', tipoRetorno: inh.tipoRetorno };
        this.descend(node.left, node, childInh);
        const l = this.visitExpr(node.left, childInh);
        this.descend(node.right, node, childInh);
        const r = this.visitExpr(node.right, childInh);
        if (l === ERROR_TYPE || r === ERROR_TYPE) return this.synthType(node, ERROR_TYPE, 'Binary.tipo := ⊥   (operando con error)');
        if (NUMERIC.has(l) && NUMERIC.has(r)) {
          const t = l === 'float' || r === 'float' ? 'float' : 'int';
          return this.synthType(node, t, `Binary.tipo := max(T(izq), T(der)) = max(${l}, ${r})`);
        }
        if (node.op === '+' && (l === 'String' || r === 'String')) {
          return this.synthType(node, 'String', 'Binary.tipo := String   (concatenación)');
        }
        this.fail(node, {
          code: 'BAD_OPERANDS',
          title: 'Operandos incompatibles',
          ruleName: 'T-Arith',
          rule: 'T(e₁) ⊕ T(e₂) está definido',
          ruleInstance: `${l} ${node.op} ${r}  no está definido`,
          identifier: node.op,
          message: `El operador '${node.op}' no está definido entre ${l} y ${r}.`,
          lowLevel: `La ALU opera sobre registros numéricos (ADD/IMUL para int, ADDSS/MULSS para float). ${this.repr(l === 'int' || l === 'float' ? r : l)} no es un número: operar aritméticamente con una dirección de memoria no produce un resultado con significado.`,
        });
        return this.synthType(node, ERROR_TYPE, 'Binary.tipo := ⊥');
      }

      case 'New': {
        if (!this.table.classes.has(node.className)) {
          this.checkTypeExists(node, node.className, `new ${node.className}()`);
          return this.synthType(node, ERROR_TYPE, 'New.tipo := ⊥');
        }
        const size = this.table.classes.get(node.className)!.size;
        this.record(node, 'synthesized', 'heap', `${size} B`, `New.heap := ClassDecl(${node.className}).tamaño`);
        return this.synthType(node, node.className, `New.tipo := ${node.className}`);
      }

      case 'Call':
        return this.visitCall(node, inh);

      case 'MemberAccess':
        return this.visitMember(node, inh);
    }
  }

  private visitCall(node: CallNode, inh: Inh): string {
    const sym = this.table.lookup(node.callee);
    const argInh = (expected?: string): Inh => ({ entorno: inh.entorno, tipoEsperado: expected, rol: 'r-value', tipoRetorno: inh.tipoRetorno });

    if (!sym || !sym.signature) {
      node.args.forEach((a) => {
        this.descend(a, node, argInh());
        this.visitExpr(a, argInh());
      });
      this.fail(node, {
        code: sym ? 'NOT_A_FUNCTION' : 'UNDECLARED',
        title: sym ? `'${node.callee}' no es una función` : 'Función no declarada',
        ruleName: 'T-App',
        rule: 'Γ(f) = (τ₁ … τₙ) → τ',
        ruleInstance: sym ? `Γ(${node.callee}) = ${sym.type}` : `lookup(${node.callee}) = ⊥`,
        identifier: node.callee,
        message: sym ? `'${node.callee}' es de tipo ${sym.type} y no puede invocarse.` : `No existe ninguna función '${node.callee}' visible en este punto.`,
        lowLevel: `Una llamada se traduce a CALL <dirección>. Sin una función registrada no hay etiqueta ni dirección en el segmento de código a la que saltar, ni una firma que indique cuántos registros de argumentos preparar.`,
      });
      return this.synthType(node, ERROR_TYPE, 'Call.tipo := ⊥');
    }

    const { params, returnType } = sym.signature;
    let ok = true;
    let intIdx = 0;
    let floatIdx = 0;
    node.args.forEach((arg, i) => {
      const param = params[i];
      const ai = argInh(param?.type);
      this.descend(arg, node, ai, { tipoEsperado: `arg${i + 1}.tipoEsperado := Γ(${node.callee}).param${i + 1}.tipo` });
      const t = this.visitExpr(arg, ai);
      if (!param) return;
      const reg = param.type === 'float' ? `XMM${floatIdx++}` : (INT_REGS[intIdx++] ?? ['pila', 'pila'])[this.bits(param.type) === 32 ? 1 : 0];
      if (!this.assignable(param.type, t)) {
        ok = false;
        this.fail(arg, {
          code: 'ARG_TYPE',
          title: 'Argumento de tipo incorrecto',
          ruleName: 'T-App',
          rule: '∀i: T(argᵢ) == T(paramᵢ)',
          ruleInstance: `T(arg${i + 1}) = T(${nodeLabel(arg)}) = ${t}  ≠  ${param.type} = T(${param.name})`,
          identifier: `${node.callee} → ${param.name}`,
          message: `El argumento ${i + 1} de '${node.callee}' debe ser ${param.type} (parámetro '${param.name}'), pero se pasó ${t}.`,
          lowLevel: `Por la convención de llamada System V AMD64, el parámetro '${param.name}' viaja en el registro ${reg} esperando ${this.repr(param.type)}. El argumento ${nodeLabel(arg)} es ${this.repr(t)}. ${this.mismatchDetail(param.type, t)}`,
          memory: { expected: this.cell(`${param.name} (${reg})`, param.type), actual: this.cell(nodeLabel(arg), t) },
        });
      }
    });

    if (node.args.length !== params.length) {
      ok = false;
      this.fail(node, {
        code: 'ARG_COUNT',
        title: 'Número de argumentos incorrecto',
        ruleName: 'T-App',
        rule: '|args| == |params|',
        ruleInstance: `|args| = ${node.args.length}  ≠  ${params.length} = |params(${node.callee})|`,
        identifier: node.callee,
        message: `'${node.callee}' espera ${params.length} argumento(s) y recibió ${node.args.length}.`,
        lowLevel: `El callee leerá ${params.length} registro(s) de argumentos. ${node.args.length < params.length ? 'Los que el llamador no cargó contienen valores residuales de operaciones anteriores.' : 'Los argumentos sobrantes se cargarán en registros que el callee nunca lee.'}`,
      });
    }

    this.record(node, 'synthesized', 'firmaOk', String(ok), 'Call.firmaOk := |args|=|params| ∧ ∀i T(argᵢ) ⊑ T(paramᵢ)');
    return this.synthType(node, ok ? returnType : ERROR_TYPE, ok ? `Call.tipo := T_ret(${node.callee}) = ${returnType}` : 'Call.tipo := ⊥');
  }

  private visitMember(node: MemberAccessNode, inh: Inh): string {
    const objInh: Inh = { entorno: inh.entorno, rol: 'r-value', tipoRetorno: inh.tipoRetorno };
    this.descend(node.object, node, objInh, { rol: "objeto.rol := 'r-value'   (se lee el puntero)" });
    const objType = this.visitExpr(node.object, objInh);
    if (objType === ERROR_TYPE) return this.synthType(node, ERROR_TYPE, 'MemberAccess.tipo := ⊥');

    const cls = this.table.classes.get(objType);
    const objName = nodeLabel(node.object);
    if (!cls) {
      this.fail(node, {
        code: 'NOT_AN_OBJECT',
        title: 'Acceso a miembro sobre un valor que no es objeto',
        ruleName: 'T-FieldLookup',
        rule: 'T(obj) ∈ Clases(Γ)   (T-FieldLookup)',
        ruleInstance: `T(${objName}) = ${objType} ∉ Clases`,
        identifier: `${objName}.${node.member}`,
        message: `'${objName}' es de tipo ${objType}, que no tiene campos.`,
        lowLevel: `${objName} es ${this.repr(objType)}; no existe un layout de campos del cual obtener un offset.`,
      });
      return this.synthType(node, ERROR_TYPE, 'MemberAccess.tipo := ⊥');
    }

    const field = cls.fields.find((f) => f.name === node.member);
    if (!field) {
      const layout = cls.fields.map((f) => `${f.name} @ +${f.offset} (${f.size} B)`).join(', ') || 'sin campos';
      this.fail(node, {
        code: 'UNKNOWN_MEMBER',
        title: 'Miembro inexistente',
        ruleName: 'T-FieldLookup',
        rule: 'm ∈ campos(T(obj))   (T-FieldLookup)',
        ruleInstance: `${node.member} ∉ campos(${cls.name}) = {${cls.fields.map((f) => f.name).join(', ')}}`,
        identifier: `${objName}.${node.member}`,
        message: `La clase ${cls.name} no define ningún campo '${node.member}'.`,
        lowLevel: `El layout de ${cls.name} ocupa ${cls.size} bytes: {${layout}}. Traducir ${objName}.${node.member} exige calcular la dirección [${objName} + offset(${node.member})], pero '${node.member}' no tiene offset. Cualquier desplazamiento que se eligiera caería fuera del objeto (≥ ${cls.size} B) y escribiría sobre memoria ajena del heap: corrupción de memoria.`,
      });
      return this.synthType(node, ERROR_TYPE, `MemberAccess.tipo := ⊥   (${node.member} ∉ campos(${cls.name}))`);
    }

    this.record(node, 'synthesized', 'offset', `+${field.offset}`, `MemberAccess.offset := layout(${cls.name}).${field.name}`);
    return this.synthType(node, field.type, `MemberAccess.tipo := campos(${cls.name}).${field.name}.tipo`);
  }
}

export function analyze(program: ProgramNode): SemanticResult {
  return new SemanticAnalyzer().analyze(program);
}

