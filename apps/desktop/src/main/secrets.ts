import { safeStorage } from "electron";
import { JsonStore } from "./state";

const store = new JsonStore<{ projects: Record<string, Record<string, string>> }>("secrets.json", {
  projects: {},
});

const encrypt = async (value: string) =>
  (await safeStorage.encryptStringAsync(value)).toString("base64");

export async function secretsBackend(): Promise<string> {
  if (!(await safeStorage.isAsyncEncryptionAvailable())) return "unavailable";
  return process.platform === "linux" ? safeStorage.getSelectedStorageBackend() : "os";
}

export async function listSecretNames(root: string): Promise<string[]> {
  return Object.keys((await store.read()).projects[root] ?? {});
}

export async function setSecret(root: string, name: string, value: string): Promise<void> {
  if (!/^[A-Z][A-Z0-9_]*$/.test(name)) throw new Error("Invalid secret name");
  if (!(await safeStorage.isAsyncEncryptionAvailable())) {
    throw new Error("Encryption is not available on this system");
  }
  const encrypted = await encrypt(value);
  await store.update((s) => {
    s.projects[root] = { ...s.projects[root], [name]: encrypted };
    return s;
  });
}

export async function removeSecret(root: string, name: string): Promise<void> {
  await store.update((s) => {
    delete s.projects[root]?.[name];
    return s;
  });
}

export async function decryptSecrets(root: string): Promise<Record<string, string>> {
  const entries = (await store.read()).projects[root] ?? {};
  const out: Record<string, string> = {};
  const rotated: Record<string, string> = {};
  for (const [name, b64] of Object.entries(entries)) {
    try {
      const { result, shouldReEncrypt } = await safeStorage.decryptStringAsync(
        Buffer.from(b64, "base64"),
      );
      out[name] = result;
      if (shouldReEncrypt) rotated[name] = await encrypt(result);
    } catch {}
  }
  if (Object.keys(rotated).length) {
    await store.update((s) => {
      s.projects[root] = { ...s.projects[root], ...rotated };
      return s;
    });
  }
  return out;
}
