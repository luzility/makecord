import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

const SHOW_DELAY = 450;
const SWITCH_DELAY = 80;
const GAP = 6;
const MARGIN = 8;
const SKIP = ".monaco-editor, .react-flow__controls";

type Side = "below" | "right" | "left";

interface Tip {
  text: string;
  keys?: string;
  anchor: DOMRect;
  side: Side;
}

function split(text: string): Pick<Tip, "text" | "keys"> {
  const m = text.match(/^(.+?)\s+\(([^()]{1,24})\)$/s);
  if (m && /^[\w+⌘⇧⌥↵\s,.-]+$/.test(m[2]!) && /(\+|F\d|^[A-Z]$|Ctrl|Alt|Shift|Mod)/.test(m[2]!)) {
    return { text: m[1]!, keys: m[2] };
  }
  return { text };
}

function take(el: Element): string | null {
  const own = el.getAttribute("title");
  if (own) {
    el.setAttribute("data-mk-tip", own);
    el.removeAttribute("title");
    return own;
  }
  return el.getAttribute("data-mk-tip");
}

export function TooltipLayer() {
  const [tip, setTip] = useState<Tip | null>(null);
  const [pos, setPos] = useState<{ x: number; y: number } | null>(null);
  const box = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    let current: Element | null = null;
    let visible = false;

    const hide = () => {
      clearTimeout(timer);
      current = null;
      if (visible) {
        visible = false;
        setTip(null);
        setPos(null);
      }
    };

    const onOver = (e: PointerEvent) => {
      if (e.pointerType === "touch") return;
      const target = e.target as Element | null;
      const el = target?.closest?.("[title], [data-mk-tip]") ?? null;
      if (!el || el.closest(SKIP)) {
        if (current) hide();
        return;
      }
      const text = take(el);
      if (el === current) return;
      clearTimeout(timer);
      current = el;
      if (!text) return;
      timer = setTimeout(
        () => {
          if (current !== el || !el.isConnected) return;
          visible = true;
          const side = (el.closest("[data-tip-side]")?.getAttribute("data-tip-side") ??
            "below") as Side;
          setTip({ ...split(text), anchor: el.getBoundingClientRect(), side });
        },
        visible ? SWITCH_DELAY : SHOW_DELAY,
      );
    };

    const onOut = (e: PointerEvent) => {
      const to = e.relatedTarget as Element | null;
      if (current && to && current.contains(to)) return;
      hide();
    };

    window.addEventListener("pointerover", onOver, true);
    window.addEventListener("pointerout", onOut, true);
    window.addEventListener("pointerdown", hide, true);
    window.addEventListener("keydown", hide, true);
    window.addEventListener("wheel", hide, { capture: true, passive: true });
    window.addEventListener("blur", hide);
    return () => {
      clearTimeout(timer);
      window.removeEventListener("pointerover", onOver, true);
      window.removeEventListener("pointerout", onOut, true);
      window.removeEventListener("pointerdown", hide, true);
      window.removeEventListener("keydown", hide, true);
      window.removeEventListener("wheel", hide, true);
      window.removeEventListener("blur", hide);
    };
  }, []);

  useLayoutEffect(() => {
    const el = box.current;
    if (!tip || !el) return;
    const w = el.offsetWidth;
    const h = el.offsetHeight;
    const a = tip.anchor;
    const clampX = (x: number) => Math.min(window.innerWidth - w - MARGIN, Math.max(MARGIN, x));
    const clampY = (y: number) => Math.min(window.innerHeight - h - MARGIN, Math.max(MARGIN, y));
    if (tip.side === "right" || tip.side === "left") {
      const x = tip.side === "right" ? a.right + GAP : a.left - GAP - w;
      setPos({ x: clampX(x), y: clampY(a.top + a.height / 2 - h / 2) });
      return;
    }
    const below = a.bottom + GAP + h <= window.innerHeight - MARGIN;
    const y = below ? a.bottom + GAP : Math.max(MARGIN, a.top - GAP - h);
    setPos({ x: clampX(a.left + a.width / 2 - w / 2), y });
  }, [tip]);

  if (!tip) return null;
  return createPortal(
    <div
      ref={box}
      role="tooltip"
      className="mk-tooltip pointer-events-none fixed z-[2000] flex max-w-[320px] items-center gap-2 rounded-md border border-line-strong bg-raised px-2 py-1 text-label text-fg shadow-lg shadow-black/50"
      style={{
        left: pos?.x ?? -9999,
        top: pos?.y ?? -9999,
        opacity: pos ? 1 : 0,
        transform: pos ? "none" : "translateY(2px)",
      }}
    >
      <span className="whitespace-pre-line break-words">{tip.text}</span>
      {tip.keys && <span className="shrink-0 font-mono text-meta text-faint">{tip.keys}</span>}
    </div>,
    document.body,
  );
}
