import { FolderOpen, Plus } from "lucide-react";
import { useEffect, useState } from "react";
import { useT } from "@/i18n";
import { api } from "@/lib/api";
import { cleanError, useStore } from "@/lib/store";
import { LanguageSwitch } from "./LanguageSwitch";
import { Logo } from "./Logo";
import { Titlebar } from "./Titlebar";
import { Button } from "./ui";

export function Welcome() {
  const { t } = useT();
  const setProject = useStore((s) => s.setProject);
  const set = useStore((s) => s.set);
  const [recent, setRecent] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void api.project.recent().then(setRecent);
  }, []);

  const open = async (root?: string) => {
    setError(null);
    try {
      const p = await api.project.open(root);
      if (p) await setProject(p);
    } catch (e) {
      setError(cleanError(e));
    }
  };

  return (
    <div className="flex h-full flex-col">
      <Titlebar />
      <div className="flex flex-1 items-center justify-center p-4 pb-14">
        <div className="flex h-[400px] w-[720px] max-w-full overflow-hidden rounded-xl border border-line bg-panel">
          <div className="flex w-60 shrink-0 flex-col border-r border-line bg-chrome p-4">
            <div className="mb-8 flex items-center gap-3">
              <Logo size={28} />
              <div className="flex flex-col">
                <span className="text-title font-medium">Makecord</span>
                <span className="font-mono text-meta text-faint">0.1.0</span>
              </div>
            </div>
            <div className="flex flex-col gap-1">
              <Button
                variant="primary"
                className="justify-start"
                onClick={() => set({ newProjectOpen: true })}
              >
                <Plus size={16} strokeWidth={1.5} /> {t("welcome.newProject")}
              </Button>
              <Button variant="ghost" className="justify-start" onClick={() => open()}>
                <FolderOpen size={16} strokeWidth={1.5} /> {t("welcome.open")}
              </Button>
            </div>
            <div className="mt-auto">
              <LanguageSwitch />
            </div>
          </div>
          <div className="flex flex-1 flex-col overflow-hidden p-4">
            <h2 className="mb-2 text-label text-muted">{t("welcome.recent")}</h2>
            {recent.length === 0 && <p className="text-label text-faint">{t("welcome.empty")}</p>}
            <ul className="-mx-2 flex flex-col gap-0.5 overflow-y-auto">
              {recent.map((r) => (
                <li key={r}>
                  <button
                    type="button"
                    onClick={() => open(r)}
                    className="flex w-full flex-col rounded-md px-2 py-2 text-left transition-colors duration-150 ease-out hover:bg-hover"
                  >
                    <span className="text-body">{r.split(/[\\/]/).pop()}</span>
                    <span className="truncate font-mono text-meta text-faint">{r}</span>
                  </button>
                </li>
              ))}
            </ul>
            {error && (
              <p className="mt-auto rounded-md bg-bad/10 px-2 py-2 text-label text-bad">{error}</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
