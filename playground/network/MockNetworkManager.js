/**
 * MockNetworkManager
 *
 * Simulates HyperToken's HybridPeerManager for the playground demo.
 * Provides realistic peer connection, sync, and activity simulation.
 */

// Peer names for demo
const PEER_NAMES = ['Alice', 'Bob', 'Charlie', 'Diana', 'Eve', 'Frank', 'Grace', 'Henry'];

/**
 * MockNetworkManager - Simulates network behavior for the playground
 *
 * Events emitted (matching real HybridPeerManager):
 * - 'net:connected' - WebSocket connected to relay
 * - 'net:ready' - { peerId } - Local peer ID assigned
 * - 'net:peer:connected' - { peerId, peer } - New peer joined
 * - 'net:peer:disconnected' - { peerId } - Peer left
 * - 'net:disconnected' - WebSocket disconnected
 * - 'rtc:upgraded' - { peerId, usingTurn, retryCount } - WebRTC established
 * - 'rtc:downgraded' - { peerId } - Fell back to WebSocket
 * - 'sync:start' - { peerId, ops } - Sync started
 * - 'sync:complete' - { peerId } - Sync completed
 * - 'traffic:update' - Traffic stats changed
 */
export class MockNetworkManager extends EventTarget {
  constructor() {
    super();

    this.localPeer = {
      id: 'peer-' + crypto.randomUUID().slice(0, 8),
      name: 'You',
      isLocal: true,
      status: 'connected'
    };

    this.peers = new Map();
    this.isConnected = false;
    this._usedNames = new Set(['You']);
    this._activityInterval = null;
    this._syncInterval = null;
    this._trafficHistory = [];

    // Traffic tracking
    this._bytesInPerSecond = 0;
    this._bytesOutPerSecond = 0;
    this._lastTrafficUpdate = Date.now();
  }

  /**
   * Simulate connection to relay server
   */
  connect() {
    if (this.isConnected) return;

    // Simulate connection delay
    setTimeout(() => {
      this.isConnected = true;
      this._emit('net:connected', {});

      setTimeout(() => {
        this._emit('net:ready', { peerId: this.localPeer.id });
      }, 100);
    }, 300);
  }

  /**
   * Disconnect from the network
   */
  disconnect() {
    if (!this.isConnected) return;

    this.isConnected = false;
    this._stopSimulation();

    // Disconnect all peers
    for (const peerId of this.peers.keys()) {
      this._emit('net:peer:disconnected', { peerId });
    }
    this.peers.clear();

    this._emit('net:disconnected', {});
  }

  /**
   * Add a simulated peer
   */
  addPeer(name = null, options = {}) {
    if (!this.isConnected) return null;

    // Pick a unique name
    if (!name) {
      name = PEER_NAMES.find(n => !this._usedNames.has(n)) || `Peer-${this.peers.size + 1}`;
    }
    this._usedNames.add(name);

    const peer = {
      id: 'peer-' + crypto.randomUUID().slice(0, 8),
      name,
      transport: options.transport || 'websocket',
      latency: options.latency || Math.floor(Math.random() * 40) + 15,
      pendingOps: 0,
      status: 'connecting',
      bytesIn: 0,
      bytesOut: 0,
      lastActivity: Date.now(),
      messageCount: 0
    };

    this.peers.set(peer.id, peer);

    // Simulate connection process
    setTimeout(() => {
      peer.status = 'connected';
      this._emit('net:peer:connected', { peerId: peer.id, peer: { ...peer } });

      // Auto-upgrade to WebRTC after a delay (if not already WebRTC)
      if (peer.transport === 'websocket' && Math.random() > 0.3) {
        setTimeout(() => {
          this.upgradePeer(peer.id);
        }, 1000 + Math.random() * 2000);
      }
    }, 200 + Math.random() * 300);

    return peer;
  }

  /**
   * Remove a peer
   */
  removePeer(peerId) {
    const peer = this.peers.get(peerId);
    if (!peer) return;

    this._usedNames.delete(peer.name);
    this.peers.delete(peerId);

    this._emit('net:peer:disconnected', { peerId });
  }

  /**
   * Simulate WebRTC upgrade for a peer
   */
  upgradePeer(peerId) {
    const peer = this.peers.get(peerId);
    if (!peer || peer.transport === 'webrtc') return;

    const usingTurn = Math.random() > 0.7; // 30% chance of TURN
    const retryCount = usingTurn ? Math.floor(Math.random() * 2) + 1 : 0;

    // Simulate upgrade delay
    setTimeout(() => {
      peer.transport = usingTurn ? 'turn' : 'webrtc';
      peer.latency = Math.floor(peer.latency * (usingTurn ? 0.7 : 0.4)); // WebRTC is faster

      this._emit('rtc:upgraded', {
        peerId,
        usingTurn,
        retryCount
      });
    }, 500 + Math.random() * 500);
  }

  /**
   * Simulate WebRTC downgrade (fallback to WebSocket)
   */
  downgradePeer(peerId) {
    const peer = this.peers.get(peerId);
    if (!peer || peer.transport === 'websocket') return;

    peer.transport = 'websocket';
    peer.latency = Math.floor(peer.latency * 2.5); // WebSocket is slower

    this._emit('rtc:downgraded', { peerId });
  }

