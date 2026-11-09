import { useCallback, useEffect, useState } from "react";
import { type MessageKey, useT } from "@/i18n";
import { useStore } from "@/lib/store";
import {
  insertText,
  prefixLine,
  type Range,
  rangeOf,
  type TextField,
  textFieldOf,
  wrapText,
} from "@/lib/textEdit";
import { scopeOf, VAR_GROUP_ORDER, variablesForScope } from "@/lib/variables";
import { ContextMenu, type MenuEntry } from "./Menu";

interface Open {
  x: number;
  y: number;
  el: TextField;
  range: Range;
  scope: string | null;
}

const WRAPS: [MessageKey, string, string][] = [
  ["textMenu.bold", "**", "**"],
  ["textMenu.italic", "*", "*"],
  ["textMenu.underline", "__", "__"],
  ["textMenu.strike", "~~", "~~"],
  ["textMenu.spoiler", "||", "||"],
  ["textMenu.code", "`", "`"],
  ["textMenu.codeBlock", "```\n", "\n```"],
];

const PREFIXES: [MessageKey, string][] = [
  ["textMenu.heading1", "# "],
  ["textMenu.heading2", "## "],
  ["textMenu.heading3", "### "],
  ["textMenu.subtext", "-# "],
  ["textMenu.quote", "> "],
  ["textMenu.list", "- "],
];

export function TextContextMenu() {
  const { t } = useT();
  const [open, setOpen] = useState<Open | null>(null);
  const close = useCallback(() => setOpen(null), []);

  useEffect(() => {
    const onMenu = (e: MouseEvent) => {
      const el = textFieldOf(e.target);
      if (!el || el.closest(".monaco-editor") || e.defaultPrevented) return;
      e.preventDefault();
      setOpen({ x: e.clientX, y: e.clientY, el, range: rangeOf(el), scope: scopeOf(el) });
    };
    window.addEventListener("contextmenu", onMenu);
    return () => window.removeEventListener("contextmenu", onMenu);
  }, []);

  if (!open) return null;
  const { el, range, scope } = open;
  const selected = el.value.slice(range.start, range.end);
  const editable = !el.readOnly && !el.disabled;
  const multiline = el instanceof HTMLTextAreaElement;

  const items: MenuEntry[] = [
    {
      kind: "item",
      label: t("textMenu.cut"),
      keys: ["Ctrl", "X"],
      disabled: !selected || !editable,
      onSelect: () => {
        void navigator.clipboard.writeText(selected);
        insertText(el, range, "");
      },
    },
    {
      kind: "item",
      label: t("textMenu.copy"),
      keys: ["Ctrl", "C"],
      disabled: !selected,
      onSelect: () => void navigator.clipboard.writeText(selected),
    },
    {
      kind: "item",
      label: t("textMenu.paste"),
      keys: ["Ctrl", "V"],
      disabled: !editable,
      onSelect: () => {
        void navigator.clipboard.readText().then((text) => {
          const clean = multiline ? text : text.replace(/\r?\n/g, " ");
          if (clean) insertText(el, range, clean);
        });
      },
    },
    {
      kind: "item",
      label: t("textMenu.selectAll"),
      keys: ["Ctrl", "A"],
      disabled: !el.value,
      onSelect: () => {
        el.focus();
        el.select();
      },
    },
  ];

  if (scope && editable) {
    const vars = variablesForScope(scope, (path) => useStore.getState().docs[path]?.flow);
    const groups: MenuEntry[] = VAR_GROUP_ORDER.flatMap((g) => {
      const list = vars.filter((v) => v.group === g);
      if (!list.length) return [];
      return [
        {
          kind: "submenu" as const,
          label: t(`textMenu.groups.${g}` as MessageKey),
          items: list.map(
            (v): MenuEntry => ({
              kind: "item",
              label: `{{${v.path}}}`,
              onSelect: () => insertText(el, range, `{{${v.path}}}`),
            }),
          ),
        },
      ];
    });
    items.push(
      { kind: "separator" },
      { kind: "submenu", label: t("textMenu.insertVariable"), items: groups },
      {
        kind: "submenu",
        label: t("textMenu.format"),
        items: [
          ...WRAPS.filter(([, b]) => multiline || !b.includes("\n")).map(
            ([key, before, after]): MenuEntry => ({
              kind: "item",
              label: t(key),
              hint: `${before.trim()}…${after.trim()}`,
              onSelect: () => wrapText(el, range, before, after),
            }),
          ),
          {
            kind: "item",
            label: t("textMenu.link"),
            hint: "[…](https://)",
            onSelect: () => {
              const text = selected || t("textMenu.linkText");
              insertText(el, range, `[${text}](https://)`, text.length + 11);
            },
          },
          ...(multiline
            ? [
                { kind: "separator" as const },
                ...PREFIXES.map(
                  ([key, prefix]): MenuEntry => ({
                    kind: "item",
                    label: t(key),
                    hint: prefix.trim(),
                    onSelect: () => prefixLine(el, range, prefix),
                  }),
                ),
              ]
            : []),
        ],
      },
      {
        kind: "submenu",
        label: t("textMenu.discord"),
        items: [
          {
            kind: "item",
            label: t("textMenu.mentionRole"),
            hint: "<@&ID>",
            onSelect: () => insertText(el, range, "<@&>", 3),
          },
          {
            kind: "item",
            label: t("textMenu.mentionUser"),
            hint: "<@ID>",
            onSelect: () => insertText(el, range, "<@>", 2),
          },
          {
            kind: "item",
            label: t("textMenu.mentionChannel"),
            hint: "<#ID>",
            onSelect: () => insertText(el, range, "<#>", 2),
          },
          {
            kind: "item",
            label: t("textMenu.everyone"),
            hint: "@everyone",
            onSelect: () => insertText(el, range, "@everyone"),
          },
          {
            kind: "item",
            label: t("textMenu.here"),
            hint: "@here",
            onSelect: () => insertText(el, range, "@here"),
          },
          { kind: "separator" },
          {
            kind: "item",
            label: t("textMenu.timestamp"),
            hint: "<t:UNIX:R>",
            onSelect: () => insertText(el, range, "<t::R>", 3),
          },
          {
            kind: "item",
            label: t("textMenu.emoji"),
            hint: "<:name:id>",
            onSelect: () => insertText(el, range, "<::>", 2),
          },
          {
            kind: "item",
            label: t("textMenu.slashMention"),
            hint: "</name:id>",
            onSelect: () => insertText(el, range, "</:>", 2),
          },
        ],
      },
    );
  }

  return <ContextMenu x={open.x} y={open.y} items={items} onClose={close} />;
}
