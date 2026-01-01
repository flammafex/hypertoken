# HyperToken Gossip Scaling: Design Document

## Overview

This document describes the structured overlay implementations for scaling HyperToken's gossip protocol beyond naive O(N) broadcast. Two complementary approaches are implemented:

1. **Kademlia DHT** - O(log N) connections and message complexity
2. **Supernode Architecture** - O(sqrt N) hierarchical routing

## Problem Statement

The current naive gossip implementation forwards every message to every connected peer:

```
Naive Gossip:
- Connections per peer: O(N)
- Messages per broadcast: O(N)
- Bandwidth: O(N * message_size)
- Browser connection limit: ~200-500 WebSocket/WebRTC
```

This breaks down around 1,000-10,000 concurrent peers due to:
- **Bandwidth saturation**: Each peer sends N messages per broadcast
- **Connection limits**: Browsers cap WebSocket/WebRTC connections
- **Latency growth**: Network diameter increases with peer count

## Solution Architecture

### Module Structure

```
network/
├── routing/
│   ├── types.ts           # Shared interfaces (Router, RoutedPeer, RoutedMessage)
│   ├── RoutingTable.ts    # Base routing table with peer management
│   ├── KademliaRouter.ts  # Kademlia DHT implementation
│   ├── SupernodeManager.ts # Supernode hierarchy implementation
│   └── index.ts           # Exports
├── RoutedPeerManager.ts   # Unified manager with pluggable routing
└── HybridPeerManager.ts   # Existing WebSocket + WebRTC transport

benchmark/
└── GossipSimulator.ts     # Simulation harness for topology comparison
```

### Routing Strategy Selection

The `RoutedPeerManager` supports automatic strategy selection:

```typescript
enum RoutingStrategy {
  Naive = 'naive',      // Direct broadcast (< 50 peers)
  Kademlia = 'kademlia', // DHT routing (> 100 peers)
  Supernode = 'supernode', // Hierarchical (50-100 peers)
  Auto = 'auto'         // Automatic selection
}
```

## Approach 1: Kademlia DHT

### Design

Kademlia organizes peers by XOR distance in a 256-bit ID space. Each peer maintains O(log N) connections to peers at exponentially increasing distances.

```
ID Space: 256-bit (SHA-256 hash of public key)

k-buckets: 256 buckets, one per bit position
           Bucket i contains peers with distance 2^i to 2^(i+1)

Example (4-bit simplified):
Local ID: 1010
Bucket 0: distance 0001 (peers 1011)
Bucket 1: distance 001x (peers 1000, 1001)
Bucket 2: distance 01xx (peers 1110, 1100, ...)
Bucket 3: distance 1xxx (peers 0010, 0110, ...)
```

### Key Parameters

| Parameter | Value | Description |
|-----------|-------|-------------|
| k | 20 | Replication factor (peers per bucket) |
| alpha | 3 | Parallel lookup concurrency |
| ID bits | 256 | SHA-256 peer identifiers |
| Max connections | ~520 | k * log2(N) for N=10^6 peers |

### Implementation

```typescript
// network/routing/KademliaRouter.ts

class KademliaRouter extends Router {
  // XOR distance for routing decisions
  distance(a: PeerId, b: PeerId): bigint

  // Find bucket for a peer based on distance prefix
  bucketIndex(peerId: PeerId): number

  // Find k closest peers in local table
  closestPeers(target: PeerId, count: number): RoutedPeer[]

  // Iterative lookup across network
  async findNode(target: PeerId): Promise<RoutedPeer[]>

  // Epidemic broadcast with diverse peer selection
  async broadcast(message: RoutedMessage): Promise<RoutingResult>
}
```

### Broadcast Strategy

For broadcast, we use **epidemic gossip** with diverse peer selection:

1. Select k peers from different buckets (ensures coverage of ID space)
2. Each peer forwards to their diverse selections
3. TTL limits propagation depth
4. Message IDs prevent duplicate processing

```
Broadcast Complexity:
- Messages per peer: O(k) ≈ 20
- Total messages: O(k * log N) per originator
- Propagation hops: O(log N)
```

