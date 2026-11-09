import { type Flow, messageNameOf } from "@makecord/spec";
import type { FileNode } from "./api";
import { api } from "./api";
import { closeFile, openFile, openPaths } from "./dock";
import { descriptorOf, fieldsOf } from "./nodes";
import { cleanError, useStore } from "./store";

const st = () => useStore.getState();

export function filesUnder(node: FileNode | null, out: string[] = []): string[] {
  if (!node) return out;
  if (node.kind === "file") out.push(node.path);
  for (const c of node.children ?? []) filesUnder(c, out);
  return out;
}

const inside = (path: string, target: string) => path === target || path.startsWith(`${target}/`);

export const dirOf = (path: string) =>
  path.includes("/") ? path.slice(0, path.lastIndexOf("/")) : "";
export const baseOf = (path: string) => path.slice(path.lastIndexOf("/") + 1);
export const join = (dir: string, name: string) => (dir ? `${dir}/${name}` : name);

export function validName(name: string): string | null {
  const n = name.trim();
  if (!n) return "empty";
  if (n === "." || n === ".." || /[\\/:*?"<>|]/.test(n) || n.startsWith(".makecord"))
    return "invalid";
  return null;
}

async function guard<T>(fn: () => Promise<T>): Promise<T | undefined> {
  try {
    return await fn();
  } catch (e) {
    st().set({ notice: { key: "actionFailed", detail: cleanError(e) } });
    return undefined;
  }
}

async function refresh() {
  await Promise.all([st().refreshTree(), st().refreshProblems()]);
}

async function updateMessageRefs(renames: Map<string, string>) {
  if (!renames.size) return;
  const flows = filesUnder(st().tree).filter((p) => p.endsWith(".flow.json"));
  const changed: string[] = [];
  for (const path of flows) {
    const text = await api.fs.readOptional(path);
    if (!text) continue;
    let flow: Flow;
    try {
      flow = JSON.parse(text);
    } catch {
      continue;
    }
    let dirty = false;
    for (const node of flow.nodes ?? []) {
      const meta = descriptorOf(node.type);
      if (!meta) continue;
      for (const f of fieldsOf(meta)) {
        const value = node.data?.[f.key];
        if (f.kind === "message" && typeof value === "string" && renames.has(value)) {
          node.data[f.key] = renames.get(value);
          dirty = true;
        }
      }
    }
    if (dirty) {
      await api.fs.write(path, `${JSON.stringify(flow, null, 2)}\n`);
      changed.push(path);
    }
  }
  if (changed.length) await st().onDiskChange(changed);
}

export async function renamePath(from: string, to: string) {
  if (from === to) return true;
  await st().flushSaves();
  const before = filesUnder(st().tree).filter((p) => inside(p, from));
  const ok = await guard(async () => {
    await api.fs.rename(from, to);
    return true;
  });
  if (!ok) return false;
  const tabs = openPaths().filter((p) => inside(p, from));
  for (const p of tabs) {
    closeFile(p);
    st().dropDoc(p);
  }
  await refresh();
  const renames = new Map<string, string>();
  for (const p of before) {
    const oldName = messageNameOf(p);
    const newName = messageNameOf(to + p.slice(from.length));
    if (oldName && newName && oldName !== newName) renames.set(oldName, newName);
  }
  await guard(() => updateMessageRefs(renames));
  for (const p of tabs) await openFile(to + p.slice(from.length));
  return true;
}

export async function deletePath(path: string) {
  await st().flushSaves();
  for (const p of openPaths().filter((p) => inside(p, path))) {
    closeFile(p);
    st().dropDoc(p);
  }
  await guard(() => api.fs.remove(path));
  await refresh();
}

async function freeName(dir: string, stem: string, suffix: string) {
  const taken = new Set(filesUnder(st().tree));
  for (let n = 1; n < 1000; n++) {
    const path = join(dir, `${stem}${n === 1 ? "-copy" : `-copy-${n}`}${suffix}`);
    if (!taken.has(path)) return path;
  }
  return join(dir, `${stem}-${Date.now()}${suffix}`);
}

export async function duplicateFile(path: string) {
  await st().flushSaves();
  const name = baseOf(path);
  const suffix = name.match(/(\.flow\.json|\.message\.json|\.[^.]+)$/)?.[1] ?? "";
  const stem = name.slice(0, name.length - suffix.length);
  const target = await freeName(dirOf(path), stem, suffix);
  const done = await guard(async () => {
    let text = await api.fs.read(path);
    if (path.endsWith(".flow.json")) {
      const flow = JSON.parse(text) as Flow;
      if (flow.kind === "command") {
        const stemOf = baseOf(target).replace(/\.flow\.json$/, "");
        flow.command.name = stemOf
          .toLowerCase()
          .replace(/[^-_\p{L}\p{N}]/gu, "-")
          .slice(0, 32);
        text = `${JSON.stringify(flow, null, 2)}\n`;
      }
    }
    await api.fs.create(target, text);
    return true;
  });
  await refresh();
  if (done) await openFile(target);
}

export async function createFile(path: string) {
  const done = await guard(async () => {
    await api.fs.create(path, "");
    return true;
  });
  await refresh();
  if (done) await openFile(path);
  return Boolean(done);
}

export async function createFolder(path: string) {
  const done = await guard(async () => {
    await api.fs.mkdir(path);
    return true;
  });
  await refresh();
  return Boolean(done);
}
