/*
 * test/testSync.ts
 */
import { Engine } from "../engine/Engine.js";
import { UniversalRelayServer } from "../network/UniversalRelayServer.js";
import { Token } from "../core/Token.js";
import { Stack } from "../core/Stack.js";

async function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function run() {
  console.log("🔗 Starting Synchronization Test...\n");

  // 1. Start Relay Server
  const server = new UniversalRelayServer({ port: 9090, verbose: false });
  await server.start();

  // 2. Setup Engine A (Host)
  // Host initializes the game state with cards
  const engineA = new Engine();
  const cardsA = [
    new Token({ id: "c1", label: "Card 1" }), 
    new Token({ id: "c2", label: "Card 2" })
  ];
  const stackA = new Stack(engineA.session, cardsA);
  engineA.stack = stackA;

  // 3. Setup Engine B (Client)
  // Client starts WITHOUT a stack initially. It will adopt the host's state.
  const engineB = new Engine();
  
  engineA.on("engine:error", (e) => console.error("🔥 Engine A Error:", e));
  engineB.on("engine:error", (e) => console.error("🔥 Engine B Error:", e));

  console.log("Connecting clients...");
  engineA.connect("ws://localhost:9090");
  engineB.connect("ws://localhost:9090");

  // Wait for initial connection and state sync
  await sleep(500);

  // 4. Initialize Stack View on Client B
  // Now that B has synced, 'session.state.stack' should exist (from A).
  // The Stack constructor will see the existing state and skip initialization,
  // effectively just wrapping the shared state.
  const stackB = new Stack(engineB.session, []);
  engineB.stack = stackB;

  console.log(`[Debug] Engine B Initialized. Stack size: ${stackB.size}`);

  // --- Test 1: Space Sync ---
  console.log("\n🃏 Engine A: Placing 'Ace of Spades' on space...");
  const card = new Token({ id: "ace-spades", label: "Ace of Spades" });
  
  await engineA.dispatch("space:place", {
    zone: "center",
    card: card
  });

  await sleep(500);

  const zoneB = engineB.space.zone("center");
  if (zoneB.length === 1 && zoneB[0].tokenId === "ace-spades") {
    console.log("✅ Space Sync Success");
  } else {
    console.error("❌ Space Sync Failed");
    process.exit(1);
  }

  // --- Test 2: Stack Sync ---
  console.log("\n🎴 Engine A: Drawing a card from stack...");
  
  // Verify initial state before draw
  if (engineB.stack?.size !== 2) {
     console.error(`❌ Pre-check failed: Engine B should have 2 cards, has ${engineB.stack?.size}`);
     // Don't exit yet, let's see what happens
  }

  // Draw 1 card on Engine A
  await engineA.dispatch("stack:draw", { count: 1 });

  console.log("Waiting for stack sync...");
  await sleep(1000);

  // Verify State on Engine B
  // Stack should have 1 left, Drawn should have 1
  const stackSizeB = engineB.stack?.size ?? 0;
  const drawnSizeB = engineB.stack?.drawn.length ?? 0;

  console.log(`[Debug] Engine B Stack State: Stack=${stackSizeB}, Drawn=${drawnSizeB}`);

  if (stackSizeB === 1 && drawnSizeB === 1) {
    console.log("✅ Stack Sync Success: Draw action propagated correctly!");
  } else {
    console.error("❌ Stack Sync Failed: State mismatch.");
    console.log("Engine B stack:", JSON.stringify(engineB.stack?.toJSON(), null, 2));
    process.exit(1);
  }

  engineA.disconnect();
  engineB.disconnect();
  server.stop();
  process.exit(0);
}

run().catch(console.error);