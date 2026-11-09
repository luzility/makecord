import assert from "node:assert/strict";
import { mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { openStore } from "./store.js";

test("values survive reopening the store", () => {
  const dir = mkdtempSync(join(tmpdir(), "makecord-store-"));
  const store = openStore(dir);
  store.set("greeting", "hi");
  assert.equal(store.increment("xp:1", 5), 5);
  assert.equal(store.increment("xp:1", -2), 3);
  store.flush();
  const again = openStore(dir);
  assert.equal(again.get("greeting"), "hi");
  assert.equal(again.get("xp:1"), 3);
  assert.deepEqual(again.keys("xp:"), ["xp:1"]);
  assert.equal(again.delete("greeting"), true);
  again.flush();
  assert.deepEqual(JSON.parse(readFileSync(join(dir, "data", "store.json"), "utf8")), {
    "xp:1": 3,
  });
});
