import {
  type CommandFlow,
  type CommandOption,
  CommandOptionType,
  type CommandType,
  PermissionName,
  type SubcommandRef,
} from "@makecord/spec";
import { Plus, Trash2 } from "lucide-react";
import { type ReactNode, useState } from "react";
import { Select } from "@/components/Select";
import { cn, Field, IconButton, Input } from "@/components/ui";
import { type MessageKey, useT } from "@/i18n";
import { useStore } from "@/lib/store";

type Command = CommandFlow["command"];
type Choice = { name: string; value: string };

const CHOICE_TYPES = new Set<CommandOptionType>(["string", "integer", "number"]);
const NUMERIC = new Set<CommandOptionType>(["integer", "number"]);

const choicesToText = (choices: Choice[] | undefined) =>
  (choices ?? []).map((c) => (c.name === c.value ? c.name : `${c.name} = ${c.value}`)).join("\n");

function parseChoices(text: string): Choice[] | undefined {
  const list = text
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean)
    .slice(0, 25)
    .map((l) => {
      const at = l.lastIndexOf("=");
      const name = (at > 0 ? l.slice(0, at) : l).trim().slice(0, 100);
      const value = (at > 0 ? l.slice(at + 1) : l).trim().slice(0, 100);
      return { name, value: value || name };
    })
    .filter((c) => c.name);
  return list.length ? list : undefined;
}

function ChoicesInput({
  value,
  onChange,
}: {
  value: Choice[] | undefined;
  onChange: (c: Choice[] | undefined) => void;
}) {
  const [text, setText] = useState(() => choicesToText(value));
  return (
    <textarea
      rows={3}
      value={text}
      placeholder={"Red\nGreen = green"}
      onChange={(e) => {
        setText(e.target.value);
        onChange(parseChoices(e.target.value));
      }}
      className="w-full resize-y rounded-md border border-line bg-chrome p-2 font-mono text-label placeholder:text-faint focus:border-fg/40 focus:outline-none focus-visible:outline-none"
    />
  );
}

const numberOrUndefined = (v: string, int: boolean) => {
  if (v.trim() === "") return undefined;
  const n = Number(v);
  if (!Number.isFinite(n)) return undefined;
  return int ? Math.round(n) : n;
};

function Check({
  label,
  checked,
  disabled,
  onChange,
}: {
  label: string;
  checked: boolean;
  disabled?: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <label
      className={cn("flex items-center gap-2 text-label text-muted", disabled && "opacity-50")}
    >
      <input
        type="checkbox"
        className="accent-fg"
        checked={checked}
        disabled={disabled}
        onChange={(e) => onChange(e.target.checked)}
      />
      {label}
    </label>
  );
}

function Pair({ children }: { children: ReactNode }) {
  return <div className="grid grid-cols-2 gap-2">{children}</div>;
}

