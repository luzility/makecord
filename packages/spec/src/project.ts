import { z } from "zod";

export const SPEC_VERSION = 1 as const;

export const IntentName = z.enum([
  "Guilds",
  "GuildMembers",
  "GuildModeration",
  "GuildExpressions",
  "GuildIntegrations",
  "GuildWebhooks",
  "GuildInvites",
  "GuildVoiceStates",
  "GuildPresences",
  "GuildMessages",
  "GuildMessageReactions",
  "GuildMessageTyping",
  "DirectMessages",
  "DirectMessageReactions",
  "DirectMessageTyping",
  "MessageContent",
  "GuildScheduledEvents",
  "AutoModerationConfiguration",
  "AutoModerationExecution",
  "GuildMessagePolls",
  "DirectMessagePolls",
]);
export type IntentName = z.infer<typeof IntentName>;

export const CacheConfig = z.object({
  messages: z.number().int().min(0).default(50).meta({ description: "Messages kept per channel" }),
  members: z
    .number()
    .int()
    .min(0)
    .default(200)
    .meta({ description: "Members kept per server (the bot itself is always kept)" }),
  presences: z.number().int().min(0).default(0).meta({ description: "Presences kept per server" }),
  reactions: z.number().int().min(0).default(0).meta({ description: "Reactions kept per message" }),
  sweepIntervalSeconds: z.number().int().min(0).default(3600).meta({
    description: "Seconds between sweeps of messages older than 30 minutes. 0 turns sweeping off",
  }),
});
export type CacheConfig = z.infer<typeof CacheConfig>;

export const ProjectConfig = z.object({
  $schema: z.string().optional(),
  specVersion: z.literal(SPEC_VERSION).meta({ description: "Format version of the project files" }),
  name: z.string().min(1).meta({ description: "Shown in the IDE" }),
  runtime: z
    .string()
    .default("^0.1.0")
    .meta({ description: "Semver range of @makecord/runtime the project targets" }),
  intents: z
    .array(IntentName)
    .default(["Guilds"])
    .meta({ description: "Gateway intents to request from Discord" }),
  devGuildId: z
    .string()
    .regex(/^\d{17,20}$/)
    .optional()
    .meta({
      description: "Register slash commands to this server only, so changes show up instantly",
    }),
  plugins: z.array(z.string()).default([]).meta({
    description: "npm package names of plugins to load. The core plugin is always loaded",
  }),
  secrets: z
    .array(z.string().regex(/^[A-Z][A-Z0-9_]*$/))
    .default(["DISCORD_TOKEN"])
    .meta({
      description: "Names of the secrets the bot expects. Values never live in the project",
    }),
  cache: CacheConfig.default(CacheConfig.parse({})).meta({
    description: "discord.js cache limits. Keeps memory flat in big servers",
  }),
});
export type ProjectConfig = z.infer<typeof ProjectConfig>;
