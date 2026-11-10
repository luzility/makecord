import { Command } from "cmdk";
import { Circle, FileCode2, MessageSquare, SquareFunction, Workflow, Zap } from "lucide-react";
import { useMemo } from "react";
import { useT } from "@/i18n";
import { actions, isAvailable, runAction } from "@/lib/actions";
import type { FileNode } from "@/lib/api";
import { openFile } from "@/lib/dock";
import { keysOf } from "@/lib/shortcuts";
import { useStore } from "@/lib/store";
import { Kbd, useModalFlag } from "./ui";

function flatten(node: FileNode | null, out: FileNode[] = []): FileNode[] {
  if (!node) return out;
  for (const c of node.children ?? []) {
    if (c.kind === "file") out.push(c);
    else flatten(c, out);
  }
  return out;
}

const itemCls =
  "flex h-8 cursor-pointer items-center gap-2 rounded-md px-2 text-body text-muted data-[selected=true]:bg-hover data-[selected=true]:text-fg";
const groupCls =
  "text-meta text-faint [&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:pt-2 [&_[cmdk-group-heading]]:pb-1";
const icon = { size: 16, strokeWidth: 1.5, className: "shrink-0 text-faint" };

export function SearchEverywhere() {
  const { t } = useT();
  const tree = useStore((s) => s.tree);
  const set = useStore((s) => s.set);
  useModalFlag();
  const files = useMemo(() => flatten(tree), [tree]);
  const close = () => set({ searchOpen: false });
  const run = (fn: () => void) => () => {
    close();
    fn();
  };

  return (
    <div
      className="fixed inset-0 z-[1000] flex items-start justify-center bg-black/50 pt-[14vh]"
      onMouseDown={close}
    >
      <Command
        label={t("toolbar.search")}
        className="w-[560px] max-w-[calc(100vw-32px)] overflow-hidden rounded-xl border border-line bg-panel shadow-2xl shadow-black/60"
        onMouseDown={(e) => e.stopPropagation()}
        onKeyDown={(e) => e.key === "Escape" && close()}
      >
        <Command.Input
          autoFocus
          placeholder={t("search.placeholder")}
          className="h-12 w-full border-b border-line bg-transparent px-4 text-title outline-none placeholder:text-faint focus-visible:outline-none"
        />
        <Command.List className="max-h-[50vh] overflow-y-auto p-2">
          <Command.Empty className="p-4 text-center text-label text-faint">
            {t("search.noResults")}
          </Command.Empty>
          <Command.Group heading={t("search.actions")} className={groupCls}>
            {actions
              .filter((a) => a.id !== "view.search" && isAvailable(a))
              .map((a) => {
                const Icon = a.icon ?? Circle;
                return (
                  <Command.Item
                    key={a.id}
                    value={`${a.id} ${t(a.label)}`}
                    className={itemCls}
                    onSelect={run(() => runAction(a.id))}
                  >
                    <Icon {...icon} />
                    <span className="flex-1">
                      {a.id.startsWith("view.language.")
                        ? t("search.language", { lang: t(a.label) })
                        : t(a.label)}
                    </span>
                    {a.shortcuts?.[0] && (
                      <span className="flex gap-1">
                        {keysOf(a.shortcuts[0]).map((k) => (
                          <Kbd key={k}>{k}</Kbd>
                        ))}
                      </span>
                    )}
                  </Command.Item>
                );
              })}
          </Command.Group>
          <Command.Group heading={t("search.files")} className={groupCls}>
            {files.map((f) => {
              const Icon = f.path.startsWith("events/")
                ? Zap
                : f.path.startsWith("functions/") && f.name.endsWith(".flow.json")
                  ? SquareFunction
                  : f.name.endsWith(".flow.json")
                    ? Workflow
                    : f.name.endsWith(".message.json")
                      ? MessageSquare
                      : FileCode2;
              return (
                <Command.Item
                  key={f.path}
                  value={f.path}
                  className={itemCls}
                  onSelect={run(() => void openFile(f.path))}
                >
                  <Icon {...icon} />
                  <span className="text-fg">{f.name.replace(/\.flow\.json$/, "")}</span>
                  <span className="truncate font-mono text-meta text-faint">{f.path}</span>
                </Command.Item>
              );
            })}
          </Command.Group>
        </Command.List>
      </Command>
    </div>
  );
}
