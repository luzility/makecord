import { watch } from "node:fs";
import type {
  CacheConfig,
  CommandFlow,
  CommandOptionType,
  EventFlow,
  ProjectConfig,
} from "@makecord/spec";
import {
  type ApplicationCommandOptionData,
  ApplicationCommandOptionType,
  type ChatInputApplicationCommandData,
  Client,
  Events,
  GatewayIntentBits,
  Options,
} from "discord.js";
import { executeFlow } from "./executor.js";
import { inspectProject } from "./inspect.js";
import { loadPlugins, type NodeRegistry } from "./plugins.js";
import { type LoadedFlow, type LoadedProject, loadProject } from "./project.js";
import type { Emit } from "./reporter.js";
import { commandScope, eventScope } from "./scope.js";

const OPTION_TYPES: Record<CommandOptionType, ApplicationCommandOptionType> = {
  string: ApplicationCommandOptionType.String,
  integer: ApplicationCommandOptionType.Integer,
  number: ApplicationCommandOptionType.Number,
  boolean: ApplicationCommandOptionType.Boolean,
  user: ApplicationCommandOptionType.User,
  channel: ApplicationCommandOptionType.Channel,
  role: ApplicationCommandOptionType.Role,
};

function makeCache(c: CacheConfig) {
  return Options.cacheWithLimits({
    ...Options.DefaultMakeCacheSettings,
    MessageManager: c.messages,
    PresenceManager: c.presences,
    ReactionManager: c.reactions,
    GuildMemberManager: {
      maxSize: c.members,
      keepOverLimit: (m) => m.id === m.client.user.id,
    },
  });
}

function toCommandData(flow: CommandFlow): ChatInputApplicationCommandData {
  return {
    name: flow.command.name,
    description: flow.command.description,
    options: flow.command.options.map(
      (o) =>
        ({
          name: o.name,
          description: o.description,
          type: OPTION_TYPES[o.type],
          required: o.required,
        }) as ApplicationCommandOptionData,
    ),
  };
}

function codedError(code: string, message: string): Error & { code: string } {
  return Object.assign(new Error(message), { code });
}

export interface StartOptions {
  projectDir: string;
  env: NodeJS.ProcessEnv;
  emit: Emit;
  watch?: boolean;
}

export interface RunningBot {
  reload(): Promise<void>;
  stop(): Promise<void>;
}

