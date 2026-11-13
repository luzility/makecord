import assert from "node:assert/strict";
import { test } from "node:test";
import type { NodeContext, StoredValue } from "@makecord/plugin-sdk";
import plugin from "./index.js";

function ctx(secrets: Record<string, string>) {
  const data = new Map<string, StoredValue>();
  const vars = new Map<string, unknown>();
  const calls: { name: string; args: Record<string, unknown> }[] = [];
  const logs: string[] = [];
  const extra = { render: (template: string) => template };
  const c: NodeContext = {
    ...extra,
    client: {} as never,
    eventArgs: [],
    scope: {},
    vars,
    nodeId: "n",
    store: {
      get: (k) => data.get(k),
      set: (k, v) => void data.set(k, v),
      delete: (k) => data.delete(k),
      increment: () => 0,
      keys: () => [...data.keys()],
    },
    message: () => ({}),
    secret: (n) => secrets[n],
    log: (_l, m) => void logs.push(m),
    functions: () => [
      {
        name: "level_of",
        description: "Level of a user",
        params: [{ name: "user", description: "", type: "string", required: true }],
      },
      { name: "ban", description: "Bans", params: [] },
    ],
    callFunction: async (name, args) => {
      calls.push({ name, args });
      return { level: 7 };
    },
    setResult: () => {},
  };
  return { c, vars, data, calls, logs };
}

const node = (type: string) => plugin.nodes.find((n) => n.meta.type === type)!;

function withFetch(answers: unknown[], fn: (bodies: any[]) => Promise<void>) {
  const original = globalThis.fetch;
  const bodies: any[] = [];
  globalThis.fetch = (async (_url: unknown, init?: RequestInit) => {
    bodies.push(JSON.parse(String(init?.body)));
    return new Response(JSON.stringify(answers[bodies.length - 1]), {
      headers: { "content-type": "application/json" },
    });
  }) as typeof fetch;
  return fn(bodies).finally(() => {
    globalThis.fetch = original;
  });
}

const chat = (content: string | null, tool_calls?: unknown[], finish?: string) => ({
  choices: [
    {
      finish_reason: finish ?? (tool_calls ? "tool_calls" : "stop"),
      message: { role: "assistant", content, tool_calls },
    },
  ],
});

test("the agent only gets the functions it lists, and remembers the conversation", async () => {
  const { c, vars, data, calls } = ctx({ GROQ_API_KEY: "k" });
  const agent = node("ai.agent");
  const fields = agent.meta.fields.parse({
    prompt: "what level am I",
    tools: "level_of",
    provider: "groq",
    model: "m",
    memory: "chan",
  });
  await withFetch(
    [
      chat(null, [
        { id: "1", type: "function", function: { name: "level_of", arguments: '{"user":"42"}' } },
      ]),
      chat("You're level 7"),
      chat("Still 7"),
    ],
    async (bodies) => {
      assert.equal(await agent.run(c, fields), "next");
      assert.deepEqual(
        bodies[0].tools.map((t: { function: { name: string } }) => t.function.name),
        ["level_of"],
      );
      assert.deepEqual(calls, [{ name: "level_of", args: { user: "42" } }]);
      assert.equal(vars.get("answer"), "You're level 7");
      assert.deepEqual(vars.get("answerTools"), ["level_of"]);
      assert.equal(await agent.run(c, { ...fields, prompt: "and now?", tools: "" }), "next");
      const sent = bodies[2].messages.map(
        (m: { role: string; content: string }) => `${m.role}:${m.content}`,
      );
      assert.deepEqual(sent.slice(1), [
        "user:what level am I",
        "assistant:You're level 7",
        "user:and now?",
      ]);
      assert.equal(bodies[2].tools, undefined);
    },
  );
  assert.equal(JSON.parse(String(data.get("ai.memory:chan"))).length, 4);
});

test("check takes the yes or no port and saves the reason", async () => {
  const { c, vars } = ctx({ OPENAI_API_KEY: "k" });
  const check = node("ai.check");
  const fields = check.meta.fields.parse({ input: "free nitro", provider: "openai", model: "m" });
  await withFetch([chat('{"answer":true,"reason":"Looks like a scam"}')], async (bodies) => {
    assert.equal(await check.run(c, fields), "yes");
    assert.equal(bodies[0].response_format.type, "json_schema");
  });
  assert.equal(vars.get("reason"), "Looks like a scam");
});

test("extract fills a variable object and failures go to the failed port", async () => {
  const { c, vars } = ctx({ GEMINI_API_KEY: "k" });
  const extract = node("ai.extract");
  const fields = extract.meta.fields.parse({
    input: "Pay 30 dollars tomorrow",
    fields: "amount: money (number)\nwhen: the date",
    provider: "gemini",
    model: "m",
  });
  await withFetch([chat('{"amount":30,"when":null}')], async () => {
    assert.equal(await extract.run(c, fields), "next");
  });
  assert.deepEqual(vars.get("data"), { amount: 30, when: "" });
  const none = ctx({});
  assert.equal(await extract.run(none.c, fields), "failed");
  assert.match(String(none.vars.get("dataError")), /GEMINI_API_KEY/);
});

