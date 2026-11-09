import { Menu as MenuIcon } from "lucide-react";
import { useT } from "@/i18n";
import { type Action, actionById, isAvailable, MENU } from "@/lib/actions";
import { keysOf } from "@/lib/shortcuts";
import { MenuButton, type MenuEntry } from "./Menu";

export function MainMenu() {
  const { t } = useT();

  const label = (a: Action) => {
    const vars = Object.fromEntries(
      Object.entries(a.labelVars ?? {}).map(([k, v]) => [k, t(v as Parameters<typeof t>[0])]),
    );
    return t(a.label, vars);
  };

  const build = (): MenuEntry[] =>
    MENU.map((group) => ({
      kind: "submenu",
      label: t(group.label),
      items: group.items.map((id): MenuEntry => {
        if (id === "-") return { kind: "separator" };
        const a = actionById.get(id);
        if (!a) return { kind: "separator" };
        return {
          kind: "item",
          label: label(a),
          keys: a.shortcuts?.[0] ? keysOf(a.shortcuts[0]) : undefined,
          disabled: !isAvailable(a),
          onSelect: () => void a.run(),
        };
      }),
    }));

  return (
    <MenuButton
      label={t("menu.main")}
      items={build}
      className="inline-flex size-7 items-center justify-center rounded-md text-faint transition-colors duration-150 ease-out hover:bg-hover hover:text-fg"
    >
      <MenuIcon size={16} strokeWidth={1.5} />
    </MenuButton>
  );
}
