import { readdir, readFile, stat } from "node:fs/promises";
import { join } from "node:path";
import { createContext, runInContext } from "node:vm";
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
const BUDGET_MS = 1500;
const TOO_LONG = "The search took too long. Try a simpler pattern.";
const FLOW_SKIP = new Set(["nodes", "edges", "notes", "position", "specVersion"]);

const SCAN = `(texts, source, flags, limit) => {
  const re = new RegExp(source, flags);
  const out = [];
  for (let t = 0; t < texts.length; t++) {
    for (const m of texts[t].matchAll(re)) {
      if (!m[0]) break;
      out.push([t, m.index, m[0].length]);
      if (out.length >= limit) return out;
    }
  }
  return out;
}`;

class TooLong extends Error {}

type Hit = [text: number, index: number, length: number];

function scanner(query: string, options: FindOptions) {
  const source = options.regex ? query : query.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const flags = options.caseSensitive ? "g" : "gi";
  new RegExp(source, flags);
  const context = createContext({});
  context.scan = runInContext(SCAN, context);
  let budget = BUDGET_MS;
  return (texts: string[], limit: number): Hit[] => {
    if (!texts.length || limit <= 0) return [];
    if (budget <= 0) throw new TooLong();
    const started = Date.now();
    context.args = [texts, source, flags, limit];
    try {
      return runInContext("scan(...args)", context, { timeout: budget }) as Hit[];
    } catch (e) {
      if ((e as { code?: string }).code === "ERR_SCRIPT_EXECUTION_TIMEOUT") throw new TooLong();
      throw e;
    } finally {
      context.args = undefined;
      budget -= Date.now() - started;
    }
  };
}

type Scan = ReturnType<typeof scanner>;

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

function excerpt(text: string, start: number, length: number) {
  const from = Math.max(0, start - CONTEXT);
  const to = Math.min(text.length, start + length + CONTEXT);
  const raw = text.slice(from, to).replace(/[\t\r\n]/g, " ");
  const lead = Math.min(raw.length - raw.trimStart().length, start - from);
  const body = raw.slice(lead);
  const kept = Math.max(body.trimEnd().length, start - from - lead + length);
  const prefix = from > 0 ? "…" : "";
  return {
    text: `${prefix}${body.slice(0, kept)}${to < text.length ? "…" : ""}`,
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

interface Source {
  text: string;
  base: Omit<FindMatch, "text" | "start" | "length">;
}

function collect(sources: Source[], scan: Scan, out: FindMatch[]) {
  const hits = scan(
    sources.map((s) => s.text),
    MAX_MATCHES - out.length,
  );
  for (const [t, index, length] of hits) {
    const { text, base } = sources[t]!;
    out.push({ ...base, length, ...excerpt(text, index, length) });
  }
}

function flowSources(path: string, json: unknown): Source[] {
  if (!json || typeof json !== "object" || Array.isArray(json)) throw new Error("not a flow");
  const flow = json as {
    nodes?: { id: string; type: string; data?: unknown }[];
    notes?: { id: string; text?: string }[];
  } & Record<string, unknown>;
  const sources: Source[] = [];
  for (const node of flow.nodes ?? []) {
    for (const { field, text } of strings(node.data ?? {}, "")) {
      sources.push({ text, base: { path, nodeId: node.id, nodeType: node.type, field } });
    }
  }
  for (const note of flow.notes ?? []) {
    sources.push({ text: note.text ?? "", base: { path, field: "note" } });
  }
  const meta = Object.fromEntries(Object.entries(flow).filter(([k]) => !FLOW_SKIP.has(k)));
  for (const { field, text } of strings(meta, "")) {
    sources.push({ text, base: { path, field } });
  }
  return sources;
}

function lineSources(path: string, text: string): Source[] {
  return text.split(/\r?\n/).map((line, i) => ({ text: line, base: { path, line: i + 1 } }));
}

export async function findIn(
  root: string,
  query: string,
  options: FindOptions,
): Promise<FindResult> {
  if (!query) return { matches: [], truncated: false };
  let scan: Scan;
  try {
    scan = scanner(query, options);
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
      let sources: Source[] | undefined;
      if (f.rel.endsWith(FLOW_FILE_SUFFIX)) {
        try {
          sources = flowSources(f.rel, JSON.parse(text));
        } catch {}
      }
      collect(sources ?? lineSources(f.rel, text), scan, matches);
    } catch (e) {
      if (e instanceof TooLong) {
        return {
          matches: matches.slice(0, MAX_MATCHES),
          truncated: true,
          error: TOO_LONG,
          timedOut: true,
        };
      }
    }
  }
  return { matches: matches.slice(0, MAX_MATCHES), truncated: matches.length >= MAX_MATCHES };
}
