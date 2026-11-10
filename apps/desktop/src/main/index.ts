import { readFile } from "node:fs/promises";
import { isAbsolute, join } from "node:path";
import { coreNodeMetas } from "@makecord/plugin-core/meta";
import { describeNode } from "@makecord/runtime/describe";
import { botIdFromToken, PROJECT_FILE, ProjectConfig } from "@makecord/spec";
import {
  app,
  BrowserWindow,
  dialog,
  type IpcMainInvokeEvent,
  ipcMain,
  Menu,
  type ProcessMetric,
  shell,
} from "electron";
import type { Catalog, Metrics, Settings } from "../shared/api";
import {
  getCatalog,
  inspectWithService,
  openLanguageService,
  stopLanguageService,
} from "./language-client";
import { installCrashLogging, logsDir, writeLog } from "./logs";
import { installPlugin, searchMarketplace, uninstallPlugin } from "./plugin-manager";
import { readSettings, writeSettings } from "./settings";
import { installUpdate, setupUpdates } from "./updater";

const RUNTIME_VERSION_FALLBACK = "0.1.0";

import type { HostMessage } from "@makecord/runtime/protocol";
import {
  closeProject,
  createProject,
  createProjectFolder,
  currentProject,
  functions,
  inspect,
  openProject,
  projectPath,
  readTree,
  removeProjectFile,
  renameProjectFile,
  requireProject,
  writeProjectFile,
} from "./project";
import { botPid, sendToBot, startBot, stopBot } from "./runtime-host";
import {
  decryptSecrets,
  listSecretNames,
  removeSecret,
  secretsBackend,
  setSecret,
} from "./secrets";
import { appState } from "./state";

let win: BrowserWindow | null = null;
let readyToClose: () => void = () => {};
let holdClose: () => void = () => {};
let cancelClose: () => void = () => {};

async function processKB(m: ProcessMetric): Promise<number> {
  if (process.platform === "linux") {
    try {
      const kb = Number(
        /^Pss:\s+(\d+)/m.exec(await readFile(`/proc/${m.pid}/smaps_rollup`, "utf8"))?.[1],
      );
      if (kb) return kb;
    } catch {}
  }
  return m.memory.privateBytes ?? m.memory.workingSetSize;
}

export const TITLEBAR = { color: "#0f0f10", symbolColor: "#a1a1a6", height: 40 };
const isMac = process.platform === "darwin";

function createWindow() {
  win = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 960,
    minHeight: 600,
    show: false,
    backgroundColor: TITLEBAR.color,
    title: "Makecord",
    icon: join(import.meta.dirname, "../../resources/icon.png"),
    autoHideMenuBar: true,
    ...(isMac
      ? { titleBarStyle: "hiddenInset" as const, trafficLightPosition: { x: 14, y: 13 } }
      : { titleBarStyle: "hidden" as const, titleBarOverlay: TITLEBAR }),
    webPreferences: {
      preload: join(import.meta.dirname, "../preload/index.cjs"),
      contextIsolation: true,
      sandbox: true,
      nodeIntegration: false,
      spellcheck: false,
    },
  });
  win.once("ready-to-show", () => win?.show());

  let closeReady = false;
  const current = win;
  let fallback: ReturnType<typeof setTimeout> | undefined;
  let closing = false;
  current.on("close", (e) => {
    if (closeReady) return;
    e.preventDefault();
    if (closing) return;
    closing = true;
    current.webContents.send("app:beforeClose");
    fallback = setTimeout(() => {
      closeReady = true;
      if (!current.isDestroyed()) current.close();
    }, 2000);
  });
  holdClose = () => clearTimeout(fallback);
  cancelClose = () => {
    clearTimeout(fallback);
    closing = false;
    quitRequested = false;
  };
  readyToClose = () => {
    closeReady = true;
    if (!current.isDestroyed()) current.close();
    if (quitRequested) app.quit();
  };
  current.on("closed", () => {
    if (win === current) win = null;
  });

  current.webContents.on("render-process-gone", async (_e, details) => {
    writeLog("renderer", `Window process gone: ${details.reason} (exit ${details.exitCode})`);
    if (details.reason === "clean-exit" || current.isDestroyed()) return;
    const { response } = await dialog.showMessageBox(current, {
      type: "error",
      title: "Makecord",
      message: "Makecord's window stopped working",
      detail:
        "Your files were saved as you worked, so reloading picks up where you left off. The details are in the log folder.",
      buttons: ["Reload", "Quit"],
      defaultId: 0,
      cancelId: 1,
    });
    if (current.isDestroyed()) return;
    if (response === 0) current.reload();
    else app.quit();
  });

  win.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https?:\/\//.test(url)) void shell.openExternal(url);
    return { action: "deny" };
  });
  win.webContents.on("will-navigate", (e, url) => {
    if (url !== win?.webContents.getURL()) e.preventDefault();
  });

  if (process.env.ELECTRON_RENDERER_URL) void win.loadURL(process.env.ELECTRON_RENDERER_URL);
  else void win.loadFile(join(import.meta.dirname, "../renderer/index.html"));
}

