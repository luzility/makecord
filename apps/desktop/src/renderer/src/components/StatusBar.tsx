import { AlertTriangle, CircleAlert } from "lucide-react";
import { useEffect, useState } from "react";
import { useT } from "@/i18n";
import { api, type Metrics } from "@/lib/api";
import { focusToolWindow } from "@/lib/dock";
import { runErrorKey } from "@/lib/runError";
import { useStore } from "@/lib/store";
import { Led } from "./Logo";
import { cn, Sep } from "./ui";

export function StatusBar() {
  const { t, tn } = useT();
  const status = useStore((s) => s.status);
  const online = useStore((s) => s.online);
  const rawDetail = useStore((s) => s.statusDetail);
  const code = useStore((s) => s.statusCode);
  const notice = useStore((s) => s.notice);
  const set = useStore((s) => s.set);
  const errorKey = runErrorKey(code);
  const detail = online
    ? tn("status.online", online.guilds, { tag: online.tag })
    : errorKey
      ? t(errorKey)
      : rawDetail;
  const problems = useStore((s) => s.problems);
  const [metrics, setMetrics] = useState<Metrics | null>(null);

  useEffect(() => {
    let alive = true;
    const tick = () => api.app.metrics().then((m) => alive && setMetrics(m));
    void tick();
    const id = setInterval(tick, 3000);
    return () => {
      alive = false;
      clearInterval(id);
    };
  }, []);

  const errors = problems.filter((p) => p.severity === "error").length;
  const warnings = problems.length - errors;

  return (
    <footer className="flex h-6 shrink-0 items-center gap-4 border-t border-line bg-chrome px-3 text-meta text-faint">
      <button
        type="button"
        className="flex items-center gap-2 transition-colors duration-150 ease-out hover:text-fg"
        onClick={() => focusToolWindow("run")}
        title={detail}
      >
        {status === "error" ? (
          <span className="size-2 rounded-full bg-bad" />
        ) : (
          <Led on={status === "ready"} />
        )}
        <span className={cn(status === "ready" && "text-muted")}>{t(`status.${status}`)}</span>
        {(status === "ready" || status === "error") && detail && (
          <>
            <Sep />
            <span className={cn("max-w-[480px] truncate", status === "error" && "text-bad")}>
              {detail}
            </span>
          </>
        )}
      </button>
      <button
        type="button"
        className="flex items-center gap-3 tabular-nums transition-colors duration-150 ease-out hover:text-fg"
        onClick={() => focusToolWindow("problems")}
      >
        <span className="flex items-center gap-1">
          <CircleAlert size={12} strokeWidth={1.5} className={errors ? "text-bad" : ""} /> {errors}
        </span>
        <span className="flex items-center gap-1">
          <AlertTriangle size={12} strokeWidth={1.5} className={warnings ? "text-warn" : ""} />{" "}
          {warnings}
        </span>
      </button>
      {notice && (
        <span className="flex min-w-0 items-center gap-2 text-bad">
          <span className="truncate">
            {notice.key === "saveFailed"
              ? t("notice.saveFailed", { file: notice.file ?? "" })
              : t("notice.actionFailed", { detail: notice.detail })}
          </span>
          <button
            type="button"
            onClick={() => set({ notice: null })}
            className="shrink-0 underline-offset-2 transition-colors duration-150 hover:text-fg hover:underline"
            title={notice.detail}
          >
            {t("notice.dismiss")}
          </button>
        </span>
      )}
      <div className="flex-1" />
      {metrics && (
        <span className="flex items-center gap-2 font-mono tabular-nums" title={t("status.memory")}>
          <span>{t("status.ide", { mb: metrics.ideMB })}</span>
          {metrics.botMB !== null && (
            <>
              <Sep />
              <span>{t("status.bot", { mb: metrics.botMB })}</span>
            </>
          )}
        </span>
      )}
    </footer>
  );
}
