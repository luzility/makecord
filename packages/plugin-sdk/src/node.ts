import type { z } from "zod";
import type { NodeContext } from "./context.js";

export type NodeCategory = "trigger" | "action" | "logic" | "data";
export type FlowKind = "command" | "event";

export interface NodeLocale {
  title?: string;
  description?: string;
  fields?: Record<string, { title?: string; description?: string }>;
  outputs?: Record<string, string>;
}

export interface NodeMeta<F extends z.ZodObject = z.ZodObject> {
  type: string;
  title: string;
  description?: string;
  category: NodeCategory;
  fields: F;
  outputs: readonly string[];
  contexts?: readonly FlowKind[];
  needsInteraction?: boolean;
  permissions?: readonly string[];
  locales?: Readonly<Record<string, NodeLocale>>;
}

export type NodeRun<F extends z.ZodObject> = (
  ctx: NodeContext,
  data: z.output<F>,
) => Promise<string | undefined> | string | undefined;

export interface NodeDefinition<F extends z.ZodObject = z.ZodObject> {
  meta: NodeMeta<F>;
  run: NodeRun<F>;
}

export function defineNodeMeta<F extends z.ZodObject>(
  meta: Omit<NodeMeta<F>, "outputs"> & { outputs?: readonly string[] },
): NodeMeta<F> {
  return { ...meta, outputs: meta.outputs ?? ["next"] };
}

export function defineNode<F extends z.ZodObject>(
  meta: NodeMeta<F>,
  run: NodeRun<F>,
): NodeDefinition<F> {
  return { meta, run };
}
