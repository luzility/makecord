import { useEffect, useRef, useState } from "react";
import { useT } from "@/i18n";
import { Button, Dialog, Field } from "./ui";

export function PromptDialog({
  title,
  label,
  initial,
  selectUntil,
  submitLabel,
  validate,
  onSubmit,
  onClose,
}: {
  title: string;
  label: string;
  initial: string;
  selectUntil?: number;
  submitLabel: string;
  validate: (value: string) => string | null;
  onSubmit: (value: string) => Promise<boolean>;
  onClose: () => void;
}) {
  const { t } = useT();
  const [value, setValue] = useState(initial);
  const [busy, setBusy] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  const error = value === initial ? null : validate(value);

  useEffect(() => {
    const el = input.current;
    if (!el) return;
    el.focus();
    el.setSelectionRange(0, selectUntil ?? initial.length);
  }, [initial, selectUntil]);

  return (
    <Dialog title={title} onClose={onClose}>
      <form
        className="flex flex-col gap-4"
        onSubmit={async (e) => {
          e.preventDefault();
          if (busy || error || !value.trim()) return;
          setBusy(true);
          const ok = await onSubmit(value.trim());
          setBusy(false);
          if (ok) onClose();
        }}
      >
        <Field label={label} hint={error ?? undefined}>
          <input
            ref={input}
            value={value}
            onChange={(e) => setValue(e.target.value)}
            spellCheck={false}
            className="h-7 w-full rounded-md border border-line bg-chrome px-2 font-mono text-label text-fg focus:border-fg/40 focus:outline-none focus-visible:outline-none"
          />
        </Field>
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose}>
            {t("common.cancel")}
          </Button>
          <Button variant="primary" type="submit" disabled={busy || !!error || !value.trim()}>
            {submitLabel}
          </Button>
        </div>
      </form>
    </Dialog>
  );
}

export function ConfirmDialog({
  title,
  message,
  confirmLabel,
  onConfirm,
  onClose,
}: {
  title: string;
  message: string;
  confirmLabel: string;
  onConfirm: () => Promise<void> | void;
  onClose: () => void;
}) {
  const { t } = useT();
  return (
    <Dialog title={title} onClose={onClose}>
      <p className="text-body text-muted">{message}</p>
      <div className="mt-4 flex justify-end gap-2">
        <Button variant="ghost" onClick={onClose}>
          {t("common.cancel")}
        </Button>
        <Button
          autoFocus
          variant="danger"
          onClick={async () => {
            onClose();
            await onConfirm();
          }}
        >
          {confirmLabel}
        </Button>
      </div>
    </Dialog>
  );
}
