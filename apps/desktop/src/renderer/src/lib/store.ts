import { isEmptyIssue } from "@makecord/runtime/inspect";
import { Flow, MESSAGE_FILE_SUFFIX, MessageDesign } from "@makecord/spec";
import { create } from "zustand";
import { initialLocale, type Locale, persistLocale } from "@/i18n/locale";
import {
  api,
  type Catalog,
  type FileNode,
  type Problem,
  type ProjectInfo,
  type RuntimeMessage,
  type RuntimeStatus,
  type Settings,
} from "./api";
import {
  type Area,
  DEFAULT_TOOLS,
  SIZE_LIMITS,
  type ToolId,
  type ToolLayout,
  toolInfo,
} from "./tools";

export interface Doc {
  text: string;
  savedText: string;
  flow?: Flow;
  message?: MessageDesign;
  parseError?: string;
  invalid?: { field: string; message: string; empty: boolean };
  missing?: boolean;
}

export interface Notice {
  key: "saveFailed" | "actionFailed";
  file?: string;
  detail: string;
}

export type LogEntry = RuntimeMessage & { id: number };

export type { Area, ToolId, ToolLayout } from "./tools";

export interface PausedRun {
  runId: string;
  flow: string;
  nodeId: string;
  vars: unknown;
  scope: unknown;
  time: number;
}

export interface GatewayEntry {
  id: number;
  time: number;
  event: string;
  summary: string;
  handled?: boolean;
}

const MAX_GATEWAY = 1000;
const BREAKPOINTS_FILE = ".makecord/breakpoints.json";

export type SettingsPage = "appearance" | "editor" | "run" | "keymap" | "project" | "plugins";

const MAX_LOGS = 5000;
const SAVE_DELAY = 300;

interface State {
  project: ProjectInfo | null;
  tree: FileNode | null;
  docs: Record<string, Doc>;
  selection: { path: string; nodeId: string } | null;
  problems: Problem[];
  status: RuntimeStatus | "idle";
  statusDetail?: string;
  statusCode?: string;
  online?: { tag: string; guilds: number };
  runBusy: boolean;
  notice: Notice | null;
  logs: LogEntry[];
  tools: ToolLayout;
  showTool(id: ToolId): void;
  toggleTool(id: ToolId): void;
  hideArea(area: Area): void;
  resizeArea(area: Area, size: number): void;
  gateway: GatewayEntry[];
  breakpoints: Record<string, string[]>;
  paused: PausedRun[];
  activeRun: string | null;
  toggleBreakpoint(path: string, nodeId: string): void;
  clearBreakpoints(): void;
  resumeRun(runId: string, mode: "continue" | "step" | "stop"): void;
  syncBreakpoints(): void;
  clearGateway(): void;
  executed: Record<string, number>;
  secretsOpen: boolean;
  inviteOpen: boolean;
  searchOpen: boolean;
  newFlowOpen: false | "command" | "event" | "message";
  newProjectOpen: boolean;
  activePath: string | null;
  locale: Locale;
  setLocale(locale: Locale): void;
  catalog: Catalog | null;
  refreshCatalog(): Promise<void>;
  settings: Settings;
  loadSettings(): Promise<void>;
  updateSettings(patch: Partial<Settings>): Promise<void>;
  settingsPage: SettingsPage | null;

  setProject(p: ProjectInfo | null): Promise<void>;
  refreshTree(): Promise<void>;
  refreshProblems(): Promise<void>;
  loadDoc(path: string): Promise<void>;
  dropDoc(path: string): void;
  setText(path: string, text: string): void;
  flushSaves(): Promise<void>;
  updateFlow(path: string, fn: (flow: Flow) => Flow, mergeKey?: string): void;
  updateMessage(
    path: string,
    fn: (message: MessageDesign) => MessageDesign,
    mergeKey?: string,
  ): void;
  undo(path: string): void;
  redo(path: string): void;
  canUndo(path: string): boolean;
  canRedo(path: string): boolean;
  onDiskChange(paths: string[]): Promise<void>;
  select(sel: State["selection"]): void;
  pushRuntime(msg: RuntimeMessage): void;
  clearLogs(): void;
  set(partial: Partial<State>): void;
}

const timers = new Map<string, ReturnType<typeof setTimeout>>();

type Model = Flow | MessageDesign;

