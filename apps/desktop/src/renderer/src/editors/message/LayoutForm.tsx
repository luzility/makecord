import {
  type ContainerChild,
  countComponents,
  type GalleryBlock,
  type LayoutBlock,
  type LayoutMessage,
  MAX_LAYOUT_COMPONENTS,
  type SectionBlock,
} from "@makecord/spec";
import { Plus, Trash2 } from "lucide-react";
import { Button, Field, IconButton, Input, selectCls } from "@/components/ui";
import { type MessageKey, useT } from "@/i18n";
import { type BlockType, move, newBlock, newButton, removeAt, replaceAt } from "./model";
import { ButtonForm, Card, Check, ColorInput, optional, RowForm, TextArea } from "./parts";

type Update = (fn: (m: LayoutMessage) => LayoutMessage, key: string) => void;

const TOP_TYPES: BlockType[] = ["text", "container", "section", "gallery", "separator", "row"];
const CHILD_TYPES: BlockType[] = ["text", "section", "gallery", "separator", "row"];

function AddBlock({
  types,
  onAdd,
  disabled,
}: {
  types: BlockType[];
  onAdd: (type: BlockType) => void;
  disabled: boolean;
}) {
  const { t } = useT();
  return (
    <div className="flex flex-wrap gap-1">
      {types.map((type) => (
        <Button key={type} variant="ghost" disabled={disabled} onClick={() => onAdd(type)}>
          <Plus size={14} strokeWidth={1.5} />
          {t(`message.blocks.${type}` as MessageKey)}
        </Button>
      ))}
    </div>
  );
}

function SectionForm({ b, onChange }: { b: SectionBlock; onChange: (b: SectionBlock) => void }) {
  const { t } = useT();
  const acc = b.accessory;
  return (
    <>
      {b.texts.map((text, i) => (
        <div key={i} className="flex gap-1">
          <div className="flex-1">
            <TextArea
              rows={2}
              max={4000}
              value={text}
              onChange={(v) => onChange({ ...b, texts: replaceAt(b.texts, i, v) })}
            />
          </div>
          {b.texts.length > 1 && (
            <IconButton
              label={t("common.delete")}
              onClick={() => onChange({ ...b, texts: removeAt(b.texts, i) })}
            >
              <Trash2 size={14} strokeWidth={1.5} />
            </IconButton>
          )}
        </div>
      ))}
      {b.texts.length < 3 && (
        <Button
          variant="ghost"
          className="self-start"
          onClick={() => onChange({ ...b, texts: [...b.texts, "Text"] })}
        >
          <Plus size={14} strokeWidth={1.5} />
          {t("message.addText")}
        </Button>
      )}
      <Field label={t("message.accessory")}>
        <select
          className={selectCls}
          value={acc.type}
          onChange={(e) =>
            onChange({
              ...b,
              accessory:
                e.target.value === "button"
                  ? newButton()
                  : { type: "thumbnail", url: "{{user.avatar}}" },
            })
          }
        >
          <option value="button">{t("message.button")}</option>
          <option value="thumbnail">{t("message.thumbnail")}</option>
        </select>
      </Field>
      {acc.type === "button" ? (
        <ButtonForm value={acc} onChange={(accessory) => onChange({ ...b, accessory })} />
      ) : (
        <>
          <Field label={t("message.imageUrl")}>
            <Input
              className="font-mono"
              value={acc.url}
              onChange={(e) => onChange({ ...b, accessory: { ...acc, url: e.target.value } })}
            />
          </Field>
          <Field label={t("message.altText")}>
            <Input
              value={acc.description ?? ""}
              onChange={(e) =>
                onChange({ ...b, accessory: { ...acc, description: optional(e.target.value) } })
              }
            />
          </Field>
        </>
      )}
    </>
  );
}

function GalleryForm({ b, onChange }: { b: GalleryBlock; onChange: (b: GalleryBlock) => void }) {
  const { t } = useT();
  return (
    <>
      {b.items.map((item, i) => (
        <div key={i} className="flex flex-col gap-1 rounded-md border border-line p-2">
          <div className="flex gap-1">
            <Input
              className="font-mono"
              placeholder="https://"
              value={item.url}
              onChange={(e) =>
                onChange({ ...b, items: replaceAt(b.items, i, { ...item, url: e.target.value }) })
              }
            />
            {b.items.length > 1 && (
              <IconButton
                label={t("common.delete")}
                onClick={() => onChange({ ...b, items: removeAt(b.items, i) })}
              >
                <Trash2 size={14} strokeWidth={1.5} />
              </IconButton>
            )}
          </div>
          <Input
            placeholder={t("message.altText")}
            value={item.description ?? ""}
            onChange={(e) =>
              onChange({
                ...b,
                items: replaceAt(b.items, i, { ...item, description: optional(e.target.value) }),
              })
            }
          />
          <Check
            label={t("message.spoiler")}
            checked={item.spoiler ?? false}
            onChange={(v) =>
              onChange({ ...b, items: replaceAt(b.items, i, { ...item, spoiler: v || undefined }) })
            }
          />
        </div>
      ))}
      {b.items.length < 10 && (
        <Button
          variant="ghost"
          className="self-start"
          onClick={() => onChange({ ...b, items: [...b.items, { url: "https://" }] })}
        >
          <Plus size={14} strokeWidth={1.5} />
          {t("message.addImage")}
        </Button>
      )}
    </>
  );
}

