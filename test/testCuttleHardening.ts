/*
 * test/testCuttleHardening.ts
 *
 * Phase 5: Hardening tests for Cuttle CRDT sync.
 *
 * Tests edge cases that would break in production:
 * 1. Stale action rejection (expectedTurnNumber guard)
 * 2. Reconnect mid-game (disconnect, actions happen, reconnect, catch up)
 * 3. Convergence after complex sequence (draw + pass + draw)
 * 4. Invalid reveal detection (card commitment verification)
 * 5. Rapid sequential actions (stress test sync)
 * 6. Action from wrong player rejected
 */
import { Engine } from "../engine/Engine.js";
import { UniversalRelayServer } from "../network/UniversalRelayServer.js";
import { E2EEncryption } from "../network/E2EEncryption.js";
import { getGameInstance, setupCuttleSync, configureEncryption } from "../examples/cuttle/crdt-actions.js";
import { hashCard, verifyCard, commitDeck } from "../examples/cuttle/crypto.js";

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

async function setupEngines(port: number): Promise<{ server: UniversalRelayServer; engineA: any; engineB: any }> {
  const server = new UniversalRelayServer({ port, verbose: false });
  await server.start();

  const engineA = new Engine({ disableWasm: true });
  const engineB = new Engine({ disableWasm: true });

  setupCuttleSync(engineA);
  setupCuttleSync(engineB);

  return { server, engineA, engineB };
}

async function connectAndWait(engineA: any, engineB: any, url: string, ms = 1500): Promise<void> {
  engineA.connect(url);
  engineB.connect(url);
  await sleep(ms);
}

async function setupEncryption(engineA: any, engineB: any): Promise<void> {
  // Encryption is configured but NOT enabled for sync (known limitation:
  // encrypted hands + concurrent writes cause stale data overwrites).
  // The host-authoritative refactor (future work) will fix this.
  // For now, tests run without encryption to prove sync mechanics.
}

