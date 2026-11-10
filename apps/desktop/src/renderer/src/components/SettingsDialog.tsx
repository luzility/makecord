import { IntentName, PRIVILEGED_INTENTS, PROJECT_FILE, ProjectConfig } from "@makecord/spec";
import { AlertTriangle, CircleAlert, ExternalLink, FolderOpen, Search } from "lucide-react";
import { type ReactNode, useCallback, useEffect, useRef, useState } from "react";
import { useT } from "@/i18n";
import { actions } from "@/lib/actions";
import { api, type MarketplacePlugin } from "@/lib/api";
import { UI_FONTS } from "@/lib/fonts";
import { keysOf } from "@/lib/shortcuts";
import { cleanError, type SettingsPage, useStore } from "@/lib/store";
import { toJson } from "@/lib/templates";
import { LanguageSwitch } from "./LanguageSwitch";
import { Button, cn, Dialog, Field, Input, Kbd } from "./ui";

const DOCS_PLUGINS = "https://makecord.luzili.tech/docs/writing-plugins/";

const PRIVILEGED = new Set<string>(PRIVILEGED_INTENTS);

function Section({ title, hint, children }: { title: string; hint?: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-3">
      <div>
        <h3 className="text-title font-medium">{title}</h3>
        {hint && <p className="mt-1 text-label text-muted">{hint}</p>}
      </div>
      {children}
    </section>
  );
}

function Toggle({
  label,
  hint,
  checked,
  onChange,
}: {
  label: string;
  hint?: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <label className="flex items-start gap-3">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="mt-0.5 accent-fg"
      />
      <span className="flex flex-col">
        <span className="text-body">{label}</span>
        {hint && <span className="text-label text-faint">{hint}</span>}
      </span>
    </label>
  );
}

function AppearancePage() {
  const { t } = useT();
  const uiFont = useStore((s) => s.settings.uiFont);
  const update = useStore((s) => s.updateSettings);
  return (
    <div className="flex flex-col gap-8">
      <Section title={t("settings.appearance")}>
        <Field label={t("welcome.language")}>
          <div className="w-fit">
            <LanguageSwitch />
          </div>
        </Field>
      </Section>
      <Section title={t("settings.uiFont")} hint={t("settings.uiFontHint")}>
        <fieldset
          aria-label={t("settings.uiFont")}
          className="m-0 grid min-w-0 grid-cols-3 gap-2 border-0 p-0"
        >
          {UI_FONTS.map((f) => (
            <button
              key={f.id}
              type="button"
              aria-pressed={uiFont === f.id}
              onClick={() => void update({ uiFont: f.id })}
              style={{ fontFamily: `"${f.family}", sans-serif` }}
              className={cn(
                "flex flex-col items-start gap-1 rounded-lg border p-3 text-left transition-colors duration-150 ease-out",
                uiFont === f.id ? "border-fg/40 bg-hover" : "border-line hover:bg-hover",
              )}
            >
              <span className="text-title font-medium text-fg">
                {f.family.replace(" Variable", "")}
              </span>
              <span className="text-label text-muted">Değişken Ata, Reply</span>
              <span className="font-sans text-meta text-faint">{f.style}</span>
            </button>
          ))}
        </fieldset>
      </Section>
    </div>
  );
}

function EditorPage() {
  const { t } = useT();
  const settings = useStore((s) => s.settings);
  const update = useStore((s) => s.updateSettings);
  return (
    <Section title={t("settings.editor")}>
      <Toggle
        label={t("settings.autoSave")}
        hint={t(settings.autoSave ? "settings.autoSaveOnHint" : "settings.autoSaveOffHint")}
        checked={settings.autoSave}
        onChange={(v) => void update({ autoSave: v })}
      />
      <Toggle
        label={t("settings.snapToGrid")}
        hint={t("settings.snapToGridHint")}
        checked={settings.snapToGrid}
        onChange={(v) => void update({ snapToGrid: v })}
      />
    </Section>
  );
}

