import { type Flow, isInteractionFlow } from "@makecord/spec";
import { StickyNote } from "lucide-react";
import { useState } from "react";
import { Input } from "@/components/ui";
import { useT } from "@/i18n";
import { type NodeDescriptor, nodeText, useNodes } from "@/lib/nodes";

export const DRAG_MIME = "application/x-makecord-node";

export function Palette({
  flow,
  onAdd,
  onAddNote,
}: {
  flow: Flow;
  onAdd: (meta: NodeDescriptor) => void;
  onAddNote: () => void;
}) {
  const { t, locale } = useT();
  const [q, setQ] = useState("");
  const nodeMetas = useNodes();
  const query = q.toLocaleLowerCase(locale);
  const interactive = isInteractionFlow(flow);
  const available = nodeMetas.filter((m) => {
    if (m.category === "trigger" || (m.contexts && !m.contexts.includes(flow.kind))) return false;
    if (m.needsInteraction && !interactive) return false;
    if (m.events && !(flow.kind === "event" && m.events.includes(flow.event))) return false;
    const text = nodeText(m, locale);
    return (
      !q || `${text.title} ${text.description ?? ""}`.toLocaleLowerCase(locale).includes(query)
    );
  });
  const KNOWN = ["interaction", "messages", "members", "server"] as const;
  const groupTitle = (m: NodeDescriptor) => {
    if (m.group && (KNOWN as readonly string[]).includes(m.group))
      return t(`palette.groups.${m.group as (typeof KNOWN)[number]}`);
    return m.locales?.[locale]?.group ?? m.group;
  };
  const sections: { key: string; title: string; list: NodeDescriptor[] }[] = [];
  const actions = available.filter((m) => m.category === "action");
  for (const g of KNOWN) {
    const list = actions.filter((m) => m.group === g);
    if (list.length) sections.push({ key: g, title: t(`palette.groups.${g}`), list });
  }
  const other = new Map<string, NodeDescriptor[]>();
  for (const m of actions.filter((a) => !(KNOWN as readonly string[]).includes(a.group ?? ""))) {
    const title = groupTitle(m) ?? t("palette.action");
    other.set(title, [...(other.get(title) ?? []), m]);
  }
  for (const [title, list] of other) sections.push({ key: `action:${title}`, title, list });
  for (const c of ["logic", "data"] as const) {
    const list = available.filter((m) => m.category === c);
    if (list.length) sections.push({ key: c, title: t(`palette.${c}`), list });
  }

  return (
    <aside className="flex w-52 shrink-0 flex-col border-r border-line bg-chrome">
      <div className="p-2">
        <Input placeholder={t("palette.search")} value={q} onChange={(e) => setQ(e.target.value)} />
      </div>
      <div className="flex flex-1 flex-col gap-4 overflow-y-auto px-2 pt-2 pb-4">
        {sections.map(({ key, title, list }) => (
          <section key={key} className="flex flex-col gap-0.5">
            <h3 className="mb-1 px-2 text-meta text-faint">{title}</h3>
            {list.map((m) => {
              const text = nodeText(m, locale);
              return (
                <button
                  key={m.type}
                  type="button"
                  draggable
                  onDragStart={(e) => {
                    e.dataTransfer.setData(DRAG_MIME, m.type);
                    e.dataTransfer.effectAllowed = "move";
                  }}
                  onClick={() => onAdd(m)}
                  title={text.description}
                  className="flex h-7 cursor-grab items-center gap-2 rounded-md px-2 text-left text-body text-muted transition-colors duration-150 ease-out hover:bg-hover hover:text-fg active:cursor-grabbing"
                >
                  <span
                    className="size-2 shrink-0 rounded-full"
                    style={{ background: `var(--color-cat-${m.category})` }}
                  />
                  {text.title}
                </button>
              );
            })}
          </section>
        ))}
        {!q && (
          <section className="flex flex-col gap-0.5">
            <h3 className="mb-1 px-2 text-meta text-faint">{t("palette.canvas")}</h3>
            <button
              type="button"
              onClick={onAddNote}
              className="flex h-7 items-center gap-2 rounded-md px-2 text-left text-body text-muted transition-colors duration-150 ease-out hover:bg-hover hover:text-fg"
            >
              <StickyNote size={14} strokeWidth={1.5} className="shrink-0 text-faint" />
              {t("flow.addNote")}
            </button>
          </section>
        )}
      </div>
    </aside>
  );
}
