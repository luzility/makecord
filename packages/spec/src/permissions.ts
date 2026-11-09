export const BOT_PERMISSIONS = {
  Administrator: 3,
  KickMembers: 1,
  BanMembers: 2,
  ManageChannels: 4,
  ManageGuild: 5,
  AddReactions: 6,
  ViewChannel: 10,
  SendMessages: 11,
  ManageMessages: 13,
  EmbedLinks: 14,
  AttachFiles: 15,
  ReadMessageHistory: 16,
  MentionEveryone: 17,
  UseExternalEmojis: 18,
  ManageNicknames: 27,
  ManageRoles: 28,
  ModerateMembers: 40,
} as const;

export type BotPermission = keyof typeof BOT_PERMISSIONS;

export const BASE_BOT_PERMISSIONS: readonly BotPermission[] = [
  "ViewChannel",
  "SendMessages",
  "EmbedLinks",
  "ReadMessageHistory",
];

export const isBotPermission = (name: string): name is BotPermission => name in BOT_PERMISSIONS;

export function permissionBits(names: Iterable<string>): bigint {
  let bits = 0n;
  for (const name of names) {
    if (isBotPermission(name)) bits |= 1n << BigInt(BOT_PERMISSIONS[name]);
  }
  return bits;
}

export const PRIVILEGED_INTENTS = ["GuildMembers", "GuildPresences", "MessageContent"] as const;

export function botIdFromToken(token: string): string | null {
  const head = token.trim().split(".")[0];
  if (!head) return null;
  try {
    const id = atob(
      head
        .replace(/-/g, "+")
        .replace(/_/g, "/")
        .padEnd(Math.ceil(head.length / 4) * 4, "="),
    );
    return /^\d{17,20}$/.test(id) ? id : null;
  } catch {
    return null;
  }
}

export function inviteUrl(opts: {
  clientId: string;
  permissions: Iterable<string>;
  guildId?: string;
}): string {
  const params = new URLSearchParams({
    client_id: opts.clientId,
    permissions: permissionBits(opts.permissions).toString(),
    scope: "bot applications.commands",
  });
  if (opts.guildId) params.set("guild_id", opts.guildId);
  return `https://discord.com/oauth2/authorize?${params.toString()}`;
}
