import type {
  AnySelectMenuInteraction,
  AutocompleteInteraction,
  AutoModerationActionExecution,
  ButtonInteraction,
  ChatInputCommandInteraction,
  Client,
  CommandInteractionOption,
  Guild,
  GuildBan,
  GuildMember,
  Invite,
  Message,
  MessageContextMenuCommandInteraction,
  MessageReaction,
  ModalSubmitInteraction,
  NonThreadGuildBasedChannel,
  PartialGuildMember,
  PartialMessage,
  PartialMessageReaction,
  PartialUser,
  PollAnswer,
  Role,
  ThreadChannel,
  User,
  UserContextMenuCommandInteraction,
  VoiceState,
} from "discord.js";

type Scope = Record<string, unknown>;

const user = (u: User) => ({
  id: u.id,
  username: u.username,
  displayName: u.displayName,
  mention: `<@${u.id}>`,
  avatar: u.displayAvatarURL(),
  bot: u.bot,
  createdAt: u.createdAt.toISOString(),
});

const userLike = (u: User | PartialUser | null | undefined) =>
  !u ? undefined : u.partial ? { id: u.id, mention: `<@${u.id}>` } : user(u as User);

const guild = (g: Guild) => ({
  id: g.id,
  name: g.name,
  memberCount: g.memberCount,
  icon: g.iconURL() ?? "",
  ownerId: g.ownerId,
  boosts: g.premiumSubscriptionCount ?? 0,
  systemChannel: g.systemChannelId ?? "",
});

const roleRef = (r: Role) => ({
  id: r.id,
  name: r.name,
  mention: `<@&${r.id}>`,
  color: r.hexColor,
});

const member = (m: GuildMember | PartialGuildMember) => ({
  id: m.id,
  nickname: m.nickname,
  displayName: m.displayName,
  joinedAt: m.joinedAt?.toISOString(),
  roles: m.roles.cache.filter((r) => r.id !== m.guild.id).map((r) => r.id),
  boosting: Boolean(m.premiumSince),
  timedOutUntil: m.communicationDisabledUntil?.toISOString() ?? "",
});

const client = (c: Client<true>) => ({
  ping: c.ws.ping,
  tag: c.user.tag,
  id: c.user.id,
  mention: `<@${c.user.id}>`,
  servers: c.guilds.cache.size,
});

const message = (msg: Message | PartialMessage) => ({
  id: msg.id,
  content: msg.content ?? "",
  url: msg.url,
  authorId: msg.author?.id ?? "",
  attachments: msg.attachments?.map((a) => a.url) ?? [],
  mentions: msg.mentions?.users?.map((u) => u.id) ?? [],
});

const channelOf = (ch: { id: string; name?: string | null; type?: number } | null | undefined) =>
  ch ? { id: ch.id, name: ch.name ?? "", mention: `<#${ch.id}>`, type: ch.type } : undefined;

const base = (c: Client<true>, g?: Guild | null): Scope => ({
  client: client(c),
  guild: g ? guild(g) : undefined,
});

function flattenOptions(data: readonly CommandInteractionOption[]): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const o of data) {
    if (o.options?.length) Object.assign(out, flattenOptions(o.options));
    else
      out[o.name] = o.user?.id ?? o.channel?.id ?? o.role?.id ?? o.attachment?.url ?? o.value ?? "";
  }
  return out;
}

const actor = (i: {
  client: Client<true>;
  user: User;
  guild: Guild | null;
  channel: unknown;
  member: unknown;
}): Scope => ({
  ...base(i.client, i.guild),
  user: user(i.user),
  channel: channelOf(i.channel as { id: string; name?: string | null }),
  member:
    i.member && typeof i.member === "object" && "joinedAt" in i.member
      ? member(i.member as GuildMember)
      : undefined,
});

export function interactionScope(
  i: ButtonInteraction | AnySelectMenuInteraction | ModalSubmitInteraction,
): Scope {
  const values = i.isAnySelectMenu() ? [...i.values] : [];
  const fields = i.isModalSubmit()
    ? Object.fromEntries(
        i.fields.fields.map((f) => [f.customId, "value" in f ? String(f.value) : ""]),
      )
    : {};
  return {
    ...actor(i),
    message: i.message ? message(i.message) : undefined,
    customId: i.customId,
    values,
    value: values[0] ?? "",
    fields,
  };
}

