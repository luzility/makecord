import type {
  ActionRow,
  ClassicMessage,
  ContainerChild,
  Embed,
  LayoutBlock,
  LayoutMessage,
  MessageButton,
  MessageDesign,
  MessageSelect,
} from "@makecord/spec";

export type BlockType = LayoutBlock["type"];
export type RowItem = ActionRow["components"][number];

export const newButton = (n = 1): MessageButton => ({
  type: "button",
  style: "primary",
  label: `Button ${n}`,
  customId: `button-${n}`,
});

export const newSelect = (): MessageSelect => ({
  type: "select",
  menuType: "string",
  customId: "menu",
  placeholder: "Pick one",
  options: [
    { label: "Option 1", value: "one" },
    { label: "Option 2", value: "two" },
  ],
});

export const newEmbed = (): Embed => ({
  title: "Title",
  description: "Description",
  color: "#5865f2",
  fields: [],
});

export function newBlock(type: BlockType): LayoutBlock {
  switch (type) {
    case "text":
      return { type, content: "Text" };
    case "section":
      return {
        type,
        texts: ["Text next to a button"],
        accessory: newButton(),
      };
    case "gallery":
      return { type, items: [{ url: "https://" }] };
    case "separator":
      return { type, divider: true, spacing: "small" };
    case "row":
      return { type, components: [newButton()] };
    case "container":
      return {
        type,
        accentColor: "#5865f2",
        components: [{ type: "text", content: "Text inside a container" }],
      };
  }
}

export function newMessage(kind: MessageDesign["kind"], content: string): MessageDesign {
  return kind === "classic"
    ? { specVersion: 1, kind, content, embeds: [], components: [] }
    : { specVersion: 1, kind, components: [{ type: "text", content }] };
}

function embedToChildren(e: Embed): ContainerChild[] {
  const lines = [
    e.author?.name && `-# ${e.author.name}`,
    e.title && `### ${e.title}`,
    e.description,
    ...e.fields.map((f) => `**${f.name}**\n${f.value}`),
  ].filter(Boolean) as string[];
  const children: ContainerChild[] = [];
  const text = lines.join("\n");
  if (text && e.thumbnail) {
    children.push({
      type: "section",
      texts: [text.slice(0, 4000)],
      accessory: { type: "thumbnail", url: e.thumbnail },
    });
  } else if (text) children.push({ type: "text", content: text.slice(0, 4000) });
  if (e.image) children.push({ type: "gallery", items: [{ url: e.image }] });
  if (e.footer?.text) children.push({ type: "text", content: `-# ${e.footer.text}` });
  return children;
}

export function toLayout(m: ClassicMessage): LayoutMessage {
  const components: LayoutBlock[] = [];
  if (m.content.trim()) components.push({ type: "text", content: m.content });
  for (const e of m.embeds) {
    const children = embedToChildren(e);
    if (children.length)
      components.push({ type: "container", accentColor: e.color, components: children });
  }
  components.push(...m.components);
  if (!components.length) components.push({ type: "text", content: "Text" });
  return { specVersion: 1, kind: "componentsV2", components };
}

function textsOf(blocks: readonly LayoutBlock[]): string[] {
  return blocks.flatMap((b) => {
    if (b.type === "text") return [b.content];
    if (b.type === "section") return b.texts;
    if (b.type === "container") return textsOf(b.components);
    return [];
  });
}

function rowsOf(blocks: readonly LayoutBlock[]): ActionRow[] {
  return blocks.flatMap((b) => {
    if (b.type === "row") return [b];
    if (b.type === "container") return rowsOf(b.components);
    if (b.type === "section" && b.accessory.type === "button")
      return [{ type: "row", components: [b.accessory] } as ActionRow];
    return [];
  });
}

export function toClassic(m: LayoutMessage): ClassicMessage {
  const content = textsOf(m.components).join("\n\n").slice(0, 2000) || "Text";
  return {
    specVersion: 1,
    kind: "classic",
    content,
    embeds: [],
    components: rowsOf(m.components).slice(0, 5),
  };
}

export function move<T>(list: readonly T[], from: number, to: number): T[] {
  if (to < 0 || to >= list.length) return [...list];
  const next = [...list];
  const [item] = next.splice(from, 1);
  next.splice(to, 0, item as T);
  return next;
}

export const replaceAt = <T>(list: readonly T[], i: number, item: T): T[] =>
  list.map((x, j) => (j === i ? item : x));

export const removeAt = <T>(list: readonly T[], i: number): T[] => list.filter((_, j) => j !== i);
