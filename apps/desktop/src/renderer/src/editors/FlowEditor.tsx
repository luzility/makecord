import { type Flow, TRIGGER_NODE_TYPE } from "@makecord/spec";
import {
  applyNodeChanges,
  Background,
  BackgroundVariant,
  type Connection,
  Controls,
  type Edge,
  type EdgeChange,
  type NodeChange,
  ReactFlow,
  ReactFlowProvider,
  useNodesInitialized,
  useReactFlow,
} from "@xyflow/react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { type MessageKey, useT } from "@/i18n";
import { defaultData, descriptorOf, type NodeDescriptor, nodeText, useNodes } from "@/lib/nodes";
import { problemText } from "@/lib/problems";
import { useStore } from "@/lib/store";
import { FlowNode, type MkNode } from "./FlowNode";
import { DRAG_MIME, Palette } from "./Palette";
import { TextEditor } from "./TextEditor";

const nodeTypes = { mk: FlowNode };

const NODE_W = 220;
const NODE_H = 90;

function freeSpot(flow: Flow, p: { x: number; y: number }) {
  const pos = { ...p };
  const hits = () =>
    flow.nodes.some(
      (n) =>
        Math.abs(n.position.x - pos.x) < NODE_W + 20 &&
        Math.abs(n.position.y - pos.y) < NODE_H + 20,
    );
  for (let i = 0; i < 50 && hits(); i++) pos.y += NODE_H + 30;
  return pos;
}

let idCounter = 0;
const newId = (prefix: string) =>
  `${prefix}-${Date.now().toString(36)}${(idCounter++).toString(36)}`;

const LIVE_MS = 1600;

