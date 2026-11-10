import type { Problem } from "@makecord/runtime/inspect";
import type { Catalog } from "@makecord/runtime/language-service";
import { type UtilityProcess, utilityProcess } from "electron";
import { LANGUAGE_SERVICE } from "./bundled";

let proc: UtilityProcess | null = null;
let openDir: string | null = null;
let nextId = 1;
const pending = new Map<number, { resolve: (v: unknown) => void; reject: (e: Error) => void }>();

function spawn(): UtilityProcess {
  const p = utilityProcess.fork(LANGUAGE_SERVICE, [], {
    serviceName: "Makecord Language Service",
    stdio: "pipe",
  });
  p.on("message", (msg: { id: number; result?: unknown; error?: string }) => {
    const waiter = pending.get(msg.id);
    if (!waiter) return;
    pending.delete(msg.id);
    if (msg.error) waiter.reject(new Error(msg.error));
    else waiter.resolve(msg.result);
  });
  p.on("exit", () => {
    if (proc === p) proc = null;
    for (const [id, waiter] of pending) {
      waiter.reject(new Error("The language service stopped"));
      pending.delete(id);
    }
  });
  return p;
}

function request<T>(method: string, params?: unknown, timeoutMs = 15000): Promise<T> {
  if (!proc) throw new Error("The language service isn't running");
  const target = proc;
  const id = nextId++;
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => {
      pending.delete(id);
      reject(new Error(`The language service didn't answer "${method}" in time`));
    }, timeoutMs);
    pending.set(id, {
      resolve: (v) => {
        clearTimeout(timer);
        resolve(v as T);
      },
      reject: (e) => {
        clearTimeout(timer);
        reject(e);
      },
    });
    target.postMessage({ id, method, params });
  });
}

export async function openLanguageService(dir: string): Promise<Catalog> {
  stopLanguageService();
  openDir = dir;
  proc = spawn();
  return request<Catalog>("open", { dir });
}

export function stopLanguageService() {
  openDir = null;
  if (proc) {
    const p = proc;
    proc = null;
    p.kill();
  }
}

async function ensure(): Promise<void> {
  if (!proc && openDir) await openLanguageService(openDir);
}

export async function getCatalog(): Promise<Catalog> {
  await ensure();
  return request<Catalog>("catalog");
}

export async function inspectWithService(): Promise<Problem[]> {
  await ensure();
  return request<Problem[]>("inspect");
}

export const languageServicePid = () => proc?.pid;
