import assert from "node:assert/strict";
import { test } from "node:test";
import type { Flow } from "@makecord/spec";
import { executeFlow } from "./executor.js";
import { loadPlugins } from "./plugins.js";

const store = {
  get: () => undefined,
  set: () => {},
  delete: () => false,
  increment: () => 0,
  keys: () => [],
};

const single = (type: string, data: Record<string, unknown>): Flow =>
  ({
    specVersion: 1,
    kind: "command",
    command: { type: "chatInput", name: "t", description: "t", options: [], permissions: [] },
    nodes: [
      { id: "start", type: "core.trigger", position: { x: 0, y: 0 }, data: {} },
      { id: "node", type, position: { x: 0, y: 0 }, data },
    ],
    edges: [{ id: "e1", source: "start", sourceHandle: "next", target: "node" }],
  }) as unknown as Flow;

async function runNode(
  type: string,
  data: Record<string, unknown>,
  base: { client?: unknown; interaction?: unknown },
) {
  const { registry } = await loadPlugins(process.cwd(), []);
  return executeFlow({
    file: "commands/t.flow.json",
    flow: single(type, data),
    registry,
    base: {
      client: (base.client ?? {}) as never,
      interaction: base.interaction as never,
      eventArgs: [],
      scope: {},
      store,
    },
    env: {},
    emit: () => {},
  });
}

function interaction(state: { deferred: boolean; ephemeral: boolean | null }) {
  const calls: [string, unknown?][] = [];
  const i = {
    guildId: "g",
    user: { id: "actor" },
    replied: false,
    deferred: state.deferred,
    ephemeral: state.ephemeral,
    reply: async (p: unknown) => void calls.push(["reply", p]),
    editReply: async (p: unknown) => void calls.push(["editReply", p]),
    followUp: async (p: unknown) => void calls.push(["followUp", p]),
    deleteReply: async () => void calls.push(["deleteReply"]),
  };
  return { i, calls };
}

test("an ephemeral reply after a public defer is sent privately and the placeholder removed", async () => {
  const { i, calls } = interaction({ deferred: true, ephemeral: false });
  const res = await runNode(
    "core.reply",
    { content: "secret", ephemeral: true },
    { interaction: i },
  );
  assert.equal(res.ok, true);
  assert.deepEqual(
    calls.map((c) => c[0]),
    ["deleteReply", "followUp"],
  );
  assert.equal((calls[1]![1] as { flags: number }).flags, 1 << 6);
  assert.equal(i.replied, true);
});

test("a reply after an ephemeral defer edits the deferred reply", async () => {
  const { i, calls } = interaction({ deferred: true, ephemeral: true });
  await runNode("core.reply", { content: "hi", ephemeral: true }, { interaction: i });
  assert.deepEqual(
    calls.map((c) => c[0]),
    ["editReply"],
  );
});

test("Reply pings @everyone and roles only when asked to", async () => {
  const quiet = interaction({ deferred: false, ephemeral: null });
  await runNode("core.reply", { content: "@everyone" }, { interaction: quiet.i });
  assert.equal((quiet.calls[0]![1] as { allowedMentions?: unknown }).allowedMentions, undefined);
  const loud = interaction({ deferred: false, ephemeral: null });
  await runNode(
    "core.reply",
    { content: "@everyone", pingEveryone: true },
    { interaction: loud.i },
  );
  assert.deepEqual((loud.calls[0]![1] as { allowedMentions?: unknown }).allowedMentions, {
    parse: ["users", "roles", "everyone"],
  });
});

function guildClient(positions: Record<string, number>, ownerId = "owner") {
  const actions: string[] = [];
  const member = (id: string) => ({
    id,
    displayName: `name-${id}`,
    roles: {
      highest: {
        position: positions[id] ?? 0,
        comparePositionTo: (o: { position: number }) => (positions[id] ?? 0) - o.position,
      },
    },
    kick: async () => void actions.push(`kick:${id}`),
    timeout: async () => void actions.push(`timeout:${id}`),
  });
  const guild = {
    id: "g",
    ownerId,
    members: {
      fetch: async (id: string) => {
        if (!(id in positions)) throw new Error("Unknown Member");
        return member(id);
      },
      ban: async (id: string) => void actions.push(`ban:${id}`),
    },
  };
  return { client: { guilds: { fetch: async () => guild } }, actions };
}

test("Kick, Ban and Timeout refuse when the person who ran it doesn't outrank the target", async () => {
  const { i } = interaction({ deferred: false, ephemeral: null });
  const { client, actions } = guildClient({ actor: 5, admin: 9, peer: 5, member: 1 });
  const kickAdmin = await runNode("core.kick", { userId: "admin" }, { client, interaction: i });
  assert.equal(kickAdmin.ok, false);
  assert.match(kickAdmin.error ?? "", /name-admin/);
  const banPeer = await runNode("core.ban", { userId: "peer" }, { client, interaction: i });
  assert.equal(banPeer.ok, false);
  const self = await runNode("core.timeout", { userId: "actor" }, { client, interaction: i });
  assert.match(self.error ?? "", /yourself/);
  const owner = await runNode("core.ban", { userId: "owner" }, { client, interaction: i });
  assert.match(owner.error ?? "", /server owner/);
  assert.equal(
    (await runNode("core.kick", { userId: "member" }, { client, interaction: i })).ok,
    true,
  );
  assert.equal(
    (await runNode("core.ban", { userId: "gone" }, { client, interaction: i })).ok,
    true,
  );
  assert.deepEqual(actions, ["kick:member", "ban:gone"]);
});

test("the server owner may moderate anyone", async () => {
  const { i } = interaction({ deferred: false, ephemeral: null });
  i.user.id = "owner";
  const { client, actions } = guildClient({ owner: 0, admin: 9 }, "owner");
  assert.equal(
    (await runNode("core.kick", { userId: "admin" }, { client, interaction: i })).ok,
    true,
  );
  assert.deepEqual(actions, ["kick:admin"]);
});

test("Create Channel marks extra people and roles with their type", async () => {
  let overwrites: { id: string; type?: number }[] = [];
  const guild = {
    id: "g",
    roles: { everyone: { id: "g" }, cache: new Map([["111111111111111111", {}]]) },
    channels: {
      create: async (o: { permissionOverwrites: typeof overwrites }) => {
        overwrites = o.permissionOverwrites;
        return { id: "c" };
      },
    },
  };
  const client = { user: { id: "bot" }, guilds: { fetch: async () => guild } };
  const res = await runNode(
    "core.createChannel",
    { name: "t", private: true, allow: "111111111111111111, 222222222222222222" },
    { client, interaction: { guildId: "g", user: { id: "actor" } } },
  );
  assert.equal(res.ok, true);
  assert.deepEqual(
    overwrites.slice(2).map((o) => [o.id, o.type]),
    [
      ["111111111111111111", 0],
      ["222222222222222222", 1],
    ],
  );
});
