import { Background, Controls, Handle, Position, ReactFlow, type Edge, type Node, type NodeProps } from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { AlertTriangle } from 'lucide-react';
import { memo, useMemo } from 'react';
import { childrenOf, nodeLabel, nodeTitle, type ASTNode, type ProgramNode } from '../compiler/ast';
import type { DecorationMap } from '../compiler/semantic';

const NODE_W = 176;
const GAP_X = 196;
const GAP_Y = 118;

const KIND_ACCENT: Record<ASTNode['kind'], string> = {
  Program: 'bg-indigo-400',
  ClassDecl: 'bg-fuchsia-400',
  FieldDecl: 'bg-fuchsia-300',
  FuncDecl: 'bg-teal-400',
  Param: 'bg-teal-300',
  VarDecl: 'bg-violet-400',
  Assignment: 'bg-rose-400',
  Return: 'bg-fuchsia-300',
  Call: 'bg-orange-400',
  MemberAccess: 'bg-yellow-400',
  Binary: 'bg-rose-300',
  New: 'bg-fuchsia-300',
  Identifier: 'bg-sky-400',
  Literal: 'bg-amber-400',
};

type AstNodeData = {
  kind: ASTNode['kind'];
  title: string;
  label: string;
  line: number;
  type?: string;
  hasError: boolean;
  selected: boolean;
  decorated: boolean;
};

type AstFlowNode = Node<AstNodeData, 'ast'>;

const AstNodeView = memo(function AstNodeView({ data }: NodeProps<AstFlowNode>) {
  const border = data.hasError
    ? 'border-rose-500 shadow-rose-500/30'
    : data.selected
      ? 'border-indigo-400 shadow-indigo-500/30'
      : 'border-slate-600 shadow-black/30';
  return (
    <div style={{ width: NODE_W }} className={`rounded-xl border-2 bg-slate-900 px-3 py-2 shadow-lg ${border} ${data.selected ? 'ring-2 ring-indigo-400/40' : ''}`}>
      <Handle type="target" position={Position.Top} className="!size-1.5 !border-0 !bg-slate-500" />
      <div className="flex items-center gap-1.5">
        <span className={`size-2 shrink-0 rounded-full ${KIND_ACCENT[data.kind]}`} />
        <span className="truncate text-[10px] font-semibold uppercase tracking-wider text-slate-400">{data.title}</span>
        <span className="ml-auto font-mono text-[10px] text-slate-500">L{data.line}</span>
      </div>
      <p className="mt-1 truncate font-mono text-[13px] text-slate-100" title={data.label}>
        {data.label}
      </p>
      {data.decorated && (
        <div className="mt-1.5 flex items-center gap-1.5">
          {data.type && (
            <span className={`rounded px-1.5 py-0.5 font-mono text-[11px] ${data.type === '⊥' ? 'bg-rose-500/20 text-rose-200' : 'bg-emerald-500/15 text-emerald-200'}`}>
              ↑ tipo: {data.type}
            </span>
          )}
          {data.hasError && <AlertTriangle className="ml-auto size-3.5 text-rose-400" />}
        </div>
      )}
      <Handle type="source" position={Position.Bottom} className="!size-1.5 !border-0 !bg-slate-500" />
    </div>
  );
});

const nodeTypes = { ast: AstNodeView };

/** Layout de árbol ordenado: las hojas ocupan columnas consecutivas y cada padre se centra sobre sus hijos. */
function layout(root: ProgramNode, deco: DecorationMap | null, selected: string | null) {
  const nodes: AstFlowNode[] = [];
  const edges: Edge[] = [];
  let nextLeaf = 0;

  const place = (node: ASTNode, depth: number): number => {
    const kids = childrenOf(node);
    let x: number;
    if (kids.length === 0) {
      x = nextLeaf++;
    } else {
      const xs = kids.map((k) => place(k.node, depth + 1));
      x = (xs[0] + xs[xs.length - 1]) / 2;
    }
    const d = deco?.[node.id];
    nodes.push({
      id: node.id,
      type: 'ast',
      position: { x: x * GAP_X, y: depth * GAP_Y },
      data: {
        kind: node.kind,
        title: nodeTitle(node),
        label: nodeLabel(node),
        line: node.loc.line,
        type: d?.synthesized.find((a) => a.name === 'tipo')?.value,
        hasError: d?.hasError ?? false,
        selected: node.id === selected,
        decorated: !!deco,
      },
    });
    for (const k of kids) {
      const bad = deco?.[k.node.id]?.hasError;
      edges.push({
        id: `${node.id}-${k.node.id}`,
        source: node.id,
        target: k.node.id,
        label: k.label,
        type: 'smoothstep',
        style: { stroke: bad ? '#fb7185' : '#64748b', strokeWidth: 1.5 },
        labelStyle: { fill: '#cbd5e1', fontSize: 10, fontFamily: 'Fira Code' },
        labelBgStyle: { fill: '#0f172a' },
        labelBgPadding: [4, 2],
        labelBgBorderRadius: 4,
      });
    }
    return x;
  };

  place(root, 0);
  return { nodes, edges };
}

export function AstGraph(props: {
  ast: ProgramNode;
  decorations: DecorationMap | null;
  selectedId: string | null;
  onSelect: (id: string) => void;
  version: number;
}) {
  const { nodes, edges } = useMemo(() => layout(props.ast, props.decorations, props.selectedId), [props.ast, props.decorations, props.selectedId]);

  return (
    <div className="h-[480px] overflow-hidden rounded-xl border border-slate-700 bg-slate-950/60">
      <ReactFlow
        key={props.version}
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        onNodeClick={(_, n) => props.onSelect(n.id)}
        nodesDraggable={false}
        nodesConnectable={false}
        colorMode="dark"
        fitView
        fitViewOptions={{ padding: 0.15, maxZoom: 1.1 }}
        minZoom={0.2}
        maxZoom={2}
      >
        <Background color="#334155" gap={22} />
        <Controls showInteractive={false} />
      </ReactFlow>
    </div>
  );
}
