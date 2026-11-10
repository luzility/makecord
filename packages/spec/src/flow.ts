import { z } from "zod";
import { SPEC_VERSION } from "./project.js";

export const Position = z.object({ x: z.number(), y: z.number() });

export const FlowNode = z.object({
  id: z.string().min(1),
  type: z.string().regex(/^[a-z0-9-]+\.[a-zA-Z0-9.]+$/),
  position: Position,
  data: z.record(z.string(), z.unknown()).default({}),
});
export type FlowNode = z.infer<typeof FlowNode>;

export const FlowEdge = z.object({
  id: z.string().min(1),
  source: z.string(),
  sourceHandle: z.string().default("next"),
  target: z.string(),
});
export type FlowEdge = z.infer<typeof FlowEdge>;

const COMMAND_NAME = /^[-_\p{L}\p{N}]{1,32}$/u;

export const CommandOptionType = z.enum([
  "string",
  "integer",
  "number",
  "boolean",
  "user",
  "channel",
  "role",
  "mentionable",
  "attachment",
]);
export type CommandOptionType = z.infer<typeof CommandOptionType>;

export const CommandChoice = z.object({
  name: z.string().min(1).max(100),
  value: z.string().min(1).max(100),
});
export type CommandChoice = z.infer<typeof CommandChoice>;

export const CommandOption = z.object({
  name: z
    .string()
    .regex(COMMAND_NAME)
    .refine((s) => s === s.toLowerCase(), "must be lowercase"),
  description: z.string().min(1).max(100),
  type: CommandOptionType,
  required: z.boolean().default(false),
  choices: z.array(CommandChoice).max(25).optional(),
  autocomplete: z.boolean().optional(),
  minValue: z.number().optional(),
  maxValue: z.number().optional(),
  minLength: z.number().int().min(0).max(6000).optional(),
  maxLength: z.number().int().min(1).max(6000).optional(),
});
export type CommandOption = z.infer<typeof CommandOption>;

export const CommandType = z.enum(["chatInput", "user", "message"]);
export type CommandType = z.infer<typeof CommandType>;

const LowerName = z
  .string()
  .regex(COMMAND_NAME)
  .refine((s) => s === s.toLowerCase(), "must be lowercase");

export const SubcommandRef = z.object({
  name: LowerName,
  description: z.string().min(1).max(100),
});
export type SubcommandRef = z.infer<typeof SubcommandRef>;

export const PermissionName = z.enum([
  "Administrator",
  "ManageGuild",
  "ManageRoles",
  "ManageChannels",
  "ManageMessages",
  "KickMembers",
  "BanMembers",
  "ModerateMembers",
  "ManageNicknames",
  "MentionEveryone",
]);
export type PermissionName = z.infer<typeof PermissionName>;

export const SlashCommand = z
  .object({
    type: CommandType.default("chatInput"),
    name: z.string().min(1).max(32),
    description: z.string().max(100).default(""),
    options: z.array(CommandOption).max(25).default([]),
    permissions: z.array(PermissionName).optional(),
    dms: z.boolean().optional(),
    group: SubcommandRef.optional(),
    subcommand: SubcommandRef.optional(),
  })
  .superRefine((c, ctx) => {
    if (c.type === "chatInput") {
      if (!COMMAND_NAME.test(c.name) || c.name !== c.name.toLowerCase()) {
        ctx.addIssue({
          code: "custom",
          path: ["name"],
          message: "Lowercase letters, numbers, - and _ only, without spaces",
        });
      }
      if (!c.description.trim()) {
        ctx.addIssue({
          code: "too_small",
          minimum: 1,
          origin: "string",
          inclusive: true,
          path: ["description"],
          message: "Too small: expected string to have >=1 characters",
        });
      }
    } else if (c.options.length || c.subcommand || c.group) {
      ctx.addIssue({
        code: "custom",
        path: ["type"],
        message: "Context menu commands can't have options or subcommands",
      });
    }
    if (c.group && !c.subcommand) {
      ctx.addIssue({ code: "custom", path: ["group"], message: "A group needs a subcommand" });
    }
    for (const [i, o] of c.options.entries()) {
      if (o.autocomplete && o.choices?.length) {
        ctx.addIssue({
          code: "custom",
          path: ["options", i, "autocomplete"],
          message: "An option can have choices or autocomplete, not both",
        });
      }
    }
  });
export type SlashCommand = z.infer<typeof SlashCommand>;

