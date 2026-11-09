import type {
  APIEmbed,
  APIMessageTopLevelComponent,
  Client,
  RepliableInteraction,
} from "discord.js";

export type LogLevel = "debug" | "info" | "warn" | "error";

export type StoredValue = string | number | boolean;

export interface KeyValueStore {
  get(key: string): StoredValue | undefined;
  set(key: string, value: StoredValue): void;
  delete(key: string): boolean;
  increment(key: string, by: number): number;
  keys(prefix?: string): string[];
}

export interface BuiltMessage {
  content?: string;
  embeds?: APIEmbed[];
  components?: APIMessageTopLevelComponent[];
  flags?: number;
}

export interface NodeContext {
  readonly client: Client<true>;
  readonly interaction?: RepliableInteraction;
  readonly eventArgs: readonly unknown[];
  readonly scope: Record<string, unknown>;
  readonly vars: Map<string, unknown>;
  readonly nodeId: string;
  readonly store: KeyValueStore;
  message(name: string): BuiltMessage;
  secret(name: string): string | undefined;
  log(level: LogLevel, message: string): void;
}
