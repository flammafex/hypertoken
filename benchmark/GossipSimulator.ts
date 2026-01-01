/*
 * benchmark/GossipSimulator.ts
 * Simulation harness for comparing gossip topologies
 *
 * Simulates message propagation across different network sizes and topologies:
 * - Naive: O(N) broadcast (current implementation)
 * - Kademlia: O(log N) structured overlay
 * - Supernode: O(sqrt N) hierarchical topology
 *
 * Measures:
 * - Propagation latency (p50, p90, p99)
 * - Messages per peer (bandwidth proxy)
 * - Connection count distribution
 * - Delivery success rate
 */

import {
  PeerId,
  RoutedPeer,
  RoutedMessage,
  ConnectionState,
  generateRandomPeerId,
  peerIdToString,
  createMessageId
} from "../network/routing/types.js";
import { KademliaRouter, KademliaConfig } from "../network/routing/KademliaRouter.js";
import { SupernodeManager, SupernodeConfig, NodeRole } from "../network/routing/SupernodeManager.js";

/**
 * Simulation configuration
 */
export interface SimulationConfig {
  /** Number of peers in the network */
  peerCount: number;
  /** Size of broadcast messages in bytes */
  messageSize: number;
  /** Messages broadcast per second (per originator) */
  messagesPerSecond: number;
  /** Simulated network latency range */
  networkLatency: { min: number; max: number };
  /** Packet loss probability (0-1) */
  packetLoss: number;
  /** Topology to simulate */
  topology: 'naive' | 'kademlia' | 'supernode';
  /** Simulation duration in milliseconds */
  duration: number;
  /** Random seed for reproducibility */
  seed?: number;
}

/**
 * Simulation results
 */
export interface SimulationResult {
  config: SimulationConfig;
  propagationTime: {
    p50: number;
    p90: number;
    p99: number;
    max: number;
  };
  messagesPerPeer: {
    sent: number;
    received: number;
    forwarded: number;
  };
  bandwidthPerPeer: {
    sent: number;    // bytes
    received: number;
  };
  deliveryRate: number;
  connectionCount: {
    min: number;
    max: number;
    avg: number;
  };
  hops: {
    avg: number;
    max: number;
  };
  wallTime: number;
}

/**
 * Simulated peer with message tracking
 */
interface SimulatedPeer {
  id: PeerId;
  idString: string;
  connections: Set<string>;
  messagesSent: number;
  messagesReceived: number;
  messagesForwarded: number;
  bytesSent: number;
  bytesReceived: number;
  router?: KademliaRouter | SupernodeManager;
  role?: NodeRole;
}

/**
 * Message delivery record
 */
interface DeliveryRecord {
  messageId: string;
  origin: string;
  startTime: number;
  deliveries: Map<string, { time: number; hops: number }>;
}

/**
 * Simple seeded PRNG for reproducibility
 */
class SeededRandom {
  private seed: number;

  constructor(seed: number = Date.now()) {
    this.seed = seed;
  }

  next(): number {
    this.seed = (this.seed * 1103515245 + 12345) & 0x7fffffff;
    return this.seed / 0x7fffffff;
  }

  nextInt(max: number): number {
    return Math.floor(this.next() * max);
  }

  nextRange(min: number, max: number): number {
    return min + this.next() * (max - min);
  }
}

/**
 * GossipSimulator runs simulated networks to benchmark topologies
 */
export class GossipSimulator {
  private config: SimulationConfig;
  private random: SeededRandom;
  private peers: Map<string, SimulatedPeer> = new Map();
  private deliveryRecords: Map<string, DeliveryRecord> = new Map();
  private messageQueue: Array<{
    to: string;
    message: any;
    arrivalTime: number;
    hops: number;
  }> = [];
  private currentTime: number = 0;

  constructor(config: SimulationConfig) {
    this.config = config;
    this.random = new SeededRandom(config.seed);
  }

  /**
   * Run the simulation and return results
   */
  async run(): Promise<SimulationResult> {
    const startWallTime = Date.now();

    // Initialize peers
    this.initializePeers();

    // Build topology
    switch (this.config.topology) {
      case 'naive':
        this.buildNaiveTopology();
        break;
      case 'kademlia':
        this.buildKademliaTopology();
        break;
      case 'supernode':
        this.buildSupernodeTopology();
        break;
    }

    // Run simulation
    await this.simulate();

    // Collect results
    const result = this.collectResults();
    result.wallTime = Date.now() - startWallTime;

    return result;
  }

