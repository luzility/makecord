import type { ActionRow, ClassicMessage, Embed, EmbedField } from "@makecord/spec";
import { Plus } from "lucide-react";
import { Button, Field, IconButton, Input } from "@/components/ui";
import { useT } from "@/i18n";
import { move, newButton, newEmbed, removeAt, replaceAt } from "./model";
import { Card, Check, ColorInput, optional, RowForm, TextArea } from "./parts";

type Update = (fn: (m: ClassicMessage) => ClassicMessage, key: string) => void;

function FieldsForm({
  fields,
  onChange,
}: {
  fields: EmbedField[];
  onChange: (f: EmbedField[]) => void;
}) {
  const { t } = useT();
  return (
    <div className="flex flex-col gap-2">
      {fields.map((f, i) => (
        <Card
          key={i}
          level={1}
          title={f.name || t("message.field")}
          onUp={i > 0 ? () => onChange(move(fields, i, i - 1)) : undefined}
          onDown={i < fields.length - 1 ? () => onChange(move(fields, i, i + 1)) : undefined}
          onDelete={() => onChange(removeAt(fields, i))}
        >
          <Field label={t("message.fieldName")}>
            <Input
              maxLength={256}
              value={f.name}
              onChange={(e) => onChange(replaceAt(fields, i, { ...f, name: e.target.value }))}
            />
          </Field>
          <Field label={t("message.fieldValue")}>
            <TextArea
              rows={2}
              max={1024}
              value={f.value}
              onChange={(v) => onChange(replaceAt(fields, i, { ...f, value: v }))}
            />
          </Field>
          <Check
            label={t("message.inline")}
            checked={f.inline}
            onChange={(v) => onChange(replaceAt(fields, i, { ...f, inline: v }))}
          />
        </Card>
      ))}
      {fields.length < 25 && (
        <Button
          variant="ghost"
          className="self-start"
          onClick={() =>
            onChange([...fields, { name: t("message.fieldName"), value: "…", inline: false }])
          }
        >
          <Plus size={14} strokeWidth={1.5} />
          {t("message.addField")}
        </Button>
      )}
    </div>
  );
}

function EmbedForm({ e, onChange }: { e: Embed; onChange: (e: Embed) => void }) {
  const { t } = useT();
  const set = (patch: Partial<Embed>) => onChange({ ...e, ...patch });
  return (
    <>
      <Field label={t("message.color")}>
        <ColorInput value={e.color} onChange={(color) => set({ color })} />
      </Field>
      <div className="grid grid-cols-2 gap-2">
        <Field label={t("message.authorName")}>
          <Input
            maxLength={256}
            value={e.author?.name ?? ""}
            onChange={(ev) =>
              set({ author: ev.target.value ? { ...e.author, name: ev.target.value } : undefined })
            }
          />
        </Field>
        <Field label={t("message.authorIcon")}>
          <Input
            className="font-mono"
            placeholder="{{user.avatar}}"
            disabled={!e.author?.name}
            value={e.author?.iconUrl ?? ""}
            onChange={(ev) =>
              e.author && set({ author: { ...e.author, iconUrl: optional(ev.target.value) } })
            }
          />
        </Field>
      </div>
      <Field label={t("message.title")}>
        <Input
          maxLength={256}
          value={e.title ?? ""}
          onChange={(ev) => set({ title: optional(ev.target.value) })}
        />
      </Field>
      <Field label={t("message.titleUrl")}>
        <Input
          className="font-mono"
          value={e.url ?? ""}
          placeholder="https://"
          onChange={(ev) => set({ url: optional(ev.target.value) })}
        />
      </Field>
      <Field label={t("message.description")}>
        <TextArea
          rows={4}
          max={4096}
          value={e.description ?? ""}
          onChange={(v) => set({ description: optional(v) })}
        />
      </Field>
      <Field label={t("message.fields")}>
        <FieldsForm fields={e.fields} onChange={(fields) => set({ fields })} />
      </Field>
      <div className="grid grid-cols-2 gap-2">
        <Field label={t("message.thumbnail")}>
          <Input
            className="font-mono"
            placeholder="https://"
            value={e.thumbnail ?? ""}
            onChange={(ev) => set({ thumbnail: optional(ev.target.value) })}
          />
        </Field>
        <Field label={t("message.image")}>
          <Input
            className="font-mono"
            placeholder="https://"
            value={e.image ?? ""}
            onChange={(ev) => set({ image: optional(ev.target.value) })}
          />
        </Field>
      </div>
      <Field label={t("message.footer")}>
        <Input
          maxLength={2048}
          value={e.footer?.text ?? ""}
          onChange={(ev) =>
            set({ footer: ev.target.value ? { ...e.footer, text: ev.target.value } : undefined })
          }
        />
      </Field>
      <Check
        label={t("message.timestamp")}
        checked={e.timestamp ?? false}
        onChange={(v) => set({ timestamp: v || undefined })}
      />
    </>
  );
}