function ChildForm({ b, onChange }: { b: ContainerChild; onChange: (b: ContainerChild) => void }) {
  const { t } = useT();
  switch (b.type) {
    case "text":
      return (
        <TextArea
          rows={3}
          max={4000}
          value={b.content}
          placeholder="## Heading"
          onChange={(content) => onChange({ ...b, content })}
        />
      );
    case "section":
      return <SectionForm b={b} onChange={onChange} />;
    case "gallery":
      return <GalleryForm b={b} onChange={onChange} />;
    case "separator":
      return (
        <div className="grid grid-cols-[1fr_8rem] items-center gap-3">
          <Check
            label={t("message.divider")}
            checked={b.divider}
            onChange={(divider) => onChange({ ...b, divider })}
          />
          <select
            className={selectCls}
            value={b.spacing}
            onChange={(e) => onChange({ ...b, spacing: e.target.value as "small" | "large" })}
          >
            <option value="small">{t("message.spacingSmall")}</option>
            <option value="large">{t("message.spacingLarge")}</option>
          </select>
        </div>
      );
    case "row":
      return (
        <RowForm items={b.components} onChange={(components) => onChange({ ...b, components })} />
      );
  }
}

function BlockList<T extends LayoutBlock>({
  blocks,
  onChange,
  types,
  full,
  level,
}: {
  blocks: T[];
  onChange: (blocks: T[], key: string) => void;
  types: BlockType[];
  full: boolean;
  level: number;
}) {
  const { t } = useT();
  return (
    <div className="flex flex-col gap-2">
      {blocks.map((b, i) => (
        <Card
          key={i}
          level={level}
          title={t(`message.blocks.${b.type}` as MessageKey)}
          onUp={i > 0 ? () => onChange(move(blocks, i, i - 1), "blocks:move") : undefined}
          onDown={
            i < blocks.length - 1
              ? () => onChange(move(blocks, i, i + 1), "blocks:move")
              : undefined
          }
          onDelete={() => onChange(removeAt(blocks, i), "blocks:delete")}
        >
          {b.type === "container" ? (
            <>
              <div className="grid grid-cols-[1fr_auto] items-end gap-3">
                <Field label={t("message.accent")}>
                  <ColorInput
                    value={b.accentColor}
                    onChange={(accentColor) =>
                      onChange(
                        replaceAt(blocks, i, { ...b, accentColor } as T),
                        `block:${level}:${i}`,
                      )
                    }
                  />
                </Field>
                <div className="pb-1.5">
                  <Check
                    label={t("message.spoiler")}
                    checked={b.spoiler ?? false}
                    onChange={(v) =>
                      onChange(
                        replaceAt(blocks, i, { ...b, spoiler: v || undefined } as T),
                        "spoiler",
                      )
                    }
                  />
                </div>
              </div>
              <BlockList
                blocks={b.components}
                types={CHILD_TYPES}
                full={full}
                level={level + 1}
                onChange={(components, key) =>
                  onChange(replaceAt(blocks, i, { ...b, components } as T), `${i}:${key}`)
                }
              />
            </>
          ) : (
            <ChildForm
              b={b}
              onChange={(next) => onChange(replaceAt(blocks, i, next as T), `block:${level}:${i}`)}
            />
          )}
        </Card>
      ))}
      <AddBlock
        types={types}
        disabled={full}
        onAdd={(type) => onChange([...blocks, newBlock(type) as T], "blocks:add")}
      />
    </div>
  );
}

export function LayoutForm({ message, update }: { message: LayoutMessage; update: Update }) {
  const { t } = useT();
  const used = countComponents(message.components);
  const full = used >= MAX_LAYOUT_COMPONENTS - 1;
  return (
    <div className="flex flex-col gap-3">
      <p className="text-label text-faint">
        {t("message.layoutHint")}{" "}
        <span className={used > MAX_LAYOUT_COMPONENTS ? "text-bad" : "text-muted"}>
          {used}/{MAX_LAYOUT_COMPONENTS}
        </span>
      </p>
      <BlockList
        blocks={message.components}
        types={TOP_TYPES}
        full={full}
        level={0}
        onChange={(components, key) => update((m) => ({ ...m, components }), key)}
      />
    </div>
  );
}
