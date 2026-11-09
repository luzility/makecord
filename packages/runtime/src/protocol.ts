export type LogLevel = "debug" | "info" | "warn" | "error";
export type RuntimeStatus = "starting" | "ready" | "stopping" | "stopped" | "error";

export type RuntimeMessage =
  | { type: "log"; time: number; level: LogLevel; message: string; source?: string }
  | {
      type: "status";
      time: number;
      status: RuntimeStatus;
      detail?: string;
      code?: string;
      online?: { tag: string; guilds: number };
    }
  | {
      type: "flow";
      time: number;
      phase: "start" | "node" | "end" | "error";
      flow: string;
      nodeId?: string;
      durationMs?: number;
      error?: string;
    }
  | { type: "gateway"; time: number; event: string; summary: string }
  | { type: "commands"; time: number; scope: "guild" | "global"; names: string[] };

export type HostMessage = { type: "stop" } | { type: "reload" };
