import assert from "node:assert/strict";
import { test } from "node:test";
import { parseFieldList } from "./index.js";
import { type AgentTool, parseJson, reasoningModel, runAgent } from "./providers.js";

type Handler = (body: any) => unknown;

function fakeFetch(handlers: Handler[]) {
  const bodies: any[] = [];
  const urls: string[] = [];
  const headers: Record<string, string>[] = [];
  const impl = (async (url: string | URL | Request, init?: RequestInit) => {
    const body = JSON.parse(String(init?.body ?? "{}"));
    bodies.push(body);
    urls.push(String(url));
    headers.push(Object.fromEntries(new Headers(init?.headers).entries()));
    const next = handlers[bodies.length - 1];
    if (!next) throw new Error("unexpected request");
    return new Response(JSON.stringify(next(body)), {
      status: 200,
      headers: { "content-type": "application/json" },
    });
  }) as typeof fetch;
  return { impl, bodies, urls, headers };
}

const double: AgentTool = {
  name: "double",
  description: "Doubles n",
  schema: {
    type: "object",
    properties: { n: { type: "number" } },
    required: ["n"],
    additionalProperties: false,
  },
  run: async (input) => String(Number(input.n) * 2),
};

const base = {
  apiKey: "key",
  model: "",
  system: "Be brief",
  history: [
    { role: "user" as const, text: "hi" },
    { role: "assistant" as const, text: "hello" },
  ],
  prompt: "double 21",
  tools: [double],
  maxTokens: 1000,
  maxSteps: 4,
  effort: "low" as const,
};

const usage = { input_tokens: 10, output_tokens: 5 };
const message = (content: unknown[], stop_reason: string) => ({
  id: "msg_1",
  type: "message",
  role: "assistant",
  model: "claude-opus-5-5",
  content,
  stop_reason,
  stop_sequence: null,
  usage,
});

test("anthropic: runs tools in a loop and keeps the conversation append-only", async () => {
  const f = fakeFetch([
    () =>
      message(
        [
          { type: "thinking", thinking: "", signature: "sig" },
          { type: "tool_use", id: "tu_1", name: "double", input: { n: 21 } },
        ],
        "tool_use",
      ),
    () => message([{ type: "text", text: "It's 42" }], "end_turn"),
  ]);
  const res = await runAgent({ ...base, provider: "anthropic", fetch: f.impl });
  assert.equal(res.text, "It's 42");
  assert.equal(res.steps, 2);
  assert.deepEqual(res.toolCalls, [
    { name: "double", input: { n: 21 }, output: "42", failed: false },
  ]);
  assert.equal(res.inputTokens, 20);
  const [first, second] = f.bodies;
  assert.equal(first.model, "claude-opus-5-5");
  assert.equal(first.system, "Be brief");
  assert.deepEqual(first.output_config, { effort: "low" });
  assert.equal(first.fallbacks, "default");
  assert.match(f.headers[0]!["anthropic-beta"] ?? "", /server-side-fallback-2026-07-01/);
  assert.equal(first.tools[0].name, "double");
  assert.equal(first.temperature, undefined);
  assert.deepEqual(second.messages.slice(0, first.messages.length), first.messages);
  assert.equal(second.messages[3].content[0].type, "thinking");
  assert.deepEqual(second.messages[4].content[0], {
    type: "tool_result",
    tool_use_id: "tu_1",
    content: "42",
  });
});

test("anthropic: a refusal is an error", async () => {
  const f = fakeFetch([() => message([], "refusal")]);
  await assert.rejects(runAgent({ ...base, provider: "anthropic", fetch: f.impl }), /declined/);
});

test("anthropic: a missing key is explained", async () => {
  await assert.rejects(
    runAgent({ ...base, provider: "anthropic", apiKey: undefined }),
    /ANTHROPIC_API_KEY/,
  );
});

