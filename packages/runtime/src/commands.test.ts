import assert from "node:assert/strict";
import { test } from "node:test";
import { type CommandFlow, Flow } from "@makecord/spec";
import { ApplicationCommandType } from "discord.js";
import { buildCommands, routeKey } from "./commands.js";

const flow = (command: Record<string, unknown>) =>
  Flow.parse({
    specVersion: 1,
    kind: "command",
    command,
    nodes: [{ id: "s", type: "core.trigger", position: { x: 0, y: 0 } }],
  }) as CommandFlow;

test("subcommands and groups merge into one command", () => {
  const data = buildCommands([
    flow({
      name: "config",
      description: "Settings",
      subcommand: { name: "show", description: "Show" },
    }),
    flow({
      name: "config",
      description: "Settings",
      group: { name: "role", description: "Roles" },
      subcommand: { name: "add", description: "Add a role" },
      options: [{ name: "role", description: "Role", type: "role", required: true }],
      permissions: ["ManageRoles"],
    }),
    flow({ name: "ping", description: "Ping", dms: true }),
  ]) as unknown as Record<string, any>[];
  assert.equal(data.length, 2);
  const config = data.find((d) => d.name === "config")!;
  assert.equal(config.options.length, 2);
  assert.equal(config.options[0].name, "show");
  assert.equal(config.options[1].name, "role");
  assert.equal(config.options[1].options[0].name, "add");
  assert.equal(config.options[1].options[0].options[0].name, "role");
  assert.equal(config.defaultMemberPermissions, 1n << 28n);
  assert.deepEqual(data.find((d) => d.name === "ping")!.contexts, [0, 1]);
});

test("context menu commands have no description or options", () => {
  const [user] = buildCommands([flow({ type: "user", name: "Report user" })]) as unknown as Record<
    string,
    any
  >[];
  assert.equal(user!.type, ApplicationCommandType.User);
  assert.equal(user!.description, undefined);
  assert.equal(
    Flow.safeParse({
      specVersion: 1,
      kind: "command",
      command: {
        type: "message",
        name: "Quote",
        options: [{ name: "x", description: "x", type: "string" }],
      },
      nodes: [],
    }).success,
    false,
  );
});

test("option limits and autocomplete are passed through", () => {
  const [cmd] = buildCommands([
    flow({
      name: "roll",
      description: "Roll",
      options: [
        { name: "sides", description: "Sides", type: "integer", minValue: 2, maxValue: 100 },
        { name: "query", description: "Search", type: "string", autocomplete: true, maxLength: 50 },
      ],
    }),
  ]) as unknown as Record<string, any>[];
  assert.equal(cmd!.options[0].minValue, 2);
  assert.equal(cmd!.options[0].minLength, undefined);
  assert.equal(cmd!.options[1].autocomplete, true);
  assert.equal(cmd!.options[1].maxLength, 50);
});

test("interactions route to the right flow key", () => {
  assert.equal(
    routeKey({ commandName: "ping", commandType: ApplicationCommandType.ChatInput }),
    "ping",
  );
  assert.equal(
    routeKey({
      commandName: "config",
      commandType: ApplicationCommandType.ChatInput,
      options: { getSubcommandGroup: () => "role", getSubcommand: () => "add" },
    }),
    "config role add",
  );
  assert.equal(
    routeKey({ commandName: "Report user", commandType: ApplicationCommandType.User }),
    "user:Report user",
  );
});
