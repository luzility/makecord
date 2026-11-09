import {
  Bug,
  CircleAlert,
  FolderTree,
  type LucideIcon,
  Radio,
  SlidersHorizontal,
  SquareTerminal,
} from "lucide-react";
import type { MessageKey } from "@/i18n/locale";

export type ToolId = "project" | "properties" | "run" | "problems" | "debug" | "events";
export type Area = "left" | "right" | "bottom";

export interface ToolInfo {
  id: ToolId;
  area: Area;
  title: MessageKey;
  icon: LucideIcon;
  shortcut: string;
}

export const TOOLS: ToolInfo[] = [
  { id: "project", area: "left", title: "panels.project", icon: FolderTree, shortcut: "Alt+1" },
  {
    id: "properties",
    area: "right",
    title: "panels.properties",
    icon: SlidersHorizontal,
    shortcut: "Alt+2",
  },
  { id: "run", area: "bottom", title: "panels.run", icon: SquareTerminal, shortcut: "Alt+4" },
  { id: "debug", area: "bottom", title: "panels.debug", icon: Bug, shortcut: "Alt+5" },
  {
    id: "problems",
    area: "bottom",
    title: "panels.problems",
    icon: CircleAlert,
    shortcut: "Alt+6",
  },
  { id: "events", area: "bottom", title: "panels.events", icon: Radio, shortcut: "Alt+7" },
];

export const toolInfo = (id: ToolId) => TOOLS.find((t) => t.id === id)!;
export const toolsIn = (area: Area) => TOOLS.filter((t) => t.area === area);

export interface AreaState {
  open: boolean;
  size: number;
  active: ToolId;
}

export type ToolLayout = Record<Area, AreaState>;

export const DEFAULT_TOOLS: ToolLayout = {
  left: { open: true, size: 240, active: "project" },
  right: { open: true, size: 300, active: "properties" },
  bottom: { open: true, size: 240, active: "run" },
};

export const SIZE_LIMITS: Record<Area, { min: number; max: number }> = {
  left: { min: 160, max: 640 },
  right: { min: 220, max: 720 },
  bottom: { min: 100, max: 900 },
};

export function sanitizeTools(raw: unknown): ToolLayout {
  const out = structuredClone(DEFAULT_TOOLS);
  if (!raw || typeof raw !== "object") return out;
  for (const area of ["left", "right", "bottom"] as const) {
    const a = (raw as Record<string, Partial<AreaState>>)[area];
    if (!a) continue;
    if (typeof a.open === "boolean") out[area].open = a.open;
    if (typeof a.size === "number" && Number.isFinite(a.size)) {
      const { min, max } = SIZE_LIMITS[area];
      out[area].size = Math.round(Math.min(max, Math.max(min, a.size)));
    }
    if (a.active && toolsIn(area).some((t) => t.id === a.active)) out[area].active = a.active;
  }
  return out;
}
