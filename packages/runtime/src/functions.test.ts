import assert from "node:assert/strict";
import { test } from "node:test";
import { coreNodeMetas } from "@makecord/plugin-core/meta";
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
  assert.deepEqual(seen, ["42", ""]);
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
