import {
  FilePlus2,
  FolderOpen,
  KeyRound,
  LayoutPanelLeft,
  type LucideIcon,
  Play,
  Puzzle,
  Redo2,
  Save,
  Search,
  Settings,
  Square,
  Undo2,
  UserPlus,
} from "lucide-react";
import type { MessageKey } from "@/i18n/locale";
import { LOCALES, type Locale } from "@/i18n/locale";
import { api } from "./api";
import { flushAll, resetLayout } from "./dock";
import { DOCS_URL, ISSUES_URL } from "./links";
import type { Shortcut } from "./shortcuts";
import { cleanError, isFlowFile, useStore } from "./store";
import { resolveUnsaved } from "./unsaved";
import { isRunning, startBot, stopBot } from "./useRun";

export interface Action {
  id: string;
  label: MessageKey;
  labelVars?: Record<string, string | MessageKey>;
  shortcuts?: Shortcut[];
  icon?: LucideIcon;
  project?: boolean;
  global?: boolean;
  enabled?: () => boolean;
  run: () => void | Promise<void>;
}

const st = () => useStore.getState();
const activeFlow = () => {
  const path = st().activePath;
  return path && isFlowFile(path) ? path : null;
};
const report = (e: unknown) => st().set({ notice: { key: "actionFailed", detail: cleanError(e) } });

export async function openProject(root?: string) {
  try {
    if (!(await resolveUnsaved())) return;
    await flushAll();
    const p = await api.project.open(root);
    if (p) await st().setProject(p);
  } catch (e) {
    report(e);
  }
}

export async function closeProject() {
  try {
    if (!(await resolveUnsaved())) return;
    await flushAll();
    await api.project.close();
    await st().setProject(null);
  } catch (e) {
    report(e);
  }
}

const languageActions: Action[] = LOCALES.map((l: Locale) => ({
  id: `view.language.${l}`,
  label: `languages.${l}` as MessageKey,
  global: true,
  enabled: () => st().locale !== l,
  run: () => st().setLocale(l),
}));

