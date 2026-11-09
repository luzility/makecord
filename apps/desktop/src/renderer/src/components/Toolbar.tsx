import { ArrowBigUp, KeyRound, Laptop, Play, Search, Square } from "lucide-react";
import { useT } from "@/i18n";
import { useStore } from "@/lib/store";
import { useRunActions } from "@/lib/useRun";
import { Logo } from "./Logo";
import { MainMenu } from "./MainMenu";
import { ProjectMenu } from "./ProjectMenu";
import { Titlebar } from "./Titlebar";
import { IconButton, Kbd } from "./ui";

export function Toolbar() {
  const { t } = useT();
  const _project = useStore((s) => s.project);
  const set = useStore((s) => s.set);
  const _setProject = useStore((s) => s.setProject);
  const { running, busy, start, stop } = useRunActions();

  return (
    <Titlebar className="grid grid-cols-[1fr_auto_1fr] items-center gap-4 border-b border-line bg-chrome">
      <div className="flex min-w-0 items-center gap-1">
        <span className="mr-1 flex">
          <Logo size={20} />
        </span>
        <MainMenu />
        <ProjectMenu />
      </div>

      <button
        type="button"
        onClick={() => set({ searchOpen: true })}
        className="flex h-7 w-80 items-center gap-2 rounded-md border border-line bg-panel px-2 text-label text-faint transition-colors duration-150 ease-out hover:border-line-strong"
      >
        <Search size={16} strokeWidth={1.5} />
        {t("toolbar.search")}
        <span className="ml-auto flex gap-1">
          <Kbd>
            <ArrowBigUp size={12} strokeWidth={1.5} aria-label="Shift" />
          </Kbd>
          <Kbd>
            <ArrowBigUp size={12} strokeWidth={1.5} aria-hidden="true" />
          </Kbd>
        </span>
      </button>

      <div className="flex items-center justify-end gap-1">
        <span
          className="mr-1 flex h-7 items-center gap-2 px-2 text-label text-muted"
          title={t("toolbar.runConfigHint")}
        >
          <Laptop size={16} strokeWidth={1.5} className="text-faint" />
          {t("toolbar.runConfig")}
        </span>
        {running ? (
          <IconButton label={t("toolbar.stop")} onClick={stop} disabled={busy}>
            <Square size={14} strokeWidth={1.5} className="fill-bad text-bad" />
          </IconButton>
        ) : (
          <IconButton label={t("toolbar.run")} onClick={start} disabled={busy}>
            <Play size={16} strokeWidth={1.5} className="fill-ok text-ok" />
          </IconButton>
        )}
        <div className="mx-1 h-4 w-px bg-line" />
        <IconButton label={t("toolbar.secrets")} onClick={() => set({ secretsOpen: true })}>
          <KeyRound size={16} strokeWidth={1.5} />
        </IconButton>
      </div>
    </Titlebar>
  );
}
