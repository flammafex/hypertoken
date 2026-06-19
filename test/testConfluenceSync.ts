/*
 * test/testConfluenceSync.ts
 *
 * Phase 3: CRDT sync tests for Confluence.
 *
 * Tests the CRDT thesis:
 * 1. Basic sync: A places, B sees it
 * 2. Concurrent different-cell placement: both tokens appear on both peers
 * 3. Same-cell contention: both tokens preserved (THE CRDT SHOWCASE)
 * 4. Reconnect: disconnect, actions happen, reconnect, catch up
 * 5. Provenance: merge/split _mergedFrom/_splitFrom syncs
 * 6. Multiple players: 3+ peers converge
 */
import { Engine } from "../engine/Engine.js";
import { UniversalRelayServer } from "../network/UniversalRelayServer.js";
import { getBoard, getScores, setupConfluenceSync } from "../examples/confluence/crdt-actions.js";

let passed = 0;
let failed = 0;

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

async function setupEngines(port: number) {
  const server = new UniversalRelayServer({ port, verbose: false });
  await server.start();

  const engineA = new Engine({ disableWasm: true });
  const engineB = new Engine({ disableWasm: true });

  setupConfluenceSync(engineA);
  setupConfluenceSync(engineB);

  return { server, engineA, engineB };
}

