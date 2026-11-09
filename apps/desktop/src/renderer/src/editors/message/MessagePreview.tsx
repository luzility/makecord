import type {
  ActionRow,
  ContainerChild,
  Embed,
  LayoutBlock,
  MessageButton,
  MessageDesign,
  MessageSelect,
} from "@makecord/spec";
import { ChevronDown, ExternalLink, ImageIcon } from "lucide-react";
import { useState } from "react";
import { Logo } from "@/components/Logo";
import { cn } from "@/components/ui";
import { useT } from "@/i18n";
import { useStore } from "@/lib/store";
import { discordMarkdown } from "./markdown";

function Markdown({ text, className }: { text: string; className?: string }) {
  return (
    <div
      className={cn("dc-md", className)}
      dangerouslySetInnerHTML={{ __html: discordMarkdown(text) }}
    />
  );
}

function Picture({ url, className }: { url: string | undefined; className?: string }) {
  const [failed, setFailed] = useState<string | null>(null);
  const usable = url && /^https:\/\//.test(url) && !url.includes("{{") && failed !== url;
  if (usable) {
    return (
      <img
        src={url}
        alt=""
        className={cn("rounded-[4px] object-cover", className)}
        onError={() => setFailed(url)}
      />
    );
  }
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center gap-1 rounded-[4px] bg-dc-input p-2 text-dc-muted",
        className,
      )}
      title={url}
    >
      <ImageIcon size={20} strokeWidth={1.5} />
      {url && <span className="max-w-full truncate font-mono text-[10px]">{url}</span>}
    </div>
  );
}

const BUTTON_BG: Record<MessageButton["style"], string> = {
  primary: "bg-dc-blurple",
  secondary: "bg-dc-grey",
  success: "bg-dc-green",
  danger: "bg-dc-red",
  link: "bg-dc-grey",
};

function Button({ b }: { b: MessageButton }) {
  return (
    <span
      className={cn(
        "inline-flex h-8 min-w-[60px] items-center justify-center gap-1.5 rounded-[8px] px-4 text-[14px] font-medium text-white",
        BUTTON_BG[b.style],
        b.disabled && "opacity-50",
      )}
    >
      {b.emoji && <span>{b.emoji.startsWith("<") ? "🙂" : b.emoji}</span>}
      {b.label && <Markdown text={b.label} className="dc-inline" />}
      {b.style === "link" && <ExternalLink size={14} strokeWidth={2} />}
    </span>
  );
}

function Select({ s }: { s: MessageSelect }) {
  const picked = s.options.filter((o) => o.default).map((o) => o.label);
  return (
    <div
      className={cn(
        "flex h-10 w-full max-w-[400px] items-center justify-between rounded-[8px] border border-black/30 bg-dc-input px-3 text-[14px]",
        s.disabled && "opacity-50",
      )}
    >
      <span className={picked.length ? "text-dc-text" : "text-dc-muted"}>
        {picked.length ? picked.join(", ") : s.placeholder || "Make a selection"}
      </span>
      <ChevronDown size={18} className="text-dc-text" />
    </div>
  );
}

function Row({ row }: { row: ActionRow }) {
  return (
    <div className="flex flex-wrap gap-2">
      {row.components.map((c, i) =>
        c.type === "button" ? <Button key={i} b={c} /> : <Select key={i} s={c} />,
      )}
    </div>
  );
}

