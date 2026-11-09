import type { BuiltMessage } from "@makecord/plugin-sdk";
import type {
  ActionRow,
  ContainerChild,
  Embed,
  LayoutBlock,
  MessageButton,
  MessageDesign,
  MessageSelect,
  ThumbnailBlock,
} from "@makecord/spec";
import type {
  APIActionRowComponent,
  APIButtonComponent,
  APIComponentInContainer,
  APIComponentInMessageActionRow,
  APIEmbed,
  APIMessageComponentEmoji,
  APIMessageTopLevelComponent,
  APISectionAccessoryComponent,
  APISelectMenuComponent,
  APIThumbnailComponent,
} from "discord.js";
import { renderTemplate } from "./templates.js";

const FLAG_COMPONENTS_V2 = 1 << 15;

const BUTTON_STYLE = { primary: 1, secondary: 2, success: 3, danger: 4, link: 5 } as const;

type Scope = Record<string, unknown>;

const clip = (s: string, max: number) => (s.length > max ? s.slice(0, max) : s);

function text(value: string | undefined, scope: Scope, max: number): string | undefined {
  if (value === undefined) return undefined;
  const out = clip(renderTemplate(value, scope).trim(), max);
  return out || undefined;
}

export function parseEmoji(value: string | undefined): APIMessageComponentEmoji | undefined {
  const raw = value?.trim();
  if (!raw) return undefined;
  const custom = raw.match(/^<?(a)?:?([\w~]{2,32}):(\d{17,20})>?$/);
  if (custom) return { name: custom[2], id: custom[3], animated: Boolean(custom[1]) };
  return { name: raw };
}

const color = (hex: string | undefined) => (hex ? Number.parseInt(hex.slice(1), 16) : undefined);

function button(b: MessageButton, scope: Scope): APIButtonComponent {
  const base = {
    type: 2 as const,
    label: text(b.label, scope, 80),
    emoji: parseEmoji(b.emoji),
    disabled: b.disabled || undefined,
  };
  if (b.style === "link") {
    const url = text(b.url, scope, 512);
    if (!url) throw new Error(`Link button "${b.label}" has no URL`);
    return { ...base, style: BUTTON_STYLE.link, url };
  }
  const customId = text(b.customId, scope, 100);
  if (!customId) throw new Error(`Button "${b.label}" has no custom ID`);
  return { ...base, style: BUTTON_STYLE[b.style], custom_id: customId };
}

const SELECT_TYPES = { string: 3, user: 5, role: 6, mentionable: 7, channel: 8 } as const;

function select(s: MessageSelect, scope: Scope): APISelectMenuComponent {
  const base = {
    custom_id: text(s.customId, scope, 100) ?? s.customId,
    placeholder: text(s.placeholder, scope, 150),
    min_values: s.minValues,
    max_values: s.maxValues,
    disabled: s.disabled || undefined,
  };
  if (s.menuType !== "string") {
    return { ...base, type: SELECT_TYPES[s.menuType] } as APISelectMenuComponent;
  }
  return {
    ...base,
    type: 3,
    options: s.options.map((o) => ({
      label: text(o.label, scope, 100) ?? o.label,
      value: text(o.value, scope, 100) ?? o.value,
      description: text(o.description, scope, 100),
      emoji: parseEmoji(o.emoji),
      default: o.default || undefined,
    })),
  };
}

function row(r: ActionRow, scope: Scope): APIActionRowComponent<APIComponentInMessageActionRow> {
  return {
    type: 1,
    components: r.components.map((c) =>
      c.type === "button" ? button(c, scope) : select(c, scope),
    ),
  };
}

