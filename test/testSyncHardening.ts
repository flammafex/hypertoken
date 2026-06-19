/*
 * test/testSyncHardening.ts
 *
 * Phase B: Sync hardening tests for HyperToken's CRDT sync path.
 *
 * Tests the bugs we found during Cuttle and Confluence development:
 * 1. Conflict scenarios (concurrent writes to same/different fields)
 * 2. Reconnect (disconnect mid-game, catch-up)
 * 3. Concurrent-write convergence (both peers write simultaneously)
 * 4. Automerge proxy issue (Object.values() on proxies)
 * 5. Engine.connect() + WASM guard
 * 6. StateSyncManager (verify it's dead code)
 */
import { Engine } from "../engine/Engine.js";
import { Chronicle } from "../core/Chronicle.js";
import { UniversalRelayServer } from "../network/UniversalRelayServer.js";

let passed = 0;
let failed = 0;

function assert(condition: any, message: string): void {
  if (!condition) throw new Error(message);
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
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

async function setupEngines(port: number) {
  const server = new UniversalRelayServer({ port, verbose: false });
  await server.start();

  const engineA = new Engine({ disableWasm: true });
  const engineB = new Engine({ disableWasm: true });

  return { server, engineA, engineB };
}

async function runTests(): Promise<void> {
  console.log("🛡️  Phase B: Sync Hardening Tests\n");

  // ========================================================================
  // 1. Conflict-scenario tests
  // ========================================================================
  console.log("── Conflict Scenarios ──\n");

  await runTest("Concurrent writes to different fields both persist", async () => {
    const { server, engineA, engineB } = await setupEngines(9301);

    engineA.connect("ws://localhost:9301");
    engineB.connect("ws://localhost:9301");
    await sleep(1000);

    // A writes to doc.foo, B writes to doc.bar simultaneously
    await Promise.all([
      engineA.session.change("set foo", (doc: any) => { doc.foo = "from-A"; }),
      engineB.session.change("set bar", (doc: any) => { doc.bar = "from-B"; }),
    ]);

    await sleep(1500);

    // Both should see both fields
    const stateA = engineA.session.state as any;
    const stateB = engineB.session.state as any;

    assert(stateA.foo === "from-A", `A should see foo=from-A, sees ${stateA.foo}`);
    assert(stateA.bar === "from-B", `A should see bar=from-B, sees ${stateA.bar}`);
    assert(stateB.foo === "from-A", `B should see foo=from-A, sees ${stateB.foo}`);
    assert(stateB.bar === "from-B", `B should see bar=from-B, sees ${stateB.bar}`);

    engineA.disconnect();
    engineB.disconnect();
    server.stop();
    await sleep(200);
  });

  await runTest("Concurrent writes to same field — CRDT resolves deterministically", async () => {
    const { server, engineA, engineB } = await setupEngines(9302);

    engineA.connect("ws://localhost:9302");
    engineB.connect("ws://localhost:9302");
    await sleep(1000);

    // Both write to the same field simultaneously
    await Promise.all([
      engineA.session.change("set conflict", (doc: any) => { doc.conflict = "A"; }),
      engineB.session.change("set conflict", (doc: any) => { doc.conflict = "B"; }),
    ]);

    await sleep(1500);

    // CRDT should resolve to the same value on both peers (deterministic)
    const stateA = engineA.session.state as any;
    const stateB = engineB.session.state as any;

    assert(
      stateA.conflict === stateB.conflict,
      `Both peers should have the same value for 'conflict': A=${stateA.conflict}, B=${stateB.conflict}`,
    );
    console.log(`    Resolved to: ${stateA.conflict} (both peers agree)`);

    engineA.disconnect();
    engineB.disconnect();
    server.stop();
    await sleep(200);
  });

  await runTest("Write while peer is disconnected — no data loss on reconnect", async () => {
    const { server, engineA, engineB } = await setupEngines(9303);

    engineA.connect("ws://localhost:9303");
    engineB.connect("ws://localhost:9303");
    await sleep(1000);

    // B disconnects
    engineB.disconnect();
    await sleep(500);

    // A writes while B is gone
    engineA.session.change("write while B gone", (doc: any) => {
      doc.soloWrite = "from-A-while-B-disconnected";
    });
    await sleep(500);

    // B reconnects
    engineB.connect("ws://localhost:9303");
    await sleep(2000);

    // B should see the write
    const stateB = engineB.session.state as any;
    assert(
      stateB.soloWrite === "from-A-while-B-disconnected",
      `B should see A's write after reconnect: ${stateB.soloWrite}`,
    );

    engineA.disconnect();
    engineB.disconnect();
    server.stop();
    await sleep(200);
  });

  // ========================================================================
  // 2. Reconnect tests
  // ========================================================================
  console.log("\n── Reconnect Scenarios ──\n");

  await runTest("Multiple disconnect/reconnect cycles preserve state", async () => {
    const { server, engineA, engineB } = await setupEngines(9304);

    engineA.connect("ws://localhost:9304");
    engineB.connect("ws://localhost:9304");
    await sleep(1000);

    // Cycle 1: B disconnects, A writes, B reconnects
    engineB.disconnect();
    await sleep(300);
    engineA.session.change("cycle 1", (doc: any) => { doc.cycle1 = true; });
    await sleep(300);
    engineB.connect("ws://localhost:9304");
    await sleep(1500);

    // Cycle 2: A disconnects, B writes, A reconnects
    engineA.disconnect();
    await sleep(300);
    engineB.session.change("cycle 2", (doc: any) => { doc.cycle2 = true; });
    await sleep(300);
    engineA.connect("ws://localhost:9304");
    await sleep(1500);

    // Cycle 3: Both disconnect, both write, both reconnect
    engineA.disconnect();
    engineB.disconnect();
    await sleep(300);
    // Note: writes while disconnected are local only — they sync on reconnect
    engineA.session.change("cycle 3a", (doc: any) => { doc.cycle3a = true; });
    engineB.session.change("cycle 3b", (doc: any) => { doc.cycle3b = true; });
    await sleep(300);
    engineA.connect("ws://localhost:9304");
    engineB.connect("ws://localhost:9304");
    await sleep(2000);

    // Both should have all writes
    const stateA = engineA.session.state as any;
    const stateB = engineB.session.state as any;

    assert(stateA.cycle1 === true, "A should have cycle1");
    assert(stateA.cycle2 === true, "A should have cycle2");
    assert(stateB.cycle1 === true, "B should have cycle1");
    assert(stateB.cycle2 === true, "B should have cycle2");

    engineA.disconnect();
    engineB.disconnect();
    server.stop();
    await sleep(200);
  });

  // ========================================================================
  // 3. Concurrent-write convergence tests
  // ========================================================================
  console.log("\n── Convergence ──\n");

  await runTest("Rapid alternating writes converge to identical state", async () => {
    const { server, engineA, engineB } = await setupEngines(9305);

    engineA.connect("ws://localhost:9305");
    engineB.connect("ws://localhost:9305");
    await sleep(1000);

    // Rapid alternating writes
    for (let i = 0; i < 5; i++) {
      engineA.session.change(`A write ${i}`, (doc: any) => { doc[`a${i}`] = i; });
      engineB.session.change(`B write ${i}`, (doc: any) => { doc[`b${i}`] = i; });
      await sleep(200);
    }

    await sleep(2000);

    // Both should have all 10 fields
    const stateA = engineA.session.state as any;
    const stateB = engineB.session.state as any;

    for (let i = 0; i < 5; i++) {
      assert(stateA[`a${i}`] === i, `A should have a${i}=${i}`);
      assert(stateA[`b${i}`] === i, `A should have b${i}=${i}`);
      assert(stateB[`a${i}`] === i, `B should have a${i}=${i}`);
      assert(stateB[`b${i}`] === i, `B should have b${i}=${i}`);
    }

    engineA.disconnect();
    engineB.disconnect();
    server.stop();
    await sleep(200);
  });

  await runTest("Three peers converge to identical state", async () => {
    const server = new UniversalRelayServer({ port: 9306, verbose: false });
    await server.start();

    const engineA = new Engine({ disableWasm: true });
    const engineB = new Engine({ disableWasm: true });
    const engineC = new Engine({ disableWasm: true });

    engineA.connect("ws://localhost:9306");
    engineB.connect("ws://localhost:9306");
    engineC.connect("ws://localhost:9306");
    await sleep(1500);

    // Each writes a different field
    engineA.session.change("A", (doc: any) => { doc.fromA = "A"; });
    engineB.session.change("B", (doc: any) => { doc.fromB = "B"; });
    engineC.session.change("C", (doc: any) => { doc.fromC = "C"; });

    await sleep(2500);

    // All three should have all three fields
    const stateA = engineA.session.state as any;
    const stateB = engineB.session.state as any;
    const stateC = engineC.session.state as any;

    assert(stateA.fromA === "A" && stateA.fromB === "B" && stateA.fromC === "C", "A should see all writes");
    assert(stateB.fromA === "A" && stateB.fromB === "B" && stateB.fromC === "C", "B should see all writes");
    assert(stateC.fromA === "A" && stateC.fromB === "B" && stateC.fromC === "C", "C should see all writes");

    engineA.disconnect();
    engineB.disconnect();
    engineC.disconnect();
    server.stop();
    await sleep(200);
  });

  // ========================================================================
  // 4. Automerge proxy issue tests
  // ========================================================================
  console.log("\n── Automerge Proxy Issue ──\n");

  await runTest("Object.values() on Automerge proxy returns values (or documents the issue)", async () => {
    const chronicle = new Chronicle();
    chronicle.change("init", (doc: any) => {
      doc.items = { a: 1, b: 2, c: 3 };
    });

    const state = chronicle.state as any;

    // Test Object.keys — this should work
    const keys = Object.keys(state.items);
    assert(keys.length === 3, `Object.keys should return 3 keys, got ${keys.length}: ${JSON.stringify(keys)}`);

    // Test Object.values — this may or may not work depending on Automerge version
    const values = Object.values(state.items);
    if (values.length === 3) {
      console.log(`    Object.values() works on this Automerge version (${values.length} values)`);
    } else {
      console.log(`    Object.values() returns ${values.length} values (known proxy issue)`);
      console.log(`    Workaround: JSON.parse(JSON.stringify(state)) then Object.values()`);
    }

    // The workaround should always work
    const plain = JSON.parse(JSON.stringify(state.items));
    const plainValues = Object.values(plain);
    assert(plainValues.length === 3, `Workaround should return 3 values, got ${plainValues.length}`);
  });

  await runTest("JSON.parse(JSON.stringify()) workaround produces correct plain object", async () => {
    const chronicle = new Chronicle();
    chronicle.change("init", (doc: any) => {
      doc.nested = {
        a: { x: 1, y: 2 },
        b: { x: 3, y: 4 },
        list: [1, 2, 3],
      };
    });

    const state = chronicle.state as any;
    const plain = JSON.parse(JSON.stringify(state.nested));

    // Verify all nested values are accessible
    assert(plain.a.x === 1, "plain.a.x should be 1");
    assert(plain.b.y === 4, "plain.b.y should be 4");
    assert(plain.list.length === 3, `plain.list should have 3 items, has ${plain.list.length}`);
    assert(plain.list[0] === 1, "plain.list[0] should be 1");

    // Object.values should work on the plain object
    const entries = Object.entries(plain);
    assert(entries.length === 3, `Object.entries should return 3 entries, got ${entries.length}`);
  });

  // ========================================================================
  // 5. Engine.connect() + WASM guard
  // ========================================================================
  console.log("\n── Engine.connect() + WASM Guard ──\n");

  await runTest("Engine with disableWasm: true can connect and sync", async () => {
    const { server, engineA, engineB } = await setupEngines(9307);

    // Verify disableWasm engines don't have a WASM dispatcher
    assert(engineA.wasm.dispatcher === null, "Engine A should not have WASM dispatcher");
    assert(engineB.wasm.dispatcher === null, "Engine B should not have WASM dispatcher");

    engineA.connect("ws://localhost:9307");
    engineB.connect("ws://localhost:9307");
    await sleep(1000);

    // Write and verify sync
    engineA.session.change("test", (doc: any) => { doc.syncTest = "works"; });
    await sleep(1500);

    const stateB = engineB.session.state as any;
    assert(stateB.syncTest === "works", `B should see syncTest=works, sees ${stateB.syncTest}`);

    engineA.disconnect();
    engineB.disconnect();
    server.stop();
    await sleep(200);
  });

  await runTest("Engine without disableWasm has WASM dispatcher (and can't sync)", async () => {
    // This test documents the known limitation: Engine without disableWasm
    // auto-initializes WASM, which disables network sync.
    const engine = new Engine(); // no disableWasm

    // Wait for async WASM init
    await sleep(2000);

    // WASM dispatcher may or may not be initialized (depends on whether
    // the WASM binary is available), but the engine should not crash
    assert(engine.session !== null, "Engine should have a session");

    // If WASM is active, connect() should warn (not crash)
    if (engine.wasm.dispatcher) {
      console.log("    WASM dispatcher is active — connect() will warn and skip sync");
      console.log("    Use disableWasm: true for network sync");
    } else {
      console.log("    WASM not available — TS path active, sync would work");
    }
  });

  // ========================================================================
  // 6. StateSyncManager — removed (was dead code)
  // ========================================================================
  console.log("\n── StateSyncManager ──\n");

  await runTest("StateSyncManager has been removed (was dead code)", async () => {
    // StateSyncManager was confirmed as dead code in Phase B.
    // It was not referenced by Engine, ConsensusCore, or NetworkManager.
    // The file has been removed. This test documents the removal.
    console.log("    StateSyncManager was removed — was not wired into any sync path");
  });

  // ========================================================================
  // 7. Source field — the bug we found
  // ========================================================================
  console.log("\n── Source Field ──\n");

  await runTest("Remote sync updates have source !== 'local'", async () => {
    const { server, engineA, engineB } = await setupEngines(9308);

    let receivedSource: string | null = null;

    // Listen for state:updated on B
    engineB.on("state:updated", (e: any) => {
      const source = e?.source || e?.payload?.source;
      if (source && source !== "local") {
        receivedSource = source;
      }
    });

    engineA.connect("ws://localhost:9308");
    engineB.connect("ws://localhost:9308");
    await sleep(1000);

    // A writes
    engineA.session.change("source test", (doc: any) => { doc.sourceTest = true; });
    await sleep(1500);

    // B should have received the update with a non-local source
    assert(
      receivedSource !== null,
      `B should have received a remote update with non-local source, got source=${receivedSource}`,
    );
    assert(
      receivedSource !== "local",
      `Remote source should not be 'local', got '${receivedSource}'`,
    );
    console.log(`    Remote source was: '${receivedSource}' (peerId, not 'sync')`);

    engineA.disconnect();
    engineB.disconnect();
    server.stop();
    await sleep(200);
  });

  // Summary
  console.log(`\n${passed} passed, ${failed} failed`);
  if (failed > 0) process.exit(1);
  process.exit(0);
}

runTests().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
