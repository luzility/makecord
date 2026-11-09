import {
  CUSTOM_ID_EVENTS,
  type Flow,
  FlowEventName,
  messageFileOf,
  type Schedule,
} from "@makecord/spec";
import { ExternalLink } from "lucide-react";
import { Button, Empty, Field, IconButton, Input, selectCls } from "@/components/ui";
import { useT } from "@/i18n";
import { openFile } from "@/lib/dock";
import { useMessageNames } from "@/lib/messages";
import { descriptorOf, fieldsOf, type NodeDescriptor, nodeText, useNodes } from "@/lib/nodes";
import { problemText } from "@/lib/problems";
import { useStore } from "@/lib/store";
import { variablesFor } from "@/lib/variables";
import { CommandSettings } from "./CommandSettings";

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
    <div className="flex flex-col gap-4 p-4" data-var-scope={`flow:${path}`}>
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
            {f.kind === "message" ? (
              <MessagePicker value={String(value ?? "")} onChange={(v) => setField(f.key, v)} />
            ) : f.kind === "enum" ? (
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
        <p className="mt-2 text-meta text-faint">{t("properties.variablesHint")}</p>
        <ul className="mt-2 flex flex-col gap-1 font-mono text-meta text-muted">
          {variablesFor(flow).map((v) => (
            <li key={v.path} className="select-text">{`{{${v.path}}}`}</li>
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
        {CUSTOM_ID_EVENTS.includes(flow.event) && (
          <Field
            label={t(
              flow.event === "autocomplete" ? "properties.autocompleteFor" : "properties.customId",
            )}
            hint={t(
              flow.event === "autocomplete"
                ? "properties.autocompleteHint"
                : "properties.customIdHint",
            )}
          >
            <Input
              className="font-mono"
              maxLength={100}
              value={flow.customId ?? ""}
              placeholder={flow.event === "autocomplete" ? "search.query" : "vote:*"}
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
  return (
    <div className="flex flex-col gap-4 p-4">
      <h3 className="text-title font-medium">{t("properties.commandTitle")}</h3>
      {notice}
      <CommandSettings path={path} cmd={flow.command} />
    </div>
  );
}

function MessagePicker({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const { t } = useT();
  const names = useMessageNames();
  const set = useStore((s) => s.set);
  const known = !value || names.includes(value);
  return (
    <div className="flex gap-1">
      <select
        className={selectCls}
        value={value}
        onChange={(e) => {
          if (e.target.value === "\u0000new") set({ newFlowOpen: "message" });
          else onChange(e.target.value);
        }}
      >
        <option value="">{t("properties.noDesign")}</option>
        {names.map((n) => (
          <option key={n} value={n}>
            {n}
          </option>
        ))}
        {!known && <option value={value}>{value}</option>}
        <option value={"\u0000new"}>{t("properties.newDesign")}</option>
      </select>
      <IconButton
        label={t("properties.openDesign")}
        disabled={!value || !known}
        onClick={() => void openFile(messageFileOf(value))}
      >
        <ExternalLink size={14} strokeWidth={1.5} />
      </IconButton>
    </div>
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
