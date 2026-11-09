import { Ban, Play, Search, Square, X } from "lucide-react";
import { type ReactNode, useDeferredValue, useEffect, useMemo, useRef, useState } from "react";
import { Led } from "@/components/Logo";
import { cn, IconButton, Sep } from "@/components/ui";
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
          {(e.online || e.detail || e.code) && <Sep />}
          {(e.online || e.detail || e.code) && (
            <span className="text-faint">
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

type Level = "error" | "warn" | "info" | "debug";
const LEVELS: Level[] = ["error", "warn", "info", "debug"];

function levelOf(e: LogEntry): Level {
  if (e.type === "log") return e.level;
  if (e.type === "flow") return e.phase === "error" ? "error" : "debug";
  if (e.type === "status") return e.status === "error" ? "error" : "info";
  return "info";
}

function textOf(e: LogEntry): string {
  switch (e.type) {
    case "log":
      return `${e.source ?? ""} ${e.message}`;
    case "status":
      return `${e.status} ${e.detail ?? ""}`;
    case "flow":
      return `${e.flow} ${e.nodeId ?? ""} ${e.error ?? ""}`;
    case "commands":
      return e.names.join(" ");
    default:
      return "";
  }
}

export function RunPanel() {
  const { t } = useT();
  const logs = useStore((s) => s.logs);
  const clear = useStore((s) => s.clearLogs);
  const { running, busy, start, stop } = useRunActions();
  const scroller = useRef<HTMLDivElement>(null);
  const stick = useRef(true);
  const [query, setQuery] = useState("");
  const [levels, setLevels] = useState<ReadonlySet<Level>>(new Set(["error", "warn", "info"]));
  const q = useDeferredValue(query.trim().toLowerCase());
  const filtered = useMemo(
    () => logs.filter((e) => levels.has(levelOf(e)) && (!q || textOf(e).toLowerCase().includes(q))),
    [logs, levels, q],
  );
  const visible = filtered.length > VISIBLE ? filtered.slice(-VISIBLE) : filtered;
  const counts = useMemo(() => {
    const c: Record<Level, number> = { error: 0, warn: 0, info: 0, debug: 0 };
    for (const e of logs) c[levelOf(e)]++;
    return c;
  }, [logs]);

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
      <div className="flex min-w-0 flex-1 flex-col">
        <div className="flex h-8 shrink-0 items-center gap-2 border-b border-line px-2">
          <div className="flex h-6 w-56 items-center gap-1.5 rounded-md border border-line bg-chrome px-2 focus-within:border-fg/40">
            <Search size={12} strokeWidth={1.5} className="shrink-0 text-faint" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={t("run.search")}
              className="min-w-0 flex-1 bg-transparent text-label outline-none placeholder:text-faint focus-visible:outline-none"
            />
            {query && (
              <button type="button" aria-label={t("common.clear")} onClick={() => setQuery("")}>
                <X size={12} strokeWidth={1.5} className="text-faint hover:text-fg" />
              </button>
            )}
          </div>
          <fieldset aria-label={t("run.levels")} className="m-0 flex gap-0.5 border-0 p-0">
            {LEVELS.map((l) => (
              <button
                key={l}
                type="button"
                aria-pressed={levels.has(l)}
                onClick={() => {
                  const next = new Set(levels);
                  if (next.has(l)) next.delete(l);
                  else next.add(l);
                  setLevels(next);
                }}
                className={cn(
                  "flex h-6 items-center gap-1 rounded px-2 text-label transition-colors duration-150",
                  levels.has(l) ? "bg-hover text-fg" : "text-faint hover:text-fg",
                )}
              >
                {t(`run.level.${l}`)}
                <span
                  className={cn(
                    "font-mono text-meta tabular-nums",
                    l === "error" && counts.error
                      ? "text-bad"
                      : l === "warn" && counts.warn
                        ? "text-warn"
                        : "text-faint",
                  )}
                >
                  {counts[l]}
                </span>
              </button>
            ))}
          </fieldset>
          {logs.length > 0 && filtered.length !== logs.length && (
            <span className="ml-auto text-meta text-faint">
              {t("run.shown", { shown: filtered.length, total: logs.length })}
            </span>
          )}
        </div>
        <div
          ref={scroller}
          onScroll={(e) => {
            const el = e.currentTarget;
            stick.current = el.scrollHeight - el.scrollTop - el.clientHeight < 24;
          }}
          className="flex-1 overflow-y-auto py-2 font-mono text-label leading-5 select-text"
        >
          {logs.length === 0 && <p className="px-3 text-faint">{t("run.empty")}</p>}
          {logs.length > 0 && visible.length === 0 && (
            <p className="px-3 text-faint">{t("run.noMatch")}</p>
          )}
          {visible.map((e) => (
            <Line key={e.id} e={e} />
          ))}
        </div>
      </div>
    </div>
  );
}
