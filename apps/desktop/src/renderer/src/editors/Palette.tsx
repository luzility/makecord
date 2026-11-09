import { type Flow, isInteractionFlow } from "@makecord/spec";
import { useState } from "react";
import { Input } from "@/components/ui";
import { useT } from "@/i18n";
import { type NodeDescriptor, nodeText, useNodes } from "@/lib/nodes";

export const DRAG_MIME = "application/x-makecord-node";

export function Palette({ flow, onAdd }: { flow: Flow; onAdd: (meta: NodeDescriptor) => void }) {
  const { t, locale } = useT();
  const [q, setQ] = useState("");
  const nodeMetas = useNodes();
  const query = q.toLocaleLowerCase(locale);
  const interactive = isInteractionFlow(flow);
  const available = nodeMetas.filter((m) => {
    if (m.category === "trigger" || (m.contexts && !m.contexts.includes(flow.kind))) return false;
    if (m.needsInteraction && !interactive) return false;
    const text = nodeText(m, locale);
    return (
      !q || `${text.title} ${text.description ?? ""}`.toLocaleLowerCase(locale).includes(query)
    );
  });
  const groups = (["action", "logic", "data"] as const)
    .map((c) => [c, available.filter((m) => m.category === c)] as const)
    .filter(([, list]) => list.length);

  return (
    <aside className="flex w-52 shrink-0 flex-col border-r border-line bg-chrome">
      <div className="p-2">
        <Input placeholder={t("palette.search")} value={q} onChange={(e) => setQ(e.target.value)} />
      </div>
      <div className="flex flex-1 flex-col gap-4 overflow-y-auto px-2 pt-2 pb-4">
        {groups.map(([cat, list]) => (
          <section key={cat} className="flex flex-col gap-0.5">
            <h3 className="mb-1 px-2 text-meta text-faint">{t(`palette.${cat}`)}</h3>
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
      </div>
    </aside>
  );
}