async function runTests(): Promise<void> {
  console.log("🌐 Confluence: CRDT Sync Tests\n");

  // --- Test 1: Basic sync (A places, B sees it) ---
  await runTest("Basic sync: A places, B sees it", async () => {
    const { server, engineA, engineB } = await setupEngines(9201);

    engineA.connect("ws://localhost:9201");
    engineB.connect("ws://localhost:9201");
    await sleep(1000);

    // A initializes and registers
    await engineA.dispatch("confluence:init", {});
    await engineA.dispatch("confluence:register", { peerId: "p1", name: "Alice" });
    await sleep(1000);

    // B registers
    await engineB.dispatch("confluence:register", { peerId: "p2", name: "Bob" });
    await sleep(1000);

    // A places a token
    await engineA.dispatch("confluence:place", { x: 3, y: 4, peerId: "p1" });
    await sleep(1000);

    // B should see the token
    const boardB = getBoard(engineB);
    assert(boardB !== null, "B should have a board");
    assert(boardB!.cells[4][3].tokens.length === 1, `B should see 1 token at (3,4), sees ${boardB!.cells[4][3].tokens.length}`);
    assert(boardB!.cells[4][3].tokens[0].playerId === "p1", "Token should belong to p1");

    engineA.disconnect();
    engineB.disconnect();
    server.stop();
    await sleep(200);
  });

  // --- Test 2: Concurrent different-cell placement ---
  await runTest("Concurrent different-cell placement: both tokens appear", async () => {
    const { server, engineA, engineB } = await setupEngines(9202);

    engineA.connect("ws://localhost:9202");
    engineB.connect("ws://localhost:9202");
    await sleep(1000);

    await engineA.dispatch("confluence:init", {});
    await engineA.dispatch("confluence:register", { peerId: "p1", name: "Alice" });
    await sleep(1000);
    await engineB.dispatch("confluence:register", { peerId: "p2", name: "Bob" });
    await sleep(1000);

    // Both place simultaneously on different cells
    await Promise.all([
      engineA.dispatch("confluence:place", { x: 2, y: 2, peerId: "p1" }),
      engineB.dispatch("confluence:place", { x: 7, y: 7, peerId: "p2" }),
    ]);

    await sleep(2500);

    // Both engines should see both tokens
    const boardA = getBoard(engineA);
    const boardB = getBoard(engineB);

    assert(boardA!.cells[2][2].tokens.length === 1, `A should see token at (2,2), sees ${boardA!.cells[2][2].tokens.length}`);
    assert(boardA!.cells[7][7].tokens.length === 1, `A should see token at (7,7), sees ${boardA!.cells[7][7].tokens.length}`);
    assert(boardB!.cells[2][2].tokens.length === 1, `B should see token at (2,2), sees ${boardB!.cells[2][2].tokens.length}`);
    assert(boardB!.cells[7][7].tokens.length === 1, `B should see token at (7,7), sees ${boardB!.cells[7][7].tokens.length}`);

    engineA.disconnect();
    engineB.disconnect();
    server.stop();
    await sleep(200);
  });

  // --- Test 3: Same-cell contention (THE CRDT SHOWCASE) ---
  await runTest("Same-cell contention: both tokens preserved (CRDT showcase)", async () => {
    const { server, engineA, engineB } = await setupEngines(9203);

    engineA.connect("ws://localhost:9203");
    engineB.connect("ws://localhost:9203");
    await sleep(1000);

    await engineA.dispatch("confluence:init", {});
    await engineA.dispatch("confluence:register", { peerId: "p1", name: "Alice" });
    await sleep(1000);
    await engineB.dispatch("confluence:register", { peerId: "p2", name: "Bob" });
    await sleep(1000);

    // Both place on the SAME cell simultaneously
    await Promise.all([
      engineA.dispatch("confluence:place", { x: 5, y: 5, peerId: "p1" }),
      engineB.dispatch("confluence:place", { x: 5, y: 5, peerId: "p2" }),
    ]);

    await sleep(2500);

    // Both engines should see BOTH tokens (no last-write-wins!)
    const boardA = getBoard(engineA);
    const boardB = getBoard(engineB);

    const cellA = boardA!.cells[5][5];
    const cellB = boardB!.cells[5][5];

    assert(cellA.tokens.length === 2, `A should see 2 tokens at (5,5), sees ${cellA.tokens.length}`);
    assert(cellB.tokens.length === 2, `B should see 2 tokens at (5,5), sees ${cellB.tokens.length}`);
    assert(cellA.contested === true, "Cell should be contested on A");
    assert(cellB.contested === true, "Cell should be contested on B");
    assert(cellA.controller === null, "Contested cell should have no controller on A");
    assert(cellB.controller === null, "Contested cell should have no controller on B");

    // Verify both players' tokens are present
    const playerIdsA = new Set(cellA.tokens.map((t) => t.playerId));
    const playerIdsB = new Set(cellB.tokens.map((t) => t.playerId));
    assert(playerIdsA.has("p1") && playerIdsA.has("p2"), "A should see both players' tokens");
    assert(playerIdsB.has("p1") && playerIdsB.has("p2"), "B should see both players' tokens");

    console.log(`    A: ${cellA.tokens.length} tokens, contested=${cellA.contested}`);
    console.log(`    B: ${cellB.tokens.length} tokens, contested=${cellB.contested}`);

    engineA.disconnect();
    engineB.disconnect();
    server.stop();
    await sleep(200);
  });

  // --- Test 4: Reconnect ---
  await runTest("Reconnect: actions while disconnected catch up", async () => {
    const { server, engineA, engineB } = await setupEngines(9204);

    engineA.connect("ws://localhost:9204");
    engineB.connect("ws://localhost:9204");
    await sleep(1000);

    await engineA.dispatch("confluence:init", {});
    await engineA.dispatch("confluence:register", { peerId: "p1", name: "Alice" });
    await engineB.dispatch("confluence:register", { peerId: "p2", name: "Bob" });
    await sleep(1000);

    // B disconnects
    engineB.disconnect();
    await sleep(500);

    // A places while B is gone
    await engineA.dispatch("confluence:place", { x: 1, y: 1, peerId: "p1" });
    await engineA.dispatch("confluence:place", { x: 2, y: 2, peerId: "p1" });
    await sleep(500);

    // B reconnects
    engineB.connect("ws://localhost:9204");
    await sleep(2000);

    // B should see both tokens
    const boardB = getBoard(engineB);
    assert(boardB!.cells[1][1].tokens.length === 1, `B should see token at (1,1) after reconnect, sees ${boardB!.cells[1][1].tokens.length}`);
    assert(boardB!.cells[2][2].tokens.length === 1, `B should see token at (2,2) after reconnect, sees ${boardB!.cells[2][2].tokens.length}`);

    engineA.disconnect();
    engineB.disconnect();
    server.stop();
    await sleep(200);
  });

  // --- Test 5: Provenance syncs (merge creates _mergedFrom) ---
  await runTest("Provenance: merge _mergedFrom syncs to peer", async () => {
    const { server, engineA, engineB } = await setupEngines(9205);

    engineA.connect("ws://localhost:9205");
    engineB.connect("ws://localhost:9205");
    await sleep(1000);

    await engineA.dispatch("confluence:init", {});
    await engineA.dispatch("confluence:register", { peerId: "p1", name: "Alice" });
    await engineB.dispatch("confluence:register", { peerId: "p2", name: "Bob" });
    await sleep(1000);

    // A places two tokens
    await engineA.dispatch("confluence:place", { x: 3, y: 3, peerId: "p1" });
    await sleep(500);
    await engineA.dispatch("confluence:place", { x: 4, y: 3, peerId: "p1" });
    await sleep(1000);

    // A merges them
    const stateA = engineA.session.state.confluence as any;
    const tokenIds = Object.keys(stateA.tokens).filter((id: string) => !stateA.consumed[id] || Object.keys(stateA.consumed[id]).length === 0);
    assert(tokenIds.length === 2, `Should have 2 active tokens, has ${tokenIds.length}`);

    await engineA.dispatch("confluence:merge", {
      tokenIdA: tokenIds[0],
      tokenIdB: tokenIds[1],
      peerId: "p1",
    });
    await sleep(2500);

    // B should see the merged token with provenance
    const stateB = engineB.session.state.confluence as any;
    const activeTokensB = Object.values(stateB.tokens).filter((t: any) => {
      const consumed = stateB.consumed[t.id];
      return !consumed || Object.keys(consumed).length === 0;
    });

    assert(activeTokensB.length === 1, `B should see 1 active token (merged), sees ${activeTokensB.length}`);
    const merged = activeTokensB[0] as any;
    assert(merged._mergedFrom !== null, "Merged token should have _mergedFrom");
    assert(merged._mergedFrom!.length === 2, `_mergedFrom should have 2 parents, has ${merged._mergedFrom!.length}`);
    assert(merged.strength === 2, `Merged token should have strength 2, has ${merged.strength}`);

    console.log(`    B sees merged token: strength=${merged.strength}, mergedFrom=${JSON.stringify(merged._mergedFrom)}`);

    engineA.disconnect();
    engineB.disconnect();
    server.stop();
    await sleep(200);
  });

  // --- Test 6: Score convergence ---
  await runTest("Score convergence: both peers compute same scores", async () => {
    const { server, engineA, engineB } = await setupEngines(9206);

    engineA.connect("ws://localhost:9206");
    engineB.connect("ws://localhost:9206");
    await sleep(1000);

    await engineA.dispatch("confluence:init", {});
    await engineA.dispatch("confluence:register", { peerId: "p1", name: "Alice" });
    await engineB.dispatch("confluence:register", { peerId: "p2", name: "Bob" });
    await sleep(1000);

    // Both place tokens
    await engineA.dispatch("confluence:place", { x: 0, y: 0, peerId: "p1" });
    await engineB.dispatch("confluence:place", { x: 9, y: 9, peerId: "p2" });
    await sleep(2500);

    const scoresA = getScores(engineA);
    const scoresB = getScores(engineB);

    console.log(`    A scores: ${JSON.stringify(scoresA.map(s => ({ name: s.name, cells: s.controlledCells })))}`);
    console.log(`    B scores: ${JSON.stringify(scoresB.map(s => ({ name: s.name, cells: s.controlledCells })))}`);

    assert(scoresA.length === scoresB.length, `Both should have same number of players: A=${scoresA.length}, B=${scoresB.length}`);

    for (let i = 0; i < scoresA.length; i++) {
      assert(
        scoresA[i].controlledCells === scoresB[i].controlledCells,
        `Player ${scoresA[i].name} should have same score: A=${scoresA[i].controlledCells}, B=${scoresB[i].controlledCells}`,
      );
    }

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
