import { CaseSensitive, Regex } from "lucide-react";
import { type KeyboardEvent, useEffect, useMemo, useRef, useState } from "react";
import { useT } from "@/i18n";
import { api, type FindMatch, type FindResult } from "@/lib/api";
import { openFile } from "@/lib/dock";
import { fileIcon } from "@/lib/fileIcons";
import { nodeTitle } from "@/lib/nodes";
import { requestReveal } from "@/lib/reveal";
import { useStore } from "@/lib/store";
import { cn, useModalFlag } from "./ui";

const LAST = { query: "", caseSensitive: false, regex: false };

function Highlight({ m }: { m: FindMatch }) {
  return (
    <span className="truncate font-mono text-meta text-muted">
      {m.text.slice(0, m.start)}
      <mark className="rounded-sm bg-fg/20 text-fg">
        {m.text.slice(m.start, m.start + m.length)}
      </mark>
      {m.text.slice(m.start + m.length)}
    </span>
  );
}

function Toggle({
  on,
  label,
  onClick,
  children,
}: {
  on: boolean;
  label: string;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-pressed={on}
      aria-label={label}
      data-tooltip={label}
      onClick={onClick}
      className={cn(
        "inline-flex size-7 items-center justify-center rounded-md transition-colors duration-150 ease-out",
        on ? "bg-hover text-fg" : "text-faint hover:text-fg",
      )}
    >
      {children}
    </button>
  );
}

export function FindInFiles() {
  const { t, locale } = useT();
  const set = useStore((s) => s.set);
  useModalFlag();
  const [query, setQuery] = useState(LAST.query);
  const [caseSensitive, setCaseSensitive] = useState(LAST.caseSensitive);
  const [regex, setRegex] = useState(LAST.regex);
  const [result, setResult] = useState<FindResult | null>(null);
  const [index, setIndex] = useState(0);
  const list = useRef<HTMLDivElement>(null);
  const input = useRef<HTMLInputElement>(null);
  useEffect(() => input.current?.focus(), []);
  const close = () => set({ findOpen: false });

  useEffect(() => {
    Object.assign(LAST, { query, caseSensitive, regex });
    if (!query) {
      setResult(null);
      return;
    }
    let cancelled = false;
    const timer = setTimeout(() => {
      void api.project.find(query, { caseSensitive, regex }).then((r) => {
        if (cancelled) return;
        setResult(r);
        setIndex(0);
      });
    }, 150);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [query, caseSensitive, regex]);

  const groups = useMemo(() => {
    const out: { path: string; items: { m: FindMatch; i: number }[] }[] = [];
    for (const [i, m] of (result?.matches ?? []).entries()) {
      const last = out[out.length - 1];
      if (last?.path === m.path) last.items.push({ m, i });
      else out.push({ path: m.path, items: [{ m, i }] });
    }
    return out;
  }, [result]);

  const matches = result?.matches ?? [];
  const open = (m: FindMatch | undefined) => {
    if (!m) return;
    close();
    void openFile(m.path, m.nodeId);
    if (m.line) {
      void api.fs.readOptional(m.path).then((text) => {
        const line = text?.split(/\r?\n/)[m.line! - 1] ?? "";
        const needle = m.text.slice(m.start, m.start + m.length);
        const column = line.indexOf(needle) + 1;
        requestReveal(m.path, { line: m.line!, column: column || 1, length: needle.length });
      });
    }
  };

  useEffect(() => {
    list.current?.querySelector(`[data-index="${index}"]`)?.scrollIntoView({ block: "nearest" });
  }, [index]);

  const onKey = (e: KeyboardEvent) => {
    if (e.key === "Escape") close();
    else if (e.key === "ArrowDown") {
      e.preventDefault();
      setIndex((i) => Math.min(matches.length - 1, i + 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setIndex((i) => Math.max(0, i - 1));
    } else if (e.key === "Enter") {
      e.preventDefault();
      open(matches[index]);
    } else if (e.altKey && !e.ctrlKey && !e.metaKey && e.code === "KeyC") {
      e.preventDefault();
      setCaseSensitive((v) => !v);
    } else if (e.altKey && !e.ctrlKey && !e.metaKey && e.code === "KeyX") {
      e.preventDefault();
      setRegex((v) => !v);
    }
  };

  const files = groups.length;
  return (
    <div
      className="fixed inset-0 z-[1000] flex items-start justify-center bg-black/50 pt-[10vh]"
      onMouseDown={close}
    >
      <div
        role="dialog"
        aria-label={t("find.title")}
        className="flex w-[760px] max-w-[calc(100vw-32px)] flex-col overflow-hidden rounded-xl border border-line bg-panel shadow-2xl shadow-black/60"
        onMouseDown={(e) => e.stopPropagation()}
        onKeyDown={onKey}
      >
        <div className="flex items-center gap-1 border-b border-line pr-2">
          <input
            ref={input}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onFocus={(e) => e.target.select()}
            placeholder={t("find.placeholder")}
            className="h-12 flex-1 bg-transparent px-4 text-title outline-none placeholder:text-faint focus-visible:outline-none"
          />
          <Toggle
            on={caseSensitive}
            label={t("find.matchCase")}
            onClick={() => setCaseSensitive((v) => !v)}
          >
            <CaseSensitive size={16} strokeWidth={1.5} />
          </Toggle>
          <Toggle on={regex} label={t("find.regex")} onClick={() => setRegex((v) => !v)}>
            <Regex size={16} strokeWidth={1.5} />
          </Toggle>
        </div>
        <div className="flex h-7 items-center border-b border-line px-4 text-meta text-faint">
          {result?.timedOut
            ? t("find.tooLong")
            : result?.error
              ? t("find.badRegex", { error: result.error })
              : !query
                ? t("find.hint")
                : t(result?.truncated ? "find.countTruncated" : "find.count", {
                    matches: String(matches.length),
                    files: String(files),
                  })}
        </div>
        <div ref={list} className="max-h-[56vh] overflow-y-auto p-2">
          {query && result && !matches.length && !result.error && (
            <p className="p-4 text-center text-label text-faint">{t("search.noResults")}</p>
          )}
          {groups.map((g) => {
            const Icon = fileIcon(g.path);
            return (
              <div key={g.path} className="mb-1">
                <div className="flex h-7 items-center gap-2 px-2 text-label">
                  <Icon size={14} strokeWidth={1.5} className="shrink-0 text-faint" />
                  <span className="truncate font-mono text-meta text-fg">{g.path}</span>
                  <span className="text-meta text-faint">{g.items.length}</span>
                </div>
                {g.items.map(({ m, i }) => (
                  <button
                    type="button"
                    key={i}
                    data-index={i}
                    onMouseMove={() => setIndex(i)}
                    onClick={() => open(m)}
                    className={cn(
                      "flex h-7 w-full items-center gap-3 rounded-md pr-2 pl-8 text-left",
                      i === index ? "bg-hover" : "",
                    )}
                  >
                    <span
                      className={cn(
                        "shrink-0 truncate text-meta text-faint",
                        m.line ? "w-8 text-right font-mono" : "w-28",
                      )}
                    >
                      {m.line
                        ? m.line
                        : m.nodeType
                          ? `${nodeTitle(m.nodeType, locale)}`
                          : m.field && m.field !== "note"
                            ? m.field
                            : t("find.note")}
                    </span>
                    <Highlight m={m} />
                  </button>
                ))}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
