import {
  ChevronRight,
  FileCode2,
  FileJson,
  FileText,
  Folder,
  Plus,
  Workflow,
  Zap,
} from "lucide-react";
import { useState } from "react";
import { cn, IconButton } from "@/components/ui";
import { useT } from "@/i18n";
import type { FileNode } from "@/lib/api";
import { openFile } from "@/lib/dock";
import { useStore } from "@/lib/store";

const icon = { size: 16, strokeWidth: 1.5, className: "shrink-0 text-faint" };

function iconFor(node: FileNode) {
  if (node.path.startsWith("events/") && node.name.endsWith(".flow.json")) return <Zap {...icon} />;
  if (node.name.endsWith(".flow.json")) return <Workflow {...icon} />;
  if (node.name.endsWith(".json")) return <FileJson {...icon} />;
  if (/\.(ts|js)$/.test(node.name)) return <FileCode2 {...icon} />;
  return <FileText {...icon} />;
}

const INDENT = 12;
const rowCls =
  "flex h-7 w-full items-center gap-2 rounded-md pr-2 text-left transition-colors duration-150 ease-out";

function TreeItem({ node, depth }: { node: FileNode; depth: number }) {
  const [open, setOpen] = useState(depth < 1 || ["commands", "events"].includes(node.name));
  const active = useStore((s) => s.activePath === node.path);
  const errors = useStore((s) =>
    s.problems.some((p) => p.severity === "error" && p.file === node.path),
  );

  if (node.kind === "dir") {
    return (
      <li>
        <button
          type="button"
          aria-expanded={open}
          onClick={() => setOpen(!open)}
          style={{ paddingLeft: 4 + depth * INDENT }}
          className={cn(rowCls, "text-muted hover:bg-hover hover:text-fg")}
        >
          <ChevronRight
            size={12}
            strokeWidth={1.5}
            className={cn(
              "shrink-0 text-faint transition-transform duration-150 ease-out",
              open && "rotate-90",
            )}
          />
          <Folder {...icon} />
          <span className="truncate">{node.name}</span>
        </button>
        {open && (
          <ul className="flex flex-col gap-0.5 pt-0.5">
            {node.children?.map((c) => (
              <TreeItem key={c.path} node={c} depth={depth + 1} />
            ))}
          </ul>
        )}
      </li>
    );
  }
  return (
    <li>
      <button
        type="button"
        onClick={() => openFile(node.path)}
        style={{ paddingLeft: 4 + depth * INDENT + 20 }}
        className={cn(
          rowCls,
          active
            ? "bg-hover text-fg shadow-[inset_0_1px_0_rgb(255_255_255/0.04)]"
            : "text-muted hover:bg-hover hover:text-fg",
        )}
      >
        {iconFor(node)}
        <span
          className={cn(
            "truncate",
            errors && "underline decoration-bad/70 decoration-wavy underline-offset-4",
          )}
        >
          {node.name.replace(/\.flow\.json$/, "")}
        </span>
      </button>
    </li>
  );
}

export function ProjectPanel() {
  const { t } = useT();
  const tree = useStore((s) => s.tree);
  const set = useStore((s) => s.set);
  return (
    <div className="flex h-full flex-col">
      <div className="flex h-9 shrink-0 items-center justify-between pr-1 pl-3">
        <span className="truncate text-label font-medium">{tree?.name}</span>
        <IconButton label={t("project.newFlow")} onClick={() => set({ newFlowOpen: true })}>
          <Plus size={16} strokeWidth={1.5} />
        </IconButton>
      </div>
      <ul className="flex flex-1 flex-col gap-0.5 overflow-y-auto px-2 pb-2 text-body">
        {tree?.children?.map((c) => (
          <TreeItem key={c.path} node={c} depth={0} />
        ))}
      </ul>
    </div>
  );
}