test("secrets are declared for every provider", () => {
  assert.ok(plugin.permissions?.includes("secrets:ANTHROPIC_API_KEY"));
  assert.ok(plugin.permissions?.includes("secrets:OPENROUTER_API_KEY"));
});

const callLevel = () =>
  chat(null, [{ id: "1", type: "function", function: { name: "level_of", arguments: "{}" } }]);

test("an answer cut off before any text leaves through failed and says why", async () => {
  const { c, vars } = ctx({ GROQ_API_KEY: "k" });
  const generate = node("ai.generate");
  const fields = generate.meta.fields.parse({ prompt: "hi", provider: "groq", model: "m" });
  await withFetch([chat(null, undefined, "length")], async () => {
    assert.equal(await generate.run(c, fields), "failed");
  });
  assert.match(String(vars.get("answerError")), /Max tokens/);
});

test("a cut-off answer with some text is kept with a warning", async () => {
  const { c, vars, logs } = ctx({ GROQ_API_KEY: "k" });
  const generate = node("ai.generate");
  const fields = generate.meta.fields.parse({ prompt: "hi", provider: "groq", model: "m" });
  await withFetch([chat("Half an ans", undefined, "length")], async () => {
    assert.equal(await generate.run(c, fields), "next");
  });
  assert.equal(vars.get("answer"), "Half an ans");
  assert.ok(logs.some((l) => /Max tokens/.test(l)));
});

test("an agent that runs out of tool rounds fails and doesn't touch memory", async () => {
  const { c, vars, data } = ctx({ GROQ_API_KEY: "k" });
  const agent = node("ai.agent");
  const fields = agent.meta.fields.parse({
    prompt: "loop",
    tools: "level_of",
    provider: "groq",
    model: "m",
    memory: "chan",
    maxSteps: 2,
  });
  await withFetch([callLevel(), callLevel()], async () => {
    assert.equal(await agent.run(c, fields), "failed");
  });
  assert.match(String(vars.get("answerError")), /Max tool rounds/);
  assert.equal(data.get("ai.memory:chan"), undefined);
});

test("two agent runs in one channel at once both stay in memory", async () => {
  const { c, data } = ctx({ GROQ_API_KEY: "k" });
  const agent = node("ai.agent");
  const fields = agent.meta.fields.parse({ provider: "groq", model: "m", memory: "chan" });
  const original = globalThis.fetch;
  const waiting: ((r: Response) => void)[] = [];
  globalThis.fetch = (() => new Promise<Response>((r) => waiting.push(r))) as typeof fetch;
  try {
    const a = agent.run(c, { ...fields, prompt: "from A" });
    const b = agent.run(c, { ...fields, prompt: "from B" });
    while (waiting.length < 2) await new Promise((r) => setImmediate(r));
    const answer = (text: string) =>
      new Response(JSON.stringify(chat(text)), { headers: { "content-type": "application/json" } });
    waiting[0]!(answer("to A"));
    assert.equal(await a, "next");
    waiting[1]!(answer("to B"));
    assert.equal(await b, "next");
  } finally {
    globalThis.fetch = original;
  }
  const turns = JSON.parse(String(data.get("ai.memory:chan"))) as { text: string }[];
  assert.deepEqual(
    turns.map((t) => t.text),
    ["from A", "to A", "from B", "to B"],
  );
});

test("check and extract handle a message with no text", async () => {
  const { c, vars } = ctx({ OPENAI_API_KEY: "k" });
  const check = node("ai.check");
  const checkFields = check.meta.fields.parse({ input: "", provider: "openai", model: "m" });
  assert.equal(await check.run(c, checkFields), "no");
  assert.equal(vars.get("reason"), "No text to check");
  const extract = node("ai.extract");
  const extractFields = extract.meta.fields.parse({ input: " ", provider: "openai", model: "m" });
  assert.equal(await extract.run(c, extractFields), "failed");
  assert.equal(vars.get("dataError"), "No text to extract from");
});

test("extract names the token limit when the JSON was cut off", async () => {
  const { c, vars } = ctx({ OPENAI_API_KEY: "k" });
  const extract = node("ai.extract");
  const fields = extract.meta.fields.parse({ input: "text", provider: "openai", model: "m" });
  await withFetch([chat('{"summary":"half', undefined, "length")], async () => {
    assert.equal(await extract.run(c, fields), "failed");
  });
  assert.match(String(vars.get("dataError")), /Max tokens before the JSON/);
});
