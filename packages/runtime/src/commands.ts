import type { CommandFlow, CommandOption, CommandOptionType, PermissionName } from "@makecord/spec";
import {
  type ApplicationCommandData,
  type ApplicationCommandOptionData,
  ApplicationCommandOptionType,
  ApplicationCommandType,
  InteractionContextType,
  PermissionFlagsBits,
} from "discord.js";

const OPTION_TYPES: Record<CommandOptionType, ApplicationCommandOptionType> = {
  string: ApplicationCommandOptionType.String,
  integer: ApplicationCommandOptionType.Integer,
  number: ApplicationCommandOptionType.Number,
  boolean: ApplicationCommandOptionType.Boolean,
  user: ApplicationCommandOptionType.User,
  channel: ApplicationCommandOptionType.Channel,
  role: ApplicationCommandOptionType.Role,
  mentionable: ApplicationCommandOptionType.Mentionable,
  attachment: ApplicationCommandOptionType.Attachment,
};

const NUMERIC = new Set<CommandOptionType>(["integer", "number"]);

export function optionData(o: CommandOption): ApplicationCommandOptionData {
  const numeric = NUMERIC.has(o.type);
  const text = o.type === "string";
  const choices =
    o.choices?.length && (numeric || text)
      ? o.choices.map((c) => ({ name: c.name, value: text ? c.value : Number(c.value) }))
      : undefined;
  return {
    name: o.name,
    description: o.description,
    type: OPTION_TYPES[o.type],
    required: o.required,
    choices,
    autocomplete: !choices && (numeric || text) && o.autocomplete ? true : undefined,
    minValue: numeric ? o.minValue : undefined,
    maxValue: numeric ? o.maxValue : undefined,
    minLength: text ? o.minLength : undefined,
    maxLength: text ? o.maxLength : undefined,
  } as ApplicationCommandOptionData;
}

const permissionBits = (names: Iterable<PermissionName>) => {
  let bits = 0n;
  for (const p of names) bits |= PermissionFlagsBits[p];
  return bits || undefined;
};

export function buildCommands(flows: readonly CommandFlow[]): ApplicationCommandData[] {
  const groups = new Map<string, CommandFlow[]>();
  for (const flow of flows) {
    const key = `${flow.command.type}:${flow.command.name}`;
    const list = groups.get(key) ?? [];
    list.push(flow);
    groups.set(key, list);
  }
  const out: ApplicationCommandData[] = [];
  for (const list of groups.values()) {
    const first = list[0]!.command;
    const perms = new Set(list.flatMap((f) => f.command.permissions ?? []));
    const shared = {
      name: first.name,
      defaultMemberPermissions: perms.size ? permissionBits(perms) : undefined,
      contexts: list.some((f) => f.command.dms)
        ? [InteractionContextType.Guild, InteractionContextType.BotDM]
        : [InteractionContextType.Guild],
    };
    if (first.type === "user" || first.type === "message") {
      out.push({
        ...shared,
        type: first.type === "user" ? ApplicationCommandType.User : ApplicationCommandType.Message,
      });
      continue;
    }
    const subs = list.filter((f) => f.command.subcommand);
    if (!subs.length) {
      out.push({
        ...shared,
        type: ApplicationCommandType.ChatInput,
        description: first.description,
        options: first.options.map(optionData),
      });
      continue;
    }
    const options: ApplicationCommandOptionData[] = [];
    const groupsByName = new Map<string, { options: ApplicationCommandOptionData[] }>();
    for (const f of subs) {
      const sub = f.command.subcommand!;
      const data = {
        type: ApplicationCommandOptionType.Subcommand,
        name: sub.name,
        description: sub.description,
        options: f.command.options.map(optionData),
      } as ApplicationCommandOptionData;
      const g = f.command.group;
      if (!g) {
        options.push(data);
        continue;
      }
      let group = groupsByName.get(g.name);
      if (!group) {
        group = {
          type: ApplicationCommandOptionType.SubcommandGroup,
          name: g.name,
          description: g.description,
          options: [],
        } as unknown as { options: ApplicationCommandOptionData[] };
        groupsByName.set(g.name, group);
        options.push(group as unknown as ApplicationCommandOptionData);
      }
      group.options.push(data);
    }
    out.push({
      ...shared,
      type: ApplicationCommandType.ChatInput,
      description: (subs.find((f) => f.command.description.trim()) ?? subs[0]!).command.description,
      options,
    });
  }
  return out;
}

interface Routable {
  commandName: string;
  commandType: ApplicationCommandType;
  options?: unknown;
}

interface SubcommandOptions {
  getSubcommandGroup?(required: false): string | null;
  getSubcommand?(required: false): string | null;
}

export function routeKey(i: Routable): string {
  if (i.commandType === ApplicationCommandType.User) return `user:${i.commandName}`;
  if (i.commandType === ApplicationCommandType.Message) return `message:${i.commandName}`;
  const options = i.options as SubcommandOptions | undefined;
  const group = options?.getSubcommandGroup?.(false);
  const sub = options?.getSubcommand?.(false);
  return [i.commandName, group, sub].filter(Boolean).join(" ");
}
