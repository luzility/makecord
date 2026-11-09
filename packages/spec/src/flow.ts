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
});
export type CommandOption = z.infer<typeof CommandOption>;

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

export const SlashCommand = z.object({
  name: z
    .string()
    .regex(COMMAND_NAME)
    .refine((s) => s === s.toLowerCase(), "must be lowercase"),
  description: z.string().min(1).max(100),
  options: z.array(CommandOption).max(25).default([]),
  permissions: z.array(PermissionName).optional(),
});
export type SlashCommand = z.infer<typeof SlashCommand>;

const FlowBase = z.object({
  specVersion: z.literal(SPEC_VERSION),
  nodes: z.array(FlowNode),
  edges: z.array(FlowEdge).default([]),
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
  "buttonClick",
  "selectMenu",
  "modalSubmit",
  "schedule",
]);
export type FlowEventName = z.infer<typeof FlowEventName>;

export const INTERACTION_EVENTS: readonly FlowEventName[] = [
  "buttonClick",
  "selectMenu",
  "modalSubmit",
];

export const Schedule = z.union([
  z.object({ everyMinutes: z.number().int().min(1).max(10080) }),
  z.object({ dailyAt: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/) }),
]);
export type Schedule = z.infer<typeof Schedule>;

export const EventFlow = FlowBase.extend({
  kind: z.literal("event"),
  event: FlowEventName,
  customId: z.string().min(1).max(100).optional(),
  schedule: Schedule.optional(),
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
  flow.kind === "command" || INTERACTION_EVENTS.includes(flow.event);

export const FLOW_FILE_SUFFIX = ".flow.json";
export const PROJECT_FILE = "makecord.json";
