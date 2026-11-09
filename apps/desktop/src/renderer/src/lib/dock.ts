import type { DockviewApi } from "dockview-react";
import { translate } from "@/i18n/locale";
import { useStore } from "./store";

let dock: DockviewApi | null = null;
export const EDITOR_GROUP_ANCHOR = "start";

export function setDockApi(api: DockviewApi | null) {
  dock = api;
}

const basename = (p: string) => p.split("/").pop() ?? p;

export async function openFile(path: string, nodeId?: string) {
  await useStore.getState().loadDoc(path);
  if (nodeId) useStore.getState().select({ path, nodeId });
  if (!dock) return;
  const id = `editor:${path}`;
  const existing = dock.getPanel(id);
  if (existing) {
    existing.api.setActive();
    return;
  }
  const anchor =
    dock.panels.find((p) => p.id.startsWith("editor:")) ?? dock.getPanel(EDITOR_GROUP_ANCHOR);
  dock.addPanel({
    id,
    component: "editor",
    title: basename(path).replace(/\.(flow|message)\.json$/, ""),
    params: { path },
    position: anchor
      ? { referenceGroup: anchor.group }
      : { referencePanel: "project", direction: "right" },
  });
}

export function closeFile(path: string) {
  dock?.getPanel(`editor:${path}`)?.api.close();
}

export function focusToolWindow(id: string) {
  dock?.getPanel(id)?.api.setActive();
}

export interface LayoutSaver {
  flush(): Promise<void>;
  cancel(): void;
}
let layoutSaver: LayoutSaver | null = null;
export const setLayoutSaver = (saver: LayoutSaver | null) => {
  layoutSaver = saver;
};

export async function flushAll() {
  await Promise.all([useStore.getState().flushSaves(), layoutSaver?.flush()]);
}

const TOOL_TITLES = {
  [EDITOR_GROUP_ANCHOR]: "panels.start",
  project: "panels.project",
  properties: "panels.properties",
  run: "panels.run",
  problems: "panels.problems",
} as const;

export function retitle(dock: DockviewApi) {
  const locale = useStore.getState().locale;
  for (const [id, key] of Object.entries(TOOL_TITLES))
    dock.getPanel(id)?.api.setTitle(translate(locale, key));
}

export function defaultLayout(dock: DockviewApi) {
  dock.addPanel({ id: EDITOR_GROUP_ANCHOR, component: "start", title: "" });
  dock.addPanel({
    id: "project",
    component: "project",
    tabComponent: "tool",
    title: "",
    position: { referencePanel: EDITOR_GROUP_ANCHOR, direction: "left" },
    initialWidth: 240,
  });
  dock.addPanel({
    id: "properties",
    component: "properties",
    tabComponent: "tool",
    title: "",
    position: { referencePanel: EDITOR_GROUP_ANCHOR, direction: "right" },
    initialWidth: 300,
  });
  dock.addPanel({
    id: "run",
    component: "run",
    tabComponent: "tool",
    title: "",
    position: { referencePanel: EDITOR_GROUP_ANCHOR, direction: "below" },
    initialHeight: 220,
  });
  dock.addPanel({
    id: "problems",
    component: "problems",
    tabComponent: "tool",
    title: "",
    position: { referencePanel: "run", direction: "within" },
    inactive: true,
  });
  dock.getPanel(EDITOR_GROUP_ANCHOR)?.api.setActive();
}

export function resetLayout() {
  if (!dock) return;
  const editors = dock.panels
    .filter((p) => p.id.startsWith("editor:"))
    .map((p) => (p.params as { path: string }).path);
  dock.clear();
  defaultLayout(dock);
  retitle(dock);
  for (const path of editors) void openFile(path);
}