export function commandScope(i: ChatInputCommandInteraction): Scope {
  return {
    ...actor(i),
    options: flattenOptions(i.options.data),
    command: {
      name: i.commandName,
      group: i.options.getSubcommandGroup(false) ?? "",
      subcommand: i.options.getSubcommand(false) ?? "",
    },
  };
}

export function contextMenuScope(
  i: UserContextMenuCommandInteraction | MessageContextMenuCommandInteraction,
): Scope {
  if (i.isUserContextMenuCommand()) {
    return {
      ...actor(i),
      target: user(i.targetUser),
      targetMember:
        i.targetMember && "joinedAt" in i.targetMember ? member(i.targetMember) : undefined,
    };
  }
  const msg = (i as MessageContextMenuCommandInteraction).targetMessage;
  return {
    ...actor(i),
    message: message(msg),
    target: user(msg.author),
  };
}

export function autocompleteScope(i: AutocompleteInteraction): Scope {
  const focused = i.options.getFocused(true);
  return {
    ...actor(i),
    options: flattenOptions(i.options.data),
    focused: { name: focused.name, value: String(focused.value ?? "") },
    command: {
      name: i.commandName,
      group: i.options.getSubcommandGroup(false) ?? "",
      subcommand: i.options.getSubcommand(false) ?? "",
    },
  };
}

type Builder = (c: Client<true>, args: any) => Scope;

const memberEvent: Builder = (c, [m]: [GuildMember | PartialGuildMember]) => ({
  ...base(c, m.guild),
  user: userLike(m.user),
  member: member(m),
});

const messageEvent: Builder = (c, [msg]: [Message | PartialMessage]) => ({
  ...base(c, msg.guild),
  user: userLike(msg.author),
  channel: channelOf(msg.channel as { id: string; name?: string | null }) ?? { id: msg.channelId },
  message: message(msg),
});

const reactionEvent: Builder = (
  c,
  [reaction, by]: [MessageReaction | PartialMessageReaction, User | PartialUser],
) => {
  const msg = reaction.message;
  return {
    ...base(c, msg.guild),
    user: userLike(by),
    channel: { id: msg.channelId, mention: `<#${msg.channelId}>` },
    message: message(msg),
    emoji: {
      name: reaction.emoji.name ?? "",
      id: reaction.emoji.id ?? "",
      text: reaction.emoji.toString(),
    },
  };
};

const channelEvent: Builder = (c, [ch]: [NonThreadGuildBasedChannel]) => ({
  ...base(c, ch.guild),
  channel: channelOf(ch),
});

const roleEvent: Builder = (c, [role]: [Role]) => ({
  ...base(c, role.guild),
  role: roleRef(role),
});

const banEvent: Builder = (c, [ban]: [GuildBan]) => ({
  ...base(c, ban.guild),
  user: user(ban.user),
  reason: ban.reason ?? "",
});