interface History {
  past: Model[];
  future: Model[];
  mergeKey?: string;
  at: number;
}
const histories = new Map<string, History>();
const HISTORY_LIMIT = 100;
const MERGE_WINDOW = 600;
const historyOf = (path: string) => {
  let h = histories.get(path);
  if (!h) {
    h = { past: [], future: [], at: 0 };
    histories.set(path, h);
  }
  return h;
};
let logId = 0;

export const isFlowFile = (path: string) => path.endsWith(".flow.json");
export const isMessageFile = (path: string) => path.endsWith(MESSAGE_FILE_SUFFIX);
const isModelFile = (path: string) => isFlowFile(path) || isMessageFile(path);

function parse(path: string, text: string): Pick<Doc, "flow" | "message" | "parseError"> {
  if (!isModelFile(path)) return {};
  try {
    const json = JSON.parse(text);
    if (isMessageFile(path)) {
      const res = MessageDesign.safeParse(json);
      return res.success
        ? { message: res.data, flow: undefined, parseError: undefined }
        : { message: undefined, parseError: res.error.issues[0]?.message ?? "Invalid message" };
    }
    const res = Flow.safeParse(json);
    return res.success
      ? { flow: res.data, message: undefined, parseError: undefined }
      : { flow: undefined, parseError: res.error.issues[0]?.message ?? "Invalid flow" };
  } catch (e) {
    return { flow: undefined, message: undefined, parseError: (e as Error).message };
  }
}

const modelOf = (doc: Doc | undefined): Model | undefined => doc?.flow ?? doc?.message;

export const cleanError = (e: unknown) =>
  String((e as Error)?.message ?? e).replace(
    /^Error invoking remote method '[^']+': (Error: )?/,
    "",
  );

