import {
  CommandOptionType,
  type Flow,
  FlowEventName,
  INTERACTION_EVENTS,
  PermissionName,
  type Schedule,
} from "@makecord/spec";
import { Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import { Button, Empty, Field, IconButton, Input, selectCls } from "@/components/ui";
import { useT } from "@/i18n";
import { descriptorOf, fieldsOf, type NodeDescriptor, nodeText, useNodes } from "@/lib/nodes";
import { problemText } from "@/lib/problems";
import { useStore } from "@/lib/store";

const BASE_VARIABLES = ["vars.<name>", "client.ping"];
const USER_VARIABLES = [
  "user.id",
  "user.username",
  "user.displayName",
  "user.mention",
  "guild.name",
  "guild.memberCount",
  "channel.id",
];
const EVENT_VARIABLES: Record<FlowEventName, string[]> = {
  clientReady: [],
  guildMemberAdd: USER_VARIABLES,
  guildMemberRemove: USER_VARIABLES,
  messageCreate: [...USER_VARIABLES, "message.id", "message.content"],
  messageUpdate: [...USER_VARIABLES, "message.id", "message.content", "before.content"],
  messageDelete: ["message.id", "message.content", "channel.id", "guild.name"],
  messageReactionAdd: [...USER_VARIABLES, "message.id", "emoji.name", "emoji.text"],
  buttonClick: [...USER_VARIABLES, "customId", "message.id"],
  selectMenu: [...USER_VARIABLES, "customId", "value", "values", "message.id"],
  modalSubmit: [...USER_VARIABLES, "customId", "fields.<id>"],
  schedule: ["now.date", "now.time", "now.weekday", "now.iso"],
};

function variablesOf(flow: Flow | undefined) {
  if (!flow) return BASE_VARIABLES;
  const own =
    flow.kind === "command" ? [...USER_VARIABLES, "options.<name>"] : EVENT_VARIABLES[flow.event];
  return [...own, ...BASE_VARIABLES];
}

function NodeForm({
  path,
  nodeId,
  meta,
  data,
}: {
  path: string;
  nodeId: string;
  meta: NodeDescriptor;
  data: Record<string, unknown>;
}) {
  const { t, locale } = useT();
  const updateFlow = useStore((s) => s.updateFlow);
  const allProblems = useStore((s) => s.problems);
  const flow = useStore((s) => s.docs[path]?.flow);
  const problems = allProblems.filter((p) => p.file === path && p.nodeId === nodeId);
  const text = nodeText(meta, locale);
  const setField = (key: string, value: unknown) =>
    updateFlow(
      path,
      (f) => ({
        ...f,
        nodes: f.nodes.map((n) =>
          n.id === nodeId ? { ...n, data: { ...n.data, [key]: value } } : n,
        ),
      }),
      `field:${nodeId}:${key}`,
    );

  return (
    <div className="flex flex-col gap-4 p-4">
      <div>
        <div className="flex items-center gap-2">
          <span
            className="size-2 rounded-full"
            style={{ background: `var(--color-cat-${meta.category})` }}
          />
          <h3 className="text-title font-medium">{text.title}</h3>
        </div>
        {text.description && <p className="mt-1 text-label text-muted">{text.description}</p>}
      </div>
      {problems.map((p) => (
        <p
          key={`${p.code}:${p.message}`}
          className={
            p.severity === "error"
              ? "rounded-md bg-bad/10 px-2 py-1 text-label text-bad"
              : "rounded-md bg-warn/10 px-2 py-1 text-label text-warn"
          }
        >
          {problemText(p, locale)}
        </p>
      ))}
      {fieldsOf(meta, locale).map((f) => {
        const value = data[f.key];
        if (f.kind === "boolean") {
          return (
            <label key={f.key} className="flex items-center gap-2 text-label">
              <input
                type="checkbox"
                checked={Boolean(value)}
                onChange={(e) => setField(f.key, e.target.checked)}
                className="accent-fg"
              />
              {f.title}
            </label>
          );
        }
        return (
          <Field key={f.key} label={f.title} hint={f.description}>
            {f.kind === "enum" ? (
              <select
                className={selectCls}
                value={String(value ?? "")}
                onChange={(e) => setField(f.key, e.target.value)}
              >
                {f.options?.map((o) => (
                  <option key={o}>{o}</option>
                ))}
              </select>
            ) : f.kind === "multiline" ? (
              <textarea
                rows={4}
                value={String(value ?? "")}
                onChange={(e) => setField(f.key, e.target.value)}
                className="w-full resize-y rounded-md border border-line bg-chrome p-2 font-mono text-label focus:border-fg/40 focus:outline-none focus-visible:outline-none"
              />
            ) : (
              <Input
                value={String(value ?? "")}
                onChange={(e) =>
                  setField(f.key, f.kind === "number" ? Number(e.target.value) : e.target.value)
                }
              />
            )}
          </Field>
        );
      })}
      <details className="text-label text-faint">
        <summary className="cursor-pointer select-none hover:text-fg">
          {t("properties.variables")}
        </summary>
        <ul className="mt-2 flex flex-col gap-1 font-mono text-meta text-muted">
          {variablesOf(flow).map((v) => (
            <li key={v}>{`{{${v}}}`}</li>
          ))}
        </ul>
      </details>
    </div>
  );
}

function FlowSettings({ path, flow }: { path: string; flow: Flow }) {
  const { t } = useT();
  const updateFlow = useStore((s) => s.updateFlow);
  const invalid = useStore((s) => s.docs[path]?.invalid);
  const fieldLabel: Record<string, string> = {
    name: t("properties.commandName"),
    description: t("properties.description"),
  };
  const notice = invalid && (
    <p className="rounded-md bg-warn/10 px-2 py-1 text-label text-warn">
      {invalid.empty
        ? t("properties.notSavedEmpty", { field: fieldLabel[invalid.field] ?? invalid.field })
        : t("properties.notSaved", {
            issue: `${fieldLabel[invalid.field] ?? invalid.field}: ${invalid.message}`,
          })}
    </p>
  );
  if (flow.kind === "event") {
    return (
      <div className="flex flex-col gap-4 p-4">
        <h3 className="text-title font-medium">{t("properties.eventTitle")}</h3>
        {notice}
        <Field label={t("properties.event")}>
          <select
            className={selectCls}
            value={flow.event}
            onChange={(e) =>
              updateFlow(path, (f) => ({ ...f, event: e.target.value as FlowEventName }))
            }
          >
            {FlowEventName.options.map((ev) => (
              <option key={ev} value={ev}>
                {t(`events.${ev}`)}
              </option>
            ))}
          </select>
        </Field>
        {INTERACTION_EVENTS.includes(flow.event) && (
          <Field label={t("properties.customId")} hint={t("properties.customIdHint")}>
            <Input
              className="font-mono"
              maxLength={100}
              value={flow.customId ?? ""}
              placeholder="vote:*"
              onChange={(e) => {
                const customId = e.target.value;
                updateFlow(
                  path,
                  (f) => (f.kind === "event" ? { ...f, customId: customId || undefined } : f),
                  "event:customId",
                );
              }}
            />
          </Field>
        )}
        {flow.event === "schedule" && <ScheduleField path={path} schedule={flow.schedule} />}
      </div>
    );
  }
  const cmd = flow.command;
  const setCmd = (patch: Partial<typeof cmd>) =>
    updateFlow(
      path,
      (f) => (f.kind === "command" ? { ...f, command: { ...f.command, ...patch } } : f),
      `cmd:${Object.keys(patch).join(",")}`,
    );
  const setOption = (i: number, patch: Partial<(typeof cmd.options)[number]>) =>
    setCmd({ options: cmd.options.map((o, j) => (i === j ? { ...o, ...patch } : o)) });

  return (
    <div className="flex flex-col gap-4 p-4">
      <h3 className="text-title font-medium">{t("properties.commandTitle")}</h3>
      {notice}
      <Field label={t("properties.commandName")} hint={t("properties.commandNameHint")}>
        <div className="flex items-center rounded-md border border-line bg-chrome focus-within:border-fg/40">
          <span className="pl-2 font-mono text-label text-faint">/</span>
          <input
            value={cmd.name}
            onChange={(e) => setCmd({ name: e.target.value.toLowerCase().replace(/\s/g, "-") })}
            className="h-7 flex-1 bg-transparent px-1 font-mono text-label outline-none focus-visible:outline-none"
          />
        </div>
      </Field>
      <Field label={t("properties.description")}>
        <Input
          value={cmd.description}
          maxLength={100}
          onChange={(e) => setCmd({ description: e.target.value })}
        />
      </Field>
      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <span className="text-label text-muted">{t("properties.options")}</span>
          <IconButton
            label={t("properties.addOption")}
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
          <div key={i} className="flex flex-col gap-2 rounded-lg border border-line p-2">
            <div className="flex gap-2">
              <Input
                value={o.name}
                onChange={(e) => setOption(i, { name: e.target.value.toLowerCase() })}
                className="font-mono"
              />
              <select
                className={`${selectCls} w-24`}
                value={o.type}
                onChange={(e) => setOption(i, { type: e.target.value as CommandOptionType })}
              >
                {CommandOptionType.options.map((ty) => (
                  <option key={ty}>{ty}</option>
                ))}
              </select>
              <IconButton
                label={t("properties.deleteOption")}
                onClick={() => setCmd({ options: cmd.options.filter((_, j) => j !== i) })}
              >
                <Trash2 size={16} strokeWidth={1.5} />
              </IconButton>
            </div>
            <Input
              value={o.description}
              onChange={(e) => setOption(i, { description: e.target.value })}
            />
            <label className="flex items-center gap-2 text-label text-muted">
              <input
                type="checkbox"
                checked={o.required}
                onChange={(e) => setOption(i, { required: e.target.checked })}
                className="accent-fg"
              />
              {t("properties.required")}
            </label>
            {(o.type === "string" || o.type === "integer" || o.type === "number") && (
              <Field label={t("properties.choices")} hint={t("properties.choicesHint")}>
                <ChoicesInput value={o.choices} onChange={(choices) => setOption(i, { choices })} />
              </Field>
            )}
          </div>
        ))}
      </div>
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
    </div>
  );
}

