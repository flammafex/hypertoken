/*
 * Copyright 2025 The Carpocratian Church of Commonality and Equality, Inc.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *      http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
import { Engine } from "../engine/Engine.js";

let passed = 0;
let failed = 0;

function assert(condition: boolean, message: string): void {
  if (!condition) throw new Error(message);
}

async function runTest(name: string, fn: () => Promise<void> | void): Promise<void> {
  try {
    await fn();
    passed++;
    console.log(`  ✓ ${name}`);
  } catch (err) {
    failed++;
    console.error(`  ✗ ${name}`);
    console.error(`    ${err instanceof Error ? err.message : String(err)}`);
  }
}

/**
 * Dispatch `n` space:createZone actions. Note: the Engine constructor records a
 * single `game:loopInit` action in history, so after `n` dispatches the history
 * holds `n + 1` entries while `space.zones` holds `n` zones. The consistency
 * invariant after a coherent undo is therefore `zones === history.length - 1`.
 */
async function dispatchZones(engine: Engine, n: number): Promise<void> {
  for (let i = 0; i < n; i++) {
    await engine.dispatch("space:createZone", { name: `zone${i}` });
  }
}

async function runTests(): Promise<void> {
  console.log("↩️  Undo Tests\n");

  await runTest("undo on empty history returns null (no fake success)", () => {
    const engine = new Engine();
    const result = engine.undo();
    assert(result === null, "undo on empty history should return null");
  });

  await runTest("undo before first checkpoint returns null, state unchanged (no silent no-op)", async () => {
    const engine = new Engine();
    await engine.dispatch("space:createZone", { name: "zone0" });
    const zonesBefore = engine.space.zones.length;
    const historyBefore = engine.history.length;
    assert(zonesBefore === 1, "one zone should exist before undo");

    const result = engine.undo();
    assert(result === null, "undo with no checkpoint should return null, not fake success");
    assert(engine.space.zones.length === zonesBefore, "state must be unchanged when undo returns null");
    assert(engine.history.length === historyBefore, "history must be unchanged when undo returns null");
  });

  await runTest("undo actually reverts state after a checkpoint exists (core bug)", async () => {
    const engine = new Engine();
    // Dispatch 51 actions so a checkpoint is recorded at index 51 (state after 50 actions).
    await dispatchZones(engine, 51);
    assert(engine.space.zones.length === 51, "51 zones should exist before undo");
    assert(engine.history.length === 52, "history should hold 52 actions before undo");

    const result = engine.undo();
    assert(result !== null, "undo should return the undone action once a checkpoint exists");
    // Undo restores to the checkpoint at index 51 (state after 50 actions = 49 zones).
    assert(engine.space.zones.length === 49, `state must revert to 49 zones, got ${engine.space.zones.length}`);
    assert(engine.history.length === 50, `history must be truncated to 50, got ${engine.history.length}`);
    assert(engine.space.zones.length === engine.history.length - 1, "doc and history must agree after undo");
  });

  await runTest("history stays consistent with document after undo (subsequent dispatch works)", async () => {
    const engine = new Engine();
    await dispatchZones(engine, 51);
    engine.undo();
    const zonesAfterUndo = engine.space.zones.length;
    const historyAfterUndo = engine.history.length;
    assert(zonesAfterUndo === 49, "49 zones after undo");

    // Dispatch again after undo — must work and stay consistent.
    await engine.dispatch("space:createZone", { name: "post-undo" });
    assert(engine.space.zones.length === zonesAfterUndo + 1, "zones should grow by one after dispatching post-undo");
    assert(engine.history.length === historyAfterUndo + 1, "history should track the new dispatch");
    assert(engine.space.zones.includes("post-undo"), "post-undo zone should exist");
    assert(engine.space.zones.length === engine.history.length - 1, "doc and history must agree after new dispatch");
  });

  await runTest("repeated undo changes state each time and never silently no-ops", async () => {
    const engine = new Engine();
    // Dispatch 101 actions: checkpoints at index 51 (state after 50) and 101 (state after 100).
    await dispatchZones(engine, 101);
    assert(engine.space.zones.length === 101, "101 zones before undo");

    // First undo -> checkpoint 101 (state after 100 actions = 99 zones).
    const u1 = engine.undo();
    assert(u1 !== null, "first undo should succeed");
    assert(engine.space.zones.length === 99, `first undo should revert to 99 zones, got ${engine.space.zones.length}`);
    assert(engine.history.length === 100, `first undo should truncate history to 100, got ${engine.history.length}`);

    // Second undo -> checkpoint 51 (state after 50 actions = 49 zones).
    const u2 = engine.undo();
    assert(u2 !== null, "second undo should succeed");
    assert(engine.space.zones.length === 49, `second undo should revert to 49 zones, got ${engine.space.zones.length}`);
    assert(engine.history.length === 50, `second undo should truncate history to 50, got ${engine.history.length}`);

    // No checkpoint remains at or before 50 -> undo must return null, not fake success.
    const u3 = engine.undo();
    assert(u3 === null, "third undo should return null (no checkpoint left)");
    assert(engine.space.zones.length === 49, "state must be unchanged when undo returns null");
    assert(engine.history.length === 50, "history must be unchanged when undo returns null");
  });

  await runTest("undo of a non-reversible action returns null", async () => {
    const engine = new Engine();
    await dispatchZones(engine, 51);
    // Dispatch a non-reversible action on top.
    await engine.dispatch("space:createZone", { name: "locked" }, { reversible: false });
    assert(engine.space.zones.length === 52, "52 zones before undo");

    const result = engine.undo();
    assert(result === null, "undo of a non-reversible action should return null");
    assert(engine.space.zones.length === 52, "state must be unchanged when last action is non-reversible");
  });

  if (failed > 0) {
    console.error(`\n❌ ${failed} test(s) failed, ${passed} passed`);
    process.exit(1);
  }
  console.log(`\n✅ All ${passed} tests passed`);
}

runTests();
