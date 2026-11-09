import type { NodeDefinition } from "./node.js";

export interface PluginDefinition {
  id: string;
  version: string;
  engines: { makecord: string };
  permissions?: readonly string[];
  nodes: readonly NodeDefinition<any>[];
}

export function definePlugin(plugin: PluginDefinition): PluginDefinition {
  const prefix = plugin.id.replace(/^@[^/]+\//, "").replace(/^makecord-plugin-/, "");
  for (const node of plugin.nodes) {
    if (!node.meta.type.startsWith(`${prefix}.`)) {
      throw new Error(`Node type "${node.meta.type}" must be namespaced as "${prefix}.<name>"`);
    }
  }
  return plugin;
}
