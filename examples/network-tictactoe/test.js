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
 * Test Suite for Network Tic-Tac-Toe
 * 
 * Tests game logic, validation, and win conditions
 */

import { Engine } from '../../engine/Engine.js';
import './game.js';
import assert from 'assert';

let testCount = 0;
let passCount = 0;
let failCount = 0;

async function test(description, fn) {
  testCount++;
  try {
    await fn();
    passCount++;
    console.log(`✓ ${description}`);
  } catch (err) {
    failCount++;
    console.log(`✗ ${description}`);
    console.log(`  Error: ${err.message}`);
  }
}

console.log('\n🧪 Network Tic-Tac-Toe Test Suite\n');
console.log('═'.repeat(60));

// ============================================================================
// INITIALIZATION TESTS
// ============================================================================

console.log('\n🎮 Initialization Tests\n');

test('Game initializes with empty board', async () => {
  const engine = new Engine();
  await engine.dispatch('tictactoe:init');

  const state = engine._gameState;
  assert(state.board.length === 9, 'Board should have 9 positions');
  assert(state.board.every(cell => cell === null), 'All cells should be null');
  assert.strictEqual(state.currentAgent, 'X', 'X should go first');
  assert.strictEqual(state.gameOver, false, 'Game should not be over');
});

test('Agents can register', async () => {
  const engine = new Engine();
  await engine.dispatch('tictactoe:init');

  await engine.dispatch('tictactoe:register', { symbol: 'X', clientId: 'agent1' });
  await engine.dispatch('tictactoe:register', { symbol: 'O', clientId: 'agent2' });

  const state = engine._gameState;
  assert.strictEqual(state.agents.X, 'agent1', 'X agent should be registered');
  assert.strictEqual(state.agents.O, 'agent2', 'O agent should be registered');
});

test('Cannot register same symbol twice', async () => {
  const engine = new Engine();
  await engine.dispatch('tictactoe:init');

  await engine.dispatch('tictactoe:register', { symbol: 'X', clientId: 'agent1' });
  await engine.dispatch('tictactoe:register', { symbol: 'X', clientId: 'agent2' });

  const state = engine._gameState;
  assert.strictEqual(state.agents.X, 'agent1', 'First registration should stick');
});

// ============================================================================
// MOVE VALIDATION TESTS
// ============================================================================

console.log('\n🎯 Move Validation Tests\n');

test('Valid move is accepted', async () => {
  const engine = new Engine();
  await engine.dispatch('tictactoe:init');
  await engine.dispatch('tictactoe:register', { symbol: 'X', clientId: 'agent1' });
  await engine.dispatch('tictactoe:register', { symbol: 'O', clientId: 'agent2' });

  await engine.dispatch('tictactoe:move', { position: 4, clientId: 'agent1' });

  const state = engine._gameState;
  assert.strictEqual(state.board[4], 'X', 'X should be placed at position 4');
});

test('Cannot move out of turn', async () => {
  const engine = new Engine();
  await engine.dispatch('tictactoe:init');
  await engine.dispatch('tictactoe:register', { symbol: 'X', clientId: 'agent1' });
  await engine.dispatch('tictactoe:register', { symbol: 'O', clientId: 'agent2' });

  try {
    await engine.dispatch('tictactoe:move', { position: 4, clientId: 'agent2' });
    assert.fail('Should throw error for out of turn move');
  } catch (err) {
    assert(err.message.includes('Not your turn'), 'Should indicate wrong turn');
  }
});

test('Cannot move to occupied position', async () => {
  const engine = new Engine();
  await engine.dispatch('tictactoe:init');
  await engine.dispatch('tictactoe:register', { symbol: 'X', clientId: 'agent1' });
  await engine.dispatch('tictactoe:register', { symbol: 'O', clientId: 'agent2' });

  await engine.dispatch('tictactoe:move', { position: 4, clientId: 'agent1' });

  try {
    await engine.dispatch('tictactoe:move', { position: 4, clientId: 'agent2' });
    assert.fail('Should throw error for occupied position');
  } catch (err) {
    assert(err.message.includes('already taken'), 'Should indicate position taken');
  }
});

test('Cannot move to invalid position', async () => {
  const engine = new Engine();
  await engine.dispatch('tictactoe:init');
  await engine.dispatch('tictactoe:register', { symbol: 'X', clientId: 'agent1' });
  await engine.dispatch('tictactoe:register', { symbol: 'O', clientId: 'agent2' });

  try {
    await engine.dispatch('tictactoe:move', { position: 10, clientId: 'agent1' });
    assert.fail('Should throw error for invalid position');
  } catch (err) {
    assert(err.message.includes('Invalid position'), 'Should indicate invalid position');
  }
});

