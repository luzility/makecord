import { CUSTOM_ID_EVENTS, type Flow, messageFileOf, type Schedule } from "@makecord/spec";
import { ExternalLink } from "lucide-react";
import { useState } from "react";
import { Select } from "@/components/Select";
import { Button, cn, Empty, Field, IconButton, Input } from "@/components/ui";
import { useT } from "@/i18n";
import { openFile } from "@/lib/dock";
import { useMessageNames } from "@/lib/messages";
import { descriptorOf, fieldsOf, type NodeDescriptor, nodeText, useNodes } from "@/lib/nodes";
import { problemText } from "@/lib/problems";
import { useStore } from "@/lib/store";
import { SELECTABLE_EVENTS } from "@/lib/templates";
import { variablesFor } from "@/lib/variables";
import { CommandSettings } from "./CommandSettings";
import { FunctionSettings } from "./FunctionSettings";

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
        const fnKey = fieldsOf(meta).find((x) => x.kind === "function")?.key;
        if (f.kind === "functionArgs" && !String(data[fnKey ?? ""] ?? "").trim()) return null;
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
            ) : f.kind === "function" ? (
              <FunctionPicker value={String(value ?? "")} onChange={(v) => setField(f.key, v)} />
            ) : f.kind === "functionArgs" ? (
              <FunctionArgs
                fn={String(data[fnKey ?? ""] ?? "")}
                value={(value ?? {}) as Record<string, string>}
                onChange={(v) => setField(f.key, v)}
              />
            ) : f.kind === "enum" ? (
              <Select
                value={String(value ?? "")}
                options={(f.options ?? []).map((o) => ({ value: o, label: o }))}
                onChange={(v) => setField(f.key, v)}
              />
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
  if (flow.kind === "event" && flow.event === "function") {
    return (
      <div className="flex flex-col gap-4 p-4">
        <h3 className="text-title font-medium">{t("properties.functionTitle")}</h3>
        {notice}
        <FunctionSettings path={path} signature={flow.function} />
      </div>
    );
  }
  if (flow.kind === "event") {
    return (
      <div className="flex flex-col gap-4 p-4">
        <h3 className="text-title font-medium">{t("properties.eventTitle")}</h3>
        {notice}
        <Field label={t("properties.event")}>
          <Select
            value={flow.event}
            options={SELECTABLE_EVENTS.map((ev) => ({ value: ev, label: t(`events.${ev}`) }))}
            onChange={(event) => updateFlow(path, (f) => ({ ...f, event }))}
          />
        </Field>
        {flow.event === "beforeCommand" && (
          <Field label={t("properties.commandFilter")} hint={t("properties.commandFilterHint")}>
            <Input
              className="font-mono"
              maxLength={100}
              value={flow.customId ?? ""}
              placeholder="mod*"
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

const NEW_DESIGN = ":new-design";

function MessagePicker({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const { t } = useT();
  const names = useMessageNames();
  const set = useStore((s) => s.set);
  const known = !value || names.includes(value);
  return (
    <div className="flex gap-1">
      <Select
        value={value}
        options={[
          { value: "", label: t("properties.noDesign") },
          ...names.map((n) => ({ value: n, label: n })),
          ...(known ? [] : [{ value, label: value }]),
          { value: NEW_DESIGN, label: t("properties.newDesign"), divider: true },
        ]}
        onChange={(v) => {
          if (v === NEW_DESIGN) set({ newFlowOpen: "message" });
          else onChange(v);
        }}
      />
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

const NEW_FUNCTION = ":new-function";

function FunctionPicker({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const { t } = useT();
  const functions = useStore((s) => s.functions);
  const set = useStore((s) => s.set);
  const current = functions.find((f) => f.name === value);
  return (
    <div className="flex gap-1">
      <Select
        value={value}
        options={[
          ...(value ? [] : [{ value: "", label: t("properties.noFunction") }]),
          ...functions.map((f) => ({ value: f.name, label: f.name })),
          ...(value && !current ? [{ value, label: value }] : []),
          { value: NEW_FUNCTION, label: t("properties.newFunction"), divider: true },
        ]}
        onChange={(v) => {
          if (v === NEW_FUNCTION) set({ newFlowOpen: "function" });
          else onChange(v);
        }}
      />
      <IconButton
        label={t("properties.openFunction")}
        disabled={!current}
        onClick={() => current && void openFile(current.file)}
      >
        <ExternalLink size={14} strokeWidth={1.5} />
      </IconButton>
    </div>
  );
}

function FunctionArgs({
  fn,
  value,
  onChange,
}: {
  fn: string;
  value: Record<string, string>;
  onChange: (v: Record<string, string>) => void;
}) {
  const { t } = useT();
  const sig = useStore((s) => s.functions.find((f) => f.name === fn));
  if (!sig) return null;
  if (!sig.params.length) return <p className="text-meta text-faint">{t("properties.noArgs")}</p>;
  return (
    <div className="flex flex-col gap-2">
      {sig.params.map((p) => (
        <label key={p.name} className="flex flex-col gap-1">
          <span className="flex items-baseline gap-2 font-mono text-meta text-muted">
            {p.name}
            {p.required && <span className="text-bad">*</span>}
            {p.description && (
              <span className="truncate font-sans text-faint">{p.description}</span>
            )}
          </span>
          <Input
            value={value[p.name] ?? ""}
            placeholder={t(`properties.paramTypes.${p.type}`)}
            onChange={(e) => {
              const next = { ...value, [p.name]: e.target.value };
              if (!e.target.value) delete next[p.name];
              onChange(next);
            }}
          />
        </label>
      ))}
    </div>
  );
}

function TimeInput({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const [draft, setDraft] = useState(value);
  const [seen, setSeen] = useState(value);
  if (seen !== value) {
    setSeen(value);
    setDraft(value);
  }
  const valid = (v: string) => /^([01]\d|2[0-3]):[0-5]\d$/.test(v);
  return (
    <Input
      className={cn("w-20 font-mono tabular-nums", !valid(draft) && "border-bad/60")}
      value={draft}
      maxLength={5}
      placeholder="09:00"
      inputMode="numeric"
      onChange={(e) => {
        let v = e.target.value.replace(/[^\d:]/g, "");
        if (/^\d{3,4}$/.test(v)) v = `${v.slice(0, 2)}:${v.slice(2)}`;
        setDraft(v);
        if (valid(v)) onChange(v);
      }}
      onBlur={() => {
        const m = draft.match(/^(\d{1,2}):?(\d{0,2})$/);
        if (!m) return setDraft(value);
        const fixed = `${m[1]!.padStart(2, "0")}:${(m[2] || "0").padEnd(2, "0")}`;
        if (valid(fixed)) {
          setDraft(fixed);
          onChange(fixed);
        } else setDraft(value);
      }}
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
        <Select
          className="w-36 shrink-0"
          value={mode}
          options={[
            { value: "every", label: t("properties.scheduleEvery") },
            { value: "daily", label: t("properties.scheduleDaily") },
          ]}
          onChange={(m) => setSchedule(m === "daily" ? { dailyAt: "09:00" } : { everyMinutes: 60 })}
        />
        {schedule && "dailyAt" in schedule ? (
          <TimeInput value={schedule.dailyAt} onChange={(dailyAt) => setSchedule({ dailyAt })} />
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
  const activePath = useStore((s) => s.activePath);
  const selection = useStore((s) => (s.selection?.path === s.activePath ? s.selection : null));
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
  const path = activePath;
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
