import type { FunctionInfo } from "@makecord/plugin-sdk";
import type { EventFlow, FunctionSignature } from "@makecord/spec";
import type { LoadedFlow } from "./project.js";

export const MAX_FUNCTION_DEPTH = 8;

export type FunctionFlow = LoadedFlow & { flow: EventFlow & { function: FunctionSignature } };

export function functionsOf(flows: readonly LoadedFlow[]): Map<string, FunctionFlow> {
  const out = new Map<string, FunctionFlow>();
  for (const f of flows) {
    if (f.flow.kind !== "event" || f.flow.event !== "function" || !f.flow.function) continue;
    if (!out.has(f.flow.function.name)) out.set(f.flow.function.name, f as FunctionFlow);
  }
  return out;
}

export const functionInfo = (sig: FunctionSignature): FunctionInfo => ({
  name: sig.name,
  description: sig.description,
  params: sig.params.map((p) => ({ ...p })),
});

export function coerceArgs(
  sig: FunctionSignature,
  args: Record<string, unknown>,
): Record<string, string | number | boolean> {
  const out: Record<string, string | number | boolean> = {};
  for (const p of sig.params) {
    const raw = args[p.name];
    if (raw === undefined || raw === null || raw === "") {
      if (p.required) throw new Error(`Function "${sig.name}" needs the argument "${p.name}"`);
      out[p.name] = p.type === "number" ? 0 : p.type === "boolean" ? false : "";
      continue;
    }
    if (p.type === "number") {
      const n = typeof raw === "number" ? raw : Number(String(raw).trim());
      if (!Number.isFinite(n)) {
        throw new Error(`Argument "${p.name}" of "${sig.name}" has to be a number`);
      }
      out[p.name] = n;
    } else if (p.type === "boolean") {
      out[p.name] =
        typeof raw === "boolean"
          ? raw
          : ["true", "yes", "1", "on"].includes(String(raw).trim().toLowerCase());
    } else {
      out[p.name] = typeof raw === "string" ? raw : JSON.stringify(raw);
    }
  }
  return out;
}
