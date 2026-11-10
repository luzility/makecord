import { appendFileSync, mkdirSync, renameSync, statSync } from "node:fs";
import { join } from "node:path";
import { app } from "electron";

const MAX_BYTES = 1024 * 1024;

export const logsDir = () => join(app.getPath("userData"), "logs");

export function writeLog(source: string, text: string) {
  try {
    const dir = logsDir();
    mkdirSync(dir, { recursive: true });
    const file = join(dir, "makecord.log");
    try {
      if (statSync(file).size > MAX_BYTES) renameSync(file, join(dir, "makecord.1.log"));
    } catch {}
    appendFileSync(file, `${new Date().toISOString()} [${source}] ${text.trim()}\n`);
  } catch {}
}

export function describeError(e: unknown): string {
  if (e instanceof Error) return e.stack ?? `${e.name}: ${e.message}`;
  return String(e);
}

export function installCrashLogging() {
  process.on("uncaughtException", (e) => writeLog("main", describeError(e)));
  process.on("unhandledRejection", (e) => writeLog("main", describeError(e)));
}
