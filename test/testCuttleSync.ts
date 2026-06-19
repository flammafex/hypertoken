/*
 * test/testCuttleSync.ts
 *
 * Phase 2: Cuttle snapshot bridge test.
 *
 * Proves that Cuttle game state syncs between two engines via CRDT:
 * 1. Engine A initializes game → state syncs to B
 * 2. Player 1 (on B) draws → state syncs to A
 * 3. Player 0 (on A) draws → state syncs to B
 * 4. State converges — both engines see the same game state
 *
 * Uses disableWasm: true (required for network sync) and crdt-actions.js
 * (CRDT-aware action handlers that write snapshots to Chronicle).
 */
import { Engine } from "../engine/Engine.js";
import { UniversalRelayServer } from "../network/UniversalRelayServer.js";
import { getGameInstance, getPlayerObservation, setupCuttleSync } from "../examples/cuttle/crdt-actions.js";

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

async function runTests(): Promise<void> {
  console.log("⚔️  Phase 2: Cuttle CRDT Sync (Snapshot Bridge)\n");

  const server = new UniversalRelayServer({ port: 9092, verbose: false });
  await server.start();
  console.log("  Relay server started on :9092\n");

  // --- Test 1: Initial state syncs from A to B ---
  await runTest("Initial game state syncs A → B", async () => {
    const engineA = new Engine({ disableWasm: true });
    const engineB = new Engine({ disableWasm: true });

    // Set up sync listeners on BOTH engines (B needs it to receive remote state)
    setupCuttleSync(engineA);
    setupCuttleSync(engineB);

    // A initializes the game with a fixed seed
    await engineA.dispatch("cuttle:init", { seed: 12345, variant: "classic" });

    const gameA = getGameInstance(engineA);
    const stateA = gameA!.getState();
    console.log(`    A: deck=${stateA.deck.length}, p0 hand=${stateA.players[0].hand.length}, p1 hand=${stateA.players[1].hand.length}`);

    // Connect both engines
    engineA.connect("ws://localhost:9092");
    engineB.connect("ws://localhost:9092");

    // Wait for sync
    await sleep(1500);

    // B should have received the game state
    const gameB = getGameInstance(engineB);
    assert(gameB !== null, "B should have a CuttleGame instance after sync");

    const stateB = gameB!.getState();
    console.log(`    B: deck=${stateB.deck.length}, p0 hand=${stateB.players[0].hand.length}, p1 hand=${stateB.players[1].hand.length}`);

    assert(stateB.deck.length === stateA.deck.length, `Deck count should match: A=${stateA.deck.length}, B=${stateB.deck.length}`);
    assert(stateB.players[0].hand.length === 6, `Player 0 should have 6 cards, has ${stateB.players[0].hand.length}`);
    assert(stateB.players[1].hand.length === 5, `Player 1 should have 5 cards, has ${stateB.players[1].hand.length}`);
    assert(stateB.currentPlayer === 1, `Current player should be 1, is ${stateB.currentPlayer}`);

    engineA.disconnect();
    engineB.disconnect();
    await sleep(200);
  });

  // --- Test 2: Action on B syncs back to A ---
  await runTest("Player 1 draws on B → syncs to A", async () => {
    const engineA = new Engine({ disableWasm: true });
    const engineB = new Engine({ disableWasm: true });

    setupCuttleSync(engineA);
    setupCuttleSync(engineB);

    await engineA.dispatch("cuttle:init", { seed: 12345, variant: "classic" });

    engineA.connect("ws://localhost:9092");
    engineB.connect("ws://localhost:9092");
    await sleep(1500);

    // Verify B has the game
    const gameB = getGameInstance(engineB);
    assert(gameB !== null, "B should have game after sync");

    const stateBefore = gameB!.getState();
    const deckBefore = stateBefore.deck.length;
    const handBefore = stateBefore.players[1].hand.length;
    console.log(`    Before: deck=${deckBefore}, p1 hand=${handBefore}`);

    // Player 1 (on B) draws a card
    // Player 1 goes first in classic Cuttle
    await engineB.dispatch("cuttle:action", {
      action: "draw",
      playerIndex: 1,
      expectedTurnNumber: 0,
    });

    await sleep(1500);

    // A should see the updated state
    const gameA = getGameInstance(engineA);
    const stateA = gameA!.getState();
    console.log(`    A after: deck=${stateA.deck.length}, p1 hand=${stateA.players[1].hand.length}`);

    assert(stateA.players[1].hand.length === handBefore + 1, `Player 1 hand should increase by 1: was ${handBefore}, now ${stateA.players[1].hand.length}`);
    assert(stateA.deck.length === deckBefore - 1, `Deck should decrease by 1: was ${deckBefore}, now ${stateA.deck.length}`);

    engineA.disconnect();
    engineB.disconnect();
    await sleep(200);
  });

  // --- Test 3: Alternating turns (B then A) ---
  await runTest("Alternating turns: P1 draws (B), P0 draws (A)", async () => {
    const engineA = new Engine({ disableWasm: true });
    const engineB = new Engine({ disableWasm: true });

    setupCuttleSync(engineA);
    setupCuttleSync(engineB);

    await engineA.dispatch("cuttle:init", { seed: 12345, variant: "classic" });

    engineA.connect("ws://localhost:9092");
    engineB.connect("ws://localhost:9092");
    await sleep(1500);

    // Player 1 (on B) draws
    await engineB.dispatch("cuttle:action", {
      action: "draw",
      playerIndex: 1,
      expectedTurnNumber: 0,
    });
    await sleep(1500);

    // Verify A saw the draw
    const gameA = getGameInstance(engineA);
    let stateA = gameA!.getState();
    assert(stateA.players[1].hand.length === 6, `P1 should have 6 cards after draw, has ${stateA.players[1].hand.length}`);
    console.log(`    After P1 draw: currentPlayer=${stateA.currentPlayer}, turn=${stateA.turnNumber}`);

    // Now it should be player 0's turn (on A)
    // Player 0 draws
    await engineA.dispatch("cuttle:action", {
      action: "draw",
      playerIndex: 0,
      expectedTurnNumber: stateA.turnNumber,
    });
    await sleep(1500);

    // B should see the updated state
    const gameB = getGameInstance(engineB);
    const stateB = gameB!.getState();
    console.log(`    After P0 draw: p0 hand=${stateB.players[0].hand.length}, p1 hand=${stateB.players[1].hand.length}, currentPlayer=${stateB.currentPlayer}`);

    assert(stateB.players[0].hand.length === 7, `P0 should have 7 cards after draw, has ${stateB.players[0].hand.length}`);
    assert(stateB.players[1].hand.length === 6, `P1 should still have 6 cards, has ${stateB.players[1].hand.length}`);

    engineA.disconnect();
    engineB.disconnect();
    await sleep(200);
  });

  // --- Test 4: State convergence after multiple turns ---
  await runTest("State convergence after 4 turns", async () => {
    const engineA = new Engine({ disableWasm: true });
    const engineB = new Engine({ disableWasm: true });

    setupCuttleSync(engineA);
    setupCuttleSync(engineB);

    await engineA.dispatch("cuttle:init", { seed: 99999, variant: "classic" });

    engineA.connect("ws://localhost:9092");
    engineB.connect("ws://localhost:9092");
    await sleep(1500);

    // Play 4 turns: P1, P0, P1, P0
    for (let i = 0; i < 4; i++) {
      const playerIndex = i % 2 === 0 ? 1 : 0; // P1 goes first
      const engine = playerIndex === 1 ? engineB : engineA;
      const otherEngine = playerIndex === 1 ? engineA : engineB;

      const game = getGameInstance(engine);
      const state = game!.getState();

      console.log(`    Turn ${i}: P${playerIndex} draws (turn=${state.turnNumber})`);

      await engine.dispatch("cuttle:action", {
        action: "draw",
        playerIndex,
        expectedTurnNumber: state.turnNumber,
      });
      await sleep(800);
    }

    // Both engines should have the same state
    const gameA = getGameInstance(engineA);
    const gameB = getGameInstance(engineB);
    const stateA = gameA!.getState();
    const stateB = gameB!.getState();

    console.log(`    A: deck=${stateA.deck.length}, p0=${stateA.players[0].hand.length}, p1=${stateA.players[1].hand.length}, turn=${stateA.turnNumber}`);
    console.log(`    B: deck=${stateB.deck.length}, p0=${stateB.players[0].hand.length}, p1=${stateB.players[1].hand.length}, turn=${stateB.turnNumber}`);

    assert(stateA.deck.length === stateB.deck.length, `Deck counts should match: A=${stateA.deck.length}, B=${stateB.deck.length}`);
    assert(stateA.players[0].hand.length === stateB.players[0].hand.length, `P0 hand counts should match: A=${stateA.players[0].hand.length}, B=${stateB.players[0].hand.length}`);
    assert(stateA.players[1].hand.length === stateB.players[1].hand.length, `P1 hand counts should match: A=${stateA.players[1].hand.length}, B=${stateB.players[1].hand.length}`);
    assert(stateA.turnNumber === stateB.turnNumber, `Turn numbers should match: A=${stateA.turnNumber}, B=${stateB.turnNumber}`);

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
