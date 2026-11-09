import { defineNode, definePlugin } from "@makecord/plugin-sdk";
import * as m from "./meta.js";

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

export default definePlugin({
  id: "core",
  version: "0.1.0",
  engines: { makecord: "^0.1.0" },
  nodes: [
    defineNode(m.trigger, () => "next"),

    defineNode(m.reply, async (ctx, data) => {
      const i = ctx.interaction;
      if (!i) throw new Error("Reply can only be used in command flows");
      const flags = data.ephemeral ? (["Ephemeral"] as const) : undefined;
      if (i.replied || i.deferred) await i.followUp({ content: data.content, flags });
      else await i.reply({ content: data.content, flags });
    }),

    defineNode(m.sendMessage, async (ctx, data) => {
      const channel = await ctx.client.channels.fetch(data.channelId);
      if (!channel?.isSendable())
        throw new Error(`Channel not found or not writable: ${data.channelId}`);
      await channel.send(data.content);
    }),

    defineNode(m.condition, (_ctx, data) =>
      compare(data.left, data.operator, data.right) ? "true" : "false",
    ),

    defineNode(m.setVariable, (ctx, data) => {
      ctx.vars.set(data.name, data.value);
    }),

    defineNode(m.addRole, async (ctx, data) => {
      const guild = ctx.interaction?.guild ?? (ctx.scope.guild as { id?: string } | undefined);
      const guildId = guild && "id" in guild ? guild.id : undefined;
      if (!guildId) throw new Error("Add Role must run inside a server");
      const g = await ctx.client.guilds.fetch(guildId);
      const member = await g.members.fetch(data.userId);
      await member.roles.add(data.roleId);
    }),

    defineNode(m.log, (ctx, data) => {
      ctx.log(data.level, data.message);
    }),
  ],
});
