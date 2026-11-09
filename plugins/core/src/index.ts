import { defineNode, definePlugin, type NodeContext } from "@makecord/plugin-sdk";
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
  engines: { makecord: "^0.1.0" },
  nodes: [
    defineNode(m.trigger, () => "next"),

    defineNode(m.reply, async (ctx, data) => {
      const i = requireInteraction(ctx);
      const flags = data.ephemeral ? (["Ephemeral"] as const) : undefined;
      if (i.deferred && !i.replied) await i.editReply({ content: data.content });
      else if (i.replied) await i.followUp({ content: data.content, flags });
      else await i.reply({ content: data.content, flags });
    }),

    defineNode(m.deferReply, async (ctx, data) => {
      const i = requireInteraction(ctx);
      if (!i.deferred && !i.replied) {
        await i.deferReply({ flags: data.ephemeral ? ["Ephemeral"] : undefined });
      }
    }),

    defineNode(m.sendMessage, async (ctx, data) => {
      await (await sendableChannel(ctx, data.channelId)).send(data.content);
    }),

    defineNode(m.sendDM, async (ctx, data) => {
      try {
        const user = await ctx.client.users.fetch(data.userId);
        await user.send(data.content);
        return "next";
      } catch (e) {
        ctx.log("warn", `Couldn't DM ${data.userId}: ${(e as Error).message}`);
        return "failed";
      }
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
  ],
});
