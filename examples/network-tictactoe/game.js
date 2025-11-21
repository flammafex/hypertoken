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
 * Network Tic-Tac-Toe Game
 * 
 * Demonstrates HyperToken's multiagent capabilities with a simple turn-based game.
 * Two agents connect to a relay server and compete in real-time.
 */

import { ActionRegistry } from '../../engine/actions.js';

// Extend ActionRegistry with tic-tac-toe actions
Object.assign(ActionRegistry, {
  /**
   * Initialize the game board
   */
  "tictactoe:init": (engine) => {
    engine._gameState = {
      board: Array(9).fill(null), // 0-8 positions
      currentAgent: 'X',
      winner: null,
      gameOver: false,
      agents: {
        X: null,
        O: null
      }
    };
    engine.emit("game:initialized", engine._gameState);
  },
  
  /**
   * Register a agent
   */
  "tictactoe:register": (engine, { symbol, clientId } = {}) => {
    if (!symbol || !clientId) {
      throw new Error("symbol and clientId required");
    }
    
    if (!engine._gameState.agents[symbol]) {
      engine._gameState.agents[symbol] = clientId;
      engine.emit("agent:registered", { symbol, clientId });
      
      // Start game if both agents registered
      if (engine._gameState.agents.X && engine._gameState.agents.O) {
        engine.emit("game:started", engine._gameState);
      }
    }
  },
  
  /**
   * Make a move
   */
  "tictactoe:move": (engine, { position, clientId } = {}) => {
    const state = engine._gameState;
    
    // Validate
    if (state.gameOver) {
      throw new Error("Game is over");
    }
    
    if (position < 0 || position > 8) {
      throw new Error("Invalid position");
    }
    
    if (state.board[position] !== null) {
      throw new Error("Position already taken");
    }
    
    // Check if it's this agent's turn
    const currentSymbol = state.currentAgent;
    if (state.agents[currentSymbol] !== clientId) {
      throw new Error("Not your turn");
    }
    
    // Make move
    state.board[position] = currentSymbol;
    engine.emit("move:made", { position, symbol: currentSymbol });
    
    // Check for winner
    const winner = checkWinner(state.board);
    if (winner) {
      state.winner = winner;
      state.gameOver = true;
      engine.emit("game:won", { winner });
    } else if (state.board.every(cell => cell !== null)) {
      // Draw
      state.gameOver = true;
      engine.emit("game:draw", {});
    } else {
      // Switch turns
      state.currentAgent = currentSymbol === 'X' ? 'O' : 'X';
      engine.emit("turn:changed", { currentAgent: state.currentAgent });
    }
  },
  
  /**
   * Reset the game
   */
  "tictactoe:reset": (engine) => {
    engine._gameState.board = Array(9).fill(null);
    engine._gameState.currentAgent = 'X';
    engine._gameState.winner = null;
    engine._gameState.gameOver = false;
    engine.emit("game:reset", engine._gameState);
  }
});

/**
 * Check if there's a winner
 */
function checkWinner(board) {
  const lines = [
    [0, 1, 2], // top row
    [3, 4, 5], // middle row
    [6, 7, 8], // bottom row
    [0, 3, 6], // left column
    [1, 4, 7], // middle column
    [2, 5, 8], // right column
    [0, 4, 8], // diagonal \
    [2, 4, 6]  // diagonal /
  ];
  
  for (const [a, b, c] of lines) {
    if (board[a] && board[a] === board[b] && board[a] === board[c]) {
      return board[a];
    }
  }
  
  return null;
}

/**
 * Format board for display
 */
export function formatBoard(board) {
  const cells = board.map((cell, i) => cell || i);
  return `
 ${cells[0]} │ ${cells[1]} │ ${cells[2]}
───┼───┼───
 ${cells[3]} │ ${cells[4]} │ ${cells[5]}
───┼───┼───
 ${cells[6]} │ ${cells[7]} │ ${cells[8]}
`;
}

/**
 * Get game status message
 */
export function getStatusMessage(state) {
  if (state.gameOver) {
    if (state.winner) {
      return `Game Over! ${state.winner} wins! 🎉`;
    } else {
      return `Game Over! It's a draw! 🤝`;
    }
  }
  
  if (!state.agents.X || !state.agents.O) {
    return `Waiting for agents... (${state.agents.X ? '1' : '0'}/2)`;
  }
  
  return `${state.currentAgent}'s turn`;
}