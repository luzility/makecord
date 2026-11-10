import { readdir, readFile, stat } from "node:fs/promises";
import { join } from "node:path";
import { FLOW_FILE_SUFFIX } from "@makecord/spec";
import type { FindMatch, FindOptions, FindResult } from "../shared/api";

const SKIP = new Set([
  "node_modules",
  ".git",
  ".makecord",
  "dist",
  "data",
  ".DS_Store",
  ".env",
  "package-lock.json",
  "pnpm-lock.yaml",
  "yarn.lock",
]);
const MAX_MATCHES = 1000;
const MAX_FILE = 1024 * 1024;
const CONTEXT = 60;

async function* files(abs: string, rel: string): AsyncGenerator<{ abs: string; rel: string }> {
  let entries: import("node:fs").Dirent[];
  try {
    entries = await readdir(abs, { withFileTypes: true });
  } catch {
    return;
  }
  entries.sort((a, b) => a.name.localeCompare(b.name));
  for (const e of entries) {
    if (SKIP.has(e.name)) continue;
    const childAbs = join(abs, e.name);
    const childRel = rel ? `${rel}/${e.name}` : e.name;
    if (e.isDirectory()) yield* files(childAbs, childRel);
    else if (e.isFile()) yield { abs: childAbs, rel: childRel };
  }
}

function matcher(query: string, options: FindOptions): RegExp {
  const source = options.regex ? query : query.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(source, options.caseSensitive ? "g" : "gi");
}

function excerpt(text: string, start: number, length: number) {
  const from = Math.max(0, start - CONTEXT);
  const to = Math.min(text.length, start + length + CONTEXT);
  const raw = text.slice(from, to).replace(/[\t\r\n]/g, " ");
  const lead = raw.length - raw.trimStart().length;
  const prefix = from > 0 ? "…" : "";
  return {
    text: `${prefix}${raw.slice(lead).trimEnd()}${to < text.length ? "…" : ""}`,
    start: start - from - lead + prefix.length,
  };
}

function* strings(value: unknown, path: string): Generator<{ field: string; text: string }> {
  if (typeof value === "string") yield { field: path, text: value };
  else if (Array.isArray(value)) {
    for (const [i, v] of value.entries()) yield* strings(v, `${path}.${i}`);
  } else if (value && typeof value === "object") {
    for (const [k, v] of Object.entries(value)) yield* strings(v, path ? `${path}.${k}` : k);
  }
}

function searchFlow(path: string, json: unknown, re: RegExp, out: FindMatch[]) {
  const flow = json as {
    nodes?: { id: string; type: string; data?: unknown }[];
    notes?: { id: string; text?: string }[];
  };
  for (const node of flow.nodes ?? []) {
    for (const { field, text } of strings(node.data ?? {}, "")) {
      for (const m of text.matchAll(re)) {
        if (!m[0]) break;
        const e = excerpt(text, m.index, m[0].length);
        out.push({ path, nodeId: node.id, nodeType: node.type, field, length: m[0].length, ...e });
        if (out.length >= MAX_MATCHES) return;
      }
    }
  }
  for (const note of flow.notes ?? []) {
    for (const m of (note.text ?? "").matchAll(re)) {
      if (!m[0]) break;
      out.push({
        path,
        field: "note",
        length: m[0].length,
        ...excerpt(note.text ?? "", m.index, m[0].length),
      });
    }
  }
}

function searchLines(path: string, text: string, re: RegExp, out: FindMatch[]) {
  const lines = text.split(/\r?\n/);
  for (const [i, line] of lines.entries()) {
    for (const m of line.matchAll(re)) {
      if (!m[0]) break;
      out.push({ path, line: i + 1, length: m[0].length, ...excerpt(line, m.index, m[0].length) });
      if (out.length >= MAX_MATCHES) return;
    }
  }
}

export async function findIn(
  root: string,
  query: string,
  options: FindOptions,
): Promise<FindResult> {
  if (!query) return { matches: [], truncated: false };
  let re: RegExp;
  try {
    re = matcher(query, options);
  } catch (e) {
    return { matches: [], truncated: false, error: (e as Error).message };
  }
  const matches: FindMatch[] = [];
  for await (const f of files(root, "")) {
    if (matches.length >= MAX_MATCHES) break;
    try {
      if ((await stat(f.abs)).size > MAX_FILE) continue;
      const text = await readFile(f.abs, "utf8");
      if (text.includes("\0")) continue;
      if (f.rel.endsWith(FLOW_FILE_SUFFIX)) {
        try {
          searchFlow(f.rel, JSON.parse(text), re, matches);
          continue;
        } catch {}
      }
      searchLines(f.rel, text, re, matches);
    } catch {}
  }
  return { matches: matches.slice(0, MAX_MATCHES), truncated: matches.length >= MAX_MATCHES };
}
