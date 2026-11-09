import {
  ButtonStyle,
  type MessageButton,
  type MessageSelect,
  SelectMenuType,
  type SelectOption,
} from "@makecord/spec";
import { ChevronDown, ChevronRight, ChevronUp, Plus, Trash2, X } from "lucide-react";
import { type ReactNode, useRef, useState } from "react";
import { Button, cn, Field, IconButton, Input, selectCls } from "@/components/ui";
import { useT } from "@/i18n";
import { newButton, newSelect, type RowItem, removeAt, replaceAt } from "./model";

export const areaCls =
  "w-full resize-y rounded-md border border-line bg-chrome p-2 font-mono text-label text-fg placeholder:text-faint focus:border-fg/40 focus:outline-none focus-visible:outline-none";

export function TextArea({
  value,
  onChange,
  max,
  rows = 3,
  placeholder,
}: {
  value: string;
  onChange: (v: string) => void;
  max: number;
  rows?: number;
  placeholder?: string;
}) {
  return (
    <div className="relative">
      <textarea
        rows={rows}
        value={value}
        maxLength={max}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        className={cn(areaCls, "pb-5")}
      />
      <span
        className={cn(
          "pointer-events-none absolute right-2 bottom-1.5 font-mono text-meta",
          value.length > max * 0.9 ? "text-warn" : "text-faint",
        )}
      >
        {value.length}/{max}
      </span>
    </div>
  );
}

export function useDraft<T>(value: T, format: (v: T) => string) {
  const [text, setText] = useState(() => format(value));
  const known = useRef(value);
  if (known.current !== value) {
    known.current = value;
    const next = format(value);
    if (next !== text) setText(next);
  }
  const edit = (next: string, emitted: T) => {
    known.current = emitted;
    setText(next);
  };
  return [text, edit] as const;
}

export const optional = (v: string) => (v === "" ? undefined : v);

export function ColorInput({
  value,
  onChange,
}: {
  value: string | undefined;
  onChange: (v: string | undefined) => void;
}) {
  const { t } = useT();
  const [draft, setDraft] = useDraft(value, (v) => v ?? "");
  return (
    <div className="flex items-center gap-2">
      <input
        type="color"
        value={value ?? "#1e1f22"}
        onChange={(e) => {
          setDraft(e.target.value, e.target.value);
          onChange(e.target.value);
        }}
        className="h-7 w-9 shrink-0 cursor-pointer rounded-md border border-line bg-chrome p-0.5"
      />
      <Input
        className="font-mono"
        value={draft}
        placeholder="#5865f2"
        onChange={(e) => {
          const v = e.target.value.trim();
          const valid = /^#[0-9a-fA-F]{6}$/.test(v);
          const next = v === "" ? undefined : valid ? v.toLowerCase() : value;
          setDraft(v, next);
          if (next !== value) onChange(next);
        }}
      />
      {value && (
        <IconButton
          label={t("message.noColor")}
          onClick={() => {
            setDraft("", undefined);
            onChange(undefined);
          }}
        >
          <X size={14} strokeWidth={1.5} />
        </IconButton>
      )}
    </div>
  );
}

export function Card({
  title,
  children,
  onUp,
  onDown,
  onDelete,
  defaultOpen = true,
  level = 0,
}: {
  title: ReactNode;
  children: ReactNode;
  onUp?: () => void;
  onDown?: () => void;
  onDelete?: () => void;
  defaultOpen?: boolean;
  level?: number;
}) {
  const { t } = useT();
  const [open, setOpen] = useState(defaultOpen);
  return (
    <section
      className={cn("rounded-lg border border-line", level === 0 ? "bg-panel" : "bg-raised/40")}
    >
      <header className="flex h-8 items-center gap-1 pr-1 pl-1">
        <button
          type="button"
          onClick={() => setOpen(!open)}
          aria-expanded={open}
          className="flex h-7 min-w-0 flex-1 items-center gap-1 rounded-md px-1 text-left text-label font-medium text-fg hover:bg-hover"
        >
          {open ? (
            <ChevronDown size={14} strokeWidth={1.5} className="shrink-0 text-faint" />
          ) : (
            <ChevronRight size={14} strokeWidth={1.5} className="shrink-0 text-faint" />
          )}
          <span className="truncate">{title}</span>
        </button>
        {onUp && (
          <IconButton label={t("message.moveUp")} onClick={onUp}>
            <ChevronUp size={14} strokeWidth={1.5} />
          </IconButton>
        )}
        {onDown && (
          <IconButton label={t("message.moveDown")} onClick={onDown}>
            <ChevronDown size={14} strokeWidth={1.5} />
          </IconButton>
        )}
        {onDelete && (
          <IconButton label={t("common.delete")} onClick={onDelete}>
            <Trash2 size={14} strokeWidth={1.5} />
          </IconButton>
        )}
      </header>
      {open && <div className="flex flex-col gap-3 px-3 pt-1 pb-3">{children}</div>}
    </section>
  );
}

export function Check({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <label className="flex items-center gap-2 text-label text-muted">
      <input
        type="checkbox"
        className="accent-fg"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
      />
      {label}
    </label>
  );
}