  /**
   * Initialize simulated peers
   */
  private initializePeers(): void {
    this.peers.clear();

    for (let i = 0; i < this.config.peerCount; i++) {
      const id = generateRandomPeerId();
      const idString = peerIdToString(id);

      this.peers.set(idString, {
        id,
        idString,
        connections: new Set(),
        messagesSent: 0,
        messagesReceived: 0,
        messagesForwarded: 0,
        bytesSent: 0,
        bytesReceived: 0
      });
    }
  }

  /**
   * Build naive full-mesh topology (O(N) connections)
   */
  private buildNaiveTopology(): void {
    const peerIds = Array.from(this.peers.keys());

    // Each peer connects to all other peers
    for (const peer of this.peers.values()) {
      for (const otherId of peerIds) {
        if (otherId !== peer.idString) {
          peer.connections.add(otherId);
        }
      }
    }
  }

  /**
   * Build Kademlia-style topology (O(log N) connections)
   */
  private buildKademliaTopology(): void {
    const peerIds = Array.from(this.peers.keys());
    const k = 20; // k-bucket size

    for (const peer of this.peers.values()) {
      // Create Kademlia router for this peer
      const router = new KademliaRouter(peer.id, { k, debug: false });
      peer.router = router;

      // Add random peers to routing table (simulating bootstrap)
      const shuffled = [...peerIds].sort(() => this.random.next() - 0.5);

      for (const otherId of shuffled) {
        if (otherId === peer.idString) continue;

        const otherPeer = this.peers.get(otherId)!;
        const routedPeer = this.createRoutedPeer(otherPeer);

        if (router.addPeer(routedPeer)) {
          peer.connections.add(otherId);
        }

        // Limit connections based on routing table
        if (peer.connections.size >= k * Math.ceil(Math.log2(this.config.peerCount))) {
          break;
        }
      }
    }
  }

  /**
   * Build supernode topology (O(sqrt N) connections)
   */
  private buildSupernodeTopology(): void {
    const peerIds = Array.from(this.peers.keys());
    const supernodeCount = Math.ceil(Math.sqrt(this.config.peerCount));
    const maxLeavesPerSupernode = Math.ceil(this.config.peerCount / supernodeCount);

    // Select supernodes
    const shuffled = [...peerIds].sort(() => this.random.next() - 0.5);
    const supernodeIds = new Set(shuffled.slice(0, supernodeCount));

    // Configure each peer
    for (const peer of this.peers.values()) {
      const isSupernode = supernodeIds.has(peer.idString);
      peer.role = isSupernode ? NodeRole.Supernode : NodeRole.Leaf;

      const manager = new SupernodeManager(peer.id, {
        maxLeavesPerSupernode,
        targetSupernodeCount: 3,
        supernodeGossipFanout: 5,
        debug: false
      });
      peer.router = manager;

      if (isSupernode) {
        // Connect to other supernodes
        for (const otherId of supernodeIds) {
          if (otherId !== peer.idString) {
            peer.connections.add(otherId);
          }
        }
      } else {
        // Connect to a few supernodes
        const targetCount = 3;
        let connected = 0;
        for (const snId of supernodeIds) {
          if (connected >= targetCount) break;
          peer.connections.add(snId);
          connected++;
        }
      }
    }
  }

  /**
   * Create a RoutedPeer from a SimulatedPeer
   */
  private createRoutedPeer(peer: SimulatedPeer): RoutedPeer {
    return {
      id: peer.id,
      idString: peer.idString,
      state: ConnectionState.Connected,
      lastSeen: Date.now(),
      rtt: this.random.nextRange(
        this.config.networkLatency.min,
        this.config.networkLatency.max
      ),
      failureCount: 0,
      send: async (data: any) => {
        return this.simulateSend(peer.idString, data);
      }
    };
  }

  /**
   * Simulate sending a message
   */
  private simulateSend(toId: string, data: any): boolean {
    // Check packet loss
    if (this.random.next() < this.config.packetLoss) {
      return false;
    }

    const latency = this.random.nextRange(
      this.config.networkLatency.min,
      this.config.networkLatency.max
    );

    const hops = (data._hops || 0) + 1;

    this.messageQueue.push({
      to: toId,
      message: { ...data, _hops: hops },
      arrivalTime: this.currentTime + latency,
      hops
    });

    return true;
  }

