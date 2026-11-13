import assert from "node:assert/strict";
import { test } from "node:test";
import { coreNodeMetas } from "@makecord/plugin-core/meta";
import { DEBUG_STOP } from "@makecord/plugin-sdk";
import type { EventFlow, Flow } from "@makecord/spec";
import { type Caller, executeFlow, type FunctionHost } from "./executor.js";
import { coerceArgs, functionInfo, functionsOf } from "./functions.js";
import { inspectProject } from "./inspect.js";
import { loadPlugins } from "./plugins.js";
import type { LoadedFlow, LoadedProject } from "./project.js";
import type { Emit } from "./reporter.js";

const store = {
  get: () => undefined,
  set: () => {},
  delete: () => false,
  increment: () => 0,
  keys: () => [],
};

const double: EventFlow = {
  specVersion: 1,
  kind: "event",
  event: "function",
  function: {
    name: "double",
    description: "Doubles a number",
    params: [{ name: "n", description: "", type: "number", required: true }],
  },
  nodes: [
    { id: "start", type: "core.trigger", position: { x: 0, y: 0 }, data: {} },
    {
      id: "math",
      type: "core.math",
      position: { x: 0, y: 0 },
      data: { left: "{{args.n}}", operator: "multiply", right: "2", variable: "out" },
    },
    { id: "ret", type: "core.return", position: { x: 0, y: 0 }, data: { value: "{{vars.out}}" } },
  ],
  edges: [
    { id: "e1", source: "start", sourceHandle: "next", target: "math" },
    { id: "e2", source: "math", sourceHandle: "next", target: "ret" },
  ],
};

const caller = (fn: string, args: Record<string, string>): Flow => ({
  specVersion: 1,
  kind: "event",
  event: "clientReady",
  nodes: [
    { id: "start", type: "core.trigger", position: { x: 0, y: 0 }, data: {} },
    {
      id: "call",
      type: "core.callFunction",
      position: { x: 0, y: 0 },
      data: { function: fn, args, variable: "result" },
    },
    {
      id: "save",
      type: "core.setVariable",
      position: { x: 0, y: 0 },
      data: { name: "seen", value: "{{vars.result}}|{{vars.resultError}}" },
    },
  ],
  edges: [
    { id: "e1", source: "start", sourceHandle: "next", target: "call" },
    { id: "e2", source: "call", sourceHandle: "next", target: "save" },
    { id: "e3", source: "call", sourceHandle: "failed", target: "save" },
  ],
});

async function runCaller(fn: string, args: Record<string, string>) {
  const { registry } = await loadPlugins(process.cwd(), []);
  const flows: LoadedFlow[] = [{ file: "functions/double.flow.json", flow: double }];
  const events: Parameters<Emit>[0][] = [];
  const emit: Emit = (e) => events.push(e);
  const seen: unknown[] = [];
  const host: FunctionHost = {
    list: () => [...functionsOf(flows).values()].map((f) => functionInfo(f.flow.function)),
    call: async (name, a, from: Caller, depth) => {
      const entry = functionsOf(flows).get(name);
      if (!entry) throw new Error(`Function "${name}" doesn't exist`);
      const res = await executeFlow({
        file: entry.file,
        flow: entry.flow,
        registry,
        base: { ...from, store, scope: { args: coerceArgs(entry.flow.function, a) } },
        env: {},
        emit,
        functions: host,
        depth,
      });
      if (!res.ok) throw new Error(res.error);
      return res.result;
    },
  };
  const res = await executeFlow({
    file: "events/ready.flow.json",
    flow: caller(fn, args),
    registry,
    base: { client: {} as any, eventArgs: [], scope: {}, store },
    env: {},
    emit,
    functions: host,
    beforeNode: async (id, state) => {
      if (id === "save") seen.push(state.vars.get("result"), state.vars.get("resultError"));
    },
  });
  return { res, events, seen };
}

test("a function returns a value to its caller", async () => {
  const { res, seen } = await runCaller("double", { n: "21" });
  assert.equal(res.ok, true);
  assert.deepEqual(seen, [42, ""]);
});

test("a missing argument takes the failed port", async () => {
  const { seen } = await runCaller("double", {});
  assert.equal(seen[0], undefined);
  assert.match(String(seen[1]), /needs the argument "n"/);
});

