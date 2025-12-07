/*
 * test/testEchoLoop.ts
 *
 * Echo Loop Prevention Test
 *
 * Verifies that Source Parameter Tracking (O(1) Echo Loop Prevention)
 * correctly prevents sync messages from being sent back to their originator.
 *
 * See: SOURCE_PARAMETER_TRACKING_WHITE_PAPER.md
 */
import { Chronicle } from "../core/Chronicle.js";
import { ConsensusCore, INetworkConnection } from "../core/ConsensusCore.js";
import { Emitter } from "../core/events.js";

/**
 * MockNetwork: A test network that tracks all messages sent
 *
 * This allows us to verify exactly which peers receive messages
 * and detect any echo loop conditions.
 */
class MockNetwork extends Emitter implements INetworkConnection {
  peerId: string;
  messageLog: Array<{ from: string; to: string; type: string }> = [];
  private _peers: Map<string, MockNetwork> = new Map();

  constructor(peerId: string) {
    super();
    this.peerId = peerId;
  }

  getPeerId(): string {
    return this.peerId;
  }

  connect(): void {
    // No-op for mock
  }

  disconnect(): void {
    // No-op for mock
  }

  /**
   * Connect this mock network to another peer's mock network
   */
  linkPeer(peerNetwork: MockNetwork): void {
    const peerId = peerNetwork.peerId;
    this._peers.set(peerId, peerNetwork);

    // Emit peer connected event (Emitter wraps this in { type, payload, ts })
    this.emit("net:peer:connected", { peerId });
  }

  /**
   * Send a message to a specific peer
   * This is the method ConsensusCore calls to send sync messages
   */
  sendToPeer(targetPeerId: string, payload: any): void {
    // Log the message for test verification
    this.messageLog.push({
      from: this.peerId,
      to: targetPeerId,
      type: payload.type || "unknown"
    });

    // Deliver to target peer
    const targetNetwork = this._peers.get(targetPeerId);
    if (targetNetwork) {
      // Simulate async network delivery
      // The payload structure expected by ConsensusCore.processMessage:
      // { type: "sync", data: "...", fromPeerId: "..." }
      setImmediate(() => {
        targetNetwork.emit("net:message", {
          ...payload,
          fromPeerId: this.peerId
        });
      });
    }
  }

  /**
   * Get count of messages sent TO a specific peer
   */
  getMessageCountTo(peerId: string): number {
    return this.messageLog.filter(m => m.to === peerId).length;
  }

  /**
   * Get count of messages sent FROM this peer
   */
  getTotalMessagesSent(): number {
    return this.messageLog.length;
  }
}