  /**
   * Run the simulation loop
   */
  private async simulate(): Promise<void> {
    const { duration, messagesPerSecond } = this.config;
    const messageInterval = 1000 / messagesPerSecond;
    const peerIds = Array.from(this.peers.keys());

    let nextBroadcastTime = 0;
    let broadcastIndex = 0;

    while (this.currentTime < duration) {
      // Process message queue
      while (this.messageQueue.length > 0 && this.messageQueue[0].arrivalTime <= this.currentTime) {
        const item = this.messageQueue.shift()!;
        await this.deliverMessage(item.to, item.message, item.hops);
      }

      // Sort queue by arrival time
      this.messageQueue.sort((a, b) => a.arrivalTime - b.arrivalTime);

      // Initiate broadcasts
      if (this.currentTime >= nextBroadcastTime) {
        const originId = peerIds[broadcastIndex % peerIds.length];
        await this.initiateBroadcast(originId);
        broadcastIndex++;
        nextBroadcastTime += messageInterval;
      }

      // Advance time
      const nextEventTime = this.messageQueue.length > 0
        ? Math.min(this.messageQueue[0].arrivalTime, nextBroadcastTime)
        : nextBroadcastTime;

      this.currentTime = Math.min(nextEventTime, duration);
    }
  }

  /**
   * Initiate a broadcast from a peer
   */
  private async initiateBroadcast(originId: string): Promise<void> {
    const origin = this.peers.get(originId)!;
    const messageId = `msg-${originId}-${this.currentTime}`;

    // Record delivery tracking
    this.deliveryRecords.set(messageId, {
      messageId,
      origin: originId,
      startTime: this.currentTime,
      deliveries: new Map([[originId, { time: this.currentTime, hops: 0 }]])
    });

    const message = {
      id: messageId,
      type: 'broadcast',
      payload: new Array(this.config.messageSize).fill(0),
      ttl: 10,
      origin: origin.id,
      timestamp: this.currentTime,
      _hops: 0
    };

    // Send to all connections
    origin.messagesSent++;
    origin.bytesSent += this.config.messageSize;

    for (const connId of origin.connections) {
      this.simulateSend(connId, message);
    }
  }

  /**
   * Deliver a message to a peer
   */
  private async deliverMessage(toId: string, message: any, hops: number): Promise<void> {
    const peer = this.peers.get(toId);
    if (!peer) return;

    // Track delivery
    const record = this.deliveryRecords.get(message.id);
    if (record && !record.deliveries.has(toId)) {
      record.deliveries.set(toId, { time: this.currentTime, hops });
      peer.messagesReceived++;
      peer.bytesReceived += this.config.messageSize;

      // Forward message (unless we're the origin or TTL expired)
      if (message.ttl > 0 && toId !== record.origin) {
        peer.messagesForwarded++;
        const forwardMessage = { ...message, ttl: message.ttl - 1 };

        for (const connId of peer.connections) {
          // Don't send back to sender
          if (!record.deliveries.has(connId)) {
            peer.bytesSent += this.config.messageSize;
            this.simulateSend(connId, forwardMessage);
          }
        }
      }
    }
  }

  /**
   * Collect simulation results
   */
  private collectResults(): SimulationResult {
    const propagationTimes: number[] = [];
    const hopCounts: number[] = [];
    let totalDelivered = 0;
    let totalPossible = 0;

    // Calculate propagation times
    for (const record of this.deliveryRecords.values()) {
      const targetCount = this.peers.size - 1; // Exclude origin
      totalPossible += targetCount;

      for (const [peerId, delivery] of record.deliveries) {
        if (peerId !== record.origin) {
          propagationTimes.push(delivery.time - record.startTime);
          hopCounts.push(delivery.hops);
          totalDelivered++;
        }
      }
    }

    // Sort for percentiles
    propagationTimes.sort((a, b) => a - b);

    // Calculate connection stats
    const connectionCounts = Array.from(this.peers.values()).map(p => p.connections.size);
    connectionCounts.sort((a, b) => a - b);

    // Calculate message stats
    let totalSent = 0;
    let totalReceived = 0;
    let totalForwarded = 0;
    let totalBytesSent = 0;
    let totalBytesReceived = 0;

    for (const peer of this.peers.values()) {
      totalSent += peer.messagesSent;
      totalReceived += peer.messagesReceived;
      totalForwarded += peer.messagesForwarded;
      totalBytesSent += peer.bytesSent;
      totalBytesReceived += peer.bytesReceived;
    }

    return {
      config: this.config,
      propagationTime: {
        p50: this.percentile(propagationTimes, 0.5),
        p90: this.percentile(propagationTimes, 0.9),
        p99: this.percentile(propagationTimes, 0.99),
        max: propagationTimes[propagationTimes.length - 1] || 0
      },
      messagesPerPeer: {
        sent: totalSent / this.peers.size,
        received: totalReceived / this.peers.size,
        forwarded: totalForwarded / this.peers.size
      },
      bandwidthPerPeer: {
        sent: totalBytesSent / this.peers.size,
        received: totalBytesReceived / this.peers.size
      },
      deliveryRate: totalPossible > 0 ? totalDelivered / totalPossible : 0,
      connectionCount: {
        min: connectionCounts[0] || 0,
        max: connectionCounts[connectionCounts.length - 1] || 0,
        avg: connectionCounts.reduce((a, b) => a + b, 0) / connectionCounts.length || 0
      },
      hops: {
        avg: hopCounts.length > 0
          ? hopCounts.reduce((a, b) => a + b, 0) / hopCounts.length
          : 0,
        max: Math.max(...hopCounts, 0)
      },
      wallTime: 0
    };
  }

