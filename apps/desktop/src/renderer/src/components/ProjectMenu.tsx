import { ChevronDown } from "lucide-react";
import { useEffect, useState } from "react";
import { useT } from "@/i18n";
import { closeProject, openProject } from "@/lib/actions";
import { api } from "@/lib/api";
import { keysOf } from "@/lib/shortcuts";
import { useStore } from "@/lib/store";
import { MenuButton, type MenuEntry } from "./Menu";

const nameOf = (root: string) => root.split(/[\\/]/).pop() ?? root;

export function ProjectMenu() {
  const { t } = useT();
  const project = useStore((s) => s.project);
  const set = useStore((s) => s.set);
  const [recent, setRecent] = useState<string[]>([]);

  useEffect(() => {
    void api.project.recent().then(setRecent);
  }, [project]);

  const build = (): MenuEntry[] => {
    const others = recent.filter((r) => r !== project?.root).slice(0, 8);
    return [
      { kind: "label", label: t("menu.recent") },
      ...(others.length
        ? others.map(
            (root): MenuEntry => ({
              kind: "item",
              label: nameOf(root),
              hint: root,
              onSelect: () => void openProject(root),
            }),
          )
        : [
            {
              kind: "item",
              label: t("menu.noRecent"),
              disabled: true,
              onSelect: () => {},
            } as MenuEntry,
          ]),
      { kind: "separator" },
      {
        kind: "item",
        label: t("actions.open"),
        keys: keysOf("Mod+O"),
        onSelect: () => void openProject(),
      },
      {
        kind: "item",
        label: t("actions.newProject"),
        keys: keysOf("Mod+Shift+N"),
        onSelect: () => set({ newProjectOpen: true }),
      },
      { kind: "separator" },
      { kind: "item", label: t("actions.closeProject"), onSelect: () => void closeProject() },
    ];
  };

  return (
    <MenuButton
      label={t("menu.project")}
      items={build}
      className="flex h-7 min-w-0 items-center gap-1 rounded-md px-2 text-body font-medium transition-colors duration-150 ease-out hover:bg-hover"
    >
      <span className="truncate">{project?.name}</span>
      <ChevronDown size={12} strokeWidth={1.5} className="shrink-0 text-faint" />
    </MenuButton>
  );
}
