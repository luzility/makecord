import assert from "node:assert/strict";
import { test } from "node:test";
import { createDebugger, snapshot } from "./debugger.js";
import type { Emit } from "./reporter.js";

test("pauses on a breakpoint, steps to the next node, then continues", async () => {
  const events: Parameters<Emit>[0][] = [];
  const dbg = createDebugger((e) => events.push(e));
  dbg.setBreakpoints({ "a.flow.json": ["n1"] });
  const order: string[] = [];
  const visit = async (nodeId: string) => {
    await dbg.before({
      file: "a.flow.json",
      runId: "r1",
      nodeId,
      vars: new Map([["x", 1]]),
      scope: {},
    });
    order.push(nodeId);
  };
  const running = (async () => {
    for (const id of ["n0", "n1", "n2", "n3"]) await visit(id);
  })();
  await new Promise((r) => setTimeout(r, 5));
  assert.deepEqual(order, ["n0"]);
  const paused = events.find((e) => e.type === "debug" && e.phase === "paused");
  assert.ok(
    paused && paused.type === "debug" && paused.phase === "paused" && paused.nodeId === "n1",
  );
  assert.deepEqual(paused.vars, { x: 1 });
  dbg.resume("r1", "step");
  await new Promise((r) => setTimeout(r, 5));
  assert.deepEqual(order, ["n0", "n1"]);
  dbg.resume("r1", "continue");
  await running;
  assert.deepEqual(order, ["n0", "n1", "n2", "n3"]);
});

test("stop ends the run with an error", async () => {
  const dbg = createDebugger(() => {});
  dbg.setBreakpoints({ f: ["a"] });
  const p = dbg.before({ file: "f", runId: "r", nodeId: "a", vars: {}, scope: {} });
  await new Promise((r) => setTimeout(r, 5));
  dbg.resumeAll("stop");
  await assert.rejects(p, /Stopped in the debugger/);
});

test("snapshots are bounded and serializable", () => {
  const deep = { a: { b: { c: { d: { e: 1 } } } } };
  assert.deepEqual(snapshot(deep), { a: { b: { c: { d: "{…}" } } } });
  assert.equal((snapshot("x".repeat(2000)) as string).length, 1001);
  assert.equal(snapshot(10n), "10");
  assert.equal((snapshot(Array.from({ length: 80 }, (_, i) => i)) as unknown[]).length, 51);
});
