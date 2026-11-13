import {
  DEBUG_STOP,
  type FunctionInfo,
  type LogLevel,
  type NodeContext,
} from "@makecord/plugin-sdk";
import type { Flow, MessageDesign } from "@makecord/spec";
import { TRIGGER_NODE_TYPE } from "@makecord/spec";
import { buildMessage } from "./message.js";
import type { NodeRegistry } from "./plugins.js";
import type { Emit } from "./reporter.js";
import { renderData, renderJsonTemplate, renderTemplate } from "./templates.js";

const MAX_STEPS = 2000;

export type ExecutionBase = Omit<
  NodeContext,
  | "secret"
  | "log"
  | "vars"
  | "scope"
  | "nodeId"
  | "message"
  | "render"
  | "functions"
  | "callFunction"
  | "setResult"
> & {
  scope: Record<string, unknown>;
  messages?: ReadonlyMap<string, MessageDesign>;
};

export type Caller = Pick<ExecutionBase, "client" | "interaction" | "eventArgs" | "scope">;

export interface FunctionHost {
  list(): readonly FunctionInfo[];
  call(
    name: string,
    args: Record<string, unknown>,
    caller: Caller,
    depth: number,
  ): Promise<unknown>;
}

export interface FlowResult {
  ok: boolean;
  result?: unknown;
  error?: string;
  stopped?: boolean;
}

export const isDebugStop = (e: unknown): boolean =>
  (e as { code?: unknown } | null)?.code === DEBUG_STOP;

export function debugStopError(message = "Stopped in the debugger"): Error {
  return Object.assign(new Error(message), { code: DEBUG_STOP });
}

export async function executeFlow(opts: {
  file: string;
  flow: Flow;
  registry: NodeRegistry;
  base: ExecutionBase;
  env: NodeJS.ProcessEnv;
  emit: Emit;
  beforeNode?: (
    nodeId: string,
    state: { vars: Map<string, unknown>; scope: unknown },
  ) => Promise<void>;
  functions?: FunctionHost;
  depth?: number;
}): Promise<FlowResult> {
  const { file, flow, registry, base, env, emit, beforeNode, functions, depth = 0 } = opts;
  const started = performance.now();
  const nodes = new Map(flow.nodes.map((n) => [n.id, n]));
  const vars = new Map<string, unknown>();
  let result: unknown;
  let stopped = false;
  const fail = (error: string, nodeId?: string): FlowResult => {
    emit({ type: "flow", phase: "error", flow: file, nodeId, error });
    return stopped ? { ok: false, error, stopped } : { ok: false, error };
  };

  let current = flow.nodes.find((n) => n.type === TRIGGER_NODE_TYPE);
  emit({ type: "flow", phase: "start", flow: file });

  for (let step = 0; current && step < MAX_STEPS; step++) {
    const node = current;
    const entry = registry.get(node.type);
    if (!entry) return fail(`Unknown node type: ${node.type}`, node.id);

    const { plugin } = entry;
    const scope = { ...base.scope, vars: Object.fromEntries(vars) };
    const { messages, ...shared } = base;
    const ctx: NodeContext = {
      ...shared,
      scope,
      message: (name) => {
        const design = messages?.get(name.trim());
        if (!design) throw new Error(`Message design "${name}" doesn't exist in messages/`);
        return buildMessage(design, { ...base.scope, vars: Object.fromEntries(vars) });
      },
      render: (template, mode) =>
        mode === "json" ? renderJsonTemplate(template, scope) : renderTemplate(template, scope),
      vars,
      nodeId: node.id,
      secret: (name) =>
        plugin.permissions?.includes(`secrets:${name}`) && name !== "DISCORD_TOKEN"
          ? env[name]
          : undefined,
      functions: () => functions?.list() ?? [],
      callFunction: (name, args) => {
        if (!functions) return Promise.reject(new Error("Functions aren't available here"));
        const { client, interaction, eventArgs } = base;
        return functions
          .call(name, args, { client, interaction, eventArgs, scope: base.scope }, depth + 1)
          .catch((e: unknown) => {
            if (isDebugStop(e)) stopped = true;
            throw e;
          });
      },
      setResult: (value) => {
        result = value;
      },
      log: (level: LogLevel, message: string) =>
        emit({ type: "log", level, message, source: `${file}#${node.id}` }),
    };

    const parsed = entry.node.meta.fields.safeParse(
      renderData(node.data, scope, entry.node.meta.rawFields),
    );
    if (!parsed.success) {
      const msg = parsed.error.issues
        .map((i: { path: PropertyKey[]; message: string }) => `${i.path.join(".")}: ${i.message}`)
        .join("; ");
      return fail(`Invalid field: ${msg}`, node.id);
    }

    emit({ type: "flow", phase: "node", flow: file, nodeId: node.id });
    let port: string | undefined;
    try {
      if (beforeNode) await beforeNode(node.id, { vars, scope });
      port = (await entry.node.run(ctx, parsed.data)) ?? "next";
    } catch (e) {
      if (isDebugStop(e)) stopped = true;
      return fail((e as Error).message, node.id);
    }
    if (stopped) return fail("Stopped in the debugger", node.id);

    const edge = flow.edges.find((e) => e.source === node.id && e.sourceHandle === port);
    current = edge ? nodes.get(edge.target) : undefined;
    if (current && step === MAX_STEPS - 1) {
      return fail(`Stopped after ${MAX_STEPS} steps (infinite loop?)`, current.id);
    }
  }

  emit({
    type: "flow",
    phase: "end",
    flow: file,
    durationMs: Math.round(performance.now() - started),
  });
  return { ok: true, result };
}
