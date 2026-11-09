import { Handle, type Node, type NodeProps, Position } from "@xyflow/react";
import { AlertTriangle, CircleAlert } from "lucide-react";
import { memo } from "react";
import { Led } from "@/components/Logo";
import { cn } from "@/components/ui";
import type { NodeDescriptor } from "@/lib/nodes";

export type MkNodeData = {
  meta?: NodeDescriptor;
  nodeType: string;
  data: Record<string, unknown>;
  title: string;
  hint?: string;
  outputs: { port: string; label: string }[];
  triggerLabel?: string;
  problem?: { severity: "error" | "warning"; message: string };
  live: boolean;
  breakpoint: boolean;
  paused: boolean;
  breakpointLabel: string;
  pausedLabel: string;
  onToggleBreakpoint(): void;
};
export type MkNode = Node<MkNodeData, "mk">;

function preview(data: Record<string, unknown>): string | undefined {
  const v = data.content ?? data.message ?? data.value ?? data.left;
  return typeof v === "string" && v ? v : undefined;
}

export const FlowNode = memo(function FlowNode({ data, selected }: NodeProps<MkNode>) {
  const { meta, problem, triggerLabel, live } = data;
  const isTrigger = meta?.category === "trigger";
  const body = isTrigger ? triggerLabel : preview(data.data);

  return (
    <div
      className={cn(
        "group relative w-[220px] rounded-[10px] border bg-raised text-left shadow-lg shadow-black/40 transition-[border-color] duration-300 ease-out",
        data.paused
          ? "border-bad ring-2 ring-bad/30"
          : live
            ? "border-signal/70"
            : selected
              ? "border-fg/50"
              : problem?.severity === "error"
                ? "border-bad/60"
                : "border-line",
      )}
    >
      {!isTrigger && <Handle type="target" position={Position.Left} />}
      <button
        type="button"
        title={data.breakpointLabel}
        aria-label={data.breakpointLabel}
        aria-pressed={data.breakpoint}
        onClick={(e) => {
          e.stopPropagation();
          data.onToggleBreakpoint();
        }}
        className={cn(
          "nodrag absolute top-2 -left-6 flex size-4 items-center justify-center rounded-full transition-opacity duration-150",
          data.breakpoint ? "opacity-100" : "opacity-0 group-hover:opacity-60 hover:!opacity-100",
        )}
      >
        <span
          className={cn("size-3 rounded-full", data.breakpoint ? "bg-bad" : "border border-bad/70")}
        />
      </button>
      {data.paused && (
        <span className="absolute -top-5 left-0 rounded bg-bad px-1.5 font-mono text-[10px] leading-4 text-white">
          {data.pausedLabel}
        </span>
      )}
      <div className="flex h-8 items-center gap-2 border-b border-line px-3">
        <span
          className="size-2 shrink-0 rounded-full"
          style={{ background: meta ? `var(--color-cat-${meta.category})` : "var(--color-bad)" }}
        />
        <span className="truncate text-label font-medium">{data.title}</span>
        <span className="ml-auto flex items-center">
          {problem ? (
            <span title={problem.message}>
              {problem.severity === "error" ? (
                <CircleAlert size={16} strokeWidth={1.5} className="text-bad" />
              ) : (
                <AlertTriangle size={16} strokeWidth={1.5} className="text-warn" />
              )}
            </span>
          ) : (
            <Led on={live} />
          )}
        </span>
      </div>
      <div className="min-h-9 px-3 py-2">
        {body ? (
          <p
            className={cn("line-clamp-2 text-meta", isTrigger ? "font-mono text-fg" : "text-muted")}
          >
            {body}
          </p>
        ) : (
          <p className="line-clamp-2 text-meta text-faint">{data.hint}</p>
        )}
      </div>
      {data.outputs.length === 1 ? (
        <Handle type="source" position={Position.Right} id={data.outputs[0]?.port} />
      ) : (
        <div className="flex flex-col gap-1 border-t border-line py-2">
          {data.outputs.map((o) => (
            <div key={o.port} className="relative pr-4 text-right font-mono text-meta text-faint">
              {o.label}
              <Handle
                type="source"
                position={Position.Right}
                id={o.port}
                style={{ top: "50%", right: -5 }}
              />
            </div>
          ))}
        </div>
      )}
    </div>
  );
});
