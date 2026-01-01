/**
 * Peer Monitor Component
 *
 * A panel showing connected peers, transport types, latencies,
 * sync status, and network activity visualization.
 * Built with Preact + HTM for a build-free reactive UI.
 */

import { h, render } from 'https://esm.sh/preact@10.19.3';
import { useState, useEffect, useRef, useCallback, useMemo } from 'https://esm.sh/preact@10.19.3/hooks';
import htm from 'https://esm.sh/htm@3.1.1';

const html = htm.bind(h);

// === Utility Functions ===

/**
 * Format bytes for display
 */
function formatBytes(bytes) {
  if (!bytes || bytes < 0) return '0 B';
  if (bytes < 1024) return Math.round(bytes) + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
}

/**
 * Format time since last activity
 */
function formatLastActive(timestamp) {
  if (!timestamp) return '';
  const seconds = Math.floor((Date.now() - timestamp) / 1000);
  if (seconds < 5) return 'just now';
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.floor(seconds / 60);
  return `${minutes}m ago`;
}

// === Components ===

/**
 * StatusDot - Connection status indicator
 */
function StatusDot({ status }) {
  const colors = {
    connected: '#4ade80',
    syncing: '#fbbf24',
    connecting: '#94a3b8',
    disconnected: '#ef4444'
  };

  const color = colors[status] || colors.connecting;
  const isPulsing = status === 'syncing' || status === 'connecting';

  return html`
    <span
      class="status-dot ${isPulsing ? 'pulsing' : ''}"
      style="background-color: ${color}"
      title=${status}
    />
  `;
}

/**
 * TransportIcon - Icon showing connection type
 */
function TransportIcon({ transport }) {
  const icons = {
    webrtc: { icon: '\uD83D\uDE80', label: 'WebRTC (P2P)' },
    turn: { icon: '\u26A1', label: 'WebRTC (TURN relay)' },
    websocket: { icon: '\uD83D\uDCE1', label: 'WebSocket (relay)' }
  };

  const { icon, label } = icons[transport] || icons.websocket;

  return html`
    <span class="transport-icon" title=${label}>${icon}</span>
  `;
}

/**
 * PeerCard - Individual peer info card
 */
function PeerCard({ peer, isLocal, onPing }) {
  const [isPinging, setIsPinging] = useState(false);
  const [pingResult, setPingResult] = useState(null);

  const handlePing = useCallback(async () => {
    if (isPinging || isLocal) return;
    setIsPinging(true);
    setPingResult(null);

    try {
      const latency = await onPing(peer.id);
      setPingResult(latency);
    } catch (e) {
      setPingResult('error');
    }

    setIsPinging(false);
    setTimeout(() => setPingResult(null), 2000);
  }, [peer.id, isPinging, isLocal, onPing]);

  const syncStatus = useMemo(() => {
    if (isLocal) return null;
    if (peer.status === 'syncing') {
      return html`<span class="sync-status syncing">Syncing (${peer.pendingOps} ops)</span>`;
    }
    return html`<span class="sync-status synced">Synced \u2713</span>`;
  }, [peer.status, peer.pendingOps, isLocal]);

  return html`
    <div class="peer-card ${peer.status}">
      <div class="peer-header">
        <${StatusDot} status=${peer.status} />
        <span class="peer-name">${peer.name}${isLocal ? ' (you)' : ''}</span>
        ${!isLocal && html`<${TransportIcon} transport=${peer.transport} />`}
      </div>

      <div class="peer-id">${peer.id}</div>

      <div class="peer-stats">
        ${isLocal ? html`
          <span class="role">Host</span>
        ` : html`
          <span class="latency" title="Latency">
            ${pingResult !== null
              ? (pingResult === 'error' ? 'err' : `${pingResult}ms`)
              : `${peer.latency}ms`}
          </span>
          ${syncStatus}
        `}
      </div>

      ${!isLocal && html`
        <div class="peer-footer">
          <span class="peer-activity" title="Last activity">
            ${formatLastActive(peer.lastActivity)}
          </span>
          <button
            class="ping-btn ${isPinging ? 'pinging' : ''}"
            onClick=${handlePing}
            disabled=${isPinging}
          >
            ${isPinging ? '\u2022\u2022\u2022' : 'Ping'}
          </button>
        </div>
      `}
    </div>
  `;
}

