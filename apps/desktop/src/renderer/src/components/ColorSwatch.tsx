import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { cn, useModalFlag } from "./ui";

const PALETTE = [
  "#5865f2",
  "#57f287",
  "#fee75c",
  "#eb459e",
  "#ed4245",
  "#ffffff",
  "#23272a",
  "#1abc9c",
  "#2ecc71",
  "#3498db",
  "#9b59b6",
  "#e91e63",
  "#f1c40f",
  "#e67e22",
  "#e74c3c",
  "#95a5a6",
  "#11806a",
  "#1f8b4c",
  "#206694",
  "#71368a",
  "#ad1457",
  "#c27c0e",
  "#a84300",
  "#992d22",
  "#607d8b",
  "#546e7a",
  "#2c2f33",
  "#99aab5",
];

function Palette({
  anchor,
  value,
  label,
  onPick,
  onClose,
}: {
  anchor: HTMLElement;
  value: string | undefined;
  label: string;
  onPick: (c: string) => void;
  onClose: () => void;
}) {
  useModalFlag();
  const box = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<{ left: number; top: number } | null>(null);

  useLayoutEffect(() => {
    const r = anchor.getBoundingClientRect();
    const el = box.current;
    const w = el?.offsetWidth ?? 220;
    const h = el?.offsetHeight ?? 160;
    const below = r.bottom + 4 + h <= window.innerHeight - 8;
    setPos({
      left: Math.max(8, Math.min(r.left, window.innerWidth - w - 8)),
      top: below ? r.bottom + 4 : r.top - 4 - h,
    });
  }, [anchor]);

  useEffect(() => {
    box.current?.querySelector<HTMLButtonElement>("[aria-pressed=true], button")?.focus();
    const onDown = (e: MouseEvent) => {
      const t = e.target as Node;
      if (!box.current?.contains(t) && !anchor.contains(t)) onClose();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        e.stopPropagation();
        onClose();
        anchor.focus();
      }
    };
    window.addEventListener("mousedown", onDown, true);
    window.addEventListener("keydown", onKey, true);
    window.addEventListener("blur", onClose);
    return () => {
      window.removeEventListener("mousedown", onDown, true);
      window.removeEventListener("keydown", onKey, true);
      window.removeEventListener("blur", onClose);
    };
  }, [anchor, onClose]);

  return createPortal(
    <div
      ref={box}
      role="dialog"
      aria-label={label}
      className="fixed z-[1100] grid grid-cols-7 gap-1.5 rounded-lg border border-line bg-panel p-2 shadow-2xl shadow-black/60"
      style={{
        left: pos?.left ?? -9999,
        top: pos?.top ?? -9999,
        visibility: pos ? "visible" : "hidden",
      }}
    >
      {PALETTE.map((c) => (
        <button
          key={c}
          type="button"
          title={c}
          aria-label={c}
          aria-pressed={value === c}
          onClick={() => onPick(c)}
          className={cn(
            "size-6 rounded-md border border-black/30 transition-transform duration-100 ease-out hover:scale-110 focus-visible:scale-110",
            value === c && "ring-2 ring-fg ring-offset-2 ring-offset-panel",
          )}
          style={{ background: c }}
        />
      ))}
    </div>,
    document.body,
  );
}

export function ColorSwatch({
  value,
  label,
  onChange,
}: {
  value: string | undefined;
  label: string;
  onChange: (c: string) => void;
}) {
  const button = useRef<HTMLButtonElement>(null);
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        ref={button}
        type="button"
        title={label}
        aria-label={label}
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        className="flex h-7 w-9 shrink-0 items-center justify-center rounded-md border border-line bg-chrome transition-colors duration-150 hover:border-line-strong"
      >
        <span
          className={cn("size-4 rounded-sm", !value && "border border-dashed border-line-strong")}
          style={value ? { background: value } : undefined}
        />
      </button>
      {open && button.current && (
        <Palette
          anchor={button.current}
          value={value}
          label={label}
          onPick={(c) => {
            setOpen(false);
            onChange(c);
            button.current?.focus();
          }}
          onClose={() => setOpen(false)}
        />
      )}
    </>
  );
}
