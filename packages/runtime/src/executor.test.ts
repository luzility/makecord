import assert from "node:assert/strict";
import { dirname, join } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import { executeFlow } from "./executor.js";
import { loadPlugins } from "./plugins.js";
import { loadProject } from "./project.js";
import type { Emit } from "./reporter.js";

function memoryStore() {
  const data = new Map<string, string | number | boolean>();
  return {
    get: (k: string) => data.get(k),
    set: (k: string, v: string | number | boolean) => void data.set(k, v),
    delete: (k: string) => data.delete(k),
    increment: (k: string, by: number) => {
      const next = Number(data.get(k) ?? 0) + by;
      data.set(k, next);
      return next;
    },
    keys: () => [...data.keys()],
  };
}

const starter = join(dirname(fileURLToPath(import.meta.url)), "../../templates/starter");

function fakeInteraction() {
  const replies: { content: string; flags?: number }[] = [];
  return {
    replies,
    interaction: {
      replied: false,
      deferred: false,
      reply: async (r: (typeof replies)[0]) => void replies.push(r),
    },
  };
}

async function run(flowFile: string, scope: Record<string, unknown>) {
  const project = await loadProject(starter);
  const { registry } = await loadPlugins(starter, []);
  const entry = project.flows.find((f) => f.file === flowFile);
  assert.ok(entry, `${flowFile} should load`);
  const { replies, interaction } = fakeInteraction();
  const events: Parameters<Emit>[0][] = [];
  await executeFlow({
    file: entry.file,
    flow: entry.flow,
    registry,
    base: {
      client: {} as any,
      interaction: interaction as any,
      eventArgs: [],
      scope,
      store: memoryStore(),
    },
    env: {},
    emit: (e) => events.push(e),
  });
  return { replies, events };
}

test("starter template loads without problems", async () => {
  const project = await loadProject(starter);
  assert.deepEqual(project.problems, []);
  assert.equal(project.flows.length, 3);
});

test("/greet with a target takes the true branch", async () => {
  const { replies } = await run("commands/greet.flow.json", {
    user: { displayName: "Luzi" },
    options: { user: "123" },
  });
  assert.equal(replies.length, 1);
  assert.match(replies[0]!.content, /<@123>, Luzi says hi/);
});

test("/greet without a target replies ephemerally", async () => {
  const { replies } = await run("commands/greet.flow.json", {
    user: { displayName: "Luzi" },
    options: {},
  });
  assert.equal(replies[0]!.content, "Hey Luzi, welcome to the server");
  assert.equal(replies[0]!.flags, 64);
});

test("errors are reported with the failing node", async () => {
  const project = await loadProject(starter);
  const { registry } = await loadPlugins(starter, []);
  const flow = project.flows.find((f) => f.file === "commands/ping.flow.json")!.flow;
  const events: Parameters<Emit>[0][] = [];
  await executeFlow({
    file: "ping",
    flow,
    registry,
    base: { client: {} as any, eventArgs: [], scope: {}, store: memoryStore() },
    env: {},
    emit: (e) => events.push(e),
  });
  const err = events.find((e) => e.type === "flow" && e.phase === "error");
  assert.ok(err && err.type === "flow" && err.nodeId === "reply");
});

test("inspection flags wrong context and missing intents", async () => {
  const { inspectProject } = await import("./inspect.js");
  const { coreNodeMetas } = await import("@makecord/plugin-core/meta");
  const project = await loadProject(starter);
  assert.deepEqual(inspectProject(project, coreNodeMetas), []);
  project.flows.push({
    file: "events/welcome.flow.json",
    flow: {
      specVersion: 1,
      kind: "event",
      event: "guildMemberAdd",
      nodes: [
        { id: "s", type: "core.trigger", position: { x: 0, y: 0 }, data: {} },
        { id: "r", type: "core.reply", position: { x: 0, y: 0 }, data: { content: "hi" } },
      ],
      edges: [{ id: "e", source: "s", sourceHandle: "next", target: "r" }],
    },
  });
  const codes = inspectProject(project, coreNodeMetas)
    .map((p) => p.code)
    .sort();
  assert.deepEqual(codes, ["missing-intent", "needs-interaction"]);
});

