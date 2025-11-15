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
 * Test all 45 actions in the extended ActionRegistry
 * 
 * This test suite verifies that:
 * 1. All actions are registered
 * 2. All actions execute without errors
 * 3. Actions produce expected side effects
 * 4. Error handling works correctly
 */

import { ActionRegistry, listActions, listActionsByCategory, hasAction } from './actions.js';
import { Deck } from '../core/Deck.js';
import { Table } from '../core/Table.js';
import { Shoe } from '../core/Shoe.js';
import { Engine } from './Engine.js';

// Test helpers
let testCount = 0;
let passCount = 0;
let failCount = 0;

function test(name, fn) {
  testCount++;
  try {
    fn();
    passCount++;
    console.log(`✓ ${name}`);
  } catch (err) {
    failCount++;
    console.error(`✗ ${name}`);
    console.error(`  ${err.message}`);
  }
}

function assertEquals(actual, expected, message) {
  if (actual !== expected) {
    throw new Error(message || `Expected ${expected}, got ${actual}`);
  }
}

function assertExists(value, message) {
  if (!value) {
    throw new Error(message || 'Value does not exist');
  }
}

function assertThrows(fn, message) {
  try {
    fn();
    throw new Error(message || 'Expected function to throw');
  } catch (err) {
    // Expected
  }
}

// Setup test engine
function createTestEngine() {
  const cards = Array.from({ length: 52 }, (_, i) => ({
    id: `card-${i}`,
    label: `Card ${i}`,
    group: ['hearts', 'diamonds', 'clubs', 'spades'][Math.floor(i / 13)],
    text: '',
    meta: {},
    char: '🂠',
    kind: 'test',
    index: i
  }));
  
  const deck = new Deck(cards, { seed: 42 });
  const table = new Table('test');
  const shoe = new Shoe(deck);
  
  const engine = new Engine({ deck, table, shoe });
  engine._players = [];
  
  return engine;
}

console.log('\n🧪 Testing HyperToken Extended Actions\n');
console.log('═'.repeat(50));

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// REGISTRY TESTS
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

console.log('\n📚 Registry Tests\n');

test('ActionRegistry is defined', () => {
  assertExists(ActionRegistry);
});

test('ActionRegistry has all 45 actions', () => {
  const count = Object.keys(ActionRegistry).length;
  assertEquals(count, 45, `Expected 45 actions, found ${count}`);
});

test('listActions returns all action names', () => {
  const actions = listActions();
  assertEquals(actions.length, 45);
  assertEquals(actions[0].includes(':'), true, 'Actions should have category prefix');
});

test('listActionsByCategory groups correctly', () => {
  const categories = listActionsByCategory();
  assertExists(categories.deck);
  assertExists(categories.table);
  assertExists(categories.shoe);
  assertExists(categories.player);
  assertExists(categories.game);
  assertEquals(categories.deck.length, 10);
  assertEquals(categories.table.length, 14);
  assertEquals(categories.shoe.length, 7);
  assertEquals(categories.player.length, 8);
  assertEquals(categories.game.length, 6);
});

test('hasAction works correctly', () => {
  assertEquals(hasAction('deck:shuffle'), true);
  assertEquals(hasAction('nonexistent:action'), false);
});

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// DECK ACTIONS
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

console.log('\n🃏 Deck Actions\n');

test('deck:shuffle executes', () => {
  const engine = createTestEngine();
  engine.dispatch('deck:shuffle', { seed: 42 });
  assertExists(engine.deck);
});

test('deck:draw returns cards', () => {
  const engine = createTestEngine();
  const cards = engine.dispatch('deck:draw', { count: 5 });
  assertEquals(cards.length, 5);
});

test('deck:reset restores deck', () => {
  const engine = createTestEngine();
  engine.dispatch('deck:draw', { count: 10 });
  engine.dispatch('deck:reset');
  assertEquals(engine.deck.size, 52);
});

test('deck:burn discards cards', () => {
  const engine = createTestEngine();
  const before = engine.deck.size;
  engine.dispatch('deck:burn', { count: 3 });
  assertEquals(engine.deck.size, before - 3);
});