const send = (channel: string, payload: unknown) => {
  if (win && !win.isDestroyed()) win.webContents.send(channel, payload);
};

function handle<A extends unknown[], R>(channel: string, fn: (...args: A) => R | Promise<R>) {
  ipcMain.handle(channel, (event: IpcMainInvokeEvent, ...args: unknown[]) => {
    if (event.sender !== win?.webContents) throw new Error("Unknown sender");
    return fn(...(args as A));
  });
}

let servicePlugins = "";

async function readPluginList(root: string): Promise<string> {
  try {
    const raw = JSON.parse(await readFile(join(root, PROJECT_FILE), "utf8"));
    return JSON.stringify(ProjectConfig.parse(raw).plugins);
  } catch {
    return servicePlugins;
  }
}

async function reloadPlugins(root: string) {
  servicePlugins = await readPluginList(root);
  await openLanguageService(root).catch(() => {});
  send("catalog:changed", null);
}

async function open(root: string) {
  await stopBot();
  const info = await openProject(root, (paths) => {
    send("fs:changed", paths);
    if (paths.includes(PROJECT_FILE)) {
      void readPluginList(root).then((list) => {
        if (list !== servicePlugins) void reloadPlugins(root);
      });
    }
  });
  servicePlugins = await readPluginList(root);
  void openLanguageService(root).then(
    () => send("catalog:changed", null),
    () => {},
  );
  return info;
}

async function packageNameOf(spec: string): Promise<string> {
  if (isAbsolute(spec)) {
    const text = await readFile(join(spec, "package.json"), "utf8").catch(() => {
      throw new Error("That folder has no package.json, so it isn't an npm package");
    });
    const name = JSON.parse(text).name;
    if (typeof name !== "string" || !name) throw new Error("The plugin's package.json has no name");
    return name;
  }
  return spec.replace(/(?!^)@[^/]*$/, "");
}

const localCatalog = (): Catalog => ({
  runtimeVersion: RUNTIME_VERSION_FALLBACK,
  nodes: coreNodeMetas.map((m) => describeNode(m, "core")),
  plugins: [],
});

