import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { type MessageKey, useT } from "@/i18n";
import { useStore } from "@/lib/store";
import { caretRect, replaceRange, type TextField, textFieldOf } from "@/lib/textEdit";
import { scopeOf, type VarItem, variablesForScope } from "@/lib/variables";
import { cn } from "./ui";

const TRIGGER = /\{\{\s*([\w.<>-]*)$/;
const MAX = 50;

interface State {
  el: TextField;
  start: number;
  query: string;
  items: VarItem[];
  index: number;
  x: number;
  y: number;
}

function rank(items: VarItem[], query: string): VarItem[] {
  const q = query.toLowerCase();
  if (!q) return items.slice(0, MAX);
  const starts: VarItem[] = [];
  const contains: VarItem[] = [];
  for (const item of items) {
    const p = item.path.toLowerCase();
    if (p.startsWith(q) || p.split(".").some((part) => part.startsWith(q))) starts.push(item);
    else if (p.includes(q)) contains.push(item);
  }
  return [...starts, ...contains].slice(0, MAX);
}

function compute(el: TextField): Omit<State, "index"> | null {
  const scope = scopeOf(el);
  if (!scope || el.selectionStart !== el.selectionEnd) return null;
  const caret = el.selectionStart ?? 0;
  const before = el.value.slice(0, caret);
  const match = before.match(TRIGGER);
  if (!match) return null;
  const query = match[1] ?? "";
  const items = rank(
    variablesForScope(scope, (path) => useStore.getState().docs[path]?.flow),
    query,
  );
  if (!items.length) return null;
  const pos = caretRect(el, caret - query.length);
  return { el, start: caret - match[0].length, query, items, x: pos.x, y: pos.y + pos.height + 4 };
}

export function VarAutocomplete() {
  const { t } = useT();
  const [state, setState] = useState<State | null>(null);
  const stateRef = useRef(state);
  stateRef.current = state;
  const list = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const refresh = (el: TextField) => {
      const next = compute(el);
      setState((prev) =>
        next
          ? {
              ...next,
              index:
                prev && prev.el === el && prev.start === next.start
                  ? Math.min(prev.index, next.items.length - 1)
                  : 0,
            }
          : null,
      );
    };

    const accept = (s: State, item: VarItem) => {
      const caret = s.el.selectionStart ?? s.start;
      const closing = s.el.value.slice(caret).match(/^\s*\}\}/)?.[0].length ?? 0;
      replaceRange(s.el, { start: s.start, end: caret + closing }, `{{${item.path}}}`);
      setState(null);
    };

    const onInput = (e: Event) => {
      const el = textFieldOf(e.target);
      if (el) refresh(el);
    };

    const onKey = (e: KeyboardEvent) => {
      const s = stateRef.current;
      if (!s || e.target !== s.el) return;
      if (e.key === "ArrowDown" || e.key === "ArrowUp") {
        const delta = e.key === "ArrowDown" ? 1 : -1;
        setState({ ...s, index: (s.index + delta + s.items.length) % s.items.length });
      } else if (e.key === "Enter" || e.key === "Tab") {
        const item = s.items[s.index];
        if (item) accept(s, item);
      } else if (e.key === "Escape") {
        setState(null);
      } else {
        return;
      }
      e.preventDefault();
      e.stopPropagation();
    };

    const onSelection = () => {
      const s = stateRef.current;
      if (!s) return;
      if (document.activeElement !== s.el) setState(null);
      else refresh(s.el);
    };

    const onBlur = (e: FocusEvent) => {
      if (stateRef.current && e.target === stateRef.current.el) setState(null);
    };

    const onPick = (e: Event) => {
      const s = stateRef.current;
      const detail = (e as CustomEvent<number>).detail;
      const item = s?.items[detail];
      if (s && item) accept(s, item);
    };

    window.addEventListener("input", onInput, true);
    window.addEventListener("keydown", onKey, true);
    document.addEventListener("selectionchange", onSelection);
    window.addEventListener("blur", onBlur, true);
    window.addEventListener("mk-var-pick", onPick);
    return () => {
      window.removeEventListener("input", onInput, true);
      window.removeEventListener("keydown", onKey, true);
      document.removeEventListener("selectionchange", onSelection);
      window.removeEventListener("blur", onBlur, true);
      window.removeEventListener("mk-var-pick", onPick);
    };
  }, []);

  useEffect(() => {
    if (!state) return;
    list.current?.children[state.index]?.scrollIntoView({ block: "nearest" });
  }, [state]);

  if (!state) return null;
  const width = 280;
  const left = Math.min(state.x, window.innerWidth - width - 8);
  const below = state.y + 240 < window.innerHeight;
  return createPortal(
    <div
      ref={list}
      role="listbox"
      aria-label={t("textMenu.insertVariable")}
      className="fixed z-[2000] max-h-60 overflow-y-auto rounded-lg border border-line bg-panel p-1 shadow-2xl shadow-black/60"
      style={{
        left,
        width,
        ...(below ? { top: state.y } : { bottom: window.innerHeight - state.y + 24 }),
      }}
      onMouseDown={(e) => e.preventDefault()}
    >
      {state.items.map((item, i) => (
        <div
          key={item.path}
          role="option"
          tabIndex={-1}
          aria-selected={i === state.index}
          onMouseEnter={() => setState({ ...state, index: i })}
          onClick={() => window.dispatchEvent(new CustomEvent("mk-var-pick", { detail: i }))}
          onKeyDown={() => {}}
          className={cn(
            "flex h-7 cursor-default items-center justify-between gap-3 rounded-md px-2 font-mono text-label",
            i === state.index ? "bg-hover text-fg" : "text-muted",
          )}
        >
          <span className="truncate">{item.path}</span>
          <span className="shrink-0 font-sans text-meta text-faint">
            {t(`textMenu.groups.${item.group}` as MessageKey)}
          </span>
        </div>
      ))}
    </div>,
    document.body,
  );
}
