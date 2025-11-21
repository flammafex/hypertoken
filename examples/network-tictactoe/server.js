#!/usr/bin/env node
/*
 * Copyright 2025 The Carpocratian Church of Commonality and Equality, Inc.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *      http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

/**
 * Tic-Tac-Toe Server
 * 
 * Authoritative game server that manages game state and validates moves.
 * Agents connect via WebSocket and send commands.
 */

import { Engine } from '../../engine/Engine.js';
import { RelayServer } from './relay-server.js'; // Use local relay server
import './game.js'; // Load tic-tac-toe actions

console.log('╔══════════════════════════════════════════╗');
console.log('║  TIC-TAC-TOE MULTIPLAYER SERVER         ║');
console.log('╚══════════════════════════════════════════╝\n');

// Create engine
const engine = new Engine();

// Add describe method for network sync
engine.describe = function() {
  return {
    _gameState: this._gameState || null,
    history: this.history || []
  };
};

// Initialize game
engine.dispatch('tictactoe:init');

// Add event listeners for game events
engine.on('agent:registered', (evt) => {
  const { symbol, clientId } = evt.payload || evt;
  console.log(`✓ Agent ${symbol} registered (${clientId})`);
});

engine.on('game:started', () => {
  console.log('\n🎮 Game started! Both agents connected.\n');
});

engine.on('move:made', (evt) => {
  const { position, symbol } = evt.payload || evt;
  console.log(`→ ${symbol} played position ${position}`);
});

engine.on('turn:changed', (evt) => {
  const { currentAgent } = evt.payload || evt;
  console.log(`  Current turn: ${currentAgent}`);
});

engine.on('game:won', (evt) => {
  const { winner } = evt.payload || evt;
  console.log(`\n🏆 Game Over! ${winner} wins!\n`);
});

engine.on('game:draw', () => {
  console.log('\n🤝 Game Over! It\'s a draw!\n');
});

engine.on('game:reset', () => {
  console.log('\n🔄 Game reset. Ready for new agents.\n');
});

// Create and start relay server
const server = new RelayServer(engine, {
  port: 8080,
  verbose: true,
  broadcastOnAction: true
});

await server.start();

console.log('Server ready! Agents can connect to:');
console.log('  ws://localhost:8080\n');
console.log('Press Ctrl+C to stop the server.\n');

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('\n\nShutting down server...');
  server.stop();
  
  // Give server 1 second to clean up, then force exit
  setTimeout(() => {
    console.log('Server stopped.');
    process.exit(0);
  }, 1000);
});