function registerIpc() {
  handle("project:current", () => currentProject());
  handle("project:recent", async () => (await appState.read()).recent);
  handle("project:open", async (root?: string) => {
    let dir = root;
    if (!dir) {
      const res = await dialog.showOpenDialog(win!, {
        title: "Open a Makecord project",
        properties: ["openDirectory"],
      });
      if (res.canceled || !res.filePaths[0]) return null;
      dir = res.filePaths[0];
    }
    return open(dir);
  });
  handle("project:chooseDirectory", async () => {
    const res = await dialog.showOpenDialog(win!, {
      title: "Choose a location",
      properties: ["openDirectory", "createDirectory"],
    });
    return res.canceled ? null : (res.filePaths[0] ?? null);
  });
  handle("project:create", async (parent: string, name: string) =>
    open(await createProject(parent, name)),
  );
  handle("project:close", async () => {
    await stopBot();
    stopLanguageService();
    closeProject();
  });
  handle("project:tree", () => readTree());
  handle("project:inspect", () => inspectWithService().catch(() => inspect()));
  handle("project:functions", () => functions());
  handle("project:catalog", () => getCatalog().catch(() => localCatalog()));
  handle("project:botId", async () => {
    const token = (await decryptSecrets(requireProject().root)).DISCORD_TOKEN;
    return token ? botIdFromToken(token) : null;
  });

  handle("plugins:search", (query: string) => searchMarketplace(String(query ?? "")));
  handle("plugins:install", async (spec: string) => {
    const { root } = requireProject();
    const installed = await installPlugin(root, String(spec), await packageNameOf(String(spec)));
    await reloadPlugins(root);
    return installed;
  });
  handle("plugins:installFromFolder", async () => {
    const { root } = requireProject();
    const res = await dialog.showOpenDialog(win!, {
      title: "Plugin folder",
      properties: ["openDirectory"],
    });
    const dir = res.filePaths[0];
    if (res.canceled || !dir) return null;
    const installed = await installPlugin(root, dir, await packageNameOf(dir));
    await reloadPlugins(root);
    return installed;
  });
  handle("plugins:uninstall", async (name: string) => {
    const { root } = requireProject();
    await uninstallPlugin(root, String(name));
    await reloadPlugins(root);
  });

  handle("settings:get", () => readSettings());
  handle("settings:set", (patch: Partial<Settings>) => writeSettings(patch));

  handle("fs:read", (rel: string) => readFile(projectPath(rel), "utf8"));
  handle("fs:readOptional", (rel: string) =>
    readFile(projectPath(rel), "utf8").catch((e: NodeJS.ErrnoException) => {
      if (e.code === "ENOENT") return null;
      throw e;
    }),
  );
  handle("fs:write", (rel: string, content: string) => writeProjectFile(rel, content));
  handle("fs:create", (rel: string, content: string) =>
    writeProjectFile(rel, content, { create: true }),
  );
  handle("fs:remove", (rel: string) => removeProjectFile(rel));
  handle("fs:rename", (from: string, to: string) => renameProjectFile(from, to));
  handle("fs:mkdir", (rel: string) => createProjectFolder(rel));

  handle("secrets:list", async () => {
    const { root } = requireProject();
    const stored = new Set(await listSecretNames(root));
    let declared: string[] = ["DISCORD_TOKEN"];
    try {
      declared = ProjectConfig.parse(
        JSON.parse(await readFile(projectPath(PROJECT_FILE), "utf8")),
      ).secrets;
    } catch {}
    const names = [...new Set([...declared, ...stored])];
    return names.map((name) => ({ name, isSet: stored.has(name) }));
  });
  handle("secrets:set", (name: string, value: string) =>
    setSecret(requireProject().root, name, value),
  );
  handle("secrets:remove", (name: string) => removeSecret(requireProject().root, name));
  handle("secrets:backend", () => secretsBackend());

  handle("runtime:start", () =>
    startBot(requireProject().root, (msg) => send("runtime:message", msg)),
  );
  handle("runtime:stop", () => stopBot());
  handle("runtime:debug", (msg: HostMessage) => sendToBot(msg));

  handle("app:metrics", async (): Promise<Metrics> => {
    const pid = botPid();
    let ide = 0;
    let bot: number | null = null;
    for (const m of app.getAppMetrics()) {
      const kb = await processKB(m);
      if (pid && m.pid === pid) bot = kb;
      else ide += kb;
    }
    return { ideMB: Math.round(ide / 1024), botMB: bot === null ? null : Math.round(bot / 1024) };
  });
  handle("app:closeReady", () => readyToClose());
  handle("app:logError", (text: string) => writeLog("renderer", String(text).slice(0, 20_000)));
  handle("app:openLogs", async () => {
    await shell.openPath(logsDir());
  });
  handle("app:version", () => app.getVersion());
  handle("app:installUpdate", () => installUpdate());
  handle("app:closeHold", () => holdClose());
  handle("app:closeCancel", () => cancelClose());
  handle("app:quit", () => app.quit());
  handle("app:openExternal", async (url: string) => {
    if (/^https:\/\//.test(url)) await shell.openExternal(url);
  });
}

function setupAppMenu() {
  if (process.platform !== "darwin") {
    Menu.setApplicationMenu(null);
    return;
  }
  Menu.setApplicationMenu(
    Menu.buildFromTemplate([
      { role: "appMenu" },
      {
        label: "Edit",
        submenu: [{ role: "cut" }, { role: "copy" }, { role: "paste" }, { role: "selectAll" }],
      },
      { role: "windowMenu" },
    ]),
  );
}

installCrashLogging();

app.whenReady().then(() => {
  let readyVersion: string | null = null;
  setupUpdates((version) => {
    readyVersion = version;
    if (win && !win.isDestroyed()) win.webContents.send("app:updateReady", version);
  });
  ipcMain.handle("app:pendingUpdate", () => readyVersion);
  setupAppMenu();
  registerIpc();
  createWindow();
  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

let quitting = false;
let quitRequested = false;
app.on("before-quit", (e) => {
  quitRequested = true;
  if (quitting || !botPid()) return;
  e.preventDefault();
  quitting = true;
  void stopBot().finally(() => app.quit());
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});