/**
 * ActivityGraph - Network traffic sparkline
 */
function ActivityGraph({ history }) {
  const canvasRef = useRef();

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    const width = canvas.width;
    const height = canvas.height;

    // Clear
    ctx.clearRect(0, 0, width, height);

    if (!history || history.length === 0) {
      // Draw empty state
      ctx.fillStyle = 'rgba(255, 255, 255, 0.05)';
      ctx.fillRect(0, 0, width, height);
      return;
    }

    // Find max value for scaling
    const maxBytes = Math.max(
      ...history.map(h => Math.max(h.bytesIn || 0, h.bytesOut || 0)),
      100 // Minimum scale
    );

    const barWidth = Math.max(2, (width - history.length) / history.length);
    const gap = 1;

    // Draw bars
    history.forEach((stats, i) => {
      const x = i * (barWidth + gap);

      // Incoming (green)
      const inHeight = ((stats.bytesIn || 0) / maxBytes) * (height - 4);
      ctx.fillStyle = 'rgba(74, 222, 128, 0.6)';
      ctx.fillRect(x, height - inHeight - 2, barWidth / 2 - 0.5, inHeight);

      // Outgoing (blue)
      const outHeight = ((stats.bytesOut || 0) / maxBytes) * (height - 4);
      ctx.fillStyle = 'rgba(96, 165, 250, 0.6)';
      ctx.fillRect(x + barWidth / 2 + 0.5, height - outHeight - 2, barWidth / 2 - 0.5, outHeight);
    });
  }, [history]);

  // Calculate current rates
  const currentStats = history && history.length > 0 ? history[history.length - 1] : null;

  return html`
    <div class="activity-graph-container">
      <canvas
        ref=${canvasRef}
        class="activity-canvas"
        width="200"
        height="32"
      />
      <div class="traffic-stats">
        <span class="stat incoming" title="Incoming">
          \u2193 ${formatBytes(currentStats?.bytesIn || 0)}/s
        </span>
        <span class="stat outgoing" title="Outgoing">
          \u2191 ${formatBytes(currentStats?.bytesOut || 0)}/s
        </span>
      </div>
    </div>
  `;
}

/**
 * PeerMonitor - Main component
 */
