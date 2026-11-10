import {
  type BuiltMessage,
  defineNode,
  definePlugin,
  type NodeContext,
} from "@makecord/plugin-sdk";
import * as m from "./meta.js";

const toNumber = (value: string, field: string): number => {
  const n = Number(String(value).trim());
  if (!Number.isFinite(n)) throw new Error(`${field} isn't a number: "${value}"`);
  return n;
};

const compare = (left: string, op: string, right: string): boolean => {
  const l = Number(left);
  const r = Number(right);
  switch (op) {
    case "equals":
      return left === right;
    case "notEquals":
      return left !== right;
    case "contains":
      return left.includes(right);
    case "greaterThan":
      return l > r;
    case "lessThan":
      return l < r;
    default:
      return false;
  }
};

async function guildOf(ctx: NodeContext) {
  const id = ctx.interaction?.guildId ?? (ctx.scope.guild as { id?: string } | undefined)?.id;
  if (!id) throw new Error("This block has to run inside a server");
  return ctx.client.guilds.fetch(id);
}

async function memberOf(ctx: NodeContext, userId: string) {
  const guild = await guildOf(ctx);
  return guild.members.fetch(userId);
}

async function sendableChannel(ctx: NodeContext, channelId: string) {
  const channel = await ctx.client.channels.fetch(channelId);
  if (!channel?.isSendable()) throw new Error(`Channel not found or not writable: ${channelId}`);
  return channel;
}

async function messageOf(ctx: NodeContext, channelId: string, messageId: string) {
  const channel = await ctx.client.channels.fetch(channelId);
  if (!channel?.isTextBased()) throw new Error(`Channel not found: ${channelId}`);
  return channel.messages.fetch(messageId);
}

const EPHEMERAL = 1 << 6;
const COMPONENTS_V2 = 1 << 15;

function payloadOf(ctx: NodeContext, data: { content: string; message: string }): BuiltMessage {
  if (data.message.trim()) return ctx.message(data.message);
  return { content: data.content };
}

function withFlags(payload: BuiltMessage, extra: number): BuiltMessage {
  const flags = (payload.flags ?? 0) | extra;
  return flags ? { ...payload, flags } : payload;
}

function listOf(raw: string): unknown[] {
  const text = raw.trim();
  if (text.startsWith("[")) {
    try {
      const parsed = JSON.parse(text);
      if (Array.isArray(parsed)) return parsed;
    } catch {}
  }
  return text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);
}

const clampInt = (value: string, field: string, min: number, max: number) =>
  Math.min(max, Math.max(min, Math.floor(toNumber(value, field))));

const cooldowns = new Map<string, number>();

const TIMESTAMP_STYLES = {
  relative: "R",
  shortTime: "t",
  longTime: "T",
  shortDate: "d",
  longDate: "D",
  shortDateTime: "f",
  longDateTime: "F",
} as const;

const CHANNEL_TYPES = {
  text: 0,
  voice: 2,
  category: 4,
  announcement: 5,
  stage: 13,
  forum: 15,
} as const;
const ACTIVITY_TYPES = { playing: 0, listening: 2, watching: 3, custom: 4, competing: 5 } as const;

async function guildChannel(ctx: NodeContext, channelId: string) {
  const channel = await ctx.client.channels.fetch(channelId);
  if (!channel || !("guild" in channel) || channel.isDMBased()) {
    throw new Error(`Server channel not found: ${channelId}`);
  }
  return channel;
}

function requireInteraction(ctx: NodeContext) {
  if (!ctx.interaction)
    throw new Error("This block needs a command, button, menu or form to answer");
  return ctx.interaction;
}

function parseInputs(spec: string) {
  const lines = spec
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);
  if (lines.length > 5) throw new Error("A form can have at most 5 fields");
  return lines.map((l, i) => {
    const [id, label, style = "short", required = "required"] = l.split("|").map((p) => p.trim());
    if (!id || !label) throw new Error(`Field ${i + 1} needs at least an id and a label: "${l}"`);
    return {
      id,
      label,
      paragraph: style.toLowerCase() === "paragraph",
      required: required.toLowerCase() !== "optional",
    };
  });
}

