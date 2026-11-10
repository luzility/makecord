import { app } from "electron";
import electronUpdater from "electron-updater";
import { describeError, writeLog } from "./logs";

const { autoUpdater } = electronUpdater;

const CHECK_EVERY = 6 * 60 * 60 * 1000;

export function updatesSupported(): boolean {
  if (!app.isPackaged) return false;
  if (process.platform === "win32") return true;
  if (process.platform === "linux") return Boolean(process.env.APPIMAGE);
  return false;
}

export function setupUpdates(notify: (version: string) => void) {
  if (!updatesSupported()) return;
  autoUpdater.autoDownload = true;
  autoUpdater.autoInstallOnAppQuit = true;
  autoUpdater.logger = {
    info: (m: unknown) => writeLog("updater", String(m)),
    warn: (m: unknown) => writeLog("updater", String(m)),
    error: () => {},
    debug: () => {},
  };
  autoUpdater.on("update-downloaded", (info) => notify(info.version));
  const check = () =>
    autoUpdater.checkForUpdates().catch((e: unknown) => writeLog("updater", describeError(e)));
  setTimeout(check, 15_000);
  setInterval(check, CHECK_EVERY);
}

export function installUpdate() {
  if (updatesSupported()) autoUpdater.quitAndInstall();
}
