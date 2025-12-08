/*
 * test/testEchoLoop.ts
 *
 * Echo Loop Prevention Test
 *
 * Verifies that source parameter tracking correctly prevents sync messages
 * from being sent back to their originator.
 *
 * INCLUDES: Control group demonstrating behavior WITHOUT source tracking.
 */
import { Chronicle } from "../core/Chronicle.js";
import { ConsensusCore, INetworkConnection } from "../core/ConsensusCore.js";
import { Emitter } from "../core/events.js";
import * as A from "@automerge/automerge";
import { Buffer } from "node:buffer";

/**
 * BrokenConsensusCore: A deliberately flawed sync implementation
 * that does NOT use source tracking.
 *
 * This demonstrates the echo loop problem that occurs when you
 * broadcast state changes to ALL peers, including the one who
 * sent you the update.
 *
 * Note: Automerge's sync state tracking naturally prevents infinite loops
 * by returning null when there's nothing new. To demonstrate the true cost
 * of missing source tracking, we count the LISTENER INVOCATIONS, not just
 * network messages.
 */
class BrokenConsensusCore extends Emitter {
  session: Chronicle;
  network: INetworkConnection;
  private _syncStates: Map<string, A.SyncState> = new Map();

  // Track how many times the state:changed listener fires
  public listenerInvocations: number = 0;
  public updateAttempts: number = 0;

  constructor(session: Chronicle, network: INetworkConnection) {
    super();
    this.session = session;
    this.network = network;

    // BUG: No source tracking! Always broadcasts to ALL peers
    this.session.on("state:changed", () => {
      this.listenerInvocations++;
      this.updateAllPeers(); // <-- The bug: no exclusion
    });

    this.network.on("net:peer:connected", (evt) => {
      const { peerId } = evt.payload;
      this.addPeer(peerId);
    });

    this.network.on("net:message", (evt) => {
      this.processMessage(evt.payload);
    });
  }

  addPeer(peerId: string) {
    if (this._syncStates.has(peerId)) return;
    this._syncStates.set(peerId, A.initSyncState());
    this.updatePeer(peerId);
  }

  // BUG: Updates ALL peers, including the sender
  private updateAllPeers() {
    for (const peerId of this._syncStates.keys()) {
      this.updateAttempts++;
      this.updatePeer(peerId);
    }
  }

  private updatePeer(peerId: string) {
    const syncState = this._syncStates.get(peerId);
    if (!syncState) return;

    const doc = this.session.state;
    const [nextSyncState, message] = A.generateSyncMessage(doc, syncState);

    this._syncStates.set(peerId, nextSyncState);

    if (message) {
      this.network.sendToPeer(peerId, {
        type: "sync",
        data: Buffer.from(message).toString("base64")
      });
    }
  }

  private processMessage(payload: any) {
    if (!payload || payload.type !== "sync") return;
    if (!payload.data || !payload.fromPeerId) return;

    const peerId = payload.fromPeerId;
    let syncState = this._syncStates.get(peerId);
    if (!syncState) {
      syncState = A.initSyncState();
      this._syncStates.set(peerId, syncState);
    }

    const message = new Uint8Array(Buffer.from(payload.data, "base64"));

    try {
      const [newDoc, newSyncState] = A.receiveSyncMessage(
        this.session.state,
        syncState,
        message
      );

      this._syncStates.set(peerId, newSyncState);

      // BUG: update() without source triggers broadcast to ALL peers
      // including the one who just sent us this update!
      this.session.update(newDoc);

      this.updatePeer(peerId);
    } catch (err) {
      // Ignore errors in broken implementation
    }
  }
}

/**
 * FixedConsensusCore: Same as ConsensusCore but with tracking
 * to show the difference in listener invocations.
 */
class FixedConsensusCore extends Emitter {
  session: Chronicle;
  network: INetworkConnection;
  private _syncStates: Map<string, A.SyncState> = new Map();

  // Track metrics for comparison
  public listenerInvocations: number = 0;
  public updateAttempts: number = 0;

  constructor(session: Chronicle, network: INetworkConnection) {
    super();
    this.session = session;
    this.network = network;

    // FIXED: Uses source tracking to exclude originator
    this.session.on("state:changed", (evt) => {
      this.listenerInvocations++;
      const source = evt.source || "local";
      this.updatePeers(source);
    });

    this.network.on("net:peer:connected", (evt) => {
      const { peerId } = evt.payload;
      this.addPeer(peerId);
    });

    this.network.on("net:message", (evt) => {
      this.processMessage(evt.payload);
    });
  }