export default definePlugin({
  id: "core",
  version: "0.2.0",
  engines: { makecord: "^0.2.0" },
  nodes: [
    defineNode(m.trigger, () => "next"),

    defineNode(m.reply, async (ctx, data) => {
      const i = requireInteraction(ctx);
      const payload = withFlags(payloadOf(ctx, data), data.ephemeral ? EPHEMERAL : 0);
      if (i.deferred && !i.replied) {
        const { flags, ...rest } = payload;
        await i.editReply({ ...rest, flags: flags && flags & ~EPHEMERAL });
      } else if (i.replied) await i.followUp(payload);
      else await i.reply(payload);
    }),

    defineNode(m.deferReply, async (ctx, data) => {
      const i = requireInteraction(ctx);
      if (!i.deferred && !i.replied) {
        await i.deferReply({ flags: data.ephemeral ? ["Ephemeral"] : undefined });
      }
    }),

    defineNode(m.sendMessage, async (ctx, data) => {
      await (await sendableChannel(ctx, data.channelId)).send(payloadOf(ctx, data));
    }),

    defineNode(m.sendDM, async (ctx, data) => {
      try {
        const user = await ctx.client.users.fetch(data.userId);
        await user.send(payloadOf(ctx, data));
        return "next";
      } catch (e) {
        ctx.log("warn", `Couldn't DM ${data.userId}: ${(e as Error).message}`);
        return "failed";
      }
    }),

    defineNode(m.updateMessage, async (ctx, data) => {
      const i = requireInteraction(ctx);
      if (!i.isMessageComponent()) {
        throw new Error("Update Message only works after a button click or a menu pick");
      }
      const payload = payloadOf(ctx, data);
      const update =
        (payload.flags ?? 0) & COMPONENTS_V2 ? payload : { embeds: [], components: [], ...payload };
      if (i.deferred || i.replied) await i.editReply(update);
      else await i.update(update);
    }),

    defineNode(m.addReaction, async (ctx, data) => {
      await (await messageOf(ctx, data.channelId, data.messageId)).react(data.emoji);
    }),

    defineNode(m.deleteMessage, async (ctx, data) => {
      await (await messageOf(ctx, data.channelId, data.messageId)).delete();
    }),

    defineNode(m.addRole, async (ctx, data) => {
      await (await memberOf(ctx, data.userId)).roles.add(data.roleId);
    }),

    defineNode(m.removeRole, async (ctx, data) => {
      await (await memberOf(ctx, data.userId)).roles.remove(data.roleId);
    }),

    defineNode(m.kick, async (ctx, data) => {
      await (await memberOf(ctx, data.userId)).kick(data.reason || undefined);
    }),

    defineNode(m.ban, async (ctx, data) => {
      const hours = Math.min(168, Math.max(0, toNumber(data.deleteMessageHours, "Hours")));
      const guild = await guildOf(ctx);
      await guild.members.ban(data.userId, {
        reason: data.reason || undefined,
        deleteMessageSeconds: Math.round(hours * 3600),
      });
    }),

    defineNode(m.timeout, async (ctx, data) => {
      const minutes = Math.min(40320, Math.max(0, toNumber(data.minutes, "Minutes")));
      const member = await memberOf(ctx, data.userId);
      await member.timeout(minutes === 0 ? null : minutes * 60_000, data.reason || undefined);
    }),

    defineNode(m.showModal, async (ctx, data) => {
      const i = requireInteraction(ctx);
      if (!("showModal" in i) || i.isModalSubmit()) {
        throw new Error("A form can't be opened in answer to another form");
      }
      const { LabelBuilder, ModalBuilder, TextInputBuilder, TextInputStyle } = await import(
        "discord.js"
      );
      const modal = new ModalBuilder().setCustomId(data.customId).setTitle(data.title);
      for (const input of parseInputs(data.inputs)) {
        modal.addLabelComponents(
          new LabelBuilder().setLabel(input.label).setTextInputComponent(
            new TextInputBuilder()
              .setCustomId(input.id)
              .setStyle(input.paragraph ? TextInputStyle.Paragraph : TextInputStyle.Short)
              .setRequired(input.required),
          ),
        );
      }
      await i.showModal(modal);
    }),

    defineNode(m.condition, (_ctx, data) =>
      compare(data.left, data.operator, data.right) ? "true" : "false",
    ),

    defineNode(m.wait, async (ctx, data) => {
      const seconds = Math.min(900, Math.max(0, toNumber(data.seconds, "Seconds")));
      const i = ctx.interaction;
      if (i && seconds > 2 && !i.deferred && !i.replied) await i.deferReply();
      await new Promise((resolve) => setTimeout(resolve, seconds * 1000));
    }),

    defineNode(m.repeat, (ctx, data) => {
      const times = Math.min(100, Math.max(0, Math.floor(toNumber(data.times, "Times"))));
      const key = `__repeat:${ctx.nodeId}`;
      const done = (ctx.vars.get(key) as number | undefined) ?? 0;
      if (done < times) {
        ctx.vars.set(key, done + 1);
        ctx.vars.set(data.indexVariable, done + 1);
        return "loop";
      }
      ctx.vars.delete(key);
      return "done";
    }),

    defineNode(m.callFunction, async (ctx, data) => {
      try {
        ctx.vars.set(data.variable, await ctx.callFunction(data.function.trim(), data.args));
        ctx.vars.set(`${data.variable}Error`, "");
        return "next";
      } catch (e) {
        ctx.vars.set(`${data.variable}Error`, (e as Error).message);
        ctx.log("warn", (e as Error).message);
        return "failed";
      }
    }),

    defineNode(m.returnValue, (ctx, data) => {
      const raw = data.value.trim();
      let value: unknown = data.value;
      if (/^[[{]/.test(raw)) {
        try {
          value = JSON.parse(raw);
        } catch {}
      }
      ctx.setResult(value);
    }),

    defineNode(m.setVariable, (ctx, data) => {
      ctx.vars.set(data.name, data.value);
    }),

    defineNode(m.random, (ctx, data) => {
      const min = Math.ceil(toNumber(data.min, "Min"));
      const max = Math.floor(toNumber(data.max, "Max"));
      if (max < min) throw new Error(`Max (${max}) is smaller than min (${min})`);
      ctx.vars.set(data.variable, min + Math.floor(Math.random() * (max - min + 1)));
    }),

    defineNode(m.math, (ctx, data) => {
      const a = toNumber(data.left, "Left number");
      const b = toNumber(data.right, "Right number");
      const result = {
        add: a + b,
        subtract: a - b,
        multiply: a * b,
        divide: b === 0 ? Number.NaN : a / b,
        modulo: b === 0 ? Number.NaN : a % b,
        power: a ** b,
        min: Math.min(a, b),
        max: Math.max(a, b),
      }[data.operator];
      if (!Number.isFinite(result)) throw new Error("Can't divide by 0");
      ctx.vars.set(data.variable, result);
    }),

    defineNode(m.textOp, (ctx, data) => {
      const input = data.input;
      const result = {
        uppercase: () => input.toLocaleUpperCase(),
        lowercase: () => input.toLocaleLowerCase(),
        trim: () => input.trim(),
        length: () => input.length,
        replace: () => (data.find ? input.split(data.find).join(data.replaceWith) : input),
        split: () => input.split(data.find || " ").filter(Boolean),
      }[data.operation]();
      ctx.vars.set(data.variable, result);
    }),

    defineNode(m.httpRequest, async (ctx, data) => {
      const withBody = ["POST", "PUT", "PATCH"].includes(data.method) && data.body.trim();
      try {
        const res = await fetch(data.url, {
          method: data.method,
          headers: withBody ? { "content-type": "application/json" } : undefined,
          body: withBody ? data.body : undefined,
          signal: AbortSignal.timeout(10_000),
        });
        const text = await res.text();
        let value: unknown = text;
        try {
          value = JSON.parse(text);
        } catch {}
        ctx.vars.set(data.variable, value);
        ctx.vars.set(`${data.variable}Status`, res.status);
        return res.ok ? "next" : "error";
      } catch (e) {
        ctx.vars.set(`${data.variable}Status`, 0);
        ctx.log("warn", `HTTP ${data.method} ${data.url} failed: ${(e as Error).message}`);
        return "error";
      }
    }),

    defineNode(m.storeGet, (ctx, data) => {
      ctx.vars.set(data.variable, ctx.store.get(data.key) ?? data.fallback);
    }),

    defineNode(m.storeSet, (ctx, data) => {
      const n = Number(data.value);
      ctx.store.set(data.key, data.value.trim() !== "" && Number.isFinite(n) ? n : data.value);
    }),

    defineNode(m.storeIncrement, (ctx, data) => {
      ctx.vars.set(data.variable, ctx.store.increment(data.key, toNumber(data.by, "By")));
    }),

    defineNode(m.storeDelete, (ctx, data) => {
      ctx.store.delete(data.key);
    }),

    defineNode(m.log, (ctx, data) => {
      ctx.log(data.level, data.message);
    }),

    defineNode(m.replyToMessage, async (ctx, data) => {
      const msg = await messageOf(ctx, data.channelId, data.messageId);
      await msg.reply({
        ...payloadOf(ctx, data),
        allowedMentions: { repliedUser: data.mention },
      });
    }),

    defineNode(m.editMessage, async (ctx, data) => {
      const msg = await messageOf(ctx, data.channelId, data.messageId);
      if (msg.author.id !== ctx.client.user.id)
        throw new Error("The bot can only edit its own messages");
      const payload = payloadOf(ctx, data);
      await msg.edit(
        (payload.flags ?? 0) & COMPONENTS_V2 ? payload : { embeds: [], components: [], ...payload },
      );
    }),

    defineNode(m.pinMessage, async (ctx, data) => {
      const msg = await messageOf(ctx, data.channelId, data.messageId);
      if (data.action === "pin") await msg.pin();
      else await msg.unpin();
    }),

    defineNode(m.purgeMessages, async (ctx, data) => {
      const amount = clampInt(data.amount, "How many", 1, 100);
      const channel = await guildChannel(ctx, data.channelId);
      if (!("bulkDelete" in channel) || !("messages" in channel)) {
        throw new Error("Messages can't be deleted in bulk in this channel");
      }
      const from = data.fromUser.trim();
      let deleted = 0;
      if (from) {
        const recent = await channel.messages.fetch({ limit: 100 });
        const mine = recent.filter((msg) => msg.author.id === from).first(amount);
        deleted = (await channel.bulkDelete(mine, true)).size;
      } else {
        deleted = (await channel.bulkDelete(amount, true)).size;
      }
      ctx.vars.set(data.variable, deleted);
    }),

    defineNode(m.getMessage, async (ctx, data) => {
      try {
        const msg = await messageOf(ctx, data.channelId, data.messageId);
        ctx.vars.set(data.variable, {
          id: msg.id,
          content: msg.content,
          url: msg.url,
          authorId: msg.author.id,
          author: msg.author.username,
          createdAt: msg.createdAt.toISOString(),
          pinned: msg.pinned,
          attachments: msg.attachments.map((a) => a.url),
          reactions: msg.reactions.cache.map((r) => ({
            emoji: r.emoji.toString(),
            count: r.count,
          })),
        });
        return "next";
      } catch {
        return "notFound";
      }
    }),

    defineNode(m.removeReactions, async (ctx, data) => {
      const msg = await messageOf(ctx, data.channelId, data.messageId);
      const emoji = data.emoji.trim();
      if (!emoji) {
        await msg.reactions.removeAll();
        return;
      }
      const reaction = msg.reactions.resolve(emoji.replace(/^<a?:\w+:(\d+)>$/, "$1"));
      if (!reaction) return;
      if (data.userId.trim()) await reaction.users.remove(data.userId.trim());
      else await reaction.remove();
    }),

    defineNode(m.createThread, async (ctx, data) => {
      const archive = Number(data.archiveAfter) as 60 | 1440 | 4320 | 10080;
      if (data.messageId.trim()) {
        const msg = await messageOf(ctx, data.channelId, data.messageId.trim());
        const thread = await msg.startThread({ name: data.name, autoArchiveDuration: archive });
        ctx.vars.set(data.variable, thread.id);
        return;
      }
      const channel = await guildChannel(ctx, data.channelId);
      if (!("threads" in channel) || !channel.threads || !("create" in channel.threads)) {
        throw new Error("Threads can't be created in this channel");
      }
      const thread = await (
        channel.threads as {
          create(o: { name: string; autoArchiveDuration: number }): Promise<{ id: string }>;
        }
      ).create({ name: data.name, autoArchiveDuration: archive });
      ctx.vars.set(data.variable, thread.id);
    }),

    defineNode(m.sendPoll, async (ctx, data) => {
      const answers = data.answers
        .split(/\r?\n/)
        .map((l) => l.trim())
        .filter(Boolean)
        .slice(0, 10)
        .map((line) => {
          const match = line.match(/^(\p{Extended_Pictographic}\uFE0F?|<a?:\w+:\d+>)\s+(.+)$/u);
          return match
            ? { emoji: match[1]!, text: match[2]!.slice(0, 55) }
            : { text: line.slice(0, 55) };
        });
      if (answers.length < 1) throw new Error("A poll needs at least one answer");
      const channel = await sendableChannel(ctx, data.channelId);
      await channel.send({
        poll: {
          question: { text: data.question },
          answers,
          duration: clampInt(data.hours, "Hours", 1, 768),
          allowMultiselect: data.multiple,
        },
      });
    }),

    defineNode(m.getMember, async (ctx, data) => {
      try {
        const member = await memberOf(ctx, data.userId);
        ctx.vars.set(data.variable, {
          id: member.id,
          username: member.user.username,
          displayName: member.displayName,
          nickname: member.nickname ?? "",
          mention: `<@${member.id}>`,
          avatar: member.displayAvatarURL(),
          bot: member.user.bot,
          joinedAt: member.joinedAt?.toISOString() ?? "",
          createdAt: member.user.createdAt.toISOString(),
          roles: member.roles.cache.filter((r) => r.id !== member.guild.id).map((r) => r.id),
          roleNames: member.roles.cache.filter((r) => r.id !== member.guild.id).map((r) => r.name),
          highestRole: member.roles.highest.name,
          boosting: Boolean(member.premiumSince),
          timedOutUntil: member.communicationDisabledUntil?.toISOString() ?? "",
          inVoice: member.voice.channelId ?? "",
        });
        return "next";
      } catch {
        return "notFound";
      }
    }),

    defineNode(m.hasRole, async (ctx, data) => {
      const member = await memberOf(ctx, data.userId);
      return member.roles.cache.has(data.roleId) ? "true" : "false";
    }),

    defineNode(m.hasPermission, async (ctx, data) => {
      const member = await memberOf(ctx, data.userId);
      return member.permissions.has(data.permission) ? "true" : "false";
    }),

    defineNode(m.setNickname, async (ctx, data) => {
      const member = await memberOf(ctx, data.userId);
      await member.setNickname(data.nickname.trim() || null, data.reason || undefined);
    }),

    defineNode(m.unban, async (ctx, data) => {
      const guild = await guildOf(ctx);
      await guild.members.unban(data.userId, data.reason || undefined);
    }),

    defineNode(m.moveVoice, async (ctx, data) => {
      const member = await memberOf(ctx, data.userId);
      if (!member.voice.channelId) throw new Error("The member isn't in a voice channel");
      const target = data.channelId.trim();
      if (target) await member.voice.setChannel(target);
      else await member.voice.disconnect();
    }),

    defineNode(m.createRole, async (ctx, data) => {
      const guild = await guildOf(ctx);
      const color = data.color.trim();
      if (color && !/^#?[0-9a-fA-F]{6}$/.test(color)) throw new Error(`Not a hex color: ${color}`);
      const role = await guild.roles.create({
        name: data.name,
        colors: color ? { primaryColor: `#${color.replace("#", "")}` as `#${string}` } : undefined,
        hoist: data.hoist,
        mentionable: data.mentionable,
      });
      ctx.vars.set(data.variable, role.id);
    }),

    defineNode(m.deleteRole, async (ctx, data) => {
      const guild = await guildOf(ctx);
      await guild.roles.delete(data.roleId, data.reason || undefined);
    }),

    defineNode(m.createChannel, async (ctx, data) => {
      const guild = await guildOf(ctx);
      const channel = await guild.channels.create({
        name: data.name,
        type: CHANNEL_TYPES[data.kind],
        parent: data.parentId.trim() || undefined,
        topic:
          data.topic.trim() && data.kind !== "voice" && data.kind !== "category"
            ? data.topic
            : undefined,
        permissionOverwrites: data.private
          ? [
              { id: guild.roles.everyone.id, deny: ["ViewChannel"] },
              { id: ctx.client.user.id, allow: ["ViewChannel", "SendMessages", "ManageChannels"] },
            ]
          : undefined,
      } as Parameters<typeof guild.channels.create>[0]);
      ctx.vars.set(data.variable, channel.id);
    }),

    defineNode(m.deleteChannel, async (ctx, data) => {
      const channel = await ctx.client.channels.fetch(data.channelId);
      if (!channel || channel.isDMBased()) throw new Error(`Channel not found: ${data.channelId}`);
      await channel.delete(data.reason || undefined);
    }),

    defineNode(m.editChannel, async (ctx, data) => {
      const channel = await guildChannel(ctx, data.channelId);
      const changes: Record<string, unknown> = {};
      if (data.name.trim()) changes.name = data.name.trim();
      if (data.topic.trim()) changes.topic = data.topic;
      if (data.slowmode.trim())
        changes.rateLimitPerUser = clampInt(data.slowmode, "Slowmode", 0, 21600);
      if (!Object.keys(changes).length) return;
      await (channel as unknown as { edit(o: Record<string, unknown>): Promise<unknown> }).edit(
        changes,
      );
    }),

    defineNode(m.lockChannel, async (ctx, data) => {
      const channel = await guildChannel(ctx, data.channelId);
      if (!("permissionOverwrites" in channel))
        throw new Error("This channel has no permissions to change");
      const lock = data.action === "lock";
      await channel.permissionOverwrites.edit(
        channel.guild.roles.everyone,
        { SendMessages: lock ? false : null, SendMessagesInThreads: lock ? false : null },
        { reason: data.reason || undefined },
      );
    }),

    defineNode(m.createInvite, async (ctx, data) => {
      const channel = await guildChannel(ctx, data.channelId);
      if (!("createInvite" in channel)) throw new Error("Invites can't be made for this channel");
      const invite = await channel.createInvite({
        maxAge: clampInt(data.hours, "Hours", 0, 168) * 3600,
        maxUses: clampInt(data.maxUses, "Max uses", 0, 100),
        unique: true,
      });
      ctx.vars.set(data.variable, invite.url);
    }),

    defineNode(m.setPresence, (ctx, data) => {
      const text = data.text.trim();
      ctx.client.user.setPresence({
        status: data.status,
        activities:
          data.activity === "none" || !text
            ? []
            : data.activity === "custom"
              ? [{ name: "Custom Status", state: text, type: ACTIVITY_TYPES.custom }]
              : [{ name: text, type: ACTIVITY_TYPES[data.activity] }],
      });
    }),

    defineNode(m.forEach, (ctx, data) => {
      const key = `__each:${ctx.nodeId}`;
      const state = (ctx.vars.get(key) as { items: unknown[]; at: number } | undefined) ?? {
        items: listOf(data.list).slice(0, 500),
        at: 0,
      };
      if (state.at < state.items.length) {
        ctx.vars.set(data.itemVariable, state.items[state.at]);
        ctx.vars.set(data.indexVariable, state.at + 1);
        ctx.vars.set(key, { items: state.items, at: state.at + 1 });
        return "loop";
      }
      ctx.vars.delete(key);
      return "done";
    }),

    defineNode(m.cooldown, (ctx, data) => {
      const seconds = Math.max(0, toNumber(data.seconds, "Seconds"));
      const key = `${ctx.nodeId}:${data.key}`;
      const now = Date.now();
      const until = cooldowns.get(key) ?? 0;
      if (until > now) {
        ctx.vars.set(data.variable, Math.ceil((until - now) / 1000));
        return "cooling";
      }
      cooldowns.set(key, now + seconds * 1000);
      if (cooldowns.size > 10_000) {
        for (const [k, v] of cooldowns) if (v <= now) cooldowns.delete(k);
      }
      ctx.vars.set(data.variable, 0);
      return "next";
    }),

    defineNode(m.timestamp, (ctx, data) => {
      const raw = data.time.trim();
      const ms =
        raw === "" || raw.toLowerCase() === "now"
          ? Date.now()
          : /^\d{9,11}$/.test(raw)
            ? Number(raw) * 1000
            : /^\d{12,14}$/.test(raw)
              ? Number(raw)
              : Date.parse(raw);
      if (!Number.isFinite(ms)) throw new Error(`Not a date: ${raw}`);
      const unix = Math.floor(
        (ms + toNumber(data.addMinutes || "0", "Add minutes") * 60_000) / 1000,
      );
      ctx.vars.set(data.variable, `<t:${unix}:${TIMESTAMP_STYLES[data.style]}>`);
      ctx.vars.set(`${data.variable}Unix`, unix);
    }),

    defineNode(m.randomItem, (ctx, data) => {
      const items = listOf(data.list);
      if (!items.length) throw new Error("The list is empty");
      ctx.vars.set(data.variable, items[Math.floor(Math.random() * items.length)]);
    }),

    defineNode(m.suggest, async (ctx, data) => {
      const i = ctx.eventArgs[0] as
        | {
            isAutocomplete?(): boolean;
            responded: boolean;
            respond(c: { name: string; value: string }[]): Promise<void>;
          }
        | undefined;
      if (!i?.isAutocomplete?.())
        throw new Error("Suggest Choices only works in autocomplete flows");
      if (i.responded) return;
      const typed = String(
        (ctx.scope.focused as { value?: string } | undefined)?.value ?? "",
      ).toLowerCase();
      const choices = listOf(data.choices)
        .map((item) => {
          if (item && typeof item === "object") {
            const o = item as { name?: unknown; label?: unknown; value?: unknown };
            const name = String(o.name ?? o.label ?? o.value ?? "");
            return { name, value: String(o.value ?? name) };
          }
          const [name = "", value] = String(item)
            .split("|")
            .map((p) => p.trim());
          return { name, value: value || name };
        })
        .filter((c) => c.name && (!data.filter || !typed || c.name.toLowerCase().includes(typed)))
        .slice(0, 25)
        .map((c) => ({ name: c.name.slice(0, 100), value: c.value.slice(0, 100) }));
      await i.respond(choices);
    }),
  ],
});
