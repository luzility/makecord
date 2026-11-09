import { createRequire } from "node:module";
import type { HostMessage, RuntimeMessage } from "@makecord/runtime/protocol";
import { type UtilityProcess, utilityProcess } from "electron";
import { decryptSecrets } from "./secrets";
import { readSettings } from "./settings";

type Send = (msg: RuntimeMessage) => void;

let child: UtilityProcess | null = null;
let starting: Promise<void> | null = null;
let cancelStart = false;

export const botPid = () => child?.pid;

const PASSTHROUGH_ENV = ["PATH", "HOME", "USERPROFILE", "LANG", "TZ", "SYSTEMROOT", "TEMP", "TMP"];

const status = (s: Omit<Extract<RuntimeMessage, { type: "status" }>, "type" | "time">) =>
  ({ type: "status", time: Date.now(), ...s }) as RuntimeMessage;

export function startBot(root: string, send: Send): Promise<void> {
  if (child) return Promise.resolve();
  if (starting) return starting;
  cancelStart = false;
  starting = launch(root, send).finally(() => {
    starting = null;
  });
  return starting;
}

async function launch(root: string, send: Send): Promise<void> {
  send(status({ status: "starting" }));
  const secrets = await decryptSecrets(root);
  if (!secrets.DISCORD_TOKEN) {
    send(
      status({
        status: "error",
        code: "missing-token",
        detail: "DISCORD_TOKEN is not set. Add it in Secrets.",
      }),
    );
    return;
  }
  if (cancelStart) {
    send(status({ status: "stopped" }));
    return;
  }

  let cli: string;
  try {
    cli = createRequire(import.meta.url).resolve("@makecord/runtime/cli");
  } catch (e) {
    send(status({ status: "error", detail: `Couldn't find the runtime: ${(e as Error).message}` }));
    return;
  }

  const env: Record<string, string> = { NODE_ENV: "development" };
  for (const key of PASSTHROUGH_ENV) {
    const v = process.env[key];
    if (v) env[key] = v;
  }
  Object.assign(env, secrets);

  const proc = utilityProcess.fork(cli, ["start", root, "--watch"], {
    env,
    cwd: root,
    serviceName: "Makecord Bot",
    stdio: "pipe",
    execArgv: [`--max-old-space-size=${(await readSettings()).botMemoryMB}`],
  });
  child = proc;
  if (breakpoints) proc.postMessage(breakpoints);

  let lastStatus: string | undefined;
  const log = (level: "info" | "error") => (chunk: Buffer) => {
    for (const line of chunk.toString().split("\n")) {
      if (line.trim())
        send({ type: "log", time: Date.now(), level, message: line, source: "stdout" });
    }
  };
  proc.stdout?.on("data", log("info"));
  proc.stderr?.on("data", log("error"));
  proc.on("message", (msg: RuntimeMessage) => {
    if (msg.type === "status") lastStatus = msg.status;
    send(msg);
  });
  proc.on("exit", (code) => {
    if (child === proc) child = null;
    if (lastStatus === "error" || lastStatus === "stopped") return;
    send(
      code
        ? status({ status: "error", detail: `The bot exited unexpectedly (code ${code})` })
        : status({ status: "stopped" }),
    );
  });
}

let breakpoints: HostMessage | null = null;

export function sendToBot(msg: HostMessage) {
  if (msg.type !== "breakpoints" && msg.type !== "resume") return;
  if (msg.type === "breakpoints") breakpoints = msg;
  child?.postMessage(msg);
}

export async function stopBot(): Promise<void> {
  if (starting) {
    cancelStart = true;
    await starting;
  }
  const proc = child;
  if (!proc) return;
  await new Promise<void>((resolve) => {
    const timeout = setTimeout(() => proc.kill(), 5000);
    proc.once("exit", () => {
      clearTimeout(timeout);
      resolve();
    });
    proc.postMessage({ type: "stop" });
  });
}