function RunPage() {
  const { t } = useT();
  const settings = useStore((s) => s.settings);
  const update = useStore((s) => s.updateSettings);
  const [memory, setMemory] = useState(String(settings.botMemoryMB));
  return (
    <Section title={t("settings.run")}>
      <Toggle
        label={t("settings.openRunOnStart")}
        checked={settings.openRunOnStart}
        onChange={(v) => void update({ openRunOnStart: v })}
      />
      <Field label={t("settings.botMemory")} hint={t("settings.botMemoryHint")}>
        <div className="flex items-center gap-2">
          <Input
            type="number"
            min={128}
            max={4096}
            step={64}
            value={memory}
            onChange={(e) => setMemory(e.target.value)}
            onBlur={() => {
              const n = Number(memory);
              if (Number.isFinite(n) && n > 0) void update({ botMemoryMB: n });
              else setMemory(String(settings.botMemoryMB));
            }}
            className="w-28 font-mono tabular-nums"
          />
          <span className="text-label text-faint">MB</span>
        </div>
      </Field>
    </Section>
  );
}

function KeymapPage() {
  const { t } = useT();
  const rows = actions.filter((a) => a.shortcuts?.length);
  return (
    <Section title={t("settings.keymap")} hint={t("settings.keymapHint")}>
      <ul className="flex flex-col">
        {rows.map((a) => (
          <li
            key={a.id}
            className="flex h-8 items-center justify-between border-b border-line text-body last:border-0"
          >
            <span className="text-muted">{t(a.label)}</span>
            <span className="flex gap-3">
              {a.shortcuts?.map((sc) => (
                <span key={sc} className="flex gap-1">
                  {keysOf(sc).map((k) => (
                    <Kbd key={k}>{k}</Kbd>
                  ))}
                </span>
              ))}
            </span>
          </li>
        ))}
      </ul>
    </Section>
  );
}

function ProjectPage() {
  const { t } = useT();
  const [config, setConfig] = useState<ProjectConfig | null>(null);
  const [error, setError] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);

  useEffect(() => {
    api.fs
      .read(PROJECT_FILE)
      .then((text) => setConfig(ProjectConfig.parse(JSON.parse(text))))
      .catch((e) => setError(cleanError(e)));
    return () => clearTimeout(timer.current);
  }, []);

  const change = (patch: Partial<ProjectConfig>) => {
    if (!config) return;
    const next = { ...config, ...patch };
    setConfig(next);
    const check = ProjectConfig.safeParse(next);
    if (!check.success) {
      const issue = check.error.issues[0];
      setError(issue ? `${issue.path.join(".")}: ${issue.message}` : "Invalid");
      clearTimeout(timer.current);
      return;
    }
    setError(null);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      api.fs.write(PROJECT_FILE, toJson(check.data)).catch((e) => setError(cleanError(e)));
    }, 400);
  };

  if (!config) return error ? <p className="text-label text-bad">{error}</p> : null;

  const cacheFields = [
    "messages",
    "members",
    "presences",
    "reactions",
    "sweepIntervalSeconds",
  ] as const;
  return (
    <div className="flex flex-col gap-8">
      <Section title={t("settings.project")} hint={t("settings.projectHint")}>
        {error && (
          <p className="rounded-md bg-warn/10 px-2 py-1 text-label text-warn">
            {t("properties.notSaved", { issue: error })}
          </p>
        )}
        <Field label={t("newProject.botName")}>
          <Input value={config.name} onChange={(e) => change({ name: e.target.value })} />
        </Field>
        <Field label={t("settings.devGuild")} hint={t("settings.devGuildHint")}>
          <Input
            value={config.devGuildId ?? ""}
            placeholder="123456789012345678"
            onChange={(e) => change({ devGuildId: e.target.value.trim() || undefined })}
            className="font-mono"
          />
        </Field>
      </Section>
      <Section title={t("settings.intents")} hint={t("settings.intentsHint")}>
        <div className="grid grid-cols-2 gap-x-6 gap-y-2">
          {IntentName.options.map((intent) => (
            <label key={intent} className="flex items-center gap-2 text-body">
              <input
                type="checkbox"
                className="accent-fg"
                checked={config.intents.includes(intent)}
                onChange={(e) =>
                  change({
                    intents: e.target.checked
                      ? [...config.intents, intent]
                      : config.intents.filter((i) => i !== intent),
                  })
                }
              />
              <span className="font-mono text-label">{intent}</span>
              {PRIVILEGED.has(intent) && (
                <span className="text-meta text-faint">{t("settings.privileged")}</span>
              )}
            </label>
          ))}
        </div>
      </Section>
      <Section title={t("settings.cache")} hint={t("settings.cacheHint")}>
        <div className="grid grid-cols-2 gap-4">
          {cacheFields.map((key) => (
            <Field key={key} label={t(`settings.cacheFields.${key}`)}>
              <Input
                type="number"
                min={0}
                value={config.cache[key]}
                onChange={(e) =>
                  change({ cache: { ...config.cache, [key]: Number(e.target.value) } })
                }
                className="font-mono tabular-nums"
              />
            </Field>
          ))}
        </div>
      </Section>
    </div>
  );
}

