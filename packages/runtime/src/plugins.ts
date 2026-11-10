import { createRequire } from "node:module";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import core from "@makecord/plugin-core";
import type { NodeDefinition, PluginDefinition } from "@makecord/plugin-sdk";
import semver from "semver";

export interface NodeRegistryEntry {
  plugin: PluginDefinition;
  source: string;
  node: NodeDefinition<any>;
}

export type NodeRegistry = Map<string, NodeRegistryEntry>;

export interface PluginStatus {
  name: string;
  loaded: boolean;
  version?: string;
  engines?: string;
  compatible: boolean;
  nodeCount: number;
  error?: string;
}

export { RUNTIME_VERSION } from "./version.js";

import { RUNTIME_VERSION } from "./version.js";

function isPlugin(value: unknown): value is PluginDefinition {
  const p = value as PluginDefinition | undefined;
  return !!p && typeof p.id === "string" && Array.isArray(p.nodes);
}

const compatible = (range: string | undefined) =>
  !range || semver.satisfies(RUNTIME_VERSION, range, { includePrerelease: true });

export async function loadPlugins(
  projectDir: string,
  names: readonly string[],
): Promise<{ registry: NodeRegistry; errors: string[]; plugins: PluginStatus[] }> {
  const registry: NodeRegistry = new Map();
  const errors: string[] = [];
  const plugins: PluginStatus[] = [];
  const req = createRequire(join(projectDir, "package.json"));

  const add = (name: string, plugin: PluginDefinition) => {
    let count = 0;
    for (const node of plugin.nodes) {
      if (registry.has(node.meta.type)) {
        errors.push(
          `${plugin.id}: node type "${node.meta.type}" is already defined by another plugin`,
        );
        continue;
      }
      registry.set(node.meta.type, { plugin, source: name, node });
      count++;
    }
    const ok = compatible(plugin.engines?.makecord);
    if (!ok) {
      errors.push(
        `${name} supports runtime ${plugin.engines.makecord}, but this is ${RUNTIME_VERSION}. It may not work as expected.`,
      );
    }
    plugins.push({
      name,
      loaded: true,
      version: plugin.version,
      engines: plugin.engines?.makecord,
      compatible: ok,
      nodeCount: count,
    });
  };

  add("core", core);
  for (const name of names) {
    try {
      const mod = await import(pathToFileURL(req.resolve(name)).href);
      const plugin = mod.default ?? mod;
      if (!isPlugin(plugin)) {
        throw new Error(
          "its default export isn't a plugin (use definePlugin from @makecord/plugin-sdk)",
        );
      }
      add(name, plugin);
    } catch (e) {
      const message = `Couldn't load ${name}: ${(e as Error).message}`;
      errors.push(message);
      plugins.push({
        name,
        loaded: false,
        compatible: true,
        nodeCount: 0,
        error: (e as Error).message,
      });
    }
  }
  return { registry, errors, plugins };
}