function EmbedView({ e }: { e: Embed }) {
  const inline = e.fields.length > 0;
  return (
    <div
      className="grid max-w-[520px] rounded-[4px] border-l-4 bg-dc-embed"
      style={{ borderLeftColor: e.color ?? "#1e1f22" }}
    >
      <div className="flex gap-4 py-2 pr-4 pl-3">
        <div className="flex min-w-0 flex-1 flex-col gap-2">
          {e.author?.name && (
            <div className="flex items-center gap-2 text-[14px] font-semibold text-dc-head">
              {e.author.iconUrl && (
                <Picture url={e.author.iconUrl} className="size-6 rounded-full p-0" />
              )}
              <Markdown text={e.author.name} className="dc-inline" />
            </div>
          )}
          {e.title && (
            <Markdown
              text={e.title}
              className={cn(
                "dc-inline text-[16px] font-semibold",
                e.url ? "text-dc-link" : "text-dc-head",
              )}
            />
          )}
          {e.description && <Markdown text={e.description} className="text-[14px]" />}
          {inline && (
            <div className="grid grid-cols-3 gap-2">
              {e.fields.map((f, i) => (
                <div key={i} className={cn("min-w-0", !f.inline && "col-span-3")}>
                  <Markdown
                    text={f.name}
                    className="dc-inline text-[14px] font-semibold text-dc-head"
                  />
                  <Markdown text={f.value} className="text-[14px]" />
                </div>
              ))}
            </div>
          )}
          {e.image && <Picture url={e.image} className="mt-2 h-48 w-full" />}
          {(e.footer?.text || e.timestamp) && (
            <div className="flex items-center gap-2 text-[12px] text-dc-muted">
              {e.footer?.iconUrl && (
                <Picture url={e.footer.iconUrl} className="size-5 rounded-full p-0" />
              )}
              <span>
                {[e.footer?.text, e.timestamp && "Today at 12:00"].filter(Boolean).join(" • ")}
              </span>
            </div>
          )}
        </div>
        {e.thumbnail && <Picture url={e.thumbnail} className="size-20 shrink-0" />}
      </div>
    </div>
  );
}

function Child({ b }: { b: ContainerChild }) {
  switch (b.type) {
    case "text":
      return <Markdown text={b.content} className="text-[15px]" />;
    case "section":
      return (
        <div className="flex gap-3">
          <div className="flex min-w-0 flex-1 flex-col gap-1">
            {b.texts.map((t, i) => (
              <Markdown key={i} text={t} className="text-[15px]" />
            ))}
          </div>
          <div className="shrink-0 self-start">
            {b.accessory.type === "button" ? (
              <Button b={b.accessory} />
            ) : (
              <Picture url={b.accessory.url} className="size-[85px]" />
            )}
          </div>
        </div>
      );
    case "gallery":
      return (
        <div
          className={cn(
            "grid max-w-[520px] gap-1",
            b.items.length === 1
              ? "grid-cols-1"
              : b.items.length === 2 || b.items.length === 4
                ? "grid-cols-2"
                : "grid-cols-3",
          )}
        >
          {b.items.map((item, i) => (
            <Picture
              key={i}
              url={item.url}
              className={b.items.length === 1 ? "h-56 w-full" : "aspect-square w-full"}
            />
          ))}
        </div>
      );
    case "separator":
      return (
        <div className={b.spacing === "large" ? "py-3" : "py-1"}>
          {b.divider && <div className="h-px bg-white/10" />}
        </div>
      );
    case "row":
      return <Row row={b} />;
  }
}

function Block({ b }: { b: LayoutBlock }) {
  if (b.type !== "container") return <Child b={b} />;
  return (
    <div
      className="flex max-w-[520px] flex-col gap-2 rounded-[8px] border border-white/5 bg-dc-embed p-4"
      style={b.accentColor ? { borderLeft: `4px solid ${b.accentColor}` } : undefined}
    >
      {b.components.map((c, i) => (
        <Child key={i} b={c} />
      ))}
    </div>
  );
}

export function MessagePreview({ message }: { message: MessageDesign }) {
  const { t } = useT();
  const name = useStore((s) => s.project?.name) ?? "Makecord";
  return (
    <div className="h-full overflow-y-auto bg-dc-bg px-4 py-4 text-dc-text">
      <p className="mb-3 text-meta text-dc-muted">{t("message.previewHint")}</p>
      <div className="flex gap-4">
        <div className="shrink-0">
          <Logo size={40} />
        </div>
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <div className="flex items-baseline gap-2">
            <span className="text-[16px] font-medium text-dc-head">{name}</span>
            <span className="rounded-[3px] bg-dc-blurple px-1 text-[10px] font-semibold text-white">
              APP
            </span>
            <span className="text-[12px] text-dc-muted">Today at 12:00</span>
          </div>
          {message.kind === "classic" ? (
            <div className="flex flex-col gap-2">
              {message.content && <Markdown text={message.content} className="text-[15px]" />}
              {message.embeds.map((e, i) => (
                <EmbedView key={i} e={e} />
              ))}
              {message.components.map((r, i) => (
                <Row key={i} row={r} />
              ))}
            </div>
          ) : (
            <div className="flex flex-col gap-2">
              {message.components.map((b, i) => (
                <Block key={i} b={b} />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
