#!/usr/bin/env node
/*
 * WebRTC CRDT Sync Example
 * Demonstrates state synchronization over WebRTC DataChannels
 */
import { Engine } from 'hypertoken/engine/Engine.js';
import { RelayServer } from 'hypertoken/network/RelayServer.js';
import * as readline from 'readline';

const SERVER_URL = 'ws://localhost:8080';
const clientName = process.argv[2] || 'Player';
const isServer = process.argv[3] === '--server';

console.log(`🎮 WebRTC CRDT Sync Demo\n`);

// Start relay server if requested
if (isServer) {
  console.log('Starting relay server...');
  const server = new RelayServer(null, { port: 8080, verbose: true });
  await server.start();
  console.log('✅ Relay server running on ws://localhost:8080\n');
}

// Create engine with WebRTC enabled
const engine = new Engine({ useWebRTC: true });

// Track peers
const peers = new Set();

// Setup event handlers
engine.on('net:connected', () => {
  console.log(`✅ Connected to relay server`);
});

engine.on('net:ready', (evt) => {
  const peerId = evt.payload.peerId;
  console.log(`👤 Your peer ID: ${peerId}`);
  console.log(`📝 Your name: ${clientName}\n`);

  // Initialize shared state with your name
  engine.session.change(`Initialize ${clientName}`, (doc) => {
    if (!doc.players) doc.players = {};
    if (!doc.counter) doc.counter = 0;
    doc.players[peerId] = { name: clientName, joined: Date.now() };
  }, peerId);

  showHelp();
});

engine.on('net:peer:connected', (evt) => {
  const peerId = evt.payload.peerId;
  console.log(`\n👋 Peer connected: ${peerId}`);
  peers.add(peerId);
});

engine.on('net:peer:disconnected', (evt) => {
  const peerId = evt.payload.peerId;
  const state = engine.session.state;
  const playerName = state.players?.[peerId]?.name || 'unknown';
  console.log(`\n👋 Peer disconnected: ${peerId} (${playerName})`);
  peers.delete(peerId);
});

engine.on('rtc:upgraded', (evt) => {
  const { peerId, usingTurn, retryCount } = evt.payload;
  const state = engine.session.state;
  const playerName = state.players?.[peerId]?.name || peerId;

  let msg = `\n🚀 WebRTC connection established with ${playerName}`;
  if (usingTurn) msg += ' (via TURN)';
  if (retryCount > 0) msg += ` after ${retryCount} retries`;
  msg += '\n   CRDT sync now using direct P2P DataChannel!';
  console.log(msg);
});

engine.on('rtc:downgraded', (evt) => {
  const peerId = evt.payload.peerId;
  const state = engine.session.state;
  const playerName = state.players?.[peerId]?.name || peerId;
  console.log(`\n⚠️  WebRTC lost with ${playerName}, CRDT sync using WebSocket`);
});

engine.on('state:updated', () => {
  // State was updated (either locally or from a peer)
  // This fires after CRDT merge
  rl.prompt();
});

// Connect to relay server
console.log(`Connecting to ${SERVER_URL}...\n`);
engine.connect(SERVER_URL);

// Setup readline for interactive commands
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
  prompt: '> '
});

function showHelp() {
  console.log('Available commands:');
  console.log('  /state          - Show current shared state');
  console.log('  /players        - List all players');
  console.log('  /increment      - Increment shared counter');
  console.log('  /set <key> <val>- Set a value in shared state');
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

      case '/state':
        console.log('\n📊 Current shared state:');
        console.log(JSON.stringify(engine.session.state, null, 2));
        console.log();
        break;

      case '/players':
        const state = engine.session.state;
        console.log(`\n👥 Connected players (${Object.keys(state.players || {}).length}):`);
        for (const [peerId, player] of Object.entries(state.players || {})) {
          const isYou = peerId === engine.network?.getPeerId?.();
          const mark = isYou ? ' (you)' : '';
          console.log(`   ${peerId} - ${player.name}${mark}`);
        }
        console.log();
        break;

      case '/increment':
        engine.session.change('Increment counter', (doc) => {
          if (!doc.counter) doc.counter = 0;
          doc.counter++;
        }, engine.network?.getPeerId?.() || 'local');

        console.log(`✅ Counter incremented to ${engine.session.state.counter}`);
        console.log('   (Change will sync to all peers via CRDT)\n');
        break;

      case '/set':
        if (parts.length < 3) {
          console.log('Usage: /set <key> <value>');
        } else {
          const key = parts[1];
          const value = parts.slice(2).join(' ');

          engine.session.change(`Set ${key}`, (doc) => {
            doc[key] = value;
          }, engine.network?.getPeerId?.() || 'local');

          console.log(`✅ Set ${key} = "${value}"`);
          console.log('   (Change will sync to all peers via CRDT)\n');
        }
        break;

      case '/quit':
        console.log('\n👋 Disconnecting...');
        engine.disconnect();
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
  engine.disconnect();
  process.exit(0);
});

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('\n\n👋 Shutting down...');
  engine.disconnect();
  process.exit(0);
});
