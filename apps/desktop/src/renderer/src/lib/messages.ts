import { messageNameOf } from "@makecord/spec";
import { useMemo } from "react";
import type { FileNode } from "./api";
import { useStore } from "./store";

function collect(node: FileNode | null, out: string[]) {
  if (!node) return out;
  if (node.kind === "file") {
    const name = messageNameOf(node.path);
    if (name) out.push(name);
  }
  for (const c of node.children ?? []) collect(c, out);
  return out;
}

export function useMessageNames(): string[] {
  const tree = useStore((s) => s.tree);
  return useMemo(() => collect(tree, []).sort(), [tree]);
}
