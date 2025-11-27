/*
 * test/testWebRTC.ts
 * Basic tests for WebRTC implementation
 */
import { WebRTCConnection, DEFAULT_RTC_CONFIG } from '../network/WebRTCConnection.js';
import { SignalingService } from '../network/SignalingService.js';
import { HybridPeerManager } from '../network/HybridPeerManager.js';
import { PeerConnection } from '../network/PeerConnection.js';

console.log('🧪 Testing WebRTC Implementation\n');

let passed = 0;
let failed = 0;

function test(name: string, fn: () => boolean | Promise<boolean>) {
  return async () => {
    try {
      const result = await fn();
      if (result) {
        console.log(`✅ ${name}`);
        passed++;
      } else {
        console.log(`❌ ${name}`);
        failed++;
      }
    } catch (err: any) {
      console.log(`❌ ${name}: ${err.message}`);
      failed++;
    }
  };
}

// Test 1: WebRTCConnection can be instantiated
await test('WebRTCConnection instantiation', () => {
  const conn = new WebRTCConnection('test-peer', DEFAULT_RTC_CONFIG);
  return conn !== null && conn.getRemotePeerId() === 'test-peer';
})();

// Test 2: WebRTCConnection initial state
await test('WebRTCConnection initial state', () => {
  const conn = new WebRTCConnection('test-peer', DEFAULT_RTC_CONFIG);
  return !conn.isConnected() && conn.getConnectionState() === 'new';
})();

// Test 3: SignalingService can be instantiated
await test('SignalingService instantiation', () => {
  const wsConn = new PeerConnection('ws://localhost:8080');
  const signaling = new SignalingService(wsConn);
  return signaling !== null && signaling.getWebSocketConnection() === wsConn;
})();

// Test 4: HybridPeerManager can be instantiated
await test('HybridPeerManager instantiation', () => {
  const manager = new HybridPeerManager({
    url: 'ws://localhost:8080',
    autoUpgrade: true
  });
  return manager !== null && manager.getPeerId() === null; // Not connected yet
})();

// Test 5: HybridPeerManager has correct initial state
await test('HybridPeerManager initial state', () => {
  const manager = new HybridPeerManager({
    url: 'ws://localhost:8080',
    autoUpgrade: false
  });
  return manager.getPeers().size === 0;
})();

// Test 6: WebRTCConnection event emitter works
await test('WebRTCConnection event emitter', () => {
  const conn = new WebRTCConnection('test-peer', DEFAULT_RTC_CONFIG);
  let eventFired = false;

  conn.on('rtc:error', () => {
    eventFired = true;
  });

  conn.emit('rtc:error', { error: 'test' });
  return eventFired;
})();

// Test 7: HybridPeerManager provides WebSocket connection
await test('HybridPeerManager WebSocket access', () => {
  const manager = new HybridPeerManager({
    url: 'ws://localhost:8080'
  });
  const wsConn = manager.getWebSocketConnection();
  return wsConn instanceof PeerConnection;
})();

// Test 8: DEFAULT_RTC_CONFIG has STUN servers
await test('DEFAULT_RTC_CONFIG has STUN servers', () => {
  return DEFAULT_RTC_CONFIG.iceServers.length > 0 &&
         DEFAULT_RTC_CONFIG.iceServers[0].urls === 'stun:stun.l.google.com:19302';
})();

console.log(`\n📊 Test Results: ${passed} passed, ${failed} failed`);

if (failed > 0) {
  process.exit(1);
} else {
  console.log('✅ All tests passed!');
  process.exit(0);
}
