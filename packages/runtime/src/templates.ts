const TEMPLATE = /\{\{\s*([\w.]+)\s*\}\}/g;

function lookup(scope: Record<string, unknown>, path: string): unknown {
  let cur: unknown = scope;
  for (const key of path.split(".")) {
    if (cur == null || typeof cur !== "object") return undefined;
    cur = (cur as Record<string, unknown>)[key];
  }
  return cur;
}

export function renderTemplate(input: string, scope: Record<string, unknown>): string {
  return input.replace(TEMPLATE, (_, path: string) => {
    const v = lookup(scope, path);
    if (v == null) return "";
    return typeof v === "object" ? JSON.stringify(v) : String(v);
  });
}

export function renderData(data: unknown, scope: Record<string, unknown>): unknown {
  if (typeof data === "string") return renderTemplate(data, scope);
  if (Array.isArray(data)) return data.map((d) => renderData(d, scope));
  if (data && typeof data === "object") {
    return Object.fromEntries(Object.entries(data).map(([k, v]) => [k, renderData(v, scope)]));
  }
  return data;
}
