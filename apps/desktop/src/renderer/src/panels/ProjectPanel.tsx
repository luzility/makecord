import { ChevronRight, Folder, Plus } from "lucide-react";
import { type MouseEvent, useCallback, useState } from "react";
import { ContextMenu, type MenuEntry } from "@/components/Menu";
import { ConfirmDialog, PromptDialog } from "@/components/Prompts";
import { cn, IconButton } from "@/components/ui";
import { useT } from "@/i18n";
import type { FileNode } from "@/lib/api";
import { openFile } from "@/lib/dock";
import { fileIcon } from "@/lib/fileIcons";
import {
  baseOf,
  createFile,
  createFolder,
  deletePath,
  dirOf,
  duplicateFile,
  join,
  renamePath,
  validName,
} from "@/lib/files";
import { useStore } from "@/lib/store";

const icon = { size: 16, strokeWidth: 1.5, className: "shrink-0 text-faint" };

function iconFor(node: FileNode) {
  const Icon = fileIcon(node.path);
  return <Icon {...icon} />;
}

const INDENT = 12;
const rowCls =
  "flex h-7 w-full items-center gap-2 rounded-md pr-2 text-left transition-colors duration-150 ease-out";

const stemLength = (name: string) => {
  const suffix = name.match(/(\.flow\.json|\.message\.json|\.[^.]+)$/)?.[1];
  return suffix && suffix.length < name.length ? name.length - suffix.length : name.length;
};

type Prompt =
  | { kind: "rename"; node: FileNode }
  | { kind: "newFile" | "newFolder"; dir: string }
  | { kind: "delete"; node: FileNode };

interface Actions {
  menu(e: MouseEvent, node: FileNode | null): void;
  prompt(p: Prompt): void;
}

function TreeItem({ node, depth, actions }: { node: FileNode; depth: number; actions: Actions }) {
  const [open, setOpen] = useState(
    depth < 1 || ["commands", "events", "messages"].includes(node.name),
  );
  const active = useStore((s) => s.activePath === node.path);
  const errors = useStore((s) =>
    s.problems.some((p) => p.severity === "error" && p.file === node.path),
  );
  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "F2") actions.prompt({ kind: "rename", node });
    else if (e.key === "Delete") actions.prompt({ kind: "delete", node });
    else return;
    e.preventDefault();
    e.stopPropagation();
  };
  const onContextMenu = (e: MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    actions.menu(e, node);
  };

  if (node.kind === "dir") {
    return (
      <li>
        <button
          type="button"
          aria-expanded={open}
          onClick={() => setOpen(!open)}
          onKeyDown={onKeyDown}
          onContextMenu={onContextMenu}
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
              <TreeItem key={c.path} node={c} depth={depth + 1} actions={actions} />
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
        onKeyDown={onKeyDown}
        onContextMenu={onContextMenu}
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
          {node.name.replace(/\.(flow|message)\.json$/, "")}
        </span>
      </button>
    </li>
  );
}

