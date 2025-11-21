/*
 * test/testGameLoop.ts
 */
import { Engine } from "../engine/Engine.js";
import { RelayServer } from "../interface/RelayServer.js";
import { Player } from "../engine/Player.js";

async function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function run() {
  console.log("🔗 Starting Game Loop Synchronization Test...\n");

  // 1. Start Relay Server (Use port 9092 to avoid conflicts)
  const serverEngine = new Engine();
  const server = new RelayServer(serverEngine, { port: 9092, verbose: false });
  await server.start();

  // 2. Setup Engines
  const host = new Engine();
  const client = new Engine();

  // Mock Players with Slow Agents to control pacing
  // This prevents the loop from racing through Turn 0 instantly
  const p1 = new Player("Alice");
  const p2 = new Player("Bob");

  const slowAgent = {
    think: async () => {
      // Simulate thinking time (keeps the turn active)
      await sleep(500);
    }
  };

  p1.agent = slowAgent;
  p2.agent = slowAgent;
  
  host._players = [p1, p2];
  // On the client, we manually sync players for this test
  client._players = [p1, p2];

  console.log("Connecting peers...");
  host.connect("ws://localhost:9092");
  client.connect("ws://localhost:9092");

  await sleep(500);

  // 3. Start Loop on Host
  console.log("\n🏁 Host: Starting Game Loop...");
  host.loop.start();

  // Wait a bit for start command to sync, but less than the agent think time
  await sleep(100);

  // Verify Client sees running state
  if (client.loop.running && client.loop.phase === "play") {
    console.log("✅ Client sees Game Loop RUNNING");
  } else {
    console.error("❌ Client Game Loop State Mismatch:", 
      { running: client.loop.running, phase: client.loop.phase });
    process.exit(1);
  }

  // 4. Check Initial Turn (Turn 0, Player 0)
  // P1 is thinking (500ms), so we should still be in Turn 0
  if ((client.loop.turn as number) === 0 && (client.loop.activePlayerIndex as number) === 0) {
    console.log(`✅ Turn 0 synced. Active Player: ${client.loop.activePlayer?.name}`);
  } else {
    console.error("❌ Turn 0 Sync Failed", 
      { turn: client.loop.turn, activeIdx: client.loop.activePlayerIndex });
    process.exit(1);
  }

  // 5. Wait for Turn Advance
  console.log("\n⏳ Waiting for Turn 0 to complete...");
  // P1 finishes at ~500ms. Wait enough to ensure we are in Turn 1 (P2 thinking)
  await sleep(600); 

  // Verify Client sees Turn 1 (Player 1)
  if ((client.loop.turn as number) === 1 && (client.loop.activePlayerIndex as number) === 1) {
    console.log(`✅ Turn 1 synced. Active Player: ${client.loop.activePlayer?.name}`);
  } else {
    console.error("❌ Turn 1 Sync Failed", 
      { turn: client.loop.turn, activeIdx: client.loop.activePlayerIndex });
    process.exit(1);
  }

  // 6. Stop Loop
  console.log("\n🛑 Host: Stopping Loop...");
  host.loop.stop();
  
  await sleep(200);

  if (!client.loop.running) {
    console.log("✅ Client sees Game Loop STOPPED");
  } else {
    console.error("❌ Stop Sync Failed");
    process.exit(1);
  }

  host.disconnect();
  client.disconnect();
  server.stop();
  console.log("\n✨ Phase 4 Verification Complete!");
  process.exit(0);
}

run().catch(e => {
  console.error(e);
  process.exit(1);
});