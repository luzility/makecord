#!/usr/bin/env node
import { existsSync } from "node:fs";
import { join, resolve } from "node:path";
import { parseArgs } from "node:util";
import { startBot } from "./bot.js";
import { createDebugger } from "./debugger.js";
import { createReporter } from "./reporter.js";

const HELP = `makecord — runs Makecord projects

Usage:
  makecord start [project-dir] [--watch]

Secrets are read from environment variables. A .env file in the project folder is loaded automatically.
`;

async function main() {
  const { positionals, values } = parseArgs({
    allowPositionals: true,
    options: { watch: { type: "boolean", default: false }, help: { type: "boolean", short: "h" } },
  });
  const [command = "start", dir = "."] = positionals;
  if (values.help || command !== "start") {
    process.stdout.write(HELP);
    process.exit(values.help ? 0 : 1);
  }

  const projectDir = resolve(dir);
  const envFile = join(projectDir, ".env");
  if (existsSync(envFile)) process.loadEnvFile(envFile);

  const { emit, onHostMessage } = createReporter();
  let bot: Awaited<ReturnType<typeof startBot>> | undefined;
  let stopping = false;

  const shutdown = async (code = 0) => {
    if (stopping) return;
    stopping = true;
    await bot?.stop().catch(() => {});
    process.exit(code);
  };

  const debug = values.watch ? createDebugger(emit) : undefined;
  onHostMessage((m) => {
    if (m.type === "stop") void shutdown();
    if (m.type === "reload") void bot?.reload();
    if (m.type === "breakpoints") debug?.setBreakpoints(m.breakpoints);
    if (m.type === "resume") debug?.resume(m.runId, m.mode);
  });
  process.on("SIGINT", () => void shutdown());
  process.on("SIGTERM", () => void shutdown());

  try {
    bot = await startBot({ projectDir, env: process.env, emit, watch: values.watch, debug });
  } catch (e) {
    emit({
      type: "status",
      status: "error",
      detail: (e as Error).message,
      code: (e as { code?: string }).code,
    });
    await shutdown(1);
  }
}

void main();