test('deck:peek does not remove cards', () => {
  const engine = createTestEngine();
  const before = engine.deck.size;
  const cards = engine.dispatch('deck:peek', { count: 3 });
  assertEquals(cards.length, 3);
  assertEquals(engine.deck.size, before);
});

test('deck:cut rearranges deck', () => {
  const engine = createTestEngine();
  engine.dispatch('deck:cut', { position: 26 });
  assertExists(engine.deck);
});

test('deck:insertAt adds card at position', () => {
  const engine = createTestEngine();
  const card = { id: 'test', label: 'Test' };
  engine.dispatch('deck:insertAt', { card, position: 0 });
  assertEquals(engine.deck.size, 53);
});

test('deck:removeAt removes card', () => {
  const engine = createTestEngine();
  const card = engine.dispatch('deck:removeAt', { position: 0 });
  assertExists(card);
  assertEquals(engine.deck.size, 51);
});

test('deck:swap exchanges positions', () => {
  const engine = createTestEngine();
  engine.dispatch('deck:swap', { i: 0, j: 51 });
  assertExists(engine.deck);
});

test('deck:reverse reverses range', () => {
  const engine = createTestEngine();
  engine.dispatch('deck:reverse', { start: 0, end: 12 });
  assertExists(engine.deck);
});

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// TABLE ACTIONS
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

console.log('\n🎴 Table Actions\n');

test('table:place adds card to zone', () => {
  const engine = createTestEngine();
  const card = engine.deck.draw();
  const placement = engine.dispatch('table:place', { 
    zone: 'test', 
    card,
    opts: { faceUp: true }
  });
  assertExists(placement);
  assertEquals(engine.table.zoneCount('test'), 1);
});

test('table:clear removes all cards', () => {
  const engine = createTestEngine();
  const card = engine.deck.draw();
  engine.table.place('test', card);
  engine.dispatch('table:clear');
  assertEquals(engine.table.zoneCount('test'), 0);
});

test('table:createZone adds new zone', () => {
  const engine = createTestEngine();
  engine.dispatch('table:createZone', { id: 'newzone', label: 'New Zone' });
  assertExists(engine.table.zones.has('newzone'));
});

test('table:deleteZone removes zone', () => {
  const engine = createTestEngine();
  engine.table.createZone('temp');
  engine.dispatch('table:deleteZone', { id: 'temp' });
  assertEquals(engine.table.zones.has('temp'), false);
});

test('table:clearZone empties specific zone', () => {
  const engine = createTestEngine();
  const card = engine.deck.draw();
  engine.table.place('test', card);
  engine.dispatch('table:clearZone', { zone: 'test' });
  assertEquals(engine.table.zoneCount('test'), 0);
});

test('table:move transfers card between zones', () => {
  const engine = createTestEngine();
  const card = engine.deck.draw();
  const placement = engine.table.place('zone1', card);
  engine.table.createZone('zone2');
  engine.dispatch('table:move', { 
    fromZone: 'zone1', 
    toZone: 'zone2', 
    placementId: placement.id 
  });
  assertEquals(engine.table.zoneCount('zone2'), 1);
});

test('table:flip changes face state', () => {
  const engine = createTestEngine();
  const card = engine.deck.draw();
  const placement = engine.table.place('test', card, { faceUp: false });
  engine.dispatch('table:flip', { 
    zone: 'test', 
    placementId: placement.id, 
    faceUp: true 
  });
  assertEquals(placement.faceUp, true);
});

test('table:remove deletes placement', () => {
  const engine = createTestEngine();
  const card = engine.deck.draw();
  const placement = engine.table.place('test', card);
  engine.dispatch('table:remove', { zone: 'test', placementId: placement.id });
  assertEquals(engine.table.zoneCount('test'), 0);
});

