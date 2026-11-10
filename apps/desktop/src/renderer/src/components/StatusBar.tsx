import { AlertTriangle, CircleAlert } from "lucide-react";
import { useEffect, useState } from "react";
import { useT } from "@/i18n";
import { api, type Metrics } from "@/lib/api";
import { flushAll, focusToolWindow } from "@/lib/dock";
import { runErrorKey } from "@/lib/runError";
import { useStore } from "@/lib/store";
import { resolveUnsaved } from "@/lib/unsaved";
import { Led } from "./Logo";
import { cn, Sep } from "./ui";

function UpdateButton() {
  const { t } = useT();
  const [version, setVersion] = useState<string | null>(null);
  useEffect(() => {
    void api.app.pendingUpdate().then(setVersion);
    return api.app.onUpdateReady(setVersion);
  }, []);
  if (!version) return null;
  return (
    <button
      type="button"
      title={t("update.hint")}
      onClick={async () => {
        if (!(await resolveUnsaved())) return;
        await flushAll();
        await api.app.installUpdate();
      }}
      className="rounded px-1.5 text-ok transition-colors duration-150 hover:bg-hover"
    >
      {t("update.ready", { version })}
    </button>
  );
}

function SaveState() {
  const { t } = useT();
  const savedAt = useStore((s) => s.savedAt);
  const autoSave = useStore((s) => s.settings.autoSave);
  const unsaved = useStore((s) => Object.keys(s.docs).filter((p) => s.isDirty(p)).length);
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!savedAt) return;
    setNow(Date.now());
    const id = setTimeout(() => setNow(Date.now()), 2100);
    return () => clearTimeout(id);
  }, [savedAt]);
  if (savedAt && now - savedAt < 2000) {
    return <span className="text-muted">{t("status.saved")}</span>;
  }
  if (!autoSave && unsaved > 0) {
    return (
      <span className="text-muted" title={t("status.unsavedHint")}>
        {t("status.unsaved", { count: unsaved })}
      </span>
    );
  }
  return null;
}

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
      <UpdateButton />
      <SaveState />
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
