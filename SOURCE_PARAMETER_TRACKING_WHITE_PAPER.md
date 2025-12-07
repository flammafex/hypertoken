# Source Parameter Tracking: An Optimization for P2P CRDT Synchronization

## Abstract

This paper presents a method for optimizing peer-to-peer (P2P) synchronization in systems that use Conflict-Free Replicated Data Types (CRDTs). By tracking the causal source of state changes through a simple string parameter, the system can skip unnecessary synchronization attempts back to originators. While modern CRDT libraries like Automerge already prevent infinite loops through their sync state protocols, source tracking provides an O(1) early-exit optimization that reduces CPU overhead, improves code clarity, and provides defense-in-depth against echo loops.

## 1. Introduction

Bidirectional state synchronization in P2P systems faces a fundamental challenge: when peer A sends an update to peer B, and B's state change triggers its synchronization logic, B may attempt to send the same update back to A. Without proper handling, this creates unnecessary work and potential infinite loops.

Modern CRDT libraries like Automerge solve this problem at the protocol level through **sync state tracking**: each peer maintains a record of what the other peer has seen, and `generateSyncMessage()` returns `null` when there's nothing new to send. This naturally terminates any echo cascade.

However, the application layer still receives `state:changed` events for remote updates, triggering synchronization logic that iterates through peers and calls sync functions—even when those functions will ultimately do nothing. This paper describes **source parameter tracking**, an O(1) optimization that short-circuits this unnecessary work by excluding the originating peer before any sync logic executes.

## 2. Background

### 2.1 The Echo Loop Problem

In a naive P2P synchronization implementation without any protection:

1. Peer A modifies local state
2. A's change handler broadcasts the change to all peers
3. Peer B receives the change and applies it
4. B's change handler broadcasts the change to all peers
5. Peer A receives its own change back from B
6. Steps 2-5 repeat indefinitely

### 2.2 How Modern CRDTs Handle This

Libraries like Automerge prevent infinite loops through **sync state tracking**:

```typescript
const [nextSyncState, message] = generateSyncMessage(doc, syncState);
// message is null if peer already has all changes
```

Each peer maintains a `SyncState` per remote peer, tracking what that peer has seen. When generating a sync message, the library returns `null` if there's nothing new—naturally terminating any cascade.

**This means infinite loops don't occur with properly implemented CRDT sync.** However, the application layer still performs unnecessary work:
- Event listeners fire for every state change
- Code iterates through all peers
- Sync state lookups and comparisons execute
- `generateSyncMessage()` is called even when it will return `null`

### 2.3 Alternative Approaches

**Message Identifiers**: Track unique message IDs to detect duplicates. Requires growing memory and doesn't handle derived changes well.

**Vector Clocks**: Maintain logical timestamp vectors. Provides causal ordering but adds complexity without directly solving the optimization problem.

**Separate Channels**: Use different code paths for local versus remote changes. Breaks abstraction and complicates the codebase.

**Source Parameter Tracking**: Track the originating peer and skip them in O(1) time. Simple, no memory growth, and provides semantic clarity.

## 3. Method

### 3.1 Core Concept

Instead of tracking messages, we track the causal source of state changes. Each state modification carries a source identifier that propagates through the system, allowing peers to avoid sending updates back to their originators.

### 3.2 Implementation

The method requires three components:

#### 3.2.1 State Change Interface

```typescript
interface StateChange {
  change(message: string, callback: Function, source?: string): void;
  update(newState: State, source?: string): void;
}
```

The `source` parameter identifies the peer that initiated the change. By default, local changes use `source = "local"`.

#### 3.2.2 Event Emission

When state changes, the system emits an event that includes the source:

```typescript
emit("state:changed", { 
  state: newState, 
  source: source 
});
```

#### 3.2.3 Selective Propagation

The synchronization layer selectively propagates changes:

```typescript
function propagateChange(source: string) {
  for (const peer of peers) {
    if (peer.id !== source) {
      sendToPeer(peer, stateUpdate);
    }
  }
}
```

