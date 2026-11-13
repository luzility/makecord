import assert from "node:assert/strict";
import { test } from "node:test";
import { renderData, renderJsonTemplate, renderTemplate } from "./templates.js";

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

test("leaves raw fields alone", () => {
  assert.deepEqual(renderData({ a: "{{n}}", b: "{{n}}" }, { n: 5 }, ["b"]), { a: "5", b: "{{n}}" });
});

test("json mode escapes values inside strings and encodes them outside", () => {
  const scope = {
    user: { displayName: 'x", "isStaff": true, "z": "' },
    guild: { name: 'My "Best" \\ Server' },
    vars: { staff: false, level: 5, tags: ["a", "b"] },
  };
  const out = renderJsonTemplate(
    '{"isStaff": {{vars.staff}}, "name": "{{user.displayName}}", "guild": "{{guild.name}}", "level": {{vars.level}}, "tags": {{vars.tags}}, "missing": {{vars.nope}}, "who": {{user.displayName}}}',
    scope,
  );
  assert.deepEqual(JSON.parse(out), {
    isStaff: false,
    name: 'x", "isStaff": true, "z": "',
    guild: 'My "Best" \\ Server',
    level: 5,
    tags: ["a", "b"],
    missing: null,
    who: 'x", "isStaff": true, "z": "',
  });
});

test("json mode keeps track of escaped quotes in the template", () => {
  const out = renderJsonTemplate('{"a": "say \\"{{v}}\\"", "b": {{v}}}', { v: 'q"' });
  assert.deepEqual(JSON.parse(out), { a: 'say "q""', b: 'q"' });
});