function Canvas({ path, flow }: { path: string; flow: Flow }) {
  const updateFlow = useStore((s) => s.updateFlow);
  const select = useStore((s) => s.select);
  const selection = useStore((s) => s.selection);
  const problems = useStore((s) => s.problems);
  const executed = useStore((s) => s.executed);
  const { t, locale } = useT();
  const catalog = useNodes();
  const snapToGrid = useStore((s) => s.settings.snapToGrid);
  const { screenToFlowPosition, fitView } = useReactFlow();
  const wrapper = useRef<HTMLDivElement>(null);

  const nodesReady = useNodesInitialized();
  const [hasSize, setHasSize] = useState(false);
  const fitted = useRef(false);
  useEffect(() => {
    const el = wrapper.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => {
      const box = entry?.contentRect;
      setHasSize(!!box && box.width > 0 && box.height > 0);
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  useEffect(() => {
    if (fitted.current || !hasSize || !nodesReady) return;
    fitted.current = true;
    void fitView({ maxZoom: 1.1, padding: 0.3 });
  }, [hasSize, nodesReady, fitView]);

  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    setNow(Date.now());
    const id = setTimeout(() => setNow(Date.now()), LIVE_MS + 50);
    return () => clearTimeout(id);
  }, [executed]);
  const liveAt = useCallback(
    (id: string) => {
      const at = executed[`${path}#${id}`];
      return at !== undefined && now - at < LIVE_MS ? at : undefined;
    },
    [executed, now, path],
  );

  const derived = useMemo<MkNode[]>(() => {
    const label =
      flow.kind === "command" ? `/${flow.command.name}` : t(`events.${flow.event}` as MessageKey);
    return flow.nodes.map((n) => {
      const problem = problems.find((p) => p.file === path && p.nodeId === n.id);
      const meta = descriptorOf(n.type);
      const text = meta && nodeText(meta, locale);
      return {
        id: n.id,
        type: "mk",
        position: n.position,
        deletable: n.type !== TRIGGER_NODE_TYPE,
        selected: selection?.path === path && selection.nodeId === n.id,
        data: {
          meta,
          nodeType: n.type,
          data: n.data,
          title: text?.title ?? n.type,
          hint: text ? text.description : t("flow.unknownNode"),
          outputs: (meta?.outputs ?? ["next"]).map((port) => ({
            port,
            label: text?.output(port) ?? port,
          })),
          triggerLabel: label,
          problem: problem && { severity: problem.severity, message: problemText(problem, locale) },
          live: liveAt(n.id) !== undefined,
        },
      };
    });
  }, [flow, problems, selection, path, liveAt, locale, t, catalog]);

  const [nodes, setNodes] = useState(derived);
  useEffect(() => {
    setNodes((prev) => {
      const byId = new Map(prev.map((n) => [n.id, n]));
      return derived.map((d) => {
        const p = byId.get(d.id);
        if (!p) return d;
        return {
          ...d,
          position: p.dragging ? p.position : d.position,
          dragging: p.dragging,
          measured: p.measured,
        };
      });
    });
  }, [derived]);

  const [selectedEdges, setSelectedEdges] = useState<ReadonlySet<string>>(new Set());

  const edges = useMemo<Edge[]>(
    () =>
      flow.edges.map((e) => {
        const from = liveAt(e.source);
        const to = liveAt(e.target);
        const live = from !== undefined && to !== undefined && to >= from;
        return {
          id: e.id,
          source: e.source,
          target: e.target,
          sourceHandle: e.sourceHandle,
          selected: selectedEdges.has(e.id),
          animated: live,
          className: live ? "mk-live" : undefined,
        };
      }),
    [flow.edges, liveAt, selectedEdges],
  );

  const onNodesChange = useCallback(
    (changes: NodeChange<MkNode>[]) => {
      setNodes((ns) => applyNodeChanges(changes, ns));
      const moved = changes.filter((c) => c.type === "position" && !c.dragging && c.position);
      const removed = new Set(changes.filter((c) => c.type === "remove").map((c) => c.id));
      if (moved.length || removed.size) {
        updateFlow(path, (f) => ({
          ...f,
          nodes: f.nodes
            .filter((n) => !removed.has(n.id))
            .map((n) => {
              const c = moved.find((m) => m.type === "position" && m.id === n.id);
              return c && c.type === "position" && c.position
                ? { ...n, position: { x: Math.round(c.position.x), y: Math.round(c.position.y) } }
                : n;
            }),
          edges: f.edges.filter((e) => !removed.has(e.source) && !removed.has(e.target)),
        }));
        if (selection && removed.has(selection.nodeId)) select(null);
      }
    },
    [path, updateFlow, select, selection],
  );

  const onEdgesChange = useCallback(
    (changes: EdgeChange[]) => {
      const removed = new Set(changes.filter((c) => c.type === "remove").map((c) => c.id));
      setSelectedEdges((prev) => {
        const next = new Set(prev);
        for (const c of changes) {
          if (c.type === "select") {
            if (c.selected) next.add(c.id);
            else next.delete(c.id);
          }
        }
        for (const id of removed) next.delete(id);
        return next;
      });
      if (removed.size) {
        updateFlow(path, (f) => ({ ...f, edges: f.edges.filter((e) => !removed.has(e.id)) }));
      }
    },
    [path, updateFlow],
  );

  const isValidConnection = useCallback((c: Connection | Edge) => c.source !== c.target, []);

  const onConnect = useCallback(
    (c: Connection) => {
      const handle = c.sourceHandle ?? "next";
      updateFlow(path, (f) => ({
        ...f,
        edges: [
          ...f.edges.filter((e) => !(e.source === c.source && e.sourceHandle === handle)),
          { id: newId("e"), source: c.source, sourceHandle: handle, target: c.target },
        ],
      }));
    },
    [path, updateFlow],
  );

  const addNode = useCallback(
    (meta: NodeDescriptor, position: { x: number; y: number }) => {
      const id = newId(meta.type.split(".").pop() ?? "node");
      updateFlow(path, (f) => ({
        ...f,
        nodes: [...f.nodes, { id, type: meta.type, position, data: defaultData(meta) }],
      }));
      select({ path, nodeId: id });
    },
    [path, updateFlow, select],
  );

  const addAtCenter = (meta: NodeDescriptor) => {
    const r = wrapper.current?.getBoundingClientRect();
    const p = r
      ? screenToFlowPosition({ x: r.left + r.width / 2, y: r.top + r.height / 2 })
      : { x: 0, y: 0 };
    addNode(meta, freeSpot(flow, { x: Math.round(p.x - NODE_W / 2), y: Math.round(p.y - 30) }));
  };

  return (
    <div className="flex h-full">
      <Palette flow={flow} onAdd={addAtCenter} />
      <div
        ref={wrapper}
        className="relative flex-1"
        onDragOver={(e) => {
          if (e.dataTransfer.types.includes(DRAG_MIME)) {
            e.preventDefault();
            e.dataTransfer.dropEffect = "move";
          }
        }}
        onDrop={(e) => {
          const meta = descriptorOf(e.dataTransfer.getData(DRAG_MIME));
          if (!meta) return;
          e.preventDefault();
          const p = screenToFlowPosition({ x: e.clientX, y: e.clientY });
          addNode(meta, { x: Math.round(p.x - 110), y: Math.round(p.y - 20) });
        }}
      >
        <ReactFlow<MkNode>
          nodes={nodes}
          edges={edges}
          nodeTypes={nodeTypes}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onConnect={onConnect}
          isValidConnection={isValidConnection}
          snapToGrid={snapToGrid}
          snapGrid={[20, 20]}
          onNodeClick={(_, n) => select({ path, nodeId: n.id })}
          onPaneClick={() => select(null)}
          deleteKeyCode={["Delete", "Backspace"]}
          proOptions={{ hideAttribution: true }}
          colorMode="dark"
          defaultEdgeOptions={{ type: "smoothstep" }}
          onlyRenderVisibleElements
        >
          <Background variant={BackgroundVariant.Dots} gap={20} size={1} color="#2a2a2e" />
          <Controls showInteractive={false} position="bottom-left" />
        </ReactFlow>
      </div>
    </div>
  );
}

export function FlowEditor({ path }: { path: string }) {
  const { t } = useT();
  const doc = useStore((s) => s.docs[path]);
  if (!doc) return null;
  if (!doc.flow) {
    return (
      <div className="flex h-full flex-col">
        <div className="shrink-0 border-b border-line px-4 py-3">
          <p className="text-body font-medium text-bad">{t("flow.unreadable")}</p>
          <p className="font-mono text-label text-muted">{doc.parseError}</p>
          <p className="mt-1 text-label text-faint">{t("editor.fixBelow")}</p>
        </div>
        <div className="min-h-0 flex-1">
          <TextEditor path={path} />
        </div>
      </div>
    );
  }
  return (
    <ReactFlowProvider>
      <Canvas path={path} flow={doc.flow} />
    </ReactFlowProvider>
  );
}
