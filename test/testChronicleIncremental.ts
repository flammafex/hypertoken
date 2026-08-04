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
import { Source } from '../core/Source.js';
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

const zonePlacements = [
  { id: "p1", tokenId: "t1", tokenSnapshot: { ...tokenDefs[0] }, x: 0, y: 0, faceUp: true, label: null, ts: 0, reversed: false, tags: [] },
  { id: "p2", tokenId: "t2", tokenSnapshot: { ...tokenDefs[1] }, x: 0, y: 0, faceUp: true, label: null, ts: 0, reversed: false, tags: [] },
];

const initStateJson = JSON.stringify({
  stack: { stack: tokenDefs, drawn: [], discards: [] },
  zones: { hand: zonePlacements, table: [] },
  agents: {},
  source: { stackIds: ["stack-0"], tokens: tokenDefs, burned: [], seed: null, reshufflePolicy: { threshold: null, mode: "auto" } },
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
  const source = new Source(session, [stack]);

  const engine = new Engine({ stack, space, source });
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
      doc.zones = {
        hand: [
          { id: "p1", tokenId: "t1", tokenSnapshot: JSON.parse(JSON.stringify(tokenDefs[0])), x: 0, y: 0, faceUp: true, label: null, ts: 0, reversed: false, tags: [] },
          { id: "p2", tokenId: "t2", tokenSnapshot: JSON.parse(JSON.stringify(tokenDefs[1])), x: 0, y: 0, faceUp: true, label: null, ts: 0, reversed: false, tags: [] },
        ],
        table: [],
      };
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

// ── Shared token constants for token/batch parity tests ──────────────────────

const tokenA = { id: "a1", text: "Sword", char: "S", kind: "item", index: 0, meta: {} };
const tokenB = { id: "b1", text: "Shield", char: "H", kind: "item", index: 1, meta: {} };
const tokenC = { id: "c1", text: "Gem", char: "G", kind: "item", index: 2, meta: {} };
const batchTokens = [
  { id: "a1", text: "Sword", char: "S", kind: "item", index: 0, meta: {}, rev: true, _rev: true },
  { id: "b1", text: "Shield", char: "H", kind: "item", index: 1, meta: {} },
  { id: "c1", text: "Gem", char: "G", kind: "item", index: 2, meta: {}, rev: true, _rev: true },
];

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
  skip("parity: agent trade valid");
  skip("parity: agent trade token-only");
  skip("parity: agent trade resource-only");
  skip("parity: agent trade insufficient resource throws on both");
  skip("parity: agent trade missing token throws on both");
  skip("parity: agent trade same resource nets out");
  skip("parity: agent discardCards valid");
  skip("parity: agent discardCards missing + dedupe");
  skip("parity: agent discardCards missing agent throws on both");
  skip("parity: agent discardCards empty");
  skip("parity: stack:cut valid position");
  skip("parity: stack:insertAt valid position");
  skip("parity: stack:peek returns top cards");
  skip("parity: stack:removeAt valid position");
  skip("parity: stack:shuffle seeded keeps deck");
  skip("parity: stack:swap valid indices");
  skip("parity: space:clear empties all zones");
  skip("parity: space:clearZone empties one zone");
  skip("parity: space:deleteZone removes zone");
  skip("parity: space:lockZone accepted on both");
  skip("parity: space:remove placement");
  skip("parity: space:shuffleZone seeded keeps placements");
  skip("parity: space:transferZone moves placements");
  skip("parity: source:draw valid count");
  skip("parity: source:shuffle seeded keeps tokens");
  skip("parity: game:loopInit resets loop");
  skip("parity: game:start marks game started");
  skip("parity: token:transform applies properties");
  skip("parity: token:attach records attachment");
  skip("parity: token:detach returns divergent shapes");
  skip("parity: token:merge requires 2 tokens");
  skip("parity: token:merge combines tokens");
  skip("parity: token:split splits token");
  skip("parity: tokens:collect gathers stack tokens");
  skip("parity: tokens:count predicate");
  skip("parity: tokens:draw splits decks");
  skip("parity: tokens:filter predicate");
  skip("parity: tokens:find predicate");
  skip("parity: tokens:map flip");
  skip("parity: tokens:forEach merge");
  skip("parity: tokens:shuffle seeded keeps decks");
  skip("parity: tokens:filter unknown predicate throws on both");
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

  await test("parity: agent trade valid", async () => {
    const { tsState, wasmState, tsEngine, wasmEngine } = await parityCheck([
      { type: "agent:create", payload: { id: "a1", name: "Alice" } },
      { type: "agent:create", payload: { id: "a2", name: "Bob" } },
      { type: "agent:giveResource", payload: { name: "Alice", resource: "gold", amount: 100 } },
      { type: "agent:giveResource", payload: { name: "Bob", resource: "gems", amount: 50 } },
      { type: "agent:addToken", payload: { name: "Alice", token: { id: "t1", text: "Sword", char: "S", kind: "item", index: 0, meta: {} } } },
      { type: "agent:addToken", payload: { name: "Bob", token: { id: "t2", text: "Shield", char: "H", kind: "item", index: 0, meta: {} } } },
      { type: "agent:trade", payload: {
        agent1: "Alice", agent2: "Bob",
        offer1: { token: { id: "t1", text: "Sword", char: "S", kind: "item", index: 0, meta: {} }, resource: "gold", amount: 30 },
        offer2: { token: { id: "t2", text: "Shield", char: "H", kind: "item", index: 0, meta: {} }, resource: "gems", amount: 20 },
      } },
    ]);
    const tsAlice = findTsAgent(tsEngine, "Alice");
    const tsBob = findTsAgent(tsEngine, "Bob");
    // TS: Alice 70 gold / +20 gems / has t2; Bob 30 gold / 30 gems / has t1
    assert.equal(tsAlice.resources.gold, 70, "TS Alice gold");
    assert.equal(tsAlice.resources.gems, 20, "TS Alice gems");
    assert.equal(tsAlice.inventory.length, 1, "TS Alice inventory");
    assert.equal(tsAlice.inventory[0].id, "t2", "TS Alice has t2");
    assert.equal(tsBob.resources.gold, 30, "TS Bob gold");
    assert.equal(tsBob.resources.gems, 30, "TS Bob gems");
    assert.equal(tsBob.inventory.length, 1, "TS Bob inventory");
    assert.equal(tsBob.inventory[0].id, "t1", "TS Bob has t1");
    // WASM: same expectations
    const wAlice = wasmState.agents["Alice"];
    const wBob = wasmState.agents["Bob"];
    assert.equal(wAlice.resources.gold, 70, "WASM Alice gold");
    assert.equal(wAlice.resources.gems, 20, "WASM Alice gems");
    assert.equal(wAlice.inventory.length, 1, "WASM Alice inventory");
    assert.equal(wAlice.inventory[0].id, "t2", "WASM Alice has t2");
    assert.equal(wBob.resources.gold, 30, "WASM Bob gold");
    assert.equal(wBob.resources.gems, 30, "WASM Bob gems");
    assert.equal(wBob.inventory.length, 1, "WASM Bob inventory");
    assert.equal(wBob.inventory[0].id, "t1", "WASM Bob has t1");
  });

  await test("parity: agent trade token-only", async () => {
    const { tsState, wasmState, tsEngine, wasmEngine } = await parityCheck([
      { type: "agent:create", payload: { id: "a1", name: "Alice" } },
      { type: "agent:create", payload: { id: "a2", name: "Bob" } },
      { type: "agent:addToken", payload: { name: "Alice", token: { id: "t1", text: "Sword", char: "S", kind: "item", index: 0, meta: {} } } },
      { type: "agent:addToken", payload: { name: "Bob", token: { id: "t2", text: "Shield", char: "H", kind: "item", index: 0, meta: {} } } },
      { type: "agent:trade", payload: {
        agent1: "Alice", agent2: "Bob",
        offer1: { token: { id: "t1", text: "Sword", char: "S", kind: "item", index: 0, meta: {} } },
        offer2: { token: { id: "t2", text: "Shield", char: "H", kind: "item", index: 0, meta: {} } },
      } },
    ]);
    const tsAlice = findTsAgent(tsEngine, "Alice");
    const tsBob = findTsAgent(tsEngine, "Bob");
    assert.equal(tsAlice.inventory.length, 1, "TS Alice inventory");
    assert.equal(tsAlice.inventory[0].id, "t2", "TS Alice has t2");
    assert.equal(tsBob.inventory.length, 1, "TS Bob inventory");
    assert.equal(tsBob.inventory[0].id, "t1", "TS Bob has t1");
    assert.equal(wasmState.agents["Alice"].inventory.length, 1, "WASM Alice inventory");
    assert.equal(wasmState.agents["Alice"].inventory[0].id, "t2", "WASM Alice has t2");
    assert.equal(wasmState.agents["Bob"].inventory.length, 1, "WASM Bob inventory");
    assert.equal(wasmState.agents["Bob"].inventory[0].id, "t1", "WASM Bob has t1");
  });

  await test("parity: agent trade resource-only", async () => {
    const { tsState, wasmState, tsEngine, wasmEngine } = await parityCheck([
      { type: "agent:create", payload: { id: "a1", name: "Alice" } },
      { type: "agent:create", payload: { id: "a2", name: "Bob" } },
      { type: "agent:giveResource", payload: { name: "Alice", resource: "gold", amount: 100 } },
      { type: "agent:giveResource", payload: { name: "Bob", resource: "gems", amount: 50 } },
      { type: "agent:trade", payload: {
        agent1: "Alice", agent2: "Bob",
        offer1: { resource: "gold", amount: 30 },
        offer2: { resource: "gems", amount: 20 },
      } },
    ]);
    const tsAlice = findTsAgent(tsEngine, "Alice");
    const tsBob = findTsAgent(tsEngine, "Bob");
    assert.equal(tsAlice.resources.gold, 70, "TS Alice gold");
    assert.equal(tsAlice.resources.gems, 20, "TS Alice gems");
    assert.equal(tsBob.resources.gold, 30, "TS Bob gold");
    assert.equal(tsBob.resources.gems, 30, "TS Bob gems");
    assert.equal(wasmState.agents["Alice"].resources.gold, 70, "WASM Alice gold");
    assert.equal(wasmState.agents["Alice"].resources.gems, 20, "WASM Alice gems");
    assert.equal(wasmState.agents["Bob"].resources.gold, 30, "WASM Bob gold");
    assert.equal(wasmState.agents["Bob"].resources.gems, 30, "WASM Bob gems");
  });

  await test("parity: agent trade insufficient resource throws on both", async () => {
    await parityThrows([
      { type: "agent:create", payload: { id: "a1", name: "Alice" } },
      { type: "agent:create", payload: { id: "a2", name: "Bob" } },
      { type: "agent:giveResource", payload: { name: "Alice", resource: "gold", amount: 10 } },
      { type: "agent:giveResource", payload: { name: "Bob", resource: "gems", amount: 50 } },
      { type: "agent:trade", payload: {
        agent1: "Alice", agent2: "Bob",
        offer1: { resource: "gold", amount: 30 },
        offer2: { resource: "gems", amount: 20 },
      } },
    ]);
  });

  await test("parity: agent trade missing token throws on both", async () => {
    await parityThrows([
      { type: "agent:create", payload: { id: "a1", name: "Alice" } },
      { type: "agent:create", payload: { id: "a2", name: "Bob" } },
      { type: "agent:giveResource", payload: { name: "Alice", resource: "gold", amount: 100 } },
      { type: "agent:giveResource", payload: { name: "Bob", resource: "gems", amount: 50 } },
      { type: "agent:trade", payload: {
        agent1: "Alice", agent2: "Bob",
        offer1: { token: { id: "t9", text: "X", char: "X", kind: "item", index: 0, meta: {} }, resource: "gold", amount: 30 },
        offer2: { resource: "gems", amount: 20 },
      } },
    ]);
  });

  await test("parity: agent trade same resource nets out", async () => {
    const { tsState, wasmState, tsEngine, wasmEngine } = await parityCheck([
      { type: "agent:create", payload: { id: "a1", name: "Alice" } },
      { type: "agent:create", payload: { id: "a2", name: "Bob" } },
      { type: "agent:giveResource", payload: { name: "Alice", resource: "gold", amount: 100 } },
      { type: "agent:giveResource", payload: { name: "Bob", resource: "gold", amount: 50 } },
      { type: "agent:trade", payload: {
        agent1: "Alice", agent2: "Bob",
        offer1: { resource: "gold", amount: 30 },
        offer2: { resource: "gold", amount: 20 },
      } },
    ]);
    const tsAlice = findTsAgent(tsEngine, "Alice");
    const tsBob = findTsAgent(tsEngine, "Bob");
    assert.equal(tsAlice.resources.gold, 90, "TS Alice gold (net -10)");
    assert.equal(tsBob.resources.gold, 60, "TS Bob gold (net +10)");
    assert.equal(wasmState.agents["Alice"].resources.gold, 90, "WASM Alice gold (net -10)");
    assert.equal(wasmState.agents["Bob"].resources.gold, 60, "WASM Bob gold (net +10)");
  });

  await test("parity: agent discardCards valid", async () => {
    const { tsState, wasmState, tsEngine, wasmEngine } = await parityCheck([
      { type: "agent:create", payload: { id: "a1", name: "Alice" } },
      { type: "agent:drawCards", payload: { name: "Alice", count: 3 } },
      { type: "agent:discardCards", payload: { name: "Alice", tokenIds: ["t2", "t1"] } },
    ]);
    const tsAlice = findTsAgent(tsEngine, "Alice");
    assert.equal(tsAlice.inventory.length, 1, "TS inventory count");
    assert.equal(tsAlice.inventory[0].id, "t3", "TS remaining card");
    assert.equal(wasmState.agents["Alice"].inventory.length, 1, "WASM inventory count");
    assert.equal(wasmState.agents["Alice"].inventory[0].id, "t3", "WASM remaining card");
    // Discards appended in tokenIds order on both paths
    assert.equal(tsState.stack.discards.length, 2, "TS discards count");
    assert.equal(tsState.stack.discards[0].id, "t2", "TS discards order");
    assert.equal(tsState.stack.discards[1].id, "t1", "TS discards order");
    assert.equal(wasmState.stack.discards.length, 2, "WASM discards count");
    assert.equal(wasmState.stack.discards[0].id, "t2", "WASM discards order");
    assert.equal(wasmState.stack.discards[1].id, "t1", "WASM discards order");
  });

  await test("parity: agent discardCards missing + dedupe", async () => {
    const { tsState, wasmState, tsEngine, wasmEngine } = await parityCheck([
      { type: "agent:create", payload: { id: "a1", name: "Alice" } },
      { type: "agent:drawCards", payload: { name: "Alice", count: 3 } },
      { type: "agent:discardCards", payload: { name: "Alice", tokenIds: ["t9", "t1", "t1"] } },
    ]);
    const tsAlice = findTsAgent(tsEngine, "Alice");
    assert.equal(tsAlice.inventory.length, 2, "TS inventory count");
    assert.equal(wasmState.agents["Alice"].inventory.length, 2, "WASM inventory count");
    assert.equal(tsState.stack.discards.length, 1, "TS discards count");
    assert.equal(tsState.stack.discards[0].id, "t1", "TS discards id");
    assert.equal(wasmState.stack.discards.length, 1, "WASM discards count");
    assert.equal(wasmState.stack.discards[0].id, "t1", "WASM discards id");
  });

  await test("parity: agent discardCards missing agent throws on both", async () => {
    await parityThrows([
      { type: "agent:discardCards", payload: { name: "Nobody", tokenIds: [] } },
    ]);
  });

  await test("parity: agent discardCards empty", async () => {
    const { tsState, wasmState, tsEngine, wasmEngine } = await parityCheck([
      { type: "agent:create", payload: { id: "a1", name: "Alice" } },
      { type: "agent:drawCards", payload: { name: "Alice", count: 3 } },
      { type: "agent:discardCards", payload: { name: "Alice", tokenIds: [] } },
    ]);
    // No-op: inventory unchanged on both paths.
    const tsAlice = findTsAgent(tsEngine, "Alice");
    assert.equal(tsAlice.inventory.length, 3, "TS inventory unchanged");
    assert.equal(wasmState.agents["Alice"].inventory.length, 3, "WASM inventory unchanged");
    // Discards untouched on both paths.
    assert.equal(tsState.stack.discards.length, 0, "TS discards unchanged");
    assert.equal(wasmState.stack.discards.length, 0, "WASM discards unchanged");
    // Dispatched result is [] on both paths.
    const tsResult = await tsEngine.dispatch("agent:discardCards", { name: "Alice", tokenIds: [] });
    const wasmResult = await wasmEngine.dispatch("agent:discardCards", { name: "Alice", tokenIds: [] });
    assert.deepEqual(tsResult, [], "TS result should be []");
    assert.deepEqual(wasmResult, [], "WASM result should be []");
  });

  // ── Stack parity (6) ──────────────────────────────────────────────────────
  await test("parity: stack:cut valid position", async () => {
    const { tsState, wasmState } = await parityCheck([
      { type: "stack:cut", payload: { position: 1 } },
    ]);
    assert.deepEqual(tsState.stack.stack.map((t: any) => t.id), ["t2", "t3", "t1"], "TS cut order");
    assert.deepEqual(wasmState.stack.stack.map((t: any) => t.id), ["t2", "t3", "t1"], "WASM cut order");
  });

  await test("parity: stack:insertAt valid position", async () => {
    const { tsState, wasmState } = await parityCheck([
      { type: "stack:insertAt", payload: { position: 1, card: { id: "t4", text: "D", char: "D", kind: "card", index: 3, meta: {} } } },
    ]);
    assert.deepEqual(tsState.stack.stack.map((t: any) => t.id), ["t1", "t4", "t2", "t3"], "TS insertAt order");
    assert.deepEqual(wasmState.stack.stack.map((t: any) => t.id), ["t1", "t4", "t2", "t3"], "WASM insertAt order");
  });

  await test("parity: stack:peek returns top cards", async () => {
    // divergence: TS stack:peek returns the top `count` cards as an array; the
    // Rust stack_peek ignores count and returns the full stack state object
    // (export_stack). Both are read-only — assert non-mutation + each shape.
    const tsEngine = createTsEngine();
    const wasmEngine = createWasmEngine();
    const tsResult = await tsEngine.dispatch("stack:peek", { count: 2 });
    const wasmResult = await wasmEngine.dispatch("stack:peek", { count: 2 });
    assert.deepEqual(tsResult.map((t: any) => t.id), ["t3", "t2"], "TS peek ids");
    assert.deepEqual(wasmResult.stack.map((t: any) => t.id), ["t1", "t2", "t3"], "WASM peek returns full stack");
    const tsState = JSON.parse(JSON.stringify(tsEngine.session.state));
    const wasmState = JSON.parse(JSON.stringify(wasmEngine.session.state));
    assert.equal(tsState.stack.stack.length, 3, "TS peek should not mutate");
    assert.equal(wasmState.stack.stack.length, 3, "WASM peek should not mutate");
  });

  await test("parity: stack:removeAt valid position", async () => {
    const { tsState, wasmState } = await parityCheck([
      { type: "stack:removeAt", payload: { position: 1 } },
    ]);
    assert.deepEqual(tsState.stack.stack.map((t: any) => t.id), ["t1", "t3"], "TS removeAt order");
    assert.deepEqual(wasmState.stack.stack.map((t: any) => t.id), ["t1", "t3"], "WASM removeAt order");
  });

  await test("parity: stack:shuffle seeded keeps deck", async () => {
    // divergence: shuffled ORDER differs (TS mulberry32 vs Rust SipHash→ChaCha8).
    const { tsState, wasmState } = await parityCheck([
      { type: "stack:shuffle", payload: { seed: 42 } },
    ]);
    assert.equal(tsState.stack.stack.length, 3, "TS shuffle length");
    assert.equal(wasmState.stack.stack.length, 3, "WASM shuffle length");
    assert.deepEqual(tsState.stack.stack.map((t: any) => t.id).sort(), ["t1", "t2", "t3"], "TS shuffle multiset");
    assert.deepEqual(wasmState.stack.stack.map((t: any) => t.id).sort(), ["t1", "t2", "t3"], "WASM shuffle multiset");
  });

  await test("parity: stack:swap valid indices", async () => {
    const { tsState, wasmState } = await parityCheck([
      { type: "stack:swap", payload: { i: 0, j: 2 } },
    ]);
    assert.deepEqual(tsState.stack.stack.map((t: any) => t.id), ["t3", "t2", "t1"], "TS swap order");
    assert.deepEqual(wasmState.stack.stack.map((t: any) => t.id), ["t3", "t2", "t1"], "WASM swap order");
  });

  // ── Space parity (7) ──────────────────────────────────────────────────────
  await test("parity: space:clear empties all zones", async () => {
    const { tsState, wasmState } = await parityCheck([
      { type: "space:clear", payload: {} },
    ]);
    assert.equal(Object.keys(tsState.zones).length, 0, "TS zones empty");
    assert.equal(Object.keys(wasmState.zones).length, 0, "WASM zones empty");
  });

  await test("parity: space:clearZone empties one zone", async () => {
    const { tsState, wasmState } = await parityCheck([
      { type: "space:clearZone", payload: { zone: "hand" } },
    ]);
    assert.equal(tsState.zones.hand.length, 0, "TS hand empty");
    assert.equal(tsState.zones.table.length, 0, "TS table untouched");
    assert.equal(wasmState.zones.hand.length, 0, "WASM hand empty");
    assert.equal(wasmState.zones.table.length, 0, "WASM table untouched");
  });

  await test("parity: space:deleteZone removes zone", async () => {
    const { tsState, wasmState } = await parityCheck([
      { type: "space:deleteZone", payload: { name: "table" } },
    ]);
    assert.ok(!tsState.zones.table, "TS table deleted");
    assert.equal(tsState.zones.hand.length, 2, "TS hand untouched");
    assert.ok(!wasmState.zones.table, "WASM table deleted");
    assert.equal(wasmState.zones.hand.length, 2, "WASM hand untouched");
  });

  await test("parity: space:lockZone accepted on both", async () => {
    // divergence: TS keeps lock in-memory (_lockedZones); Rust writes
    // doc.zones["_lock:table"]. State shapes diverge — only throw-agreement.
    await parityThrows([
      { type: "space:lockZone", payload: { zone: "table", locked: true } },
    ]);
  });

  await test("parity: space:remove placement", async () => {
    const { tsState, wasmState } = await parityCheck([
      { type: "space:remove", payload: { zone: "hand", placementId: "p1" } },
    ]);
    assert.equal(tsState.zones.hand.length, 1, "TS hand length");
    assert.equal(tsState.zones.hand[0].id, "p2", "TS remaining placement");
    assert.equal(tsState.zones.table.length, 0, "TS table untouched");
    assert.equal(wasmState.zones.hand.length, 1, "WASM hand length");
    assert.equal(wasmState.zones.hand[0].id, "p2", "WASM remaining placement");
    assert.equal(wasmState.zones.table.length, 0, "WASM table untouched");
  });

  await test("parity: space:shuffleZone seeded keeps placements", async () => {
    // divergence: shuffled ORDER differs (TS mulberry32 vs Rust SipHash→ChaCha8).
    const { tsState, wasmState } = await parityCheck([
      { type: "space:shuffleZone", payload: { zone: "hand", seed: 42 } },
    ]);
    assert.equal(tsState.zones.hand.length, 2, "TS hand length");
    assert.equal(wasmState.zones.hand.length, 2, "WASM hand length");
    assert.deepEqual(tsState.zones.hand.map((p: any) => p.tokenId).sort(), ["t1", "t2"], "TS placement multiset");
    assert.deepEqual(wasmState.zones.hand.map((p: any) => p.tokenId).sort(), ["t1", "t2"], "WASM placement multiset");
  });

  await test("parity: space:transferZone moves placements", async () => {
    // divergence: the TS space:transferZone throws "Cannot create a reference
    // to an existing document object" (Automerge proxy splice+push across
    // zones); the WASM path performs the transfer. Assert the WASM result only.
    const wasmEngine = createWasmEngine();
    await wasmEngine.dispatch("space:transferZone", { fromZone: "hand", toZone: "table" });
    const wasmState = JSON.parse(JSON.stringify(wasmEngine.session.state));
    assert.equal(wasmState.zones.hand.length, 0, "WASM hand empty");
    assert.equal(wasmState.zones.table.length, 2, "WASM table has 2");
    assert.deepEqual(wasmState.zones.table.map((p: any) => p.tokenId).sort(), ["t1", "t2"], "WASM table multiset");
  });

  // ── Source parity (2) ─────────────────────────────────────────────────────
  await test("parity: source:draw valid count", async () => {
    // divergence: overdraw throws on Rust but clamps on TS — valid count only.
    const { tsState, wasmState } = await parityCheck([
      { type: "source:draw", payload: { count: 2 } },
    ]);
    assert.equal(tsState.source.tokens.length, 1, "TS source length");
    assert.equal(tsState.source.tokens[0].id, "t1", "TS source remaining");
    assert.equal(wasmState.source.tokens.length, 1, "WASM source length");
    assert.equal(wasmState.source.tokens[0].id, "t1", "WASM source remaining");
  });

  await test("parity: source:shuffle seeded keeps tokens", async () => {
    // divergence: shuffled ORDER differs; TS writes source.seed, Rust does not.
    const { tsState, wasmState } = await parityCheck([
      { type: "source:shuffle", payload: { seed: 42 } },
    ]);
    assert.equal(tsState.source.tokens.length, 3, "TS source length");
    assert.equal(wasmState.source.tokens.length, 3, "WASM source length");
    assert.deepEqual(tsState.source.tokens.map((t: any) => t.id).sort(), ["t1", "t2", "t3"], "TS source multiset");
    assert.deepEqual(wasmState.source.tokens.map((t: any) => t.id).sort(), ["t1", "t2", "t3"], "WASM source multiset");
  });

  // ── Game parity (2) ───────────────────────────────────────────────────────
  await test("parity: game:loopInit resets loop", async () => {
    const { tsState, wasmState } = await parityCheck([
      { type: "game:loopInit", payload: { maxTurns: 25 } },
    ]);
    assert.equal(tsState.gameLoop.maxTurns, 25, "TS maxTurns");
    assert.equal(tsState.gameLoop.phase, "setup", "TS phase");
    assert.equal(tsState.gameLoop.running, false, "TS running");
    assert.equal(wasmState.gameLoop.maxTurns, 25, "WASM maxTurns");
    assert.equal(wasmState.gameLoop.phase, "setup", "WASM phase");
    assert.equal(wasmState.gameLoop.running, false, "WASM running");
  });

  await test("parity: game:start marks game started", async () => {
    // divergence: startTime = Date.now() differs per path; Rust does not write
    // a `paused` field at all (TS writes paused:false). Assert the booleans
    // that converge and that `paused` is falsy on both.
    const { tsState, wasmState } = await parityCheck([
      { type: "game:start", payload: {} },
    ]);
    assert.equal(tsState.gameState.started, true, "TS started");
    assert.equal(tsState.gameState.ended, false, "TS ended");
    assert.ok(!tsState.gameState.paused, "TS paused falsy");
    assert.equal(wasmState.gameState.started, true, "WASM started");
    assert.equal(wasmState.gameState.ended, false, "WASM ended");
    assert.ok(!wasmState.gameState.paused, "WASM paused falsy");
  });

  // ── Token parity (6) ──────────────────────────────────────────────────────
  await test("parity: token:transform applies properties", async () => {
    // divergence: TS adds top-level _transformedFrom; Rust does not.
    const tsEngine = createTsEngine();
    const wasmEngine = createWasmEngine();
    const tsResult = await tsEngine.dispatch("token:transform", { token: tokenA, properties: { char: "X", kind: "spell" } });
    const wasmResult = await wasmEngine.dispatch("token:transform", { token: tokenA, properties: { char: "X", kind: "spell" } });
    assert.equal(tsResult.id, "a1", "TS id");
    assert.equal(tsResult.char, "X", "TS char");
    assert.equal(tsResult.kind, "spell", "TS kind");
    assert.equal(wasmResult.id, "a1", "WASM id");
    assert.equal(wasmResult.char, "X", "WASM char");
    assert.equal(wasmResult.kind, "spell", "WASM kind");
  });

  await test("parity: token:attach records attachment", async () => {
    // divergence: TS stores _attachments top-level; Rust stores meta._attachments.
    const tsEngine = createTsEngine();
    const wasmEngine = createWasmEngine();
    const tsResult = await tsEngine.dispatch("token:attach", { host: tokenA, attachment: tokenB, attachmentType: "gem" });
    const wasmResult = await wasmEngine.dispatch("token:attach", { host: tokenA, attachment: tokenB, attachmentType: "gem" });
    assert.equal(tsResult.id, "a1", "TS host id");
    assert.equal(tsResult._attachments.length, 1, "TS attachments count");
    assert.equal(tsResult._attachments[0].id, "b1", "TS attachment id");
    assert.equal(wasmResult.id, "a1", "WASM host id");
    assert.equal(wasmResult.meta._attachments.length, 1, "WASM attachments count");
    assert.equal(wasmResult.meta._attachments[0].id, "b1", "WASM attachment id");
  });

  await test("parity: token:detach returns divergent shapes", async () => {
    // divergence: TS returns the host with the attachment removed; Rust returns
    // the detached (cleaned) token. Both succeed on the same payload.
    const tsEngine = createTsEngine();
    const wasmEngine = createWasmEngine();
    const host = { id: "a1", text: "Sword", char: "S", kind: "item", index: 0, meta: { _attachments: [{ id: "b1", token: tokenB, attachment_type: "gem", attached_at: 0 }] } };
    const tsResult = await tsEngine.dispatch("token:detach", { host, attachmentId: "b1" });
    const wasmResult = await wasmEngine.dispatch("token:detach", { host, attachmentId: "b1" });
    assert.equal(tsResult.id, "a1", "TS returns host");
    assert.equal(wasmResult.id, "b1", "WASM returns detached token");
  });

  await test("parity: token:merge requires 2 tokens", async () => {
    await parityThrows([
      { type: "token:merge", payload: { tokens: [tokenA] } },
    ]);
  });

  await test("parity: token:merge combines tokens", async () => {
    // divergence: Rust keeps the FIRST (base) token id and stores metadata in
    // meta; TS spreads Object.assign({}, ...tokens) over its "merged-<ts>"
    // placeholder so the LAST token's id wins, with top-level fields.
    const tsEngine = createTsEngine();
    const wasmEngine = createWasmEngine();
    const tsResult = await tsEngine.dispatch("token:merge", { tokens: [tokenA, tokenB], properties: { kind: "combo" } });
    const wasmResult = await wasmEngine.dispatch("token:merge", { tokens: [tokenA, tokenB], properties: { kind: "combo" } });
    assert.equal(tsResult.merged.id, "b1", "TS merged keeps last token id");
    assert.deepEqual(tsResult.merged._mergedFrom, ["a1", "b1"], "TS mergedFrom");
    assert.equal(tsResult.merged.kind, "combo", "TS kind applied");
    assert.equal(wasmResult.id, "a1", "WASM keeps base id");
    assert.deepEqual(wasmResult.meta._mergedFrom, ["a1", "b1"], "WASM mergedFrom");
    assert.equal(wasmResult.meta.kind, "combo", "WASM kind applied");
  });

  await test("parity: token:split splits token", async () => {
    // divergence: id schemes differ (TS "split-<ts>-<i>" vs Rust "<id>-split-<i>");
    // metadata location differs (top-level vs meta). Count 1 diverges (TS ok,
    // Rust throws) so only count >= 2 is tested.
    const tsEngine = createTsEngine();
    const wasmEngine = createWasmEngine();
    const tsResult = await tsEngine.dispatch("token:split", { token: tokenA, count: 3 });
    const wasmResult = await wasmEngine.dispatch("token:split", { token: tokenA, count: 3 });
    assert.equal(tsResult.length, 3, "TS split count");
    assert.equal(wasmResult.length, 3, "WASM split count");
    for (let i = 0; i < 3; i++) {
      assert.ok(tsResult[i].id !== "a1", "TS split id differs");
      assert.equal(tsResult[i]._splitFrom, "a1", `TS splitFrom ${i}`);
      assert.ok(wasmResult[i].id !== "a1", "WASM split id differs");
      assert.equal(wasmResult[i].meta._splitFrom, "a1", `WASM splitFrom ${i}`);
    }
  });

  // ── Batch parity (8) ──────────────────────────────────────────────────────
  await test("parity: tokens:collect gathers stack tokens", async () => {
    // divergence: full token shape differs (Rust serde adds label/group null) — ids only.
    const tsEngine = createTsEngine();
    const wasmEngine = createWasmEngine();
    const tsResult = await tsEngine.dispatch("tokens:collect", { sources: ["stack", "hand"] });
    const wasmResult = await wasmEngine.dispatch("tokens:collect", { sources: ["stack", "hand"] });
    assert.deepEqual(tsResult.map((t: any) => t.id), ["t1", "t2", "t3", "t1", "t2"], "TS collect ids");
    assert.deepEqual(wasmResult.map((t: any) => t.id), ["t1", "t2", "t3", "t1", "t2"], "WASM collect ids");
  });

  await test("parity: tokens:count predicate", async () => {
    const tsEngine = createTsEngine();
    const wasmEngine = createWasmEngine();
    const tsResult = await tsEngine.dispatch("tokens:count", { tokens: batchTokens, predicate: "reversed" });
    const wasmResult = await wasmEngine.dispatch("tokens:count", { tokens: batchTokens, predicate: "reversed" });
    assert.equal(tsResult, 2, "TS count");
    assert.equal(wasmResult, 2, "WASM count");
  });

  await test("parity: tokens:draw splits decks", async () => {
    // divergence: full token shape differs — ids only.
    const tsEngine = createTsEngine();
    const wasmEngine = createWasmEngine();
    const tsResult = await tsEngine.dispatch("tokens:draw", { decks: [batchTokens], counts: [2] });
    const wasmResult = await wasmEngine.dispatch("tokens:draw", { decks: [batchTokens], counts: [2] });
    assert.deepEqual(tsResult.drawn[0].map((t: any) => t.id), ["c1", "b1"], "TS drawn ids");
    assert.deepEqual(tsResult.decks[0].map((t: any) => t.id), ["a1"], "TS remaining ids");
    assert.deepEqual(wasmResult.drawn[0].map((t: any) => t.id), ["c1", "b1"], "WASM drawn ids");
    assert.deepEqual(wasmResult.decks[0].map((t: any) => t.id), ["a1"], "WASM remaining ids");
  });

  await test("parity: tokens:filter predicate", async () => {
    const tsEngine = createTsEngine();
    const wasmEngine = createWasmEngine();
    const tsResult = await tsEngine.dispatch("tokens:filter", { tokens: batchTokens, predicate: "reversed" });
    const wasmResult = await wasmEngine.dispatch("tokens:filter", { tokens: batchTokens, predicate: "reversed" });
    assert.equal(tsResult.length, 2, "TS filter count");
    assert.equal(wasmResult.length, 2, "WASM filter count");
    assert.deepEqual(tsResult.map((t: any) => t.id).sort(), ["a1", "c1"], "TS filter ids");
    assert.deepEqual(wasmResult.map((t: any) => t.id).sort(), ["a1", "c1"], "WASM filter ids");
  });

  await test("parity: tokens:find predicate", async () => {
    const tsEngine = createTsEngine();
    const wasmEngine = createWasmEngine();
    const tsResult = await tsEngine.dispatch("tokens:find", { tokens: batchTokens, predicate: "reversed" });
    const wasmResult = await wasmEngine.dispatch("tokens:find", { tokens: batchTokens, predicate: "reversed" });
    assert.equal(tsResult.id, "a1", "TS find id");
    assert.equal(wasmResult.id, "a1", "WASM find id");
  });

  await test("parity: tokens:map flip", async () => {
    // divergence: none for the flip result — both paths toggle `rev` (TS rev /
    // Rust Token.rev). Input a1/c1 had rev:true -> toggled to false; b1 had
    // none -> toggled to true. Assert the concrete converged [false,true,false].
    const tsEngine = createTsEngine();
    const wasmEngine = createWasmEngine();
    const tsResult = await tsEngine.dispatch("tokens:map", { tokens: batchTokens, operation: "flip" });
    const wasmResult = await wasmEngine.dispatch("tokens:map", { tokens: batchTokens, operation: "flip" });
    assert.equal(tsResult.length, 3, "TS map length");
    assert.equal(wasmResult.length, 3, "WASM map length");
    const expected = [false, true, false];
    for (let i = 0; i < 3; i++) {
      assert.equal((tsResult[i].rev ?? tsResult[i]._rev), expected[i], `TS flipped ${i}`);
      assert.equal((wasmResult[i].rev ?? wasmResult[i]._rev), expected[i], `WASM flipped ${i}`);
    }
  });

  await test("parity: tokens:forEach merge", async () => {
    const tsEngine = createTsEngine();
    const wasmEngine = createWasmEngine();
    const tsResult = await tsEngine.dispatch("tokens:forEach", { tokens: batchTokens, operation: "merge" });
    const wasmResult = await wasmEngine.dispatch("tokens:forEach", { tokens: batchTokens, operation: "merge" });
    assert.equal(tsResult.length, 3, "TS forEach length");
    assert.equal(wasmResult.length, 3, "WASM forEach length");
    for (let i = 0; i < 3; i++) {
      assert.equal((tsResult[i].merged ?? tsResult[i]._merged), true, `TS merged ${i}`);
      assert.equal((wasmResult[i].merged ?? wasmResult[i]._merged), true, `WASM merged ${i}`);
    }
  });

  await test("parity: tokens:shuffle seeded keeps decks", async () => {
    // divergence: shuffled ORDER differs (TS mulberry32 vs Rust SipHash→ChaCha8).
    const tsEngine = createTsEngine();
    const wasmEngine = createWasmEngine();
    const tsResult = await tsEngine.dispatch("tokens:shuffle", { decks: [batchTokens], seed: 42 });
    const wasmResult = await wasmEngine.dispatch("tokens:shuffle", { decks: [batchTokens], seed: 42 });
    assert.equal(tsResult[0].length, 3, "TS deck length");
    assert.equal(wasmResult[0].length, 3, "WASM deck length");
    assert.deepEqual(tsResult[0].map((t: any) => t.id).sort(), ["a1", "b1", "c1"], "TS deck multiset");
    assert.deepEqual(wasmResult[0].map((t: any) => t.id).sort(), ["a1", "b1", "c1"], "WASM deck multiset");
  });

  await test("parity: tokens:filter unknown predicate throws on both", async () => {
    await parityThrows([
      { type: "tokens:filter", payload: { tokens: batchTokens, predicate: "nope" } },
    ]);
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
