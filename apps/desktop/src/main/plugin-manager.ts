import { spawn } from "node:child_process";
import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { PROJECT_FILE, ProjectConfig } from "@makecord/spec";
import type { MarketplacePlugin } from "../shared/api";

export const MARKETPLACE_KEYWORD = "makecord-plugin";

export async function searchMarketplace(query: string): Promise<MarketplacePlugin[]> {
  const text = `keywords:${MARKETPLACE_KEYWORD} ${query}`.trim();
  const url = `https://registry.npmjs.org/-/v1/search?text=${encodeURIComponent(text)}&size=30`;
  const res = await fetch(url, { signal: AbortSignal.timeout(10000) });
  if (!res.ok) throw new Error(`npm search failed (${res.status})`);
  const body = (await res.json()) as {
    objects: {
      package: { name: string; version: string; description?: string; links?: { npm?: string } };
    }[];
  };
  return body.objects.map(({ package: p }) => ({
    name: p.name,
    version: p.version,
    description: p.description ?? "",
    url: p.links?.npm ?? `https://www.npmjs.com/package/${p.name}`,
  }));
}

function npm(root: string, args: string[]): Promise<string> {
  return new Promise((resolve, reject) => {
    const child = spawn(process.platform === "win32" ? "npm.cmd" : "npm", args, {
      cwd: root,
      shell: process.platform === "win32",
      env: process.env,
    });
    let out = "";
    child.stdout.on("data", (d: Buffer) => {
      out += d.toString();
    });
    child.stderr.on("data", (d: Buffer) => {
      out += d.toString();
    });
    child.on("error", (e) =>
      reject(new Error(`Couldn't run npm: ${e.message}. Is Node.js installed?`)),
    );
    child.on("close", (code) => {
      if (code === 0) resolve(out);
      else reject(new Error(lastLines(out) || `npm exited with code ${code}`));
    });
  });
}

const lastLines = (text: string) =>
  text
    .split("\n")
    .filter((l) => l.trim() && !l.includes("npm notice"))
    .slice(-6)
    .join("\n");

async function updatePlugins(root: string, fn: (names: string[]) => string[]) {
  const path = join(root, PROJECT_FILE);
  const config = ProjectConfig.parse(JSON.parse(await readFile(path, "utf8")));
  config.plugins = fn(config.plugins);
  await writeFile(path, `${JSON.stringify(config, null, 2)}\n`);
}

async function installedName(root: string, before: Set<string>): Promise<string | null> {
  const pkg = JSON.parse(await readFile(join(root, "package.json"), "utf8"));
  const deps = Object.keys(pkg.dependencies ?? {});
  return deps.find((d) => !before.has(d)) ?? null;
}

export async function installPlugin(
  root: string,
  spec: string,
  nameHint?: string,
): Promise<string> {
  const pkg = JSON.parse(await readFile(join(root, "package.json"), "utf8"));
  const before = new Set(Object.keys(pkg.dependencies ?? {}));
  await npm(root, ["install", "--save", "--no-fund", "--no-audit", spec]);
  const name = nameHint ?? (await installedName(root, before));
  if (!name) throw new Error("npm finished, but no new dependency appeared in package.json");
  await updatePlugins(root, (names) => (names.includes(name) ? names : [...names, name]));
  return name;
}

export async function uninstallPlugin(root: string, name: string): Promise<void> {
  await updatePlugins(root, (names) => names.filter((n) => n !== name));
  await npm(root, ["uninstall", "--no-fund", "--no-audit", name]);
}
