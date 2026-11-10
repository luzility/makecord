import { VARIABLE_FIELD_FORMAT } from "@makecord/plugin-sdk";
import type { Flow, FlowEventName } from "@makecord/spec";
import { descriptorOf } from "./nodes";

export type VarGroup =
  | "flow"
  | "event"
  | "user"
  | "member"
  | "server"
  | "channel"
  | "message"
  | "bot";

export interface VarItem {
  path: string;
  group: VarGroup;
}

const USER = [
  "user.mention",
  "user.displayName",
  "user.username",
  "user.id",
  "user.avatar",
  "user.createdAt",
];
const MEMBER = [
  "member.nickname",
  "member.displayName",
  "member.joinedAt",
  "member.roles",
  "member.boosting",
];
const SERVER = [
  "guild.name",
  "guild.id",
  "guild.memberCount",
  "guild.icon",
  "guild.ownerId",
  "guild.boosts",
];
const CHANNEL = ["channel.mention", "channel.name", "channel.id"];
const MESSAGE = [
  "message.content",
  "message.id",
  "message.url",
  "message.authorId",
  "message.attachments",
];
const BOT = ["client.mention", "client.tag", "client.id", "client.ping", "client.servers"];

const PEOPLE = [...USER, ...MEMBER, ...SERVER, ...CHANNEL];
const REACTION = [
  ...USER,
  ...SERVER,
  ...CHANNEL,
  "message.id",
  "message.url",
  "emoji.text",
  "emoji.name",
  "emoji.id",
];

export const EVENT_VARIABLES: Record<FlowEventName, string[]> = {
  clientReady: [],
  guildCreate: SERVER,
  guildDelete: ["guild.name", "guild.id"],
  guildMemberAdd: [...USER, ...MEMBER, ...SERVER],
  guildMemberRemove: [...USER, ...MEMBER, ...SERVER],
  guildMemberUpdate: [
    ...USER,
    ...MEMBER,
    ...SERVER,
    "before.nickname",
    "before.displayName",
    "roles.addedIds",
    "roles.removedIds",
    "boosted",
    "timedOut",
  ],
  guildBanAdd: [...USER, ...SERVER, "reason"],
  guildBanRemove: [...USER, ...SERVER],
  messageCreate: [...USER, ...SERVER, ...CHANNEL, ...MESSAGE, "message.mentions"],
  messageUpdate: [...USER, ...SERVER, ...CHANNEL, ...MESSAGE, "before.content"],
  messageDelete: [...SERVER, ...CHANNEL, ...MESSAGE],
  messageReactionAdd: REACTION,
  messageReactionRemove: REACTION,
  messagePollVoteAdd: [
    "user.mention",
    "user.id",
    ...SERVER,
    "channel.id",
    "message.id",
    "answer.text",
    "answer.votes",
    "poll.question",
  ],
  voiceStateUpdate: [
    ...USER,
    ...MEMBER,
    ...SERVER,
    "voice.action",
    "voice.channel.name",
    "voice.channel.mention",
    "voice.channel.id",
    "voice.before.name",
    "voice.before.id",
    "voice.muted",
    "voice.deafened",
    "voice.streaming",
  ],
  channelCreate: [...SERVER, ...CHANNEL],
  channelDelete: [...SERVER, ...CHANNEL],
  threadCreate: [
    ...SERVER,
    "thread.mention",
    "thread.name",
    "thread.id",
    "thread.parentId",
    "user.mention",
  ],
  roleCreate: [...SERVER, "role.mention", "role.name", "role.id", "role.color"],
  roleDelete: [...SERVER, "role.name", "role.id"],
  inviteCreate: [
    ...USER,
    ...SERVER,
    ...CHANNEL,
    "invite.url",
    "invite.code",
    "invite.maxUses",
    "invite.expiresAt",
  ],
  autoModerationActionExecution: [
    "user.mention",
    "user.id",
    ...SERVER,
    "channel.id",
    "message.content",
    "automod.rule",
    "automod.keyword",
    "automod.matched",
  ],
  buttonClick: [...PEOPLE, "customId", "message.id", "message.url"],
  selectMenu: [...PEOPLE, "customId", "value", "values", "message.id"],
  modalSubmit: [...PEOPLE, "customId", "fields.<id>"],
  autocomplete: [
    ...USER,
    ...SERVER,
    "focused.value",
    "focused.name",
    "options.<name>",
    "command.name",
    "command.subcommand",
  ],
  schedule: ["now.date", "now.time", "now.weekday", "now.unix", "now.iso"],
  function: PEOPLE,
};

function groupOf(path: string): VarGroup {
  const head = path.split(".")[0];
  switch (head) {
    case "vars":
      return "flow";
    case "user":
    case "target":
      return "user";
    case "member":
    case "targetMember":
      return "member";
    case "guild":
      return "server";
    case "channel":
    case "thread":
      return "channel";
    case "message":
    case "before":
      return "message";
    case "client":
      return "bot";
    default:
      return "event";
  }
}

function flowVariables(flow: Flow): string[] {
  const out: string[] = [];
  for (const node of flow.nodes) {
    const meta = descriptorOf(node.type);
    const props = (
      meta?.fields as { properties?: Record<string, Record<string, unknown>> } | undefined
    )?.properties;
    if (!props) continue;
    for (const [key, schema] of Object.entries(props)) {
      if (schema.format !== VARIABLE_FIELD_FORMAT) continue;
      const name = String(node.data?.[key] ?? schema.default ?? "").trim();
      if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(name)) continue;
      out.push(`vars.${name}`);
      for (const suffix of (schema.alsoSets as string[] | undefined) ?? [])
        out.push(`vars.${name}${suffix}`);
    }
  }
  return out;
}

function ownVariables(flow: Flow): string[] {
  if (flow.kind === "event" && flow.event === "function")
    return [...(flow.function?.params ?? []).map((p) => `args.${p.name}`), ...PEOPLE];
  if (flow.kind === "event") return EVENT_VARIABLES[flow.event];
  if (flow.command.type === "user")
    return [
      ...USER,
      ...SERVER,
      ...CHANNEL,
      "target.mention",
      "target.displayName",
      "target.username",
      "target.id",
      "targetMember.nickname",
      "targetMember.joinedAt",
    ];
  if (flow.command.type === "message")
    return [...USER, ...SERVER, ...CHANNEL, ...MESSAGE, "target.mention", "target.id"];
  const options = flow.command.options.map((o) => `options.${o.name}`);
  return [
    ...options,
    ...PEOPLE,
    ...(flow.command.subcommand ? ["command.subcommand", "command.group"] : []),
  ];
}

export function variablesFor(flow: Flow | undefined): VarItem[] {
  const paths = flow
    ? [...flowVariables(flow), ...ownVariables(flow), ...BOT]
    : [...PEOPLE, ...MESSAGE, ...BOT];
  const seen = new Set<string>();
  const out: VarItem[] = [];
  for (const path of paths) {
    if (seen.has(path)) continue;
    seen.add(path);
    out.push({ path, group: groupOf(path) });
  }
  return out;
}

export const VAR_GROUP_ORDER: VarGroup[] = [
  "flow",
  "event",
  "user",
  "member",
  "server",
  "channel",
  "message",
  "bot",
];

export function scopeOf(el: Element): string | null {
  return el.closest("[data-var-scope]")?.getAttribute("data-var-scope") ?? null;
}

export function variablesForScope(
  scope: string,
  flowOf: (path: string) => Flow | undefined,
): VarItem[] {
  if (scope.startsWith("flow:")) return variablesFor(flowOf(scope.slice(5)));
  return variablesFor(undefined);
}
