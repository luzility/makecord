import { defineNode, definePlugin, type NodeContext } from "@makecord/plugin-sdk";
import type { z } from "zod";
import * as m from "./meta.js";
import {
  type AgentRequest,
  type AgentTool,
  describeError,
  PROVIDERS,
  parseJson,
  runAgent,
  type Turn,
} from "./providers.js";

const DISCORD_LIMIT = 2000;
const DISCORD_HINT =
  "Your answer is posted as a Discord message: keep it under 1800 characters and use Discord markdown.";

type ModelFields = z.output<typeof m.generate.fields>;

function request(
  ctx: NodeContext,
  data: Pick<ModelFields, "provider" | "model" | "baseUrl" | "effort" | "maxTokens">,
): Pick<AgentRequest, "provider" | "apiKey" | "baseUrl" | "model" | "effort" | "maxTokens"> {
  const secret = PROVIDERS[data.provider].secret;
  return {
    provider: data.provider,
    apiKey: secret ? ctx.secret(secret) : undefined,
    baseUrl: data.baseUrl,
    model: data.model,
    effort: data.effort,
    maxTokens: data.maxTokens,
  };
}

async function prepare(ctx: NodeContext, typing: boolean) {
  const i = ctx.interaction;
  if (i && !i.deferred && !i.replied) await i.deferReply().catch(() => {});
  if (!typing) return;
  const channel = (ctx.eventArgs[0] as { channel?: { sendTyping?: () => Promise<unknown> } })
    ?.channel;
  void channel?.sendTyping?.().catch(() => {});
}

const clip = (text: string, fit: boolean) =>
  fit && text.length > DISCORD_LIMIT ? `${text.slice(0, DISCORD_LIMIT - 1)}…` : text;

function logUsage(
  ctx: NodeContext,
  model: string,
  r: { inputTokens: number; outputTokens: number; steps: number },
) {
  ctx.log(
    "debug",
    `${model || "default model"}: ${r.inputTokens} tokens in, ${r.outputTokens} out, ${r.steps} step${r.steps === 1 ? "" : "s"}`,
  );
}

function fail(ctx: NodeContext, variable: string, e: unknown) {
  const message = describeError(e);
  ctx.vars.set(`${variable}Error`, message);
  ctx.log("warn", message);
  return "failed";
}

const MEMORY_PREFIX = "ai.memory:";

function readMemory(ctx: NodeContext, key: string): Turn[] {
  const raw = ctx.store.get(MEMORY_PREFIX + key);
  if (typeof raw !== "string") return [];
  try {
    const turns = JSON.parse(raw) as Turn[];
    return Array.isArray(turns) ? turns.filter((t) => t && typeof t.text === "string") : [];
  } catch {
    return [];
  }
}

function writeMemory(ctx: NodeContext, key: string, turns: Turn[], keep: number) {
  const pairs = turns.slice(-keep * 2);
  while (pairs.length && pairs[0]!.role !== "user") pairs.shift();
  ctx.store.set(MEMORY_PREFIX + key, JSON.stringify(pairs));
}

export function toolsFor(ctx: NodeContext, list: string): AgentTool[] {
  const wanted = list
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  if (!wanted.length) return [];
  const all = ctx.functions();
  const picked = wanted.includes("*") ? all : all.filter((f) => wanted.includes(f.name));
  const missing = wanted.filter((w) => w !== "*" && !all.some((f) => f.name === w));
  if (missing.length) ctx.log("warn", `No function named ${missing.join(", ")}`);
  return picked.map((f) => ({
    name: f.name,
    description: f.description || `Runs the ${f.name} function`,
    schema: {
      type: "object",
      properties: Object.fromEntries(
        f.params.map((p) => [
          p.name,
          { type: p.type, ...(p.description ? { description: p.description } : {}) },
        ]),
      ),
      required: f.params.filter((p) => p.required).map((p) => p.name),
      additionalProperties: false,
    },
    run: async (input) => {
      const value = await ctx.callFunction(f.name, input);
      if (value === undefined || value === null || value === "") return "Done";
      return typeof value === "string" ? value : JSON.stringify(value);
    },
  }));
}

type FieldType = "string" | "number" | "boolean";

export function parseFieldList(
  text: string,
): { name: string; description: string; type: FieldType }[] {
  const out: { name: string; description: string; type: FieldType }[] = [];
  for (const line of text.split("\n")) {
    const at = line.indexOf(":");
    const name = (at >= 0 ? line.slice(0, at) : line).trim();
    if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(name)) continue;
    let description = at >= 0 ? line.slice(at + 1).trim() : "";
    let type: FieldType = "string";
    const hint = description.match(/\((number|yes\/no|boolean)\)\s*$/i);
    if (hint) {
      type = hint[1]!.toLowerCase() === "number" ? "number" : "boolean";
      description = description.slice(0, hint.index).trim();
    }
    out.push({ name, description, type });
  }
  return out;
}