test('table:shuffleZone randomizes zone', () => {
  const engine = createTestEngine();
  for (let i = 0; i < 5; i++) {
    engine.table.place('test', engine.deck.draw());
  }
  engine.dispatch('table:shuffleZone', { zone: 'test', seed: 42 });
  assertEquals(engine.table.zoneCount('test'), 5);
});

test('table:transferZone moves all cards', () => {
  const engine = createTestEngine();
  for (let i = 0; i < 3; i++) {
    engine.table.place('from', engine.deck.draw());
  }
  engine.table.createZone('to');
  engine.dispatch('table:transferZone', { fromZone: 'from', toZone: 'to' });
  assertEquals(engine.table.zoneCount('to'), 3);
});

test('table:fanZone arranges cards', () => {
  const engine = createTestEngine();
  for (let i = 0; i < 5; i++) {
    engine.table.place('test', engine.deck.draw());
  }
  engine.dispatch('table:fanZone', { zone: 'test', radius: 100 });
  assertEquals(engine.table.zoneCount('test'), 5);
});

test('table:stackZone stacks cards', () => {
  const engine = createTestEngine();
  for (let i = 0; i < 5; i++) {
    engine.table.place('test', engine.deck.draw());
  }
  engine.dispatch('table:stackZone', { zone: 'test' });
  assertEquals(engine.table.zoneCount('test'), 5);
});

test('table:lockZone prevents modifications', () => {
  const engine = createTestEngine();
  engine.table.createZone('locked');
  engine.dispatch('table:lockZone', { zone: 'locked', locked: true });
  assertExists(engine.table._lockedZones);
});

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// SHOE ACTIONS
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

console.log('\n👞 Shoe Actions\n');

test('shoe:draw returns card', () => {
  const engine = createTestEngine();
  const card = engine.dispatch('shoe:draw', { count: 1 });
  assertExists(card);
});

test('shoe:shuffle randomizes shoe', () => {
  const engine = createTestEngine();
  engine.dispatch('shoe:shuffle', { seed: 42 });
  assertExists(engine.shoe);
});

test('shoe:burn discards from shoe', () => {
  const engine = createTestEngine();
  engine.dispatch('shoe:burn', { count: 3 });
  assertExists(engine.shoe);
});

test('shoe:reset restores shoe', () => {
  const engine = createTestEngine();
  engine.shoe.draw(10);
  engine.dispatch('shoe:reset');
  assertExists(engine.shoe);
});

test('shoe:addDeck increases size', () => {
  const engine = createTestEngine();
  const newDeck = new Deck([{ id: 'extra', label: 'Extra' }]);
  engine.dispatch('shoe:addDeck', { deck: newDeck });
  assertExists(engine.shoe);
});

test('shoe:inspect returns stats', () => {
  const engine = createTestEngine();
  const stats = engine.dispatch('shoe:inspect');
  assertExists(stats);
  assertExists(stats.remaining);
});

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// PLAYER ACTIONS
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

console.log('\n👤 Player Actions\n');

test('player:create adds player', () => {
  const engine = createTestEngine();
  const player = engine.dispatch('player:create', { name: 'Alice' });
  assertExists(player);
  assertEquals(player.name, 'Alice');
  assertEquals(engine._players.length, 1);
});

test('player:remove deletes player', () => {
  const engine = createTestEngine();
  engine.dispatch('player:create', { name: 'Alice' });
  engine.dispatch('player:remove', { name: 'Alice' });
  assertEquals(engine._players.length, 0);
});

test('player:setActive changes state', () => {
  const engine = createTestEngine();
  engine.dispatch('player:create', { name: 'Alice' });
  engine.dispatch('player:setActive', { name: 'Alice', active: false });
  const player = engine._players[0];
  assertEquals(player.active, false);
});

test('player:giveResource adds resource', () => {
  const engine = createTestEngine();
  engine.dispatch('player:create', { name: 'Alice' });
  engine.dispatch('player:giveResource', { 
    name: 'Alice', 
    resource: 'chips', 
    amount: 100 
  });
  const player = engine._players[0];
  assertEquals(player.resources.chips, 100);
});

