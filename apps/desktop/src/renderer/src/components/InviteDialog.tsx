import {
  BASE_BOT_PERMISSIONS,
  BOT_PERMISSIONS,
  type BotPermission,
  type Flow,
  inviteUrl,
  isBotPermission,
  PRIVILEGED_INTENTS,
  PROJECT_FILE,
  ProjectConfig,
} from "@makecord/spec";
import { Check, Copy, ExternalLink } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useT } from "@/i18n";
import { api } from "@/lib/api";
import { filesUnder } from "@/lib/files";
import { descriptorOf } from "@/lib/nodes";
import { useStore } from "@/lib/store";
import { Button, cn, Dialog } from "./ui";

interface Info {
  botId: string | null;
  config: ProjectConfig | null;
  needed: Map<BotPermission, string[]>;
}

async function load(): Promise<Info> {
  const [botId, configText] = await Promise.all([
    api.project.botId().catch(() => null),
    api.fs.readOptional(PROJECT_FILE),
  ]);
  let config: ProjectConfig | null = null;
  try {
    const res = ProjectConfig.safeParse(JSON.parse(configText ?? ""));
    if (res.success) config = res.data;
  } catch {}
  const needed = new Map<BotPermission, string[]>();
  const flows = filesUnder(useStore.getState().tree).filter((p) => p.endsWith(".flow.json"));
  for (const path of flows) {
    let flow: Flow;
    try {
      flow = JSON.parse((await api.fs.readOptional(path)) ?? "");
    } catch {
      continue;
    }
    for (const node of flow.nodes ?? []) {
      for (const p of descriptorOf(node.type)?.permissions ?? []) {
        if (!isBotPermission(p)) continue;
        const list = needed.get(p) ?? [];
        if (!list.includes(node.type)) list.push(node.type);
        needed.set(p, list);
      }
    }
  }
  return { botId, config, needed };
}

const ALL = Object.keys(BOT_PERMISSIONS) as BotPermission[];

export function InviteDialog() {
  const { t } = useT();
  const set = useStore((s) => s.set);
  const close = () => set({ inviteOpen: false });
  const [info, setInfo] = useState<Info | null>(null);
  const [picked, setPicked] = useState<Set<BotPermission>>(new Set());
  const [testServer, setTestServer] = useState(true);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    void load().then((i) => {
      setInfo(i);
      setPicked(new Set([...BASE_BOT_PERMISSIONS, ...i.needed.keys()]));
    });
  }, []);

  const url = useMemo(
    () =>
      info?.botId
        ? inviteUrl({
            clientId: info.botId,
            permissions: picked,
            guildId: testServer ? info.config?.devGuildId : undefined,
          })
        : null,
    [info, picked, testServer],
  );

  if (!info) return null;
  const privileged = PRIVILEGED_INTENTS.filter((i) => info.config?.intents.includes(i));
  const portal = info.botId
    ? `https://discord.com/developers/applications/${info.botId}/bot`
    : null;

  return (
    <Dialog title={t("invite.title")} onClose={close} width={560}>
      {!info.botId ? (
        <div className="flex flex-col gap-4">
          <p className="text-body text-muted">{t("invite.noToken")}</p>
          <div className="flex justify-end">
            <Button variant="primary" onClick={() => set({ inviteOpen: false, secretsOpen: true })}>
              {t("start.openSecrets")}
            </Button>
          </div>
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          <p className="text-label text-muted">{t("invite.intro")}</p>
          <fieldset className="m-0 flex flex-col gap-2 border-0 p-0">
            <legend className="mb-2 text-label text-muted">{t("invite.permissions")}</legend>
            <div className="grid max-h-56 grid-cols-2 gap-x-3 gap-y-1 overflow-y-auto">
              {ALL.map((p) => {
                const by = info.needed.get(p);
                return (
                  <label
                    key={p}
                    className="flex min-w-0 items-center gap-2 text-label text-muted"
                    title={by?.join(", ")}
                  >
                    <input
                      type="checkbox"
                      className="accent-fg"
                      checked={picked.has(p)}
                      onChange={(e) => {
                        const next = new Set(picked);
                        if (e.target.checked) next.add(p);
                        else next.delete(p);
                        setPicked(next);
                      }}
                    />
                    <span className="truncate font-mono">{p}</span>
                    {by && (
                      <span className="shrink-0 text-meta text-faint">{t("invite.used")}</span>
                    )}
                  </label>
                );
              })}
            </div>
          </fieldset>
          {info.config?.devGuildId && (
            <label className="flex items-center gap-2 text-label text-muted">
              <input
                type="checkbox"
                className="accent-fg"
                checked={testServer}
                onChange={(e) => setTestServer(e.target.checked)}
              />
              {t("invite.testServer")}
            </label>
          )}
          {privileged.length > 0 && portal && (
            <p className="rounded-md bg-warn/10 px-2 py-1.5 text-label text-warn">
              {t("invite.privileged", { intents: privileged.join(", ") })}{" "}
              <button
                type="button"
                className="underline underline-offset-2 hover:text-fg"
                onClick={() => void api.app.openExternal(portal)}
              >
                {t("invite.openPortal")}
              </button>
            </p>
          )}
          <div className="flex items-center gap-1 rounded-md border border-line bg-chrome pl-2">
            <span
              className="min-w-0 flex-1 truncate font-mono text-meta text-muted"
              title={url ?? ""}
            >
              {url}
            </span>
            <Button
              variant="ghost"
              onClick={async () => {
                if (!url) return;
                await navigator.clipboard.writeText(url);
                setCopied(true);
                setTimeout(() => setCopied(false), 1500);
              }}
            >
              {copied ? (
                <Check size={14} strokeWidth={1.5} />
              ) : (
                <Copy size={14} strokeWidth={1.5} />
              )}
              {copied ? t("invite.copied") : t("invite.copy")}
            </Button>
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={close}>
              {t("common.close")}
            </Button>
            <Button
              variant="primary"
              className={cn(!url && "pointer-events-none opacity-40")}
              onClick={() => url && void api.app.openExternal(url)}
            >
              <ExternalLink size={14} strokeWidth={1.5} />
              {t("invite.open")}
            </Button>
          </div>
        </div>
      )}
    </Dialog>
  );
}
