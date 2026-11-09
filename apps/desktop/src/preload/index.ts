import { contextBridge, type IpcRendererEvent, ipcRenderer } from "electron";
import type { MakecordApi } from "../shared/api";

const invoke =
  (channel: string) =>
  (...args: unknown[]) =>
    ipcRenderer.invoke(channel, ...args);

function subscribe<T>(channel: string) {
  return (cb: (payload: T) => void) => {
    const listener = (_e: IpcRendererEvent, payload: T) => cb(payload);
    ipcRenderer.on(channel, listener);
    return () => ipcRenderer.removeListener(channel, listener);
  };
}

const api: MakecordApi = {
  platform: process.platform,
  project: {
    current: invoke("project:current"),
    recent: invoke("project:recent"),
    open: invoke("project:open"),
    chooseDirectory: invoke("project:chooseDirectory"),
    create: invoke("project:create"),
    close: invoke("project:close"),
    tree: invoke("project:tree"),
    inspect: invoke("project:inspect"),
    catalog: invoke("project:catalog"),
    botId: invoke("project:botId"),
  } as MakecordApi["project"],
  plugins: {
    search: invoke("plugins:search"),
    install: invoke("plugins:install"),
    installFromFolder: invoke("plugins:installFromFolder"),
    uninstall: invoke("plugins:uninstall"),
    onCatalogChange: subscribe("catalog:changed"),
  } as MakecordApi["plugins"],
  settings: {
    get: invoke("settings:get"),
    set: invoke("settings:set"),
  } as MakecordApi["settings"],
  fs: {
    read: invoke("fs:read"),
    readOptional: invoke("fs:readOptional"),
    write: invoke("fs:write"),
    create: invoke("fs:create"),
    remove: invoke("fs:remove"),
    rename: invoke("fs:rename"),
    mkdir: invoke("fs:mkdir"),
    onChange: subscribe("fs:changed"),
  } as MakecordApi["fs"],
  secrets: {
    list: invoke("secrets:list"),
    set: invoke("secrets:set"),
    remove: invoke("secrets:remove"),
    backend: invoke("secrets:backend"),
  } as MakecordApi["secrets"],
  runtime: {
    start: invoke("runtime:start"),
    stop: invoke("runtime:stop"),
    onMessage: subscribe("runtime:message"),
  } as MakecordApi["runtime"],
  app: {
    metrics: invoke("app:metrics"),
    openExternal: invoke("app:openExternal"),
    onBeforeClose: subscribe("app:beforeClose"),
    closeReady: invoke("app:closeReady"),
    quit: invoke("app:quit"),
  } as MakecordApi["app"],
};

contextBridge.exposeInMainWorld("makecord", api);