function OptionEditor({
  o,
  onChange,
  onDelete,
}: {
  o: CommandOption;
  onChange: (patch: Partial<CommandOption>) => void;
  onDelete: () => void;
}) {
  const { t } = useT();
  const numeric = NUMERIC.has(o.type);
  return (
    <div className="flex flex-col gap-2 rounded-lg border border-line p-2">
      <div className="flex gap-2">
        <Input
          value={o.name}
          onChange={(e) => onChange({ name: e.target.value.toLowerCase().replace(/\s/g, "-") })}
          className="font-mono"
        />
        <Select
          className="w-32 shrink-0"
          value={o.type}
          options={CommandOptionType.options.map((ty) => ({
            value: ty,
            label: t(`optionTypes.${ty}` as MessageKey),
          }))}
          onChange={(type) =>
            onChange({
              type,
              choices: CHOICE_TYPES.has(type) ? o.choices : undefined,
              autocomplete: CHOICE_TYPES.has(type) ? o.autocomplete : undefined,
              minValue: NUMERIC.has(type) ? o.minValue : undefined,
              maxValue: NUMERIC.has(type) ? o.maxValue : undefined,
              minLength: type === "string" ? o.minLength : undefined,
              maxLength: type === "string" ? o.maxLength : undefined,
            })
          }
        />
        <IconButton label={t("properties.deleteOption")} onClick={onDelete}>
          <Trash2 size={16} strokeWidth={1.5} />
        </IconButton>
      </div>
      <Input
        value={o.description}
        maxLength={100}
        onChange={(e) => onChange({ description: e.target.value })}
      />
      <Check
        label={t("properties.required")}
        checked={o.required}
        onChange={(required) => onChange({ required })}
      />
      {CHOICE_TYPES.has(o.type) && (
        <>
          <Check
            label={t("properties.autocomplete")}
            checked={o.autocomplete ?? false}
            disabled={Boolean(o.choices?.length)}
            onChange={(v) => onChange({ autocomplete: v || undefined })}
          />
          {!o.autocomplete && (
            <Field label={t("properties.choices")} hint={t("properties.choicesHint")}>
              <ChoicesInput value={o.choices} onChange={(choices) => onChange({ choices })} />
            </Field>
          )}
        </>
      )}
      {numeric && (
        <Pair>
          <Field label={t("properties.minValue")}>
            <Input
              type="number"
              value={o.minValue ?? ""}
              onChange={(e) =>
                onChange({ minValue: numberOrUndefined(e.target.value, o.type === "integer") })
              }
            />
          </Field>
          <Field label={t("properties.maxValue")}>
            <Input
              type="number"
              value={o.maxValue ?? ""}
              onChange={(e) =>
                onChange({ maxValue: numberOrUndefined(e.target.value, o.type === "integer") })
              }
            />
          </Field>
        </Pair>
      )}
      {o.type === "string" && (
        <Pair>
          <Field label={t("properties.minLength")}>
            <Input
              type="number"
              min={0}
              max={6000}
              value={o.minLength ?? ""}
              onChange={(e) => onChange({ minLength: numberOrUndefined(e.target.value, true) })}
            />
          </Field>
          <Field label={t("properties.maxLength")}>
            <Input
              type="number"
              min={1}
              max={6000}
              value={o.maxLength ?? ""}
              onChange={(e) => onChange({ maxLength: numberOrUndefined(e.target.value, true) })}
            />
          </Field>
        </Pair>
      )}
    </div>
  );
}

function RefFields({
  label,
  value,
  onChange,
  optional,
}: {
  label: string;
  value: SubcommandRef | undefined;
  onChange: (v: SubcommandRef | undefined) => void;
  optional?: boolean;
}) {
  const { t } = useT();
  return (
    <Field label={label} hint={optional ? t("properties.groupHint") : undefined}>
      <div className="flex flex-col gap-1">
        <Input
          className="font-mono"
          placeholder={t("properties.subName")}
          value={value?.name ?? ""}
          onChange={(e) => {
            const name = e.target.value.toLowerCase().replace(/\s/g, "-");
            if (!name && optional) onChange(undefined);
            else onChange({ name, description: value?.description || name || "…" });
          }}
        />
        {(value || !optional) && (
          <Input
            placeholder={t("properties.description")}
            maxLength={100}
            value={value?.description ?? ""}
            onChange={(e) => onChange({ name: value?.name ?? "", description: e.target.value })}
          />
        )}
      </div>
    </Field>
  );
}

const TYPES: { id: CommandType; label: MessageKey; title: MessageKey }[] = [
  { id: "chatInput", label: "properties.typeSlashShort", title: "properties.typeSlash" },
  { id: "user", label: "properties.typeUserShort", title: "properties.typeUser" },
  { id: "message", label: "properties.typeMessageShort", title: "properties.typeMessage" },
];

