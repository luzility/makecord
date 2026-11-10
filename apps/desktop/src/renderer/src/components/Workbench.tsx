import {
  type DockviewApi,
  DockviewReact,
  type DockviewReadyEvent,
  type IDockviewPanelProps,
  themeDark,
} from "dockview-react";
import { useEffect, useState } from "react";
import { EditorTab } from "@/editors/EditorTab";
import { useT } from "@/i18n";
import { api } from "@/lib/api";
import {
  defaultLayout,
  EDITOR_GROUP_ANCHOR,
  focusToolWindow,
  type LayoutSaver,
  openFile,
  openStart,
  retitle,
  setDockApi,
  setLayoutSaver,
} from "@/lib/dock";
import { useStore } from "@/lib/store";
import { sanitizeTools } from "@/lib/tools";
import { EditorPanel } from "@/panels/EditorPanel";
import { StartPanel } from "@/panels/StartPanel";
import { InviteDialog } from "./InviteDialog";
import { NewFlowDialog } from "./NewFlowDialog";
import { SearchEverywhere } from "./SearchEverywhere";
import { SecretsDialog } from "./SecretsDialog";
import { StatusBar } from "./StatusBar";
import { Toolbar } from "./Toolbar";
import { Sash, Stripe, ToolArea } from "./ToolWindows";
import { Button, Kbd } from "./ui";

const components: Record<string, React.FunctionComponent<IDockviewPanelProps>> = {
  start: StartPanel,
  editor: EditorPanel as React.FunctionComponent<IDockviewPanelProps>,
};

function EmptyEditors() {
  const { t } = useT();
  return (
    <div className="flex h-full flex-col items-center justify-center gap-4 bg-panel p-6 text-center">
      <p className="text-body text-muted">{t("editor.noneOpen")}</p>
      <div className="grid grid-cols-[auto_auto] items-center gap-x-6 gap-y-2 text-label text-faint">
        <span className="text-left">{t("toolbar.search")}</span>
        <span className="flex gap-1">
          <Kbd>Shift</Kbd>
          <Kbd>Shift</Kbd>
        </span>
        <span className="text-left">{t("project.newFlow")}</span>
        <span className="flex gap-1">
          <Kbd>Ctrl</Kbd>
          <Kbd>N</Kbd>
        </span>
        <span className="text-left">{t("panels.project")}</span>
        <span className="flex gap-1">
          <Kbd>Alt</Kbd>
          <Kbd>1</Kbd>
        </span>
      </div>
      <Button variant="ghost" onClick={openStart}>
        {t("panels.start")}
      </Button>
    </div>
  );
}

const tabComponents = { editor: EditorTab };

const theme = { ...themeDark, className: `${themeDark.className} mk-dock` };

const WORKSPACE_FILE = ".makecord/workspace.json";
const WORKSPACE_VERSION = 2;

async function restoreLayout(dock: DockviewApi): Promise<boolean> {
  try {
    const text = await api.fs.readOptional(WORKSPACE_FILE);
    if (!text) return false;
    const data = JSON.parse(text) as { version?: number; tools?: unknown; editors?: unknown };
    if (data.version !== WORKSPACE_VERSION) return false;
    useStore.getState().set({ tools: sanitizeTools(data.tools) });
    if (data.editors) {
      const editors = data.editors as { panels?: Record<string, { tabComponent?: string }> };
      for (const [id, panel] of Object.entries(editors.panels ?? {})) {
        if (id.startsWith("editor:")) panel.tabComponent = "editor";
      }
      dock.fromJSON(editors as Parameters<DockviewApi["fromJSON"]>[0]);
    }
    return true;
  } catch {
    return false;
  }
}

async function buildLayout(dock: DockviewApi): Promise<LayoutSaver> {
  if (!(await restoreLayout(dock))) {
    dock.clear();
    defaultLayout(dock);
  }

  const trackActive = () => {
    const panel = dock.activePanel;
    const path = panel?.id.startsWith("editor:") ? panel.id.slice("editor:".length) : null;
    if (path || !panel || panel.id === EDITOR_GROUP_ANCHOR)
      useStore.getState().set({ activePath: path });
  };
  trackActive();
  dock.onDidActivePanelChange(trackActive);

  let timer: ReturnType<typeof setTimeout> | undefined;
  const write = () =>
    api.fs
      .write(
        WORKSPACE_FILE,
        JSON.stringify({
          version: WORKSPACE_VERSION,
          tools: useStore.getState().tools,
          editors: dock.toJSON(),
        }),
      )
      .catch(() => {});
  const schedule = () => {
    clearTimeout(timer);
    timer = setTimeout(() => {
      timer = undefined;
      void write();
    }, 1000);
  };
  dock.onDidLayoutChange(schedule);
  const offTools = useStore.subscribe((s, prev) => {
    if (s.tools !== prev.tools) schedule();
  });
  const saver: LayoutSaver = {
    async flush() {
      if (timer === undefined) return;
      clearTimeout(timer);
      timer = undefined;
      await write();
    },
    cancel() {
      clearTimeout(timer);
      timer = undefined;
      offTools();
    },
  };
  return saver;
}

