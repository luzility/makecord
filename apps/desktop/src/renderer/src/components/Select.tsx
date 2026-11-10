import { Check, ChevronDown } from "lucide-react";
import {
  type KeyboardEvent,
  type ReactNode,
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import { createPortal } from "react-dom";
import { cn, useModalFlag } from "./ui";

export interface SelectOption<T extends string> {
  value: T;
  label: ReactNode;
  text?: string;
  divider?: boolean;
}

interface Props<T extends string> {
  value: T;
  options: readonly SelectOption<T>[];
  onChange: (value: T) => void;
  className?: string;
  disabled?: boolean;
  placeholder?: string;
  "aria-label"?: string;
}

const textOf = (o: SelectOption<string>) =>
  o.text ?? (typeof o.label === "string" ? o.label : String(o.value));

function Popup<T extends string>({
  anchor,
  options,
  value,
  id,
  onPick,
  onClose,
}: {
  anchor: HTMLElement;
  options: readonly SelectOption<T>[];
  value: T;
  id: string;
  onPick: (v: T) => void;
  onClose: (refocus: boolean) => void;
}) {
  useModalFlag();
  const list = useRef<HTMLDivElement>(null);
  const [active, setActive] = useState(() =>
    Math.max(
      0,
      options.findIndex((o) => o.value === value),
    ),
  );
  const [pos, setPos] = useState<{
    left: number;
    top: number;
    width: number;
    maxHeight: number;
  } | null>(null);
  const typed = useRef({ text: "", at: 0 });

  useLayoutEffect(() => {
    const r = anchor.getBoundingClientRect();
    const h = list.current?.scrollHeight ?? 0;
    const below = window.innerHeight - r.bottom - 8;
    const above = r.top - 8;
    const openUp = below < Math.min(h, 240) && above > below;
    const maxHeight = Math.min(320, openUp ? above : below);
    const height = Math.min(h, maxHeight);
    setPos({
      left: Math.min(r.left, window.innerWidth - Math.max(r.width, 160) - 8),
      top: openUp ? r.top - 4 - height : r.bottom + 4,
      width: r.width,
      maxHeight,
    });
  }, [anchor]);

  const placed = pos !== null;
  useEffect(() => {
    if (placed) list.current?.focus();
  }, [placed]);

  useEffect(() => {
    list.current?.querySelector(`[data-index="${active}"]`)?.scrollIntoView({ block: "nearest" });
  }, [active]);

  useEffect(() => {
    const onDown = (e: MouseEvent) => {
      const target = e.target as Node;
      if (!list.current?.contains(target) && !anchor.contains(target)) onClose(false);
    };
    const onScroll = (e: Event) => {
      if (!list.current?.contains(e.target as Node)) onClose(false);
    };
    const onBlur = () => onClose(false);
    window.addEventListener("mousedown", onDown, true);
    window.addEventListener("scroll", onScroll, true);
    window.addEventListener("resize", onBlur);
    window.addEventListener("blur", onBlur);
    return () => {
      window.removeEventListener("mousedown", onDown, true);
      window.removeEventListener("scroll", onScroll, true);
      window.removeEventListener("resize", onBlur);
      window.removeEventListener("blur", onBlur);
    };
  }, [anchor, onClose]);

  const onKey = (e: KeyboardEvent) => {
    const last = options.length - 1;
    if (e.key === "ArrowDown") setActive((i) => Math.min(last, i + 1));
    else if (e.key === "ArrowUp") setActive((i) => Math.max(0, i - 1));
    else if (e.key === "Home") setActive(0);
    else if (e.key === "End") setActive(last);
    else if (e.key === "PageDown") setActive((i) => Math.min(last, i + 8));
    else if (e.key === "PageUp") setActive((i) => Math.max(0, i - 8));
    else if (e.key === "Enter" || e.key === " ") {
      const o = options[active];
      if (o) onPick(o.value);
    } else if (e.key === "Escape" || e.key === "Tab") onClose(e.key === "Escape");
    else if (e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey) {
      const now = Date.now();
      typed.current.text = now - typed.current.at > 700 ? e.key : typed.current.text + e.key;
      typed.current.at = now;
      const q = typed.current.text.toLocaleLowerCase();
      const found = options.findIndex((o) => textOf(o).toLocaleLowerCase().startsWith(q));
      if (found >= 0) setActive(found);
      else return;
    } else return;
    e.preventDefault();
    e.stopPropagation();
  };

  return createPortal(
    <div
      ref={list}
      id={id}
      role="listbox"
      tabIndex={-1}
      aria-activedescendant={`${id}-${active}`}
      onKeyDown={onKey}
      className="fixed z-[1100] overflow-y-auto rounded-lg border border-line bg-panel p-1 shadow-2xl shadow-black/60 outline-none"
      style={{
        left: pos?.left ?? -9999,
        top: pos?.top ?? -9999,
        minWidth: Math.max(pos?.width ?? 0, 160),
        maxWidth: 420,
        maxHeight: pos?.maxHeight ?? 320,
        visibility: pos ? "visible" : "hidden",
      }}
    >
      {options.map((o, i) => (
        <div key={o.value}>
          {o.divider && i > 0 && <hr className="mx-2 my-1 h-px border-0 bg-line" />}
          <div
            id={`${id}-${i}`}
            data-index={i}
            role="option"
            tabIndex={-1}
            aria-selected={o.value === value}
            onMouseEnter={() => setActive(i)}
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => onPick(o.value)}
            onKeyDown={() => {}}
            className={cn(
              "flex h-7 cursor-default items-center gap-2 rounded-md pr-3 pl-2 text-label",
              i === active ? "bg-hover text-fg" : "text-muted",
            )}
          >
            <Check
              size={14}
              strokeWidth={1.75}
              className={cn("shrink-0", o.value === value ? "text-fg" : "invisible")}
            />
            <span className="truncate">{o.label}</span>
          </div>
        </div>
      ))}
    </div>,
    document.body,
  );
}

