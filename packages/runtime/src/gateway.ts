import type { Client } from "discord.js";
import type { Emit } from "./reporter.js";

type Data = Record<string, any>;

const SKIP = new Set(["PRESENCE_UPDATE", "TYPING_START", "GUILD_MEMBERS_CHUNK", "RESUMED"]);
const PER_SECOND = 40;

const clip = (s: unknown, n = 80) => {
  const text = String(s ?? "")
    .replace(/\s+/g, " ")
    .trim();
  return text.length > n ? `${text.slice(0, n)}…` : text;
};

function summarize(client: Client, t: string, d: Data): string {
  const guild = d?.guild_id ? client.guilds.cache.get(d.guild_id)?.name : undefined;
  const channel = d?.channel_id
    ? (client.channels.cache.get(d.channel_id) as { name?: string } | undefined)?.name
    : undefined;
  const where = [guild, channel && `#${channel}`].filter(Boolean).join(" ");
  const user = d?.author?.username ?? d?.user?.username ?? d?.member?.user?.username;
  const parts: string[] = [];
  switch (t) {
    case "READY":
      parts.push(`${d.user?.username} · ${d.guilds?.length ?? 0} servers`);
      break;
    case "GUILD_CREATE":
      parts.push(`${d.name} · ${d.member_count ?? "?"} members`);
      break;
    case "MESSAGE_CREATE":
    case "MESSAGE_UPDATE":
      parts.push(where, user ? `${user}:` : "", clip(d.content));
      break;
    case "INTERACTION_CREATE": {
      const name =
        d.type === 2 || d.type === 4
          ? `/${d.data?.name}`
          : d.type === 3 || d.type === 5
            ? d.data?.custom_id
            : `type ${d.type}`;
      parts.push(name, user ? `by ${user}` : "", where);
      break;
    }
    case "MESSAGE_REACTION_ADD":
    case "MESSAGE_REACTION_REMOVE":
      parts.push(d.emoji?.name ?? "", where);
      break;
    default:
      parts.push(where, user ?? "", d?.name ?? "");
  }
  return parts.filter(Boolean).join(" ").trim() || t.toLowerCase();
}

export function watchGateway(
  client: Client,
  emit: Emit,
  isHandled: (t: string, d: Data) => boolean,
) {
  let windowStart = 0;
  let count = 0;
  let dropped = 0;
  const onRaw = (packet: { t?: string | null; d?: Data; op?: number }) => {
    if (packet.op !== 0 || !packet.t || SKIP.has(packet.t)) return;
    const now = Date.now();
    if (now - windowStart >= 1000) {
      if (dropped) {
        emit({
          type: "gateway",
          event: "…",
          summary: `${dropped} more events skipped to keep the IDE fast`,
        });
      }
      windowStart = now;
      count = 0;
      dropped = 0;
    }
    if (++count > PER_SECOND) {
      dropped++;
      return;
    }
    const d = packet.d ?? {};
    emit({
      type: "gateway",
      event: packet.t,
      summary: summarize(client, packet.t, d),
      handled: isHandled(packet.t, d),
    });
  };
  client.on("raw" as never, onRaw as never);
  return () => client.off("raw" as never, onRaw as never);
}
