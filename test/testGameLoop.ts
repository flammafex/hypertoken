/*
 * test/testGameLoop.ts
 * FINAL LOGICALLY CORRECT VERSION
 */
import { Engine } from "../engine/Engine.js";
import { RelayServer } from "../interface/RelayServer.js";
import { Agent } from "../engine/Agent.js";
import { Engine as EngineType } from "../engine/Engine.js";

async function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// Helper function to create a promise that rejects after a timeout
function createTimeoutPromise(ms: number, message: string) {
    return new Promise((_, reject) => {
        setTimeout(() => reject(new Error(message)), ms);
    });
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

  // Mock Agents 
  const p1 = new Agent("Alice");
  const p2 = new Agent("Bob");

  const slowAgent = {
    // LOGIC FIX: Agent explicitly advances turn after waiting 1000ms.
    think: async (engine: EngineType, agent: Agent) => { 
      await sleep(1000); // Guarantees 1 second delay
      if (engine.loop.running) {
        engine.loop.nextTurn(); // This triggers the event
      }
    }
  };

  p1.agent = slowAgent;
  p2.agent = slowAgent;
  
  host._agents = [p1, p2];
  client._agents = [p1, p2];
  
  host.on("engine:error", (e) => console.error("🔥 Host Engine Error:", e));

  console.log("Connecting peers...");
  host.connect("ws://localhost:9092");
  client.connect("ws://localhost:9092");

  // Wait for initial connection/CRDT establishment
  await sleep(500); 

  // 3. Start Loop on Host and Await Synchronization
  console.log("\n🏁 Host: Starting Game Loop...");

  const loopStartPromise = new Promise(resolve => {
      client.loop.once("loop:start", resolve);
  });

  host.loop.start();
  
  // Wait until the Client confirms the start event via CRDT sync.
  await Promise.race([
      loopStartPromise,
      createTimeoutPromise(3000, "Timeout: Client failed to sync loop:start after 3s")
  ]); 

  // 4. Verify Turn 0 and Start Execution
  if (client.loop.running && client.loop.phase === "play" && (client.loop.turn as number) === 0) {
    console.log("✅ Client sees Game Loop RUNNING");
    console.log(`✅ Turn 0 synced. Active Agent: ${client.loop.activeAgent?.name}`);
  } else {
    host.disconnect();
    client.disconnect();
    server.stop();
    console.error("❌ Client Game Loop State Mismatch/Turn 0 Failed", 
      { running: client.loop.running, phase: client.loop.phase, turn: client.loop.turn });
    process.exit(1);
  }

  // --- CRITICAL STEP 5: EXECUTE ALICE'S TURN AND AWAIT SYNC ---

  const activeAgent = host.loop.activeAgent;
  
  if (!activeAgent) {
      console.error("❌ Internal Logic Error: Active Agent should be available.");
      process.exit(1);
  }
  
  console.log("\n⏳ Waiting for Turn 0 (Alice) to complete...");
  
  // Await the turn change event on the client
  const turnChangePromise = new Promise(resolve => {
    client.loop.once("turn:changed", (evt) => {
        if (evt.payload.turn === 1) resolve(evt);
    });
  });

  // CRITICAL: Call Alice's asynchronous think() method and wait for it to finish.
  // This blocks the test until Alice calls nextTurn() after 1000ms.
  await (activeAgent.agent as any)?.think?.(host, activeAgent); 

  // Wait for the Client to receive the CRDT sync initiated by activeAgent.think()
  await Promise.race([
      turnChangePromise,
      createTimeoutPromise(2000, "Timeout: Client failed to sync Turn 1 (Network was too slow after Agent finished)")
  ]); 

  // Verify Client sees Turn 1 (Agent 1)
  if ((client.loop.turn as number) === 1 && (client.loop.activeAgentIndex as number) === 1) {
    console.log(`✅ Turn 1 synced. Active Agent: ${client.loop.activeAgent?.name}`);
  } else {
    console.error("❌ Turn 1 Sync Failed", 
      { turn: client.loop.turn, activeIdx: client.loop.activeAgentIndex });
    process.exit(1);
  }
  
  // --- END OF TEST EXECUTION ---

  // 6. Stop Loop
  console.log("\n🛑 Host: Stopping Loop...");
  
  const loopStopPromise = new Promise(resolve => {
      client.loop.once("loop:stop", resolve);
  });

  host.loop.stop();
  
  await Promise.race([
      loopStopPromise,
      createTimeoutPromise(3000, "Timeout: Client failed to sync loop:stop after 3s")
  ]);

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
  console.error("Fatal test error:", e);
  process.exit(1);
});