const schemaFor = (fields: ReturnType<typeof parseFieldList>) => ({
  type: "object",
  properties: Object.fromEntries(
    fields.map((f) => [
      f.name,
      {
        anyOf: [{ type: f.type }, { type: "null" }],
        ...(f.description ? { description: f.description } : {}),
      },
    ]),
  ),
  required: fields.map((f) => f.name),
  additionalProperties: false,
});

export default definePlugin({
  id: "@makecord/plugin-ai",
  version: "0.2.0",
  engines: { makecord: "^0.2.0" },
  permissions: Object.values(PROVIDERS)
    .map((p) => p.secret)
    .filter(Boolean)
    .map((s) => `secrets:${s}`),
  nodes: [
    defineNode(m.generate, async (ctx, data) => {
      try {
        await prepare(ctx, true);
        const system = [data.system.trim(), data.fitDiscord ? DISCORD_HINT : ""]
          .filter(Boolean)
          .join("\n\n");
        const res = await runAgent({
          ...request(ctx, data),
          system,
          history: [],
          prompt: data.prompt,
          tools: [],
          maxSteps: 1,
        });
        logUsage(ctx, data.model, res);
        ctx.vars.set(data.variable, clip(res.text, data.fitDiscord));
        ctx.vars.set(`${data.variable}Error`, "");
        return "next";
      } catch (e) {
        return fail(ctx, data.variable, e);
      }
    }),

    defineNode(m.agent, async (ctx, data) => {
      try {
        await prepare(ctx, true);
        const memoryKey = data.memory.trim();
        const history = memoryKey ? readMemory(ctx, memoryKey) : [];
        const system = [data.system.trim(), data.fitDiscord ? DISCORD_HINT : ""]
          .filter(Boolean)
          .join("\n\n");
        const res = await runAgent({
          ...request(ctx, data),
          system,
          history,
          prompt: data.prompt,
          tools: toolsFor(ctx, data.tools),
          maxSteps: data.maxSteps,
        });
        logUsage(ctx, data.model, res);
        for (const c of res.toolCalls) {
          ctx.log(
            c.failed ? "warn" : "info",
            `Called ${c.name}(${JSON.stringify(c.input)}): ${c.output}`,
          );
        }
        const text = res.text || "…";
        if (memoryKey) {
          writeMemory(
            ctx,
            memoryKey,
            [...history, { role: "user", text: data.prompt }, { role: "assistant", text }],
            data.memoryTurns,
          );
        }
        ctx.vars.set(data.variable, clip(text, data.fitDiscord));
        ctx.vars.set(
          `${data.variable}Tools`,
          res.toolCalls.map((c) => c.name),
        );
        ctx.vars.set(`${data.variable}Error`, "");
        return "next";
      } catch (e) {
        return fail(ctx, data.variable, e);
      }
    }),

    defineNode(m.extract, async (ctx, data) => {
      try {
        await prepare(ctx, false);
        const fields = parseFieldList(data.fields);
        if (!fields.length)
          throw new Error("List at least one value to find, like name: what it is");
        const res = await runAgent({
          ...request(ctx, data),
          system:
            "Extract the requested values from the user's text. Use null for anything the text doesn't say. Answer with JSON only.",
          history: [],
          prompt: data.input,
          tools: [],
          maxSteps: 1,
          schema: schemaFor(fields),
        });
        logUsage(ctx, data.model, res);
        const parsed = parseJson(res.text) as Record<string, unknown>;
        const out: Record<string, unknown> = {};
        for (const f of fields) {
          const v = parsed?.[f.name];
          out[f.name] = v === null || v === undefined ? "" : v;
        }
        ctx.vars.set(data.variable, out);
        ctx.vars.set(`${data.variable}Error`, "");
        return "next";
      } catch (e) {
        return fail(ctx, data.variable, e);
      }
    }),

    defineNode(m.check, async (ctx, data) => {
      try {
        await prepare(ctx, false);
        const res = await runAgent({
          ...request(ctx, data),
          system:
            "Answer the question about the user's text. Reply with JSON only: answer is true for yes, false for no, and reason is one short sentence.",
          history: [],
          prompt: `Question: ${data.question}\n\nText:\n${data.input}`,
          tools: [],
          maxSteps: 1,
          schema: {
            type: "object",
            properties: { answer: { type: "boolean" }, reason: { type: "string" } },
            required: ["answer", "reason"],
            additionalProperties: false,
          },
        });
        logUsage(ctx, data.model, res);
        const parsed = parseJson(res.text) as { answer?: unknown; reason?: unknown };
        if (typeof parsed?.answer !== "boolean") throw new Error("The model didn't say yes or no");
        ctx.vars.set(data.variable, String(parsed.reason ?? ""));
        ctx.vars.set(`${data.variable}Error`, "");
        return parsed.answer ? "yes" : "no";
      } catch (e) {
        return fail(ctx, data.variable, e);
      }
    }),
  ],
});