export function Workbench() {
  const [dock, setDock] = useState<{ api: DockviewApi; saver: LayoutSaver } | null>(null);
  const secretsOpen = useStore((s) => s.secretsOpen);
  const inviteOpen = useStore((s) => s.inviteOpen);
  const searchOpen = useStore((s) => s.searchOpen);
  const newFlowOpen = useStore((s) => s.newFlowOpen);
  const left = useStore((s) => s.tools.left.open);
  const right = useStore((s) => s.tools.right.open);
  const bottom = useStore((s) => s.tools.bottom.open);

  useEffect(() => {
    const { onDiskChange, pushRuntime } = useStore.getState();
    const offFs = api.fs.onChange((paths) => void onDiskChange(paths));
    const offRt = api.runtime.onMessage(pushRuntime);
    const offCatalog = api.plugins.onCatalogChange(() => {
      const { refreshCatalog, refreshProblems } = useStore.getState();
      void refreshCatalog();
      void refreshProblems();
    });
    const offStatus = useStore.subscribe((s, prev) => {
      if (s.status === "starting" && prev.status !== "starting" && s.settings.openRunOnStart) {
        focusToolWindow("run");
      }
      const run = s.paused.find((p) => p.runId === s.activeRun);
      const before = prev.paused.find((p) => p.runId === prev.activeRun);
      if (run && (run.runId !== before?.runId || run.nodeId !== before?.nodeId)) {
        focusToolWindow("debug");
        void openFile(run.flow, run.nodeId);
      }
    });

    let lastShift = 0;
    const onKey = (e: KeyboardEvent) => {
      const set = useStore.getState().set;
      if (e.key !== "Shift") {
        lastShift = 0;
        return;
      }
      if (e.repeat) return;
      const now = Date.now();
      if (now - lastShift < 350) {
        lastShift = 0;
        set({ searchOpen: true });
      } else {
        lastShift = now;
      }
    };
    window.addEventListener("keydown", onKey);
    return () => {
      offFs();
      offRt();
      offCatalog();
      offStatus();
      window.removeEventListener("keydown", onKey);
    };
  }, []);

  useEffect(() => {
    if (!dock) return;
    setDockApi(dock.api);
    setLayoutSaver(dock.saver);
    retitle(dock.api);
    const offLocale = useStore.subscribe((s, prev) => {
      if (s.locale !== prev.locale) retitle(dock.api);
    });
    return () => {
      offLocale();
      dock.saver.cancel();
      setLayoutSaver(null);
      setDockApi(null);
    };
  }, [dock]);

  return (
    <div className="flex h-full flex-col">
      <Toolbar />
      <div className="flex min-h-0 flex-1">
        <Stripe side="left" />
        {left && (
          <>
            <ToolArea area="left" />
            <Sash area="left" />
          </>
        )}
        <div className="flex min-w-[320px] flex-1 flex-col">
          <div className="min-h-0 flex-1">
            <DockviewReact
              components={components}
              tabComponents={tabComponents}
              watermarkComponent={EmptyEditors}
              onReady={({ api: dockApi }: DockviewReadyEvent) => {
                void buildLayout(dockApi).then((saver) => setDock({ api: dockApi, saver }));
              }}
              theme={theme}
            />
          </div>
          {bottom && (
            <>
              <Sash area="bottom" />
              <ToolArea area="bottom" />
            </>
          )}
        </div>
        {right && (
          <>
            <Sash area="right" />
            <ToolArea area="right" />
          </>
        )}
        <Stripe side="right" />
      </div>
      <StatusBar />
      {secretsOpen && <SecretsDialog />}
      {inviteOpen && <InviteDialog />}
      {searchOpen && <SearchEverywhere />}
      {newFlowOpen && <NewFlowDialog />}
    </div>
  );
}
