/*
 * test/testCuttleCrypto.ts
 *
 * Phase 3: Hidden-info model — encrypted hands in CRDT.
 *
 * Tests that:
 * 1. E2EEncryption key exchange works between two engines
 * 2. Host can encrypt hands for the client
 * 3. Client can decrypt own hand
 * 4. Client CANNOT decrypt opponent's hand
 * 5. Encrypted state syncs via CRDT
 * 6. Card commitments work (hash + verify)
 */
import { Engine } from "../engine/Engine.js";
import { UniversalRelayServer } from "../network/UniversalRelayServer.js";
import { E2EEncryption } from "../network/E2EEncryption.js";
import { getGameInstance, setupCuttleSync, configureEncryption } from "../examples/cuttle/crdt-actions.js";
import { hashCard, verifyCard, commitDeck, encryptHand, decryptHand } from "../examples/cuttle/crypto.js";

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
  console.log("🔐 Phase 3: Hidden-Info Model (Encrypted Hands)\n");

  // --- Test 1: Card commitments (hash + verify) ---
  await runTest("Card commitments: hash and verify", async () => {
    const card = { rank: "A", suit: "spades", id: 0 };
    const commitment = await hashCard(card);
    assert(typeof commitment === "string", "Commitment should be a string");
    assert(commitment.length > 0, "Commitment should not be empty");

    // Verify correct card
    const valid = await verifyCard(card, commitment);
    assert(valid, "Correct card should verify");

    // Wrong card should fail
    const wrongCard = { rank: "K", suit: "hearts", id: 1 };
    const invalid = await verifyCard(wrongCard, commitment);
    assert(!invalid, "Wrong card should not verify");
  });

  // --- Test 2: Deck commitments ---
  await runTest("Deck commitments: hide order, verify reveals", async () => {
    const deck = [
      { rank: "A", suit: "spades", id: 0 },
      { rank: "K", suit: "hearts", id: 1 },
      { rank: "Q", suit: "diamonds", id: 2 },
    ];
    const commitments = await commitDeck(deck);
    assert(commitments.length === 3, "Should have 3 commitments");

    // Commitments don't reveal card values
    assert(!commitments[0].includes("spades"), "Commitment should not contain suit");
    assert(!commitments[0].includes("rank"), "Commitment should not contain 'rank'");

    // Verify each card against its commitment
    for (let i = 0; i < deck.length; i++) {
      const valid = await verifyCard(deck[i], commitments[i]);
      assert(valid, `Card ${i} should verify against commitment`);
    }
  });

  // --- Test 3: Hand encryption/decryption ---
  await runTest("Hand encryption: encrypt for recipient, decrypt as recipient", async () => {
    const e2eA = new E2EEncryption();
    await e2eA.initialize("host");
    const e2eB = new E2EEncryption();
    await e2eB.initialize("client");

    // Exchange keys
    const msgA = e2eA.createKeyExchangeMessage()!;
    const msgB = e2eB.createKeyExchangeMessage()!;
    await e2eA.handleKeyExchange(msgB);
    await e2eB.handleKeyExchange(msgA);

    const hand = [
      { rank: "A", suit: "spades", id: 0 },
      { rank: "K", suit: "hearts", id: 1 },
      { rank: "Q", suit: "diamonds", id: 2 },
    ];

    // Host encrypts hand for client
    const encrypted = await encryptHand(e2eA, "client", hand);
    assert(encrypted.length === 3, "Should have 3 encrypted cards");
    assert(!JSON.stringify(encrypted).includes("spades"), "Encrypted hand should not contain 'spades'");

    // Client decrypts
    const decrypted = await decryptHand(e2eB, "host", encrypted);
    assert(decrypted.length === 3, "Should decrypt 3 cards");
    assert(decrypted[0].rank === "A", `First card should be A, is ${decrypted[0].rank}`);
    assert(decrypted[0].suit === "spades", `First card suit should be spades, is ${decrypted[0].suit}`);

    // Host tries to decrypt own encryption (should work — symmetric key)
    const selfDecrypt = await decryptHand(e2eA, "client", encrypted);
    assert(selfDecrypt.length === 3, "Host should be able to decrypt own encryption");

    // Third party (no session) tries to decrypt (should fail)
    const e2eC = new E2EEncryption();
    await e2eC.initialize("eavesdropper");
    const eavesdrop = await decryptHand(e2eC, "host", encrypted);
    assert(eavesdrop.length === 0, "Eavesdropper should decrypt 0 cards");
  });

  // --- Test 4: Full CRDT sync with encrypted hands ---
  await runTest("CRDT sync with encrypted hands (host → client)", async () => {
    const server = new UniversalRelayServer({ port: 9093, verbose: false });
    await server.start();

    const engineA = new Engine({ disableWasm: true });
    const engineB = new Engine({ disableWasm: true });

    // Set up encryption
    const e2eA = new E2EEncryption();
    await e2eA.initialize("host-A");
    const e2eB = new E2EEncryption();
    await e2eB.initialize("client-B");

    // Set up sync listeners
    setupCuttleSync(engineA);
    setupCuttleSync(engineB);

    // Connect and exchange keys
    engineA.connect("ws://localhost:9093");
    engineB.connect("ws://localhost:9093");
    await sleep(1000);

    // Exchange encryption keys via the relay
    // (In a real app, this would happen automatically via signaling)
    const msgA = e2eA.createKeyExchangeMessage()!;
    const msgB = e2eB.createKeyExchangeMessage()!;
    await e2eA.handleKeyExchange(msgB);
    await e2eB.handleKeyExchange(msgA);

    // Configure encryption on host (A)
    // A is player 0 (host), B is player 1 (client)
    configureEncryption(engineA, e2eA, {
      myPlayerIndex: 0,
      hostPeerId: "host-A",
      peerIds: ["host-A", "client-B"], // player 0 → host-A, player 1 → client-B
      isHost: true,
    });

    // Configure encryption on client (B)
    configureEncryption(engineB, e2eB, {
      myPlayerIndex: 1,
      hostPeerId: "host-A",
      peerIds: ["host-A", "client-B"],
      isHost: false,
    });

    // A initializes the game
    await engineA.dispatch("cuttle:init", { seed: 12345, variant: "classic" });

    // Wait for sync
    await sleep(2000);

    // A (host) has full state
    const gameA = getGameInstance(engineA);
    const stateA = gameA!.getState();
    console.log(`    A (host): p0 hand=${stateA.players[0].hand.length}, p1 hand=${stateA.players[1].hand.length}`);
    assert(stateA.players[0].hand.length === 6, "Host should see own hand (6 cards)");
    assert(stateA.players[1].hand.length === 5, "Host should see opponent hand (5 cards)");

    // B (client) should have decrypted own hand, opponent's hand should be empty
    const gameB = getGameInstance(engineB);
    assert(gameB !== null, "Client should have a game instance");
    const stateB = gameB!.getState();
    console.log(`    B (client): p0 hand=${stateB.players[0].hand.length}, p1 hand=${stateB.players[1].hand.length}`);
    assert(stateB.players[1].hand.length === 5, `Client should have own hand decrypted (5 cards), has ${stateB.players[1].hand.length}`);
    assert(stateB.players[0].hand.length === 0, `Client should NOT have opponent's hand (0 cards), has ${stateB.players[0].hand.length}`);

    // Verify client's decrypted hand matches host's view
    const hostP1Hand = stateA.players[1].hand;
    const clientP1Hand = stateB.players[1].hand;
    for (let i = 0; i < 5; i++) {
      assert(hostP1Hand[i].id === clientP1Hand[i].id, `Card ${i}: host sees id=${hostP1Hand[i].id}, client sees id=${clientP1Hand[i].id}`);
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

runTests().catch(err => {
  console.error("Fatal error:", err);
  process.exit(1);
});
