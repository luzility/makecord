import { z } from "zod";

export interface Row {
  name: string;
  type: string;
  default?: string;
  required: boolean;
  description?: string;
  children?: Row[];
}

type Json = Record<string, unknown>;

function typeOf(p: Json): string {
  if (Array.isArray(p.enum)) return (p.enum as unknown[]).map((v) => JSON.stringify(v)).join(" | ");
  if (p.const !== undefined) return JSON.stringify(p.const);
  if (p.type === "array") {
    const items = (p.items ?? {}) as Json;
    return Array.isArray(items.enum) ? "intent[]" : `${typeOf(items)}[]`;
  }
  if (p.type === "integer") return "number";
  return String(p.type ?? "any");
}

function rowsFromJson(json: Json): Row[] {
  const required = new Set((json.required as string[] | undefined) ?? []);
  return Object.entries((json.properties ?? {}) as Record<string, Json>).map(([name, p]) => {
    const isObject = p.type === "object" && p.properties;
    return {
      name,
      type: isObject ? "object" : typeOf(p),
      default: p.default === undefined || isObject ? undefined : JSON.stringify(p.default),
      required: required.has(name) && p.default === undefined,
      description: p.description as string | undefined,
      children: isObject ? rowsFromJson(p) : undefined,
    };
  });
}

export function rowsOf(schema: z.ZodType): Row[] {
  return rowsFromJson(z.toJSONSchema(schema, { io: "input", unrepresentable: "any" }) as Json);
}
