import type { Settings } from "../shared/api";
import { JsonStore } from "./state";

export const DEFAULT_SETTINGS: Settings = {
  snapToGrid: true,
  openRunOnStart: true,
  botMemoryMB: 512,
  uiFont: "beacon",
  autoSave: true,
};

const store = new JsonStore<Settings>("settings.json", DEFAULT_SETTINGS);

export const readSettings = () => store.read();

export async function writeSettings(patch: Partial<Settings>): Promise<Settings> {
  const clean: Partial<Settings> = {};
  if (typeof patch.snapToGrid === "boolean") clean.snapToGrid = patch.snapToGrid;
  if (typeof patch.openRunOnStart === "boolean") clean.openRunOnStart = patch.openRunOnStart;
  if (typeof patch.autoSave === "boolean") clean.autoSave = patch.autoSave;
  if (typeof patch.botMemoryMB === "number" && Number.isFinite(patch.botMemoryMB)) {
    clean.botMemoryMB = Math.min(4096, Math.max(128, Math.round(patch.botMemoryMB)));
  }
  if (typeof patch.uiFont === "string" && /^[a-z]{1,32}$/.test(patch.uiFont))
    clean.uiFont = patch.uiFont;
  await store.update((s) => ({ ...s, ...clean }));
  return store.read();
}
