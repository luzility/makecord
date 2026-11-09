import { Minus } from "lucide-react";
import { type ComponentType, type PointerEvent, useRef, useState } from "react";
import { useT } from "@/i18n";
import { keysOf } from "@/lib/shortcuts";
import { useStore } from "@/lib/store";
import { type Area, type ToolId, toolInfo, toolsIn } from "@/lib/tools";
import { DebugPanel } from "@/panels/DebugPanel";
import { EventsPanel } from "@/panels/EventsPanel";
import { ProblemsPanel } from "@/panels/ProblemsPanel";
import { ProjectPanel } from "@/panels/ProjectPanel";
import { PropertiesPanel } from "@/panels/PropertiesPanel";
import { RunPanel } from "@/panels/RunPanel";
import { cn, IconButton } from "./ui";

const VIEWS: Record<ToolId, ComponentType> = {
  project: ProjectPanel,
  properties: PropertiesPanel,
  run: RunPanel,
  problems: ProblemsPanel,
  debug: DebugPanel,
  events: EventsPanel,
};

function StripeButton({ id }: { id: ToolId }) {
  const { t } = useT();
  const info = toolInfo(id);
  const area = useStore((s) => s.tools[info.area]);
  const toggle = useStore((s) => s.toggleTool);
  const problems = useStore((s) => (id === "problems" ? s.problems.length : 0));
  const paused = useStore((s) => (id === "debug" ? s.paused.length : 0));
  const on = area.open && area.active === id;
  const Icon = info.icon;
  return (
    <button
      type="button"
      title={`${t(info.title)} (${keysOf(info.shortcut).join("+")})`}
      aria-label={t(info.title)}
      aria-pressed={on}
      onClick={() => toggle(id)}
      className={cn(
        "relative flex size-7 items-center justify-center rounded-md transition-colors duration-150 ease-out",
        on ? "bg-hover text-fg" : "text-faint hover:bg-hover/60 hover:text-fg",
      )}
    >
      <Icon size={16} strokeWidth={1.5} />
      {(problems > 0 || paused > 0) && (
        <span
          className={cn(
            "absolute top-1 right-1 size-1.5 rounded-full",
            paused ? "bg-bad" : "bg-warn",
          )}
        />
      )}
    </button>
  );
}

export function Stripe({ side }: { side: "left" | "right" }) {
  const top = toolsIn(side);
  const bottom = side === "left" ? toolsIn("bottom") : [];
  return (
    <nav
      data-tip-side={side === "left" ? "right" : "left"}
      className={cn(
        "flex w-10 shrink-0 flex-col items-center justify-between bg-chrome py-1.5",
        side === "left" ? "border-r border-line" : "border-l border-line",
      )}
    >
      <div className="flex flex-col gap-1">
        {top.map((x) => (
          <StripeButton key={x.id} id={x.id} />
        ))}
      </div>
      <div className="flex flex-col gap-1">
        {bottom.map((x) => (
          <StripeButton key={x.id} id={x.id} />
        ))}
      </div>
    </nav>
  );
}

export function Sash({ area }: { area: Area }) {
  const resize = useStore((s) => s.resizeArea);
  const start = useRef<{ pos: number; size: number } | null>(null);
  const [dragging, setDragging] = useState(false);
  const vertical = area === "bottom";
  const onDown = (e: PointerEvent<HTMLDivElement>) => {
    if (e.button !== 0) return;
    e.preventDefault();
    e.currentTarget.setPointerCapture(e.pointerId);
    start.current = {
      pos: vertical ? e.clientY : e.clientX,
      size: useStore.getState().tools[area].size,
    };
    setDragging(true);
  };
  const onMove = (e: PointerEvent<HTMLDivElement>) => {
    const s = start.current;
    if (!s) return;
    const delta = (vertical ? e.clientY : e.clientX) - s.pos;
    resize(area, area === "left" ? s.size + delta : s.size - delta);
  };
  const onUp = (e: PointerEvent<HTMLDivElement>) => {
    start.current = null;
    setDragging(false);
    if (e.currentTarget.hasPointerCapture(e.pointerId))
      e.currentTarget.releasePointerCapture(e.pointerId);
  };
  return (
    <div
      aria-hidden="true"
      onPointerDown={onDown}
      onPointerMove={onMove}
      onPointerUp={onUp}
      onPointerCancel={onUp}
      onDoubleClick={() => resize(area, area === "bottom" ? 240 : area === "left" ? 240 : 300)}
      className={cn(
        "mk-sash relative z-10 shrink-0 bg-line transition-colors duration-150",
        vertical ? "h-px w-full cursor-row-resize" : "h-full w-px cursor-col-resize",
        dragging && "bg-line-strong",
      )}
    >
      <span
        className={cn("absolute", vertical ? "inset-x-0 -inset-y-1" : "inset-y-0 -inset-x-1")}
      />
    </div>
  );
}

export function ToolArea({ area }: { area: Area }) {
  const { t } = useT();
  const state = useStore((s) => s.tools[area]);
  const show = useStore((s) => s.showTool);
  const hide = useStore((s) => s.hideArea);
  const tools = toolsIn(area);
  const [mounted, setMounted] = useState<ReadonlySet<ToolId>>(() => new Set([state.active]));
  if (!mounted.has(state.active)) setMounted(new Set([...mounted, state.active]));

  return (
    <section
      aria-label={t(tools.find((x) => x.id === state.active)!.title)}
      className="flex min-h-0 min-w-0 shrink-0 flex-col bg-panel"
      style={
        area === "bottom"
          ? { height: state.size, maxHeight: "75%" }
          : { width: state.size, maxWidth: "40vw" }
      }
    >
      <header className="flex h-8 shrink-0 items-center gap-0.5 border-b border-line bg-chrome pr-1 pl-1">
        <div role="tablist" className="flex min-w-0 flex-1 items-center gap-0.5 overflow-hidden">
          {tools.map((x) => (
            <button
              key={x.id}
              type="button"
              role="tab"
              aria-selected={state.active === x.id}
              onClick={() => show(x.id)}
              className={cn(
                "flex h-8 shrink-0 items-center px-2.5 text-label transition-colors duration-150 ease-out",
                state.active === x.id
                  ? "text-fg shadow-[inset_0_-1px_0_var(--color-fg)]"
                  : "text-faint hover:text-fg",
              )}
            >
              {t(x.title)}
            </button>
          ))}
        </div>
        <IconButton label={t("tools.hide")} onClick={() => hide(area)}>
          <Minus size={14} strokeWidth={1.5} />
        </IconButton>
      </header>
      <div className="relative min-h-0 flex-1">
        {tools
          .filter((x) => mounted.has(x.id))
          .map((x) => {
            const View = VIEWS[x.id];
            return (
              <div key={x.id} className={cn("absolute inset-0", state.active !== x.id && "hidden")}>
                <View />
              </div>
            );
          })}
      </div>
    </section>
  );
}
