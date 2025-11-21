/*
 * test/testSync.ts
 */
import { Engine } from "../engine/Engine.js";
import { RelayServer } from "../interface/RelayServer.js";
import { Token } from "../core/Token.js";

async function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function run() {
  console.log("🔗 Starting Synchronization Test...\n");

  const serverEngine = new Engine(); 
  // Enable verbose logging to trace packet routing
  const server = new RelayServer(serverEngine, { port: 9090, verbose: true });
  await server.start();

  const engineA = new Engine();
  const engineB = new Engine();

  engineA.on("engine:error", (e) => console.error("🔥 Engine A Error:", e));
  engineB.on("engine:error", (e) => console.error("🔥 Engine B Error:", e));

  console.log("Connecting clients...");
  engineA.connect("ws://localhost:9090");
  engineB.connect("ws://localhost:9090");

  await sleep(500);

  console.log("\n🃏 Engine A: Placing 'Ace of Spades' on table...");
  const card = new Token({ id: "ace-spades", label: "Ace of Spades" });
  
  engineA.dispatch("table:place", { 
    zone: "center", 
    card: card 
  });

  // Debug: Verify local state
  const zoneA = engineA.table.zone("center");
  console.log(`[Debug] Engine A Local State: ${zoneA.length} items`);
  
  if (zoneA.length === 0) {
    console.error("❌ CRITICAL: Engine A write failed.");
    process.exit(1);
  }

  console.log("Waiting for sync...");
  await sleep(1000);

  console.log("\n🔍 Verifying Engine B state...");
  const zoneB = engineB.table.zone("center");
  
  if (zoneB.length === 1 && zoneB[0].tokenId === "ace-spades") {
    console.log("✅ SUCCESS: Engine B received the card!");
  } else {
    console.error("❌ FAILURE: Engine B state mismatch.");
    console.log("   Zone B content:", JSON.stringify(zoneB, null, 2));
  }

  engineA.disconnect();
  engineB.disconnect();
  server.stop();
  process.exit(0);
}

run().catch(console.error);