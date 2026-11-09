import type { MessageDesign } from "@makecord/spec";
import { Code2, LayoutTemplate } from "lucide-react";
import { useState } from "react";
import { cn } from "@/components/ui";
import { useT } from "@/i18n";
import { problemText } from "@/lib/problems";
import { useStore } from "@/lib/store";
import { TextEditor } from "../TextEditor";
import { ClassicForm } from "./ClassicForm";
import { LayoutForm } from "./LayoutForm";
import { MessagePreview } from "./MessagePreview";
import { toClassic, toLayout } from "./model";

type View = "design" | "code";

function Segmented<T extends string>({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: T;
  options: { id: T; label: string; icon?: typeof Code2 }[];
  onChange: (v: T) => void;
}) {
  return (
    <fieldset
      aria-label={label}
      className="m-0 flex min-w-0 gap-0.5 rounded-md border border-line p-0.5"
    >
      {options.map(({ id, label: text, icon: Icon }) => (
        <button
          key={id}
          type="button"
          aria-pressed={value === id}
          onClick={() => onChange(id)}
          className={cn(
            "flex h-6 items-center gap-1.5 rounded px-2 text-label transition-colors duration-150 ease-out",
            value === id ? "bg-hover text-fg" : "text-faint hover:text-fg",
          )}
        >
          {Icon && <Icon size={14} strokeWidth={1.5} />}
          {text}
        </button>
      ))}
    </fieldset>
  );
}

export function MessageEditor({ path }: { path: string }) {
  const { t, locale } = useT();
  const doc = useStore((s) => s.docs[path]);
  const updateMessage = useStore((s) => s.updateMessage);
  const allProblems = useStore((s) => s.problems);
  const [view, setView] = useState<View>("design");
  if (!doc) return null;

  const message = doc.message;
  const problems = allProblems.filter((p) => p.file === path);

  const toolbar = (
    <div className="flex h-9 shrink-0 items-center justify-between gap-2 border-b border-line px-2">
      {message ? (
        <Segmented<MessageDesign["kind"]>
          label={t("message.format")}
          value={message.kind}
          options={[
            { id: "classic", label: t("message.classic") },
            { id: "componentsV2", label: t("message.componentsV2") },
          ]}
          onChange={(kind) => {
            if (kind === message.kind) return;
            updateMessage(path, (m) => (m.kind === "classic" ? toLayout(m) : toClassic(m)));
          }}
        />
      ) : (
        <span />
      )}
      <Segmented<View>
        label={t("editor.view")}
        value={message ? view : "code"}
        options={[
          { id: "design", label: t("message.design"), icon: LayoutTemplate },
          { id: "code", label: t("editor.viewCode"), icon: Code2 },
        ]}
        onChange={setView}
      />
    </div>
  );

  if (!message || view === "code") {
    return (
      <div className="flex h-full flex-col">
        {toolbar}
        {!message && (
          <div className="shrink-0 border-b border-line px-4 py-3">
            <p className="text-body font-medium text-bad">{t("message.unreadable")}</p>
            <p className="font-mono text-label text-muted">{doc.parseError}</p>
          </div>
        )}
        <div className="min-h-0 flex-1">
          <TextEditor path={path} />
        </div>
      </div>
    );
  }

  const update = <M extends MessageDesign>(fn: (m: M) => M, key: string) =>
    updateMessage(path, fn as unknown as (m: MessageDesign) => MessageDesign, key);

  return (
    <div className="flex h-full flex-col">
      {toolbar}
      <div className="flex min-h-0 flex-1">
        <div
          data-var-scope="message"
          className="flex w-[420px] min-w-[320px] shrink-0 flex-col gap-3 overflow-y-auto border-r border-line p-4"
        >
          {doc.invalid && (
            <p className="rounded-md bg-warn/10 px-2 py-1 text-label text-warn">
              {t("properties.notSaved", { issue: doc.invalid.message })}
            </p>
          )}
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
          {message.kind === "classic" ? (
            <ClassicForm message={message} update={update} />
          ) : (
            <LayoutForm message={message} update={update} />
          )}
        </div>
        <div className="min-w-0 flex-1">
          <MessagePreview message={message} />
        </div>
      </div>
    </div>
  );
}