  /**
   * Simulate sync activity with a peer
   */
  simulateSyncActivity(peerId, ops = 1) {
    const peer = this.peers.get(peerId);
    if (!peer || peer.status === 'disconnected') return;

    peer.status = 'syncing';
    peer.pendingOps = ops;

    this._emit('sync:start', { peerId, ops });

    // Simulate sync completing based on latency and ops
    const syncTime = peer.latency * ops + Math.random() * 200;
    setTimeout(() => {
      if (!this.peers.has(peerId)) return;

      const bytesTransferred = Math.floor(Math.random() * 400 + 100) * ops;
      peer.bytesIn += bytesTransferred;
      peer.bytesOut += Math.floor(bytesTransferred * 0.3); // ACKs are smaller
      peer.status = 'connected';
      peer.pendingOps = 0;
      peer.lastActivity = Date.now();
      peer.messageCount += ops;

      this._bytesInPerSecond += bytesTransferred;
      this._bytesOutPerSecond += Math.floor(bytesTransferred * 0.3);

      this._emit('sync:complete', { peerId });
      this._emit('traffic:update', this.getTrafficStats());
    }, syncTime);
  }

  /**
   * Ping a peer and get latency
   */
  async ping(peerId) {
    const peer = this.peers.get(peerId);
    if (!peer) return null;

    // Simulate ping with jitter
    const jitter = (Math.random() - 0.5) * 10;
    const pingTime = Math.max(1, peer.latency + jitter);

    await new Promise(r => setTimeout(r, pingTime));

    // Update peer latency with some variance
    peer.latency = Math.floor(peer.latency * 0.9 + pingTime * 0.1);

    return Math.round(pingTime);
  }

  /**
   * Get all connected peers
   */
  getPeers() {
    return Array.from(this.peers.values()).map(p => ({ ...p }));
  }

  /**
   * Get local peer info
   */
  getLocalPeer() {
    return { ...this.localPeer };
  }

  /**
   * Get traffic statistics
   */
  getTrafficStats() {
    const now = Date.now();
    const elapsed = (now - this._lastTrafficUpdate) / 1000 || 1;

    const stats = {
      bytesIn: this._bytesInPerSecond / elapsed,
      bytesOut: this._bytesOutPerSecond / elapsed,
      totalPeers: this.peers.size,
      webrtcPeers: Array.from(this.peers.values()).filter(p => p.transport !== 'websocket').length,
      wsPeers: Array.from(this.peers.values()).filter(p => p.transport === 'websocket').length
    };

    // Reset counters
    this._bytesInPerSecond = 0;
    this._bytesOutPerSecond = 0;
    this._lastTrafficUpdate = now;

    return stats;
  }

  /**
   * Get traffic history for sparkline
   */
  getTrafficHistory() {
    return [...this._trafficHistory];
  }

  /**
   * Start demo simulation with periodic events
   */
  startDemoSimulation() {
    if (this._activityInterval) return;

    // Add initial peers with staggered timing
    setTimeout(() => {
      this.addPeer('Bob', { transport: 'websocket', latency: 25 });
    }, 800);

    setTimeout(() => {
      this.addPeer('Charlie', { transport: 'websocket', latency: 45 });
    }, 2000);

    setTimeout(() => {
      this.addPeer('Diana', { transport: 'websocket', latency: 35 });
    }, 4000);

    // Periodic sync simulation
    this._syncInterval = setInterval(() => {
      const peers = this.getPeers();
      if (peers.length === 0) return;

      // Random sync activity
      for (const peer of peers) {
        if (peer.status === 'connected' && Math.random() > 0.7) {
          this.simulateSyncActivity(peer.id, Math.ceil(Math.random() * 3));
        }
      }
    }, 2000);

    // Traffic history tracking
    this._activityInterval = setInterval(() => {
      const stats = this.getTrafficStats();
      this._trafficHistory.push(stats);
      if (this._trafficHistory.length > 60) {
        this._trafficHistory.shift();
      }
      this._emit('traffic:update', stats);
    }, 500);

    // Occasional peer events
    setTimeout(() => {
      setInterval(() => {
        const peers = this.getPeers();

        // Small chance of peer disconnect/reconnect
        if (peers.length > 2 && Math.random() > 0.95) {
          const peer = peers[Math.floor(Math.random() * peers.length)];
          this.removePeer(peer.id);

          // Reconnect after a delay
          setTimeout(() => {
            this.addPeer(peer.name, {
              transport: 'websocket',
              latency: peer.latency + Math.floor(Math.random() * 20 - 10)
            });
          }, 3000 + Math.random() * 5000);
        }

        // Small chance of WebRTC downgrade
        if (Math.random() > 0.98) {
          const webrtcPeers = peers.filter(p => p.transport !== 'websocket');
          if (webrtcPeers.length > 0) {
            const peer = webrtcPeers[Math.floor(Math.random() * webrtcPeers.length)];
            this.downgradePeer(peer.id);

            // Re-upgrade after a delay
            setTimeout(() => {
              this.upgradePeer(peer.id);
            }, 2000 + Math.random() * 3000);
          }
        }
      }, 5000);
    }, 10000);
  }

  /**
   * Stop simulation
   */
  _stopSimulation() {
    if (this._activityInterval) {
      clearInterval(this._activityInterval);
      this._activityInterval = null;
    }
    if (this._syncInterval) {
      clearInterval(this._syncInterval);
      this._syncInterval = null;
    }
  }

  /**
   * Emit a custom event
   */
  _emit(type, detail) {
    this.dispatchEvent(new CustomEvent(type, { detail }));
  }

  /**
   * Cleanup
   */
  destroy() {
    this._stopSimulation();
    this.disconnect();
  }
}

export default MockNetworkManager;