function PluginsPage() {
  const { t, tn } = useT();
  const catalog = useStore((s) => s.catalog);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<MarketplacePlugin[] | null>(null);
  const [searching, setSearching] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const installed = (catalog?.plugins ?? []).filter((p) => p.name !== "core");
  const installedNames = new Set(installed.map((p) => p.name));

  const search = useCallback(async (q: string) => {
    setSearching(true);
    setError(null);
    try {
      setResults(await api.plugins.search(q));
    } catch (e) {
      setError(cleanError(e));
      setResults([]);
    } finally {
      setSearching(false);
    }
  }, []);

  useEffect(() => {
    void search("");
  }, [search]);

  const run = async (label: string, fn: () => Promise<unknown>) => {
    setBusy(label);
    setError(null);
    try {
      await fn();
    } catch (e) {
      setError(cleanError(e));
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="flex flex-col gap-8">
      <Section title={t("plugins.installed")} hint={t("plugins.installedHint")}>
        {installed.length === 0 && (
          <p className="text-label text-faint">{t("plugins.noneInstalled")}</p>
        )}
        <ul className="flex flex-col gap-2">
          {installed.map((p) => (
            <li key={p.name} className="flex items-start gap-3 rounded-lg border border-line p-3">
              <div className="min-w-0 flex-1">
                <div className="flex items-baseline gap-2">
                  <span className="truncate font-mono text-body">{p.name}</span>
                  {p.version && <span className="font-mono text-meta text-faint">{p.version}</span>}
                </div>
                {p.loaded ? (
                  <p className="text-label text-muted">{tn("plugins.blocks", p.nodeCount)}</p>
                ) : (
                  <p className="flex gap-1 text-label text-bad">
                    <CircleAlert size={16} strokeWidth={1.5} className="shrink-0" /> {p.error}
                  </p>
                )}
                {p.loaded && !p.compatible && (
                  <p className="flex gap-1 text-label text-warn">
                    <AlertTriangle size={16} strokeWidth={1.5} className="shrink-0" />
                    {t("plugins.incompatible", {
                      engines: p.engines ?? "",
                      runtime: catalog?.runtimeVersion ?? "",
                    })}
                  </p>
                )}
              </div>
              <Button
                variant="ghost"
                disabled={!!busy}
                onClick={() => run(p.name, () => api.plugins.uninstall(p.name))}
              >
                {busy === p.name ? t("plugins.working") : t("plugins.uninstall")}
              </Button>
            </li>
          ))}
        </ul>
        <div>
          <Button
            disabled={!!busy}
            onClick={() => run("folder", () => api.plugins.installFromFolder())}
          >
            <FolderOpen size={16} strokeWidth={1.5} />
            {busy === "folder" ? t("plugins.working") : t("plugins.fromFolder")}
          </Button>
        </div>
      </Section>

      <Section title={t("plugins.marketplace")} hint={t("plugins.marketplaceHint")}>
        <form
          className="flex gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            void search(query);
          }}
        >
          <div className="relative flex-1">
            <Search
              size={16}
              strokeWidth={1.5}
              className="pointer-events-none absolute top-1.5 left-2 text-faint"
            />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={t("plugins.search")}
              className="pl-8"
            />
          </div>
          <Button type="submit" disabled={searching}>
            {t("plugins.searchButton")}
          </Button>
        </form>
        {error && (
          <p className="rounded-md bg-bad/10 px-2 py-1 text-label whitespace-pre-wrap text-bad">
            {error}
          </p>
        )}
        {results && results.length === 0 && !searching && (
          <div className="rounded-lg border border-dashed border-line p-4 text-label text-muted">
            <p>{query ? t("plugins.noResults") : t("plugins.emptyMarketplace")}</p>
            <button
              type="button"
              onClick={() => void api.app.openExternal(DOCS_PLUGINS)}
              className="mt-2 inline-flex items-center gap-1 text-fg underline-offset-4 hover:underline"
            >
              {t("plugins.writeOne")} <ExternalLink size={12} strokeWidth={1.5} />
            </button>
          </div>
        )}
        <ul className="flex flex-col gap-2">
          {results?.map((p) => (
            <li key={p.name} className="flex items-start gap-3 rounded-lg border border-line p-3">
              <div className="min-w-0 flex-1">
                <div className="flex items-baseline gap-2">
                  <button
                    type="button"
                    onClick={() => void api.app.openExternal(p.url)}
                    className="truncate font-mono text-body hover:underline"
                  >
                    {p.name}
                  </button>
                  <span className="font-mono text-meta text-faint">{p.version}</span>
                </div>
                {p.description && <p className="text-label text-muted">{p.description}</p>}
              </div>
              <Button
                disabled={!!busy || installedNames.has(p.name)}
                onClick={() => run(p.name, () => api.plugins.install(p.name))}
              >
                {installedNames.has(p.name)
                  ? t("plugins.isInstalled")
                  : busy === p.name
                    ? t("plugins.working")
                    : t("plugins.install")}
              </Button>
            </li>
          ))}
        </ul>
      </Section>
    </div>
  );
}