test("openai-compatible: tool calls round-trip and failures are reported to the model", async () => {
  const f = fakeFetch([
    () => ({
      choices: [
        {
          finish_reason: "tool_calls",
          message: {
            role: "assistant",
            content: null,
            tool_calls: [
              { id: "c1", type: "function", function: { name: "double", arguments: '{"n":4}' } },
              { id: "c2", type: "function", function: { name: "nope", arguments: "{}" } },
            ],
          },
        },
      ],
      usage: { prompt_tokens: 3, completion_tokens: 2 },
    }),
    () => ({
      choices: [{ finish_reason: "stop", message: { role: "assistant", content: "8" } }],
    }),
  ]);
  const res = await runAgent({ ...base, provider: "groq", model: "some-model", fetch: f.impl });
  assert.equal(res.text, "8");
  assert.equal(f.urls[0], "https://api.groq.com/openai/v1/chat/completions");
  assert.equal(f.headers[0]!.authorization, "Bearer key");
  assert.equal(f.bodies[0].max_tokens, 1000);
  assert.equal(f.bodies[0].messages[0].role, "system");
  const tools = f.bodies[1].messages.filter((m: { role: string }) => m.role === "tool");
  assert.deepEqual(
    tools.map((m: { content: string }) => m.content),
    ["8", "There's no tool called nope"],
  );
  assert.equal(res.toolCalls[1]!.failed, true);
});

test("openai-compatible: a model name is required", async () => {
  await assert.rejects(runAgent({ ...base, provider: "openai" }), /Pick a model/);
});

test("openai uses max_completion_tokens and reasoning effort", async () => {
  const f = fakeFetch([
    () => ({
      choices: [{ finish_reason: "length", message: { role: "assistant", content: "x" } }],
    }),
  ]);
  const res = await runAgent({
    ...base,
    provider: "openai",
    model: "gpt-5",
    tools: [],
    fetch: f.impl,
  });
  assert.equal(f.bodies[0].max_completion_tokens, 1000);
  assert.equal(f.bodies[0].reasoning_effort, "low");
  assert.equal(res.truncated, "max_tokens");
});

test("reasoning effort is left out for openai models that don't reason", async () => {
  const f = fakeFetch([
    () => ({ choices: [{ finish_reason: "stop", message: { role: "assistant", content: "x" } }] }),
  ]);
  await runAgent({ ...base, provider: "openai", model: "gpt-4o-mini", tools: [], fetch: f.impl });
  assert.equal("reasoning_effort" in f.bodies[0], false);
  assert.equal(reasoningModel("o4-mini"), true);
  assert.equal(reasoningModel("gpt-6.1"), true);
  assert.equal(reasoningModel("gpt-4.1"), false);
});

test("a model that rejects reasoning effort is asked again without it", async () => {
  const bodies: any[] = [];
  const impl = (async (_url: unknown, init?: RequestInit) => {
    const body = JSON.parse(String(init?.body));
    bodies.push(body);
    if ("reasoning_effort" in body) {
      return new Response(
        JSON.stringify({
          error: { message: "Unsupported parameter: 'reasoning_effort' is not supported" },
        }),
        { status: 400, headers: { "content-type": "application/json" } },
      );
    }
    return new Response(
      JSON.stringify({
        choices: [{ finish_reason: "stop", message: { role: "assistant", content: "ok" } }],
      }),
      { headers: { "content-type": "application/json" } },
    );
  }) as typeof fetch;
  const res = await runAgent({
    ...base,
    provider: "openai",
    model: "gpt-5",
    tools: [],
    fetch: impl,
  });
  assert.equal(bodies.length, 2);
  assert.equal(res.text, "ok");
});

test("the step limit stops a looping agent", async () => {
  const loop = () =>
    message([{ type: "tool_use", id: "t", name: "double", input: { n: 1 } }], "tool_use");
  const f = fakeFetch([loop, loop]);
  const res = await runAgent({ ...base, provider: "anthropic", maxSteps: 2, fetch: f.impl });
  assert.equal(res.steps, 2);
  assert.equal(res.truncated, "max_steps");
});

test("JSON answers are parsed even inside code fences", () => {
  assert.deepEqual(parseJson('```json\n{"a":1}\n```'), { a: 1 });
  assert.deepEqual(parseJson('Sure: {"a":2} ok'), { a: 2 });
  assert.throws(() => parseJson("no"), /valid JSON/);
});

test("value lists support types", () => {
  assert.deepEqual(
    parseFieldList("amount: how much (number)\nurgent: is it urgent (yes/no)\nbad line!\nname"),
    [
      { name: "amount", description: "how much", type: "number" },
      { name: "urgent", description: "is it urgent", type: "boolean" },
      { name: "name", description: "", type: "string" },
    ],
  );
});
