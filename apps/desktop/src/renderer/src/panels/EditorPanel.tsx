import type { IDockviewPanelProps } from "dockview-react";
import { useEffect } from "react";
import { Button, Empty } from "@/components/ui";
import { FlowEditor } from "@/editors/FlowEditor";
import { TextEditor } from "@/editors/TextEditor";
import { useT } from "@/i18n";
import { closeFile } from "@/lib/dock";
import { isFlowFile, useStore } from "@/lib/store";

export function EditorPanel({ params }: IDockviewPanelProps<{ path: string }>) {
  const { t } = useT();
  const missing = useStore((s) => s.docs[params.path]?.missing === true);

  useEffect(() => {
    void useStore.getState().loadDoc(params.path);
  }, [params.path]);

  if (missing) {
    return (
      <Empty>
        <div className="flex flex-col items-center gap-3">
          <p>{t("editor.missing")}</p>
          <p className="font-mono text-meta">{params.path}</p>
          <Button onClick={() => closeFile(params.path)}>{t("editor.closeTab")}</Button>
        </div>
      </Empty>
    );
  }
  return isFlowFile(params.path) ? (
    <FlowEditor path={params.path} />
  ) : (
    <TextEditor path={params.path} />
  );
}
