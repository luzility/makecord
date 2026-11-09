import type {
  ChatInputCommandInteraction,
  Client,
  Guild,
  GuildMember,
  Message,
  MessageComponentInteraction,
  MessageReaction,
  ModalSubmitInteraction,
  PartialGuildMember,
  PartialMessage,
  PartialMessageReaction,
  PartialUser,
  User,
} from "discord.js";

const user = (u: User) => ({
  id: u.id,
  username: u.username,
  displayName: u.displayName,
  mention: `<@${u.id}>`,
  avatar: u.displayAvatarURL(),
  bot: u.bot,
});

const guild = (g: Guild) => ({ id: g.id, name: g.name, memberCount: g.memberCount });

const member = (m: GuildMember | PartialGuildMember) => ({
  id: m.id,
  nickname: m.nickname,
  displayName: m.displayName,
  joinedAt: m.joinedAt?.toISOString(),
});

const client = (c: Client<true>) => ({ ping: c.ws.ping, tag: c.user.tag, id: c.user.id });

const message = (msg: Message | PartialMessage) => ({
  id: msg.id,
  content: msg.content ?? "",
  url: msg.url,
});

const channelOf = (ch: { id: string; name?: string | null } | null | undefined) =>
  ch ? { id: ch.id, name: ch.name ?? undefined } : undefined;

export function interactionScope(
  i: MessageComponentInteraction | ModalSubmitInteraction,
): Record<string, unknown> {
  const values = i.isAnySelectMenu() ? [...i.values] : [];
  const fields = i.isModalSubmit()
    ? Object.fromEntries(
        i.fields.fields.map((f) => [f.customId, "value" in f ? String(f.value) : ""]),
      )
    : {};
  return {
    client: client(i.client),
    user: user(i.user),
    guild: i.guild ? guild(i.guild) : undefined,
    channel: i.channel ? channelOf(i.channel as { id: string; name?: string | null }) : undefined,
    member: i.member && "joinedAt" in i.member ? member(i.member) : undefined,
    message: i.message ? message(i.message) : undefined,
    customId: i.customId,
    values,
    value: values[0] ?? "",
    fields,
  };
}

export function commandScope(i: ChatInputCommandInteraction): Record<string, unknown> {
  const options = Object.fromEntries(
    i.options.data.map((o) => [o.name, o.user?.id ?? o.channel?.id ?? o.role?.id ?? o.value]),
  );
  return {
    client: client(i.client),
    user: user(i.user),
    guild: i.guild ? guild(i.guild) : undefined,
    channel: i.channel
      ? { id: i.channel.id, name: "name" in i.channel ? i.channel.name : undefined }
      : undefined,
    member: i.member && "joinedAt" in i.member ? member(i.member) : undefined,
    options,
  };
}

export function eventScope(
  c: Client<true>,
  event: string,
  args: unknown[],
): Record<string, unknown> {
  const base = { client: client(c) };
  switch (event) {
    case "guildMemberAdd":
    case "guildMemberRemove": {
      const m = args[0] as GuildMember | PartialGuildMember;
      return { ...base, user: user(m.user), member: member(m), guild: guild(m.guild) };
    }
    case "messageCreate": {
      const msg = args[0] as Message;
      return {
        ...base,
        user: user(msg.author),
        guild: msg.guild ? guild(msg.guild) : undefined,
        channel: { id: msg.channelId },
        message: { id: msg.id, content: msg.content, url: msg.url },
      };
    }
    case "messageUpdate": {
      const [before, after] = args as [Message | PartialMessage, Message | PartialMessage];
      return {
        ...base,
        user: after.author ? user(after.author) : undefined,
        guild: after.guild ? guild(after.guild) : undefined,
        channel: { id: after.channelId },
        message: message(after),
        before: { content: before.content ?? "" },
      };
    }
    case "messageDelete": {
      const msg = args[0] as Message | PartialMessage;
      return {
        ...base,
        user: msg.author ? user(msg.author) : undefined,
        guild: msg.guild ? guild(msg.guild) : undefined,
        channel: { id: msg.channelId },
        message: message(msg),
      };
    }
    case "messageReactionAdd": {
      const [reaction, by] = args as [MessageReaction | PartialMessageReaction, User | PartialUser];
      const msg = reaction.message;
      return {
        ...base,
        user:
          "username" in by && by.username !== null
            ? user(by as User)
            : { id: by.id, mention: `<@${by.id}>` },
        guild: msg.guild ? guild(msg.guild) : undefined,
        channel: { id: msg.channelId },
        message: message(msg),
        emoji: {
          name: reaction.emoji.name ?? "",
          id: reaction.emoji.id ?? "",
          text: reaction.emoji.toString(),
        },
      };
    }
    case "schedule": {
      const now = new Date();
      return {
        ...base,
        now: {
          iso: now.toISOString(),
          date: now.toISOString().slice(0, 10),
          time: now.toTimeString().slice(0, 5),
          weekday: now.getDay(),
        },
      };
    }
    default:
      return base;
  }
}
