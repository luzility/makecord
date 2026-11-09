import { api } from "./api";

export type Shortcut = string;

const isMac = api.platform === "darwin";

interface Parsed {
  mod: boolean;
  shift: boolean;
  alt: boolean;
  key: string;
}

function parse(shortcut: Shortcut): Parsed {
  const parts = shortcut.split("+");
  const key = parts.pop()?.toLowerCase() ?? "";
  return {
    mod: parts.includes("Mod"),
    shift: parts.includes("Shift"),
    alt: parts.includes("Alt"),
    key,
  };
}

export function matches(shortcut: Shortcut, e: KeyboardEvent): boolean {
  const p = parse(shortcut);
  const mod = isMac ? e.metaKey : e.ctrlKey;
  const key = /^digit\d$/i.test(e.code) ? e.code.slice(5) : e.key.toLowerCase();
  return mod === p.mod && e.shiftKey === p.shift && e.altKey === p.alt && key === p.key;
}

export function keysOf(shortcut: Shortcut): string[] {
  const p = parse(shortcut);
  const keys: string[] = [];
  if (p.mod) keys.push(isMac ? "⌘" : "Ctrl");
  if (p.alt) keys.push(isMac ? "⌥" : "Alt");
  if (p.shift) keys.push(isMac ? "⇧" : "Shift");
  keys.push(p.key.length === 1 ? p.key.toUpperCase() : p.key[0]!.toUpperCase() + p.key.slice(1));
  return keys;
}

export function isEditableTarget(target: EventTarget | null): boolean {
  const el = target as HTMLElement | null;
  if (!el) return false;
  if (el.closest?.(".monaco-editor")) return true;
  return el.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(el.tagName);
}
