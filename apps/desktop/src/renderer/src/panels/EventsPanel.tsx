import { Ban, Pause, Play, Search, X } from "lucide-react";
import { useDeferredValue, useEffect, useMemo, useRef, useState } from "react";
import { cn, IconButton } from "@/components/ui";
import { useT } from "@/i18n";
import { type GatewayEntry, useStore } from "@/lib/store";

const time = (t: number) =>
  `${new Date(t).toLocaleTimeString("en-GB", { hour12: false })}.${String(t % 1000).padStart(3, "0")}`;

export function EventsPanel() {
  const { t } = useT();
  const live = useStore((s) => s.gateway);
  const clear = useStore((s) => s.clearGateway);
  const [frozen, setFrozen] = useState<GatewayEntry[] | null>(null);
  const [query, setQuery] = useState("");
  const [onlyHandled, setOnlyHandled] = useState(false);
  const q = useDeferredValue(query.trim().toLowerCase());
  const scroller = useRef<HTMLDivElement>(null);
  const stick = useRef(true);
  const source = frozen ?? live;
  const rows = useMemo(
    () =>
      source.filter(
        (e) =>
          (!onlyHandled || e.handled) &&
          (!q || `${e.event} ${e.summary}`.toLowerCase().includes(q)),
      ),
    [source, onlyHandled, q],
  );

  useEffect(() => {
    const el = scroller.current;
    if (el && stick.current) el.scrollTop = el.scrollHeight;
  }, [rows]);

  return (
    <div className="flex h-full flex-col">
      <div className="flex h-8 shrink-0 items-center gap-2 border-b border-line px-2">
        <IconButton
          label={frozen ? t("gateway.resumeList") : t("gateway.pauseList")}
          onClick={() => setFrozen(frozen ? null : live)}
        >
          {frozen ? <Play size={14} strokeWidth={1.5} /> : <Pause size={14} strokeWidth={1.5} />}
        </IconButton>
        <IconButton
          label={t("run.clear")}
          onClick={() => {
            clear();
            setFrozen(null);
          }}
        >
          <Ban size={14} strokeWidth={1.5} />
        </IconButton>
        <div className="flex h-6 w-56 items-center gap-1.5 rounded-md border border-line bg-chrome px-2 focus-within:border-fg/40">
          <Search size={12} strokeWidth={1.5} className="shrink-0 text-faint" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t("gateway.search")}
            className="min-w-0 flex-1 bg-transparent text-label outline-none placeholder:text-faint focus-visible:outline-none"
          />
          {query && (
            <button type="button" aria-label={t("common.clear")} onClick={() => setQuery("")}>
              <X size={12} strokeWidth={1.5} className="text-faint hover:text-fg" />
            </button>
          )}
        </div>
        <label className="flex items-center gap-2 text-label text-muted">
          <input
            type="checkbox"
            className="accent-fg"
            checked={onlyHandled}
            onChange={(e) => setOnlyHandled(e.target.checked)}
          />
          {t("gateway.onlyHandled")}
        </label>
        <span className="ml-auto text-meta text-faint">
          {t("gateway.count", { count: rows.length })}
        </span>
      </div>
      <div
        ref={scroller}
        onScroll={(e) => {
          const el = e.currentTarget;
          stick.current = el.scrollHeight - el.scrollTop - el.clientHeight < 24;
        }}
        className="min-h-0 flex-1 overflow-y-auto py-1 font-mono text-label leading-5 select-text"
      >
        {rows.length === 0 && <p className="px-3 text-faint">{t("gateway.empty")}</p>}
        {rows.map((e) => (
          <div key={e.id} className="flex gap-3 px-3 hover:bg-hover/60">
            <span className="shrink-0 text-faint/70 tabular-nums">{time(e.time)}</span>
            <span
              title={e.handled ? t("gateway.handled") : undefined}
              className={cn("w-56 shrink-0 truncate", e.handled ? "text-fg" : "text-muted")}
            >
              {e.handled && (
                <span className="mr-1.5 inline-block size-1.5 rounded-full bg-ok align-middle" />
              )}
              {e.event}
            </span>
            <span className="min-w-0 flex-1 truncate text-faint">{e.summary}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
