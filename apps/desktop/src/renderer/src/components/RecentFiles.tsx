import { Command } from "cmdk";
import { useMemo } from "react";
import { useT } from "@/i18n";
import { openFile, openPaths } from "@/lib/dock";
import { fileIcon } from "@/lib/fileIcons";
import { useStore } from "@/lib/store";
import { useModalFlag } from "./ui";

const itemCls =
  "flex h-8 cursor-pointer items-center gap-2 rounded-md px-2 text-body text-muted data-[selected=true]:bg-hover data-[selected=true]:text-fg";

const nameOf = (path: string) =>
  (path.split("/").pop() ?? path).replace(/\.(flow|message)\.json$/, "");

export function RecentFiles() {
  const { t } = useT();
  const set = useStore((s) => s.set);
  const recent = useStore((s) => s.recentFiles);
  const activePath = useStore((s) => s.activePath);
  useModalFlag();
  const close = () => set({ recentOpen: false });
  const paths = useMemo(
    () => [...recent, ...openPaths()].filter((p, i, a) => a.indexOf(p) === i && p !== activePath),
    [recent, activePath],
  );

  return (
    <div
      className="fixed inset-0 z-[1000] flex items-start justify-center bg-black/50 pt-[14vh]"
      onMouseDown={close}
    >
      <Command
        label={t("recent.title")}
        className="w-[480px] max-w-[calc(100vw-32px)] overflow-hidden rounded-xl border border-line bg-panel shadow-2xl shadow-black/60"
        onMouseDown={(e) => e.stopPropagation()}
        onKeyDown={(e) => e.key === "Escape" && close()}
      >
        <Command.Input
          autoFocus
          placeholder={t("recent.placeholder")}
          className="h-11 w-full border-b border-line bg-transparent px-4 text-body outline-none placeholder:text-faint focus-visible:outline-none"
        />
        <Command.List className="max-h-[50vh] overflow-y-auto p-2">
          <Command.Empty className="p-4 text-center text-label text-faint">
            {t("recent.empty")}
          </Command.Empty>
          {paths.map((path) => {
            const Icon = fileIcon(path);
            return (
              <Command.Item
                key={path}
                value={path}
                className={itemCls}
                onSelect={() => {
                  close();
                  void openFile(path);
                }}
              >
                <Icon size={16} strokeWidth={1.5} className="shrink-0 text-faint" />
                <span className="text-fg">{nameOf(path)}</span>
                <span className="truncate font-mono text-meta text-faint">{path}</span>
              </Command.Item>
            );
          })}
        </Command.List>
      </Command>
    </div>
  );
}
