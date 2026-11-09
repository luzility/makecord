import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { app } from "electron";

export class JsonStore<T extends object> {
  private queue = Promise.resolve();
  constructor(
    private readonly file: string,
    private readonly fallback: T,
  ) {}

  private get path() {
    return join(app.getPath("userData"), this.file);
  }

  async read(): Promise<T> {
    try {
      return { ...this.fallback, ...JSON.parse(await readFile(this.path, "utf8")) };
    } catch {
      return structuredClone(this.fallback);
    }
  }

  update(fn: (value: T) => T | undefined): Promise<void> {
    this.queue = this.queue.then(async () => {
      const value = await this.read();
      const next = fn(value) ?? value;
      await mkdir(app.getPath("userData"), { recursive: true });
      await writeFile(this.path, JSON.stringify(next, null, 2), { mode: 0o600 });
    });
    return this.queue;
  }
}

export const appState = new JsonStore<{ recent: string[] }>("state.json", { recent: [] });