### NAT Traversal

Kademlia integration with existing WebRTC infrastructure:

1. Use WebSocket relay for signaling (already implemented)
2. Kademlia routing operates over established connections
3. FIND_NODE RPCs discover new peers
4. WebRTC upgrades for direct connections

## Approach 2: Supernode Architecture

### Design

A two-tier hierarchy where stable, well-connected nodes ("supernodes") form a mesh, and regular nodes ("leaves") connect to a few supernodes.

```
Topology:
                 ┌─────────────────────────────────┐
                 │     Supernode Mesh (Full/Gossip) │
                 └─────────────────────────────────┘
                           ▲           ▲
          ┌────────────────┴───┐   ┌───┴────────────────┐
          │   Supernode A      │───│   Supernode B      │
          │   (100 leaves)     │   │   (100 leaves)     │
          └────────────────────┘   └────────────────────┘
                    │                       │
         ┌──────────┼──────────┐ ┌──────────┼──────────┐
         ▼          ▼          ▼ ▼          ▼          ▼
       Leaf 1    Leaf 2    ... Leaf 101  Leaf 102   ...
```

### Supernode Selection Criteria

Nodes are promoted to supernode based on a composite score:

```typescript
function calculateScore(stats: NodeStats): number {
  const uptimeScore = Math.min(stats.uptime / (2 * minUptime), 1.0);
  const bandwidthScore = Math.min(stats.bandwidthOut / (2 * minBandwidth), 1.0);
  const reliabilityScore = 1.0 - Math.min(stats.failureRate, 1.0);
  const connectionScore = Math.min(stats.connectionCount / (2 * minConnections), 1.0);

  return (
    uptimeScore * 0.25 +
    bandwidthScore * 0.30 +
    reliabilityScore * 0.30 +
    connectionScore * 0.15
  );
}
```

### Key Parameters

| Parameter | Value | Description |
|-----------|-------|-------------|
| Min uptime | 1 hour | Stability requirement |
| Min bandwidth | 500 KB/s | Capacity requirement |
| Max leaves/supernode | 100 | Load balancing |
| Target supernodes | 3 | Redundancy for leaves |
| Mesh gossip fanout | 5 | Supernode-to-supernode |

### Implementation

```typescript
// network/routing/SupernodeManager.ts

class SupernodeManager extends Router {
  // Current node role
  getRole(): NodeRole  // Leaf | Candidate | Supernode

  // Score calculation for promotion
  calculateScore(stats: NodeStats): number

  // Broadcast based on role
  async broadcast(message: RoutedMessage): Promise<RoutingResult>
  // If Leaf: forward to supernodes
  // If Supernode: forward to mesh + leaves

  // Bootstrap methods
  async bootstrapAsLeaf(supernodes: SupernodePeer[]): Promise<void>
  async bootstrapAsSupernode(meshPeers: SupernodePeer[]): Promise<void>
}
```

### Broadcast Flow

**Leaf Broadcast:**
1. Leaf sends to its 3 connected supernodes
2. Each supernode forwards to mesh (5 other supernodes)
3. Each supernode forwards to all leaves

**Supernode Broadcast:**
1. Supernode forwards to mesh (5 peers)
2. Supernode forwards to all leaves
3. Other supernodes do the same

```
Broadcast Complexity:
- Leaf: sends 3 messages
- Supernode: sends sqrt(N) + 5 messages
- Total: O(sqrt(N)) per originator
- Propagation: 2-3 hops
```

## Comparison

| Metric | Naive | Kademlia | Supernode |
|--------|-------|----------|-----------|
| Connections/peer | O(N) | O(log N) | O(sqrt N) leaf, O(sqrt N) supernode |
| Messages/broadcast | O(N) | O(k * log N) | O(sqrt N) |
| Propagation hops | 1 | O(log N) | 2-3 |
| Failure resilience | High | High | Medium (supernode dependency) |
| Implementation complexity | Low | High | Medium |
| Best for | < 100 peers | > 100 peers | 50-1000 peers |

## Integration with HybridPeerManager

The `RoutedPeerManager` wraps `HybridPeerManager` to provide seamless routing:

