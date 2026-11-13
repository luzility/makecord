import Anthropic from "@anthropic-ai/sdk";
import { PROVIDERS, type ProviderId } from "./presets.js";

export { PROVIDER_IDS, PROVIDERS, type ProviderId } from "./presets.js";

export const DEFAULT_ANTHROPIC_MODEL = "claude-opus-5-5";

const FALLBACK_MODELS = new Set([
  "claude-fable-5-1",
  "claude-opus-5-5",
  "claude-opus-5",
  "claude-sonnet-5-5",
]);

export type Effort = "default" | "low" | "medium" | "high";

export interface Turn {
  role: "user" | "assistant";
  text: string;
}

export interface AgentTool {
  name: string;
  description: string;
  schema: Record<string, unknown>;
  run(input: Record<string, unknown>): Promise<string>;
}

export interface AgentRequest {
  provider: ProviderId;
  apiKey: string | undefined;
  baseUrl?: string;
  model: string;
  system: string;
  history: readonly Turn[];
  prompt: string;
  tools: readonly AgentTool[];
  maxTokens: number;
  maxSteps: number;
  effort: Effort;
  schema?: Record<string, unknown>;
  fetch?: typeof fetch;
}

export interface ToolCall {
  name: string;
  input: Record<string, unknown>;
  output: string;
  failed: boolean;
}

export interface AgentResult {
  text: string;
  steps: number;
  toolCalls: ToolCall[];
  inputTokens: number;
  outputTokens: number;
  truncated: false | "max_tokens" | "max_steps";
}

export class AiError extends Error {}

async function runTool(
  tools: readonly AgentTool[],
  name: string,
  input: unknown,
): Promise<ToolCall> {
  const args = input && typeof input === "object" ? (input as Record<string, unknown>) : {};
  const tool = tools.find((t) => t.name === name);
  if (!tool) return { name, input: args, output: `There's no tool called ${name}`, failed: true };
  try {
    return { name, input: args, output: await tool.run(args), failed: false };
  } catch (e) {
    return { name, input: args, output: (e as Error).message, failed: true };
  }
}

export function resolveModel(provider: ProviderId, model: string): string {
  const m = model.trim();
  if (m) return m;
  if (provider === "anthropic") return DEFAULT_ANTHROPIC_MODEL;
  throw new AiError(`Pick a model for ${PROVIDERS[provider].label}`);
}

async function runAnthropic(req: AgentRequest): Promise<AgentResult> {
  if (!req.apiKey) throw new AiError("ANTHROPIC_API_KEY isn't set. Add it in Secrets");
  const client = new Anthropic({
    apiKey: req.apiKey,
    baseURL: req.baseUrl?.trim() || undefined,
    timeout: 600_000,
    maxRetries: 1,
    fetch: req.fetch,
  });
  const model = resolveModel("anthropic", req.model);
  const fallback = FALLBACK_MODELS.has(model) && !req.baseUrl?.trim();
  const tools: Anthropic.Beta.BetaTool[] = req.tools.map((t) => ({
    name: t.name,
    description: t.description,
    input_schema: t.schema as Anthropic.Beta.BetaTool.InputSchema,
  }));
  const messages: Anthropic.Beta.BetaMessageParam[] = [
    ...req.history.map((t) => ({ role: t.role, content: t.text })),
    { role: "user", content: req.prompt },
  ];
  const result: AgentResult = {
    text: "",
    steps: 0,
    toolCalls: [],
    inputTokens: 0,
    outputTokens: 0,
    truncated: false,
  };
  const outputConfig: Anthropic.Beta.BetaOutputConfig = {};
  if (req.effort !== "default") outputConfig.effort = req.effort;
  if (req.schema) outputConfig.format = { type: "json_schema", schema: req.schema };

  while (result.steps < req.maxSteps) {
    result.steps++;
    const res = await client.beta.messages.create({
      model,
      max_tokens: req.maxTokens,
      system: req.system || undefined,
      messages,
      tools: tools.length ? tools : undefined,
      output_config: Object.keys(outputConfig).length ? outputConfig : undefined,
      ...(fallback ? { betas: ["server-side-fallback-2026-07-01"], fallbacks: "default" } : {}),
    });
    result.inputTokens += res.usage.input_tokens;
    result.outputTokens += res.usage.output_tokens;
    if (res.stop_reason === "refusal") {
      throw new AiError("The model declined to answer this");
    }
    messages.push({ role: "assistant", content: res.content });
    const text = res.content
      .filter((b): b is Anthropic.Beta.BetaTextBlock => b.type === "text")
      .map((b) => b.text)
      .join("");
    if (text.trim()) result.text = text.trim();
    if (res.stop_reason === "pause_turn") continue;
    const uses = res.content.filter(
      (b): b is Anthropic.Beta.BetaToolUseBlock => b.type === "tool_use",
    );
    if (res.stop_reason !== "tool_use" || !uses.length) {
      result.truncated = res.stop_reason === "max_tokens" ? "max_tokens" : false;
      return result;
    }
    const calls = await Promise.all(uses.map((u) => runTool(req.tools, u.name, u.input)));
    result.toolCalls.push(...calls);
    messages.push({
      role: "user",
      content: calls.map((c, i) => ({
        type: "tool_result" as const,
        tool_use_id: uses[i]!.id,
        content: c.output,
        is_error: c.failed || undefined,
      })),
    });
  }
  result.truncated = "max_steps";
  return result;
}

interface ChatMessage {
  role: "system" | "user" | "assistant" | "tool";
  content: string | null;
  tool_calls?: { id: string; type: "function"; function: { name: string; arguments: string } }[];
  tool_call_id?: string;
}

interface ChatResponse {
  choices?: { message: ChatMessage; finish_reason: string }[];
  usage?: { prompt_tokens?: number; completion_tokens?: number };
  error?: { message?: string } | string;
}

