import { type FSWatcher, watch } from "node:fs";
import { cp, mkdir, readdir, readFile, rename, rm, stat, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { basename, dirname, isAbsolute, join, relative, resolve, sep } from "node:path";
import { coreNodeMetas } from "@makecord/plugin-core/meta";
import { inspectProject, type Problem } from "@makecord/runtime/inspect";
import { loadProject } from "@makecord/runtime/project";
import { PROJECT_FILE, ProjectConfig } from "@makecord/spec";
import type { FileNode, ProjectInfo } from "../shared/api";
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

export async function createProject(parentDir: string, name: string): Promise<string> {
  const slug = slugify(name);
  const root = join(parentDir, slug);
  if (
    await stat(root).then(
      () => true,
      () => false,
    )
  )
    throw new Error(`${root} already exists`);

  const req = createRequire(import.meta.url);
  const template = join(dirname(req.resolve("@makecord/templates/package.json")), "starter");
  await cp(template, root, { recursive: true });
  await rename(join(root, "gitignore.template"), join(root, ".gitignore"));

  for (const file of [PROJECT_FILE, "package.json", "README.md"]) {
    const p = join(root, file);
    const text = await readFile(p, "utf8");
    const safeName = file.endsWith(".json") ? JSON.stringify(name).slice(1, -1) : name;
    await writeFile(p, text.replaceAll("{{name}}", safeName).replaceAll("{{slug}}", slug));
  }
  return root;
}

export const toRel = (root: string, abs: string) => relative(root, abs).split(sep).join("/");
