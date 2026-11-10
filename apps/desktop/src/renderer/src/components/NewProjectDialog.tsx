import { useState } from "react";
import { useT } from "@/i18n";
import { api } from "@/lib/api";
import { flushAll } from "@/lib/dock";
import { cleanError, useStore } from "@/lib/store";
import { resolveUnsaved } from "@/lib/unsaved";
import { Button, Dialog, Field, Input } from "./ui";

export function NewProjectDialog() {
  const set = useStore((s) => s.set);
  const onClose = () => set({ newProjectOpen: false });
  const { t } = useT();
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
      const project = await api.project.create(dir, name.trim());
      onClose();
      await setProject(project);
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