### 3.3 Handling Derived Changes

When a change triggers additional changes (e.g., through rules or reactions), the original source is preserved:

```typescript
function handleDerivedChange(originalSource: string) {
  stateManager.change("derived change", callback, originalSource);
}
```

This ensures that derived changes are also not echoed back to the originator.

## 4. Analysis

### 4.1 What Source Tracking Actually Optimizes

It's important to be precise about the benefits:

**What CRDT sync state already provides:**
- Prevention of infinite message loops (via `generateSyncMessage` returning `null`)
- Eventual consistency
- Idempotent message handling

**What source tracking adds:**
- O(1) early exit before iterating peers or calling sync functions
- Semantic clarity in code ("don't echo to sender" is explicit)
- Reduced CPU cycles (skips one `generateSyncMessage` call per update)
- Defense-in-depth if CRDT library behavior changes

### 4.2 Complexity

- **Time Complexity**: O(1) for source exclusion (simple string comparison)
- **Space Complexity**: O(1) per change (single string reference)
- **Per-Update Savings**: Skips 1 peer iteration + 1 `generateSyncMessage` call

### 4.3 Comparison with Alternative Approaches

| Approach | Prevents Loops | CPU Optimization | Memory Growth | Complexity |
|----------|---------------|------------------|---------------|------------|
| CRDT Sync State Only | ✓ | ✗ | O(n) peers | Low |
| Message IDs | ✓ | ✗ | O(m) messages | Medium |
| Vector Clocks | ✓ | ✗ | O(n) per msg | High |
| Source Tracking | ✓ (defense) | ✓ | O(1) | Low |

### 4.4 Advantages

1. **Early Exit**: Skip sync logic entirely for the originating peer
2. **Semantic Clarity**: Code explicitly documents "don't echo to sender"
3. **No Memory Growth**: Single string vs. growing message ID sets
4. **Preserves Causality**: Original source maintained through derived changes
5. **Debugging Friendly**: Source information aids in tracing causality
6. **Defense in Depth**: Works even if CRDT sync state fails or is misconfigured

### 4.5 Limitations

1. **Marginal Gains**: With efficient CRDT sync, the optimization is small (saves one `generateSyncMessage` call per peer per update)
2. **Trust Requirement**: Assumes peers honestly report sources
3. **Peer Identification**: Requires consistent peer naming
4. **Not Necessary for Correctness**: CRDT sync state already prevents infinite loops

## 5. Integration with CRDTs

Source tracking complements (not replaces) CRDT sync protocols:

```typescript
class CRDTWrapper {
  private doc: CRDT.Doc;

  change(message: string, callback: Function, source = "local") {
    this.doc = CRDT.change(this.doc, message, callback);
    this.emit("changed", { doc: this.doc, source });
  }

  applyRemoteChange(change: CRDT.Change, sourcePeer: string) {
    this.doc = CRDT.applyChange(this.doc, change);
    // Source tracking: mark where this change came from
    this.emit("changed", { doc: this.doc, source: sourcePeer });
  }
}

class SyncManager {
  handleStateChange(event: StateEvent) {
    const source = event.source || "local";

    for (const [peerId, peer] of this.peers) {
      // Source tracking optimization: skip the originator
      if (peerId === source) continue;

      // CRDT sync state: will return null if peer already has this data
      const [nextState, message] = generateSyncMessage(doc, syncStates.get(peerId));
      if (message) peer.send(message);
    }
  }
}
```

**Division of responsibility:**
- **CRDT sync state**: Ensures correctness (no duplicate data sent)
- **Source tracking**: Optimizes performance (skip originator entirely)

## 6. Practical Considerations

### 6.1 Peer Naming

Peers must have unique, stable identifiers. Common schemes include:
- UUID generation on connection
- Public key fingerprints
- User-assigned names with collision detection

### 6.2 Network Partitions

