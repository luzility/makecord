import { watch } from "node:fs";
import { STOP_COMMAND } from "@makecord/plugin-sdk";
import {
  BASE_BOT_PERMISSIONS,
  type CacheConfig,
  type CommandFlow,
  CUSTOM_ID_EVENTS,
  commandKey,
  type EventFlow,
  isBotPermission,
  type MessageDesign,
  matchesCustomId,
  type ProjectConfig,
} from "@makecord/spec";
import {
  type AnySelectMenuInteraction,
  type ButtonInteraction,
  Client,
  Events,
  GatewayIntentBits,
  type ModalSubmitInteraction,
  Options,
  Partials,
} from "discord.js";
import { buildCommands, routeKey } from "./commands.js";
import type { Debugger } from "./debugger.js";
import {
  type Caller,
  debugStopError,
  executeFlow,
  type FlowResult,
  type FunctionHost,
} from "./executor.js";
import { coerceArgs, functionInfo, functionsOf, MAX_FUNCTION_DEPTH } from "./functions.js";
import { watchGateway } from "./gateway.js";
import { inspectProject } from "./inspect.js";
import { loadPlugins, type NodeRegistry } from "./plugins.js";
import { type LoadedFlow, type LoadedProject, loadProject } from "./project.js";
import type { Emit } from "./reporter.js";
import {
  autocompleteScope,
  commandScope,
  contextMenuScope,
  EVENT_SCOPES,
  eventScope,
  interactionScope,
} from "./scope.js";
import { openStore } from "./store.js";

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
  debug?: Debugger;
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
    partials: [
      Partials.Message,
      Partials.Channel,
      Partials.Reaction,
      Partials.User,
      Partials.GuildMember,
    ],
    allowedMentions: { parse: ["users"], repliedUser: true },
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
        .map((f) => [commandKey(f.flow.command), f]),
    );
  let commands = commandFlows();
  let registeredSignature = "";

  const syncCommands = async () => {
    const data = buildCommands([...commands.values()].map((f) => f.flow));
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

  let runCounter = 0;
  const functions: FunctionHost = {
    list: () => [...functionsOf(project.flows).values()].map((f) => functionInfo(f.flow.function)),
    call: async (name: string, args: Record<string, unknown>, caller: Caller, depth: number) => {
      if (depth > MAX_FUNCTION_DEPTH) {
        throw new Error(`Functions called each other more than ${MAX_FUNCTION_DEPTH} levels deep`);
      }
      const entry = functionsOf(project.flows).get(name);
      if (!entry) throw new Error(`Function "${name}" doesn't exist`);
      const { vars: _vars, args: _args, ...scope } = caller.scope;
      const res = await run(
        entry.file,
        entry.flow,
        { ...caller, scope: { ...scope, args: coerceArgs(entry.flow.function, args) } },
        depth,
      );
      if (res.stopped) throw debugStopError();
      if (!res.ok) throw new Error(`Function "${name}" failed: ${res.error}`);
      return res.result;
    },
  };

  const run = (
    file: string,
    flow: CommandFlow | EventFlow,
    base: Omit<Parameters<typeof executeFlow>[0]["base"], "store" | "messages">,
    depth = 0,
  ): Promise<FlowResult> => {
    const runId = `r${++runCounter}`;
    const debug = opts.debug;
    const i = base.interaction;
    const beforeNode = debug
      ? (nodeId: string, state: { vars: Map<string, unknown>; scope: unknown }) =>
          debug.before({
            file,
            runId,
            nodeId,
            vars: state.vars,
            scope: state.scope,
            beforePause: async () => {
              if (!i || i.deferred || i.replied) return;
              await i.deferReply();
              emit({
                type: "log",
                level: "info",
                message:
                  "Paused in the debugger, so the reply was deferred to keep Discord from timing out",
                source: `${file}#${nodeId}`,
              });
            },
          })
      : undefined;
    return executeFlow({
      file,
      flow,
      registry,
      base: { ...base, store, messages: designsOf(project) },
      env,
      emit,
      beforeNode,
      functions,
      depth,
    })
      .catch((e: Error): FlowResult => {
        emit({ type: "flow", phase: "error", flow: file, error: e.message });
        return { ok: false, error: e.message };
      })
      .finally(() => debug?.finished(runId));
  };

  const eventFlows = (event: EventFlow["event"]) =>
    project.flows.filter(
      (f): f is LoadedFlow & { flow: EventFlow } =>
        f.flow.kind === "event" && f.flow.event === event,
    );

  const runInteraction = (
    event: "buttonClick" | "selectMenu" | "modalSubmit",
    i: ButtonInteraction | AnySelectMenuInteraction | ModalSubmitInteraction,
  ) => {
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
    if (i.isChatInputCommand() || i.isContextMenuCommand()) {
      const key = routeKey(i);
      const entry = commands.get(key);
      if (!entry) return;
      const base = {
        client: i.client,
        interaction: i,
        eventArgs: [i],
        scope: i.isChatInputCommand() ? commandScope(i) : contextMenuScope(i),
      };
      void (async () => {
        for (const mw of eventFlows("beforeCommand")) {
          if (
            !matchesCustomId(mw.flow.customId, key) &&
            !(i.isContextMenuCommand() && matchesCustomId(mw.flow.customId, i.commandName))
          )
            continue;
          const res = await run(mw.file, mw.flow, base);
          if (!res.ok || res.result === STOP_COMMAND) {
            emit({
              type: "log",
              level: "debug",
              message: `${mw.file} stopped ${key}`,
              source: "commands",
            });
            return;
          }
        }
        await run(entry.file, entry.flow, base);
      })();
    } else if (i.isAutocomplete()) {
      const focused = i.options.getFocused(true);
      const id = `${routeKey(i)}.${focused.name}`.replace(/ /g, ".");
      const matching = eventFlows("autocomplete").filter((f) =>
        matchesCustomId(f.flow.customId, id),
      );
      if (!matching.length) {
        void i.respond([]).catch(() => {});
        return;
      }
      const { file, flow } = matching[0]!;
      void run(file, flow, {
        client: i.client,
        eventArgs: [i],
        scope: { ...autocompleteScope(i), customId: id },
      }).then(() => {
        if (!i.responded) void i.respond([]).catch(() => {});
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
      if (event === "threadCreate" && args[1] === false) return;
      if (event === "messagePollVoteAdd") {
        const answer = args[0] as { partial?: boolean; fetch?(): Promise<unknown> };
        if (answer.partial) await answer.fetch?.().catch(() => {});
      }
      if (event === "messageReactionAdd" || event === "messageReactionRemove") {
        const [reaction, user] = args as [
          { partial: boolean; fetch(): Promise<unknown> },
          { bot?: boolean },
        ];
        if (user.bot) return;
        if (reaction.partial) await reaction.fetch().catch(() => {});
      }
      if (!client.isReady()) return;
      for (const { file, flow } of eventFlows(event)) {
        void run(file, flow, { client, eventArgs: args, scope: eventScope(client, event, args) });
      }
    };
  const NOT_GATEWAY = new Set<string>([...CUSTOM_ID_EVENTS, "schedule", "clientReady"]);
  for (const event of Object.keys(EVENT_SCOPES) as EventFlow["event"][]) {
    if (NOT_GATEWAY.has(event)) continue;
    client.on(event as never, (...args: unknown[]) => void dispatch(event)(...args));
  }

  let scheduleTimers: NodeJS.Timeout[] = [];
  const setupSchedules = () => {
    for (const t of scheduleTimers) clearTimeout(t);
    scheduleTimers = [];
    for (const { file, flow } of eventFlows("schedule")) {
      const schedule = flow.schedule;
      if (!schedule) continue;
      const fire = () => {
        emit({ type: "log", level: "debug", message: "Schedule fired", source: file });
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
      detail: `${c.user.tag} is online in ${c.guilds.cache.size} ${c.guilds.cache.size === 1 ? "server" : "servers"}`,
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

  const RAW_EVENTS: Record<string, EventFlow["event"]> = {
    READY: "clientReady",
    GUILD_MEMBER_ADD: "guildMemberAdd",
    GUILD_MEMBER_REMOVE: "guildMemberRemove",
    MESSAGE_CREATE: "messageCreate",
    MESSAGE_UPDATE: "messageUpdate",
    MESSAGE_DELETE: "messageDelete",
    MESSAGE_REACTION_ADD: "messageReactionAdd",
    MESSAGE_REACTION_REMOVE: "messageReactionRemove",
    MESSAGE_POLL_VOTE_ADD: "messagePollVoteAdd",
    GUILD_MEMBER_UPDATE: "guildMemberUpdate",
    GUILD_BAN_ADD: "guildBanAdd",
    GUILD_BAN_REMOVE: "guildBanRemove",
    VOICE_STATE_UPDATE: "voiceStateUpdate",
    CHANNEL_CREATE: "channelCreate",
    CHANNEL_DELETE: "channelDelete",
    THREAD_CREATE: "threadCreate",
    GUILD_ROLE_CREATE: "roleCreate",
    GUILD_ROLE_DELETE: "roleDelete",
    INVITE_CREATE: "inviteCreate",
    GUILD_DELETE: "guildDelete",
    AUTO_MODERATION_ACTION_EXECUTION: "autoModerationActionExecution",
  };
  const isHandled = (t: string, d: Record<string, any>) => {
    if (t === "INTERACTION_CREATE") {
      const id = String(d.data?.custom_id ?? "");
      const byId = (event: EventFlow["event"]) =>
        eventFlows(event).some((f) => matchesCustomId(f.flow.customId, id));
      if (d.type === 2) {
        const name = String(d.data?.name ?? "");
        return [...commands.keys()].some(
          (k) => k === name || k.startsWith(`${name} `) || k.endsWith(`:${name}`),
        );
      }
      if (d.type === 4) return eventFlows("autocomplete").length > 0;
      if (d.type === 3) return byId(d.data?.component_type === 2 ? "buttonClick" : "selectMenu");
      if (d.type === 5) return byId("modalSubmit");
      return false;
    }
    const event = RAW_EVENTS[t];
    return event ? eventFlows(event).length > 0 : false;
  };
  const unwatchGateway = opts.watch ? watchGateway(client, emit, isHandled) : undefined;

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
      opts.debug?.resumeAll("stop");
      unwatchGateway?.();
      watcher?.close();
      for (const t of scheduleTimers) clearTimeout(t);
      await client.destroy();
      store.flush();
      emit({ type: "status", status: "stopped" });
    },
  };
}
