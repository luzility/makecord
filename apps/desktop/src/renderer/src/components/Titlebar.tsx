import type { ReactNode } from "react";
import { api } from "@/lib/api";
import { cn } from "./ui";

export function Titlebar({ className, children }: { className?: string; children?: ReactNode }) {
  return (
    <header data-platform={api.platform} className={cn("titlebar shrink-0", className)}>
      {children}
    </header>
  );
}
