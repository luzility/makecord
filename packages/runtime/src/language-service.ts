import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { PROJECT_FILE, ProjectConfig } from "@makecord/spec";
import { describeNode, type NodeDescriptor } from "./describe.js";
import { inspectProject, type Problem } from "./inspect.js";
import { loadPlugins, type NodeRegistry, type PluginStatus, RUNTIME_VERSION } from "./plugins.js";
import { loadProject } from "./project.js";

export interface Catalog {
  runtimeVersion: string;
  nodes: NodeDescriptor[];
  plugins: PluginStatus[];
}

export type ServiceRequest =
  | { id: number; method: "open"; params: { dir: string } }
  | { id: number; method: "catalog" }
  | { id: number; method: "inspect" };

let dir: string | null = null;
let loaded: Promise<{ registry: NodeRegistry; plugins: PluginStatus[] }> | null = null;

async function pluginNames(projectDir: string): Promise<string[]> {
  try {
    const raw = JSON.parse(await readFile(join(projectDir, PROJECT_FILE), "utf8"));
    return ProjectConfig.parse(raw).plugins;
  } catch {
    return [];
  }
}

function state() {
  if (!dir || !loaded) throw new Error("No project is open in the language service");
  return { dir, loaded };
}

async function catalog(): Promise<Catalog> {
  const { registry, plugins } = await state().loaded;
  const nodes = [...registry.values()].map((e) => describeNode(e.node.meta, e.source));
  return { runtimeVersion: RUNTIME_VERSION, nodes, plugins };
}

async function inspect(): Promise<Problem[]> {
  const { dir: projectDir, loaded: ready } = state();
  const { registry, plugins } = await ready;
  const project = await loadProject(projectDir);
  const problems = inspectProject(
    project,
    [...registry.values()].map((e) => e.node.meta),
  );
  for (const p of plugins) {
    if (!p.loaded) {
      problems.push({
        severity: "error",
        file: PROJECT_FILE,
        code: "plugin-failed",
        message: `Couldn't load ${p.name}: ${p.error}`,
        params: { plugin: p.name, error: p.error ?? "" },
      });
    } else if (!p.compatible) {
      problems.push({
        severity: "warning",
        file: PROJECT_FILE,
        code: "plugin-incompatible",
        message: `${p.name} supports runtime ${p.engines}, this is ${RUNTIME_VERSION}`,
        params: { plugin: p.name, engines: p.engines ?? "", runtime: RUNTIME_VERSION },
      });
    }
  }
  return problems;
}

async function handle(req: ServiceRequest): Promise<unknown> {
  switch (req.method) {
    case "open":
      dir = req.params.dir;
      loaded = pluginNames(dir).then((names) => loadPlugins(req.params.dir, names));
      return catalog();
    case "catalog":
      return catalog();
    case "inspect":
      return inspect();
  }
}

interface Port {
  postMessage(msg: unknown): void;
  on(event: "message", cb: (e: { data: unknown }) => void): void;
}
const port = (process as unknown as { parentPort?: Port }).parentPort;
if (!port) {
  process.stderr.write("language-service must run as an Electron utility process\n");
  process.exit(1);
}
port.on("message", ({ data }) => {
  const req = data as ServiceRequest;
  handle(req).then(
    (result) => port.postMessage({ id: req.id, result }),
    (e: Error) => port.postMessage({ id: req.id, error: e.message }),
  );
});