export function CommandSettings({ path, cmd }: { path: string; cmd: Command }) {
  const { t } = useT();
  const updateFlow = useStore((s) => s.updateFlow);
  const setCmd = (patch: Partial<Command>, key = Object.keys(patch).join(",")) =>
    updateFlow(
      path,
      (f) => (f.kind === "command" ? { ...f, command: { ...f.command, ...patch } } : f),
      `cmd:${key}`,
    );
  const setOption = (i: number, patch: Partial<CommandOption>) =>
    setCmd(
      { options: cmd.options.map((o, j) => (i === j ? { ...o, ...patch } : o)) },
      `option:${i}`,
    );
  const slash = cmd.type === "chatInput";

  return (
    <>
      <fieldset className="m-0 grid min-w-0 grid-cols-3 gap-1 rounded-lg border border-line bg-chrome p-1">
        {TYPES.map(({ id, label, title }) => (
          <button
            key={id}
            type="button"
            title={t(title)}
            aria-pressed={cmd.type === id}
            onClick={() => {
              if (id === cmd.type) return;
              setCmd(
                id === "chatInput"
                  ? {
                      type: id,
                      name:
                        cmd.name
                          .toLowerCase()
                          .replace(/[^-_\p{L}\p{N}]+/gu, "-")
                          .slice(0, 32) || "command",
                      description: cmd.description || cmd.name,
                    }
                  : { type: id, options: [], subcommand: undefined, group: undefined },
              );
            }}
            className={cn(
              "h-7 truncate rounded-md px-1 text-label transition-colors duration-150 ease-out",
              cmd.type === id ? "bg-hover text-fg" : "text-faint hover:text-fg",
            )}
          >
            {t(label)}
          </button>
        ))}
      </fieldset>
      <Field
        label={t("properties.commandName")}
        hint={t(slash ? "properties.commandNameHint" : "properties.menuNameHint")}
      >
        <div className="flex items-center rounded-md border border-line bg-chrome focus-within:border-fg/40">
          {slash && <span className="pl-2 font-mono text-label text-faint">/</span>}
          <input
            value={cmd.name}
            maxLength={32}
            onChange={(e) =>
              setCmd({
                name: slash ? e.target.value.toLowerCase().replace(/\s/g, "-") : e.target.value,
              })
            }
            className={cn(
              "h-7 flex-1 bg-transparent px-1 text-label outline-none focus-visible:outline-none",
              slash ? "font-mono" : "pl-2",
            )}
          />
        </div>
      </Field>
      {slash && (
        <Field
          label={t(cmd.subcommand ? "properties.commandDescription" : "properties.description")}
        >
          <Input
            value={cmd.description}
            maxLength={100}
            onChange={(e) => setCmd({ description: e.target.value })}
          />
        </Field>
      )}
      {slash && (
        <div className="flex flex-col gap-2">
          <Check
            label={t("properties.isSubcommand")}
            checked={Boolean(cmd.subcommand)}
            onChange={(on) =>
              setCmd(
                on
                  ? { subcommand: { name: "sub", description: cmd.description || "…" } }
                  : { subcommand: undefined, group: undefined },
              )
            }
          />
          {cmd.subcommand && (
            <div className="flex flex-col gap-3 rounded-lg border border-line p-2">
              <RefFields
                label={t("properties.group")}
                optional
                value={cmd.group}
                onChange={(group) => setCmd({ group })}
              />
              <RefFields
                label={t("properties.subcommand")}
                value={cmd.subcommand}
                onChange={(subcommand) => setCmd({ subcommand })}
              />
              <p className="text-meta text-faint">
                {t("properties.subcommandHint", {
                  usage: [`/${cmd.name}`, cmd.group?.name, cmd.subcommand.name]
                    .filter(Boolean)
                    .join(" "),
                })}
              </p>
            </div>
          )}
        </div>
      )}
      {slash && (
        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <span className="text-label text-muted">{t("properties.options")}</span>
            <IconButton
              label={t("properties.addOption")}
              disabled={cmd.options.length >= 25}
              onClick={() =>
                setCmd({
                  options: [
                    ...cmd.options,
                    {
                      name: t("properties.newOptionName", { n: cmd.options.length + 1 }),
                      description: t("properties.newOptionDescription"),
                      type: "string",
                      required: false,
                    },
                  ],
                })
              }
            >
              <Plus size={16} strokeWidth={1.5} />
            </IconButton>
          </div>
          {cmd.options.length === 0 && (
            <p className="text-meta text-faint">{t("properties.optionsHint")}</p>
          )}
          {cmd.options.map((o, i) => (
            <OptionEditor
              key={i}
              o={o}
              onChange={(patch) => setOption(i, patch)}
              onDelete={() => setCmd({ options: cmd.options.filter((_, j) => j !== i) })}
            />
          ))}
        </div>
      )}
      {!slash && (
        <p className="text-meta text-faint">
          {t(cmd.type === "user" ? "properties.userMenuHint" : "properties.messageMenuHint")}
        </p>
      )}
      <Check
        label={t("properties.dms")}
        checked={cmd.dms ?? false}
        onChange={(v) => setCmd({ dms: v || undefined })}
      />
      <Field label={t("properties.permissions")} hint={t("properties.permissionsHint")}>
        <div className="grid grid-cols-2 gap-x-2 gap-y-1">
          {PermissionName.options.map((perm) => (
            <label key={perm} className="flex min-w-0 items-center gap-2 text-label text-muted">
              <input
                type="checkbox"
                className="accent-fg"
                checked={cmd.permissions?.includes(perm) ?? false}
                onChange={(e) => {
                  const next = e.target.checked
                    ? [...(cmd.permissions ?? []), perm]
                    : (cmd.permissions ?? []).filter((p) => p !== perm);
                  setCmd({ permissions: next.length ? next : undefined });
                }}
              />
              <span className="truncate">{t(`permissions.${perm}`)}</span>
            </label>
          ))}
        </div>
      </Field>
    </>
  );
}