function embed(e: Embed, scope: Scope): APIEmbed | undefined {
  const authorName = text(e.author?.name, scope, 256);
  const footerText = text(e.footer?.text, scope, 2048);
  const thumbnail = text(e.thumbnail, scope, 512);
  const image = text(e.image, scope, 512);
  const out: APIEmbed = {
    title: text(e.title, scope, 256),
    description: text(e.description, scope, 4096),
    url: text(e.url, scope, 512),
    color: color(e.color),
    author: authorName
      ? {
          name: authorName,
          url: text(e.author?.url, scope, 512),
          icon_url: text(e.author?.iconUrl, scope, 512),
        }
      : undefined,
    thumbnail: thumbnail ? { url: thumbnail } : undefined,
    image: image ? { url: image } : undefined,
    footer: footerText
      ? { text: footerText, icon_url: text(e.footer?.iconUrl, scope, 512) }
      : undefined,
    timestamp: e.timestamp ? new Date().toISOString() : undefined,
    fields: e.fields
      .map((f) => ({
        name: text(f.name, scope, 256) ?? "​",
        value: text(f.value, scope, 1024) ?? "​",
        inline: f.inline,
      }))
      .filter((f) => f.name !== "​" || f.value !== "​"),
  };
  const visible =
    out.title ||
    out.description ||
    out.author ||
    out.image ||
    out.thumbnail ||
    out.footer ||
    out.fields?.length;
  return visible ? out : undefined;
}

function thumbnail(t: ThumbnailBlock, scope: Scope): APIThumbnailComponent {
  const url = text(t.url, scope, 512);
  if (!url) throw new Error("A thumbnail has no image URL");
  return {
    type: 11,
    media: { url },
    description: text(t.description, scope, 1024),
    spoiler: t.spoiler || undefined,
  };
}

function child(b: ContainerChild, scope: Scope): APIComponentInContainer | undefined {
  switch (b.type) {
    case "text": {
      const content = text(b.content, scope, 4000);
      return content ? { type: 10, content } : undefined;
    }
    case "section": {
      const texts = b.texts
        .map((t) => text(t, scope, 4000))
        .filter((t): t is string => Boolean(t))
        .map((content) => ({ type: 10 as const, content }));
      if (!texts.length) return undefined;
      const accessory: APISectionAccessoryComponent =
        b.accessory.type === "button" ? button(b.accessory, scope) : thumbnail(b.accessory, scope);
      return { type: 9, components: texts, accessory };
    }
    case "gallery": {
      const items = b.items
        .map((i) => ({
          url: text(i.url, scope, 512),
          description: text(i.description, scope, 1024),
          spoiler: i.spoiler,
        }))
        .filter(
          (
            i,
          ): i is { url: string; description: string | undefined; spoiler: boolean | undefined } =>
            Boolean(i.url),
        )
        .map((i) => ({
          media: { url: i.url },
          description: i.description,
          spoiler: i.spoiler || undefined,
        }));
      return items.length ? { type: 12, items } : undefined;
    }
    case "separator":
      return { type: 14, divider: b.divider, spacing: b.spacing === "large" ? 2 : 1 };
    case "row":
      return row(b, scope);
  }
}

function layout(b: LayoutBlock, scope: Scope): APIMessageTopLevelComponent | undefined {
  if (b.type !== "container") return child(b, scope);
  const components = b.components
    .map((c) => child(c, scope))
    .filter((c): c is APIComponentInContainer => Boolean(c));
  if (!components.length) return undefined;
  return {
    type: 17,
    accent_color: color(b.accentColor),
    spoiler: b.spoiler || undefined,
    components,
  };
}

export function buildMessage(design: MessageDesign, scope: Scope): BuiltMessage {
  if (design.kind === "componentsV2") {
    const components = design.components
      .map((b) => layout(b, scope))
      .filter((c): c is APIMessageTopLevelComponent => Boolean(c));
    if (!components.length)
      throw new Error("This message has nothing to show after filling in variables");
    return { components, flags: FLAG_COMPONENTS_V2 };
  }
  const content = text(design.content, scope, 2000);
  const embeds = design.embeds.map((e) => embed(e, scope)).filter((e): e is APIEmbed => Boolean(e));
  if (!content && !embeds.length)
    throw new Error("This message has nothing to show after filling in variables");
  return {
    content,
    embeds,
    components: design.components.map((r) => row(r, scope)),
  };
}
