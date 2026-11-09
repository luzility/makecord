import type { ReactNode } from "react";
import { Button, Kbd } from "@/components/ui";
import { useT } from "@/i18n";
import { useStore } from "@/lib/store";

function Step({ n, title, children }: { n: number; title: string; children: ReactNode }) {
  return (
    <li className="grid grid-cols-[24px_1fr] gap-x-4 gap-y-1">
      <span className="row-span-2 font-mono text-label text-faint tabular-nums">
        {String(n).padStart(2, "0")}
      </span>
      <h3 className="text-body font-medium">{title}</h3>
      <div className="text-body text-muted">{children}</div>
    </li>
  );
}

export function StartPanel() {
  const { t } = useT();
  const set = useStore((s) => s.set);
  return (
    <div className="h-full overflow-y-auto">
      <div className="mx-auto max-w-[480px] px-8 py-12">
        <h1 className="text-heading font-medium">{t("start.title")}</h1>
        <p className="mt-1 mb-8 text-body text-muted">{t("start.subtitle")}</p>
        <ol className="flex flex-col gap-8">
          <Step n={1} title={t("start.tokenTitle")}>
            <p>{t("start.tokenBody")}</p>
            <Button className="mt-3" onClick={() => set({ secretsOpen: true })}>
              {t("start.openSecrets")}
            </Button>
          </Step>
          <Step n={2} title={t("start.commandTitle")}>
            <p>{t("start.commandBody")}</p>
          </Step>
          <Step n={3} title={t("start.runTitle")}>
            <p>{t("start.runBody")}</p>
          </Step>
          <Step n={4} title={t("start.searchTitle")}>
            <p>{t("start.searchBody")}</p>
            <p className="mt-3 flex items-center gap-1 text-label text-faint">
              <Kbd>Shift</Kbd> <Kbd>Shift</Kbd> <span className="mx-1">{t("start.or")}</span>{" "}
              <Kbd>Ctrl</Kbd> <Kbd>K</Kbd>
            </p>
          </Step>
        </ol>
      </div>
    </div>
  );
}
