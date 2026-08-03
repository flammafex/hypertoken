#!/usr/bin/env -S node --loader ./test/ts-esm-loader.js
/*
 * test/testChronicleIncremental.ts
 *
 * Parity tests: verify that TypeScript and WASM paths produce equivalent results
 * for the Chronicle incremental CRDT implementation.
 *
 * When WASM is not available, tests skip gracefully.
 */

import { Engine } from '../engine/Engine.js';
import { Chronicle } from '../core/Chronicle.js';
import { Stack } from '../core/Stack.js';
import { Space } from '../core/Space.js';
import { Token } from '../core/Token.js';
import { isWasmAvailable, tryLoadWasm } from '../core/WasmBridge.js';

// ── Test helpers ────────────────────────────────────────────────────────────

let testCount = 0;
let passCount = 0;
let failCount = 0;
let skipCount = 0;

async function test(name: string, fn: () => void | Promise<void>) {
  testCount++;
  try {
    await fn();
    passCount++;
    console.log(`  PASS  ${name}`);
  } catch (err: any) {
    failCount++;
    console.error(`  FAIL  ${name}`);
    console.error(`        ${err.message}`);
  }
}

function assert(condition: boolean, message?: string) {
  if (!condition) {
    throw new Error(message || 'Assertion failed');
  }
}

