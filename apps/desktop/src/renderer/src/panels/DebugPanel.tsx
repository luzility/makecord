import { ChevronRight, CirclePause, Play, Square, StepForward, Trash2 } from "lucide-react";
import { useState } from "react";
import { cn, Empty, IconButton } from "@/components/ui";
import { useT } from "@/i18n";
import { openFile } from "@/lib/dock";
import { nodeTitle } from "@/lib/nodes";
import { type PausedRun, useStore } from "@/lib/store";

const isObject = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null;

function Value({ value }: { value: unknown }) {
  if (typeof value === "string")
    return <span className="break-all text-cat-action">"{value}"</span>;
  if (typeof value === "number" || typeof value === "boolean")
    return <span className="text-cat-logic">{String(value)}</span>;
  if (value === null) return <span className="text-faint">null</span>;
  if (Array.isArray(value)) return <span className="text-faint">[{value.length}]</span>;
  return <span className="text-faint">{"{…}"}</span>;
}

function Tree({ name, value, depth = 0 }: { name: string; value: unknown; depth?: number }) {
  const [open, setOpen] = useState(depth === 0);
  const branch = isObject(value);
  const entries = branch ? Object.entries(value) : [];
  return (
    <li>
      <button
        type="button"
        disabled={!branch || entries.length === 0}
        onClick={() => setOpen(!open)}
        style={{ paddingLeft: 4 + depth * 14 }}
        className="flex w-full min-w-0 items-start gap-1 rounded py-0.5 pr-2 text-left hover:bg-hover/60 disabled:hover:bg-transparent"
      >
        <ChevronRight
          size={12}
          strokeWidth={1.5}
          className={cn(
            "mt-1 shrink-0 text-faint transition-transform duration-150",
            open && "rotate-90",
            (!branch || entries.length === 0) && "invisible",
          )}
        />
        <span className="shrink-0 text-muted">{name}</span>
        <span className="text-faint">=</span>
        <span className="min-w-0">
          <Value value={value} />
        </span>
      </button>
      {branch && open && (
        <ul>
          {entries.map(([k, v]) => (
            <Tree key={k} name={k} value={v} depth={depth + 1} />
          ))}
        </ul>
      )}
    </li>
  );
}

function RunView({ run }: { run: PausedRun }) {
  const { t, locale } = useT();
  const resume = useStore((s) => s.resumeRun);
  const flow = useStore((s) => s.docs[run.flow]?.flow);
  const node = flow?.nodes.find((n) => n.id === run.nodeId);
  const scope = isObject(run.scope) ? { ...run.scope } : {};
  delete scope.vars;
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex h-8 shrink-0 items-center gap-1 border-b border-line px-2">
        <IconButton
          label={`${t("debug.resume")} (F9)`}
          onClick={() => resume(run.runId, "continue")}
        >
          <Play size={14} strokeWidth={1.5} className="fill-ok text-ok" />
        </IconButton>
        <IconButton label={`${t("debug.step")} (F8)`} onClick={() => resume(run.runId, "step")}>
          <StepForward size={14} strokeWidth={1.5} />
        </IconButton>
        <IconButton label={t("debug.stopRun")} onClick={() => resume(run.runId, "stop")}>
          <Square size={12} strokeWidth={1.5} className="fill-bad text-bad" />
        </IconButton>
        <button
          type="button"
          onClick={() => void openFile(run.flow, run.nodeId)}
          className="ml-2 min-w-0 truncate text-label text-muted hover:text-fg hover:underline"
        >
          {run.flow.replace(/\.flow\.json$/, "")} ›{" "}
          {node ? nodeTitle(node.type, locale) : run.nodeId}
        </button>
        <span className="ml-auto shrink-0 text-meta text-faint">{t("debug.beforeRunning")}</span>
      </div>
      <ul className="min-h-0 flex-1 overflow-y-auto py-1 font-mono text-label select-text">
        <Tree name="vars" value={run.vars} />
        {Object.entries(scope).map(([k, v]) => (
          <Tree key={k} name={k} value={v} />
        ))}
      </ul>
    </div>
  );
}

export function DebugPanel() {
  const { t, locale } = useT();
  const paused = useStore((s) => s.paused);
  const activeRun = useStore((s) => s.activeRun);
  const breakpoints = useStore((s) => s.breakpoints);
  const docs = useStore((s) => s.docs);
  const set = useStore((s) => s.set);
  const toggle = useStore((s) => s.toggleBreakpoint);
  const clearAll = useStore((s) => s.clearBreakpoints);
  const run = paused.find((p) => p.runId === activeRun) ?? paused[0];
  const list = Object.entries(breakpoints).flatMap(([path, ids]) =>
    ids.map((id) => ({ path, id })),
  );

  return (
    <div className="flex h-full">
      <div className="flex w-60 shrink-0 flex-col border-r border-line">
        <div className="flex h-8 shrink-0 items-center justify-between px-3">
          <span className="text-label text-muted">{t("debug.breakpoints")}</span>
          <IconButton
            label={t("debug.clearBreakpoints")}
            disabled={!list.length}
            onClick={clearAll}
          >
            <Trash2 size={14} strokeWidth={1.5} />
          </IconButton>
        </div>
        <ul className="min-h-0 flex-1 overflow-y-auto px-1 pb-2">
          {list.length === 0 && (
            <li className="px-2 text-label text-faint">{t("debug.noBreakpoints")}</li>
          )}
          {list.map(({ path, id }) => {
            const type = docs[path]?.flow?.nodes.find((n) => n.id === id)?.type;
            return (
              <li
                key={`${path}#${id}`}
                className="group flex items-center gap-2 rounded-md px-2 hover:bg-hover"
              >
                <button
                  type="button"
                  onClick={() => toggle(path, id)}
                  aria-label={t("debug.toggleBreakpoint")}
                >
                  <span className="block size-2.5 rounded-full bg-bad" />
                </button>
                <button
                  type="button"
                  onClick={() => void openFile(path, id)}
                  className="h-7 min-w-0 flex-1 truncate text-left text-label text-muted group-hover:text-fg"
                >
                  {path.replace(/^.*\//, "").replace(/\.flow\.json$/, "")} ›{" "}
                  {type ? nodeTitle(type, locale) : id}
                </button>
              </li>
            );
          })}
        </ul>
        {paused.length > 1 && (
          <div className="border-t border-line px-1 py-1">
            {paused.map((p) => (
              <button
                key={p.runId}
                type="button"
                onClick={() => set({ activeRun: p.runId })}
                className={cn(
                  "flex h-7 w-full items-center gap-2 rounded-md px-2 text-left text-label",
                  p.runId === run?.runId ? "bg-hover text-fg" : "text-muted hover:bg-hover",
                )}
              >
                <CirclePause size={12} strokeWidth={1.5} className="text-bad" />
                <span className="truncate">
                  {p.flow.replace(/^.*\//, "").replace(/\.flow\.json$/, "")}
                </span>
              </button>
            ))}
          </div>
        )}
      </div>
      {run ? <RunView run={run} /> : <Empty>{t("debug.idle")}</Empty>}
    </div>
  );
}