export function Select<T extends string>({
  value,
  options,
  onChange,
  className = "w-full",
  disabled,
  placeholder,
  "aria-label": ariaLabel,
}: Props<T>) {
  const button = useRef<HTMLButtonElement>(null);
  const [open, setOpen] = useState(false);
  const id = useId();
  const current = options.find((o) => o.value === value);

  const close = useCallback((refocus: boolean) => {
    setOpen(false);
    if (refocus) button.current?.focus();
  }, []);

  return (
    <>
      <button
        ref={button}
        type="button"
        disabled={disabled}
        aria-label={ariaLabel}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={open ? id : undefined}
        onClick={() => setOpen((o) => !o)}
        onKeyDown={(e) => {
          if (["ArrowDown", "ArrowUp", "Enter", " "].includes(e.key)) {
            e.preventDefault();
            setOpen(true);
          }
        }}
        className={cn(
          "flex h-7 min-w-0 items-center justify-between gap-2 rounded-md border border-line bg-chrome pr-1.5 pl-2 text-left text-label text-fg transition-colors duration-150 ease-out hover:border-line-strong focus-visible:border-fg/40 focus-visible:outline-none disabled:pointer-events-none disabled:opacity-40",
          open && "border-fg/40",
          className,
        )}
      >
        <span className={cn("truncate", !current && "text-faint")}>
          {current ? current.label : (placeholder ?? "")}
        </span>
        <ChevronDown
          size={14}
          strokeWidth={1.5}
          className={cn(
            "shrink-0 text-faint transition-transform duration-150 ease-out",
            open && "rotate-180",
          )}
        />
      </button>
      {open && button.current && (
        <Popup
          anchor={button.current}
          options={options}
          value={value}
          id={id}
          onPick={(v) => {
            close(true);
            if (v !== value) onChange(v);
          }}
          onClose={close}
        />
      )}
    </>
  );
}
