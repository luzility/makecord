import { isEmptyIssue } from "@makecord/runtime/inspect";
import { Flow } from "@makecord/spec";
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

export interface Doc {
  text: string;
  savedText: string;
  flow?: Flow;
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
  executed: Record<string, number>;
  secretsOpen: boolean;
  searchOpen: boolean;
  newFlowOpen: boolean;
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
  setText(path: string, text: string): void;
  flushSaves(): Promise<void>;
  updateFlow(path: string, fn: (flow: Flow) => Flow, mergeKey?: string): void;
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

interface History {
  past: Flow[];
  future: Flow[];
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

function parse(text: string): Pick<Doc, "flow" | "parseError"> {
  try {
    const res = Flow.safeParse(JSON.parse(text));
    return res.success
      ? { flow: res.data }
      : { parseError: res.error.issues[0]?.message ?? "Invalid flow" };
  } catch (e) {
    return { parseError: (e as Error).message };
  }
}

export const isFlowFile = (path: string) => path.endsWith(".flow.json");

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

  const applyFlow = (path: string, flow: Flow) => {
    const doc = get().docs[path];
    if (!doc) return;
    const check = Flow.safeParse(flow);
    if (!check.success) {
      const issue = check.error.issues[0];
      const invalid = {
        field: issue ? String(issue.path[issue.path.length - 1] ?? "") : "",
        message: issue?.message ?? "Invalid flow",
        empty: issue ? isEmptyIssue(issue as Parameters<typeof isEmptyIssue>[0]) : false,
      };
      set((s) => ({ docs: { ...s.docs, [path]: { ...doc, flow, invalid } } }));
      clearTimeout(timers.get(path));
      timers.delete(path);
      return;
    }
    const text = `${JSON.stringify(flow, null, 2)}\n`;
    set((s) => ({
      docs: {
        ...s.docs,
        [path]: { ...doc, flow, text, parseError: undefined, invalid: undefined },
      },
    }));
    scheduleSave(path);
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
    executed: {},
    secretsOpen: false,
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
              : { text, savedText: text, ...(isFlowFile(path) ? parse(text) : {}) },
        },
      }));
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
          [path]: { ...s.docs[path]!, text, ...(isFlowFile(path) ? parse(text) : {}) },
        },
      }));
      scheduleSave(path);
    },

    updateFlow(path, fn, mergeKey) {
      const doc = get().docs[path];
      if (!doc?.flow) return;
      const h = historyOf(path);
      const now = Date.now();
      const merge = mergeKey !== undefined && h.mergeKey === mergeKey && now - h.at < MERGE_WINDOW;
      if (!merge) {
        h.past.push(doc.flow);
        if (h.past.length > HISTORY_LIMIT) h.past.shift();
      }
      h.future = [];
      h.mergeKey = mergeKey;
      h.at = now;
      applyFlow(path, fn(doc.flow));
    },

    undo(path) {
      const doc = get().docs[path];
      const h = histories.get(path);
      const prev = h?.past.pop();
      if (!doc?.flow || !h || !prev) return;
      h.future.push(doc.flow);
      h.mergeKey = undefined;
      applyFlow(path, prev);
    },

    redo(path) {
      const doc = get().docs[path];
      const h = histories.get(path);
      const next = h?.future.pop();
      if (!doc?.flow || !h || !next) return;
      h.past.push(doc.flow);
      h.mergeKey = undefined;
      applyFlow(path, next);
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
            [path]: { text, savedText: text, ...(isFlowFile(path) ? parse(text) : {}) },
          },
        }));
      }
      await Promise.all([get().refreshTree(), get().refreshProblems()]);
    },

    select(selection) {
      set({ selection });
    },

    pushRuntime(msg) {
      set((s) => {
        const patch: Partial<State> = {};
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
