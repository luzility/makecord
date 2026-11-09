import assert from "node:assert/strict";
import { dirname, join } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import { executeFlow } from "./executor.js";
import { loadPlugins } from "./plugins.js";
import { loadProject } from "./project.js";
import type { Emit } from "./reporter.js";

const starter = join(dirname(fileURLToPath(import.meta.url)), "../../templates/starter");

function fakeInteraction() {
  const replies: { content: string; flags?: readonly string[] }[] = [];
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
    base: { client: {} as any, interaction: interaction as any, eventArgs: [], scope },
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
  assert.deepEqual(replies[0]!.flags, ["Ephemeral"]);
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
    base: { client: {} as any, eventArgs: [], scope: {} },
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
  assert.deepEqual(codes, ["missing-intent", "wrong-context"]);
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