export const useStore = create<State>((set, get) => {
  const saveNow = async (path: string) => {
    timers.delete(path);
    const doc = get().docs[path];
    if (!doc || doc.text === doc.savedText) return;
    const text = doc.text;
    try {
      await api.fs.write(path, text);
    } catch (e) {
      set({ notice: { key: "saveFailed", file: path, detail: cleanError(e) } });
      return;
    }
    set((s) => {
      const current = s.docs[path];
      if (!current) return {};
      const notice = s.notice?.key === "saveFailed" && s.notice.file === path ? null : s.notice;
      return { docs: { ...s.docs, [path]: { ...current, savedText: text } }, notice };
    });
  };

  const applyModel = (path: string, model: Model) => {
    const doc = get().docs[path];
    if (!doc) return;
    const isMessage = isMessageFile(path);
    const key = isMessage ? "message" : "flow";
    const check = isMessage ? MessageDesign.safeParse(model) : Flow.safeParse(model);
    if (!check.success) {
      const issue = check.error.issues[0];
      const invalid = {
        field: issue ? String(issue.path[issue.path.length - 1] ?? "") : "",
        message: issue?.message ?? "Invalid flow",
        empty: issue ? isEmptyIssue(issue as Parameters<typeof isEmptyIssue>[0]) : false,
      };
      set((s) => ({ docs: { ...s.docs, [path]: { ...doc, [key]: model, invalid } } }));
      clearTimeout(timers.get(path));
      timers.delete(path);
      return;
    }
    const text = `${JSON.stringify(model, null, 2)}\n`;
    set((s) => ({
      docs: {
        ...s.docs,
        [path]: { ...doc, [key]: model, text, parseError: undefined, invalid: undefined },
      },
    }));
    scheduleSave(path);
  };

  const record = (path: string, current: Model, next: Model, mergeKey?: string) => {
    const h = historyOf(path);
    const now = Date.now();
    const merge = mergeKey !== undefined && h.mergeKey === mergeKey && now - h.at < MERGE_WINDOW;
    if (!merge) {
      h.past.push(current);
      if (h.past.length > HISTORY_LIMIT) h.past.shift();
    }
    h.future = [];
    h.mergeKey = mergeKey;
    h.at = now;
    applyModel(path, next);
  };

  const scheduleSave = (path: string) => {
    clearTimeout(timers.get(path));
    timers.set(
      path,
      setTimeout(() => void saveNow(path), SAVE_DELAY),
    );
  };

  return {
    project: null,
    tree: null,
    docs: {},
    selection: null,
    problems: [],
    status: "idle",
    logs: [],
    tools: DEFAULT_TOOLS,
    gateway: [],
    breakpoints: {},
    paused: [],
    activeRun: null,
    executed: {},
    secretsOpen: false,
    inviteOpen: false,
    searchOpen: false,
    newFlowOpen: false,
    newProjectOpen: false,
    activePath: null,
    runBusy: false,
    notice: null,
    catalog: null,
    settings: { snapToGrid: true, openRunOnStart: true, botMemoryMB: 512, uiFont: "beacon" },
    settingsPage: null,

    async refreshCatalog() {
      const project = get().project;
      if (!project) return;
      const catalog = await api.project.catalog();
      if (get().project?.root === project.root) set({ catalog });
    },

    async loadSettings() {
      set({ settings: await api.settings.get() });
    },

    async updateSettings(patch) {
      set((s) => ({ settings: { ...s.settings, ...patch } }));
      try {
        set({ settings: await api.settings.set(patch) });
      } catch (e) {
        set({ notice: { key: "actionFailed", detail: cleanError(e) } });
      }
    },
    locale: initialLocale(),

    setLocale(locale) {
      persistLocale(locale);
      set({ locale });
    },

    async setProject(project) {
      histories.clear();
      set({
        project,
        docs: {},
        selection: null,
        problems: [],
        logs: [],
        gateway: [],
        breakpoints: {},
        paused: [],
        activeRun: null,
        status: "idle",
        statusDetail: undefined,
        statusCode: undefined,
        online: undefined,
        executed: {},
        notice: null,
        catalog: null,
        tree: null,
        activePath: null,
      });
      if (project) {
        try {
          const raw = await api.fs.readOptional(BREAKPOINTS_FILE);
          const parsed = raw ? (JSON.parse(raw) as Record<string, string[]>) : {};
          if (get().project?.root === project.root) set({ breakpoints: parsed });
        } catch {}
        get().syncBreakpoints();
        await Promise.all([get().refreshTree(), get().refreshProblems(), get().refreshCatalog()]);
      }
    },

    async refreshTree() {
      set({ tree: await api.project.tree() });
    },

    async refreshProblems() {
      set({ problems: await api.project.inspect() });
    },

    async loadDoc(path) {
      const existing = get().docs[path];
      if (existing && !existing.missing) return;
      const text = await api.fs.readOptional(path);
      set((s) => ({
        docs: {
          ...s.docs,
          [path]:
            text === null
              ? { text: "", savedText: "", missing: true }
              : { text, savedText: text, ...parse(path, text) },
        },
      }));
    },

    dropDoc(path) {
      clearTimeout(timers.get(path));
      timers.delete(path);
      histories.delete(path);
      set((s) => {
        const { [path]: _, ...docs } = s.docs;
        return {
          docs,
          selection: s.selection?.path === path ? null : s.selection,
          activePath: s.activePath === path ? null : s.activePath,
        };
      });
    },

    async flushSaves() {
      const pending = [...timers.keys()];
      for (const path of pending) clearTimeout(timers.get(path));
      await Promise.all(pending.map(saveNow));
    },

    setText(path, text) {
      set((s) => ({
        docs: {
          ...s.docs,
          [path]: { ...s.docs[path]!, text, ...parse(path, text) },
        },
      }));
      scheduleSave(path);
    },

    updateFlow(path, fn, mergeKey) {
      const flow = get().docs[path]?.flow;
      if (flow) record(path, flow, fn(flow), mergeKey);
    },

    updateMessage(path, fn, mergeKey) {
      const message = get().docs[path]?.message;
      if (message) record(path, message, fn(message), mergeKey);
    },

    undo(path) {
      const current = modelOf(get().docs[path]);
      const h = histories.get(path);
      if (!current || !h?.past.length) return;
      const prev = h.past.pop()!;
      h.future.push(current);
      h.mergeKey = undefined;
      applyModel(path, prev);
    },

    redo(path) {
      const current = modelOf(get().docs[path]);
      const h = histories.get(path);
      if (!current || !h?.future.length) return;
      const next = h.future.pop()!;
      h.past.push(current);
      h.mergeKey = undefined;
      applyModel(path, next);
    },

    canUndo: (path) => (histories.get(path)?.past.length ?? 0) > 0,
    canRedo: (path) => (histories.get(path)?.future.length ?? 0) > 0,

    async onDiskChange(paths) {
      const { docs } = get();
      for (const path of paths) {
        const doc = docs[path];
        if (!doc) continue;
        const text = await api.fs.readOptional(path).catch(() => null);
        if (text === null) continue;
        if (text === doc.text || doc.text !== doc.savedText) continue;
        histories.delete(path);
        set((s) => ({
          docs: {
            ...s.docs,
            [path]: { text, savedText: text, ...parse(path, text) },
          },
        }));
      }
      await Promise.all([get().refreshTree(), get().refreshProblems()]);
    },

    select(selection) {
      set({ selection });
    },

    toggleBreakpoint(path, nodeId) {
      const current = get().breakpoints[path] ?? [];
      const next = current.includes(nodeId)
        ? current.filter((id) => id !== nodeId)
        : [...current, nodeId];
      const breakpoints = { ...get().breakpoints, [path]: next };
      if (!next.length) delete breakpoints[path];
      set({ breakpoints });
      get().syncBreakpoints();
      void api.fs
        .write(BREAKPOINTS_FILE, `${JSON.stringify(breakpoints, null, 2)}\n`)
        .catch(() => {});
    },

    clearBreakpoints() {
      set({ breakpoints: {} });
      get().syncBreakpoints();
      void api.fs.write(BREAKPOINTS_FILE, "{}\n").catch(() => {});
    },

    syncBreakpoints() {
      void api.runtime
        .debug({ type: "breakpoints", breakpoints: get().breakpoints })
        .catch(() => {});
    },

    resumeRun(runId, mode) {
      void api.runtime.debug({ type: "resume", runId, mode }).catch(() => {});
    },

    showTool(id) {
      const { area } = toolInfo(id);
      set((s) => ({ tools: { ...s.tools, [area]: { ...s.tools[area], open: true, active: id } } }));
    },

    toggleTool(id) {
      const { area } = toolInfo(id);
      const current = get().tools[area];
      if (current.open && current.active === id) get().hideArea(area);
      else get().showTool(id);
    },

    hideArea(area) {
      set((s) => ({ tools: { ...s.tools, [area]: { ...s.tools[area], open: false } } }));
    },

    resizeArea(area, size) {
      const { min, max } = SIZE_LIMITS[area];
      const clamped = Math.round(Math.min(max, Math.max(min, size)));
      set((s) => ({ tools: { ...s.tools, [area]: { ...s.tools[area], size: clamped } } }));
    },

    clearGateway() {
      set({ gateway: [] });
    },

    pushRuntime(msg) {
      if (msg.type === "gateway") {
        set((s) => {
          const gateway =
            s.gateway.length >= MAX_GATEWAY ? s.gateway.slice(-MAX_GATEWAY + 1) : s.gateway.slice();
          gateway.push({
            id: ++logId,
            time: msg.time,
            event: msg.event,
            summary: msg.summary,
            handled: msg.handled,
          });
          return { gateway };
        });
        return;
      }
      if (msg.type === "debug") {
        set((s) => {
          if (msg.phase === "resumed") {
            const paused = s.paused.filter((p) => p.runId !== msg.runId);
            return {
              paused,
              activeRun: s.activeRun === msg.runId ? (paused[0]?.runId ?? null) : s.activeRun,
            };
          }
          const run: PausedRun = {
            runId: msg.runId,
            flow: msg.flow,
            nodeId: msg.nodeId,
            vars: msg.vars,
            scope: msg.scope,
            time: msg.time,
          };
          return {
            paused: [...s.paused.filter((p) => p.runId !== msg.runId), run],
            activeRun: msg.runId,
          };
        });
        return;
      }
      if (msg.type === "status" && msg.status === "starting")
        queueMicrotask(() => get().syncBreakpoints());
      set((s) => {
        const patch: Partial<State> = {};
        if (msg.type === "status" && (msg.status === "stopped" || msg.status === "error")) {
          patch.paused = [];
          patch.activeRun = null;
        }
        if (msg.type === "status") {
          patch.status = msg.status;
          patch.statusDetail = msg.detail;
          patch.statusCode = msg.code;
          patch.online = msg.online;
        }
        if (msg.type === "flow" && msg.nodeId && msg.phase === "node") {
          patch.executed = { ...s.executed, [`${msg.flow}#${msg.nodeId}`]: msg.time };
        }
        const repeat = msg.type === "status" && msg.status === s.status && !msg.detail;
        if (!repeat && !(msg.type === "flow" && (msg.phase === "node" || msg.phase === "start"))) {
          const logs = s.logs.length >= MAX_LOGS ? s.logs.slice(-MAX_LOGS + 1) : s.logs.slice();
          logs.push({ ...msg, id: ++logId });
          patch.logs = logs;
        }
        return patch;
      });
    },

    clearLogs() {
      set({ logs: [] });
    },

    set(partial) {
      set(partial);
    },
  };
});

if (import.meta.env.DEV)
  (window as unknown as { __makecordStore: typeof useStore }).__makecordStore = useStore;