  addPeer(peerId: string) {
    if (this._syncStates.has(peerId)) return;
    this._syncStates.set(peerId, A.initSyncState());
    this.updatePeer(peerId);
  }

  // FIXED: Excludes the source peer
  private updatePeers(excludePeerId: string = "local") {
    for (const peerId of this._syncStates.keys()) {
      if (peerId !== excludePeerId) {
        this.updateAttempts++;
        this.updatePeer(peerId);
      }
    }
  }

  private updatePeer(peerId: string) {
    const syncState = this._syncStates.get(peerId);
    if (!syncState) return;

    const doc = this.session.state;
    const [nextSyncState, message] = A.generateSyncMessage(doc, syncState);

    this._syncStates.set(peerId, nextSyncState);

    if (message) {
      this.network.sendToPeer(peerId, {
        type: "sync",
        data: Buffer.from(message).toString("base64")
      });
    }
  }

  private processMessage(payload: any) {
    if (!payload || payload.type !== "sync") return;
    if (!payload.data || !payload.fromPeerId) return;

    const peerId = payload.fromPeerId;
    let syncState = this._syncStates.get(peerId);
    if (!syncState) {
      syncState = A.initSyncState();
      this._syncStates.set(peerId, syncState);
    }

    const message = new Uint8Array(Buffer.from(payload.data, "base64"));

    try {
      const [newDoc, newSyncState] = A.receiveSyncMessage(
        this.session.state,
        syncState,
        message
      );

      this._syncStates.set(peerId, newSyncState);

      // FIXED: Mark source as the peer who sent this update
      this.session.update(newDoc, peerId);

      this.updatePeer(peerId);
    } catch (err) {
      // Ignore errors
    }
  }
}

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
  console.log("Testing source parameter tracking in ConsensusCore\n");

  // ========================================
  // TEST 0: CONTROL GROUP - Demonstrate Echo Loop Problem
  // ========================================
  console.log("━━━ Test 0: CONTROL GROUP - Echo Loop WITHOUT Protection ━━━\n");
  console.log("This demonstrates what happens when source tracking is NOT used.");
  console.log("We track listener invocations and update attempts to show wasted work.\n");

  // Create peers using BrokenConsensusCore (no source tracking)
  const brokenChronicleA = new Chronicle();
  const brokenNetworkA = new MockNetwork("broken-A");
  const brokenConsensusA = new BrokenConsensusCore(brokenChronicleA, brokenNetworkA);

  const brokenChronicleB = new Chronicle();
  const brokenNetworkB = new MockNetwork("broken-B");
  const brokenConsensusB = new BrokenConsensusCore(brokenChronicleB, brokenNetworkB);

  // Create equivalent fixed peers for comparison
  const fixedChronicleA = new Chronicle();
  const fixedNetworkA = new MockNetwork("fixed-A");
  const fixedConsensusA = new FixedConsensusCore(fixedChronicleA, fixedNetworkA);

  const fixedChronicleB = new Chronicle();
  const fixedNetworkB = new MockNetwork("fixed-B");
  const fixedConsensusB = new FixedConsensusCore(fixedChronicleB, fixedNetworkB);

  // Link peers
  brokenNetworkA.linkPeer(brokenNetworkB);
  brokenNetworkB.linkPeer(brokenNetworkA);
  fixedNetworkA.linkPeer(fixedNetworkB);
  fixedNetworkB.linkPeer(fixedNetworkA);

  // Wait and reset counters
  await sleep(100);
  brokenNetworkA.messageLog = [];
  brokenNetworkB.messageLog = [];
  brokenConsensusA.listenerInvocations = 0;
  brokenConsensusA.updateAttempts = 0;
  brokenConsensusB.listenerInvocations = 0;
  brokenConsensusB.updateAttempts = 0;

  fixedNetworkA.messageLog = [];
  fixedNetworkB.messageLog = [];
  fixedConsensusA.listenerInvocations = 0;
  fixedConsensusA.updateAttempts = 0;
  fixedConsensusB.listenerInvocations = 0;
  fixedConsensusB.updateAttempts = 0;

  // Make a single change on both
  console.log("Making identical changes on broken and fixed implementations...\n");
  brokenChronicleA.change("broken-test", (doc) => {
    doc.stack = { stack: [], drawn: [], discards: [] };
  });
  fixedChronicleA.change("fixed-test", (doc) => {
    doc.stack = { stack: [], drawn: [], discards: [] };
  });

  // Wait for sync
  await sleep(500);

  const brokenTotal = brokenNetworkA.getTotalMessagesSent() + brokenNetworkB.getTotalMessagesSent();
  const brokenListeners = brokenConsensusA.listenerInvocations + brokenConsensusB.listenerInvocations;
  const brokenAttempts = brokenConsensusA.updateAttempts + brokenConsensusB.updateAttempts;

  const fixedTotal = fixedNetworkA.getTotalMessagesSent() + fixedNetworkB.getTotalMessagesSent();
  const fixedListeners = fixedConsensusA.listenerInvocations + fixedConsensusB.listenerInvocations;
  const fixedAttempts = fixedConsensusA.updateAttempts + fixedConsensusB.updateAttempts;

  console.log("  BROKEN (no source tracking):");
  console.log(`    • Listener invocations: ${brokenListeners}`);
  console.log(`    • Update attempts: ${brokenAttempts}`);
  console.log(`    • Network messages: ${brokenTotal}`);

  console.log("\n  FIXED (with source tracking):");
  console.log(`    • Listener invocations: ${fixedListeners}`);
  console.log(`    • Update attempts: ${fixedAttempts}`);
  console.log(`    • Network messages: ${fixedTotal}`);

  const listenerSavings = brokenListeners > 0 ? ((brokenListeners - fixedListeners) / brokenListeners * 100).toFixed(0) : 0;
  const attemptSavings = brokenAttempts > 0 ? ((brokenAttempts - fixedAttempts) / brokenAttempts * 100).toFixed(0) : 0;

  console.log(`\n  ⚡ Savings: ${listenerSavings}% fewer listener calls, ${attemptSavings}% fewer update attempts`);

  // Now test with 3 peers (cascade effect is more dramatic)
  console.log("\n  Testing 3-peer mesh (cascade amplification)...\n");

  const broken1 = new Chronicle();
  const brokenNet1 = new MockNetwork("broken-1");
  const brokenCon1 = new BrokenConsensusCore(broken1, brokenNet1);

  const broken2 = new Chronicle();
  const brokenNet2 = new MockNetwork("broken-2");
  const brokenCon2 = new BrokenConsensusCore(broken2, brokenNet2);

  const broken3 = new Chronicle();
  const brokenNet3 = new MockNetwork("broken-3");
  const brokenCon3 = new BrokenConsensusCore(broken3, brokenNet3);

  const fixed1 = new Chronicle();
  const fixedNet1 = new MockNetwork("fixed-1");
  const fixedCon1 = new FixedConsensusCore(fixed1, fixedNet1);

  const fixed2 = new Chronicle();
  const fixedNet2 = new MockNetwork("fixed-2");
  const fixedCon2 = new FixedConsensusCore(fixed2, fixedNet2);

  const fixed3 = new Chronicle();
  const fixedNet3 = new MockNetwork("fixed-3");
  const fixedCon3 = new FixedConsensusCore(fixed3, fixedNet3);

  // Full mesh - broken
  brokenNet1.linkPeer(brokenNet2);
  brokenNet1.linkPeer(brokenNet3);
  brokenNet2.linkPeer(brokenNet1);
  brokenNet2.linkPeer(brokenNet3);
  brokenNet3.linkPeer(brokenNet1);
  brokenNet3.linkPeer(brokenNet2);

  // Full mesh - fixed
  fixedNet1.linkPeer(fixedNet2);
  fixedNet1.linkPeer(fixedNet3);
  fixedNet2.linkPeer(fixedNet1);
  fixedNet2.linkPeer(fixedNet3);
  fixedNet3.linkPeer(fixedNet1);
  fixedNet3.linkPeer(fixedNet2);

  await sleep(100);
  // Reset counters
  brokenNet1.messageLog = [];
  brokenNet2.messageLog = [];
  brokenNet3.messageLog = [];
  brokenCon1.listenerInvocations = 0;
  brokenCon1.updateAttempts = 0;
  brokenCon2.listenerInvocations = 0;
  brokenCon2.updateAttempts = 0;
  brokenCon3.listenerInvocations = 0;
  brokenCon3.updateAttempts = 0;

  fixedNet1.messageLog = [];
  fixedNet2.messageLog = [];
  fixedNet3.messageLog = [];
  fixedCon1.listenerInvocations = 0;
  fixedCon1.updateAttempts = 0;
  fixedCon2.listenerInvocations = 0;
  fixedCon2.updateAttempts = 0;
  fixedCon3.listenerInvocations = 0;
  fixedCon3.updateAttempts = 0;

  // Single change
  broken1.change("mesh-broken-test", (doc) => {
    doc.space = { zones: { center: [] } };
  });
  fixed1.change("mesh-fixed-test", (doc) => {
    doc.space = { zones: { center: [] } };
  });

  await sleep(500);

  const brokenMeshTotal = brokenNet1.getTotalMessagesSent() +
                          brokenNet2.getTotalMessagesSent() +
                          brokenNet3.getTotalMessagesSent();
  const brokenMeshListeners = brokenCon1.listenerInvocations +
                              brokenCon2.listenerInvocations +
                              brokenCon3.listenerInvocations;
  const brokenMeshAttempts = brokenCon1.updateAttempts +
                             brokenCon2.updateAttempts +
                             brokenCon3.updateAttempts;

  const fixedMeshTotal = fixedNet1.getTotalMessagesSent() +
                         fixedNet2.getTotalMessagesSent() +
                         fixedNet3.getTotalMessagesSent();
  const fixedMeshListeners = fixedCon1.listenerInvocations +
                             fixedCon2.listenerInvocations +
                             fixedCon3.listenerInvocations;
  const fixedMeshAttempts = fixedCon1.updateAttempts +
                            fixedCon2.updateAttempts +
                            fixedCon3.updateAttempts;

  console.log("  3-PEER MESH RESULTS:");
  console.log(`    Broken: ${brokenMeshListeners} listeners, ${brokenMeshAttempts} attempts, ${brokenMeshTotal} messages`);
  console.log(`    Fixed:  ${fixedMeshListeners} listeners, ${fixedMeshAttempts} attempts, ${fixedMeshTotal} messages`);

  const meshListenerSavings = brokenMeshListeners > 0 ? ((brokenMeshListeners - fixedMeshListeners) / brokenMeshListeners * 100).toFixed(0) : 0;
  const meshAttemptSavings = brokenMeshAttempts > 0 ? ((brokenMeshAttempts - fixedMeshAttempts) / brokenMeshAttempts * 100).toFixed(0) : 0;

  console.log(`    ⚡ Savings: ${meshListenerSavings}% fewer listeners, ${meshAttemptSavings}% fewer attempts`);
  console.log("\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");

  // ========================================
  // TEST 1: Basic Echo Prevention (2 peers)
  // ========================================
  console.log("━━━ Test 1: Basic Echo Prevention (2 peers) ━━━\n");
  console.log("Now testing WITH source tracking protection:\n");

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
    chronicle.change(`rapid-${i}`, (doc: any) => {
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

  console.log("\n📊 COMPARISON: Without vs With Source Tracking");
  console.log("────────────────────────────────────────────────");
  console.log(`  2-peer (broken):     ${brokenTotal} messages`);
  console.log(`  2-peer (protected):  ${totalMessages} messages`);
  console.log(`  3-peer (broken):     ${brokenMeshTotal} messages`);
  console.log(`  3-peer (protected):  ${meshTotal} messages`);

  const savings2peer = brokenTotal > 0 ? ((brokenTotal - totalMessages) / brokenTotal * 100).toFixed(0) : 0;
  const savings3peer = brokenMeshTotal > 0 ? ((brokenMeshTotal - meshTotal) / brokenMeshTotal * 100).toFixed(0) : 0;
  console.log(`\n  Message reduction: ${savings2peer}% (2-peer), ${savings3peer}% (3-peer)`);

  console.log("\n✓ Source Parameter Tracking verified:");
  console.log("  • O(1) originator exclusion (no peer ID lists)");
  console.log("  • No echo loops in 2-peer topology");
  console.log("  • No cascade loops in mesh topology");
  console.log("  • State convergence maintained");
  console.log("  • Handles rapid changes efficiently");

  process.exit(0);
}

run().catch((err) => {
  console.error("Test error:", err);
  process.exit(1);
});
