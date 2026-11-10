import type { IDockviewPanelHeaderProps } from "dockview-react";
import { X } from "lucide-react";
import { useEffect, useState } from "react";
import { cn } from "@/components/ui";
import { useT } from "@/i18n";
import { useStore } from "@/lib/store";

export function EditorTab({ api, params }: IDockviewPanelHeaderProps<{ path?: string }>) {
  const { t } = useT();
  const path = params.path ?? "";
  const [title, setTitle] = useState(api.title ?? "");
  const dirty = useStore((s) => s.isDirty(path));
  const invalid = useStore((s) => Boolean(s.docs[path]?.invalid || s.docs[path]?.parseError));
  const [hover, setHover] = useState(false);

  useEffect(() => {
    const d = api.onDidTitleChange((e) => setTitle(e.title));
    return () => d.dispose();
  }, [api]);

  const close = async () => {
    if (path && useStore.getState().isDirty(path)) await useStore.getState().savePath(path);
    api.close();
  };

  return (
    <div
      className="flex h-full items-center gap-1.5 pr-1 pl-3"
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      onAuxClick={(e) => {
        if (e.button === 1) void close();
      }}
    >
      <span className="truncate">{title}</span>
      <button
        type="button"
        aria-label={t("editor.closeTab")}
        title={
          invalid ? t("editor.invalidTab") : dirty ? t("editor.unsavedTab") : t("editor.closeTab")
        }
        onMouseDown={(e) => e.stopPropagation()}
        onClick={(e) => {
          e.stopPropagation();
          void close();
        }}
        className="flex size-5 shrink-0 items-center justify-center rounded text-faint hover:bg-hover hover:text-fg"
      >
        {(dirty || invalid) && !hover ? (
          <span className={cn("size-2 rounded-full", invalid ? "bg-warn" : "bg-fg/70")} />
        ) : (
          <X size={12} strokeWidth={1.75} />
        )}
      </button>
    </div>
  );
}