assert.equal = function(actual: any, expected: any, message?: string) {
  if (actual !== expected) {
    throw new Error(message || `Expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
  }
};

assert.ok = function(value: any, message?: string) {
  if (!value) {
    throw new Error(message || `Expected truthy value, got ${JSON.stringify(value)}`);
  }
};

assert.deepEqual = function(actual: any, expected: any, message?: string) {
  const a = JSON.stringify(actual);
  const b = JSON.stringify(expected);
  if (a !== b) {
    throw new Error(message || `Deep equality failed:\n  actual:   ${a}\n  expected: ${b}`);
  }
};

function skip(name: string) {
  skipCount++;
  console.log(`  SKIP  ${name} (WASM not available)`);
}

// ── Shared token definitions ────────────────────────────────────────────────

const tokenDefs = [
  { id: "t1", text: "A", char: "A", kind: "card", index: 0, meta: {} },
  { id: "t2", text: "B", char: "B", kind: "card", index: 1, meta: {} },
  { id: "t3", text: "C", char: "C", kind: "card", index: 2, meta: {} },
];

const initStateJson = JSON.stringify({
  stack: { stack: tokenDefs, drawn: [], discards: [] },
  zones: { hand: [], table: [] },
  agents: {},
  gameLoop: { turn: 0, running: false, activeAgentIndex: -1, phase: "setup", maxTurns: 10 },
  rules: { fired: {} },
});

// ── Engine factories ────────────────────────────────────────────────────────

/**
 * Create a TS-only engine (no WASM).
 * Uses real Stack/Space so TS ActionRegistry handlers work correctly.
 */
function createTsEngine(): Engine {
  const session = new Chronicle();
  const tokens = tokenDefs.map(t => new Token(t));
  const stack = new Stack(session, tokens);
  const space = new Space(session, "main-space");

  const engine = new Engine({ stack, space });
  // Force TS path: ensure no WASM dispatcher is used
  (engine as any)._wasmDispatcher = null;
  // Restore session to the Chronicle that owns the Stack/Space state
  engine.session = session;
  engine.session.on("state:changed", (e: any) => engine.emit("state:updated", e));

  // Initialize gameLoop and rules in the CRDT (Stack/Space init their own sections)
  session.change("init game state", (doc: any) => {
    if (!doc.gameLoop) {
      doc.gameLoop = { turn: 0, running: false, activeAgentIndex: -1, phase: "setup", maxTurns: 10 };
    }
    if (!doc.rules) {
      doc.rules = { fired: {} };
    }
    if (!doc.agents) {
      doc.agents = {};
    }
    if (!doc.zones) {
      doc.zones = { hand: [], table: [] };
    }
  });

  return engine;
}

/**
 * Create a WASM-backed engine.
 * Uses the WasmActionDispatcher + WasmChronicleAdapter path.
 */
function createWasmEngine(): Engine {
  const engine = new Engine();
  if (!(engine as any)._wasmDispatcher) {
    throw new Error("WASM dispatcher not initialized — cannot create WASM engine");
  }
  (engine as any)._wasmDispatcher.initializeState(initStateJson);
  return engine;
}

/**
 * Run same action sequence through both TS and WASM paths, return both states.
 */
async function parityCheck(actions: Array<{type: string, payload: any}>) {
  const tsEngine = createTsEngine();
  const wasmEngine = createWasmEngine();

  for (const action of actions) {
    await tsEngine.dispatch(action.type, action.payload);
    await wasmEngine.dispatch(action.type, action.payload);
  }

  const tsState = JSON.parse(JSON.stringify(tsEngine.session.state));
  const wasmState = JSON.parse(JSON.stringify(wasmEngine.session.state));
  return { tsState, wasmState, tsEngine, wasmEngine };
}

/**
 * Run the same action sequence through both paths, asserting that both paths
 * agree on whether each dispatch throws (used for error-parity cases).
 */
async function parityThrows(actions: Array<{type: string, payload: any}>) {
  const tsEngine = createTsEngine();
  const wasmEngine = createWasmEngine();

  for (const action of actions) {
    let tsThrew = false;
    let wasmThrew = false;
    try { await tsEngine.dispatch(action.type, action.payload); } catch { tsThrew = true; }
    try { await wasmEngine.dispatch(action.type, action.payload); } catch { wasmThrew = true; }
    assert.equal(tsThrew, wasmThrew, `TS and WASM should agree on throw for ${action.type}`);
  }

  return { tsEngine, wasmEngine };
}

/**
 * Find an agent on the TS engine by name, throwing if absent. Returns `any`
 * so tests can read resources/inventory/meta without TS undefined-narrowing.
 */
function findTsAgent(engine: Engine, name: string): any {
  const agent = engine._agents.find((a: any) => a.name === name);
  if (!agent) throw new Error(`Agent "${name}" not found on TS engine`);
  return agent;
}

// ── Load WASM ───────────────────────────────────────────────────────────────

console.log('='.repeat(72));
console.log('CHRONICLE INCREMENTAL CRDT — PARITY VALIDATION');
console.log('='.repeat(72));
console.log('');

console.log('Loading WASM module...');
await tryLoadWasm().catch(() => {});
const wasmLoaded = isWasmAvailable();
console.log(wasmLoaded ? 'WASM loaded successfully.' : 'WASM not available — WASM parity tests will skip.');
console.log('');

// ── TS-only tests (always run) ──────────────────────────────────────────────

console.log('--- TS-only tests (always run) ---');
console.log('');

await test("TS: engine creates with default state", () => {
  const engine = createTsEngine();
  const state = engine.session.state;
  assert.ok(state.stack, "Should have stack");
  assert.equal(state.stack!.stack.length, 3, "Stack should have 3 tokens");
  assert.equal(state.stack!.drawn.length, 0, "Drawn should be empty");
  assert.equal(state.gameLoop!.phase, "setup", "Phase should be setup");
});

await test("TS: stack:draw removes from stack and adds to drawn", async () => {
  const engine = createTsEngine();
  await engine.dispatch("stack:draw", { count: 2 });
  const state = engine.session.state;
  assert.equal(state.stack!.stack.length, 1, "Stack should have 1 remaining");
  assert.equal(state.stack!.drawn.length, 2, "Drawn should have 2");
});

await test("TS: game:loopStart transitions to play phase", async () => {
  const engine = createTsEngine();
  await engine.dispatch("game:loopStart", {});
  const state = engine.session.state;
  assert.equal(state.gameLoop!.running, true, "Should be running");
  assert.equal(state.gameLoop!.phase, "play", "Phase should be play");
});

await test("TS: save/load round-trip preserves state", async () => {
  const engine = createTsEngine();
  await engine.dispatch("stack:draw", { count: 1 });
  const saved = engine.session.saveToBase64();

  const engine2 = createTsEngine();
  engine2.session.loadFromBase64(saved);

  const s1 = JSON.parse(JSON.stringify(engine.session.state));
  const s2 = JSON.parse(JSON.stringify(engine2.session.state));
  assert.equal(s1.stack.stack.length, s2.stack.stack.length, "Stack length should match");
  assert.equal(s1.stack.drawn.length, s2.stack.drawn.length, "Drawn length should match");
});

console.log('');

// ── WASM parity tests (skip when WASM not available) ────────────────────────

console.log('--- WASM parity tests ---');
console.log('');

if (!wasmLoaded) {
  skip("parity: stack:draw produces same state");
  skip("parity: game:loopStart produces same state");
  skip("parity: multiple action sequence produces equivalent state");
  skip("parity: save/load round-trip through WASM");
  skip("parity: WASM documents can merge cleanly");
  skip("parity: agent create+give+take overdraw floors at zero");
  skip("parity: agent transferResource valid");
  skip("parity: agent transferResource insufficient throws on both");
  skip("parity: agent addToken + removeToken returns removed token");
  skip("parity: agent transferToken missing throws on both");
  skip("parity: agent transferToken valid");
  skip("parity: agent stealResource over-amount");
  skip("parity: agent stealToken");
  skip("parity: agent setMeta scalar");
  skip("parity: agent setActive(false)");
  skip("parity: agent remove");
  skip("parity: agent drawCards seeded stack");
} else {
  await test("parity: stack:draw produces same state", async () => {
    const { tsState, wasmState } = await parityCheck([
      { type: "stack:draw", payload: { count: 2 } },
    ]);
    assert.equal(tsState.stack.stack.length, wasmState.stack.stack.length,
      "Stack length should match after draw");
    assert.equal(tsState.stack.drawn.length, wasmState.stack.drawn.length,
      "Drawn length should match after draw");
  });

  await test("parity: game:loopStart produces same state", async () => {
    const { tsState, wasmState } = await parityCheck([
      { type: "game:loopStart", payload: {} },
    ]);
    assert.equal(tsState.gameLoop.running, wasmState.gameLoop.running,
      "Running flag should match");
    assert.equal(tsState.gameLoop.phase, wasmState.gameLoop.phase,
      "Phase should match");
    assert.equal(tsState.gameLoop.turn, wasmState.gameLoop.turn,
      "Turn should match");
  });

  await test("parity: multiple action sequence produces equivalent state", async () => {
    const { tsState, wasmState, tsEngine, wasmEngine } = await parityCheck([
      { type: "stack:draw", payload: { count: 1 } },
      { type: "agent:create", payload: { id: "p1", name: "Player 1" } },
      { type: "game:loopStart", payload: {} },
    ]);

    // Stack state lives in the CRDT doc for both paths
    assert.equal(tsState.stack.stack.length, wasmState.stack.stack.length,
      "Stack length should match after sequence");

    // Agent state diverges: TS uses engine._agents, WASM uses session.state.agents
    // Verify each path created the agent in its own location
    const tsAgent = tsEngine._agents.find((a: any) => a.name === "Player 1");
    assert.ok(tsAgent, "TS engine should have agent in _agents");
    assert.ok(wasmState.agents?.["Player 1"], "WASM engine should have agent in state.agents");

    // GameLoop state should match (both in CRDT doc)
    assert.equal(tsState.gameLoop.running, wasmState.gameLoop.running,
      "Running flag should match");
    assert.equal(tsState.gameLoop.phase, wasmState.gameLoop.phase,
      "Phase should match");
  });

  await test("parity: save/load round-trip through WASM", async () => {
    const engine = createWasmEngine();
    await engine.dispatch("stack:draw", { count: 1 });

    const saved = engine.session.saveToBase64();
    const engine2 = createWasmEngine();
    engine2.session.loadFromBase64(saved);

    const s1 = JSON.parse(JSON.stringify(engine.session.state));
    const s2 = JSON.parse(JSON.stringify(engine2.session.state));
    assert.equal(s1.stack.stack.length, s2.stack.stack.length,
      "Stack length should survive save/load");
    assert.equal(s1.stack.drawn.length, s2.stack.drawn.length,
      "Drawn length should survive save/load");
  });

  await test("parity: WASM documents can merge cleanly", async () => {
    const engine1 = createWasmEngine();
    const engine2 = createWasmEngine();

    // Fork from the same snapshot so Automerge can merge
    const snapshot = engine1.session.save();
    engine2.session.load(snapshot);

    // Concurrent operations on different parts of state
    await engine1.dispatch("agent:create", { id: "p1", name: "Player 1" });
    await engine2.dispatch("stack:draw", { count: 1 });

    // Merge engine2's changes into engine1
    const bytes2 = engine2.session.save();
    engine1.session.merge(bytes2);

    const state = engine1.session.state;
    assert.ok(state.agents?.["Player 1"], "Should have agent from engine1");
    assert.equal(state.stack!.drawn.length, 1, "Should have drawn card from engine2");
  });

  await test("parity: agent create+give+take overdraw floors at zero", async () => {
    const { tsState, wasmState, tsEngine, wasmEngine } = await parityCheck([
      { type: "agent:create", payload: { id: "a1", name: "Alice" } },
      { type: "agent:giveResource", payload: { name: "Alice", resource: "gold", amount: 10 } },
      { type: "agent:takeResource", payload: { name: "Alice", resource: "gold", amount: 100 } },
    ]);
    const tsAlice = findTsAgent(tsEngine, "Alice");
    assert.equal(tsAlice.resources.gold, 0, "TS take should floor at 0");
    assert.equal(wasmState.agents["Alice"].resources.gold, 0, "WASM take should floor at 0");
  });

  await test("parity: agent transferResource valid", async () => {
    const { tsState, wasmState, tsEngine, wasmEngine } = await parityCheck([
      { type: "agent:create", payload: { id: "a1", name: "Alice" } },
      { type: "agent:create", payload: { id: "a2", name: "Bob" } },
      { type: "agent:giveResource", payload: { name: "Alice", resource: "gold", amount: 100 } },
      { type: "agent:transferResource", payload: { from: "Alice", to: "Bob", resource: "gold", amount: 40 } },
    ]);
    const tsAlice = findTsAgent(tsEngine, "Alice");
    const tsBob = findTsAgent(tsEngine, "Bob");
    assert.equal(tsAlice.resources.gold, 60, "TS Alice should have 60");
    assert.equal(tsBob.resources.gold, 40, "TS Bob should have 40");
    assert.equal(wasmState.agents["Alice"].resources.gold, 60, "WASM Alice should have 60");
    assert.equal(wasmState.agents["Bob"].resources.gold, 40, "WASM Bob should have 40");
  });

  await test("parity: agent transferResource insufficient throws on both", async () => {
    await parityThrows([
      { type: "agent:create", payload: { id: "a1", name: "Alice" } },
      { type: "agent:create", payload: { id: "a2", name: "Bob" } },
      { type: "agent:giveResource", payload: { name: "Alice", resource: "gold", amount: 10 } },
      { type: "agent:transferResource", payload: { from: "Alice", to: "Bob", resource: "gold", amount: 50 } },
    ]);
  });

  await test("parity: agent addToken + removeToken returns removed token", async () => {
    const tsEngine = createTsEngine();
    const wasmEngine = createWasmEngine();
    const token = { id: "t1", text: "Sword", char: "S", kind: "item", index: 0, meta: {} };
    await tsEngine.dispatch("agent:create", { id: "a1", name: "Alice" });
    await wasmEngine.dispatch("agent:create", { id: "a1", name: "Alice" });
    await tsEngine.dispatch("agent:addToken", { name: "Alice", token });
    await wasmEngine.dispatch("agent:addToken", { name: "Alice", token });
    const tsRemoved = await tsEngine.dispatch("agent:removeToken", { name: "Alice", tokenId: "t1" });
    const wasmRemoved = await wasmEngine.dispatch("agent:removeToken", { name: "Alice", tokenId: "t1" });
    assert.equal(tsRemoved.id, "t1", "TS removed token id");
    assert.equal(wasmRemoved.id, "t1", "WASM removed token id");
    const tsState = JSON.parse(JSON.stringify(tsEngine.session.state));
    const wasmState = JSON.parse(JSON.stringify(wasmEngine.session.state));
    const tsAlice = findTsAgent(tsEngine, "Alice");
    assert.equal(tsAlice.inventory.length, 0, "TS inventory should be empty");
    assert.equal(wasmState.agents["Alice"].inventory.length, 0, "WASM inventory should be empty");
  });

  await test("parity: agent transferToken missing throws on both", async () => {
    await parityThrows([
      { type: "agent:create", payload: { id: "a1", name: "Alice" } },
      { type: "agent:create", payload: { id: "a2", name: "Bob" } },
      { type: "agent:transferToken", payload: { from: "Alice", to: "Bob", tokenId: "nope" } },
    ]);
  });

  await test("parity: agent transferToken valid", async () => {
    const { tsState, wasmState, tsEngine, wasmEngine } = await parityCheck([
      { type: "agent:create", payload: { id: "a1", name: "Alice" } },
      { type: "agent:create", payload: { id: "a2", name: "Bob" } },
      { type: "agent:addToken", payload: { name: "Alice", token: { id: "t1", text: "Sword", char: "S", kind: "item", index: 0, meta: {} } } },
      { type: "agent:transferToken", payload: { from: "Alice", to: "Bob", tokenId: "t1" } },
    ]);
    const tsAlice = findTsAgent(tsEngine, "Alice");
    const tsBob = findTsAgent(tsEngine, "Bob");
    assert.equal(tsAlice.inventory.length, 0, "TS Alice inventory empty");
    assert.equal(tsBob.inventory.length, 1, "TS Bob inventory has 1");
    assert.equal(tsBob.inventory[0].id, "t1", "TS Bob has t1");
    assert.equal(wasmState.agents["Alice"].inventory.length, 0, "WASM Alice inventory empty");
    assert.equal(wasmState.agents["Bob"].inventory.length, 1, "WASM Bob inventory has 1");
    assert.equal(wasmState.agents["Bob"].inventory[0].id, "t1", "WASM Bob has t1");
  });

  await test("parity: agent stealResource over-amount", async () => {
    const { tsState, wasmState, tsEngine, wasmEngine } = await parityCheck([
      { type: "agent:create", payload: { id: "a1", name: "Alice" } },
      { type: "agent:create", payload: { id: "a2", name: "Bob" } },
      { type: "agent:giveResource", payload: { name: "Alice", resource: "gold", amount: 10 } },
      { type: "agent:stealResource", payload: { from: "Alice", to: "Bob", resource: "gold", amount: 100 } },
    ]);
    const tsAlice = findTsAgent(tsEngine, "Alice");
    const tsBob = findTsAgent(tsEngine, "Bob");
    assert.equal(tsAlice.resources.gold, 0, "TS Alice should have 0");
    assert.equal(tsBob.resources.gold, 10, "TS Bob should have 10");
    assert.equal(wasmState.agents["Alice"].resources.gold, 0, "WASM Alice should have 0");
    assert.equal(wasmState.agents["Bob"].resources.gold, 10, "WASM Bob should have 10");
  });

  await test("parity: agent stealToken", async () => {
    const { tsState, wasmState, tsEngine, wasmEngine } = await parityCheck([
      { type: "agent:create", payload: { id: "a1", name: "Alice" } },
      { type: "agent:create", payload: { id: "a2", name: "Bob" } },
      { type: "agent:addToken", payload: { name: "Alice", token: { id: "t1", text: "Sword", char: "S", kind: "item", index: 0, meta: {} } } },
      { type: "agent:stealToken", payload: { from: "Alice", to: "Bob", tokenId: "t1" } },
    ]);
    const tsBob = findTsAgent(tsEngine, "Bob");
    assert.equal(tsBob.inventory.length, 1, "TS Bob has 1");
    assert.equal(tsBob.inventory[0].id, "t1", "TS Bob has t1");
    assert.equal(wasmState.agents["Bob"].inventory.length, 1, "WASM Bob has 1");
    assert.equal(wasmState.agents["Bob"].inventory[0].id, "t1", "WASM Bob has t1");
  });

  await test("parity: agent setMeta scalar", async () => {
    const { tsState, wasmState, tsEngine, wasmEngine } = await parityCheck([
      { type: "agent:create", payload: { id: "a1", name: "Alice" } },
      { type: "agent:setMeta", payload: { name: "Alice", key: "score", value: 42 } },
    ]);
    const tsAlice = findTsAgent(tsEngine, "Alice");
    assert.equal(tsAlice.meta.score, 42, "TS meta score");
    assert.equal(wasmState.agents["Alice"].meta.score, 42, "WASM meta score");
  });

  await test("parity: agent setActive(false)", async () => {
    const { tsState, wasmState, tsEngine, wasmEngine } = await parityCheck([
      { type: "agent:create", payload: { id: "a1", name: "Alice" } },
      { type: "agent:setActive", payload: { name: "Alice", active: false } },
    ]);
    const tsAlice = findTsAgent(tsEngine, "Alice");
    assert.equal(tsAlice.active, false, "TS active should be false");
    assert.equal(wasmState.agents["Alice"].active, false, "WASM active should be false");
  });

  await test("parity: agent remove", async () => {
    const { tsState, wasmState, tsEngine, wasmEngine } = await parityCheck([
      { type: "agent:create", payload: { id: "a1", name: "Alice" } },
      { type: "agent:create", payload: { id: "a2", name: "Bob" } },
      { type: "agent:remove", payload: { name: "Alice" } },
    ]);
    const tsAlice = tsEngine._agents.find((a: any) => a.name === "Alice");
    assert.ok(!tsAlice, "TS Alice should be removed");
    assert.ok(!wasmState.agents["Alice"], "WASM Alice should be removed");
    assert.ok(wasmState.agents["Bob"], "WASM Bob should remain");
  });

  await test("parity: agent drawCards seeded stack", async () => {
    const { tsState, wasmState, tsEngine, wasmEngine } = await parityCheck([
      { type: "agent:create", payload: { id: "a1", name: "Alice" } },
      { type: "agent:drawCards", payload: { name: "Alice", count: 2 } },
    ]);
    const tsAlice = findTsAgent(tsEngine, "Alice");
    assert.equal(tsAlice.inventory.length, 2, "TS inventory count");
    assert.equal(wasmState.agents["Alice"].inventory.length, 2, "WASM inventory count");
    // Do NOT assert stack.drawn equality: the WASM path does not update it
    // (documented divergence — the TS Stack.draw does).
  });
}

// ── Summary ─────────────────────────────────────────────────────────────────

console.log('');
console.log('='.repeat(72));
console.log('SUMMARY');
console.log('='.repeat(72));
console.log(`  Passed: ${passCount}`);
console.log(`  Failed: ${failCount}`);
console.log(`  Skipped: ${skipCount}`);
console.log(`  Total:  ${testCount + skipCount}`);
console.log('');

if (failCount > 0) {
  console.log(`FAILED (${failCount} failure${failCount > 1 ? 's' : ''})`);
  process.exit(1);
} else {
  console.log('ALL TESTS PASSED' + (skipCount > 0 ? ` (${skipCount} skipped)` : ''));
  process.exit(0);
}
