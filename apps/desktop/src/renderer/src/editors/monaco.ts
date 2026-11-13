import { Flow, MessageDesign, ProjectConfig } from "@makecord/spec";
import * as monaco from "monaco-editor";
import EditorWorker from "monaco-editor/editor/editor.worker?worker";
import JsonWorker from "monaco-editor/languages/features/json/json.worker?worker";
import TsWorker from "monaco-editor/languages/features/typescript/ts.worker?worker";
import { z } from "zod";

self.MonacoEnvironment = {
  getWorker(_id: string, label: string) {
    if (label === "json") return new JsonWorker();
    if (label === "typescript" || label === "javascript") return new TsWorker();
    return new EditorWorker();
  },
};

monaco.editor.addKeybindingRule({
  keybinding: monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyE,
  command: "-actions.findWithSelection",
});

monaco.editor.defineTheme("makecord-dark", {
  base: "vs-dark",
  inherit: true,
  rules: [],
  colors: {
    "editor.background": "#141415",
    "editor.foreground": "#ededed",
    "editorGutter.background": "#141415",
    "editorLineNumber.foreground": "#5c5c62",
    "editorLineNumber.activeForeground": "#a1a1a6",
    "editor.lineHighlightBackground": "#1b1b1d",
    "editor.lineHighlightBorder": "#00000000",
    "editorCursor.foreground": "#ededed",
    "editorIndentGuide.background1": "#262629",
    "editorIndentGuide.activeBackground1": "#3d3d42",
    "editorWhitespace.foreground": "#3d3d42",
    "editorBracketMatch.background": "#ffffff14",
    "editorBracketMatch.border": "#ffffff30",
    "minimap.background": "#141415",
    "editorOverviewRuler.border": "#00000000",
    "scrollbar.shadow": "#00000000",
    "scrollbarSlider.background": "#ffffff14",
    "scrollbarSlider.hoverBackground": "#ffffff22",
    "scrollbarSlider.activeBackground": "#ffffff2e",
    "editorWidget.background": "#1b1b1d",
    "editorWidget.border": "#2c2c30",
    "editorSuggestWidget.background": "#1b1b1d",
    "editorSuggestWidget.border": "#2c2c30",
    "editorSuggestWidget.selectedBackground": "#2a2c32",
    "editorHoverWidget.background": "#1b1b1d",
    "editorHoverWidget.border": "#2c2c30",
    "editorStickyScroll.background": "#141415",
    "menu.background": "#1b1b1d",
    "menu.foreground": "#ededed",
    "menu.border": "#2c2c30",
    "menu.selectionBackground": "#2a2c32",
    "menu.selectionForeground": "#ededed",
    "menu.separatorBackground": "#2c2c30",
    "widget.shadow": "#00000099",
    "input.background": "#0f0f10",
    "input.border": "#2c2c30",
    focusBorder: "#00000000",
  },
});

const schema = (s: z.ZodType) => z.toJSONSchema(s, { io: "input", unrepresentable: "any" });

monaco.json.jsonDefaults.setDiagnosticsOptions({
  validate: true,
  allowComments: false,
  enableSchemaRequest: false,
  schemas: [
    {
      uri: "makecord://schemas/project.json",
      fileMatch: ["**/makecord.json"],
      schema: schema(ProjectConfig),
    },
    { uri: "makecord://schemas/flow.json", fileMatch: ["**/*.flow.json"], schema: schema(Flow) },
    {
      uri: "makecord://schemas/message.json",
      fileMatch: ["**/*.message.json"],
      schema: schema(MessageDesign),
    },
  ],
});

export function languageFor(path: string): string | undefined {
  const name = path.split("/").pop()?.toLowerCase() ?? "";
  if (name.startsWith(".env") || name === ".gitignore") return "ini";
  if (name === "dockerfile") return "dockerfile";
  return undefined;
}

export { monaco };

if (import.meta.env.DEV) (window as unknown as { __monaco: typeof monaco }).__monaco = monaco;
