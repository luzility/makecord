import type { Problem } from "@makecord/runtime/inspect";
import type { Catalog } from "@makecord/runtime/language-service";
import type { HostMessage, RuntimeMessage, RuntimeStatus } from "@makecord/runtime/protocol";

export type { NodeDescriptor } from "@makecord/runtime/describe";
export type { Catalog, Problem, RuntimeMessage, RuntimeStatus };

export interface Settings {
  snapToGrid: boolean;
  openRunOnStart: boolean;
  botMemoryMB: number;
  uiFont: string;
  autoSave: boolean;
}

export interface MarketplacePlugin {
  name: string;
  version: string;
  description: string;
  url: string;
}

export interface FileNode {
  name: string;
  path: string;
  kind: "file" | "dir";
  children?: FileNode[];
}

export interface ProjectInfo {
  root: string;
  name: string;
}

export interface SecretStatus {
  name: string;
  isSet: boolean;
}

export interface Metrics {
  ideMB: number;
  botMB: number | null;
}

export interface MakecordApi {
  platform: string;
  project: {
    current(): Promise<ProjectInfo | null>;
    recent(): Promise<string[]>;
    open(root?: string): Promise<ProjectInfo | null>;
    chooseDirectory(): Promise<string | null>;
    create(parentDir: string, name: string): Promise<ProjectInfo>;
    close(): Promise<void>;
    tree(): Promise<FileNode>;
    inspect(): Promise<Problem[]>;
    catalog(): Promise<Catalog>;
    botId(): Promise<string | null>;
  };
  plugins: {
    search(query: string): Promise<MarketplacePlugin[]>;
    install(name: string): Promise<string>;
    installFromFolder(): Promise<string | null>;
    uninstall(name: string): Promise<void>;
    onCatalogChange(cb: () => void): () => void;
  };
  settings: {
    get(): Promise<Settings>;
    set(patch: Partial<Settings>): Promise<Settings>;
  };
  fs: {
    read(path: string): Promise<string>;
    readOptional(path: string): Promise<string | null>;
    write(path: string, content: string): Promise<void>;
    create(path: string, content: string): Promise<void>;
    remove(path: string): Promise<void>;
    rename(from: string, to: string): Promise<void>;
    mkdir(path: string): Promise<void>;
    onChange(cb: (paths: string[]) => void): () => void;
  };
  secrets: {
    list(): Promise<SecretStatus[]>;
    set(name: string, value: string): Promise<void>;
    remove(name: string): Promise<void>;
    backend(): Promise<string>;
  };
  runtime: {
    start(): Promise<void>;
    stop(): Promise<void>;
    debug(msg: HostMessage): Promise<void>;
    onMessage(cb: (msg: RuntimeMessage) => void): () => void;
  };
  app: {
    metrics(): Promise<Metrics>;
    openExternal(url: string): Promise<void>;
    onBeforeClose(cb: () => void): () => void;
    quit(): Promise<void>;
    closeReady(): Promise<void>;
    closeHold(): Promise<void>;
    closeCancel(): Promise<void>;
  };
}