const COMPATIBLE_TIMEOUT = 300_000;

export function reasoningModel(model: string): boolean {
  const name = model.trim().toLowerCase().split("/").pop() ?? "";
  if (/^o\d/.test(name)) return true;
  const gpt = name.match(/^gpt-(\d+)/);
  return gpt ? Number(gpt[1]) >= 5 : false;
}

function parseArguments(raw: string): Record<string, unknown> {
  try {
    const v = JSON.parse(raw || "{}");
    return v && typeof v === "object" ? v : {};
  } catch {
    return {};
  }
}

async function runCompatible(req: AgentRequest): Promise<AgentResult> {
  const preset = PROVIDERS[req.provider];
  const base = (req.baseUrl?.trim() || preset.baseUrl).replace(/\/+$/, "");
  if (!base) throw new AiError("Set the base URL of your OpenAI-compatible server");
  if (preset.secret && !req.apiKey) {
    throw new AiError(`${preset.secret} isn't set. Add it in Secrets`);
  }
  const model = resolveModel(req.provider, req.model);
  const doFetch = req.fetch ?? fetch;
  const messages: ChatMessage[] = [
    ...(req.system ? [{ role: "system" as const, content: req.system }] : []),
    ...req.history.map((t) => ({ role: t.role, content: t.text })),
    { role: "user", content: req.prompt },
  ];
  const tools = req.tools.map((t) => ({
    type: "function",
    function: { name: t.name, description: t.description, parameters: t.schema },
  }));
  const result: AgentResult = {
    text: "",
    steps: 0,
    toolCalls: [],
    inputTokens: 0,
    outputTokens: 0,
    truncated: false,
  };

  while (result.steps < req.maxSteps) {
    result.steps++;
    const body: Record<string, unknown> = {
      model,
      messages,
      [req.provider === "openai" ? "max_completion_tokens" : "max_tokens"]: req.maxTokens,
    };
    if (tools.length) body.tools = tools;
    if (req.effort !== "default" && req.provider === "openai" && reasoningModel(model)) {
      body.reasoning_effort = req.effort;
    }
    if (req.schema) {
      body.response_format = {
        type: "json_schema",
        json_schema: { name: "result", schema: req.schema, strict: true },
      };
    }
    const send = async () => {
      const res = await doFetch(`${base}/chat/completions`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          ...(req.apiKey ? { authorization: `Bearer ${req.apiKey}` } : {}),
        },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(COMPATIBLE_TIMEOUT),
      });
      const data = (await res.json().catch(() => ({}))) as ChatResponse;
      const detail = typeof data.error === "string" ? data.error : data.error?.message;
      return { res, data, detail };
    };
    let { res, data, detail } = await send();
    if (res.status === 400 && "reasoning_effort" in body && /reasoning/i.test(detail ?? "")) {
      delete body.reasoning_effort;
      ({ res, data, detail } = await send());
    }
    if (!res.ok) {
      throw new AiError(`${preset.label} answered ${res.status}${detail ? `: ${detail}` : ""}`);
    }
    result.inputTokens += data.usage?.prompt_tokens ?? 0;
    result.outputTokens += data.usage?.completion_tokens ?? 0;
    const choice = data.choices?.[0];
    if (!choice) throw new AiError(`${preset.label} sent an empty answer`);
    const msg = choice.message;
    if (msg.content?.trim()) result.text = msg.content.trim();
    messages.push({ role: "assistant", content: msg.content ?? null, tool_calls: msg.tool_calls });
    if (!msg.tool_calls?.length) {
      result.truncated = choice.finish_reason === "length" ? "max_tokens" : false;
      return result;
    }
    const calls = await Promise.all(
      msg.tool_calls.map((c) =>
        runTool(req.tools, c.function.name, parseArguments(c.function.arguments)),
      ),
    );
    result.toolCalls.push(...calls);
    msg.tool_calls.forEach((c, i) => {
      messages.push({ role: "tool", tool_call_id: c.id, content: calls[i]!.output });
    });
  }
  result.truncated = "max_steps";
  return result;
}

export function runAgent(req: AgentRequest): Promise<AgentResult> {
  return req.provider === "anthropic" ? runAnthropic(req) : runCompatible(req);
}

export function parseJson(text: string): unknown {
  const trimmed = text.trim();
  const fenced = trimmed.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/);
  const body = fenced ? fenced[1]! : trimmed;
  try {
    return JSON.parse(body);
  } catch {
    const start = body.indexOf("{");
    const end = body.lastIndexOf("}");
    if (start >= 0 && end > start) {
      try {
        return JSON.parse(body.slice(start, end + 1));
      } catch {}
    }
    throw new AiError("The model didn't answer with valid JSON");
  }
}

export function describeError(e: unknown): string {
  if (e instanceof Anthropic.AuthenticationError) return "Anthropic rejected the API key";
  if (e instanceof Anthropic.PermissionDeniedError)
    return "This API key can't use that model or feature";
  if (e instanceof Anthropic.NotFoundError) return "Anthropic doesn't know that model";
  if (e instanceof Anthropic.RateLimitError)
    return "Too many requests to Anthropic, try again soon";
  if (e instanceof Anthropic.BadRequestError) return `Anthropic refused the request: ${e.message}`;
  if (e instanceof Anthropic.APIConnectionTimeoutError) return "Anthropic took too long to answer";
  if (e instanceof Anthropic.APIConnectionError) return "Couldn't reach Anthropic";
  if (e instanceof Anthropic.APIError) return `Anthropic answered ${e.status}: ${e.message}`;
  if ((e as Error)?.name === "TimeoutError") return "The AI server took too long to answer";
  return (e as Error)?.message ?? String(e);
}
