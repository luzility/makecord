import { useEffect, useState } from "react";
import { useT } from "@/i18n";
import { api, type ProjectTemplate } from "@/lib/api";
import { flushAll } from "@/lib/dock";
import { cleanError, useStore } from "@/lib/store";
import { resolveUnsaved } from "@/lib/unsaved";
import { Button, cn, Dialog, Field, Input } from "./ui";

export function NewProjectDialog() {
  const set = useStore((s) => s.set);
  const onClose = () => set({ newProjectOpen: false });
  const { t, locale } = useT();
  const [templates, setTemplates] = useState<ProjectTemplate[]>([]);
  const [template, setTemplate] = useState("starter");
  useEffect(() => {
    void api.project.templates().then(setTemplates);
  }, []);
  const setProject = useStore((s) => s.setProject);
  const [name, setName] = useState(t("newProject.defaultName"));
  const [dir, setDir] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const create = async () => {
    if (!dir) return;
    setBusy(true);
    setError(null);
    try {
      if (!(await resolveUnsaved())) {
        setBusy(false);
        return;
      }
      await flushAll();
      const project = await api.project.create(dir, name.trim(), template);
      onClose();
      await setProject(project);
      if (templates.find((tp) => tp.id === template)?.plugins.length) {
        useStore.getState().set({ installing: true });
        void api.plugins
          .installDependencies()
          .catch((e) =>
            useStore.getState().set({ notice: { key: "actionFailed", detail: cleanError(e) } }),
          )
          .finally(() => useStore.getState().set({ installing: false }));
      }
    } catch (e) {
      setError(cleanError(e));
      setBusy(false);
    }
  };

  return (
    <Dialog title={t("newProject.title")} onClose={onClose}>
      <form
        className="flex flex-col gap-4"
        onSubmit={(e) => {
          e.preventDefault();
          void create();
        }}
      >
        <Field label={t("newProject.botName")}>
          <Input autoFocus value={name} onChange={(e) => setName(e.target.value)} />
        </Field>
        {templates.length > 1 && (
          <fieldset className="m-0 flex min-w-0 flex-col gap-1.5 border-0 p-0">
            <legend className="mb-1.5 text-label text-muted">{t("newProject.template")}</legend>
            <div className="grid grid-cols-2 gap-1.5">
              {templates.map((tp) => (
                <button
                  key={tp.id}
                  type="button"
                  aria-pressed={template === tp.id}
                  onClick={() => setTemplate(tp.id)}
                  className={cn(
                    "flex flex-col gap-0.5 rounded-lg border p-2.5 text-left transition-colors duration-150 ease-out",
                    template === tp.id
                      ? "border-fg/40 bg-hover"
                      : "border-line hover:border-line-strong hover:bg-hover/50",
                  )}
                >
                  <span className="text-label text-fg">{tp.title[locale] ?? tp.title.en}</span>
                  <span className="text-meta text-faint">
                    {tp.description[locale] ?? tp.description.en}
                  </span>
                </button>
              ))}
            </div>
          </fieldset>
        )}
        <Field label={t("newProject.location")} hint={t("newProject.locationHint")}>
          <div className="flex gap-2">
            <Input
              readOnly
              value={dir ?? ""}
              placeholder={t("newProject.noLocation")}
              className="font-mono"
            />
            <Button onClick={async () => setDir(await api.project.chooseDirectory())}>
              {t("common.choose")}
            </Button>
          </div>
        </Field>
        {error && <p className="text-label text-bad">{error}</p>}
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose}>
            {t("common.cancel")}
          </Button>
          <Button variant="primary" type="submit" disabled={!dir || !name.trim() || busy}>
            {t("common.create")}
          </Button>
        </div>
      </form>
    </Dialog>
  );
}