test("calling an unknown function fails cleanly", async () => {
  const { seen } = await runCaller("nope", {});
  assert.match(String(seen[1]), /doesn't exist/);
});

test("arguments are coerced to their declared types", () => {
  const sig = {
    name: "f",
    description: "",
    params: [
      { name: "a", description: "", type: "number" as const, required: true },
      { name: "b", description: "", type: "boolean" as const, required: false },
    ],
  };
  assert.deepEqual(coerceArgs(sig, { a: "3.5", b: "yes" }), { a: 3.5, b: true });
  assert.deepEqual(coerceArgs(sig, { a: 1 }), { a: 1, b: false });
  assert.throws(() => coerceArgs(sig, { a: "x" }), /has to be a number/);
  assert.deepEqual(coerceArgs(sig, { a: 1, b: "Evet" }), { a: 1, b: true });
  assert.deepEqual(coerceArgs(sig, { a: 1, b: "HAYIR" }), { a: 1, b: false });
  assert.deepEqual(coerceArgs(sig, { a: 1, b: "no" }), { a: 1, b: false });
  assert.throws(() => coerceArgs(sig, { a: 1, b: "maybe" }), /has to be yes or no/);
});

test("inspection checks function names and arguments", () => {
  const project: LoadedProject = {
    dir: "",
    config: { specVersion: 1, name: "t", intents: ["Guilds"], plugins: [], cache: {} } as any,
    flows: [
      { file: "functions/double.flow.json", flow: double },
      { file: "functions/copy.flow.json", flow: double },
      { file: "events/a.flow.json", flow: caller("double", {}) },
      { file: "events/b.flow.json", flow: caller("missing", {}) },
      {
        file: "functions/unnamed.flow.json",
        flow: { ...double, function: undefined },
      },
    ],
    messages: new Map(),
    problems: [],
  };
  const codes = inspectProject(project, coreNodeMetas).map((p) => `${p.file}:${p.code}`);
  assert.ok(codes.includes("functions/copy.flow.json:duplicate-function"));
  assert.ok(codes.includes("events/a.flow.json:missing-argument"));
  assert.ok(codes.includes("events/b.flow.json:missing-function"));
  assert.ok(codes.includes("functions/unnamed.flow.json:missing-function-name"));
  assert.ok(!codes.some((c) => c.startsWith("functions/double.flow.json")));
});

test("Stop Command ends a beforeCommand flow with the stop marker", async () => {
  const { STOP_COMMAND } = await import("@makecord/plugin-sdk");
  const { registry } = await loadPlugins(process.cwd(), []);
  const replies: unknown[] = [];
  const flow: Flow = {
    specVersion: 1,
    kind: "event",
    event: "beforeCommand",
    customId: "mod*",
    nodes: [
      { id: "start", type: "core.trigger", position: { x: 0, y: 0 }, data: {} },
      {
        id: "reply",
        type: "core.reply",
        position: { x: 0, y: 0 },
        data: { content: "Not here", ephemeral: true },
      },
      { id: "stop", type: "core.stopCommand", position: { x: 0, y: 0 }, data: {} },
    ],
    edges: [
      { id: "e1", source: "start", sourceHandle: "next", target: "reply" },
      { id: "e2", source: "reply", sourceHandle: "next", target: "stop" },
    ],
  };
  const res = await executeFlow({
    file: "events/guard.flow.json",
    flow,
    registry,
    base: {
      client: {} as any,
      interaction: {
        replied: false,
        deferred: false,
        reply: async (r: unknown) => void replies.push(r),
      } as any,
      eventArgs: [],
      scope: {},
      store,
    },
    env: {},
    emit: () => {},
  });
  assert.equal(res.ok, true);
  assert.equal(res.result, STOP_COMMAND);
  assert.equal(replies.length, 1);
  const project: LoadedProject = {
    dir: "",
    config: { specVersion: 1, name: "t", intents: ["Guilds"], plugins: [], cache: {} } as any,
    flows: [{ file: "events/guard.flow.json", flow }],
    messages: new Map(),
    problems: [],
  };
  assert.deepEqual(inspectProject(project, coreNodeMetas), []);
});

const fn = (
  name: string,
  nodes: EventFlow["nodes"],
  params = [] as { name: string }[],
): EventFlow => ({
  specVersion: 1,
  kind: "event",
  event: "function",
  function: {
    name,
    description: "",
    params: params.map((p) => ({ name: p.name, description: "", type: "string", required: false })),
  },
  nodes: [{ id: "start", type: "core.trigger", position: { x: 0, y: 0 }, data: {} }, ...nodes],
  edges: nodes.map((n, i) => ({
    id: `e${i}`,
    source: i === 0 ? "start" : nodes[i - 1]!.id,
    sourceHandle: "next",
    target: n.id,
  })),
});

async function callOnce(
  target: EventFlow,
  scope: Record<string, unknown>,
  beforeNode?: () => Promise<void>,
) {
  const { registry } = await loadPlugins(process.cwd(), []);
  const events: Parameters<Emit>[0][] = [];
  const host: FunctionHost = {
    list: () => [functionInfo(target.function!)],
    call: async (_name, a, from, depth) => {
      const res = await executeFlow({
        file: "functions/f.flow.json",
        flow: target,
        registry,
        base: { ...from, store, scope: { ...scope, args: a } },
        env: {},
        emit: (e) => events.push(e),
        functions: host,
        depth,
        beforeNode,
      });
      if (res.stopped) throw Object.assign(new Error(res.error), { code: DEBUG_STOP });
      if (!res.ok) throw new Error(res.error);
      return res.result;
    },
  };
  const seen: unknown[] = [];
  const res = await executeFlow({
    file: "events/ready.flow.json",
    flow: caller(target.function!.name, {}),
    registry,
    base: { client: {} as any, eventArgs: [], scope: {}, store },
    env: {},
    emit: (e) => events.push(e),
    functions: host,
    beforeNode: async (id, state) => {
      if (id === "save") seen.push(state.vars.get("result"), state.vars.get("resultError"));
    },
  });
  return { res, seen, events };
}

test("Return escapes values put into JSON", async () => {
  const ret = fn("info", [
    {
      id: "ret",
      type: "core.return",
      position: { x: 0, y: 0 },
      data: {
        value:
          '{"isStaff": {{vars.staff}}, "name": "{{user.displayName}}", "guild": {{guild.name}}}',
      },
    },
  ]);
  const { seen } = await callOnce(ret, {
    user: { displayName: 'x", "isStaff": true, "z": "' },
    guild: { name: 'My "Best" Server' },
  });
  assert.deepEqual(seen[0], {
    isStaff: null,
    name: 'x", "isStaff": true, "z": "',
    guild: 'My "Best" Server',
  });
});

test("Return gives text back as text and warns about broken JSON", async () => {
  const plain = fn("plain", [
    {
      id: "ret",
      type: "core.return",
      position: { x: 0, y: 0 },
      data: { value: "hi {{user.name}}" },
    },
  ]);
  assert.equal((await callOnce(plain, { user: { name: "Luzi" } })).seen[0], "hi Luzi");
  const broken = fn("broken", [
    {
      id: "ret",
      type: "core.return",
      position: { x: 0, y: 0 },
      data: { value: "{oops {{user.name}}" },
    },
  ]);
  const { seen, events } = await callOnce(broken, { user: { name: "Luzi" } });
  assert.equal(seen[0], "{oops Luzi");
  assert.ok(
    events.some((e) => e.type === "log" && e.level === "warn" && /isn't valid/.test(e.message)),
  );
});

test("stopping in the debugger inside a function stops the caller too", async () => {
  const target = fn("slow", [
    { id: "ret", type: "core.return", position: { x: 0, y: 0 }, data: { value: "x" } },
  ]);
  const { res, seen } = await callOnce(target, {}, async () => {
    throw Object.assign(new Error("Stopped in the debugger"), { code: DEBUG_STOP });
  });
  assert.equal(res.ok, false);
  assert.equal(res.stopped, true);
  assert.deepEqual(seen, []);
});

test("inspection: duplicate parameters and replies in functions called without an interaction", () => {
  const replying = fn(
    "notify",
    [{ id: "reply", type: "core.reply", position: { x: 0, y: 0 }, data: { content: "hi" } }],
    [{ name: "a" }, { name: "a" }],
  );
  const relay = fn("relay", [
    {
      id: "call",
      type: "core.callFunction",
      position: { x: 0, y: 0 },
      data: { function: "notify", args: {}, variable: "result" },
    },
  ]);
  const project = (flows: LoadedFlow[]): LoadedProject => ({
    dir: "",
    config: { specVersion: 1, name: "t", intents: ["Guilds"], plugins: [], cache: {} } as any,
    flows,
    messages: new Map(),
    problems: [],
  });
  const fromEvent = inspectProject(
    project([
      { file: "functions/notify.flow.json", flow: replying },
      { file: "functions/relay.flow.json", flow: relay },
      { file: "events/ready.flow.json", flow: caller("relay", {}) },
    ]),
    coreNodeMetas,
  );
  const codes = fromEvent.map((p) => `${p.file}:${p.code}`);
  assert.ok(codes.includes("functions/notify.flow.json:duplicate-param"));
  const warning = fromEvent.find((p) => p.code === "function-needs-interaction");
  assert.equal(warning?.file, "functions/notify.flow.json");
  assert.equal(warning?.nodeId, "reply");
  assert.equal(warning?.params?.caller, "events/ready.flow.json");

  const command: Flow = {
    specVersion: 1,
    kind: "command",
    command: { type: "chatInput", name: "ping", description: "Ping", options: [] },
    nodes: caller("relay", {}).nodes,
    edges: caller("relay", {}).edges,
  } as Flow;
  const fromCommand = inspectProject(
    project([
      { file: "functions/notify.flow.json", flow: replying },
      { file: "functions/relay.flow.json", flow: relay },
      { file: "commands/ping.flow.json", flow: command },
    ]),
    coreNodeMetas,
  );
  assert.ok(!fromCommand.some((p) => p.code === "function-needs-interaction"));
});

test("Return of a single placeholder or a sentence stays text", async () => {
  const one = fn("one", [
    {
      id: "ret",
      type: "core.return",
      position: { x: 0, y: 0 },
      data: { value: "{{user.name}} and {{user.name}}" },
    },
  ]);
  const { seen, events } = await callOnce(one, { user: { name: "Luzi" } });
  assert.equal(seen[0], "Luzi and Luzi");
  assert.ok(!events.some((e) => e.type === "log" && e.level === "warn"));
});