export const actions: Action[] = [
  {
    id: "file.newProject",
    label: "actions.newProject",
    shortcuts: ["Mod+Shift+N"],
    global: true,
    run: () => st().set({ newProjectOpen: true }),
  },
  {
    id: "file.open",
    label: "actions.open",
    shortcuts: ["Mod+O"],
    icon: FolderOpen,
    global: true,
    run: () => openProject(),
  },
  {
    id: "file.save",
    label: "actions.saveAll",
    shortcuts: ["Mod+S"],
    icon: Save,
    project: true,
    global: true,
    run: () => void st().saveAll(),
  },
  {
    id: "file.newFlow",
    label: "project.newFlow",
    shortcuts: ["Mod+N"],
    icon: FilePlus2,
    project: true,
    global: true,
    run: () => st().set({ newFlowOpen: "command" }),
  },
  {
    id: "file.settings",
    label: "actions.settings",
    shortcuts: ["Mod+,"],
    icon: Settings,
    global: true,
    run: () => st().set({ settingsPage: "appearance" }),
  },
  {
    id: "file.plugins",
    label: "actions.plugins",
    icon: Puzzle,
    project: true,
    global: true,
    run: () => st().set({ settingsPage: "plugins" }),
  },
  {
    id: "file.close",
    label: "actions.closeProject",
    project: true,
    global: true,
    run: closeProject,
  },
  {
    id: "file.quit",
    label: "actions.quit",
    shortcuts: ["Mod+Q"],
    global: true,
    run: () => api.app.quit(),
  },
  {
    id: "edit.undo",
    label: "actions.undo",
    shortcuts: ["Mod+Z"],
    icon: Undo2,
    project: true,
    enabled: () => {
      const path = activeFlow();
      return !!path && st().canUndo(path);
    },
    run: () => {
      const path = activeFlow();
      if (path) st().undo(path);
    },
  },
  {
    id: "edit.redo",
    label: "actions.redo",
    shortcuts: ["Mod+Shift+Z", "Mod+Y"],
    icon: Redo2,
    project: true,
    enabled: () => {
      const path = activeFlow();
      return !!path && st().canRedo(path);
    },
    run: () => {
      const path = activeFlow();
      if (path) st().redo(path);
    },
  },
  {
    id: "view.search",
    label: "toolbar.search",
    shortcuts: ["Mod+K"],
    icon: Search,
    project: true,
    global: true,
    run: () => st().set({ searchOpen: true }),
  },
  {
    id: "view.project",
    label: "panels.project",
    shortcuts: ["Alt+1"],
    project: true,
    global: true,
    run: () => st().toggleTool("project"),
  },
  {
    id: "view.properties",
    label: "panels.properties",
    shortcuts: ["Alt+2"],
    project: true,
    global: true,
    run: () => st().toggleTool("properties"),
  },
  {
    id: "view.run",
    label: "panels.run",
    shortcuts: ["Alt+4"],
    project: true,
    global: true,
    run: () => st().toggleTool("run"),
  },
  {
    id: "view.problems",
    label: "panels.problems",
    shortcuts: ["Alt+6"],
    project: true,
    global: true,
    run: () => st().toggleTool("problems"),
  },
  {
    id: "view.debug",
    label: "panels.debug",
    shortcuts: ["Alt+5"],
    project: true,
    global: true,
    run: () => st().toggleTool("debug"),
  },
  {
    id: "view.events",
    label: "panels.events",
    shortcuts: ["Alt+7"],
    project: true,
    global: true,
    run: () => st().toggleTool("events"),
  },
  {
    id: "debug.toggleBreakpoint",
    label: "debug.toggleBreakpoint",
    shortcuts: ["Mod+F8"],
    project: true,
    enabled: () => st().selection !== null,
    run: () => {
      const sel = st().selection;
      if (sel) st().toggleBreakpoint(sel.path, sel.nodeId);
    },
  },
  {
    id: "debug.resume",
    label: "debug.resume",
    shortcuts: ["F9"],
    project: true,
    global: true,
    enabled: () => st().paused.length > 0,
    run: () => {
      const run = st().paused.find((p) => p.runId === st().activeRun) ?? st().paused[0];
      if (run) st().resumeRun(run.runId, "continue");
    },
  },
  {
    id: "debug.step",
    label: "debug.step",
    shortcuts: ["F8"],
    project: true,
    global: true,
    enabled: () => st().paused.length > 0,
    run: () => {
      const run = st().paused.find((p) => p.runId === st().activeRun) ?? st().paused[0];
      if (run) st().resumeRun(run.runId, "step");
    },
  },
  {
    id: "view.resetLayout",
    label: "actions.resetLayout",
    icon: LayoutPanelLeft,
    project: true,
    run: resetLayout,
  },
  ...languageActions,
  {
    id: "run.start",
    label: "search.runBot",
    shortcuts: ["Shift+F10"],
    icon: Play,
    project: true,
    global: true,
    enabled: () => !isRunning(st().status) && !st().runBusy,
    run: startBot,
  },
  {
    id: "run.stop",
    label: "search.stopBot",
    shortcuts: ["Mod+F2"],
    icon: Square,
    project: true,
    global: true,
    enabled: () => isRunning(st().status) && !st().runBusy,
    run: stopBot,
  },
  {
    id: "run.secrets",
    label: "toolbar.secrets",
    icon: KeyRound,
    project: true,
    global: true,
    run: () => st().set({ secretsOpen: true }),
  },
  {
    id: "run.invite",
    label: "actions.invite",
    icon: UserPlus,
    project: true,
    global: true,
    run: () => st().set({ inviteOpen: true }),
  },
  {
    id: "help.docs",
    label: "actions.docs",
    shortcuts: ["F1"],
    global: true,
    run: () => api.app.openExternal(DOCS_URL),
  },
  {
    id: "help.issue",
    label: "actions.reportIssue",
    global: true,
    run: () => api.app.openExternal(ISSUES_URL),
  },
  {
    id: "help.logs",
    label: "actions.openLogs",
    global: true,
    run: () => api.app.openLogs(),
  },
];

export const actionById = new Map(actions.map((a) => [a.id, a]));

export function isAvailable(a: Action, hasProject = !!st().project): boolean {
  if (a.project && !hasProject) return false;
  return a.enabled ? a.enabled() : true;
}

export function runAction(id: string) {
  const a = actionById.get(id);
  if (a && isAvailable(a)) void Promise.resolve(a.run()).catch(report);
}

export const MENU: { label: MessageKey; items: string[] }[] = [
  {
    label: "menu.file",
    items: [
      "file.newProject",
      "file.open",
      "-",
      "file.newFlow",
      "file.save",
      "-",
      "file.settings",
      "file.plugins",
      "-",
      "file.close",
      "file.quit",
    ],
  },
  { label: "menu.edit", items: ["edit.undo", "edit.redo"] },
  {
    label: "menu.view",
    items: [
      "view.search",
      "-",
      "view.project",
      "view.properties",
      "view.run",
      "view.problems",
      "view.debug",
      "view.events",
      "-",
      "view.resetLayout",
      "-",
      ...languageActions.map((a) => a.id),
    ],
  },
  {
    label: "menu.run",
    items: [
      "run.start",
      "run.stop",
      "-",
      "debug.resume",
      "debug.step",
      "debug.toggleBreakpoint",
      "-",
      "run.secrets",
      "run.invite",
    ],
  },
  { label: "menu.help", items: ["help.docs", "help.issue", "-", "help.logs"] },
];
