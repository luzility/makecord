import { useT } from "@/i18n";
import { useStore } from "@/lib/store";
import { Button, Dialog } from "./ui";

const nameOf = (path: string) =>
  path
    .split("/")
    .pop()
    ?.replace(/\.(flow|message)\.json$/, "") ?? path;

export function UnsavedDialog() {
  const { t, tn } = useT();
  const prompt = useStore((s) => s.unsavedPrompt);
  if (!prompt) return null;
  const { paths, resolve } = prompt;
  const one = paths.length === 1;
  return (
    <Dialog title={t("unsaved.title")} onClose={() => resolve("cancel")}>
      <p className="text-body text-muted">
        {one ? t("unsaved.one", { name: nameOf(paths[0]!) }) : tn("unsaved.many", paths.length)}
      </p>
      {!one && (
        <ul className="mt-3 flex max-h-40 flex-col gap-1 overflow-y-auto rounded-md border border-line bg-chrome p-2 font-mono text-label text-muted">
          {paths.map((p) => (
            <li key={p} className="truncate">
              {p}
            </li>
          ))}
        </ul>
      )}
      <p className="mt-3 text-label text-faint">{t("unsaved.hint")}</p>
      <div className="mt-4 flex items-center justify-between gap-2">
        <Button variant="danger" onClick={() => resolve("discard")}>
          {t("unsaved.discard")}
        </Button>
        <div className="flex gap-2">
          <Button variant="ghost" onClick={() => resolve("cancel")}>
            {t("common.cancel")}
          </Button>
          <Button variant="primary" autoFocus onClick={() => resolve("save")}>
            {t(one ? "unsaved.save" : "unsaved.saveAll")}
          </Button>
        </div>
      </div>
    </Dialog>
  );
}
