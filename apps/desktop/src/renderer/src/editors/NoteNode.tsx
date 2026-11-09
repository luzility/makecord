import { type Node, type NodeProps, NodeResizer } from "@xyflow/react";
import { memo, useEffect, useRef } from "react";
import { cn } from "@/components/ui";

export type NoteData = {
  text: string;
  placeholder: string;
  fresh: boolean;
  onText(text: string): void;
  onResize(size: { x: number; y: number; width: number; height: number }): void;
};
export type NoteNode = Node<NoteData, "note">;

export const NOTE_SIZE = { width: 240, height: 120 };

export const NoteView = memo(function NoteView({ data, selected }: NodeProps<NoteNode>) {
  const area = useRef<HTMLTextAreaElement>(null);
  useEffect(() => {
    if (!data.fresh) return;
    const id = setTimeout(() => area.current?.focus(), 60);
    return () => clearTimeout(id);
  }, [data.fresh]);
  return (
    <>
      <NodeResizer
        isVisible={selected}
        minWidth={120}
        minHeight={60}
        maxWidth={1200}
        maxHeight={1200}
        lineClassName="!border-fg/30"
        handleClassName="!size-2 !rounded-sm !border-fg/40 !bg-raised"
        onResizeEnd={(_, p) =>
          data.onResize({
            x: Math.round(p.x),
            y: Math.round(p.y),
            width: Math.round(p.width),
            height: Math.round(p.height),
          })
        }
      />
      <div
        className={cn(
          "flex h-full w-full flex-col rounded-[10px] border bg-[#1d1c18] shadow-lg shadow-black/30",
          selected ? "border-fg/40" : "border-[#3a372c]",
        )}
      >
        <div className="h-3 shrink-0 cursor-grab rounded-t-[10px] bg-[#25231c]" />
        <textarea
          ref={area}
          value={data.text}
          placeholder={data.placeholder}
          onChange={(e) => data.onText(e.target.value)}
          spellCheck={false}
          maxLength={4000}
          className="nodrag nowheel min-h-0 flex-1 resize-none bg-transparent px-3 py-2 text-body leading-5 text-[#d9d4c1] outline-none placeholder:text-[#7a7563] focus-visible:outline-none"
        />
      </div>
    </>
  );
});
