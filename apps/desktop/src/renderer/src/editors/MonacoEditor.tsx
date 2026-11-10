import { useEffect, useRef } from "react";
import { onReveal, takeReveal } from "@/lib/reveal";
import { languageFor, monaco } from "./monaco";

export interface CodeEditorProps {
  path: string;
  value: string;
  onChange: (value: string) => void;
}

export default function MonacoEditor({ path, value, onChange }: CodeEditorProps) {
  const host = useRef<HTMLDivElement>(null);
  const editor = useRef<monaco.editor.IStandaloneCodeEditor | null>(null);
  const changeRef = useRef(onChange);
  changeRef.current = onChange;
  const applyingExternal = useRef(false);

  useEffect(() => {
    if (!host.current) return;
    const uri = monaco.Uri.file(`/${path}`);
    monaco.editor.getModel(uri)?.dispose();
    const model = monaco.editor.createModel(value, languageFor(path), uri);
    const markdown = /\.mdx?$/i.test(path);

    const e = monaco.editor.create(host.current, {
      model,
      theme: "makecord-dark",
      automaticLayout: true,
      fontFamily: '"JetBrains Mono Variable", ui-monospace, Menlo, Consolas, monospace',
      fontSize: 13,
      lineHeight: 20,
      fontLigatures: false,
      tabSize: 2,
      padding: { top: 12, bottom: 12 },
      minimap: { enabled: !markdown, renderCharacters: false, showSlider: "mouseover" },
      wordWrap: markdown ? "on" : "off",
      scrollBeyondLastLine: false,
      smoothScrolling: true,
      cursorBlinking: "smooth",
      cursorSmoothCaretAnimation: "on",
      renderLineHighlight: "all",
      bracketPairColorization: { enabled: true },
      guides: { bracketPairs: "active", indentation: true },
      stickyScroll: { enabled: !markdown },
      fixedOverflowWidgets: true,
      overviewRulerLanes: 2,
      hideCursorInOverviewRuler: true,
    });
    const sub = model.onDidChangeContent(() => {
      if (!applyingExternal.current) changeRef.current(model.getValue());
    });
    editor.current = e;
    const reveal = () => {
      const r = takeReveal(path);
      if (!r) return;
      const line = Math.min(r.line, model.getLineCount());
      e.setSelection(new monaco.Range(line, r.column, line, r.column + r.length));
      e.revealLineInCenter(line);
      e.focus();
    };
    const offReveal = onReveal((p) => p === path && reveal());
    const first = setTimeout(reveal, 0);
    return () => {
      clearTimeout(first);
      offReveal();
      sub.dispose();
      e.dispose();
      model.dispose();
      editor.current = null;
    };
  }, [path]);

  useEffect(() => {
    const e = editor.current;
    const model = e?.getModel();
    if (!e || !model || model.getValue() === value) return;
    applyingExternal.current = true;
    e.executeEdits("external", [{ range: model.getFullModelRange(), text: value }]);
    applyingExternal.current = false;
  }, [value]);

  return <div ref={host} className="monaco-component h-full min-h-0 overflow-hidden" />;
}
