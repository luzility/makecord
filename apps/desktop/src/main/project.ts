import { type FSWatcher, watch } from "node:fs";
import { cp, mkdir, readdir, readFile, rename, rm, stat, writeFile } from "node:fs/promises";
import { basename, dirname, isAbsolute, join, relative, resolve, sep } from "node:path";
import { coreNodeMetas } from "@makecord/plugin-core/meta";
import { inspectProject, type Problem } from "@makecord/runtime/inspect";
import { loadProject } from "@makecord/runtime/project";
import { PROJECT_FILE, ProjectConfig } from "@makecord/spec";
import type {
  FileNode,
  FindOptions,
  FindResult,
  FunctionSummary,
  ProjectInfo,
  ProjectTemplate,
} from "../shared/api";
import { TEMPLATES_DIR } from "./bundled";
import { findIn } from "./find";
import { appState } from "./state";

const IGNORED = new Set(["node_modules", ".git", ".makecord", "dist", ".DS_Store"]);

let current: ProjectInfo | null = null;
let watcher: FSWatcher | null = null;

export const currentProject = () => current;

export function requireProject(): ProjectInfo {
  if (!current) throw new Error("No project is open");
  return current;
}

export function projectPath(rel: string): string {
  const { root } = requireProject();
  if (isAbsolute(rel)) throw new Error("Absolute paths are not allowed");
  const abs = resolve(root, rel);
  if (abs !== root && !abs.startsWith(root + sep))
    throw new Error("Access outside the project is blocked");
  return abs;
}

export async function openProject(
  root: string,
  onChange: (paths: string[]) => void,
): Promise<ProjectInfo> {
  const raw = JSON.parse(
    await readFile(join(root, PROJECT_FILE), "utf8").catch(() => {
      throw new Error(`This folder has no ${PROJECT_FILE}, so it isn't a Makecord project`);
    }),
  );
  const config = ProjectConfig.safeParse(raw);
  closeProject();
  current = { root, name: config.success ? config.data.name : basename(root) };

  await appState.update((s) => {
    s.recent = [root, ...s.recent.filter((r) => r !== root)].slice(0, 10);
  });

  let pending = new Set<string>();
  let timer: NodeJS.Timeout | undefined;
  watcher = watch(root, { recursive: true }, (_event, name) => {
    if (!name) return;
    const rel = name.split(sep).join("/");
    if (rel.split("/").some((seg) => IGNORED.has(seg))) return;
    pending.add(rel);
    clearTimeout(timer);
    timer = setTimeout(() => {
      onChange([...pending]);
      pending = new Set();
    }, 120);
  });
  return current;
}

export function closeProject() {
  watcher?.close();
  watcher = null;
  current = null;
}

export async function readTree(abs = requireProject().root, rel = ""): Promise<FileNode> {
  const entries = await readdir(abs, { withFileTypes: true });
  const children: FileNode[] = [];
  for (const e of entries) {
    if (IGNORED.has(e.name)) continue;
    const childRel = rel ? `${rel}/${e.name}` : e.name;
    if (e.isDirectory()) children.push(await readTree(join(abs, e.name), childRel));
    else children.push({ name: e.name, path: childRel, kind: "file" });
  }
  children.sort((a, b) =>
    a.kind === b.kind ? a.name.localeCompare(b.name) : a.kind === "dir" ? -1 : 1,
  );
  return { name: rel ? basename(abs) : requireProject().name, path: rel, kind: "dir", children };
}

export function findInProject(query: string, options: FindOptions): Promise<FindResult> {
  return findIn(requireProject().root, String(query ?? "").slice(0, 500), {
    caseSensitive: Boolean(options?.caseSensitive),
    regex: Boolean(options?.regex),
  });
}

export async function functions(): Promise<FunctionSummary[]> {
  try {
    const project = await loadProject(requireProject().root);
    return project.flows
      .flatMap(({ file, flow }) =>
        flow.kind === "event" && flow.event === "function" && flow.function
          ? [{ ...flow.function, file }]
          : [],
      )
      .sort((a, b) => a.name.localeCompare(b.name));
  } catch {
    return [];
  }
}

export async function inspect(): Promise<Problem[]> {
  try {
    const project = await loadProject(requireProject().root);
    return inspectProject(project, coreNodeMetas);
  } catch (e) {
    return [
      {
        severity: "error",
        file: PROJECT_FILE,
        code: "invalid-project",
        message: (e as Error).message,
      },
    ];
  }
}

export async function writeProjectFile(rel: string, content: string, { create = false } = {}) {
  const abs = projectPath(rel);
  if (create) {
    const exists = await stat(abs).then(
      () => true,
      () => false,
    );
    if (exists) throw new Error(`${rel} already exists`);
  }
  await mkdir(dirname(abs), { recursive: true });
  await writeFile(abs, content, "utf8");
}