function PeerMonitor({ networkManager }) {
  const [isConnected, setIsConnected] = useState(false);
  const [localPeer, setLocalPeer] = useState(null);
  const [peers, setPeers] = useState([]);
  const [trafficHistory, setTrafficHistory] = useState([]);
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [width, setWidth] = useState(280);

  // Export network stats as JSON
  const handleExport = useCallback(() => {
    const exportData = {
      exportedAt: new Date().toISOString(),
      isConnected,
      localPeer: localPeer ? {
        id: localPeer.id,
        name: localPeer.name,
        status: localPeer.status
      } : null,
      peerCount: peers.length,
      peers: peers.map(p => ({
        id: p.id,
        name: p.name,
        status: p.status,
        transport: p.transport,
        latency: p.latency,
        lastActivity: p.lastActivity,
        pendingOps: p.pendingOps
      })),
      transportSummary: {
        webrtc: peers.filter(p => p.transport === 'webrtc').length,
        turn: peers.filter(p => p.transport === 'turn').length,
        websocket: peers.filter(p => p.transport === 'websocket').length
      },
      trafficHistory: trafficHistory.map(t => ({
        bytesIn: t.bytesIn,
        bytesOut: t.bytesOut,
        timestamp: t.timestamp
      }))
    };
    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `network-stats-${Date.now()}.json`;
    link.click();
    URL.revokeObjectURL(url);
  }, [isConnected, localPeer, peers, trafficHistory]);

  // Subscribe to network events
  useEffect(() => {
    if (!networkManager) return;

    const updatePeers = () => setPeers(networkManager.getPeers());

    const handlers = {
      'net:connected': () => setIsConnected(true),
      'net:disconnected': () => {
        setIsConnected(false);
        setPeers([]);
      },
      'net:ready': () => {
        setLocalPeer(networkManager.getLocalPeer());
      },
      'net:peer:connected': updatePeers,
      'net:peer:disconnected': updatePeers,
      'rtc:upgraded': updatePeers,
      'rtc:downgraded': updatePeers,
      'sync:start': updatePeers,
      'sync:complete': updatePeers,
      'traffic:update': () => {
        setTrafficHistory(networkManager.getTrafficHistory());
      }
    };

    for (const [event, handler] of Object.entries(handlers)) {
      networkManager.addEventListener(event, handler);
    }

    // Initial state
    setIsConnected(networkManager.isConnected);
    setLocalPeer(networkManager.getLocalPeer());
    setPeers(networkManager.getPeers());
    setTrafficHistory(networkManager.getTrafficHistory());

    return () => {
      for (const [event, handler] of Object.entries(handlers)) {
        networkManager.removeEventListener(event, handler);
      }
    };
  }, [networkManager]);

  const handlePing = useCallback(async (peerId) => {
    if (!networkManager) return null;
    return networkManager.ping(peerId);
  }, [networkManager]);

  // Transport summary
  const transportSummary = useMemo(() => {
    const webrtc = peers.filter(p => p.transport === 'webrtc').length;
    const turn = peers.filter(p => p.transport === 'turn').length;
    const ws = peers.filter(p => p.transport === 'websocket').length;
    return { webrtc, turn, ws };
  }, [peers]);

  if (isCollapsed) {
    return html`
      <div class="peer-monitor collapsed" onClick=${() => setIsCollapsed(false)}>
        <div class="collapsed-label">
          <span class="collapse-icon">\u25C0</span>
          <span>Peers</span>
          ${isConnected && html`
            <span class="peer-count-badge">${peers.length}</span>
          `}
        </div>
      </div>
    `;
  }

  return html`
    <div class="peer-monitor" style="width: ${width}px">
      <${ResizeHandle} onResize=${setWidth} />

      <div class="monitor-header">
        <div class="monitor-title">
          <span>Peer Monitor</span>
        </div>
        <div class="monitor-controls">
          <button
            class="export-btn"
            onClick=${handleExport}
            title="Export network stats as JSON"
          >
            Export
          </button>
          <button
            class="collapse-btn"
            onClick=${() => setIsCollapsed(true)}
            title="Collapse panel"
          >
            \u25B6
          </button>
        </div>
      </div>

      <div class="monitor-body">
        <!-- Connection Summary -->
        <div class="connection-summary">
          <div class="status-line">
            <${StatusDot} status=${isConnected ? 'connected' : 'disconnected'} />
            <span>
              ${isConnected
                ? `Connected (${peers.length} peer${peers.length !== 1 ? 's' : ''})`
                : 'Disconnected'}
            </span>
          </div>
          ${peers.length > 0 && html`
            <div class="transport-summary">
              ${transportSummary.webrtc > 0 && html`
                <span class="transport-stat">\uD83D\uDE80 ${transportSummary.webrtc}</span>
              `}
              ${transportSummary.turn > 0 && html`
                <span class="transport-stat">\u26A1 ${transportSummary.turn}</span>
              `}
              ${transportSummary.ws > 0 && html`
                <span class="transport-stat">\uD83D\uDCE1 ${transportSummary.ws}</span>
              `}
            </div>
          `}
        </div>

        <!-- Peers List -->
        <div class="peers-list">
          ${localPeer && html`
            <${PeerCard}
              peer=${localPeer}
              isLocal=${true}
            />
          `}
          ${peers.map(peer => html`
            <${PeerCard}
              key=${peer.id}
              peer=${peer}
              isLocal=${false}
              onPing=${handlePing}
            />
          `)}
          ${peers.length === 0 && isConnected && html`
            <div class="no-peers">
              <p>Waiting for peers...</p>
              <p class="hint">Other players will appear here</p>
            </div>
          `}
        </div>

        <!-- Network Activity -->
        <div class="activity-section">
          <div class="section-title">Network Activity</div>
          <${ActivityGraph} history=${trafficHistory} />
        </div>
      </div>
    </div>
  `;
}

/**
 * ResizeHandle - Draggable handle for resizing panel width
 */