export function ProjectPanel() {
  const { t } = useT();
  const tree = useStore((s) => s.tree);
  const set = useStore((s) => s.set);
  const [menu, setMenu] = useState<{ x: number; y: number; items: MenuEntry[] } | null>(null);
  const [prompt, setPrompt] = useState<Prompt | null>(null);
  const closeMenu = useCallback(() => setMenu(null), []);

  const nameError = (value: string) => {
    const err = validName(value);
    return err === "empty" ? t("files.nameEmpty") : err ? t("files.nameInvalid") : null;
  };

  const itemsFor = (node: FileNode | null): MenuEntry[] => {
    const dir = node ? (node.kind === "dir" ? node.path : dirOf(node.path)) : "";
    const create: MenuEntry[] = [
      { kind: "item", label: t("files.newFlow"), onSelect: () => set({ newFlowOpen: "command" }) },
      {
        kind: "item",
        label: t("files.newMessage"),
        onSelect: () => set({ newFlowOpen: "message" }),
      },
      {
        kind: "item",
        label: t("files.newFile"),
        onSelect: () => setPrompt({ kind: "newFile", dir }),
      },
      {
        kind: "item",
        label: t("files.newFolder"),
        onSelect: () => setPrompt({ kind: "newFolder", dir }),
      },
    ];
    if (!node) return create;
    const own: MenuEntry[] =
      node.kind === "file"
        ? [
            { kind: "item", label: t("files.open"), onSelect: () => void openFile(node.path) },
            {
              kind: "item",
              label: t("files.duplicate"),
              onSelect: () => void duplicateFile(node.path),
            },
          ]
        : [];
    return [
      ...own,
      {
        kind: "item",
        label: t("files.rename"),
        keys: ["F2"],
        onSelect: () => setPrompt({ kind: "rename", node }),
      },
      {
        kind: "item",
        label: t("files.copyPath"),
        onSelect: () => void navigator.clipboard.writeText(node.path),
      },
      { kind: "separator" },
      { kind: "submenu", label: t("files.new"), items: create },
      { kind: "separator" },
      {
        kind: "item",
        label: t("common.delete"),
        keys: ["Delete"],
        onSelect: () => setPrompt({ kind: "delete", node }),
      },
    ];
  };

  const actions: Actions = {
    menu: (e, node) => setMenu({ x: e.clientX, y: e.clientY, items: itemsFor(node) }),
    prompt: setPrompt,
  };

  return (
    <div className="flex h-full flex-col">
      <div className="flex h-9 shrink-0 items-center justify-between pr-1 pl-3">
        <span className="truncate text-label font-medium">{tree?.name}</span>
        <IconButton label={t("project.newFlow")} onClick={() => set({ newFlowOpen: "command" })}>
          <Plus size={16} strokeWidth={1.5} />
        </IconButton>
      </div>
      <ul
        className="flex flex-1 flex-col gap-0.5 overflow-y-auto px-2 pb-2 text-body"
        onContextMenu={(e) => {
          e.preventDefault();
          actions.menu(e, null);
        }}
      >
        {tree?.children?.map((c) => (
          <TreeItem key={c.path} node={c} depth={0} actions={actions} />
        ))}
      </ul>

      {menu && <ContextMenu x={menu.x} y={menu.y} items={menu.items} onClose={closeMenu} />}

      {prompt?.kind === "rename" && (
        <PromptDialog
          title={t("files.renameTitle", { name: prompt.node.name })}
          label={t("files.name")}
          initial={prompt.node.name}
          selectUntil={prompt.node.kind === "file" ? stemLength(prompt.node.name) : undefined}
          submitLabel={t("files.rename")}
          validate={nameError}
          onSubmit={(name) => renamePath(prompt.node.path, join(dirOf(prompt.node.path), name))}
          onClose={() => setPrompt(null)}
        />
      )}
      {(prompt?.kind === "newFile" || prompt?.kind === "newFolder") && (
        <PromptDialog
          title={t(prompt.kind === "newFile" ? "files.newFile" : "files.newFolder")}
          label={prompt.dir ? t("files.nameIn", { dir: `${prompt.dir}/` }) : t("files.name")}
          initial=""
          submitLabel={t("common.create")}
          validate={(v) =>
            v
              .split("/")
              .map((part) => nameError(part))
              .find(Boolean) ?? null
          }
          onSubmit={(name) =>
            prompt.kind === "newFile"
              ? createFile(join(prompt.dir, name))
              : createFolder(join(prompt.dir, name))
          }
          onClose={() => setPrompt(null)}
        />
      )}
      {prompt?.kind === "delete" && (
        <ConfirmDialog
          title={t("files.deleteTitle", { name: baseOf(prompt.node.path) })}
          message={t(prompt.node.kind === "dir" ? "files.deleteFolder" : "files.deleteFile", {
            path: prompt.node.path,
          })}
          confirmLabel={t("common.delete")}
          onConfirm={() => deletePath(prompt.node.path)}
          onClose={() => setPrompt(null)}
        />
      )}
    </div>
  );
}
