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
import { Action } from "../engine/Action.js";
import { MemoryAdapter } from "../core/storage/MemoryAdapter.js";

let passed = 0;
let failed = 0;

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

async function runTest(name, fn) {
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

async function runTests() {
  console.log("⚙️ Engine Tests\n");

  await runTest("Engine applies a debug:log action", () => {
    const engine = new Engine();
    const action = new Action("debug:log", { msg: "Hello Engine" });
    engine.apply(action);
    assert(true, "apply should not throw");
  });

  await runTest("space:lockZone persists into CRDT doc", () => {
    const engine = new Engine();
    engine.dispatch("space:createZone", { name: "table" });
    engine.dispatch("space:lockZone", { zone: "table", locked: true });

    // Lock is read from the doc, not an in-memory set.
    assert(engine.space._isLocked("table") === true, "zone should be locked");
    // The lock is stored under a _lock:<zone> key in the zones map.
    assert(engine.session.state.zones["_lock:table"] === true, `_lock:table should be true, got ${engine.session.state.zones["_lock:table"]}`);
    // The lock key must not surface as a real zone.
    assert(!engine.space.zones.includes("_lock:table"), "_lock:table must not appear in zones()");
    assert(engine.space.zones.includes("table"), "table should appear in zones()");

    // Unlock writes false, does not delete the key.
    engine.dispatch("space:lockZone", { zone: "table", locked: false });
    assert(engine.space._isLocked("table") === false, "zone should be unlocked");
    assert(engine.session.state.zones["_lock:table"] === false, `_lock:table should be false after unlock, got ${engine.session.state.zones["_lock:table"]}`);
  });

  await runTest("space:lockZone survives persist/resume round-trip", async () => {
    const engine = new Engine();
    const adapter = new MemoryAdapter();
    engine.useStorage(adapter);

    engine.dispatch("space:createZone", { name: "table" });
    engine.dispatch("space:lockZone", { zone: "table", locked: true });
    assert(engine.space._isLocked("table") === true, "zone locked before persist");

    await engine.persist("lock-save", "lock persistence test");

    const engine2 = new Engine();
    engine2.useStorage(adapter);
    const loaded = await engine2.resume("lock-save");
    assert(loaded === true, "resume should return true");

    assert(engine2.space._isLocked("table") === true, "zone should still be locked after resume");
    const zones = engine2.session.state.zones;
    assert(zones["_lock:table"] === true, `_lock:table should be true after resume, got ${zones["_lock:table"]}`);
    assert(!engine2.space.zones.includes("_lock:table"), "_lock:table must not surface as a zone after resume");
  });

  await runTest("space:lockZone syncs between peers via merge", () => {
    const engineA = new Engine();
    const engineB = new Engine();

    engineA.dispatch("space:createZone", { name: "table" });
    engineA.dispatch("space:lockZone", { zone: "table", locked: true });

    engineB.session.merge(engineA.session);
    assert(engineB.space._isLocked("table") === true, "lock should sync to peer B via merge");
    assert(engineB.space.zones.includes("table"), "table zone should sync to peer B");
    assert(!engineB.space.zones.includes("_lock:table"), "_lock:table must not surface as a zone on peer B");
  });

  if (failed > 0) {
    console.error(`\n❌ ${failed} test(s) failed, ${passed} passed`);
    process.exit(1);
  }
  console.log(`\n✅ All ${passed} tests passed`);
}

runTests();