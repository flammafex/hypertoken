#!/usr/bin/env node
/*
 * WebRTC Test Client
 * Demonstrates hybrid WebSocket + WebRTC connection
 */
import { HybridPeerManager } from 'hypertoken/network/HybridPeerManager.js';
import * as readline from 'readline';

const SERVER_URL = process.env.SERVER_URL || 'ws://localhost:8080';
const clientName = process.argv[2] || 'Anonymous';

console.log(`🌐 ${clientName} is connecting to ${SERVER_URL}...\n`);

// Create hybrid peer manager
const manager = new HybridPeerManager({
  url: SERVER_URL,
  autoUpgrade: true,  // Automatically upgrade to WebRTC
  upgradeDelay: 1000  // Wait 1 second before upgrading
});

// Track connection states
let myPeerId = null;
const peers = new Map(); // peerId -> { name, isWebRTC }

// Setup event handlers
manager.on('net:connected', () => {
  console.log('✅ Connected to server via WebSocket');
});

manager.on('net:ready', (evt) => {
  myPeerId = evt.payload.peerId;
  console.log(`👤 Your peer ID: ${myPeerId}`);
  console.log(`📝 Your name: ${clientName}\n`);
  showHelp();
});

manager.on('net:peer:connected', (evt) => {
  const peerId = evt.payload.peerId;
  console.log(`\n👋 New peer connected: ${peerId}`);
  peers.set(peerId, { name: '?', isWebRTC: false });

  // Send our name to the new peer
  manager.sendToPeer(peerId, {
    type: 'introduce',
    name: clientName
  });
});

manager.on('net:peer:disconnected', (evt) => {
  const peerId = evt.payload.peerId;
  const peer = peers.get(peerId);
  console.log(`\n👋 Peer disconnected: ${peerId} (${peer?.name || 'unknown'})`);
  peers.delete(peerId);
});

manager.on('rtc:upgraded', (evt) => {
  const peerId = evt.payload.peerId;
  const peer = peers.get(peerId);
  if (peer) peer.isWebRTC = true;

  console.log(`\n🚀 WebRTC connection established with ${peerId} (${peer?.name || 'unknown'})`);
  console.log('   Now using direct P2P DataChannel for low-latency communication!');
});

manager.on('rtc:downgraded', (evt) => {
  const peerId = evt.payload.peerId;
  const peer = peers.get(peerId);
  if (peer) peer.isWebRTC = false;

  console.log(`\n⚠️  WebRTC connection lost with ${peerId}, using WebSocket fallback`);
});

manager.on('net:message', (evt) => {
  const msg = evt.payload;
  const fromPeerId = msg.fromPeerId;

  if (msg.type === 'introduce') {
    const peer = peers.get(fromPeerId);
    if (peer) {
      peer.name = msg.name;
      console.log(`\n📛 ${fromPeerId} is now known as "${msg.name}"`);
    }

    // Reply with our name
    manager.sendToPeer(fromPeerId, {
      type: 'introduce',
      name: clientName
    });
  } else if (msg.type === 'chat') {
    const peer = peers.get(fromPeerId) || { name: 'unknown' };
    const transport = manager.isWebRTCConnected(fromPeerId) ? '🚀 WebRTC' : '📡 WebSocket';
    console.log(`\n[${transport}] ${peer.name}: ${msg.text}`);
  } else if (msg.type === 'ping') {
    const peer = peers.get(fromPeerId) || { name: 'unknown' };
    const transport = manager.isWebRTCConnected(fromPeerId) ? '🚀 WebRTC' : '📡 WebSocket';
    console.log(`\n[${transport}] 🏓 Ping from ${peer.name}`);

    // Send pong back
    manager.sendToPeer(fromPeerId, {
      type: 'pong',
      timestamp: msg.timestamp
    });
  } else if (msg.type === 'pong') {
    const latency = Date.now() - msg.timestamp;
    const peer = peers.get(fromPeerId) || { name: 'unknown' };
    const transport = manager.isWebRTCConnected(fromPeerId) ? '🚀 WebRTC' : '📡 WebSocket';
    console.log(`\n[${transport}] 🏓 Pong from ${peer.name} - Latency: ${latency}ms`);
  }

  // Show prompt again
  rl.prompt();
});

manager.on('net:error', (evt) => {
  console.error('\n❌ Network error:', evt.payload.error);
});

// Connect to server
manager.connect();

// Setup readline for interactive commands
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
  prompt: '> '
});

function showHelp() {
  console.log('Available commands:');
  console.log('  /peers          - List connected peers');
  console.log('  /ping <peerId>  - Send ping to a peer');
  console.log('  /msg <peerId> <text> - Send message to a peer');
  console.log('  /broadcast <text>    - Send message to all peers');
  console.log('  /help           - Show this help');
  console.log('  /quit           - Disconnect and exit\n');
  rl.prompt();
}

rl.on('line', (line) => {
  const trimmed = line.trim();

  if (!trimmed) {
    rl.prompt();
    return;
  }

  if (trimmed.startsWith('/')) {
    const parts = trimmed.split(' ');
    const cmd = parts[0];

    switch (cmd) {
      case '/help':
        showHelp();
        break;

      case '/peers':
        console.log(`\n👥 Connected peers (${peers.size}):`);
        for (const [peerId, peer] of peers) {
          const transport = manager.isWebRTCConnected(peerId) ? '🚀 WebRTC' : '📡 WebSocket';
          console.log(`   ${peerId} - "${peer.name}" [${transport}]`);
        }
        console.log();
        break;

      case '/ping':
        if (parts.length < 2) {
          console.log('Usage: /ping <peerId>');
        } else {
          const targetId = parts[1];
          if (peers.has(targetId)) {
            manager.sendToPeer(targetId, {
              type: 'ping',
              timestamp: Date.now()
            });
            console.log(`🏓 Sent ping to ${targetId}`);
          } else {
            console.log(`❌ Peer ${targetId} not found`);
          }
        }
        break;

      case '/msg':
        if (parts.length < 3) {
          console.log('Usage: /msg <peerId> <text>');
        } else {
          const targetId = parts[1];
          const text = parts.slice(2).join(' ');
          if (peers.has(targetId)) {
            manager.sendToPeer(targetId, {
              type: 'chat',
              text
            });
            const transport = manager.isWebRTCConnected(targetId) ? '🚀 WebRTC' : '📡 WebSocket';
            console.log(`[${transport}] You -> ${peers.get(targetId).name}: ${text}`);
          } else {
            console.log(`❌ Peer ${targetId} not found`);
          }
        }
        break;

      case '/broadcast':
        if (parts.length < 2) {
          console.log('Usage: /broadcast <text>');
        } else {
          const text = parts.slice(1).join(' ');
          manager.broadcast('chat', { text });
          console.log(`📢 Broadcast: ${text}`);
        }
        break;

      case '/quit':
        console.log('\n👋 Disconnecting...');
        manager.disconnect();
        process.exit(0);
        break;

      default:
        console.log(`Unknown command: ${cmd}. Type /help for available commands.`);
    }
  } else {
    console.log('Type /help for available commands.');
  }

  rl.prompt();
});

rl.on('close', () => {
  console.log('\n👋 Goodbye!');
  manager.disconnect();
  process.exit(0);
});

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('\n\n👋 Shutting down...');
  manager.disconnect();
  process.exit(0);
});
