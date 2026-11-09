import { ChevronRight } from "lucide-react";
import {
  type KeyboardEvent,
  type ReactNode,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import { createPortal } from "react-dom";
import { cn, useModalFlag } from "./ui";

export type MenuEntry =
  | {
      kind: "item";
      label: string;
      keys?: string[];
      disabled?: boolean;
      hint?: string;
      onSelect: () => void;
    }
  | { kind: "submenu"; label: string; items: MenuEntry[] }
  | { kind: "separator" }
  | { kind: "label"; label: string };

const focusable = (e: MenuEntry) => (e.kind === "item" && !e.disabled) || e.kind === "submenu";

function Submenu({
  prefer,
  children,
}: {
  prefer: "left" | "right";
  children: (side: "left" | "right") => ReactNode;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [place, setPlace] = useState<{ side: "left" | "right"; shift: number } | null>(null);
  useLayoutEffect(() => {
    const el = ref.current;
    const parent = el?.parentElement?.getBoundingClientRect();
    if (!el || !parent) return;
    const width = el.getBoundingClientRect().width;
    const fitsRight = parent.right + width <= window.innerWidth - 4;
    const fitsLeft = parent.left - width >= 4;
    const side =
      prefer === "left"
        ? fitsLeft || !fitsRight
          ? "left"
          : "right"
        : fitsRight || !fitsLeft
          ? "right"
          : "left";
    const bottom = el.getBoundingClientRect().bottom;
    setPlace({ side, shift: Math.min(0, window.innerHeight - 4 - bottom) });
  }, [prefer]);
  const side = place?.side ?? prefer;
  return (
    <div
      ref={ref}
      className={cn("absolute z-10", side === "left" ? "right-full pr-1" : "left-full pl-1")}
      style={{ top: -5 + (place?.shift ?? 0), visibility: place ? "visible" : "hidden" }}
    >
      {children(side)}
    </div>
  );
}

function MenuList({
  items,
  onClose,
  onBack,
  className,
  autoFocus = true,
  side = "right",
}: {
  items: MenuEntry[];
  onClose: () => void;
  onBack?: () => void;
  className?: string;
  autoFocus?: boolean;
  side?: "left" | "right";
}) {
  const refs = useRef<(HTMLButtonElement | null)[]>([]);
  const [openSub, setOpenSub] = useState<number | null>(null);

  useEffect(() => {
    if (!autoFocus) return;
    refs.current[items.findIndex(focusable)]?.focus();
  }, [items, autoFocus]);

  const move = (from: number, dir: 1 | -1) => {
    for (let i = 1; i <= items.length; i++) {
      const idx = (from + dir * i + items.length) % items.length;
      const entry = items[idx];
      if (entry && focusable(entry)) {
        refs.current[idx]?.focus();
        setOpenSub(null);
        return;
      }
    }
  };

  const onKey = (e: KeyboardEvent, i: number) => {
    const entry = items[i];
    if (e.key === "ArrowDown") move(i, 1);
    else if (e.key === "ArrowUp") move(i, -1);
    else if (e.key === "ArrowRight" && entry?.kind === "submenu") setOpenSub(i);
    else if (e.key === "ArrowLeft" && onBack) onBack();
    else if (e.key === "Escape") (onBack ?? onClose)();
    else return;
    e.preventDefault();
    e.stopPropagation();
  };

  return (
    <div
      role="menu"
      className={cn(
        "max-w-[440px] min-w-60 rounded-lg border border-line bg-panel p-1 shadow-2xl shadow-black/60",
        className,
      )}
    >
      {items.map((entry, i) => {
        if (entry.kind === "separator") {
          return <hr key={`sep-${i}`} className="mx-2 my-1 h-px border-0 bg-line" />;
        }
        if (entry.kind === "label") {
          return (
            <div key={`label-${entry.label}`} className="px-2 pt-2 pb-1 text-meta text-faint">
              {entry.label}
            </div>
          );
        }
        const base =
          "flex min-h-7 w-full items-center gap-3 rounded-md px-2 text-left text-body text-muted outline-none transition-colors duration-150 ease-out hover:bg-hover hover:text-fg focus-visible:bg-hover focus-visible:text-fg focus-visible:outline-none disabled:pointer-events-none disabled:text-faint/60";
        if (entry.kind === "submenu") {
          return (
            <div
              key={entry.label}
              className="relative"
              onMouseEnter={() => setOpenSub(i)}
              onMouseLeave={() => setOpenSub(null)}
            >
              <button
                ref={(el) => {
                  refs.current[i] = el;
                }}
                type="button"
                role="menuitem"
                aria-haspopup="menu"
                aria-expanded={openSub === i}
                className={cn(base, openSub === i && "bg-hover text-fg")}
                onClick={() => setOpenSub(openSub === i ? null : i)}
                onKeyDown={(e) => onKey(e, i)}
              >
                <span className="flex-1">{entry.label}</span>
                <ChevronRight size={12} strokeWidth={1.5} className="text-faint" />
              </button>
              {openSub === i && (
                <Submenu prefer={side}>
                  {(resolved) => (
                    <MenuList
                      side={resolved}
                      items={entry.items}
                      onClose={onClose}
                      className={
                        entry.items.some((x) => x.kind === "submenu")
                          ? undefined
                          : "max-h-[70vh] overflow-x-hidden overflow-y-auto"
                      }
                      onBack={() => {
                        setOpenSub(null);
                        refs.current[i]?.focus();
                      }}
                    />
                  )}
                </Submenu>
              )}
            </div>
          );
        }
        return (
          <button
            key={entry.label}
            ref={(el) => {
              refs.current[i] = el;
            }}
            type="button"
            role="menuitem"
            disabled={entry.disabled}
            className={cn(base, entry.hint && "py-1")}
            onMouseEnter={() => setOpenSub(null)}
            onClick={() => {
              onClose();
              entry.onSelect();
            }}
            onKeyDown={(e) => onKey(e, i)}
          >
            <span className="flex min-w-0 flex-1 flex-col">
              <span className="truncate">{entry.label}</span>
              {entry.hint && (
                <span className="truncate font-mono text-meta text-faint">{entry.hint}</span>
              )}
            </span>
            {entry.keys && (
              <span className="flex shrink-0 gap-1 font-mono text-meta text-faint">
                {entry.keys.join(entry.keys.some((k) => k.length > 1) ? "+" : "")}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}

export function MenuButton({
  label,
  items,
  children,
  className,
  align = "start",
}: {
  label: string;
  items: () => MenuEntry[];
  children: ReactNode;
  className?: string;
  align?: "start" | "end";
}) {
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const button = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (!root.current?.contains(e.target as Node)) setOpen(false);
    };
    window.addEventListener("mousedown", onDown);
    return () => window.removeEventListener("mousedown", onDown);
  }, [open]);

  const close = () => {
    setOpen(false);
    button.current?.focus();
  };

  return (
    <div ref={root} className="relative">
      <button
        ref={button}
        type="button"
        aria-label={label}
        title={label}
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        onKeyDown={(e) => {
          if (e.key === "ArrowDown" && !open) {
            e.preventDefault();
            setOpen(true);
          }
        }}
        className={cn(open && "bg-hover text-fg", className)}
      >
        {children}
      </button>
      {open && <OpenMenu items={items()} onClose={close} align={align} />}
    </div>
  );
}

function OpenMenu({
  items,
  onClose,
  align,
}: {
  items: MenuEntry[];
  onClose: () => void;
  align: "start" | "end";
}) {
  useModalFlag();
  return (
    <div className={cn("absolute top-full z-[1000] pt-1", align === "end" ? "right-0" : "left-0")}>
      <MenuList items={items} onClose={onClose} />
    </div>
  );
}

export function ContextMenu({
  x,
  y,
  items,
  onClose,
}: {
  x: number;
  y: number;
  items: MenuEntry[];
  onClose: () => void;
}) {
  useModalFlag();
  const ref = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState({ x, y });

  useLayoutEffect(() => {
    const r = ref.current?.getBoundingClientRect();
    if (!r) return;
    setPos({
      x: Math.max(4, Math.min(x, window.innerWidth - r.width - 4)),
      y: Math.max(4, Math.min(y, window.innerHeight - r.height - 4)),
    });
  }, [x, y]);

  useEffect(() => {
    const onDown = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) onClose();
    };
    window.addEventListener("mousedown", onDown);
    window.addEventListener("blur", onClose);
    window.addEventListener("resize", onClose);
    return () => {
      window.removeEventListener("mousedown", onDown);
      window.removeEventListener("blur", onClose);
      window.removeEventListener("resize", onClose);
    };
  }, [onClose]);

  return createPortal(
    <div
      ref={ref}
      className="fixed z-[1000]"
      style={{ left: pos.x, top: pos.y }}
      onContextMenu={(e) => e.preventDefault()}
    >
      <MenuList items={items} onClose={onClose} />
    </div>,
    document.body,
  );
}