const PAGES: { id: SettingsPage; group: "ide" | "project" }[] = [
  { id: "appearance", group: "ide" },
  { id: "editor", group: "ide" },
  { id: "run", group: "ide" },
  { id: "keymap", group: "ide" },
  { id: "project", group: "project" },
  { id: "plugins", group: "project" },
];

export function SettingsDialog() {
  const { t } = useT();
  const page = useStore((s) => s.settingsPage);
  const hasProject = useStore((s) => !!s.project);
  const set = useStore((s) => s.set);
  const close = useCallback(() => set({ settingsPage: null }), [set]);
  if (!page) return null;
  const current =
    !hasProject && PAGES.find((p) => p.id === page)?.group === "project" ? "appearance" : page;

  const nav = (group: "ide" | "project") =>
    PAGES.filter((p) => p.group === group).map((p) => (
      <button
        key={p.id}
        type="button"
        aria-current={current === p.id}
        onClick={() => set({ settingsPage: p.id })}
        className={cn(
          "flex h-7 w-full items-center rounded-md px-2 text-left text-body transition-colors duration-150 ease-out",
          current === p.id ? "bg-hover text-fg" : "text-muted hover:bg-hover hover:text-fg",
        )}
      >
        {t(`settings.pages.${p.id}`)}
      </button>
    ));

  return (
    <Dialog title={t("settings.title")} onClose={close} width={860}>
      <div className="-m-4 flex h-[560px] max-h-[70vh]">
        <nav className="flex w-52 shrink-0 flex-col gap-0.5 border-r border-line p-2">
          <span className="px-2 pt-1 pb-1 text-meta text-faint">{t("settings.groupIde")}</span>
          {nav("ide")}
          {hasProject && (
            <>
              <span className="mt-4 px-2 pb-1 text-meta text-faint">
                {t("settings.groupProject")}
              </span>
              {nav("project")}
            </>
          )}
        </nav>
        <div className="flex-1 overflow-y-auto p-6">
          {current === "appearance" && <AppearancePage />}
          {current === "editor" && <EditorPage />}
          {current === "run" && <RunPage />}
          {current === "keymap" && <KeymapPage />}
          {current === "project" && <ProjectPage />}
          {current === "plugins" && <PluginsPage />}
        </div>
      </div>
    </Dialog>
  );
}