```typescript
const manager = new RoutedPeerManager({
  url: 'wss://relay.example.com',
  routingStrategy: RoutingStrategy.Auto,
  kademliaConfig: { k: 20 },
  supernodeConfig: { maxLeavesPerSupernode: 100 },
  autoThresholds: {
    kademliaThreshold: 100,
    supernodeThreshold: 50
  }
});

manager.on('net:message', (evt) => {
  // Same API as HybridPeerManager
});

await manager.broadcast('sync', { data: '...' });
```

### Backward Compatibility

- Small networks (< 50 peers) use naive broadcast
- Existing `HybridPeerManager` API preserved
- Automatic strategy switching in `Auto` mode
- WebRTC upgrade logic unchanged

## Benchmarking

The `GossipSimulator` provides comparative benchmarks:

```typescript
const results = await runSimulationBatch([
  { peerCount: 100, topology: 'naive', ... },
  { peerCount: 100, topology: 'kademlia', ... },
  { peerCount: 100, topology: 'supernode', ... },
  { peerCount: 1000, topology: 'kademlia', ... },
  { peerCount: 1000, topology: 'supernode', ... },
  { peerCount: 10000, topology: 'kademlia', ... },
  { peerCount: 10000, topology: 'supernode', ... },
]);

console.log(formatResultsTable(results));
```

### Expected Results

| Peers | Topology | Conns (avg) | Messages/Peer | p99 Latency |
|-------|----------|-------------|---------------|-------------|
| 100 | naive | 99 | 99 | ~100ms |
| 100 | kademlia | ~60 | ~20 | ~200ms |
| 100 | supernode | ~13 | ~12 | ~150ms |
| 1000 | kademlia | ~140 | ~20 | ~400ms |
| 1000 | supernode | ~35 | ~32 | ~200ms |
| 10000 | kademlia | ~200 | ~20 | ~600ms |
| 10000 | supernode | ~104 | ~102 | ~300ms |

## Open Questions

### 1. Should HyperToken use Kademlia, Supernodes, or both?

**Recommendation**: Start with Kademlia for general use, add Supernode option for deployments with known stable infrastructure.

- Kademlia is more resilient and self-organizing
- Supernode requires trusted/stable infrastructure
- Hybrid possible: Kademlia among supernodes, leaves connect to nearest supernode

### 2. Crossover point for structured routing?

Based on simulation and browser limits:
- **< 50 peers**: Naive gossip is fine
- **50-200 peers**: Supernode if stable nodes available
- **> 200 peers**: Kademlia required (browser connection limits)

### 3. NAT traversal interaction?

- Both approaches work over existing WebSocket/WebRTC
- Kademlia FIND_NODE uses WebSocket relay for discovery
- Direct WebRTC connections established after discovery
- TURN fallback unchanged

### 4. Leverage existing WebRTC infrastructure?

Yes:
- HybridPeerManager handles connection lifecycle
- Routing layer operates on logical peer graph
- RTT measurements inform routing decisions
- WebRTC stats can feed supernode scoring

### 5. Consistency vs. speed for Scarcity?

For nullifier gossip:
- **Consistency**: Increase k and TTL, accept higher latency
- **Speed**: Lower k, faster propagation, small delivery gaps
- **Recommendation**: k=20, TTL=10 provides good balance

## Future Enhancements

1. **Geographic routing**: Use RTT and region data for locality
2. **Reputation system**: Track peer reliability for supernode selection
3. **Adaptive parameters**: Tune k, alpha based on network conditions
4. **DHT storage**: Extend Kademlia for nullifier lookup (not just routing)
5. **Hybrid topology**: Kademlia among supernodes, simple connections for leaves

## References

- Maymounkov & Mazières (2002): "Kademlia: A Peer-to-peer Information System"
- libp2p Kademlia: https://github.com/libp2p/specs/tree/master/kad-dht
- BitTorrent DHT (BEP 5): https://www.bittorrent.org/beps/bep_0005.html
- Gnutella Ultrapeer: https://rfc-gnutella.sourceforge.net/developer/testing/
