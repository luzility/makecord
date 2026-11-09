import {
  commandLabel,
  type Flow,
  type FlowEdge,
  FlowNode as FlowNodeSchema,
  FlowNote,
  TRIGGER_NODE_TYPE,
} from "@makecord/spec";
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
import { type MouseEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { z } from "zod";
import { ContextMenu, type MenuEntry } from "@/components/Menu";
import { type MessageKey, useT } from "@/i18n";
import { defaultData, descriptorOf, type NodeDescriptor, nodeText, useNodes } from "@/lib/nodes";
import { problemText } from "@/lib/problems";
import { isEditableTarget, keysOf, matches } from "@/lib/shortcuts";
import { useStore } from "@/lib/store";
import { FlowNode, type MkNode } from "./FlowNode";
import { NOTE_SIZE, type NoteNode, NoteView } from "./NoteNode";
import { DRAG_MIME, Palette } from "./Palette";
import { TextEditor } from "./TextEditor";

const nodeTypes = { mk: FlowNode, note: NoteView };

type CanvasNode = MkNode | NoteNode;

const CLIP_TYPE = "makecord/blocks";
const Clip = z.object({
  type: z.literal(CLIP_TYPE),
  nodes: z.array(FlowNodeSchema),
  notes: z.array(FlowNote).default([]),
  edges: z.array(z.object({ source: z.string(), sourceHandle: z.string(), target: z.string() })),
});
type Clip = z.infer<typeof Clip>;

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
  const breakpoints = useStore((s) => s.breakpoints[path]);
  const pausedRuns = useStore((s) => s.paused);
  const toggleBreakpoint = useStore((s) => s.toggleBreakpoint);
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

  const [selectedIds, setSelectedIds] = useState<ReadonlySet<string>>(
    () => new Set(selection?.path === path ? [selection.nodeId] : []),
  );
  useEffect(() => {
    if (selection?.path !== path) return;
    setSelectedIds((prev) => (prev.has(selection.nodeId) ? prev : new Set([selection.nodeId])));
  }, [selection, path]);
  useEffect(() => {
    if (selectedIds.size === 0 && useStore.getState().selection?.path === path) select(null);
  }, [selectedIds, path, select]);
  const [menu, setMenu] = useState<{ x: number; y: number; items: MenuEntry[] } | null>(null);
  const [freshNote, setFreshNote] = useState<string | null>(null);
  const closeMenu = useCallback(() => setMenu(null), []);

  const derived = useMemo<CanvasNode[]>(() => {
    const label =
      flow.kind === "command"
        ? commandLabel(flow.command)
        : t(`events.${flow.event}` as MessageKey);
    const blocks = flow.nodes.map((n): MkNode => {
      const problem = problems.find((p) => p.file === path && p.nodeId === n.id);
      const meta = descriptorOf(n.type);
      const text = meta && nodeText(meta, locale);
      return {
        id: n.id,
        type: "mk",
        position: n.position,
        deletable: n.type !== TRIGGER_NODE_TYPE,
        selected: selectedIds.has(n.id),
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
          breakpoint: breakpoints?.includes(n.id) ?? false,
          paused: pausedRuns.some((p) => p.flow === path && p.nodeId === n.id),
          breakpointLabel: t("debug.toggleBreakpoint"),
          pausedLabel: t("debug.paused"),
          onToggleBreakpoint: () => toggleBreakpoint(path, n.id),
        },
      };
    });
    const notes = (flow.notes ?? []).map(
      (n): NoteNode => ({
        id: n.id,
        type: "note",
        position: n.position,
        selected: selectedIds.has(n.id),
        zIndex: -1,
        style: { width: n.width ?? NOTE_SIZE.width, height: n.height ?? NOTE_SIZE.height },
        data: {
          text: n.text,
          placeholder: t("flow.notePlaceholder"),
          fresh: n.id === freshNote,
          onText: (text) =>
            updateFlow(
              path,
              (f) => ({ ...f, notes: f.notes?.map((x) => (x.id === n.id ? { ...x, text } : x)) }),
              `note:${n.id}`,
            ),
          onResize: ({ x, y, width, height }) =>
            updateFlow(path, (f) => ({
              ...f,
              notes: f.notes?.map((note) =>
                note.id === n.id ? { ...note, position: { x, y }, width, height } : note,
              ),
            })),
        },
      }),
    );
    return [...blocks, ...notes];
  }, [
    flow,
    problems,
    selectedIds,
    path,
    liveAt,
    locale,
    t,
    catalog,
    updateFlow,
    freshNote,
    breakpoints,
    pausedRuns,
    toggleBreakpoint,
  ]);

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
    (changes: NodeChange<CanvasNode>[]) => {
      setNodes((ns) => applyNodeChanges(changes, ns));
      const picks = changes.filter((c) => c.type === "select");
      if (picks.length) {
        setSelectedIds((prev) => {
          const next = new Set(prev);
          for (const c of picks) {
            if (c.type !== "select") continue;
            if (c.selected) next.add(c.id);
            else next.delete(c.id);
          }
          return next;
        });
      }
      const moved = changes.filter((c) => c.type === "position" && !c.dragging && c.position);
      const removed = new Set(changes.filter((c) => c.type === "remove").map((c) => c.id));
      if (moved.length || removed.size) {
        const place = <T extends { id: string; position: { x: number; y: number } }>(n: T): T => {
          const c = moved.find((m) => m.type === "position" && m.id === n.id);
          return c && c.type === "position" && c.position
            ? { ...n, position: { x: Math.round(c.position.x), y: Math.round(c.position.y) } }
            : n;
        };
        updateFlow(path, (f) => ({
          ...f,
          nodes: f.nodes.filter((n) => !removed.has(n.id)).map(place),
          notes: f.notes?.filter((n) => !removed.has(n.id)).map(place),
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

  const isTrigger = (id: string) =>
    flow.nodes.some((n) => n.id === id && n.type === TRIGGER_NODE_TYPE);
  const chosen = () => [...selectedIds].filter((id) => !isTrigger(id));

  const clipOf = (ids: string[]): Clip | null => {
    const set = new Set(ids);
    const nodes = flow.nodes.filter((n) => set.has(n.id));
    const notes = (flow.notes ?? []).filter((n) => set.has(n.id));
    if (!nodes.length && !notes.length) return null;
    const edges = flow.edges
      .filter((e) => set.has(e.source) && set.has(e.target))
      .map(({ source, sourceHandle, target }) => ({ source, sourceHandle, target }));
    return { type: CLIP_TYPE, nodes, notes, edges };
  };

  const insert = (clip: Clip, at?: { x: number; y: number }) => {
    const all = [...clip.nodes, ...clip.notes];
    const minX = Math.min(...all.map((n) => n.position.x));
    const minY = Math.min(...all.map((n) => n.position.y));
    const dx = at ? Math.round(at.x - minX) : 40;
    const dy = at ? Math.round(at.y - minY) : 40;
    const ids = new Map<string, string>();
    const shift = (p: { x: number; y: number }) => ({ x: p.x + dx, y: p.y + dy });
    const nodes = clip.nodes
      .filter((n) => n.type !== TRIGGER_NODE_TYPE)
      .map((n) => {
        const id = newId(n.type.split(".").pop() ?? "node");
        ids.set(n.id, id);
        return { ...n, id, position: shift(n.position) };
      });
    const notes = clip.notes.map((n) => {
      const id = newId("note");
      ids.set(n.id, id);
      return { ...n, id, position: shift(n.position) };
    });
    const edges: FlowEdge[] = clip.edges.flatMap((e) => {
      const source = ids.get(e.source);
      const target = ids.get(e.target);
      return source && target
        ? [{ id: newId("e"), source, sourceHandle: e.sourceHandle, target }]
        : [];
    });
    if (!ids.size) return;
    updateFlow(path, (f) => ({
      ...f,
      nodes: [...f.nodes, ...nodes],
      notes: notes.length ? [...(f.notes ?? []), ...notes] : f.notes,
      edges: [...f.edges, ...edges],
    }));
    setSelectedIds(new Set(ids.values()));
    if (nodes.length === 1 && !notes.length) select({ path, nodeId: nodes[0]!.id });
  };

  const copy = async (ids = chosen()) => {
    const clip = clipOf(ids);
    if (clip) await navigator.clipboard.writeText(JSON.stringify(clip));
    return clip;
  };

  const remove = (ids = chosen()) => {
    const set = new Set(ids);
    if (!set.size) return;
    updateFlow(path, (f) => ({
      ...f,
      nodes: f.nodes.filter((n) => !set.has(n.id)),
      notes: f.notes?.filter((n) => !set.has(n.id)),
      edges: f.edges.filter((e) => !set.has(e.source) && !set.has(e.target)),
    }));
    setSelectedIds(new Set());
  };

  const paste = async (at?: { x: number; y: number }) => {
    let parsed: Clip | undefined;
    try {
      const res = Clip.safeParse(JSON.parse(await navigator.clipboard.readText()));
      if (res.success) parsed = res.data;
    } catch {}
    if (parsed) insert(parsed, at);
  };

  const duplicate = (ids = chosen()) => {
    const clip = clipOf(ids);
    if (clip) insert(clip);
  };

  const addNote = (at: { x: number; y: number }) => {
    const id = newId("note");
    updateFlow(path, (f) => ({
      ...f,
      notes: [
        ...(f.notes ?? []),
        { id, position: { x: Math.round(at.x), y: Math.round(at.y) }, text: "" },
      ],
    }));
    setSelectedIds(new Set([id]));
    setFreshNote(id);
  };

  const selectAll = () =>
    setSelectedIds(
      new Set([...flow.nodes.map((n) => n.id), ...(flow.notes ?? []).map((n) => n.id)]),
    );

  const centre = () => {
    const r = wrapper.current?.getBoundingClientRect();
    return r
      ? screenToFlowPosition({ x: r.left + r.width / 2, y: r.top + r.height / 2 })
      : { x: 0, y: 0 };
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (isEditableTarget(e.target)) return;
    const ev = e.nativeEvent;
    if (matches("Mod+C", ev)) void copy();
    else if (matches("Mod+X", ev)) void copy().then((c) => c && remove());
    else if (matches("Mod+V", ev)) void paste();
    else if (matches("Mod+D", ev)) duplicate();
    else if (matches("Mod+A", ev)) selectAll();
    else return;
    e.preventDefault();
    e.stopPropagation();
  };

  const openMenu = (e: MouseEvent | globalThis.MouseEvent, targetIds: string[] | null) => {
    e.preventDefault();
    const at = screenToFlowPosition({ x: e.clientX, y: e.clientY });
    const k = (sc: string) => keysOf(sc);
    if (targetIds?.length) {
      const ids = targetIds.filter((id) => !isTrigger(id));
      setSelectedIds(new Set(targetIds));
      setMenu({
        x: e.clientX,
        y: e.clientY,
        items: [
          {
            kind: "item",
            label: t("flow.copy"),
            keys: k("Mod+C"),
            disabled: !ids.length,
            onSelect: () => void copy(ids),
          },
          {
            kind: "item",
            label: t("flow.cut"),
            keys: k("Mod+X"),
            disabled: !ids.length,
            onSelect: () => void copy(ids).then((c) => c && remove(ids)),
          },
          {
            kind: "item",
            label: t("flow.duplicate"),
            keys: k("Mod+D"),
            disabled: !ids.length,
            onSelect: () => duplicate(ids),
          },
          {
            kind: "item",
            label: t("debug.toggleBreakpoint"),
            keys: k("Mod+F8"),
            disabled: targetIds.length !== 1 || !!targetIds[0]?.startsWith("note-"),
            onSelect: () => targetIds[0] && toggleBreakpoint(path, targetIds[0]),
          },
          { kind: "separator" },
          {
            kind: "item",
            label: t("common.delete"),
            keys: ["Delete"],
            disabled: !ids.length,
            onSelect: () => remove(ids),
          },
        ],
      });
      return;
    }
    setMenu({
      x: e.clientX,
      y: e.clientY,
      items: [
        { kind: "item", label: t("flow.paste"), keys: k("Mod+V"), onSelect: () => void paste(at) },
        { kind: "item", label: t("flow.addNote"), onSelect: () => addNote(at) },
        { kind: "separator" },
        { kind: "item", label: t("flow.selectAll"), keys: k("Mod+A"), onSelect: selectAll },
      ],
    });
  };

  return (
    <div className="flex h-full">
      <Palette flow={flow} onAdd={addAtCenter} onAddNote={() => addNote(centre())} />
      <div
        ref={wrapper}
        tabIndex={-1}
        onKeyDown={onKeyDown}
        className="relative flex-1 outline-none"
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
        <ReactFlow<CanvasNode>
          nodes={nodes}
          edges={edges}
          nodeTypes={nodeTypes}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onConnect={onConnect}
          isValidConnection={isValidConnection}
          snapToGrid={snapToGrid}
          snapGrid={[20, 20]}
          onNodeClick={(e, n) => {
            if (n.type === "mk" && !(e.shiftKey || e.ctrlKey || e.metaKey))
              select({ path, nodeId: n.id });
          }}
          onNodeContextMenu={(e, n) =>
            openMenu(e, selectedIds.has(n.id) ? [...selectedIds] : [n.id])
          }
          onSelectionContextMenu={(e, ns) =>
            openMenu(
              e,
              ns.map((n) => n.id),
            )
          }
          onPaneContextMenu={(e) => openMenu(e, null)}
          multiSelectionKeyCode={["Shift", "Control", "Meta"]}
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
        {menu && <ContextMenu x={menu.x} y={menu.y} items={menu.items} onClose={closeMenu} />}
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
