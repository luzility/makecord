import {
  type DockviewApi,
  DockviewDefaultTab,
  DockviewReact,
  type DockviewReadyEvent,
  type IDockviewPanelHeaderProps,
  type IDockviewPanelProps,
  themeDark,
} from "dockview-react";
import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import {
  defaultLayout,
  EDITOR_GROUP_ANCHOR,
  ensureToolWindows,
  focusToolWindow,
  type LayoutSaver,
  openFile,
  retitle,
  setDockApi,
  setLayoutSaver,
} from "@/lib/dock";
import { useStore } from "@/lib/store";
import { DebugPanel } from "@/panels/DebugPanel";
import { EditorPanel } from "@/panels/EditorPanel";
import { EventsPanel } from "@/panels/EventsPanel";
import { ProblemsPanel } from "@/panels/ProblemsPanel";
import { ProjectPanel } from "@/panels/ProjectPanel";
import { PropertiesPanel } from "@/panels/PropertiesPanel";
import { RunPanel } from "@/panels/RunPanel";
import { StartPanel } from "@/panels/StartPanel";
import { InviteDialog } from "./InviteDialog";
import { NewFlowDialog } from "./NewFlowDialog";
import { SearchEverywhere } from "./SearchEverywhere";
import { SecretsDialog } from "./SecretsDialog";
import { StatusBar } from "./StatusBar";
import { Toolbar } from "./Toolbar";

const components: Record<string, React.FunctionComponent<IDockviewPanelProps>> = {
  project: ProjectPanel,
  properties: PropertiesPanel,
  run: RunPanel,
  problems: ProblemsPanel,
  debug: DebugPanel,
  events: EventsPanel,
  start: StartPanel,
  editor: EditorPanel as React.FunctionComponent<IDockviewPanelProps>,
};

const tabComponents = {
  tool: (props: IDockviewPanelHeaderProps) => <DockviewDefaultTab {...props} hideClose />,
};

const theme = { ...themeDark, className: `${themeDark.className} mk-dock` };

const WORKSPACE_FILE = ".makecord/workspace.json";

async function restoreLayout(dock: DockviewApi): Promise<boolean> {
  try {
    const text = await api.fs.readOptional(WORKSPACE_FILE);
    if (!text) return false;
    dock.fromJSON(JSON.parse(text));
    const ok = ["project", "properties", "run", "problems"].every((id) => dock.getPanel(id));
    if (ok) ensureToolWindows(dock);
    return ok;
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
    if (path || panel?.id === EDITOR_GROUP_ANCHOR) useStore.getState().set({ activePath: path });
  };
  trackActive();
  dock.onDidActivePanelChange(trackActive);

  let timer: ReturnType<typeof setTimeout> | undefined;
  const write = () => api.fs.write(WORKSPACE_FILE, JSON.stringify(dock.toJSON())).catch(() => {});
  dock.onDidLayoutChange(() => {
    clearTimeout(timer);
    timer = setTimeout(() => {
      timer = undefined;
      void write();
    }, 1000);
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
      <div className="min-h-0 flex-1">
        <DockviewReact
          components={components}
          tabComponents={tabComponents}
          onReady={({ api: dockApi }: DockviewReadyEvent) => {
            void buildLayout(dockApi).then((saver) => setDock({ api: dockApi, saver }));
          }}
          theme={theme}
        />
      </div>
      <StatusBar />
      {secretsOpen && <SecretsDialog />}
      {inviteOpen && <InviteDialog />}
      {searchOpen && <SearchEverywhere />}
      {newFlowOpen && <NewFlowDialog />}
    </div>
  );
}
