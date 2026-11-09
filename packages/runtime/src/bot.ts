import { watch } from "node:fs";
import {
  BASE_BOT_PERMISSIONS,
  type CacheConfig,
  type CommandFlow,
  type CommandOptionType,
  type EventFlow,
  isBotPermission,
  type MessageDesign,
  matchesCustomId,
  type ProjectConfig,
} from "@makecord/spec";
import {
  type AnySelectMenuInteraction,
  type ApplicationCommandOptionData,
  ApplicationCommandOptionType,
  type ButtonInteraction,
  type ChatInputApplicationCommandData,
  Client,
  Events,
  GatewayIntentBits,
  type ModalSubmitInteraction,
  Options,
  Partials,
  PermissionFlagsBits,
} from "discord.js";
import { executeFlow } from "./executor.js";
import { inspectProject } from "./inspect.js";
import { loadPlugins, type NodeRegistry } from "./plugins.js";
import { type LoadedFlow, type LoadedProject, loadProject } from "./project.js";
import type { Emit } from "./reporter.js";
import { commandScope, eventScope, interactionScope } from "./scope.js";
import { openStore } from "./store.js";

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

const CHOICE_TYPES = new Set<CommandOptionType>(["string", "integer", "number"]);

function toCommandData(flow: CommandFlow): ChatInputApplicationCommandData {
  const { permissions } = flow.command;
  return {
    name: flow.command.name,
    description: flow.command.description,
    defaultMemberPermissions: permissions?.length
      ? permissions.reduce((bits, p) => bits | PermissionFlagsBits[p], 0n)
      : undefined,
    options: flow.command.options.map(
      (o) =>
        ({
          name: o.name,
          description: o.description,
          type: OPTION_TYPES[o.type],
          required: o.required,
          choices:
            o.choices?.length && CHOICE_TYPES.has(o.type)
              ? o.choices.map((c) => ({
                  name: c.name,
                  value: o.type === "string" ? c.value : Number(c.value),
                }))
              : undefined,
        }) as ApplicationCommandOptionData,
    ),
  };
}

