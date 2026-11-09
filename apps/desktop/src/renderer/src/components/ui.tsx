import { X } from "lucide-react";
import {
  type ButtonHTMLAttributes,
  type InputHTMLAttributes,
  type ReactNode,
  useEffect,
} from "react";
import { useT } from "@/i18n";

export const cn = (...c: (string | false | null | undefined)[]) => c.filter(Boolean).join(" ");

type Variant = "primary" | "ghost" | "subtle" | "danger";

export function Button({
  variant = "subtle",
  className,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant }) {
  return (
    <button
      type="button"
      className={cn(
        "inline-flex h-7 items-center justify-center gap-2 rounded-md px-3 text-label font-medium transition-[color,background-color,transform] duration-150 ease-out active:scale-[0.98] disabled:pointer-events-none disabled:opacity-40",
        variant === "primary" &&
          "bg-fg text-chrome shadow-[inset_0_1px_0_rgb(255_255_255/0.4)] hover:bg-white",
        variant === "subtle" && "border border-line bg-raised text-fg hover:bg-hover",
        variant === "ghost" && "text-muted hover:bg-hover hover:text-fg",
        variant === "danger" && "text-bad hover:bg-bad/10",
        className,
      )}
      {...props}
    />
  );
}

export function IconButton({
  label,
  className,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { label: string }) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      className={cn(
        "inline-flex size-7 items-center justify-center rounded-md text-faint transition-colors duration-150 ease-out hover:bg-hover hover:text-fg disabled:pointer-events-none disabled:opacity-35",
        className,
      )}
      {...props}
    />
  );
}

export function Input({ className, ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      className={cn(
        "h-7 w-full rounded-md border border-line bg-chrome px-2 text-label text-fg transition-colors duration-150 ease-out placeholder:text-faint focus:border-fg/40 focus:outline-none focus-visible:outline-none",
        className,
      )}
      {...props}
    />
  );
}

export const selectCls =
  "h-7 w-full rounded-md border border-line bg-chrome px-2 text-label text-fg focus:border-fg/40 focus:outline-none focus-visible:outline-none";

export function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-label text-muted">{label}</span>
      {children}
      {hint && <span className="text-meta text-faint">{hint}</span>}
    </label>
  );
}

export function Kbd({ children }: { children: ReactNode }) {
  return (
    <kbd className="inline-flex h-5 min-w-5 items-center justify-center rounded border border-line border-b-line-strong bg-raised px-1 font-mono text-meta text-muted">
      {children}
    </kbd>
  );
}

let openModals = 0;

export function useModalFlag() {
  useEffect(() => {
    openModals++;
    document.documentElement.setAttribute("data-modal", "");
    return () => {
      if (--openModals === 0) document.documentElement.removeAttribute("data-modal");
    };
  }, []);
}

export function Dialog({
  title,
  onClose,
  children,
  width = 440,
}: {
  title: string;
  onClose: () => void;
  children: ReactNode;
  width?: number;
}) {
  const { t } = useT();
  useModalFlag();
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);
  return (
    <div
      className="fixed inset-0 z-[1000] flex items-start justify-center bg-black/60 pt-[12vh]"
      onMouseDown={onClose}
    >
      <div
        role="dialog"
        aria-label={title}
        style={{ width }}
        className="max-w-[calc(100vw-32px)] rounded-xl border border-line bg-panel shadow-2xl shadow-black/60"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="flex h-12 items-center justify-between border-b border-line pr-2 pl-4">
          <h2 className="text-title font-medium">{title}</h2>
          <IconButton label={t("common.close")} onClick={onClose}>
            <X size={16} strokeWidth={1.5} />
          </IconButton>
        </div>
        <div className="p-4">{children}</div>
      </div>
    </div>
  );
}

export function Empty({ children }: { children: ReactNode }) {
  return (
    <div className="flex h-full items-center justify-center p-6 text-center text-label text-faint">
      {children}
    </div>
  );
}
