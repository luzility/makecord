import DOMPurify from "dompurify";
import { marked } from "marked";
import { type MouseEvent, useMemo } from "react";
import { api } from "@/lib/api";

marked.setOptions({ gfm: true, breaks: false });

export default function MarkdownPreview({ source }: { source: string }) {
  const html = useMemo(() => DOMPurify.sanitize(marked.parse(source, { async: false })), [source]);

  const onClick = (e: MouseEvent<HTMLDivElement>) => {
    const link = (e.target as HTMLElement).closest("a");
    if (!link) return;
    e.preventDefault();
    const href = link.getAttribute("href") ?? "";
    if (/^https:\/\//.test(href)) void api.app.openExternal(href);
  };

  return (
    <div className="h-full overflow-y-auto">
      <article
        className="mk-prose mx-auto max-w-[760px] px-8 py-6"
        onClickCapture={onClick}
        dangerouslySetInnerHTML={{ __html: html }}
      />
    </div>
  );
}
