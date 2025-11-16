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
 * Tic-Tac-Toe Client
 * 
 * Interactive command-line client for playing network tic-tac-toe.
 */

import WebSocket from 'ws';
import readline from 'readline';
import { formatBoard, getStatusMessage } from './game.js';

const SERVER_URL = process.argv[2] || 'ws://localhost:8080';

console.log('╔══════════════════════════════════════════╗');
console.log('║  TIC-TAC-TOE MULTIPLAYER CLIENT         ║');
console.log('╚══════════════════════════════════════════╝\n');

// State
let socket = null;
let gameState = null;
let mySymbol = null;
let clientId = null;
let connected = false;

// Create readline interface
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

/**
 * Connect to server
 */
function connect() {
  console.log(`Connecting to ${SERVER_URL}...`);
  
  socket = new WebSocket(SERVER_URL);
  
  socket.on('open', () => {
    connected = true;
    clientId = `client-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    console.log('✓ Connected to server!\n');
    
    // Request initial state
    send({ cmd: 'describe' });
  });
  
  socket.on('message', (data) => {
    handleMessage(JSON.parse(data.toString()));
  });
  
  socket.on('close', () => {
    connected = false;
    console.log('\n❌ Disconnected from server');
    process.exit(0);
  });
  
  socket.on('error', (err) => {
    console.error('Connection error:', err.message);
    process.exit(1);
  });
}

/**
 * Send message to server
 */
function send(msg) {
  if (socket && connected) {
    socket.send(JSON.stringify(msg));
  }
}

/**
 * Handle incoming messages
 */
function handleMessage(msg) {
  if (msg.cmd === 'describe') {
    gameState = msg.state._gameState;
    updateDisplay();
    
    // Auto-register if not registered yet
    if (!mySymbol && gameState) {
      if (!gameState.players.X) {
        registerAs('X');
      } else if (!gameState.players.O) {
        registerAs('O');
      } else {
        console.log('⚠️  Game is full. Spectator mode.\n');
        showPrompt();
      }
    } else {
      showPrompt();
    }
  } else if (msg.cmd === 'error') {
    console.log(`\n❌ Error: ${msg.message}\n`);
    showPrompt();
  }
}

/**
 * Register as a player
 */
function registerAs(symbol) {
  mySymbol = symbol;
  console.log(`\n✓ You are playing as ${symbol}\n`);
  send({
    cmd: 'dispatch',
    type: 'tictactoe:register',
    payload: { symbol, clientId }
  });
}

/**
 * Make a move
 */
function makeMove(position) {
  if (!gameState) {
    console.log('⚠️  Game not initialized yet');
    return;
  }
  
  if (!mySymbol) {
    console.log('⚠️  You are not registered as a player');
    return;
  }
  
  if (gameState.gameOver) {
    console.log('⚠️  Game is over. Type "reset" to play again');
    return;
  }
  
  if (gameState.currentPlayer !== mySymbol) {
    console.log('⚠️  Not your turn!');
    return;
  }
  
  send({
    cmd: 'dispatch',
    type: 'tictactoe:move',
    payload: { position, clientId }
  });
}

/**
 * Reset game
 */
function resetGame() {
  send({
    cmd: 'dispatch',
    type: 'tictactoe:reset',
    payload: {}
  });
}

/**
 * Update display
 */
function updateDisplay() {
  console.clear();
  console.log('╔══════════════════════════════════════════╗');
  console.log('║  TIC-TAC-TOE MULTIPLAYER                ║');
  console.log('╚══════════════════════════════════════════╝\n');
  
  if (mySymbol) {
    console.log(`You are: ${mySymbol}`);
  }
  
  if (gameState) {
    console.log(formatBoard(gameState.board));
    console.log('\n' + getStatusMessage(gameState));
    console.log('\n');
  }
}

/**
 * Show command prompt
 */
function showPrompt() {
  if (!connected) return;
  
  if (gameState && !gameState.gameOver && gameState.currentPlayer === mySymbol) {
    rl.question('Your move (0-8, or "help"): ', handleInput);
  } else {
    rl.question('(type "help" for commands): ', handleInput);
  }
}

/**
 * Handle user input
 */
function handleInput(input) {
  const cmd = input.trim().toLowerCase();
  
  if (cmd === 'help') {
    console.log('\nCommands:');
    console.log('  0-8      - Make a move at position');
    console.log('  reset    - Reset the game');
    console.log('  quit     - Exit the game');
    console.log('');
    showPrompt();
    return;
  }
  
  if (cmd === 'quit' || cmd === 'exit') {
    console.log('\nGoodbye! 👋\n');
    socket.close();
    process.exit(0);
    return;
  }
  
  if (cmd === 'reset') {
    resetGame();
    return;
  }
  
  // Try to parse as move
  const position = parseInt(cmd);
  if (!isNaN(position) && position >= 0 && position <= 8) {
    makeMove(position);
  } else {
    console.log('Invalid command. Type "help" for commands.');
    showPrompt();
  }
}

/**
 * Show help on startup
 */
function showStartupHelp() {
  console.log('How to play:');
  console.log('  • Enter 0-8 to place your mark');
  console.log('  • Board positions:');
  console.log('      0 │ 1 │ 2');
  console.log('      3 │ 4 │ 5');
  console.log('      6 │ 7 │ 8');
  console.log('  • Type "help" anytime for commands');
  console.log('  • Type "reset" to start a new game');
  console.log('  • Type "quit" to exit\n');
}

// Start
showStartupHelp();
connect();

// Handle Ctrl+C
process.on('SIGINT', () => {
  console.log('\n\nGoodbye! 👋\n');
  if (socket) socket.close();
  process.exit(0);
});