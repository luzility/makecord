const TEMPLATE = /\{\{\s*([\w.]+)\s*\}\}/g;

function lookup(scope: Record<string, unknown>, path: string): unknown {
  let cur: unknown = scope;
  for (const key of path.split(".")) {
    if (cur == null || typeof cur !== "object") return undefined;
    cur = (cur as Record<string, unknown>)[key];
  }
  return cur;
}

function asText(v: unknown): string {
  if (v == null) return "";
  return typeof v === "object" ? JSON.stringify(v) : String(v);
}

function asJson(v: unknown): string {
  if (typeof v === "bigint") return v.toString();
  if (typeof v === "function" || typeof v === "symbol") return "null";
  return JSON.stringify(v ?? null) ?? "null";
}

export function renderTemplate(input: string, scope: Record<string, unknown>): string {
  return input.replace(TEMPLATE, (_, path: string) => asText(lookup(scope, path)));
}

export function renderJsonTemplate(input: string, scope: Record<string, unknown>): string {
  let out = "";
  let inString = false;
  let escaped = false;
  let at = 0;
  const scan = (text: string) => {
    for (const ch of text) {
      if (escaped) escaped = false;
      else if (inString && ch === "\\") escaped = true;
      else if (ch === '"') inString = !inString;
    }
  };
  for (const match of input.matchAll(TEMPLATE)) {
    const before = input.slice(at, match.index);
    scan(before);
    out += before;
    const value = lookup(scope, match[1]!);
    out += inString ? JSON.stringify(asText(value)).slice(1, -1) : asJson(value);
    at = match.index + match[0].length;
  }
  return out + input.slice(at);
}

export function renderData(
  data: unknown,
  scope: Record<string, unknown>,
  raw?: readonly string[],
): unknown {
  if (typeof data === "string") return renderTemplate(data, scope);
  if (Array.isArray(data)) return data.map((d) => renderData(d, scope));
  if (data && typeof data === "object") {
    return Object.fromEntries(
      Object.entries(data).map(([k, v]) => [k, raw?.includes(k) ? v : renderData(v, scope)]),
    );
  }
  return data;
}
