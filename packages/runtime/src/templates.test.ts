import assert from "node:assert/strict";
import { test } from "node:test";
import { renderData, renderTemplate } from "./templates.js";

test("renders nested paths", () => {
  assert.equal(
    renderTemplate("Merhaba {{ user.name }}!", { user: { name: "Luzi" } }),
    "Merhaba Luzi!",
  );
});

test("unknown paths render empty", () => {
  assert.equal(renderTemplate("[{{nope.x}}]", {}), "[]");
});

test("renders inside objects but leaves non-strings alone", () => {
  assert.deepEqual(renderData({ a: "{{n}}", b: true, c: ["{{n}}"] }, { n: 5 }), {
    a: "5",
    b: true,
    c: ["5"],
  });
});