const exists = (abs: string) =>
  stat(abs).then(
    () => true,
    () => false,
  );

export async function renameProjectFile(from: string, to: string) {
  const src = projectPath(from);
  const dest = projectPath(to);
  const root = requireProject().root;
  if (src === root || dest === root) throw new Error("The project root can't be renamed");
  if (dest.startsWith(`${src}${sep}`)) throw new Error("A folder can't be moved into itself");
  if (await exists(dest)) throw new Error(`${to} already exists`);
  await mkdir(dirname(dest), { recursive: true });
  await rename(src, dest);
}

export async function createProjectFolder(rel: string) {
  const abs = projectPath(rel);
  if (await exists(abs)) throw new Error(`${rel} already exists`);
  await mkdir(abs, { recursive: true });
}

export async function removeProjectFile(rel: string) {
  const abs = projectPath(rel);
  if (abs === requireProject().root) throw new Error("The project root can't be deleted");
  await rm(abs, { recursive: true });
}

const slugify = (s: string) =>
  s
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/ı/g, "i")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "") || "bot";

interface TemplateManifest {
  order: number;
  title: Record<string, string>;
  description: Record<string, string>;
  intents: string[];
  plugins: string[];
  secrets: string[];
  dependencies: Record<string, string>;
  env: string[];
}

const BASE_TEMPLATE = "starter";
const MANIFEST = "template.json";

async function readManifest(dir: string): Promise<TemplateManifest | null> {
  try {
    return JSON.parse(await readFile(join(dir, MANIFEST), "utf8")) as TemplateManifest;
  } catch {
    return null;
  }
}

export async function listTemplates(): Promise<ProjectTemplate[]> {
  const out: (ProjectTemplate & { order: number })[] = [];
  for (const e of await readdir(TEMPLATES_DIR, { withFileTypes: true }).catch(() => [])) {
    if (!e.isDirectory()) continue;
    const m = await readManifest(join(TEMPLATES_DIR, e.name));
    if (m)
      out.push({
        id: e.name,
        title: m.title,
        description: m.description,
        plugins: m.plugins,
        order: m.order,
      });
  }
  return out.sort((a, b) => a.order - b.order).map(({ order: _, ...t }) => t);
}

const union = (a: unknown, b: readonly string[]) => [
  ...new Set([...(Array.isArray(a) ? (a as string[]) : []), ...b]),
];

export async function createProject(
  parentDir: string,
  name: string,
  templateId = BASE_TEMPLATE,
): Promise<string> {
  const slug = slugify(name);
  const root = join(parentDir, slug);
  if (
    await stat(root).then(
      () => true,
      () => false,
    )
  )
    throw new Error(`${root} already exists`);

  const id = /^[a-z0-9-]+$/.test(templateId) ? templateId : BASE_TEMPLATE;
  const overlay = join(TEMPLATES_DIR, id);
  const manifest = await readManifest(overlay);
  if (!manifest) throw new Error(`There's no template called ${id}`);

  await cp(join(TEMPLATES_DIR, BASE_TEMPLATE), root, { recursive: true });
  if (id !== BASE_TEMPLATE) {
    for (const dir of ["commands", "events"])
      await rm(join(root, dir), { recursive: true, force: true });
    await cp(overlay, root, { recursive: true });
  }
  await rm(join(root, MANIFEST), { force: true });
  await rename(join(root, "gitignore.template"), join(root, ".gitignore"));

  const configPath = join(root, PROJECT_FILE);
  const config = JSON.parse(await readFile(configPath, "utf8"));
  config.intents = union(config.intents, manifest.intents);
  config.plugins = union(config.plugins, manifest.plugins);
  config.secrets = union(config.secrets, manifest.secrets);
  await writeFile(configPath, `${JSON.stringify(config, null, 2)}\n`);

  const pkgPath = join(root, "package.json");
  const pkg = JSON.parse(await readFile(pkgPath, "utf8"));
  pkg.dependencies = { ...pkg.dependencies, ...manifest.dependencies };
  await writeFile(pkgPath, `${JSON.stringify(pkg, null, 2)}\n`);

  if (manifest.env.length) {
    const envPath = join(root, ".env.example");
    const env = await readFile(envPath, "utf8").catch(() => "");
    await writeFile(envPath, `${env.trimEnd()}\n\n${manifest.env.join("\n")}\n`);
  }

  for (const file of [PROJECT_FILE, "package.json", "README.md"]) {
    const p = join(root, file);
    const text = await readFile(p, "utf8");
    const safeName = file.endsWith(".json") ? JSON.stringify(name).slice(1, -1) : name;
    await writeFile(p, text.replaceAll("{{name}}", safeName).replaceAll("{{slug}}", slug));
  }
  return root;
}

export const toRel = (root: string, abs: string) => relative(root, abs).split(sep).join("/");