export const EVENT_SCOPES: Record<string, Builder> = {
  clientReady: (c) => base(c),
  guildCreate: (c, [g]: [Guild]) => base(c, g),
  guildDelete: (c, [g]: [Guild]) => base(c, g),
  guildMemberAdd: memberEvent,
  guildMemberRemove: memberEvent,
  guildMemberUpdate: (c, [before, after]: [GuildMember | PartialGuildMember, GuildMember]) => {
    const had = new Set(before.roles?.cache.keys() ?? []);
    const has = new Set(after.roles.cache.keys());
    const added = before.partial
      ? []
      : after.roles.cache.filter((r) => !had.has(r.id)).map(roleRef);
    const removed = before.partial
      ? []
      : before.roles.cache.filter((r) => !has.has(r.id)).map(roleRef);
    return {
      ...memberEvent(c, [after]),
      before: { nickname: before.nickname ?? "", displayName: before.displayName ?? "" },
      roles: {
        added,
        removed,
        addedIds: added.map((r) => r.id),
        removedIds: removed.map((r) => r.id),
      },
      boosted: !before.premiumSince && Boolean(after.premiumSince),
      timedOut: !before.communicationDisabledUntil && Boolean(after.communicationDisabledUntil),
    };
  },
  guildBanAdd: banEvent,
  guildBanRemove: banEvent,
  messageCreate: messageEvent,
  messageDelete: messageEvent,
  messageUpdate: (c, [before, after]: [Message | PartialMessage, Message | PartialMessage]) => ({
    ...messageEvent(c, [after]),
    before: { content: before.content ?? "" },
  }),
  messageReactionAdd: reactionEvent,
  messageReactionRemove: reactionEvent,
  messagePollVoteAdd: (c, [answer, userId]: [PollAnswer, string]) => {
    const msg = answer.poll?.message;
    return {
      ...base(c, msg?.guild),
      user: { id: userId, mention: `<@${userId}>` },
      channel: msg ? { id: msg.channelId, mention: `<#${msg.channelId}>` } : undefined,
      message: msg ? { id: msg.id, url: msg.url } : undefined,
      answer: { id: answer.id, text: answer.text ?? "", votes: answer.voteCount ?? 0 },
      poll: { question: answer.poll?.question?.text ?? "" },
    };
  },
  voiceStateUpdate: (c, [before, after]: [VoiceState, VoiceState]) => {
    const action = !before.channelId
      ? "join"
      : !after.channelId
        ? "leave"
        : before.channelId !== after.channelId
          ? "move"
          : "update";
    return {
      ...base(c, after.guild),
      user: userLike(after.member?.user),
      member: after.member ? member(after.member) : undefined,
      voice: {
        action,
        channel: channelOf(after.channel) ?? { id: "", name: "" },
        before: channelOf(before.channel) ?? { id: "", name: "" },
        muted: Boolean(after.mute),
        deafened: Boolean(after.deaf),
        streaming: Boolean(after.streaming),
      },
    };
  },
  channelCreate: channelEvent,
  channelDelete: channelEvent,
  threadCreate: (c, [thread]: [ThreadChannel]) => ({
    ...base(c, thread.guild),
    thread: {
      ...channelOf(thread),
      parentId: thread.parentId ?? "",
      ownerId: thread.ownerId ?? "",
    },
    channel: channelOf(thread),
    user: thread.ownerId ? { id: thread.ownerId, mention: `<@${thread.ownerId}>` } : undefined,
  }),
  roleCreate: roleEvent,
  roleDelete: roleEvent,
  inviteCreate: (c, [invite]: [Invite]) => ({
    ...base(c, invite.guild && "members" in invite.guild ? (invite.guild as Guild) : null),
    user: userLike(invite.inviter),
    channel: channelOf(invite.channel as { id: string; name?: string | null } | null),
    invite: {
      code: invite.code,
      url: invite.url,
      maxUses: invite.maxUses ?? 0,
      expiresAt: invite.expiresAt?.toISOString() ?? "",
    },
  }),
  autoModerationActionExecution: (c, [exec]: [AutoModerationActionExecution]) => ({
    ...base(c, exec.guild),
    user: userLike(exec.user) ?? { id: exec.userId, mention: `<@${exec.userId}>` },
    channel: exec.channelId ? { id: exec.channelId, mention: `<#${exec.channelId}>` } : undefined,
    message: { id: exec.messageId ?? "", content: exec.content },
    automod: {
      rule: exec.autoModerationRule?.name ?? exec.ruleId,
      keyword: exec.matchedKeyword ?? "",
      matched: exec.matchedContent ?? "",
      action: exec.action.type,
    },
  }),
  schedule: (c) => {
    const now = new Date();
    return {
      ...base(c),
      now: {
        iso: now.toISOString(),
        date: now.toISOString().slice(0, 10),
        time: now.toTimeString().slice(0, 5),
        weekday: now.getDay(),
        unix: Math.floor(now.getTime() / 1000),
      },
    };
  },
};

export function eventScope(c: Client<true>, event: string, args: unknown[]): Scope {
  return (EVENT_SCOPES[event] ?? ((cl) => base(cl)))(c, args);
}