function ResizeHandle({ onResize }) {
  const [isDragging, setIsDragging] = useState(false);
  const startXRef = useRef(0);
  const startWidthRef = useRef(0);

  useEffect(() => {
    if (!isDragging) return;

    const handleMouseMove = (e) => {
      const delta = startXRef.current - e.clientX;
      const newWidth = Math.max(200, Math.min(400, startWidthRef.current + delta));
      onResize(newWidth);
    };

    const handleMouseUp = () => {
      setIsDragging(false);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging, onResize]);

  const handleMouseDown = (e) => {
    e.preventDefault();
    setIsDragging(true);
    startXRef.current = e.clientX;
    const monitor = e.target.closest('.peer-monitor');
    startWidthRef.current = monitor ? monitor.offsetWidth : 280;
  };

  return html`
    <div
      class="peer-resize-handle ${isDragging ? 'active' : ''}"
      onMouseDown=${handleMouseDown}
    />
  `;
}

// === Styles ===

const styles = `
.peer-monitor {
  background: #0a0a0f;
  border-left: 1px solid #1e293b;
  display: flex;
  flex-direction: column;
  font-family: 'SF Mono', 'Fira Code', 'Monaco', 'Menlo', monospace;
  font-size: 12px;
  height: 100%;
  position: relative;
  min-width: 200px;
  max-width: 400px;
}

.peer-monitor.collapsed {
  width: 32px !important;
  min-width: 32px;
  cursor: pointer;
  transition: background 0.2s;
}

.peer-monitor.collapsed:hover {
  background: #111118;
}

.collapsed-label {
  writing-mode: vertical-rl;
  text-orientation: mixed;
  padding: 12px 8px;
  color: #64748b;
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 11px;
  text-transform: uppercase;
  letter-spacing: 0.1em;
}

.collapse-icon {
  font-size: 10px;
}

.peer-count-badge {
  background: #4ade80;
  color: #0a0a0f;
  border-radius: 10px;
  padding: 2px 6px;
  font-size: 10px;
  font-weight: 600;
}

.peer-resize-handle {
  position: absolute;
  left: -3px;
  top: 0;
  bottom: 0;
  width: 6px;
  cursor: ew-resize;
  background: transparent;
  z-index: 10;
}

.peer-resize-handle:hover,
.peer-resize-handle.active {
  background: #4ade80;
}

.monitor-header {
  padding: 12px;
  border-bottom: 1px solid #1e293b;
  display: flex;
  justify-content: space-between;
  align-items: center;
  background: #0d0d14;
  flex-shrink: 0;
}

.monitor-title {
  font-weight: 600;
  color: #e2e8f0;
  font-size: 11px;
  text-transform: uppercase;
  letter-spacing: 0.1em;
}

.monitor-controls {
  display: flex;
  align-items: center;
  gap: 8px;
}

.export-btn {
  background: rgba(74, 222, 128, 0.1);
  border: 1px solid rgba(74, 222, 128, 0.3);
  color: #4ade80;
  padding: 4px 8px;
  border-radius: 4px;
  font-size: 10px;
  cursor: pointer;
  font-family: inherit;
  transition: all 0.2s;
}

.export-btn:hover {
  background: rgba(74, 222, 128, 0.2);
  border-color: rgba(74, 222, 128, 0.5);
}

.collapse-btn {
  background: none;
  border: none;
  color: #64748b;
  cursor: pointer;
  padding: 4px;
  font-size: 10px;
}

.collapse-btn:hover {
  color: #e2e8f0;
}

.monitor-body {
  flex: 1;
  overflow-y: auto;
  padding: 12px;
}

.connection-summary {
  padding: 10px;
  background: rgba(255, 255, 255, 0.03);
  border-radius: 6px;
  margin-bottom: 12px;
}

.status-line {
  display: flex;
  align-items: center;
  gap: 8px;
  color: #e2e8f0;
}

.transport-summary {
  margin-top: 6px;
  display: flex;
  gap: 12px;
  color: #64748b;
  font-size: 11px;
}

.transport-stat {
  display: flex;
  align-items: center;
  gap: 4px;
}

.status-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  flex-shrink: 0;
  display: inline-block;
}

.status-dot.pulsing {
  animation: pulse 1.5s ease-in-out infinite;
}

@keyframes pulse {
  0%, 100% { opacity: 1; transform: scale(1); }
  50% { opacity: 0.5; transform: scale(0.85); }
}

.peers-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.no-peers {
  text-align: center;
  padding: 20px;
  color: #64748b;
}

.no-peers .hint {
  font-size: 11px;
  color: #475569;
  margin-top: 4px;
}

.peer-card {
  background: #1e293b;
  border-radius: 8px;
  padding: 10px;
  transition: all 0.15s;
  border-left: 3px solid transparent;
}

.peer-card:hover {
  background: #334155;
}

.peer-card.syncing {
  border-left-color: #fbbf24;
}

.peer-card.connected {
  border-left-color: #4ade80;
}

.peer-card.connecting {
  border-left-color: #94a3b8;
}

.peer-header {
  display: flex;
  align-items: center;
  gap: 8px;
}

.peer-name {
  font-weight: 600;
  color: #e2e8f0;
  flex: 1;
}

.transport-icon {
  font-size: 14px;
}

.peer-id {
  color: #64748b;
  font-size: 10px;
  margin-top: 2px;
  font-family: monospace;
}

.peer-stats {
  display: flex;
  gap: 12px;
  margin-top: 6px;
  font-size: 11px;
}

.latency {
  color: #60a5fa;
}

.role {
  color: #c084fc;
  font-weight: 500;
}

.sync-status {
  color: #4ade80;
}

.sync-status.syncing {
  color: #fbbf24;
}

.peer-footer {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-top: 8px;
  padding-top: 8px;
  border-top: 1px solid rgba(255, 255, 255, 0.05);
}

.peer-activity {
  color: #475569;
  font-size: 10px;
}

.ping-btn {
  padding: 3px 10px;
  background: rgba(255, 255, 255, 0.1);
  border: none;
  border-radius: 4px;
  color: #e2e8f0;
  font-size: 10px;
  cursor: pointer;
  font-family: inherit;
  transition: all 0.15s;
}

.ping-btn:hover:not(:disabled) {
  background: rgba(255, 255, 255, 0.2);
}

.ping-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.ping-btn.pinging {
  color: #fbbf24;
}

.activity-section {
  margin-top: 16px;
  padding-top: 16px;
  border-top: 1px solid #1e293b;
}

.section-title {
  color: #94a3b8;
  font-size: 10px;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  margin-bottom: 8px;
}

.activity-graph-container {
  background: rgba(255, 255, 255, 0.02);
  border-radius: 4px;
  padding: 8px;
}

.activity-canvas {
  width: 100%;
  height: 32px;
  display: block;
}

.traffic-stats {
  display: flex;
  justify-content: space-between;
  margin-top: 6px;
  font-size: 10px;
}

.traffic-stats .stat {
  display: flex;
  align-items: center;
  gap: 4px;
}

.traffic-stats .incoming {
  color: #4ade80;
}

.traffic-stats .outgoing {
  color: #60a5fa;
}

/* Scrollbar */
.monitor-body::-webkit-scrollbar {
  width: 6px;
}

.monitor-body::-webkit-scrollbar-track {
  background: transparent;
}

.monitor-body::-webkit-scrollbar-thumb {
  background: rgba(255, 255, 255, 0.1);
  border-radius: 3px;
}

.monitor-body::-webkit-scrollbar-thumb:hover {
  background: rgba(255, 255, 255, 0.2);
}

/* Responsive */
@media (max-width: 768px) {
  .peer-monitor {
    border-left: none;
    border-top: 1px solid #1e293b;
    width: 100% !important;
    max-width: none;
    height: auto;
    max-height: 300px;
  }

  .peer-resize-handle {
    display: none;
  }
}
`;

// === Export ===

/**
 * Initialize the Peer Monitor panel
 * @param {HTMLElement} container - Container element to render into
 * @param {MockNetworkManager} networkManager - Network manager instance
 */
export function initPeerMonitor(container, networkManager) {
  // Inject styles
  if (!document.getElementById('peer-monitor-styles')) {
    const styleEl = document.createElement('style');
    styleEl.id = 'peer-monitor-styles';
    styleEl.textContent = styles;
    document.head.appendChild(styleEl);
  }

  // Render component
  render(html`<${PeerMonitor} networkManager=${networkManager} />`, container);
}

export { PeerMonitor };
