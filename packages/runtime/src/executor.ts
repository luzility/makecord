import type { LogLevel, NodeContext } from "@makecord/plugin-sdk";
import type { Flow, MessageDesign } from "@makecord/spec";
import { TRIGGER_NODE_TYPE } from "@makecord/spec";
import { buildMessage } from "./message.js";
import type { NodeRegistry } from "./plugins.js";
import type { Emit } from "./reporter.js";
import { renderData } from "./templates.js";

const MAX_STEPS = 2000;

export type ExecutionBase = Omit<
  NodeContext,
  "secret" | "log" | "vars" | "scope" | "nodeId" | "message"
> & {
  scope: Record<string, unknown>;
  messages?: ReadonlyMap<string, MessageDesign>;
};

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
}): Promise<void> {
  const { file, flow, registry, base, env, emit, beforeNode } = opts;
  const started = performance.now();
  const nodes = new Map(flow.nodes.map((n) => [n.id, n]));
  const vars = new Map<string, unknown>();

  let current = flow.nodes.find((n) => n.type === TRIGGER_NODE_TYPE);
  emit({ type: "flow", phase: "start", flow: file });

  for (let step = 0; current && step < MAX_STEPS; step++) {
    const node = current;
    const entry = registry.get(node.type);
    if (!entry) {
      emit({
        type: "flow",
        phase: "error",
        flow: file,
        nodeId: node.id,
        error: `Unknown node type: ${node.type}`,
      });
      return;
    }

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
      vars,
      nodeId: node.id,
      secret: (name) =>
        plugin.permissions?.includes(`secrets:${name}`) && name !== "DISCORD_TOKEN"
          ? env[name]
          : undefined,
      log: (level: LogLevel, message: string) =>
        emit({ type: "log", level, message, source: `${file}#${node.id}` }),
    };

    const parsed = entry.node.meta.fields.safeParse(renderData(node.data, scope));
    if (!parsed.success) {
      const msg = parsed.error.issues
        .map((i: { path: PropertyKey[]; message: string }) => `${i.path.join(".")}: ${i.message}`)
        .join("; ");
      emit({
        type: "flow",
        phase: "error",
        flow: file,
        nodeId: node.id,
        error: `Invalid field: ${msg}`,
      });
      return;
    }

    emit({ type: "flow", phase: "node", flow: file, nodeId: node.id });
    let port: string | undefined;
    try {
      if (beforeNode) await beforeNode(node.id, { vars, scope });
      port = (await entry.node.run(ctx, parsed.data)) ?? "next";
    } catch (e) {
      emit({
        type: "flow",
        phase: "error",
        flow: file,
        nodeId: node.id,
        error: (e as Error).message,
      });
      return;
    }

    const edge = flow.edges.find((e) => e.source === node.id && e.sourceHandle === port);
    current = edge ? nodes.get(edge.target) : undefined;
    if (current && step === MAX_STEPS - 1) {
      emit({
        type: "flow",
        phase: "error",
        flow: file,
        nodeId: current.id,
        error: `Stopped after ${MAX_STEPS} steps (infinite loop?)`,
      });
      return;
    }
  }

  emit({
    type: "flow",
    phase: "end",
    flow: file,
    durationMs: Math.round(performance.now() - started),
  });
}
