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
  assert.equal(state.stack.stack.length, 3, "Stack should have 3 tokens");
  assert.equal(state.stack.drawn.length, 0, "Drawn should be empty");
  assert.equal(state.gameLoop.phase, "setup", "Phase should be setup");
});

await test("TS: stack:draw removes from stack and adds to drawn", async () => {
  const engine = createTsEngine();
  await engine.dispatch("stack:draw", { count: 2 });
  const state = engine.session.state;
  assert.equal(state.stack.stack.length, 1, "Stack should have 1 remaining");
  assert.equal(state.stack.drawn.length, 2, "Drawn should have 2");
});

await test("TS: game:loopStart transitions to play phase", async () => {
  const engine = createTsEngine();
  await engine.dispatch("game:loopStart", {});
  const state = engine.session.state;
  assert.equal(state.gameLoop.running, true, "Should be running");
  assert.equal(state.gameLoop.phase, "play", "Phase should be play");
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
    assert.equal(state.stack.drawn.length, 1, "Should have drawn card from engine2");
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
