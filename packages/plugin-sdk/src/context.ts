import type { ChatInputCommandInteraction, Client } from "discord.js";

export type LogLevel = "debug" | "info" | "warn" | "error";

export interface NodeContext {
  readonly client: Client<true>;
  readonly interaction?: ChatInputCommandInteraction;
  readonly eventArgs: readonly unknown[];
  readonly scope: Record<string, unknown>;
  readonly vars: Map<string, unknown>;
  secret(name: string): string | undefined;
  log(level: LogLevel, message: string): void;
}
