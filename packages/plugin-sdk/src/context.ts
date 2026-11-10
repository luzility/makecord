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

export interface FunctionParamInfo {
  name: string;
  description: string;
  type: "string" | "number" | "boolean";
  required: boolean;
}

export interface FunctionInfo {
  name: string;
  description: string;
  params: readonly FunctionParamInfo[];
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
  functions(): readonly FunctionInfo[];
  callFunction(name: string, args: Record<string, unknown>): Promise<unknown>;
  setResult(value: unknown): void;
  log(level: LogLevel, message: string): void;
}