export const FlowNote = z.object({
  id: z.string().min(1),
  position: Position,
  text: z.string().max(4000).default(""),
  width: z.number().min(120).max(1200).optional(),
  height: z.number().min(60).max(1200).optional(),
});
export type FlowNote = z.infer<typeof FlowNote>;

const FlowBase = z.object({
  specVersion: z.literal(SPEC_VERSION),
  nodes: z.array(FlowNode),
  edges: z.array(FlowEdge).default([]),
  notes: z.array(FlowNote).optional(),
});

export const CommandFlow = FlowBase.extend({
  kind: z.literal("command"),
  command: SlashCommand,
});
export type CommandFlow = z.infer<typeof CommandFlow>;

export const FlowEventName = z.enum([
  "clientReady",
  "guildMemberAdd",
  "guildMemberRemove",
  "messageCreate",
  "messageUpdate",
  "messageDelete",
  "messageReactionAdd",
  "messageReactionRemove",
  "messagePollVoteAdd",
  "guildMemberUpdate",
  "guildBanAdd",
  "guildBanRemove",
  "voiceStateUpdate",
  "channelCreate",
  "channelDelete",
  "threadCreate",
  "roleCreate",
  "roleDelete",
  "inviteCreate",
  "guildCreate",
  "guildDelete",
  "autoModerationActionExecution",
  "buttonClick",
  "selectMenu",
  "modalSubmit",
  "autocomplete",
  "schedule",
  "function",
  "beforeCommand",
]);
export type FlowEventName = z.infer<typeof FlowEventName>;

export const INTERACTION_EVENTS: readonly FlowEventName[] = [
  "buttonClick",
  "selectMenu",
  "modalSubmit",
];

export const CUSTOM_ID_EVENTS: readonly FlowEventName[] = [...INTERACTION_EVENTS, "autocomplete"];

export const Schedule = z.union([
  z.object({ everyMinutes: z.number().int().min(1).max(10080) }),
  z.object({ dailyAt: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/) }),
]);
export type Schedule = z.infer<typeof Schedule>;

export const FUNCTION_NAME = /^[a-zA-Z_][a-zA-Z0-9_]{0,63}$/;

export const FunctionParamType = z.enum(["string", "number", "boolean"]);
export type FunctionParamType = z.infer<typeof FunctionParamType>;

export const FunctionParam = z.object({
  name: z.string().regex(FUNCTION_NAME, "Letters, numbers and _ only, not starting with a number"),
  description: z.string().max(500).default(""),
  type: FunctionParamType.default("string"),
  required: z.boolean().default(true),
});
export type FunctionParam = z.infer<typeof FunctionParam>;

export const FunctionSignature = z.object({
  name: z.string().regex(FUNCTION_NAME, "Letters, numbers and _ only, not starting with a number"),
  description: z.string().max(1000).default(""),
  params: z.array(FunctionParam).max(20).default([]),
});
export type FunctionSignature = z.infer<typeof FunctionSignature>;

export const EventFlow = FlowBase.extend({
  kind: z.literal("event"),
  event: FlowEventName,
  customId: z.string().min(1).max(100).optional(),
  schedule: Schedule.optional(),
  function: FunctionSignature.optional(),
});
export type EventFlow = z.infer<typeof EventFlow>;

export const Flow = z.discriminatedUnion("kind", [CommandFlow, EventFlow]);
export type Flow = z.infer<typeof Flow>;

export const TRIGGER_NODE_TYPE = "core.trigger";

export function matchesCustomId(pattern: string | undefined, id: string): boolean {
  if (!pattern) return true;
  return pattern.endsWith("*") ? id.startsWith(pattern.slice(0, -1)) : id === pattern;
}

export const isInteractionFlow = (flow: Flow) =>
  flow.kind === "command" ||
  INTERACTION_EVENTS.includes(flow.event) ||
  flow.event === "beforeCommand";

export function commandKey(
  c: Pick<SlashCommand, "type" | "name" | "group" | "subcommand">,
): string {
  if (c.type === "user" || c.type === "message") return `${c.type}:${c.name}`;
  return [c.name, c.group?.name, c.subcommand?.name].filter(Boolean).join(" ");
}

export function commandLabel(
  c: Pick<SlashCommand, "type" | "name" | "group" | "subcommand">,
): string {
  if (c.type === "user" || c.type === "message") return c.name;
  return `/${commandKey(c)}`;
}

export const FLOW_FILE_SUFFIX = ".flow.json";
export const PROJECT_FILE = "makecord.json";