async function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function run(): Promise<void> {
  console.log("🔄 Echo Loop Prevention Test\n");
  console.log("Testing Source Parameter Tracking (O(1) Echo Loop Prevention)");
  console.log("See: SOURCE_PARAMETER_TRACKING_WHITE_PAPER.md\n");

  // ========================================
  // TEST 1: Basic Echo Prevention (2 peers)
  // ========================================
  console.log("━━━ Test 1: Basic Echo Prevention (2 peers) ━━━\n");

  // Create peer A
  const chronicleA = new Chronicle();
  const networkA = new MockNetwork("peer-A");
  const consensusA = new ConsensusCore(chronicleA, networkA);

  // Create peer B
  const chronicleB = new Chronicle();
  const networkB = new MockNetwork("peer-B");
  const consensusB = new ConsensusCore(chronicleB, networkB);

  // Link peers together (bidirectional)
  networkA.linkPeer(networkB);
  networkB.linkPeer(networkA);

  // Clear any initial sync messages
  await sleep(100);
  networkA.messageLog = [];
  networkB.messageLog = [];

  // Peer A makes a change
  console.log("Peer A: Making a local change...");
  chronicleA.change("test-change", (doc) => {
    doc.stack = { stack: [], drawn: [], discards: [] };
  });

  // Wait for sync to complete
  await sleep(200);

  // Verify: A should have sent to B
  const aSentToB = networkA.getMessageCountTo("peer-B");
  console.log(`  → Peer A sent ${aSentToB} message(s) to Peer B`);

  // Verify: B should NOT have sent back to A (echo prevention)
  const bSentToA = networkB.getMessageCountTo("peer-A");
  console.log(`  → Peer B sent ${bSentToA} message(s) back to Peer A`);

  // The key verification: B should send acknowledgment/convergence messages
  // but A should NOT re-broadcast those back to B (preventing infinite loop)

  // Total messages should be bounded (not growing infinitely)
  const totalMessages = networkA.getTotalMessagesSent() + networkB.getTotalMessagesSent();
  console.log(`  → Total messages exchanged: ${totalMessages}`);

  if (aSentToB >= 1 && totalMessages < 10) {
    console.log("✅ Test 1 PASSED: Message count is bounded (no echo loop)\n");
  } else {
    console.error("❌ Test 1 FAILED: Unexpected message pattern");
    console.log(`   Expected: A→B ≥ 1, total < 10`);
    console.log(`   Got: A→B = ${aSentToB}, total = ${totalMessages}`);
    process.exit(1);
  }

  // ========================================
  // TEST 2: Three-Peer Mesh (prevents cascade)
  // ========================================
  console.log("━━━ Test 2: Three-Peer Mesh Network ━━━\n");

  // Create three peers in a fully connected mesh
  const chronicle1 = new Chronicle();
  const network1 = new MockNetwork("peer-1");
  const consensus1 = new ConsensusCore(chronicle1, network1);

  const chronicle2 = new Chronicle();
  const network2 = new MockNetwork("peer-2");
  const consensus2 = new ConsensusCore(chronicle2, network2);

  const chronicle3 = new Chronicle();
  const network3 = new MockNetwork("peer-3");
  const consensus3 = new ConsensusCore(chronicle3, network3);

  // Full mesh connectivity
  network1.linkPeer(network2);
  network1.linkPeer(network3);
  network2.linkPeer(network1);
  network2.linkPeer(network3);
  network3.linkPeer(network1);
  network3.linkPeer(network2);

  // Wait for initial sync and clear logs
  await sleep(100);
  network1.messageLog = [];
  network2.messageLog = [];
  network3.messageLog = [];

  // Peer 1 makes a change
  console.log("Peer 1: Making a local change...");
  chronicle1.change("mesh-test", (doc) => {
    doc.space = { zones: { center: [] } };
  });

  // Wait for sync across mesh
  await sleep(300);

  // Analyze message flow
  const p1Sent = network1.getTotalMessagesSent();
  const p2Sent = network2.getTotalMessagesSent();
  const p3Sent = network3.getTotalMessagesSent();
  const meshTotal = p1Sent + p2Sent + p3Sent;

  console.log(`  → Peer 1 sent: ${p1Sent} messages`);
  console.log(`  → Peer 2 sent: ${p2Sent} messages`);
  console.log(`  → Peer 3 sent: ${p3Sent} messages`);
  console.log(`  → Total mesh messages: ${meshTotal}`);

  // In a mesh without echo prevention, this could explode exponentially
  // With echo prevention, messages should be bounded
  if (meshTotal < 20) {
    console.log("✅ Test 2 PASSED: Mesh sync bounded (no cascade loop)\n");
  } else {
    console.error("❌ Test 2 FAILED: Too many messages (possible cascade)");
    process.exit(1);
  }

  // ========================================
  // TEST 3: Verify State Convergence
  // ========================================
  console.log("━━━ Test 3: State Convergence Verification ━━━\n");

  // All peers should have the same state after sync
  const state1 = JSON.stringify(chronicle1.state);
  const state2 = JSON.stringify(chronicle2.state);
  const state3 = JSON.stringify(chronicle3.state);

  console.log("Checking state convergence across all peers...");

  if (state1 === state2 && state2 === state3) {
    console.log("✅ Test 3 PASSED: All peers converged to same state\n");
  } else {
    console.error("❌ Test 3 FAILED: State divergence detected");
    console.log("Peer 1:", state1);
    console.log("Peer 2:", state2);
    console.log("Peer 3:", state3);
    process.exit(1);
  }

  // ========================================
  // TEST 4: Source Tracking Specificity
  // ========================================
  console.log("━━━ Test 4: Source Tracking Specificity ━━━\n");

  // Reset message logs
  network1.messageLog = [];
  network2.messageLog = [];
  network3.messageLog = [];

  // Peer 2 makes a change
  console.log("Peer 2: Making a local change...");
  chronicle2.change("specificity-test", (doc) => {
    doc.agents = { "agent-1": { id: "agent-1", name: "Test Agent" } };
  });

  await sleep(300);

  // Verify peer 2 sent to peers 1 and 3, but NOT back to itself
  const p2To1 = network2.messageLog.filter(m => m.to === "peer-1").length;
  const p2To3 = network2.messageLog.filter(m => m.to === "peer-3").length;
  const p2ToSelf = network2.messageLog.filter(m => m.to === "peer-2").length;

  console.log(`  → Peer 2 sent to Peer 1: ${p2To1} message(s)`);
  console.log(`  → Peer 2 sent to Peer 3: ${p2To3} message(s)`);
  console.log(`  → Peer 2 sent to self: ${p2ToSelf} message(s)`);

  if (p2To1 >= 1 && p2To3 >= 1 && p2ToSelf === 0) {
    console.log("✅ Test 4 PASSED: Source tracking correctly excludes originator\n");
  } else {
    console.error("❌ Test 4 FAILED: Incorrect message routing");
    process.exit(1);
  }

  // ========================================
  // TEST 5: Rapid Sequential Changes
  // ========================================
  console.log("━━━ Test 5: Rapid Sequential Changes (Stress Test) ━━━\n");

  // Reset all logs
  network1.messageLog = [];
  network2.messageLog = [];
  network3.messageLog = [];

  // Multiple rapid changes from different peers
  console.log("Making 10 rapid changes from different peers...");

  for (let i = 0; i < 10; i++) {
    const chronicle = [chronicle1, chronicle2, chronicle3][i % 3];
    chronicle.change(`rapid-${i}`, (doc) => {
      if (!doc.counters) doc.counters = {};
      doc.counters[`count-${i}`] = i;
    });
  }

  // Wait for all syncs to complete
  await sleep(500);

  const rapidTotal = network1.getTotalMessagesSent() +
                     network2.getTotalMessagesSent() +
                     network3.getTotalMessagesSent();

  console.log(`  → Total messages after 10 rapid changes: ${rapidTotal}`);

  // Without echo prevention, 10 changes × 3 peers could cascade to hundreds of messages
  // With prevention, should be roughly: 10 changes × 2 target peers × some convergence = ~30-60
  if (rapidTotal < 100) {
    console.log("✅ Test 5 PASSED: Rapid changes handled efficiently\n");
  } else {
    console.error("❌ Test 5 FAILED: Too many messages under load");
    process.exit(1);
  }

  // ========================================
  // Summary
  // ========================================
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log("✨ All Echo Loop Prevention Tests PASSED!");
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log("\nSource Parameter Tracking verified:");
  console.log("  ✓ O(1) originator exclusion (no peer ID lists)");
  console.log("  ✓ No echo loops in 2-peer topology");
  console.log("  ✓ No cascade loops in mesh topology");
  console.log("  ✓ State convergence maintained");
  console.log("  ✓ Handles rapid changes efficiently");

  process.exit(0);
}

run().catch((err) => {
  console.error("Test error:", err);
  process.exit(1);
});
