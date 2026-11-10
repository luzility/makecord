import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { RUNTIME_VERSION } from "./version.js";

test("RUNTIME_VERSION matches package.json", () => {
  const pkg = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8"));
  assert.equal(RUNTIME_VERSION, pkg.version);
});
