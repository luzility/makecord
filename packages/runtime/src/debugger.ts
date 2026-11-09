import type { Emit } from "./reporter.js";

export type ResumeMode = "continue" | "step" | "stop";

const MAX_DEPTH = 4;
const MAX_ITEMS = 50;
const MAX_TEXT = 1000;

export function snapshot(value: unknown, depth = 0): unknown {
  if (value === null || value === undefined) return value ?? null;
  if (typeof value === "string")
    return value.length > MAX_TEXT ? `${value.slice(0, MAX_TEXT)}…` : value;
  if (typeof value === "number" || typeof value === "boolean") return value;
  if (typeof value === "bigint") return value.toString();
  if (typeof value === "function" || typeof value === "symbol") return undefined;
  if (depth >= MAX_DEPTH) return Array.isArray(value) ? `[${value.length} items]` : "{…}";
  if (value instanceof Map) return snapshot(Object.fromEntries(value), depth);
  if (value instanceof Date) return value.toISOString();
  if (Array.isArray(value)) {
    const items = value.slice(0, MAX_ITEMS).map((v) => snapshot(v, depth + 1));
    if (value.length > MAX_ITEMS) items.push(`… ${value.length - MAX_ITEMS} more`);
    return items;
  }
  const out: Record<string, unknown> = {};
  let n = 0;
  for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
    if (n++ >= MAX_ITEMS) {
      out["…"] = "more";
      break;
    }
    const s = snapshot(v, depth + 1);
    if (s !== undefined) out[k] = s;
  }
  return out;
}

export interface PauseContext {
  file: string;
  runId: string;
  nodeId: string;
  vars: unknown;
  scope: unknown;
  beforePause?: () => Promise<void>;
}

export function createDebugger(emit: Emit) {
  const breakpoints = new Map<string, Set<string>>();
  const stepping = new Set<string>();
  const waiting = new Map<string, (mode: ResumeMode) => void>();

  return {
    setBreakpoints(map: Record<string, string[]>) {
      breakpoints.clear();
      for (const [file, ids] of Object.entries(map))
        if (ids.length) breakpoints.set(file, new Set(ids));
    },

    async before(p: PauseContext): Promise<void> {
      if (!stepping.has(p.runId) && !breakpoints.get(p.file)?.has(p.nodeId)) return;
      await p.beforePause?.().catch(() => {});
      emit({
        type: "debug",
        phase: "paused",
        runId: p.runId,
        flow: p.file,
        nodeId: p.nodeId,
        vars: snapshot(p.vars),
        scope: snapshot(p.scope),
      });
      const mode = await new Promise<ResumeMode>((resolve) => waiting.set(p.runId, resolve));
      waiting.delete(p.runId);
      emit({ type: "debug", phase: "resumed", runId: p.runId });
      if (mode === "stop") {
        stepping.delete(p.runId);
        throw new Error("Stopped in the debugger");
      }
      if (mode === "step") stepping.add(p.runId);
      else stepping.delete(p.runId);
    },

    finished(runId: string) {
      stepping.delete(runId);
    },

    resume(runId: string, mode: ResumeMode) {
      waiting.get(runId)?.(mode);
    },

    resumeAll(mode: ResumeMode = "continue") {
      for (const resolve of [...waiting.values()]) resolve(mode);
    },
  };
}

export type Debugger = ReturnType<typeof createDebugger>;
