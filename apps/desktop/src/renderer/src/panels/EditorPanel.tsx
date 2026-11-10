import type { IDockviewPanelProps } from "dockview-react";
import { useEffect } from "react";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { Button, Empty } from "@/components/ui";
import { FlowEditor } from "@/editors/FlowEditor";
import { MessageEditor } from "@/editors/message/MessageEditor";
import { TextEditor } from "@/editors/TextEditor";
import { useT } from "@/i18n";
import { closeFile } from "@/lib/dock";
import { isFlowFile, isMessageFile, useStore } from "@/lib/store";

function EditorContent({ params }: IDockviewPanelProps<{ path: string }>) {
  const { t } = useT();
  const missing = useStore((s) => s.docs[params.path]?.missing === true);
  const loaded = useStore((s) => params.path in s.docs);

  useEffect(() => {
    if (!loaded) void useStore.getState().loadDoc(params.path);
  }, [params.path, loaded]);

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
  if (isFlowFile(params.path)) return <FlowEditor path={params.path} />;
  if (isMessageFile(params.path)) return <MessageEditor path={params.path} />;
  return <TextEditor path={params.path} />;
}

export function EditorPanel(props: IDockviewPanelProps<{ path: string }>) {
  return (
    <ErrorBoundary level="panel" name={`editor ${props.params.path}`}>
      <EditorContent {...props} />
    </ErrorBoundary>
  );
}
