import {
  FileCode2,
  FileJson,
  FileText,
  type LucideIcon,
  MessageSquare,
  SquareFunction,
  Workflow,
  Zap,
} from "lucide-react";

export function fileIcon(path: string): LucideIcon {
  if (path.endsWith(".flow.json")) {
    if (path.startsWith("events/")) return Zap;
    if (path.startsWith("functions/")) return SquareFunction;
    return Workflow;
  }
  if (path.endsWith(".message.json")) return MessageSquare;
  if (path.endsWith(".json")) return FileJson;
  if (/\.(ts|js|mjs|cjs)$/.test(path)) return FileCode2;
  return FileText;
}
