import { z } from "zod";
import { SPEC_VERSION } from "./project.js";

const HEX_COLOR = /^#[0-9a-fA-F]{6}$/;

export const ButtonStyle = z.enum(["primary", "secondary", "success", "danger", "link"]);
export type ButtonStyle = z.infer<typeof ButtonStyle>;

export const MessageButton = z
  .object({
    type: z.literal("button"),
    style: ButtonStyle.default("primary"),
    label: z.string().max(80).default(""),
    emoji: z.string().max(100).optional(),
    customId: z.string().max(100).optional(),
    url: z.string().max(512).optional(),
    disabled: z.boolean().optional(),
  })
  .refine((b) => b.label.trim() || b.emoji?.trim(), {
    message: "A button needs a label or an emoji",
    path: ["label"],
  })
  .refine((b) => (b.style === "link" ? !!b.url?.trim() : !!b.customId?.trim()), {
    message: "Link buttons need a URL, other buttons need a custom ID",
    path: ["customId"],
  });
export type MessageButton = z.infer<typeof MessageButton>;

export const SelectOption = z.object({
  label: z.string().min(1).max(100),
  value: z.string().min(1).max(100),
  description: z.string().max(100).optional(),
  emoji: z.string().max(100).optional(),
  default: z.boolean().optional(),
});
export type SelectOption = z.infer<typeof SelectOption>;

export const SelectMenuType = z.enum(["string", "user", "role", "mentionable", "channel"]);
export type SelectMenuType = z.infer<typeof SelectMenuType>;

export const MessageSelect = z
  .object({
    type: z.literal("select"),
    menuType: SelectMenuType.default("string"),
    customId: z.string().min(1).max(100),
    placeholder: z.string().max(150).optional(),
    minValues: z.number().int().min(0).max(25).optional(),
    maxValues: z.number().int().min(1).max(25).optional(),
    disabled: z.boolean().optional(),
    options: z.array(SelectOption).max(25).default([]),
  })
  .refine((s) => s.menuType !== "string" || s.options.length > 0, {
    message: "A menu of your own options needs at least one option",
    path: ["options"],
  })
  .refine((s) => (s.minValues ?? 1) <= (s.maxValues ?? 1), {
    message: "Min picks can't be more than max picks",
    path: ["minValues"],
  })
  .refine((s) => s.menuType !== "string" || (s.maxValues ?? 1) <= s.options.length, {
    message: "Max picks can't be more than the number of options",
    path: ["maxValues"],
  });
export type MessageSelect = z.infer<typeof MessageSelect>;

export const ActionRow = z
  .object({
    type: z.literal("row"),
    components: z
      .array(z.union([MessageButton, MessageSelect]))
      .min(1)
      .max(5),
  })
  .refine((r) => r.components.every((c) => c.type === "button") || r.components.length === 1, {
    message: "A row holds up to 5 buttons or a single menu",
    path: ["components"],
  });
export type ActionRow = z.infer<typeof ActionRow>;

export const EmbedField = z.object({
  name: z.string().min(1).max(256),
  value: z.string().min(1).max(1024),
  inline: z.boolean().default(false),
});
export type EmbedField = z.infer<typeof EmbedField>;

export const Embed = z.object({
  title: z.string().max(256).optional(),
  description: z.string().max(4096).optional(),
  url: z.string().max(512).optional(),
  color: z.string().regex(HEX_COLOR).optional(),
  author: z
    .object({
      name: z.string().max(256),
      url: z.string().max(512).optional(),
      iconUrl: z.string().max(512).optional(),
    })
    .optional(),
  thumbnail: z.string().max(512).optional(),
  image: z.string().max(512).optional(),
  footer: z
    .object({ text: z.string().max(2048), iconUrl: z.string().max(512).optional() })
    .optional(),
  timestamp: z.boolean().optional(),
  fields: z.array(EmbedField).max(25).default([]),
});
export type Embed = z.infer<typeof Embed>;

export const TextBlock = z.object({
  type: z.literal("text"),
  content: z.string().min(1).max(4000),
});
export type TextBlock = z.infer<typeof TextBlock>;