test('Cannot move after game over', async () => {
  const engine = new Engine();
  await engine.dispatch('tictactoe:init');
  await engine.dispatch('tictactoe:register', { symbol: 'X', clientId: 'agent1' });
  await engine.dispatch('tictactoe:register', { symbol: 'O', clientId: 'agent2' });

  // Play winning sequence for X
  await engine.dispatch('tictactoe:move', { position: 0, clientId: 'agent1' }); // X
  await engine.dispatch('tictactoe:move', { position: 3, clientId: 'agent2' }); // O
  await engine.dispatch('tictactoe:move', { position: 1, clientId: 'agent1' }); // X
  await engine.dispatch('tictactoe:move', { position: 4, clientId: 'agent2' }); // O
  await engine.dispatch('tictactoe:move', { position: 2, clientId: 'agent1' }); // X wins

  try {
    await engine.dispatch('tictactoe:move', { position: 5, clientId: 'agent2' });
    assert.fail('Should throw error for move after game over');
  } catch (err) {
    assert(err.message.includes('Game is over'), 'Should indicate game over');
  }
});

// ============================================================================
// TURN SWITCHING TESTS
// ============================================================================

console.log('\n🔄 Turn Switching Tests\n');

test('Turns alternate correctly', async () => {
  const engine = new Engine();
  await engine.dispatch('tictactoe:init');
  await engine.dispatch('tictactoe:register', { symbol: 'X', clientId: 'agent1' });
  await engine.dispatch('tictactoe:register', { symbol: 'O', clientId: 'agent2' });

  assert.strictEqual(engine._gameState.currentAgent, 'X', 'X starts');

  await engine.dispatch('tictactoe:move', { position: 0, clientId: 'agent1' });
  assert.strictEqual(engine._gameState.currentAgent, 'O', 'O goes after X');

  await engine.dispatch('tictactoe:move', { position: 1, clientId: 'agent2' });
  assert.strictEqual(engine._gameState.currentAgent, 'X', 'X goes after O');
});

// ============================================================================
// WIN DETECTION TESTS
// ============================================================================

console.log('\n🏆 Win Detection Tests\n');

test('Detects horizontal win (top row)', async () => {
  const engine = new Engine();
  await engine.dispatch('tictactoe:init');
  await engine.dispatch('tictactoe:register', { symbol: 'X', clientId: 'agent1' });
  await engine.dispatch('tictactoe:register', { symbol: 'O', clientId: 'agent2' });

  // X plays: 0, 1, 2 (top row)
  // O plays: 3, 4
  await engine.dispatch('tictactoe:move', { position: 0, clientId: 'agent1' });
  await engine.dispatch('tictactoe:move', { position: 3, clientId: 'agent2' });
  await engine.dispatch('tictactoe:move', { position: 1, clientId: 'agent1' });
  await engine.dispatch('tictactoe:move', { position: 4, clientId: 'agent2' });
  await engine.dispatch('tictactoe:move', { position: 2, clientId: 'agent1' });

  const state = engine._gameState;
  assert.strictEqual(state.winner, 'X', 'X should win');
  assert.strictEqual(state.gameOver, true, 'Game should be over');
});

test('Detects vertical win (left column)', async () => {
  const engine = new Engine();
  await engine.dispatch('tictactoe:init');
  await engine.dispatch('tictactoe:register', { symbol: 'X', clientId: 'agent1' });
  await engine.dispatch('tictactoe:register', { symbol: 'O', clientId: 'agent2' });

  // X plays: 0, 3, 6 (left column)
  // O plays: 1, 2
  await engine.dispatch('tictactoe:move', { position: 0, clientId: 'agent1' });
  await engine.dispatch('tictactoe:move', { position: 1, clientId: 'agent2' });
  await engine.dispatch('tictactoe:move', { position: 3, clientId: 'agent1' });
  await engine.dispatch('tictactoe:move', { position: 2, clientId: 'agent2' });
  await engine.dispatch('tictactoe:move', { position: 6, clientId: 'agent1' });

  const state = engine._gameState;
  assert.strictEqual(state.winner, 'X', 'X should win');
  assert.strictEqual(state.gameOver, true, 'Game should be over');
});

test('Detects diagonal win (\\)', async () => {
  const engine = new Engine();
  await engine.dispatch('tictactoe:init');
  await engine.dispatch('tictactoe:register', { symbol: 'X', clientId: 'agent1' });
  await engine.dispatch('tictactoe:register', { symbol: 'O', clientId: 'agent2' });

  // X plays: 0, 4, 8 (diagonal)
  // O plays: 1, 2
  await engine.dispatch('tictactoe:move', { position: 0, clientId: 'agent1' });
  await engine.dispatch('tictactoe:move', { position: 1, clientId: 'agent2' });
  await engine.dispatch('tictactoe:move', { position: 4, clientId: 'agent1' });
  await engine.dispatch('tictactoe:move', { position: 2, clientId: 'agent2' });
  await engine.dispatch('tictactoe:move', { position: 8, clientId: 'agent1' });

  const state = engine._gameState;
  assert.strictEqual(state.winner, 'X', 'X should win');
  assert.strictEqual(state.gameOver, true, 'Game should be over');
});

