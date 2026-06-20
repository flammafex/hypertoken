/*
 * test/testSyncSpike.ts
 *
 * Phase 1 CRDT sync spike for Cuttle CRDT demo.
 *
 * Tests that ConsensusCore sync actually works for:
 * 1. Basic state convergence (A dispatches, B sees it)
 * 2. Bidirectional sync (B dispatches, A sees it)
 * 3. Disconnect and reconnect (state catches up)
 * 4. Concurrent edits (both dispatch simultaneously, CRDT merges)
 *
 * Uses disableWasm: true to force TS Chronicle path (optional — WASM sync also works).
 */
import { Engine } from "../engine/Engine.js";
import { UniversalRelayServer } from "../network/UniversalRelayServer.js";
import { Token } from "../core/Token.js";
import { Stack } from "../core/Stack.js";
import { Chronicle } from "../core/Chronicle.js";

let passed = 0;
let failed = 0;

function test(name: string, fn: () => void | Promise<void>): void {
  // placeholder — actual run is async, see runTests()
}

function assert(condition: any, message: string): void {
  if (!condition) throw new Error(message);
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function runTest(name: string, fn: () => Promise<void>): Promise<void> {
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

async function runTests(): Promise<void> {
  console.log("🔗 Phase 1: CRDT Sync Spike\n");

  // Start relay server
  const server = new UniversalRelayServer({ port: 9091, verbose: false });
  await server.start();
  console.log("  Relay server started on :9091\n");

  // --- Test 1: Basic state convergence ---
  await runTest("Basic state convergence (A → B)", async () => {
    const engineA = new Engine({ disableWasm: true });
    const engineB = new Engine({ disableWasm: true });

    const cardsA = [
      new Token({ id: "c1", label: "Card 1" }),
      new Token({ id: "c2", label: "Card 2" }),
    ];
    const stackA = new Stack(engineA.session as Chronicle, cardsA);
    engineA.stack = stackA;

    engineA.connect("ws://localhost:9091");
    engineB.connect("ws://localhost:9091");

    await sleep(500);

    // B adopts synced state
    const stackB = new Stack(engineB.session as Chronicle, []);
    engineB.stack = stackB;

    // A draws a card
    await engineA.dispatch("stack:draw", { count: 1 });
    await sleep(500);

    assert(engineB.stack?.size === 1, `B should have 1 card in stack, has ${engineB.stack?.size}`);
    assert(engineB.stack?.drawn.length === 1, `B should have 1 drawn card, has ${engineB.stack?.drawn.length}`);

    engineA.disconnect();
    engineB.disconnect();
    await sleep(200);
  });

  // --- Test 2: Bidirectional sync (B → A) ---
  await runTest("Bidirectional sync (B → A)", async () => {
    const engineA = new Engine({ disableWasm: true });
    const engineB = new Engine({ disableWasm: true });

    const cardsA = [
      new Token({ id: "b1", label: "Card B1" }),
      new Token({ id: "b2", label: "Card B2" }),
      new Token({ id: "b3", label: "Card B3" }),
    ];
    const stackA = new Stack(engineA.session as Chronicle, cardsA);
    engineA.stack = stackA;

    engineA.connect("ws://localhost:9091");
    engineB.connect("ws://localhost:9091");

    await sleep(500);

    const stackB = new Stack(engineB.session as Chronicle, []);
    engineB.stack = stackB;

    // B draws a card (not A)
    await engineB.dispatch("stack:draw", { count: 1 });
    await sleep(500);

    assert(engineA.stack?.size === 2, `A should have 2 cards in stack, has ${engineA.stack?.size}`);
    assert(engineA.stack?.drawn.length === 1, `A should have 1 drawn card, has ${engineA.stack?.drawn.length}`);

    engineA.disconnect();
    engineB.disconnect();
    await sleep(200);
  });

  // --- Test 3: Disconnect and reconnect ---
  await runTest("Disconnect and reconnect (state catches up)", async () => {
    const engineA = new Engine({ disableWasm: true });
    const engineB = new Engine({ disableWasm: true });

    const cardsA = [
      new Token({ id: "d1", label: "Card D1" }),
      new Token({ id: "d2", label: "Card D2" }),
      new Token({ id: "d3", label: "Card D3" }),
    ];
    const stackA = new Stack(engineA.session as Chronicle, cardsA);
    engineA.stack = stackA;

    engineA.connect("ws://localhost:9091");
    engineB.connect("ws://localhost:9091");

    await sleep(500);

    const stackB = new Stack(engineB.session as Chronicle, []);
    engineB.stack = stackB;

    // B disconnects
    engineB.disconnect();
    await sleep(300);

    // A makes changes while B is gone
    await engineA.dispatch("stack:draw", { count: 1 });
    await sleep(200);

    // B reconnects
    engineB.connect("ws://localhost:9091");
    await sleep(1000);

    // B should catch up — stack should have 2 cards, 1 drawn
    assert(engineB.stack?.size === 2, `B after reconnect should have 2 cards, has ${engineB.stack?.size}`);
    assert(engineB.stack?.drawn.length === 1, `B after reconnect should have 1 drawn, has ${engineB.stack?.drawn.length}`);

    engineA.disconnect();
    engineB.disconnect();
    await sleep(200);
  });

  // --- Test 4: Concurrent edits (CRDT merge) ---
  await runTest("Concurrent edits (both dispatch simultaneously)", async () => {
    const engineA = new Engine({ disableWasm: true });
    const engineB = new Engine({ disableWasm: true });

    // Use space:place for concurrent edits (different zones, no conflict)
    const cardsA = [
      new Token({ id: "cc1", label: "Concurrent Card 1" }),
      new Token({ id: "cc2", label: "Concurrent Card 2" }),
    ];
    const stackA = new Stack(engineA.session as Chronicle, cardsA);
    engineA.stack = stackA;

    engineA.connect("ws://localhost:9091");
    engineB.connect("ws://localhost:9091");

    await sleep(500);

    const stackB = new Stack(engineB.session as Chronicle, []);
    engineB.stack = stackB;

    // Both draw simultaneously
    await Promise.all([
      engineA.dispatch("stack:draw", { count: 1 }),
      engineB.dispatch("stack:draw", { count: 1 }),
    ]);

    await sleep(1000);

    // CRDT should merge — both should see 0 in stack, 2 drawn
    // (This is the key test: concurrent draws from the same stack)
    const aStack = engineA.stack?.size ?? -1;
    const aDrawn = engineA.stack?.drawn.length ?? -1;
    const bStack = engineB.stack?.size ?? -1;
    const bDrawn = engineB.stack?.drawn.length ?? -1;

    console.log(`    A: stack=${aStack}, drawn=${aDrawn}`);
    console.log(`    B: stack=${bStack}, drawn=${bDrawn}`);

    // Both should converge to the same state
    assert(aStack === bStack, `A and B stack sizes should match: A=${aStack}, B=${bStack}`);
    assert(aDrawn === bDrawn, `A and B drawn counts should match: A=${aDrawn}, B=${bDrawn}`);

    engineA.disconnect();
    engineB.disconnect();
    await sleep(200);
  });

  // --- Test 5: Multiple sequential actions ---
  await runTest("Multiple sequential actions (5 draws)", async () => {
    const engineA = new Engine({ disableWasm: true });
    const engineB = new Engine({ disableWasm: true });

    const cardsA: Token[] = [];
    for (let i = 0; i < 10; i++) {
      cardsA.push(new Token({ id: `m${i}`, label: `Multi Card ${i}` }));
    }
    const stackA = new Stack(engineA.session as Chronicle, cardsA);
    engineA.stack = stackA;

    engineA.connect("ws://localhost:9091");
    engineB.connect("ws://localhost:9091");

    await sleep(500);

    const stackB = new Stack(engineB.session as Chronicle, []);
    engineB.stack = stackB;

    // A draws 5 cards, one at a time
    for (let i = 0; i < 5; i++) {
      await engineA.dispatch("stack:draw", { count: 1 });
      await sleep(100);
    }

    await sleep(500);

    assert(engineB.stack?.size === 5, `B should have 5 cards in stack, has ${engineB.stack?.size}`);
    assert(engineB.stack?.drawn.length === 5, `B should have 5 drawn cards, has ${engineB.stack?.drawn.length}`);

    engineA.disconnect();
    engineB.disconnect();
    await sleep(200);
  });

  // Cleanup
  server.stop();

  // Summary
  console.log(`\n${passed} passed, ${failed} failed`);
  if (failed > 0) process.exit(1);
  process.exit(0);
}

runTests().catch(err => {
  console.error("Fatal error:", err);
  process.exit(1);
});