test("interaction events may reply, schedule flows need a time", async () => {
  const { inspectProject } = await import("./inspect.js");
  const { coreNodeMetas } = await import("@makecord/plugin-core/meta");
  const project = await loadProject(starter);
  const nodes = [
    { id: "s", type: "core.trigger", position: { x: 0, y: 0 }, data: {} },
    { id: "r", type: "core.reply", position: { x: 0, y: 0 }, data: { content: "hi" } },
  ];
  const edges = [{ id: "e", source: "s", sourceHandle: "next", target: "r" }];
  project.flows.push(
    {
      file: "events/button.flow.json",
      flow: {
        specVersion: 1,
        kind: "event",
        event: "buttonClick",
        customId: "vote:*",
        nodes,
        edges,
      },
    },
    {
      file: "events/tick.flow.json",
      flow: { specVersion: 1, kind: "event", event: "schedule", nodes: [nodes[0]!], edges: [] },
    },
  );
  const codes = inspectProject(project, coreNodeMetas).map((p) => `${p.file}:${p.code}`);
  assert.deepEqual(codes, ["events/tick.flow.json:missing-schedule"]);
});

function flowOf(
  nodes: { id: string; type: string; data?: Record<string, unknown> }[],
  edges: [string, string, string?][],
) {
  return {
    specVersion: 1 as const,
    kind: "event" as const,
    event: "clientReady" as const,
    nodes: nodes.map((n) => ({ ...n, position: { x: 0, y: 0 }, data: n.data ?? {} })),
    edges: edges.map(([source, target, sourceHandle = "next"], i) => ({
      id: `e${i}`,
      source,
      target,
      sourceHandle,
    })),
  };
}

test("data blocks: repeat, math, store and text", async () => {
  const { registry } = await loadPlugins(starter, []);
  const store = memoryStore();
  const logs: string[] = [];
  const flow = flowOf(
    [
      { id: "s", type: "core.trigger" },
      { id: "loop", type: "core.repeat", data: { times: "3", indexVariable: "i" } },
      {
        id: "inc",
        type: "core.storeIncrement",
        data: { key: "count", by: "{{vars.i}}", variable: "total" },
      },
      {
        id: "sq",
        type: "core.math",
        data: { operator: "power", left: "{{vars.total}}", right: "2", variable: "sq" },
      },
      {
        id: "up",
        type: "core.text",
        data: { operation: "uppercase", input: "done", variable: "word" },
      },
      {
        id: "log",
        type: "core.log",
        data: { level: "info", message: "{{vars.word}} {{vars.total}} {{vars.sq}}" },
      },
    ],
    [
      ["s", "loop"],
      ["loop", "inc", "loop"],
      ["inc", "loop"],
      ["loop", "sq", "done"],
      ["sq", "up"],
      ["up", "log"],
    ],
  );
  const events: Parameters<Emit>[0][] = [];
  await executeFlow({
    file: "t",
    flow,
    registry,
    base: { client: {} as any, eventArgs: [], scope: {}, store },
    env: {},
    emit: (e) => {
      events.push(e);
      if (e.type === "log") logs.push(e.message);
    },
  });
  assert.equal(store.get("count"), 6);
  assert.ok(logs.includes("DONE 6 36"), JSON.stringify(events));
});

test("an empty required field is reported as empty, with the field name", async () => {
  const { inspectProject } = await import("./inspect.js");
  const { coreNodeMetas } = await import("@makecord/plugin-core/meta");
  const project = await loadProject(starter);
  project.flows.push({
    file: "events/join.flow.json",
    flow: {
      specVersion: 1,
      kind: "event",
      event: "clientReady",
      nodes: [
        { id: "s", type: "core.trigger", position: { x: 0, y: 0 }, data: {} },
        {
          id: "r",
          type: "core.addRole",
          position: { x: 0, y: 0 },
          data: { roleId: "", userId: "1" },
        },
      ],
      edges: [{ id: "e", source: "s", sourceHandle: "next", target: "r" }],
    },
  });
  const field = inspectProject(project, coreNodeMetas).find((p) => p.code === "invalid-field");
  assert.equal(field?.params?.field, "roleId");
  assert.equal(field?.params?.empty, "true");
});

test("a plugin that can't be loaded is reported, and core still loads", async () => {
  const { registry, plugins } = await loadPlugins(starter, ["makecord-plugin-does-not-exist"]);
  assert.ok(registry.has("core.reply"));
  const missing = plugins.find((p) => p.name === "makecord-plugin-does-not-exist");
  assert.equal(missing?.loaded, false);
  assert.ok(missing?.error);
  assert.equal(plugins.find((p) => p.name === "core")?.compatible, true);
});

