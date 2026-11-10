import type { DockviewApi } from "dockview-react";
import { translate } from "@/i18n/locale";
import { useStore } from "./store";
import { DEFAULT_TOOLS, type ToolId } from "./tools";

let dock: DockviewApi | null = null;
export const EDITOR_GROUP_ANCHOR = "start";

export function setDockApi(api: DockviewApi | null) {
  dock = api;
}

const basename = (p: string) => p.split("/").pop() ?? p;
const titleOf = (path: string) => basename(path).replace(/\.(flow|message)\.json$/, "");

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
  const group =
    dock.activeGroup ??
    dock.panels.find((p) => p.id.startsWith("editor:"))?.group ??
    dock.getPanel(EDITOR_GROUP_ANCHOR)?.group;
  dock.addPanel({
    id,
    component: "editor",
    tabComponent: "editor",
    title: titleOf(path),
    params: { path },
    position: group ? { referenceGroup: group } : undefined,
  });
}

export function openStart() {
  if (!dock) return;
  const existing = dock.getPanel(EDITOR_GROUP_ANCHOR);
  if (existing) {
    existing.api.setActive();
    return;
  }
  dock.addPanel({
    id: EDITOR_GROUP_ANCHOR,
    component: "start",
    title: translate(useStore.getState().locale, "panels.start"),
    position: dock.activeGroup ? { referenceGroup: dock.activeGroup } : undefined,
  });
}

export function openPaths(): string[] {
  return (dock?.panels ?? [])
    .filter((p) => p.id.startsWith("editor:"))
    .map((p) => p.id.slice("editor:".length));
}

export function closeFile(path: string) {
  dock?.getPanel(`editor:${path}`)?.api.close();
}

export function focusToolWindow(id: ToolId) {
  useStore.getState().showTool(id);
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

export function retitle(api: DockviewApi) {
  const locale = useStore.getState().locale;
  api.getPanel(EDITOR_GROUP_ANCHOR)?.api.setTitle(translate(locale, "panels.start"));
  for (const panel of api.panels) {
    if (panel.id.startsWith("editor:")) panel.api.setTitle(titleOf(panel.id.slice(7)));
  }
}

export function defaultLayout(api: DockviewApi) {
  api.addPanel({ id: EDITOR_GROUP_ANCHOR, component: "start", title: "" });
}

export function resetLayout() {
  useStore.getState().set({ tools: structuredClone(DEFAULT_TOOLS) });
  if (!dock) return;
  const editors = dock.panels
    .filter((p) => p.id.startsWith("editor:"))
    .map((p) => (p.params as { path: string }).path);
  dock.clear();
  defaultLayout(dock);
  retitle(dock);
  for (const path of editors) void openFile(path);
}