export const ThumbnailBlock = z.object({
  type: z.literal("thumbnail"),
  url: z.string().min(1).max(512),
  description: z.string().max(1024).optional(),
  spoiler: z.boolean().optional(),
});
export type ThumbnailBlock = z.infer<typeof ThumbnailBlock>;

export const SectionBlock = z.object({
  type: z.literal("section"),
  texts: z.array(z.string().min(1).max(4000)).min(1).max(3),
  accessory: z.union([MessageButton, ThumbnailBlock]),
});
export type SectionBlock = z.infer<typeof SectionBlock>;

export const GalleryBlock = z.object({
  type: z.literal("gallery"),
  items: z
    .array(
      z.object({
        url: z.string().min(1).max(512),
        description: z.string().max(1024).optional(),
        spoiler: z.boolean().optional(),
      }),
    )
    .min(1)
    .max(10),
});
export type GalleryBlock = z.infer<typeof GalleryBlock>;

export const SeparatorBlock = z.object({
  type: z.literal("separator"),
  divider: z.boolean().default(true),
  spacing: z.enum(["small", "large"]).default("small"),
});
export type SeparatorBlock = z.infer<typeof SeparatorBlock>;

const ContainerChild = z.union([TextBlock, SectionBlock, GalleryBlock, SeparatorBlock, ActionRow]);
export type ContainerChild = z.infer<typeof ContainerChild>;

export const ContainerBlock = z.object({
  type: z.literal("container"),
  accentColor: z.string().regex(HEX_COLOR).optional(),
  spoiler: z.boolean().optional(),
  components: z.array(ContainerChild).max(40).default([]),
});
export type ContainerBlock = z.infer<typeof ContainerBlock>;

export const LayoutBlock = z.union([
  TextBlock,
  SectionBlock,
  GalleryBlock,
  SeparatorBlock,
  ActionRow,
  ContainerBlock,
]);
export type LayoutBlock = z.infer<typeof LayoutBlock>;

export const ClassicMessage = z
  .object({
    specVersion: z.literal(SPEC_VERSION),
    kind: z.literal("classic"),
    content: z.string().max(2000).default(""),
    embeds: z.array(Embed).max(10).default([]),
    components: z.array(ActionRow).max(5).default([]),
  })
  .refine((m) => m.content.trim() || m.embeds.length, {
    message: "A message needs text or at least one embed",
    path: ["content"],
  });
export type ClassicMessage = z.infer<typeof ClassicMessage>;

export const MAX_LAYOUT_COMPONENTS = 40;

export const LayoutMessage = z
  .object({
    specVersion: z.literal(SPEC_VERSION),
    kind: z.literal("componentsV2"),
    components: z.array(LayoutBlock).min(1).max(MAX_LAYOUT_COMPONENTS),
  })
  .refine((m) => countComponents(m.components) <= MAX_LAYOUT_COMPONENTS, {
    message: `A message can hold up to ${MAX_LAYOUT_COMPONENTS} components in total`,
    path: ["components"],
  });
export type LayoutMessage = z.infer<typeof LayoutMessage>;

export const MessageDesign = z.union([ClassicMessage, LayoutMessage]);
export type MessageDesign = z.infer<typeof MessageDesign>;

export const MESSAGE_FILE_SUFFIX = ".message.json";
export const MESSAGES_DIR = "messages";

export function messageNameOf(file: string): string | undefined {
  if (!file.startsWith(`${MESSAGES_DIR}/`) || !file.endsWith(MESSAGE_FILE_SUFFIX)) return undefined;
  return file.slice(MESSAGES_DIR.length + 1, -MESSAGE_FILE_SUFFIX.length);
}

export const messageFileOf = (name: string) => `${MESSAGES_DIR}/${name}${MESSAGE_FILE_SUFFIX}`;

export function countComponents(blocks: readonly LayoutBlock[]): number {
  let n = 0;
  for (const b of blocks) {
    n++;
    if (b.type === "container") n += countComponents(b.components);
    else if (b.type === "row") n += b.components.length;
    else if (b.type === "section") n += b.texts.length + 1;
  }
  return n;
}