type Choice = { name: string; value: string };

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
      className="w-full resize-y rounded-md border border-line bg-chrome p-2 font-mono text-label focus:border-fg/40 focus:outline-none focus-visible:outline-none placeholder:text-faint"
    />
  );
}

function ScheduleField({ path, schedule }: { path: string; schedule: Schedule | undefined }) {
  const { t } = useT();
  const updateFlow = useStore((s) => s.updateFlow);
  const mode = schedule && "dailyAt" in schedule ? "daily" : "every";
  const setSchedule = (next: Schedule) =>
    updateFlow(path, (f) => (f.kind === "event" ? { ...f, schedule: next } : f), "event:schedule");
  return (
    <Field label={t("properties.schedule")} hint={t("properties.scheduleHint")}>
      <div className="flex gap-2">
        <select
          className={`${selectCls} w-36`}
          value={mode}
          onChange={(e) =>
            setSchedule(e.target.value === "daily" ? { dailyAt: "09:00" } : { everyMinutes: 60 })
          }
        >
          <option value="every">{t("properties.scheduleEvery")}</option>
          <option value="daily">{t("properties.scheduleDaily")}</option>
        </select>
        {schedule && "dailyAt" in schedule ? (
          <Input
            type="time"
            value={schedule.dailyAt}
            onChange={(e) => e.target.value && setSchedule({ dailyAt: e.target.value })}
          />
        ) : (
          <div className="flex flex-1 items-center gap-2">
            <Input
              type="number"
              min={1}
              max={10080}
              value={schedule?.everyMinutes ?? ""}
              onChange={(e) => {
                const n = Math.round(Number(e.target.value));
                if (n >= 1 && n <= 10080) setSchedule({ everyMinutes: n });
              }}
            />
            <span className="shrink-0 text-label text-faint">{t("properties.minutes")}</span>
          </div>
        )}
      </div>
    </Field>
  );
}

export function PropertiesPanel() {
  const { t } = useT();
  useNodes();
  const selection = useStore((s) => s.selection);
  const activePath = useStore((s) => s.activePath);
  const docs = useStore((s) => s.docs);
  const select = useStore((s) => s.select);

  if (selection) {
    const node = docs[selection.path]?.flow?.nodes.find((n) => n.id === selection.nodeId);
    const meta = node && descriptorOf(node.type);
    if (node && meta && meta.category !== "trigger") {
      return (
        <div className="h-full overflow-y-auto">
          <NodeForm
            key={`${selection.path}#${node.id}`}
            path={selection.path}
            nodeId={node.id}
            meta={meta}
            data={node.data}
          />
        </div>
      );
    }
  }
  const path = selection?.path ?? activePath;
  const flow = path ? docs[path]?.flow : undefined;
  if (path && flow) {
    return (
      <div className="h-full overflow-y-auto">
        <FlowSettings path={path} flow={flow} />
        {selection && (
          <div className="px-4">
            <Button variant="ghost" onClick={() => select(null)}>
              {t("properties.clearSelection")}
            </Button>
          </div>
        )}
      </div>
    );
  }
  return <Empty>{t("properties.empty")}</Empty>;
}
