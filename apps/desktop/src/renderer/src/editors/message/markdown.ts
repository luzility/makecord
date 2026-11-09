import DOMPurify from "dompurify";

const escapeHtml = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

function inline(s: string): string {
  const codes: string[] = [];
  let out = s.replace(/`([^`\n]+)`/g, (_, c: string) => {
    codes.push(`<code class="dc-code">${c}</code>`);
    return `\uE000${codes.length - 1}\uE000`;
  });
  out = out
    .replace(/\{\{\s*([\w.<>-]+)\s*\}\}/g, '<span class="dc-var">$1</span>')
    .replace(/\[([^\]\n]+)\]\((https?:\/\/[^)\s]+)\)/g, '<a class="dc-link">$1</a>')
    .replace(/&lt;@!?(\d+)&gt;/g, '<span class="dc-mention">@user</span>')
    .replace(/&lt;#(\d+)&gt;/g, '<span class="dc-mention">#channel</span>')
    .replace(/&lt;@&amp;(\d+)&gt;/g, '<span class="dc-mention">@role</span>')
    .replace(/@(everyone|here)\b/g, '<span class="dc-mention">@$1</span>')
    .replace(/\*\*\*([^*]+)\*\*\*/g, "<strong><em>$1</em></strong>")
    .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
    .replace(/__([^_]+)__/g, "<u>$1</u>")
    .replace(/\*([^*\s][^*]*)\*/g, "<em>$1</em>")
    .replace(/(^|[^\w])_([^_\s][^_]*)_(?!\w)/g, "$1<em>$2</em>")
    .replace(/~~([^~]+)~~/g, "<s>$1</s>")
    .replace(/\|\|([^|]+)\|\|/g, '<span class="dc-spoiler">$1</span>');
  return out.replace(/\uE000(\d+)\uE000/g, (_, i: string) => codes[Number(i)] ?? "");
}

export function discordMarkdown(source: string): string {
  const blocks: string[] = [];
  const text = escapeHtml(source).replace(/```(?:\w+\n)?([\s\S]*?)```/g, (_, code: string) => {
    blocks.push(`<pre class="dc-pre">${code.replace(/^\n|\n$/g, "")}</pre>`);
    return `\uE001${blocks.length - 1}\uE001`;
  });
  const lines = text.split("\n").map((line) => {
    const block = line.match(/^\uE001(\d+)\uE001$/);
    if (block) return blocks[Number(block[1])] ?? "";
    let m = line.match(/^(#{1,3}) (.+)$/);
    if (m) return `<div class="dc-h${m[1]!.length}">${inline(m[2]!)}</div>`;
    m = line.match(/^-# (.+)$/);
    if (m) return `<div class="dc-sub">${inline(m[1]!)}</div>`;
    m = line.match(/^&gt; (.*)$/);
    if (m) return `<div class="dc-quote">${inline(m[1]!)}</div>`;
    m = line.match(/^\s*[-*] (.+)$/);
    if (m) return `<div class="dc-li">${inline(m[1]!)}</div>`;
    return `<div>${inline(line) || "<br>"}</div>`;
  });
  const html = lines
    .join("")
    .replace(/\uE001(\d+)\uE001/g, (_, i: string) => blocks[Number(i)] ?? "");
  return DOMPurify.sanitize(html, { ALLOWED_ATTR: ["class"] });
}
