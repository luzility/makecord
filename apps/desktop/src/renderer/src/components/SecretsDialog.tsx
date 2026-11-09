import { Check, ShieldAlert, Trash2 } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { useT } from "@/i18n";
import { api, type SecretStatus } from "@/lib/api";
import { cleanError, useStore } from "@/lib/store";
import { Button, Dialog, IconButton, Input } from "./ui";

const NAME = /^[A-Z][A-Z0-9_]*$/;

export function SecretsDialog() {
  const { t } = useT();
  const set = useStore((s) => s.set);
  const [secrets, setSecrets] = useState<SecretStatus[]>([]);
  const [backend, setBackend] = useState("");
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [newName, setNewName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const attempt = async (fn: () => Promise<void>) => {
    setError(null);
    try {
      await fn();
    } catch (e) {
      setError(cleanError(e));
    }
  };
  const close = useCallback(() => set({ secretsOpen: false }), [set]);

  const refresh = useCallback(async () => setSecrets(await api.secrets.list()), []);
  useEffect(() => {
    void refresh();
    void api.secrets.backend().then(setBackend);
  }, [refresh]);

  const save = (name: string) =>
    attempt(async () => {
      const value = drafts[name];
      if (!value) return;
      await api.secrets.set(name, value);
      setDrafts((d) => ({ ...d, [name]: "" }));
      await refresh();
    });

  return (
    <Dialog title={t("secrets.title")} onClose={close} width={560}>
      <p className="mb-4 text-label leading-5 text-muted">{t("secrets.intro")}</p>
      {backend === "basic_text" && (
        <p className="mb-4 flex gap-2 rounded-md bg-warn/10 p-2 text-label text-warn">
          <ShieldAlert size={16} strokeWidth={1.5} className="shrink-0" />
          {t("secrets.weak")}
        </p>
      )}
      <ul className="flex flex-col gap-2">
        {secrets.map((s) => (
          <li key={s.name} className="flex items-center gap-2">
            <code className="w-44 shrink-0 truncate font-mono text-label">{s.name}</code>
            <form
              className="flex flex-1 gap-2"
              onSubmit={(e) => {
                e.preventDefault();
                void save(s.name);
              }}
            >
              <Input
                type="password"
                autoComplete="off"
                placeholder={s.isSet ? t("secrets.placeholderSet") : t("secrets.placeholderEmpty")}
                value={drafts[s.name] ?? ""}
                onChange={(e) => setDrafts((d) => ({ ...d, [s.name]: e.target.value }))}
              />
              <Button type="submit" disabled={!drafts[s.name]}>
                {t("common.save")}
              </Button>
            </form>
            <span className="flex w-16 items-center justify-end gap-1">
              {s.isSet && (
                <>
                  <Check
                    size={16}
                    strokeWidth={1.5}
                    className="text-ok"
                    aria-label={t("secrets.saved")}
                  />
                  <IconButton
                    label={t("common.delete")}
                    onClick={() =>
                      attempt(async () => {
                        await api.secrets.remove(s.name);
                        await refresh();
                      })
                    }
                  >
                    <Trash2 size={16} strokeWidth={1.5} />
                  </IconButton>
                </>
              )}
            </span>
          </li>
        ))}
      </ul>
      {error && <p className="mt-4 rounded-md bg-bad/10 px-2 py-1 text-label text-bad">{error}</p>}
      <form
        className="mt-4 flex gap-2 border-t border-line pt-4"
        onSubmit={(e) => {
          e.preventDefault();
          if (!NAME.test(newName) || secrets.some((s) => s.name === newName)) return;
          setSecrets((s) => [...s, { name: newName, isSet: false }]);
          setNewName("");
        }}
      >
        <Input
          placeholder={t("secrets.newName")}
          value={newName}
          onChange={(e) => setNewName(e.target.value.toUpperCase().replace(/[^A-Z0-9_]/g, "_"))}
          className="font-mono"
        />
        <Button type="submit" disabled={!NAME.test(newName)}>
          {t("common.add")}
        </Button>
      </form>
    </Dialog>
  );
}
