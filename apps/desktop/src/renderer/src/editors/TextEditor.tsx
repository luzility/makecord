import { Code2, Columns2, Eye } from "lucide-react";
import { lazy, Suspense, useState } from "react";
import { cn } from "@/components/ui";
import { type MessageKey, useT } from "@/i18n";
import { useStore } from "@/lib/store";

const CodeEditor = lazy(() => import("./MonacoEditor"));
const MarkdownPreview = lazy(() => import("./MarkdownPreview"));

type View = "code" | "split" | "preview";
const VIEWS: { id: View; label: MessageKey; icon: typeof Code2 }[] = [
  { id: "code", label: "editor.viewCode", icon: Code2 },
  { id: "split", label: "editor.viewSplit", icon: Columns2 },
  { id: "preview", label: "editor.viewPreview", icon: Eye },
];

const isMarkdown = (path: string) => /\.mdx?$/i.test(path);

export function TextEditor({ path }: { path: string }) {
  const { t } = useT();
  const doc = useStore((s) => s.docs[path]);
  const setText = useStore((s) => s.setText);
  const [view, setView] = useState<View>("split");
  if (!doc) return null;

  const editor = (
    <Suspense fallback={null}>
      <CodeEditor path={path} value={doc.text} onChange={(text) => setText(path, text)} />
    </Suspense>
  );
  if (!isMarkdown(path)) return editor;

  return (
    <div className="flex h-full flex-col">
      <div className="flex h-9 shrink-0 items-center justify-end border-b border-line px-2">
        <fieldset
          aria-label={t("editor.view")}
          className="m-0 flex min-w-0 gap-0.5 rounded-md border border-line p-0.5"
        >
          {VIEWS.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              type="button"
              aria-pressed={view === id}
              title={t(label)}
              onClick={() => setView(id)}
              className={cn(
                "flex h-6 items-center gap-1.5 rounded px-2 text-label transition-colors duration-150 ease-out",
                view === id ? "bg-hover text-fg" : "text-faint hover:text-fg",
              )}
            >
              <Icon size={14} strokeWidth={1.5} />
              {t(label)}
            </button>
          ))}
        </fieldset>
      </div>
      <div className="flex min-h-0 flex-1">
        {view !== "preview" && (
          <div
            className={cn("min-w-0", view === "split" ? "w-1/2 border-r border-line" : "flex-1")}
          >
            {editor}
          </div>
        )}
        {view !== "code" && (
          <div className={cn("min-w-0", view === "split" ? "w-1/2" : "flex-1")}>
            <Suspense fallback={null}>
              <MarkdownPreview source={doc.text} />
            </Suspense>
          </div>
        )}
      </div>
    </div>
  );
}
