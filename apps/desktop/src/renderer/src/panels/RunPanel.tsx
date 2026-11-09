import { Ban, Play, Square } from "lucide-react";
import { type ReactNode, useEffect, useRef } from "react";
import { Led } from "@/components/Logo";
import { cn, IconButton } from "@/components/ui";
import { useT } from "@/i18n";
import { openFile } from "@/lib/dock";
import { runErrorKey } from "@/lib/runError";
import { type LogEntry, useStore } from "@/lib/store";
import { useRunActions } from "@/lib/useRun";

const VISIBLE = 1000;
const time = (t: number) => new Date(t).toLocaleTimeString("en-GB", { hour12: false });

function Source({ source }: { source?: string }) {
  if (!source) return null;
  const [file, nodeId] = source.split("#");
  const clickable = file?.endsWith(".flow.json");
  return (
    <button
      type="button"
      disabled={!clickable}
      onClick={() => file && openFile(file, nodeId)}
      className="mr-3 shrink-0 text-faint enabled:hover:text-fg enabled:hover:underline"
    >
      {file?.replace(/\.flow\.json$/, "")}
      {nodeId && `#${nodeId}`}
    </button>
  );
}

function Line({ e }: { e: LogEntry }) {
  const { t, tn } = useT();
  let tone: "fg" | "muted" | "faint" | "warn" | "bad" = "muted";
  let content: ReactNode = null;
  switch (e.type) {
    case "log":
      tone =
        e.level === "error"
          ? "bad"
          : e.level === "warn"
            ? "warn"
            : e.level === "debug"
              ? "faint"
              : "muted";
      content = (
        <>
          <Source source={e.source} />
          <span className="break-all whitespace-pre-wrap">{e.message}</span>
        </>
      );
      break;
    case "status":
      tone = e.status === "error" ? "bad" : e.status === "ready" ? "fg" : "muted";
      content = (
        <span className="flex items-center gap-2">
          {e.status === "ready" && <Led on />}
          {t(`status.${e.status}`)}
          {(e.online || e.detail || e.code) && (
            <span className="text-faint">
              ·{" "}
              {e.online
                ? tn("status.online", e.online.guilds, { tag: e.online.tag })
                : runErrorKey(e.code)
                  ? t(runErrorKey(e.code)!)
                  : e.detail}
            </span>
          )}
        </span>
      );
      break;
    case "flow":
      tone = e.phase === "error" ? "bad" : "faint";
      content = (
        <>
          <Source source={e.nodeId ? `${e.flow}#${e.nodeId}` : e.flow} />
          <span>{e.phase === "error" ? e.error : t("run.done", { ms: e.durationMs ?? 0 })}</span>
        </>
      );
      break;
    case "commands":
      content = (
        <span>
          {tn("run.commands", e.names.length, {
            scope: t(e.scope === "guild" ? "run.scopeGuild" : "run.scopeGlobal"),
          })}
          <span className="ml-2 text-fg">{e.names.map((n) => `/${n}`).join("  ")}</span>
        </span>
      );
      break;
    case "gateway":
      tone = "faint";
      content = <span>{e.summary}</span>;
      break;
  }
  return (
    <div
      className={cn(
        "flex gap-4 px-3 hover:bg-hover/60",
        tone === "fg" && "text-fg",
        tone === "muted" && "text-muted",
        tone === "faint" && "text-faint",
        tone === "warn" && "text-warn",
        tone === "bad" && "text-bad",
      )}
    >
      <span className="shrink-0 text-faint/70 tabular-nums">{time(e.time)}</span>
      <div className="flex min-w-0 flex-1">{content}</div>
    </div>
  );
}

export function RunPanel() {
  const { t } = useT();
  const logs = useStore((s) => s.logs);
  const clear = useStore((s) => s.clearLogs);
  const { running, busy, start, stop } = useRunActions();
  const scroller = useRef<HTMLDivElement>(null);
  const stick = useRef(true);
  const visible = logs.length > VISIBLE ? logs.slice(-VISIBLE) : logs;

  useEffect(() => {
    const el = scroller.current;
    if (el && stick.current) el.scrollTop = el.scrollHeight;
  }, [visible]);

  return (
    <div className="flex h-full">
      <div className="flex w-9 shrink-0 flex-col items-center gap-1 border-r border-line py-1">
        {running ? (
          <IconButton label={t("toolbar.stop")} onClick={stop} disabled={busy}>
            <Square size={14} strokeWidth={1.5} className="fill-bad text-bad" />
          </IconButton>
        ) : (
          <IconButton label={t("toolbar.run")} onClick={start} disabled={busy}>
            <Play size={16} strokeWidth={1.5} className="fill-ok text-ok" />
          </IconButton>
        )}
        <IconButton label={t("run.clear")} onClick={clear}>
          <Ban size={16} strokeWidth={1.5} />
        </IconButton>
      </div>
      <div
        ref={scroller}
        onScroll={(e) => {
          const el = e.currentTarget;
          stick.current = el.scrollHeight - el.scrollTop - el.clientHeight < 24;
        }}
        className="flex-1 overflow-y-auto py-2 font-mono text-label leading-5 select-text"
      >
        {visible.length === 0 && <p className="px-3 text-faint">{t("run.empty")}</p>}
        {visible.map((e) => (
          <Line key={e.id} e={e} />
        ))}
      </div>
    </div>
  );
}
