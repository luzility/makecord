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

export const CommandOption = z.object({
  name: z
    .string()
    .regex(COMMAND_NAME)
    .refine((s) => s === s.toLowerCase(), "must be lowercase"),
  description: z.string().min(1).max(100),
  type: CommandOptionType,
  required: z.boolean().default(false),
});
export type CommandOption = z.infer<typeof CommandOption>;

export const SlashCommand = z.object({
  name: z
    .string()
    .regex(COMMAND_NAME)
    .refine((s) => s === s.toLowerCase(), "must be lowercase"),
  description: z.string().min(1).max(100),
  options: z.array(CommandOption).max(25).default([]),
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
]);
export type FlowEventName = z.infer<typeof FlowEventName>;

export const EventFlow = FlowBase.extend({
  kind: z.literal("event"),
  event: FlowEventName,
});
export type EventFlow = z.infer<typeof EventFlow>;

export const Flow = z.discriminatedUnion("kind", [CommandFlow, EventFlow]);
export type Flow = z.infer<typeof Flow>;

export const TRIGGER_NODE_TYPE = "core.trigger";

export const FLOW_FILE_SUFFIX = ".flow.json";
export const PROJECT_FILE = "makecord.json";