export function ButtonForm({
  value,
  onChange,
}: {
  value: MessageButton;
  onChange: (b: MessageButton) => void;
}) {
  const { t } = useT();
  const set = (patch: Partial<MessageButton>) => onChange({ ...value, ...patch });
  const link = value.style === "link";
  return (
    <div className="flex flex-col gap-2">
      <div className="grid grid-cols-[1fr_7rem] gap-2">
        <Field label={t("message.label")}>
          <Input
            value={value.label}
            maxLength={80}
            onChange={(e) => set({ label: e.target.value })}
          />
        </Field>
        <Field label={t("message.style")}>
          <select
            className={selectCls}
            value={value.style}
            onChange={(e) => {
              const style = e.target.value as MessageButton["style"];
              set(
                style === "link"
                  ? { style, url: value.url ?? "https://", customId: undefined }
                  : { style, customId: value.customId ?? "button", url: undefined },
              );
            }}
          >
            {ButtonStyle.options.map((s) => (
              <option key={s} value={s}>
                {t(`message.styles.${s}`)}
              </option>
            ))}
          </select>
        </Field>
      </div>
      <div className="grid grid-cols-[1fr_5rem] gap-2">
        {link ? (
          <Field label={t("message.url")}>
            <Input
              className="font-mono"
              value={value.url ?? ""}
              onChange={(e) => set({ url: e.target.value })}
            />
          </Field>
        ) : (
          <Field label={t("message.customId")}>
            <Input
              className="font-mono"
              maxLength={100}
              value={value.customId ?? ""}
              onChange={(e) => set({ customId: e.target.value })}
            />
          </Field>
        )}
        <Field label={t("message.emoji")}>
          <Input
            value={value.emoji ?? ""}
            onChange={(e) => set({ emoji: optional(e.target.value) })}
          />
        </Field>
      </div>
      <Check
        label={t("message.disabled")}
        checked={value.disabled ?? false}
        onChange={(v) => set({ disabled: v || undefined })}
      />
    </div>
  );
}

const optionsToText = (options: SelectOption[]) =>
  options
    .map((o) =>
      [o.label, o.value, o.description ?? ""]
        .join(" | ")
        .replace(/( \| )+$/, "")
        .replace(/^(.+) \| \1$/, "$1"),
    )
    .join("\n");

function parseOptions(text: string): SelectOption[] {
  return text
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean)
    .slice(0, 25)
    .map((l) => {
      const [label = "", value, description] = l.split("|").map((p) => p.trim());
      return {
        label: label.slice(0, 100),
        value: (value || label).slice(0, 100),
        ...(description ? { description: description.slice(0, 100) } : {}),
      };
    })
    .filter((o) => o.label);
}

export function SelectForm({
  value,
  onChange,
}: {
  value: MessageSelect;
  onChange: (s: MessageSelect) => void;
}) {
  const { t } = useT();
  const [text, setText] = useDraft(value.options, optionsToText);
  const set = (patch: Partial<MessageSelect>) => onChange({ ...value, ...patch });
  const num = (v: string) =>
    v === "" ? undefined : Math.max(0, Math.min(25, Math.round(Number(v))));
  return (
    <div className="flex flex-col gap-2">
      <div className="grid grid-cols-2 gap-2">
        <Field label={t("message.customId")}>
          <Input
            className="font-mono"
            maxLength={100}
            value={value.customId}
            onChange={(e) => set({ customId: e.target.value })}
          />
        </Field>
        <Field label={t("message.placeholder")}>
          <Input
            maxLength={150}
            value={value.placeholder ?? ""}
            onChange={(e) => set({ placeholder: optional(e.target.value) })}
          />
        </Field>
      </div>
      <Field label={t("message.menuType")}>
        <select
          className={selectCls}
          value={value.menuType}
          onChange={(e) => set({ menuType: e.target.value as MessageSelect["menuType"] })}
        >
          {SelectMenuType.options.map((m) => (
            <option key={m} value={m}>
              {t(`message.menuTypes.${m}`)}
            </option>
          ))}
        </select>
      </Field>
      {value.menuType === "string" && (
        <Field label={t("message.options")} hint={t("message.optionsHint")}>
          <textarea
            rows={4}
            value={text}
            onChange={(e) => {
              const options = parseOptions(e.target.value);
              setText(e.target.value, options);
              set({ options });
            }}
            className={areaCls}
          />
        </Field>
      )}
      <div className="grid grid-cols-2 gap-2">
        <Field label={t("message.minValues")}>
          <Input
            type="number"
            min={0}
            max={25}
            value={value.minValues ?? ""}
            placeholder="1"
            onChange={(e) => set({ minValues: num(e.target.value) })}
          />
        </Field>
        <Field label={t("message.maxValues")}>
          <Input
            type="number"
            min={1}
            max={25}
            value={value.maxValues ?? ""}
            placeholder="1"
            onChange={(e) => set({ maxValues: num(e.target.value) })}
          />
        </Field>
      </div>
    </div>
  );
}

export function RowForm({
  items,
  onChange,
}: {
  items: RowItem[];
  onChange: (items: RowItem[]) => void;
}) {
  const { t } = useT();
  const hasSelect = items.some((c) => c.type === "select");
  return (
    <div className="flex flex-col gap-2">
      {items.map((c, i) => (
        <Card
          key={i}
          level={1}
          title={
            c.type === "button"
              ? `${t("message.button")} · ${c.label || c.emoji || ""}`
              : `${t("message.menu")} · ${c.customId}`
          }
          onDelete={items.length > 1 ? () => onChange(removeAt(items, i)) : undefined}
        >
          {c.type === "button" ? (
            <ButtonForm value={c} onChange={(b) => onChange(replaceAt(items, i, b))} />
          ) : (
            <SelectForm value={c} onChange={(s) => onChange(replaceAt(items, i, s))} />
          )}
        </Card>
      ))}
      {!hasSelect && items.length < 5 && (
        <div className="flex gap-2">
          <Button variant="ghost" onClick={() => onChange([...items, newButton(items.length + 1)])}>
            <Plus size={14} strokeWidth={1.5} />
            {t("message.addButton")}
          </Button>
          {items.length === 0 && (
            <Button variant="ghost" onClick={() => onChange([newSelect()])}>
              <Plus size={14} strokeWidth={1.5} />
              {t("message.addMenu")}
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