  /**
   * Calculate percentile from sorted array
   */
  private percentile(sorted: number[], p: number): number {
    if (sorted.length === 0) return 0;
    const index = Math.ceil(p * sorted.length) - 1;
    return sorted[Math.max(0, Math.min(index, sorted.length - 1))];
  }
}

/**
 * Run a batch of simulations
 */
export async function runSimulationBatch(
  configs: SimulationConfig[]
): Promise<SimulationResult[]> {
  const results: SimulationResult[] = [];

  for (const config of configs) {
    console.log(`Running simulation: ${config.peerCount} peers, ${config.topology} topology...`);
    const simulator = new GossipSimulator(config);
    const result = await simulator.run();
    results.push(result);
    console.log(`  Completed in ${result.wallTime}ms, delivery rate: ${(result.deliveryRate * 100).toFixed(1)}%`);
  }

  return results;
}

/**
 * Default simulation scenarios
 */
export const DEFAULT_SCENARIOS: SimulationConfig[] = [
  // Small network
  { peerCount: 100, topology: 'naive', messageSize: 256, messagesPerSecond: 10, networkLatency: { min: 10, max: 100 }, packetLoss: 0.01, duration: 5000 },
  { peerCount: 100, topology: 'kademlia', messageSize: 256, messagesPerSecond: 10, networkLatency: { min: 10, max: 100 }, packetLoss: 0.01, duration: 5000 },
  { peerCount: 100, topology: 'supernode', messageSize: 256, messagesPerSecond: 10, networkLatency: { min: 10, max: 100 }, packetLoss: 0.01, duration: 5000 },

  // Medium network
  { peerCount: 1000, topology: 'naive', messageSize: 256, messagesPerSecond: 10, networkLatency: { min: 10, max: 100 }, packetLoss: 0.01, duration: 5000 },
  { peerCount: 1000, topology: 'kademlia', messageSize: 256, messagesPerSecond: 10, networkLatency: { min: 10, max: 100 }, packetLoss: 0.01, duration: 5000 },
  { peerCount: 1000, topology: 'supernode', messageSize: 256, messagesPerSecond: 10, networkLatency: { min: 10, max: 100 }, packetLoss: 0.01, duration: 5000 },

  // Large network (skip naive due to O(N^2) connections)
  { peerCount: 10000, topology: 'kademlia', messageSize: 256, messagesPerSecond: 10, networkLatency: { min: 10, max: 100 }, packetLoss: 0.01, duration: 5000 },
  { peerCount: 10000, topology: 'supernode', messageSize: 256, messagesPerSecond: 10, networkLatency: { min: 10, max: 100 }, packetLoss: 0.01, duration: 5000 },
];

/**
 * Format results as a comparison table
 */
export function formatResultsTable(results: SimulationResult[]): string {
  const lines: string[] = [
    '| Peers | Topology | p50 (ms) | p90 (ms) | p99 (ms) | Delivery | Conns (avg) | Msgs/Peer |',
    '|-------|----------|----------|----------|----------|----------|-------------|-----------|'
  ];

  for (const r of results) {
    lines.push(
      `| ${r.config.peerCount.toString().padStart(5)} ` +
      `| ${r.config.topology.padEnd(8)} ` +
      `| ${r.propagationTime.p50.toFixed(1).padStart(8)} ` +
      `| ${r.propagationTime.p90.toFixed(1).padStart(8)} ` +
      `| ${r.propagationTime.p99.toFixed(1).padStart(8)} ` +
      `| ${(r.deliveryRate * 100).toFixed(1).padStart(7)}% ` +
      `| ${r.connectionCount.avg.toFixed(1).padStart(11)} ` +
      `| ${r.messagesPerPeer.sent.toFixed(1).padStart(9)} |`
    );
  }

  return lines.join('\n');
}
