import type {
  ChatInputCommandInteraction,
  Client,
  Guild,
  GuildMember,
  Message,
  PartialGuildMember,
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
    default:
      return base;
  }
}