function msUntil(time: string): number {
  const [h, m] = time.split(":").map(Number) as [number, number];
  const now = new Date();
  const next = new Date(now);
  next.setHours(h, m, 0, 0);
  if (next <= now) next.setDate(next.getDate() + 1);
  return next.getTime() - now.getTime();
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
  const designCache = new WeakMap<LoadedProject, Map<string, MessageDesign>>();
  const designsOf = (p: LoadedProject) => {
    let map = designCache.get(p);
    if (!map) {
      map = new Map([...p.messages].map(([name, m]) => [name, m.design]));
      designCache.set(p, map);
    }
    return map;
  };
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

  const store = openStore(projectDir);

  const client = new Client({
    intents: config.intents.map((i) => GatewayIntentBits[i]),
    partials: [Partials.Message, Partials.Channel, Partials.Reaction, Partials.User],
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
    base: Omit<Parameters<typeof executeFlow>[0]["base"], "store" | "messages">,
  ) =>
    executeFlow({
      file,
      flow,
      registry,
      base: { ...base, store, messages: designsOf(project) },
      env,
      emit,
    }).catch((e: Error) => emit({ type: "flow", phase: "error", flow: file, error: e.message }));

  const eventFlows = (event: EventFlow["event"]) =>
    project.flows.filter(
      (f): f is LoadedFlow & { flow: EventFlow } =>
        f.flow.kind === "event" && f.flow.event === event,
    );

  const runInteraction = (
    event: "buttonClick" | "selectMenu" | "modalSubmit",
    i: ButtonInteraction | AnySelectMenuInteraction | ModalSubmitInteraction,
  ) => {
    emit({ type: "gateway", event, summary: `${event} ${i.customId} — ${i.user.username}` });
    const matching = eventFlows(event).filter((f) => matchesCustomId(f.flow.customId, i.customId));
    if (!matching.length) {
      emit({
        type: "log",
        level: "warn",
        message: `No ${event} flow handles "${i.customId}"`,
        source: "interactions",
      });
      return;
    }
    for (const { file, flow } of matching) {
      void run(file, flow, {
        client: i.client,
        interaction: i,
        eventArgs: [i],
        scope: interactionScope(i),
      });
    }
  };

  client.on(Events.InteractionCreate, (i) => {
    if (i.isChatInputCommand()) {
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
    } else if (i.isButton()) runInteraction("buttonClick", i);
    else if (i.isAnySelectMenu()) runInteraction("selectMenu", i);
    else if (i.isModalSubmit()) runInteraction("modalSubmit", i);
  });

  const fromBot = (value: unknown) =>
    (value as { author?: { bot?: boolean } | null })?.author?.bot === true;

  const dispatch =
    (event: EventFlow["event"]) =>
    async (...args: unknown[]) => {
      if (
        (event === "messageCreate" || event === "messageUpdate") &&
        fromBot(args[event === "messageUpdate" ? 1 : 0])
      )
        return;
      if (event === "messageReactionAdd") {
        const [reaction, user] = args as [
          { partial: boolean; fetch(): Promise<unknown> },
          { bot?: boolean },
        ];
        if (user.bot) return;
        if (reaction.partial) await reaction.fetch().catch(() => {});
      }
      emit({ type: "gateway", event, summary: event });
      if (!client.isReady()) return;
      for (const { file, flow } of eventFlows(event)) {
        void run(file, flow, { client, eventArgs: args, scope: eventScope(client, event, args) });
      }
    };
  for (const event of [
    "guildMemberAdd",
    "guildMemberRemove",
    "messageCreate",
    "messageUpdate",
    "messageDelete",
    "messageReactionAdd",
  ] as const) {
    client.on(event, (...args: unknown[]) => void dispatch(event)(...args));
  }

  let scheduleTimers: NodeJS.Timeout[] = [];
  const setupSchedules = () => {
    for (const t of scheduleTimers) clearTimeout(t);
    scheduleTimers = [];
    for (const { file, flow } of eventFlows("schedule")) {
      const schedule = flow.schedule;
      if (!schedule) continue;
      const fire = () => {
        emit({ type: "gateway", event: "schedule", summary: `schedule ${file}` });
        if (client.isReady())
          void run(file, flow, {
            client,
            eventArgs: [],
            scope: eventScope(client, "schedule", []),
          });
      };
      if ("everyMinutes" in schedule) {
        scheduleTimers.push(setInterval(fire, schedule.everyMinutes * 60_000));
      } else {
        const arm = () => {
          const t = setTimeout(() => {
            fire();
            arm();
          }, msUntil(schedule.dailyAt));
          scheduleTimers.push(t);
        };
        arm();
      }
    }
  };

  const requiredPermissions = () => {
    const needed = new Set<string>(BASE_BOT_PERMISSIONS);
    for (const { flow } of project.flows) {
      for (const node of flow.nodes) {
        for (const p of registry.get(node.type)?.node.meta.permissions ?? []) needed.add(p);
      }
    }
    return [...needed].filter(isBotPermission);
  };

  const checkPermissions = (c: Client<true>) => {
    const needed = requiredPermissions();
    for (const guild of [...c.guilds.cache.values()].slice(0, 50)) {
      const me = guild.members.me;
      if (!me || me.permissions.has("Administrator")) continue;
      const missing = needed.filter((p) => !me.permissions.has(p));
      if (missing.length) {
        emit({
          type: "log",
          level: "warn",
          message: `Missing permissions in ${guild.name}: ${missing.join(", ")}. Some blocks will fail there`,
          source: "permissions",
        });
      }
    }
  };

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
    void dispatch("clientReady")(c);
    setupSchedules();
    checkPermissions(c);
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
    if (client.isReady()) setupSchedules();
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
      if (!name?.endsWith(".flow.json") && !name?.endsWith(".message.json")) return;
      clearTimeout(timer);
      timer = setTimeout(() => void reload(), 250);
    });
  }

  try {
    await client.login(token);
  } catch (e) {
    watcher?.close();
    await client.destroy();
    const message = (e as Error).message;
    if (/disallowed intents/i.test(message)) {
      throw codedError(
        "disallowed-intents",
        "Discord refused the privileged intents. Turn them on under Bot in the Developer Portal",
      );
    }
    throw codedError("login-failed", `Couldn't connect to Discord: ${message}`);
  }

  return {
    reload,
    async stop() {
      emit({ type: "status", status: "stopping" });
      watcher?.close();
      for (const t of scheduleTimers) clearTimeout(t);
      await client.destroy();
      store.flush();
      emit({ type: "status", status: "stopped" });
    },
  };
}