test("message designs: missing ones and buttons nobody handles are reported", async () => {
  const { inspectProject } = await import("./inspect.js");
  const { coreNodeMetas } = await import("@makecord/plugin-core/meta");
  const { MessageDesign } = await import("@makecord/spec");
  const project = await loadProject(starter);
  project.messages.set("poll", {
    file: "messages/poll.message.json",
    name: "poll",
    design: MessageDesign.parse({
      specVersion: 1,
      kind: "classic",
      content: "Vote",
      components: [
        {
          type: "row",
          components: [
            { type: "button", label: "Yes", customId: "vote:yes" },
            { type: "button", label: "Info", customId: "info" },
          ],
        },
      ],
    }),
  });
  const trigger = { id: "s", type: "core.trigger", position: { x: 0, y: 0 }, data: {} };
  project.flows.push(
    {
      file: "events/vote.flow.json",
      flow: {
        specVersion: 1,
        kind: "event",
        event: "buttonClick",
        customId: "vote:*",
        nodes: [trigger],
        edges: [],
      },
    },
    {
      file: "events/ready2.flow.json",
      flow: {
        specVersion: 1,
        kind: "event",
        event: "clientReady",
        nodes: [
          trigger,
          {
            id: "m",
            type: "core.sendMessage",
            position: { x: 0, y: 0 },
            data: { channelId: "1", content: "", message: "nope" },
          },
        ],
        edges: [{ id: "e", source: "s", sourceHandle: "next", target: "m" }],
      },
    },
  );
  const found = inspectProject(project, coreNodeMetas).map(
    (p) => `${p.code}:${p.params?.customId ?? p.params?.name ?? ""}`,
  );
  assert.deepEqual(found.sort(), ["missing-message:nope", "unhandled-component:info"]);
});

test("loops, cooldowns and timestamps", async () => {
  const { registry } = await loadPlugins(starter, []);
  const logs: string[] = [];
  const flow = flowOf(
    [
      { id: "s", type: "core.trigger" },
      {
        id: "each",
        type: "core.forEach",
        data: { list: "a\nb\nc", itemVariable: "item", indexVariable: "i" },
      },
      { id: "cd", type: "core.cooldown", data: { seconds: "60", key: "same", variable: "left" } },
      {
        id: "ok",
        type: "core.log",
        data: { level: "info", message: "ok {{vars.i}} {{vars.item}}" },
      },
      { id: "wait", type: "core.log", data: { level: "info", message: "cooling {{vars.i}}" } },
      {
        id: "ts",
        type: "core.timestamp",
        data: { time: "2026-01-01T00:00:00Z", addMinutes: "60", style: "relative", variable: "t" },
      },
      { id: "end", type: "core.log", data: { level: "info", message: "{{vars.t}}" } },
    ],
    [
      ["s", "each"],
      ["each", "cd", "loop"],
      ["cd", "ok", "next"],
      ["cd", "wait", "cooling"],
      ["ok", "each"],
      ["wait", "each"],
      ["each", "ts", "done"],
      ["ts", "end"],
    ],
  );
  await executeFlow({
    file: "t",
    flow,
    registry,
    base: { client: {} as any, eventArgs: [], scope: {}, store: memoryStore() },
    env: {},
    emit: (e) => {
      if (e.type === "log") logs.push(e.message);
      if (e.type === "flow" && e.phase === "error") logs.push(`ERR ${e.error}`);
    },
  });
  assert.deepEqual(logs, [
    "ok 1 a",
    "cooling 2",
    "cooling 3",
    `<t:${Date.parse("2026-01-01T01:00:00Z") / 1000}:R>`,
  ]);
});

test("inspection: subcommand conflicts and event-only blocks", async () => {
  const { inspectProject } = await import("./inspect.js");
  const { coreNodeMetas } = await import("@makecord/plugin-core/meta");
  const project = await loadProject(starter);
  const trigger = { id: "s", type: "core.trigger", position: { x: 0, y: 0 }, data: {} };
  project.flows.push({
    file: "commands/ping-sub.flow.json",
    flow: {
      specVersion: 1,
      kind: "command",
      command: {
        type: "chatInput",
        name: "ping",
        description: "x",
        options: [
          { name: "q", description: "q", type: "string", required: false, autocomplete: true },
        ],
        subcommand: { name: "fast", description: "x" },
      },
      nodes: [
        trigger,
        {
          id: "g",
          type: "core.suggest",
          position: { x: 0, y: 0 },
          data: { choices: "a", filter: true },
        },
      ],
      edges: [{ id: "e", source: "s", sourceHandle: "next", target: "g" }],
    },
  });
  const codes = inspectProject(project, coreNodeMetas)
    .map((p) => `${p.file}:${p.code}`)
    .sort();
  assert.deepEqual(codes, [
    "commands/ping-sub.flow.json:unhandled-autocomplete",
    "commands/ping-sub.flow.json:wrong-event",
    "commands/ping.flow.json:command-conflict",
  ]);
});
