import type { FlowKind, NodeCategory, NodeLocale, NodeMeta } from "@makecord/plugin-sdk";
import { z } from "zod";

export interface NodeDescriptor {
  type: string;
  title: string;
  description?: string;
  category: NodeCategory;
  outputs: string[];
  contexts?: FlowKind[];
  needsInteraction?: boolean;
  permissions?: string[];
  locales?: Record<string, NodeLocale>;
  fields: Record<string, unknown>;
  plugin: string;
}

export function describeNode(meta: NodeMeta, plugin: string): NodeDescriptor {
  return {
    type: meta.type,
    title: meta.title,
    description: meta.description,
    category: meta.category,
    outputs: [...meta.outputs],
    contexts: meta.contexts ? [...meta.contexts] : undefined,
    needsInteraction: meta.needsInteraction,
    permissions: meta.permissions ? [...meta.permissions] : undefined,
    locales: meta.locales ? { ...meta.locales } : undefined,
    fields: z.toJSONSchema(meta.fields, { io: "input", unrepresentable: "any" }) as Record<
      string,
      unknown
    >,
    plugin,
  };
}