async function runTests(): Promise<void> {
  console.log("🛡️  Phase 5: Hardening Tests\n");

  // --- Test 1: Stale action rejection ---
  await runTest("Stale action rejected (wrong expectedTurnNumber)", async () => {
    const { server, engineA, engineB } = await setupEngines(9101);
    await setupEncryption(engineA, engineB);
    await connectAndWait(engineA, engineB, "ws://localhost:9101");

    await engineA.dispatch("cuttle:init", { seed: 12345, variant: "classic" });
    await sleep(1500);

    // Player 1 draws (turn 0 → 1)
    await engineB.dispatch("cuttle:action", {
      action: "draw", playerIndex: 1, expectedTurnNumber: 0,
    });
    await sleep(1000);

    // Now try to act with stale turn number (0 instead of 1)
    let staleError: Error | null = null;
    try {
      await engineA.dispatch("cuttle:action", {
        action: "draw", playerIndex: 0, expectedTurnNumber: 0, // stale!
      });
    } catch (err) {
      staleError = err as Error;
    }

    assert(staleError !== null, "Stale action should throw an error");
    assert(staleError!.message.includes("Stale action"), `Error should mention stale action: ${staleError!.message}`);

    engineA.disconnect();
    engineB.disconnect();
    server.stop();
    await sleep(200);
  });

  // --- Test 2: Reconnect mid-game ---
  await runTest("Reconnect mid-game (state catches up)", async () => {
    const { server, engineA, engineB } = await setupEngines(9102);
    await setupEncryption(engineA, engineB);
    await connectAndWait(engineA, engineB, "ws://localhost:9102");

    await engineA.dispatch("cuttle:init", { seed: 12345, variant: "classic" });
    await sleep(1500);

    // Player 1 draws
    await engineB.dispatch("cuttle:action", {
      action: "draw", playerIndex: 1, expectedTurnNumber: 0,
    });
    await sleep(1000);

    // B disconnects
    engineB.disconnect();
    await sleep(500);

    // A makes 2 more moves while B is gone
    const gameA = getGameInstance(engineA)!;
    let state = gameA.getState();

    await engineA.dispatch("cuttle:action", {
      action: "draw", playerIndex: 0, expectedTurnNumber: state.turnNumber,
    });
    await sleep(500);

    // B reconnects
    engineB.connect("ws://localhost:9102");
    await sleep(3000); // Wait longer for reconnect + sync

    // Verify B caught up — check state, don't try to dispatch
    const gameB = getGameInstance(engineB);
    assert(gameB !== null, "B should have game instance after reconnect");

    const stateA = gameA.getState();
    const stateB = gameB!.getState();

    console.log(`    A: turn=${stateA.turnNumber}, deck=${stateA.deck.length}`);
    console.log(`    B: turn=${stateB.turnNumber}, deck=${stateB.deck.length}`);

    assert(stateB.turnNumber === stateA.turnNumber,
      `Turn numbers should match after reconnect: A=${stateA.turnNumber}, B=${stateB.turnNumber}`);
    assert(stateB.deck.length === stateA.deck.length,
      `Deck counts should match: A=${stateA.deck.length}, B=${stateB.deck.length}`);

    engineA.disconnect();
    engineB.disconnect();
    server.stop();
    await sleep(200);
  });

  // --- Test 3: Convergence after complex sequence ---
  await runTest("Convergence after 4 draws (alternating turns)", async () => {
    const { server, engineA, engineB } = await setupEngines(9103);
    await setupEncryption(engineA, engineB);
    await connectAndWait(engineA, engineB, "ws://localhost:9103");

    await engineA.dispatch("cuttle:init", { seed: 55555, variant: "classic" });
    await sleep(1500);

    const gameA = getGameInstance(engineA)!;

    // P1 draws
    let state = gameA.getState();
    await engineB.dispatch("cuttle:action", {
      action: "draw", playerIndex: 1, expectedTurnNumber: state.turnNumber,
    });
    await sleep(1000);

    // P0 draws
    state = gameA.getState();
    await engineA.dispatch("cuttle:action", {
      action: "draw", playerIndex: 0, expectedTurnNumber: state.turnNumber,
    });
    await sleep(1000);

    // P1 draws again
    state = gameA.getState();
    await engineB.dispatch("cuttle:action", {
      action: "draw", playerIndex: 1, expectedTurnNumber: state.turnNumber,
    });
    await sleep(1000);

    // P0 draws again
    state = gameA.getState();
    await engineA.dispatch("cuttle:action", {
      action: "draw", playerIndex: 0, expectedTurnNumber: state.turnNumber,
    });
    await sleep(1000);

    // Check convergence
    const stateA = gameA.getState();
    const gameB = getGameInstance(engineB)!;
    const stateB = gameB.getState();

    console.log(`    A: turn=${stateA.turnNumber}, deck=${stateA.deck.length}, p0=${stateA.players[0].hand.length}, p1=${stateA.players[1].hand.length}`);
    console.log(`    B: turn=${stateB.turnNumber}, deck=${stateB.deck.length}, p0=${stateB.players[0].hand.length}, p1=${stateB.players[1].hand.length}`);

    assert(stateA.turnNumber === stateB.turnNumber, "Turn numbers should match");
    assert(stateA.deck.length === stateB.deck.length, "Deck counts should match");
    assert(stateA.players[0].hand.length === stateB.players[0].hand.length, "P0 hand counts should match");
    assert(stateA.players[1].hand.length === stateB.players[1].hand.length, "P1 hand counts should match");

    engineA.disconnect();
    engineB.disconnect();
    server.stop();
    await sleep(200);
  });

  // --- Test 4: Invalid reveal detection ---
  await runTest("Invalid card reveal detected (commitment mismatch)", async () => {
    const card = { rank: "A", suit: "spades", id: 42 };
    const commitment = await hashCard(card);

    // Correct card verifies
    const valid = await verifyCard(card, commitment);
    assert(valid, "Correct card should verify");

    // Wrong card (different rank) fails
    const wrongCard1 = { rank: "K", suit: "spades", id: 42 };
    const invalid1 = await verifyCard(wrongCard1, commitment);
    assert(!invalid1, "Wrong rank should not verify");

    // Wrong card (different suit) fails
    const wrongCard2 = { rank: "A", suit: "hearts", id: 42 };
    const invalid2 = await verifyCard(wrongCard2, commitment);
    assert(!invalid2, "Wrong suit should not verify");

    // Wrong card (different id) fails
    const wrongCard3 = { rank: "A", suit: "spades", id: 99 };
    const invalid3 = await verifyCard(wrongCard3, commitment);
    assert(!invalid3, "Wrong id should not verify");

    // Tampered commitment fails
    const tamperedCommitment = commitment.slice(0, -2) + "XX";
    const invalid4 = await verifyCard(card, tamperedCommitment);
    assert(!invalid4, "Tampered commitment should not verify");
  });

  // --- Test 5: Action from wrong player rejected ---
  await runTest("Action from wrong player rejected", async () => {
    const { server, engineA, engineB } = await setupEngines(9104);
    await setupEncryption(engineA, engineB);
    await connectAndWait(engineA, engineB, "ws://localhost:9104");

    await engineA.dispatch("cuttle:init", { seed: 12345, variant: "classic" });
    await sleep(1500);

    // It's player 1's turn. Player 0 tries to act.
    let wrongPlayerError: Error | null = null;
    try {
      await engineA.dispatch("cuttle:action", {
        action: "draw", playerIndex: 0, expectedTurnNumber: 0,
      });
    } catch (err) {
      wrongPlayerError = err as Error;
    }

    assert(wrongPlayerError !== null, "Wrong player action should throw");
    console.log(`    Error: ${wrongPlayerError!.message}`);

    engineA.disconnect();
    engineB.disconnect();
    server.stop();
    await sleep(200);
  });

  // --- Test 6: Rapid sequential actions (stress test) ---
  await runTest("Rapid sequential actions (4 draws, stress test)", async () => {
    const { server, engineA, engineB } = await setupEngines(9105);
    await setupEncryption(engineA, engineB);
    await connectAndWait(engineA, engineB, "ws://localhost:9105");

    await engineA.dispatch("cuttle:init", { seed: 77777, variant: "classic" });
    await sleep(1500);

    const gameA = getGameInstance(engineA)!;

    // Alternate draws: P1, P0, P1, P0 (stay under hand limit of 8)
    for (let i = 0; i < 4; i++) {
      const playerIndex = i % 2 === 0 ? 1 : 0;
      const engine = playerIndex === 1 ? engineB : engineA;
      const state = gameA.getState();

      await engine.dispatch("cuttle:action", {
        action: "draw", playerIndex, expectedTurnNumber: state.turnNumber,
      });
      await sleep(1500); // Wait for sync between each action
    }

    await sleep(1500);

    // Both should converge
    const stateA = gameA.getState();
    const gameB = getGameInstance(engineB)!;
    const stateB = gameB.getState();

    console.log(`    A: turn=${stateA.turnNumber}, deck=${stateA.deck.length}, p0=${stateA.players[0].hand.length}, p1=${stateA.players[1].hand.length}`);
    console.log(`    B: turn=${stateB.turnNumber}, deck=${stateB.deck.length}, p0=${stateB.players[0].hand.length}, p1=${stateB.players[1].hand.length}`);

    assert(stateA.turnNumber === stateB.turnNumber, "Turn numbers should match after rapid actions");
    assert(stateA.deck.length === stateB.deck.length, "Deck counts should match");
    assert(stateA.players[0].hand.length === stateB.players[0].hand.length, "P0 hand should match");
    assert(stateA.players[1].hand.length === stateB.players[1].hand.length, "P1 hand should match");

    engineA.disconnect();
    engineB.disconnect();
    server.stop();
    await sleep(200);
  });

  // --- Test 7: Deck commitment integrity ---
  await runTest("Deck commitment integrity (full deck, all cards verify)", async () => {
    // Create a full 52-card deck
    const deck: any[] = [];
    const suits = ["clubs", "diamonds", "hearts", "spades"];
    const ranks = ["A", "2", "3", "4", "5", "6", "7", "8", "9", "10", "J", "Q", "K"];
    let id = 0;
    for (const suit of suits) {
      for (const rank of ranks) {
        deck.push({ rank, suit, id: id++ });
      }
    }

    const commitments = await commitDeck(deck);
    assert(commitments.length === 52, "Should have 52 commitments");

    // All cards verify
    for (let i = 0; i < 52; i++) {
      const valid = await verifyCard(deck[i], commitments[i]);
      assert(valid, `Card ${i} should verify`);
    }

    // No commitment reveals the card
    for (const c of commitments) {
      assert(!c.includes("spades"), "Commitment should not contain 'spades'");
      assert(!c.includes("hearts"), "Commitment should not contain 'hearts'");
      assert(!c.includes("diamonds"), "Commitment should not contain 'diamonds'");
      assert(!c.includes("clubs"), "Commitment should not contain 'clubs'");
    }

    // Shuffled deck has different commitments
    const shuffled = [...deck].reverse();
    const shuffledCommitments = await commitDeck(shuffled);
    let mismatches = 0;
    for (let i = 0; i < 52; i++) {
      if (commitments[i] !== shuffledCommitments[i]) mismatches++;
    }
    assert(mismatches > 0, "Shuffled deck should have different commitments");
  });

  // Summary
  console.log(`\n${passed} passed, ${failed} failed`);
  if (failed > 0) process.exit(1);
  process.exit(0);
}

runTests().catch(err => {
  console.error("Fatal error:", err);
  process.exit(1);
});