export async function startBot(opts: StartOptions): Promise<RunningBot> {
  const { projectDir, env, emit } = opts;
  emit({ type: "status", status: "starting" });

  const token = env.DISCORD_TOKEN;
  if (!token) {
    throw codedError(
      "missing-token",
      "DISCORD_TOKEN is not set. Add it in the IDE's Secrets panel or in a .env file.",
    );
  }

  let project: LoadedProject = await loadProject(projectDir);
  const config: ProjectConfig = project.config;
  const plugins = await loadPlugins(projectDir, config.plugins);
  const registry: NodeRegistry = plugins.registry;
  for (const err of plugins.errors)
    emit({ type: "log", level: "error", message: err, source: "plugins" });

  const metas = [...registry.values()].map((e) => e.node.meta);
  const reportProblems = () => {
    for (const p of inspectProject(project, metas)) {
      emit({
        type: "log",
        level: p.severity === "error" ? "error" : "warn",
        message: p.message,
        source: p.nodeId ? `${p.file}#${p.nodeId}` : p.file,
      });
    }
  };
  reportProblems();

  const client = new Client({
    intents: config.intents.map((i) => GatewayIntentBits[i]),
    makeCache: makeCache(config.cache),
    sweepers: config.cache.sweepIntervalSeconds
      ? {
          ...Options.DefaultSweeperSettings,
          messages: { interval: config.cache.sweepIntervalSeconds, lifetime: 1800 },
        }
      : Options.DefaultSweeperSettings,
  });

  const commandFlows = () =>
    new Map(
      project.flows
        .filter((f): f is LoadedFlow & { flow: CommandFlow } => f.flow.kind === "command")
        .map((f) => [f.flow.command.name, f]),
    );
  let commands = commandFlows();
  let registeredSignature = "";

  const syncCommands = async () => {
    const data = [...commands.values()].map((f) => toCommandData(f.flow));
    const signature = JSON.stringify(data);
    if (signature === registeredSignature) return;
    const app = client.application;
    if (!app) return;
    if (config.devGuildId) await app.commands.set(data, config.devGuildId);
    else await app.commands.set(data);
    registeredSignature = signature;
    emit({
      type: "commands",
      scope: config.devGuildId ? "guild" : "global",
      names: data.map((d) => d.name),
    });
  };

  const run = (
    file: string,
    flow: CommandFlow | EventFlow,
    base: Parameters<typeof executeFlow>[0]["base"],
  ) =>
    executeFlow({ file, flow, registry, base, env, emit }).catch((e: Error) =>
      emit({ type: "flow", phase: "error", flow: file, error: e.message }),
    );

  client.on(Events.InteractionCreate, (i) => {
    if (!i.isChatInputCommand()) return;
    emit({
      type: "gateway",
      event: "interactionCreate",
      summary: `/${i.commandName} — ${i.user.username}`,
    });
    const entry = commands.get(i.commandName);
    if (!entry) return;
    void run(entry.file, entry.flow, {
      client: i.client,
      interaction: i,
      eventArgs: [i],
      scope: commandScope(i),
    });
  });

  const dispatch =
    (event: EventFlow["event"]) =>
    (...args: unknown[]) => {
      if (event === "messageCreate" && (args[0] as { author?: { bot?: boolean } }).author?.bot)
        return;
      emit({ type: "gateway", event, summary: event });
      if (!client.isReady()) return;
      for (const { file, flow } of project.flows) {
        if (flow.kind === "event" && flow.event === event) {
          void run(file, flow, { client, eventArgs: args, scope: eventScope(client, event, args) });
        }
      }
    };
  for (const event of ["guildMemberAdd", "guildMemberRemove", "messageCreate"] as const) {
    client.on(event, dispatch(event));
  }

  client.once(Events.ClientReady, async (c) => {
    emit({
      type: "status",
      status: "ready",
      detail: `${c.user.tag} is online · ${c.guilds.cache.size} ${c.guilds.cache.size === 1 ? "server" : "servers"}`,
      online: { tag: c.user.tag, guilds: c.guilds.cache.size },
    });
    try {
      await syncCommands();
    } catch (e) {
      emit({
        type: "log",
        level: "error",
        message: `Couldn't register commands: ${(e as Error).message}`,
        source: "commands",
      });
    }
    dispatch("clientReady")(c);
  });

  client.on(Events.Error, (e) =>
    emit({ type: "log", level: "error", message: e.message, source: "discord" }),
  );
  client.on(Events.Warn, (m) =>
    emit({ type: "log", level: "warn", message: m, source: "discord" }),
  );

  const reload = async () => {
    try {
      project = { ...(await loadProject(projectDir)), config };
    } catch (e) {
      emit({ type: "log", level: "error", message: (e as Error).message, source: "reload" });
      return;
    }
    commands = commandFlows();
    reportProblems();
    emit({
      type: "log",
      level: "info",
      message: `Reloaded ${project.flows.length} flows`,
      source: "reload",
    });
    if (client.isReady())
      await syncCommands().catch((e: Error) =>
        emit({ type: "log", level: "error", message: e.message, source: "commands" }),
      );
  };

  let watcher: ReturnType<typeof watch> | undefined;
  if (opts.watch) {
    let timer: NodeJS.Timeout | undefined;
    watcher = watch(projectDir, { recursive: true }, (_e, name) => {
      if (!name?.endsWith(".flow.json")) return;
      clearTimeout(timer);
      timer = setTimeout(() => void reload(), 250);
    });
  }

  try {
    await client.login(token);
  } catch (e) {
    watcher?.close();
    await client.destroy();
    throw codedError("login-failed", `Couldn't connect to Discord: ${(e as Error).message}`);
  }

  return {
    reload,
    async stop() {
      emit({ type: "status", status: "stopping" });
      watcher?.close();
      await client.destroy();
      emit({ type: "status", status: "stopped" });
    },
  };
}
