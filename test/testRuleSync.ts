/*
 * test/testRuleSync.ts
 */
import { Engine } from "../engine/Engine.js";
import { UniversalRelayServer } from "../network/UniversalRelayServer.js";
import { RuleEngine } from "../engine/RuleEngine.js";
import { Action } from "../engine/Action.js"; // Import Action for types

async function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function run() {
  console.log("🔗 Starting Rule Synchronization Test...\n");

  // 1. Start Relay Server
  const server = new UniversalRelayServer({ port: 9093, verbose: false });
  await server.start();

  // 2. Setup Host with RuleEngine
  const host = new Engine();
  const hostRules = new RuleEngine(host);
  host.useRuleEngine(hostRules);

  // Define a One-Time Rule
  hostRules.addRule(
    "first-blood", 
    // Explicitly type parameters to satisfy strict mode
    (engine: Engine, lastAction?: Action | null) => lastAction?.type === "test:action",
    (engine: Engine) => { console.log("   ⚡ [Host] Rule 'first-blood' executed!"); },
    { once: true }
  );

  // 3. Setup Client (No local rules needed, just observing state)
  const client = new Engine();

  console.log("Connecting peers...");
  host.connect("ws://localhost:9093");
  client.connect("ws://localhost:9093");

  await sleep(500);

  // 4. Trigger Rule on Host
  console.log("\n💥 Host: Dispatching trigger action...");
  host.dispatch("test:action", {});

  // Wait for sync
  await sleep(500);

  // 5. Verify Client State
  console.log("\n🔍 Checking Client Rule State...");
  const clientFired = client.session.state.rules?.fired || {};
  
  if (clientFired["first-blood"]) {
    console.log(`✅ Client sees 'first-blood' fired at timestamp: ${clientFired["first-blood"]}`);
  } else {
    console.error("❌ Client did not receive rule state update.");
    process.exit(1);
  }

  // 6. Verify Idempotency (Rule shouldn't fire twice)
  console.log("\n🔄 Host: Dispatching trigger AGAIN...");
  let reFired = false;
  
  // Hack to trap console log for verify
  const origLog = console.log;
  console.log = (msg: any) => { 
    if (typeof msg === 'string' && msg.includes("first-blood")) reFired = true; 
    origLog(msg);
  };

  host.dispatch("test:action", {});
  console.log = origLog;

  if (reFired) {
    console.error("❌ Rule re-fired! 'once: true' constraint failed.");
    process.exit(1);
  } else {
    console.log("✅ Rule correctly ignored (already fired).");
  }

  host.disconnect();
  client.disconnect();
  server.stop();
  console.log("\n✨ Phase 5 Verification Complete!");
  process.exit(0);
}

run().catch(e => {
  console.error(e);
  process.exit(1);
});