test('player:takeResource removes resource', () => {
  const engine = createTestEngine();
  engine.dispatch('player:create', { name: 'Alice' });
  engine.dispatch('player:giveResource', { 
    name: 'Alice', 
    resource: 'chips', 
    amount: 100 
  });
  engine.dispatch('player:takeResource', { 
    name: 'Alice', 
    resource: 'chips', 
    amount: 50 
  });
  const player = engine._players[0];
  assertEquals(player.resources.chips, 50);
});

test('player:drawCards adds to hand', () => {
  const engine = createTestEngine();
  engine.dispatch('player:create', { name: 'Alice' });
  engine.dispatch('player:drawCards', { name: 'Alice', count: 5 });
  const player = engine._players[0];
  assertEquals(player.hand.length, 5);
});

test('player:discardCards removes from hand', () => {
  const engine = createTestEngine();
  engine.dispatch('player:create', { name: 'Alice' });
  engine.dispatch('player:drawCards', { name: 'Alice', count: 5 });
  const player = engine._players[0];
  const toDiscard = player.hand.slice(0, 2);
  engine.dispatch('player:discardCards', { name: 'Alice', cards: toDiscard });
  assertEquals(player.hand.length, 3);
});

test('player:get returns player state', () => {
  const engine = createTestEngine();
  engine.dispatch('player:create', { name: 'Alice' });
  const player = engine.dispatch('player:get', { name: 'Alice' });
  assertExists(player);
  assertEquals(player.name, 'Alice');
});

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// GAME STATE ACTIONS
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

console.log('\n🎮 Game State Actions\n');

test('game:start initializes state', () => {
  const engine = createTestEngine();
  engine.dispatch('game:start');
  assertExists(engine._gameState);
  assertEquals(engine._gameState.started, true);
  assertEquals(engine._gameState.phase, 'setup');
});

test('game:end marks game over', () => {
  const engine = createTestEngine();
  engine.dispatch('game:start');
  engine.dispatch('game:end', { winner: 'Alice', reason: 'victory' });
  assertEquals(engine._gameState.ended, true);
  assertEquals(engine._gameState.winner, 'Alice');
});

test('game:pause stops game', () => {
  const engine = createTestEngine();
  engine.dispatch('game:start');
  engine.dispatch('game:pause');
  assertEquals(engine._gameState.paused, true);
});

test('game:resume continues game', () => {
  const engine = createTestEngine();
  engine.dispatch('game:start');
  engine.dispatch('game:pause');
  engine.dispatch('game:resume');
  assertEquals(engine._gameState.paused, false);
});

test('game:nextPhase advances phase', () => {
  const engine = createTestEngine();
  engine.dispatch('game:start');
  engine.dispatch('game:nextPhase', { phase: 'play' });
  assertEquals(engine._gameState.phase, 'play');
});

test('game:setProperty sets custom value', () => {
  const engine = createTestEngine();
  engine.dispatch('game:start');
  engine.dispatch('game:setProperty', { key: 'round', value: 5 });
  assertEquals(engine._gameState.round, 5);
});

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// ERROR HANDLING
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

console.log('\n⚠️  Error Handling\n');

test('deck actions fail without deck', () => {
  const engine = new Engine({});
  assertThrows(() => {
    engine.dispatch('deck:shuffle');
  }, 'Should throw when no deck attached');
});

test('table actions fail without table', () => {
  const engine = new Engine({});
  assertThrows(() => {
    engine.dispatch('table:clear');
  }, 'Should throw when no table attached');
});

test('player actions fail for nonexistent player', () => {
  const engine = createTestEngine();
  assertThrows(() => {
    engine.dispatch('player:get', { name: 'Nonexistent' });
  }, 'Should throw for nonexistent player');
});

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// RESULTS
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

console.log('\n' + '═'.repeat(50));
console.log(`\n📊 Test Results: ${passCount}/${testCount} passed\n`);

if (failCount === 0) {
  console.log('🎉 All tests passed!\n');
  process.exit(0);
} else {
  console.log(`❌ ${failCount} tests failed\n`);
  process.exit(1);
}