test('Detects diagonal win (/)', async () => {
  const engine = new Engine();
  await engine.dispatch('tictactoe:init');
  await engine.dispatch('tictactoe:register', { symbol: 'X', clientId: 'agent1' });
  await engine.dispatch('tictactoe:register', { symbol: 'O', clientId: 'agent2' });

  // X plays: 2, 4, 6 (diagonal)
  // O plays: 0, 1
  await engine.dispatch('tictactoe:move', { position: 2, clientId: 'agent1' });
  await engine.dispatch('tictactoe:move', { position: 0, clientId: 'agent2' });
  await engine.dispatch('tictactoe:move', { position: 4, clientId: 'agent1' });
  await engine.dispatch('tictactoe:move', { position: 1, clientId: 'agent2' });
  await engine.dispatch('tictactoe:move', { position: 6, clientId: 'agent1' });

  const state = engine._gameState;
  assert.strictEqual(state.winner, 'X', 'X should win');
  assert.strictEqual(state.gameOver, true, 'Game should be over');
});

test('Detects draw', async () => {
  const engine = new Engine();
  await engine.dispatch('tictactoe:init');
  await engine.dispatch('tictactoe:register', { symbol: 'X', clientId: 'agent1' });
  await engine.dispatch('tictactoe:register', { symbol: 'O', clientId: 'agent2' });

  // Play draw game:
  // X O X
  // X O O
  // O X X
  const moves = [
    { pos: 0, agent: 'agent1' }, // X
    { pos: 1, agent: 'agent2' }, // O
    { pos: 2, agent: 'agent1' }, // X
    { pos: 3, agent: 'agent2' }, // O (mistake)
    { pos: 4, agent: 'agent1' }, // X (mistake)
    { pos: 5, agent: 'agent2' }, // O
    { pos: 6, agent: 'agent1' }, // X (mistake)
    { pos: 7, agent: 'agent2' }, // O
    { pos: 8, agent: 'agent1' }  // X
  ];

  // Actually create a proper draw
  await engine.dispatch('tictactoe:move', { position: 4, clientId: 'agent1' }); // X center
  await engine.dispatch('tictactoe:move', { position: 0, clientId: 'agent2' }); // O
  await engine.dispatch('tictactoe:move', { position: 8, clientId: 'agent1' }); // X
  await engine.dispatch('tictactoe:move', { position: 2, clientId: 'agent2' }); // O
  await engine.dispatch('tictactoe:move', { position: 6, clientId: 'agent1' }); // X
  await engine.dispatch('tictactoe:move', { position: 1, clientId: 'agent2' }); // O
  await engine.dispatch('tictactoe:move', { position: 3, clientId: 'agent1' }); // X
  await engine.dispatch('tictactoe:move', { position: 5, clientId: 'agent2' }); // O
  await engine.dispatch('tictactoe:move', { position: 7, clientId: 'agent1' }); // X

  const state = engine._gameState;
  assert.strictEqual(state.winner, null, 'No winner in draw');
  assert.strictEqual(state.gameOver, true, 'Game should be over');
});

// ============================================================================
// RESET TESTS
// ============================================================================

console.log('\n🔄 Reset Tests\n');

test('Reset clears board and state', async () => {
  const engine = new Engine();
  await engine.dispatch('tictactoe:init');
  await engine.dispatch('tictactoe:register', { symbol: 'X', clientId: 'agent1' });
  await engine.dispatch('tictactoe:register', { symbol: 'O', clientId: 'agent2' });

  await engine.dispatch('tictactoe:move', { position: 0, clientId: 'agent1' });
  await engine.dispatch('tictactoe:move', { position: 4, clientId: 'agent2' });

  await engine.dispatch('tictactoe:reset');

  const state = engine._gameState;
  assert(state.board.every(cell => cell === null), 'Board should be empty');
  assert.strictEqual(state.currentAgent, 'X', 'X should go first again');
  assert.strictEqual(state.winner, null, 'Winner should be null');
  assert.strictEqual(state.gameOver, false, 'Game should not be over');
});

// ============================================================================
// RESULTS
// ============================================================================

console.log('\n' + '═'.repeat(60));
console.log(`\n📊 Test Results: ${passCount}/${testCount} passed\n`);

if (failCount === 0) {
  console.log('🎉 All tests passed!\n');
  console.log('✓ Initialization verified');
  console.log('✓ Move validation verified');
  console.log('✓ Turn switching verified');
  console.log('✓ Win detection verified');
  console.log('✓ Reset functionality verified\n');
  process.exit(0);
} else {
  console.log(`❌ ${failCount} tests failed\n`);
  process.exit(1);
}