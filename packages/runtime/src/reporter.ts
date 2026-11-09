import type { HostMessage, LogLevel, RuntimeMessage } from "./protocol.js";

type WithoutTime<T> = T extends unknown ? Omit<T, "time"> : never;
export type Emit = (msg: WithoutTime<RuntimeMessage>) => void;

interface ParentPort {
  postMessage(msg: unknown): void;
  on(event: "message", cb: (e: { data: unknown }) => void): void;
}

const COLORS: Record<LogLevel, string> = {
  debug: "\x1b[90m",
  info: "\x1b[36m",
  warn: "\x1b[33m",
  error: "\x1b[31m",
};

export function createReporter(): {
  emit: Emit;
  onHostMessage(cb: (m: HostMessage) => void): void;
} {
  const parentPort = (process as unknown as { parentPort?: ParentPort }).parentPort;

  if (parentPort) {
    return {
      emit: (msg) => parentPort.postMessage({ ...msg, time: Date.now() }),
      onHostMessage: (cb) => parentPort.on("message", (e) => cb(e.data as HostMessage)),
    };
  }
  if (process.send) {
    const send = process.send.bind(process);
    return {
      emit: (msg) => send({ ...msg, time: Date.now() }),
      onHostMessage: (cb) => process.on("message", (m) => cb(m as HostMessage)),
    };
  }

  const tty = process.stdout.isTTY;
  const reset = tty ? "\x1b[0m" : "";
  const line = (level: LogLevel, text: string) => {
    const ts = new Date().toISOString().slice(11, 19);
    const color = tty ? COLORS[level] : "";
    const out = level === "error" || level === "warn" ? process.stderr : process.stdout;
    out.write(`${ts} ${color}${level.toUpperCase().padEnd(5)}${reset} ${text}\n`);
  };
  return {
    emit: (msg) => {
      switch (msg.type) {
        case "log":
          return line(msg.level, msg.source ? `[${msg.source}] ${msg.message}` : msg.message);
        case "status":
          return line(
            msg.status === "error" ? "error" : "info",
            `● ${msg.status}${msg.detail ? ` — ${msg.detail}` : ""}`,
          );
        case "flow":
          if (msg.phase === "error")
            return line("error", `${msg.flow} › ${msg.nodeId}: ${msg.error}`);
          if (msg.phase === "end") return line("debug", `${msg.flow} done (${msg.durationMs}ms)`);
          return;
        case "commands":
          return line(
            "info",
            `Registered ${msg.names.length} commands (${msg.scope}): ${msg.names.join(", ")}`,
          );
        case "gateway":
        case "debug":
          return;
      }
    },
    onHostMessage: () => {},
  };
}
