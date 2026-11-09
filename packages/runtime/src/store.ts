import { mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import type { KeyValueStore, StoredValue } from "@makecord/plugin-sdk";

const WRITE_DELAY = 500;

export interface ProjectStore extends KeyValueStore {
  flush(): void;
}

export function openStore(projectDir: string): ProjectStore {
  const file = join(projectDir, "data", "store.json");
  let data: Record<string, StoredValue> = {};
  try {
    const parsed = JSON.parse(readFileSync(file, "utf8"));
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) data = parsed;
  } catch {}

  let timer: NodeJS.Timeout | undefined;
  let dirty = false;

  const write = () => {
    timer = undefined;
    if (!dirty) return;
    dirty = false;
    mkdirSync(dirname(file), { recursive: true });
    const tmp = `${file}.tmp`;
    writeFileSync(tmp, JSON.stringify(data, null, 2));
    renameSync(tmp, file);
  };
  const changed = () => {
    dirty = true;
    if (!timer) timer = setTimeout(write, WRITE_DELAY);
  };

  return {
    get: (key) => data[key],
    set(key, value) {
      data[key] = value;
      changed();
    },
    delete(key) {
      if (!(key in data)) return false;
      delete data[key];
      changed();
      return true;
    },
    increment(key, by) {
      const current = Number(data[key] ?? 0);
      const next = (Number.isFinite(current) ? current : 0) + by;
      data[key] = next;
      changed();
      return next;
    },
    keys: (prefix = "") => Object.keys(data).filter((k) => k.startsWith(prefix)),
    flush() {
      clearTimeout(timer);
      write();
    },
  };
}
