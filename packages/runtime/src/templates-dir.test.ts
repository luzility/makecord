import assert from "node:assert/strict";
import { cp, mkdtemp, readdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import ai from "@makecord/plugin-ai";
import { coreNodeMetas } from "@makecord/plugin-core/meta";
import { inspectProject } from "./inspect.js";
import { loadProject } from "./project.js";

const TEMPLATES = join(dirname(fileURLToPath(import.meta.url)), "../../templates");
const metas = [...coreNodeMetas, ...ai.nodes.map((n) => n.meta)];

async function materialize(id: string) {
  const root = await mkdtemp(join(tmpdir(), `makecord-${id}-`));
  await cp(join(TEMPLATES, "starter"), root, { recursive: true });
  if (id !== "starter") {
    await rm(join(root, "commands"), { recursive: true, force: true });
    await rm(join(root, "events"), { recursive: true, force: true });
    await cp(join(TEMPLATES, id), root, { recursive: true });
  }
  const manifest = JSON.parse(await readFile(join(TEMPLATES, id, "template.json"), "utf8"));
  const configPath = join(root, "makecord.json");
  const config = JSON.parse(await readFile(configPath, "utf8"));
  config.intents = [...new Set([...config.intents, ...manifest.intents])];
  config.plugins = [...new Set([...config.plugins, ...manifest.plugins])];
  await writeFile(configPath, JSON.stringify(config));
  return root;
}

test("every project template loads and passes inspection", async () => {
  const ids = (await readdir(TEMPLATES, { withFileTypes: true }))
    .filter((e) => e.isDirectory() && e.name !== "node_modules")
    .map((e) => e.name);
  assert.ok(ids.length >= 6);
  for (const id of ids) {
    const root = await materialize(id);
    try {
      const project = await loadProject(root);
      assert.deepEqual(project.problems, [], `${id} has load problems`);
      assert.ok(project.flows.length > 0, `${id} has no flows`);
      const problems = inspectProject(project, metas).map((p) => `${p.file}: ${p.message}`);
      assert.deepEqual(problems, [], `${id} has problems`);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  }
});
