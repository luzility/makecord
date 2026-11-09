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
  | { type: "gateway"; time: number; event: string; summary: string; handled?: boolean }
  | {
      type: "debug";
      time: number;
      phase: "paused";
      runId: string;
      flow: string;
      nodeId: string;
      vars: unknown;
      scope: unknown;
    }
  | { type: "debug"; time: number; phase: "resumed"; runId: string }
  | { type: "commands"; time: number; scope: "guild" | "global"; names: string[] };

export type HostMessage =
  | { type: "stop" }
  | { type: "reload" }
  | { type: "breakpoints"; breakpoints: Record<string, string[]> }
  | { type: "resume"; runId: string; mode: "continue" | "step" | "stop" };
