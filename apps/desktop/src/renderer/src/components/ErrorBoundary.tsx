import { AlertTriangle, Copy, FolderOpen, RotateCcw } from "lucide-react";
import { Component, type ErrorInfo, type ReactNode, useState } from "react";
import { useT } from "@/i18n";
import { api } from "@/lib/api";
import { ISSUES_URL } from "@/lib/links";
import { Button } from "./ui";

type Level = "app" | "panel";

interface Props {
  level: Level;
  name?: string;
  children: ReactNode;
}

interface State {
  error: Error | null;
  details: string;
}

export function reportError(source: string, e: unknown, extra = "") {
  const text = e instanceof Error ? (e.stack ?? `${e.name}: ${e.message}`) : String(e);
  void api.app.logError(`${source}: ${text}${extra ? `\n${extra}` : ""}`).catch(() => {});
}

function detailsOf(error: Error, info: string, name?: string) {
  return [
    `Makecord crash${name ? ` in ${name}` : ""}`,
    `${error.name}: ${error.message}`,
    "",
    error.stack ?? "",
    info ? `\nComponent stack:${info}` : "",
    "",
    `User agent: ${navigator.userAgent}`,
  ].join("\n");
}

function Fallback({
  level,
  error,
  details,
  onRetry,
}: {
  level: Level;
  error: Error;
  details: string;
  onRetry: () => void;
}) {
  const { t } = useT();
  const [copied, setCopied] = useState(false);
  const report = () => {
    const title = encodeURIComponent(`Crash: ${error.message.slice(0, 80)}`);
    const body = encodeURIComponent(
      `**What were you doing?**\n\n\n**Details**\n\n\`\`\`\n${details.slice(0, 5000)}\n\`\`\``,
    );
    void api.app.openExternal(`${ISSUES_URL}/new?title=${title}&body=${body}`);
  };
  return (
    <div
      role="alert"
      className={
        level === "app"
          ? "flex h-full items-center justify-center bg-chrome p-8"
          : "flex h-full items-center justify-center bg-panel p-4"
      }
    >
      <div
        className={
          level === "app" ? "flex max-w-md flex-col gap-4" : "flex max-w-sm flex-col gap-3"
        }
      >
        <div className="flex items-center gap-2">
          <AlertTriangle size={level === "app" ? 20 : 16} strokeWidth={1.5} className="text-warn" />
          <h2 className={level === "app" ? "text-heading font-medium" : "text-title font-medium"}>
            {t(level === "app" ? "crash.appTitle" : "crash.panelTitle")}
          </h2>
        </div>
        <p className="text-label text-muted">
          {t(level === "app" ? "crash.appBody" : "crash.panelBody")}
        </p>
        <p className="max-h-24 overflow-y-auto rounded-md border border-line bg-chrome p-2 font-mono text-meta break-words text-faint select-text">
          {error.message}
        </p>
        <div className="flex flex-wrap gap-2">
          <Button variant="primary" onClick={level === "app" ? () => location.reload() : onRetry}>
            <RotateCcw size={14} strokeWidth={1.5} />
            {t(level === "app" ? "crash.reload" : "crash.retry")}
          </Button>
          <Button
            onClick={async () => {
              await navigator.clipboard.writeText(details);
              setCopied(true);
            }}
          >
            <Copy size={14} strokeWidth={1.5} />
            {copied ? t("crash.copied") : t("crash.copy")}
          </Button>
          {level === "app" && (
            <Button variant="ghost" onClick={() => void api.app.openLogs()}>
              <FolderOpen size={14} strokeWidth={1.5} />
              {t("crash.logs")}
            </Button>
          )}
          <Button variant="ghost" onClick={report}>
            {t("crash.report")}
          </Button>
        </div>
      </div>
    </div>
  );
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null, details: "" };

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    const details = detailsOf(error, info.componentStack ?? "", this.props.name);
    this.setState({ details });
    reportError(this.props.name ?? this.props.level, error, info.componentStack ?? "");
  }

  render() {
    const { error, details } = this.state;
    if (!error) return this.props.children;
    return (
      <Fallback
        level={this.props.level}
        error={error}
        details={details || detailsOf(error, "", this.props.name)}
        onRetry={() => this.setState({ error: null, details: "" })}
      />
    );
  }
}