export function ClassicForm({ message, update }: { message: ClassicMessage; update: Update }) {
  const { t } = useT();
  const setEmbeds = (embeds: Embed[], key: string) => update((m) => ({ ...m, embeds }), key);
  const setRows = (components: ActionRow[], key: string) =>
    update((m) => ({ ...m, components }), key);

  return (
    <div className="flex flex-col gap-4">
      <Field label={t("message.content")} hint={t("message.contentHint")}>
        <TextArea
          rows={4}
          max={2000}
          value={message.content}
          onChange={(content) => update((m) => ({ ...m, content }), "content")}
        />
      </Field>

      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <span className="text-label text-muted">
            {t("message.embeds")} <span className="text-faint">{message.embeds.length}/10</span>
          </span>
          <IconButton
            label={t("message.addEmbed")}
            disabled={message.embeds.length >= 10}
            onClick={() => setEmbeds([...message.embeds, newEmbed()], "embeds:add")}
          >
            <Plus size={16} strokeWidth={1.5} />
          </IconButton>
        </div>
        {message.embeds.map((e, i) => (
          <Card
            key={i}
            title={e.title || `${t("message.embed")} ${i + 1}`}
            onUp={
              i > 0 ? () => setEmbeds(move(message.embeds, i, i - 1), "embeds:move") : undefined
            }
            onDown={
              i < message.embeds.length - 1
                ? () => setEmbeds(move(message.embeds, i, i + 1), "embeds:move")
                : undefined
            }
            onDelete={() => setEmbeds(removeAt(message.embeds, i), "embeds:delete")}
          >
            <EmbedForm
              e={e}
              onChange={(next) => setEmbeds(replaceAt(message.embeds, i, next), `embed:${i}`)}
            />
          </Card>
        ))}
      </div>

      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <span className="text-label text-muted">
            {t("message.rows")} <span className="text-faint">{message.components.length}/5</span>
          </span>
          <IconButton
            label={t("message.addRow")}
            disabled={message.components.length >= 5}
            onClick={() =>
              setRows(
                [...message.components, { type: "row", components: [newButton()] }],
                "rows:add",
              )
            }
          >
            <Plus size={16} strokeWidth={1.5} />
          </IconButton>
        </div>
        {message.components.map((r, i) => (
          <Card
            key={i}
            title={`${t("message.row")} ${i + 1}`}
            onUp={
              i > 0 ? () => setRows(move(message.components, i, i - 1), "rows:move") : undefined
            }
            onDown={
              i < message.components.length - 1
                ? () => setRows(move(message.components, i, i + 1), "rows:move")
                : undefined
            }
            onDelete={() => setRows(removeAt(message.components, i), "rows:delete")}
          >
            <RowForm
              items={r.components}
              onChange={(items) =>
                setRows(replaceAt(message.components, i, { ...r, components: items }), `row:${i}`)
              }
            />
          </Card>
        ))}
      </div>
    </div>
  );
}
