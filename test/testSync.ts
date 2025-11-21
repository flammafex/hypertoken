/*
 * test/testSync.ts
 */
import { Engine } from "../engine/Engine.js";
import { RelayServer } from "../interface/RelayServer.js";
import { Token } from "../core/Token.js";
import { Deck } from "../core/Deck.js";

async function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function run() {
  console.log("🔗 Starting Synchronization Test...\n");

  // 1. Start Relay Server
  const serverEngine = new Engine(); 
  const server = new RelayServer(serverEngine, { port: 9090, verbose: false });
  await server.start();

  // 2. Setup Engine A (Host)
  // Host initializes the game state with cards
  const engineA = new Engine();
  const cardsA = [
    new Token({ id: "c1", label: "Card 1" }), 
    new Token({ id: "c2", label: "Card 2" })
  ];
  const deckA = new Deck(engineA.session, cardsA);
  engineA.deck = deckA;

  // 3. Setup Engine B (Client)
  // Client starts WITHOUT a deck initially. It will adopt the host's state.
  const engineB = new Engine();
  
  engineA.on("engine:error", (e) => console.error("🔥 Engine A Error:", e));
  engineB.on("engine:error", (e) => console.error("🔥 Engine B Error:", e));

  console.log("Connecting clients...");
  engineA.connect("ws://localhost:9090");
  engineB.connect("ws://localhost:9090");

  // Wait for initial connection and state sync
  await sleep(500);

  // 4. Initialize Deck View on Client B
  // Now that B has synced, 'session.state.deck' should exist (from A).
  // The Deck constructor will see the existing state and skip initialization,
  // effectively just wrapping the shared state.
  const deckB = new Deck(engineB.session, []);
  engineB.deck = deckB;

  console.log(`[Debug] Engine B Initialized. Deck size: ${deckB.size}`);

  // --- Test 1: Table Sync ---
  console.log("\n🃏 Engine A: Placing 'Ace of Spades' on table...");
  const card = new Token({ id: "ace-spades", label: "Ace of Spades" });
  
  engineA.dispatch("table:place", { 
    zone: "center", 
    card: card 
  });

  await sleep(500);

  const zoneB = engineB.table.zone("center");
  if (zoneB.length === 1 && zoneB[0].tokenId === "ace-spades") {
    console.log("✅ Table Sync Success");
  } else {
    console.error("❌ Table Sync Failed");
    process.exit(1);
  }

  // --- Test 2: Deck Sync ---
  console.log("\n🎴 Engine A: Drawing a card from Deck...");
  
  // Verify initial state before draw
  if (engineB.deck?.size !== 2) {
     console.error(`❌ Pre-check failed: Engine B should have 2 cards, has ${engineB.deck?.size}`);
     // Don't exit yet, let's see what happens
  }

  // Draw 1 card on Engine A
  engineA.dispatch("deck:draw", { count: 1 });

  console.log("Waiting for deck sync...");
  await sleep(1000);

  // Verify State on Engine B
  // Stack should have 1 left, Drawn should have 1
  const stackSizeB = engineB.deck?.size ?? 0;
  const drawnSizeB = engineB.deck?.drawn.length ?? 0;

  console.log(`[Debug] Engine B Deck State: Stack=${stackSizeB}, Drawn=${drawnSizeB}`);

  if (stackSizeB === 1 && drawnSizeB === 1) {
    console.log("✅ Deck Sync Success: Draw action propagated correctly!");
  } else {
    console.error("❌ Deck Sync Failed: State mismatch.");
    console.log("Engine B Deck:", JSON.stringify(engineB.deck?.toJSON(), null, 2));
    process.exit(1);
  }

  engineA.disconnect();
  engineB.disconnect();
  server.stop();
  process.exit(0);
}

run().catch(console.error);