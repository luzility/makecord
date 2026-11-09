import { coreNodeMetas } from "@makecord/plugin-core/meta";
import { MESSAGE_FIELD_FORMAT } from "@makecord/plugin-sdk";
import { describeNode, type NodeDescriptor } from "@makecord/runtime/describe";
import type { Locale } from "@/i18n/locale";
import { useStore } from "./store";

export type { NodeDescriptor };

const CORE: NodeDescriptor[] = coreNodeMetas.map((m) => describeNode(m, "core"));

export function useNodes(): NodeDescriptor[] {
  return useStore((s) => s.catalog?.nodes) ?? CORE;
}

export function descriptorOf(type: string): NodeDescriptor | undefined {
  const nodes = useStore.getState().catalog?.nodes ?? CORE;
  return nodes.find((n) => n.type === type);
}

export interface FieldSpec {
  key: string;
  title: string;
  description?: string;
  kind: "text" | "multiline" | "boolean" | "number" | "enum" | "message";
  options?: string[];
  defaultValue?: unknown;
  required: boolean;
}

export function nodeText(node: NodeDescriptor, locale: Locale) {
  const l = node.locales?.[locale];
  return {
    title: l?.title ?? node.title,
    description: l?.description ?? node.description,
    output: (port: string) => l?.outputs?.[port] ?? port,
  };
}

export const nodeTitle = (type: string, locale: Locale) => {
  const node = descriptorOf(type);
  return node ? nodeText(node, locale).title : type;
};

const cache = new WeakMap<NodeDescriptor, Map<Locale, FieldSpec[]>>();

export function fieldsOf(node: NodeDescriptor, locale: Locale = "en"): FieldSpec[] {
  let byLocale = cache.get(node);
  const hit = byLocale?.get(locale);
  if (hit) return hit;
  const schema = node.fields as {
    properties?: Record<string, Record<string, unknown>>;
    required?: string[];
  };
  const required = new Set(schema.required ?? []);
  const localized = node.locales?.[locale]?.fields ?? {};
  const out = Object.entries(schema.properties ?? {}).map(([key, p]): FieldSpec => {
    const kind: FieldSpec["kind"] =
      p.format === MESSAGE_FIELD_FORMAT
        ? "message"
        : Array.isArray(p.enum)
          ? "enum"
          : p.type === "boolean"
            ? "boolean"
            : p.type === "number" || p.type === "integer"
              ? "number"
              : p.multiline
                ? "multiline"
                : "text";
    return {
      key,
      title: localized[key]?.title ?? (p.title as string) ?? key,
      description: localized[key]?.description ?? (p.description as string | undefined),
      kind,
      options: p.enum as string[] | undefined,
      defaultValue: p.default,
      required: required.has(key),
    };
  });
  if (!byLocale) {
    byLocale = new Map();
    cache.set(node, byLocale);
  }
  byLocale.set(locale, out);
  return out;
}

export function defaultData(node: NodeDescriptor): Record<string, unknown> {
  const data: Record<string, unknown> = {};
  for (const f of fieldsOf(node)) {
    if (f.defaultValue !== undefined) data[f.key] = f.defaultValue;
    else if (f.kind === "boolean") data[f.key] = false;
    else if (f.kind === "enum") data[f.key] = f.options?.[0];
    else if (f.kind === "number") data[f.key] = 0;
    else data[f.key] = "";
  }
  return data;
}
