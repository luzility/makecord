import { PROJECT_FILE, ProjectConfig } from "@makecord/spec";
import { AlertTriangle, CircleAlert, Wrench } from "lucide-react";
import { Button, Empty } from "@/components/ui";
import { useT } from "@/i18n";
import { api, type Problem } from "@/lib/api";
import { openFile } from "@/lib/dock";
import { problemText } from "@/lib/problems";
import { cleanError, useStore } from "@/lib/store";
import { toJson } from "@/lib/templates";

async function applyFix(p: Problem) {
  if (p.fix?.kind !== "addIntent") return;
  try {
    const config = ProjectConfig.parse(JSON.parse(await api.fs.read(PROJECT_FILE)));
    if (!config.intents.includes(p.fix.intent)) config.intents.push(p.fix.intent);
    await api.fs.write(PROJECT_FILE, toJson(config));
  } catch (e) {
    useStore.getState().set({ notice: { key: "actionFailed", detail: cleanError(e) } });
  }
}

export function ProblemsPanel() {
  const { t, locale } = useT();
  const problems = useStore((s) => s.problems);
  if (problems.length === 0) return <Empty>{t("problems.none")}</Empty>;
  const sorted = [...problems].sort((a, b) =>
    a.severity === b.severity ? a.file.localeCompare(b.file) : a.severity === "error" ? -1 : 1,
  );
  return (
    <ul className="flex h-full flex-col overflow-y-auto p-1 text-body">
      {sorted.map((p) => (
        <li
          key={`${p.file}#${p.nodeId}:${p.code}:${p.message}`}
          className="group flex h-7 shrink-0 items-center gap-2 rounded-md px-2 hover:bg-hover"
        >
          {p.severity === "error" ? (
            <CircleAlert size={16} strokeWidth={1.5} className="shrink-0 text-bad" />
          ) : (
            <AlertTriangle size={16} strokeWidth={1.5} className="shrink-0 text-warn" />
          )}
          <button
            type="button"
            className="flex min-w-0 flex-1 items-baseline gap-3 text-left"
            onClick={() => openFile(p.file, p.nodeId)}
          >
            <span className="truncate">{problemText(p, locale)}</span>
            <span className="shrink-0 font-mono text-meta text-faint">
              {p.file}
              {p.nodeId && `#${p.nodeId}`}
            </span>
          </button>
          {p.fix && (
            <Button
              variant="ghost"
              className="opacity-0 group-hover:opacity-100"
              onClick={() => applyFix(p)}
            >
              <Wrench size={16} strokeWidth={1.5} />{" "}
              {t("problems.fixIntent", { intent: p.fix.intent })}
            </Button>
          )}
        </li>
      ))}
    </ul>
  );
}
