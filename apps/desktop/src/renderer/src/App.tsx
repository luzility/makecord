import { useEffect, useState } from "react";
import { NewProjectDialog } from "./components/NewProjectDialog";
import { SettingsDialog } from "./components/SettingsDialog";
import { Welcome } from "./components/Welcome";
import { Workbench } from "./components/Workbench";
import { actions, runAction } from "./lib/actions";
import { api } from "./lib/api";
import { flushAll } from "./lib/dock";
import { applyUiFont } from "./lib/fonts";
import { isEditableTarget, matches } from "./lib/shortcuts";
import { useStore } from "./lib/store";

export function App() {
  const project = useStore((s) => s.project);
  const newProjectOpen = useStore((s) => s.newProjectOpen);
  const settingsOpen = useStore((s) => s.settingsPage !== null);
  const uiFont = useStore((s) => s.settings.uiFont);

  useEffect(() => {
    applyUiFont(uiFont);
  }, [uiFont]);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    void useStore.getState().loadSettings();
    void api.project.current().then(async (p) => {
      if (p) await useStore.getState().setProject(p);
      setReady(true);
    });
  }, []);

  useEffect(() => {
    document.title = project ? `${project.name} — Makecord` : "Makecord";
  }, [project]);

  useEffect(
    () =>
      api.app.onBeforeClose(() => {
        void flushAll().finally(() => api.app.closeReady());
      }),
    [],
  );

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.defaultPrevented || document.documentElement.hasAttribute("data-modal")) return;
      const action = actions.find((a) => a.shortcuts?.some((sc) => matches(sc, e)));
      if (!action) return;
      if (!action.global && isEditableTarget(e.target)) return;
      e.preventDefault();
      runAction(action.id);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  if (!ready) return null;
  return (
    <>
      {project ? <Workbench key={project.root} /> : <Welcome />}
      {newProjectOpen && <NewProjectDialog />}
      {settingsOpen && <SettingsDialog />}
    </>
  );
}
