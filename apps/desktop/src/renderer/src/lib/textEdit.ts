export type TextField = HTMLInputElement | HTMLTextAreaElement;

const TEXT_INPUTS = new Set(["text", "search", "url", "email", "tel", ""]);

export function textFieldOf(target: EventTarget | null): TextField | null {
  if (target instanceof HTMLTextAreaElement) return target;
  if (target instanceof HTMLInputElement && TEXT_INPUTS.has(target.type)) return target;
  return null;
}

export interface Range {
  start: number;
  end: number;
}

export const rangeOf = (el: TextField): Range => ({
  start: el.selectionStart ?? el.value.length,
  end: el.selectionEnd ?? el.value.length,
});

export function replaceRange(el: TextField, range: Range, text: string, caret?: number) {
  el.focus();
  el.setSelectionRange(range.start, range.end);
  if (!document.execCommand("insertText", false, text)) {
    el.setRangeText(text, range.start, range.end, "end");
    el.dispatchEvent(new Event("input", { bubbles: true }));
  }
  if (caret !== undefined) {
    const at = range.start + caret;
    el.setSelectionRange(at, at);
  }
}

export function insertText(el: TextField, range: Range, text: string, caret?: number) {
  replaceRange(el, range, text, caret);
}

export function wrapText(el: TextField, range: Range, before: string, after: string) {
  const selected = el.value.slice(range.start, range.end);
  replaceRange(el, range, `${before}${selected}${after}`);
  if (!selected) {
    const at = range.start + before.length;
    el.setSelectionRange(at, at);
  } else {
    el.setSelectionRange(
      range.start + before.length,
      range.start + before.length + selected.length,
    );
  }
}

export function prefixLine(el: TextField, range: Range, prefix: string) {
  const lineStart = el.value.lastIndexOf("\n", range.start - 1) + 1;
  replaceRange(el, { start: lineStart, end: lineStart }, prefix);
  const at = range.start + prefix.length;
  el.setSelectionRange(at, at + (range.end - range.start));
}

const MIRRORED = [
  "boxSizing",
  "width",
  "height",
  "overflowX",
  "overflowY",
  "borderTopWidth",
  "borderRightWidth",
  "borderBottomWidth",
  "borderLeftWidth",
  "paddingTop",
  "paddingRight",
  "paddingBottom",
  "paddingLeft",
  "fontStyle",
  "fontVariant",
  "fontWeight",
  "fontStretch",
  "fontSize",
  "lineHeight",
  "fontFamily",
  "textAlign",
  "textTransform",
  "textIndent",
  "letterSpacing",
  "wordSpacing",
  "tabSize",
] as const;

export function caretRect(
  el: TextField,
  position: number,
): { x: number; y: number; height: number } {
  const style = getComputedStyle(el);
  const mirror = document.createElement("div");
  for (const prop of MIRRORED) mirror.style[prop] = style[prop];
  mirror.style.position = "absolute";
  mirror.style.visibility = "hidden";
  mirror.style.top = "0";
  mirror.style.left = "-9999px";
  mirror.style.whiteSpace = el instanceof HTMLTextAreaElement ? "pre-wrap" : "pre";
  mirror.style.overflowWrap = el instanceof HTMLTextAreaElement ? "break-word" : "normal";
  mirror.textContent = el.value.slice(0, position);
  const marker = document.createElement("span");
  marker.textContent = "​";
  mirror.appendChild(marker);
  document.body.appendChild(mirror);
  const box = el.getBoundingClientRect();
  const lineHeight = Number.parseFloat(style.lineHeight) || Number.parseFloat(style.fontSize) * 1.3;
  const x = box.left + marker.offsetLeft - el.scrollLeft;
  const y = box.top + marker.offsetTop - el.scrollTop;
  mirror.remove();
  return {
    x: Math.min(Math.max(x, box.left), box.right),
    y: Math.min(Math.max(y, box.top), box.bottom - lineHeight),
    height: lineHeight,
  };
}