During network partitions, peers may accumulate changes. When the partition heals, source tracking ensures changes flow correctly without loops, even for changes that occurred during the partition.

### 6.3 Dynamic Peer Groups

As peers join and leave, source tracking continues to work without modification. New peers receive the full state with appropriate source attribution.

## 7. Example Trace

Consider three peers (A, B, C) where A makes a change:

```
Time  Event                           A's State  B's State  C's State
T0    Initial                        S0         S0         S0
T1    A modifies (source="local")    S1         S0         S0
T2    A sends to B,C                 S1         S0         S0
T3    B receives (source="A")        S1         S1         S0
T4    B sends to C (excludes A)      S1         S1         S0
T5    C receives from A              S1         S1         S1
T6    C receives from B (duplicate   S1         S1         S1
      but CRDT handles idempotently)
```

Note that A never receives its own change back, preventing the echo loop.

## 8. Conclusion

Source parameter tracking is a lightweight optimization for P2P CRDT synchronization. While modern CRDT libraries like Automerge already prevent infinite loops through their sync state protocols, source tracking provides additional value:

1. **O(1) Early Exit**: Skips unnecessary sync attempts before they start
2. **Code Clarity**: Makes the "don't echo to sender" intent explicit
3. **Defense in Depth**: Provides a safety net independent of CRDT implementation details

The method's simplicity—a single string parameter—makes it trivial to implement and maintain. However, developers should understand that it is an **optimization**, not a correctness requirement. Systems using properly implemented CRDT sync will function correctly without source tracking; they will simply perform slightly more work per update.

For applications where every CPU cycle matters, or where code clarity and debugging are priorities, source tracking is recommended. For simpler applications, relying on CRDT sync state alone is sufficient.

## 9. Future Work

Potential extensions include:

1. **Multi-source Attribution**: Supporting changes that originate from multiple peers simultaneously
2. **Source Verification**: Cryptographic signing to prevent source spoofing in adversarial environments
3. **Causal Chain Tracking**: Extended source format to track full causal history (e.g., "A→B→C")
4. **Optimization Strategies**: Batching updates from the same source to reduce message overhead

## References

[1] Shapiro, M., Preguiça, N., Baquero, C., & Zawirski, M. (2011). Conflict-free replicated data types. In Stabilization, Safety, and Security of Distributed Systems (pp. 386-400).

[2] Kleppmann, M., & Beresford, A. R. (2017). A conflict-free replicated JSON datatype. IEEE Transactions on Parallel and Distributed Systems, 28(10), 2733-2746.

[3] Lamport, L. (1978). Time, clocks, and the ordering of events in a distributed system. Communications of the ACM, 21(7), 558-565.

[4] Van Renesse, R., & Schneider, F. B. (2004). Chain replication for supporting high throughput and availability. In OSDI (Vol. 4, pp. 91-104).

---

## Appendix A: Reference Implementation

A minimal reference implementation in TypeScript:

```typescript
interface StateManager {
  state: any;
  listeners: Set<(event: StateEvent) => void>;
  
  change(message: string, updater: (state: any) => void, source?: string): void;
  on(event: string, handler: (event: StateEvent) => void): void;
}

interface SyncManager {
  stateManager: StateManager;
  peers: Map<string, PeerConnection>;
  syncStates: Map<string, SyncState>;
  
  handleStateChange(event: StateEvent): void;
  handleRemoteSync(message: SyncMessage, fromPeer: string): void;
}

class P2PSyncManager implements SyncManager {
  handleStateChange(event: StateEvent) {
    const source = event.source || "local";
    
    for (const [peerId, peer] of this.peers) {
      if (peerId !== source) {
        const syncMessage = this.generateSyncMessage(peerId);
        peer.send(syncMessage);
      }
    }
  }
  
  handleRemoteSync(message: SyncMessage, fromPeer: string) {
    const newState = this.applySyncMessage(message);
    this.stateManager.change("remote sync", () => newState, fromPeer);
  }
}
```
