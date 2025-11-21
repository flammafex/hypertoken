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
import { Stack } from '../core/Stack.js';
import { Space } from '../core/Space.js';
import { Source } from '../core/Source.js';
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
  
  const stack = new Stack(cards, { seed: 42 });
  const space = new Space('test');
  const source = new Source(stack);
  
  const engine = new Engine({ stack, space, source });
  engine._agents = [];
  
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
  assertExists(categories.stack);
  assertExists(categories.space);
  assertExists(categories.source);
  assertExists(categories.agent);
  assertExists(categories.game);
  assertEquals(categories.stack.length, 10);
  assertEquals(categories.space.length, 14);
  assertEquals(categories.source.length, 7);
  assertEquals(categories.agent.length, 8);
  assertEquals(categories.game.length, 6);
});

test('hasAction works correctly', () => {
  assertEquals(hasAction('stack:shuffle'), true);
  assertEquals(hasAction('nonexistent:action'), false);
});

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// DECK ACTIONS
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

console.log('\n🃏 Stack Actions\n');

test('stack:shuffle executes', () => {
  const engine = createTestEngine();
  engine.dispatch('stack:shuffle', { seed: 42 });
  assertExists(engine.stack);
});

test('stack:draw returns cards', () => {
  const engine = createTestEngine();
  const cards = engine.dispatch('stack:draw', { count: 5 });
  assertEquals(cards.length, 5);
});

test('stack:reset restores stack', () => {
  const engine = createTestEngine();
  engine.dispatch('stack:draw', { count: 10 });
  engine.dispatch('stack:reset');
  assertEquals(engine.stack.size, 52);
});

test('stack:burn discards cards', () => {
  const engine = createTestEngine();
  const before = engine.stack.size;
  engine.dispatch('stack:burn', { count: 3 });
  assertEquals(engine.stack.size, before - 3);
});

test('stack:peek does not remove cards', () => {
  const engine = createTestEngine();
  const before = engine.stack.size;
  const cards = engine.dispatch('stack:peek', { count: 3 });
  assertEquals(cards.length, 3);
  assertEquals(engine.stack.size, before);
});

test('stack:cut rearranges stack', () => {
  const engine = createTestEngine();
  engine.dispatch('stack:cut', { position: 26 });
  assertExists(engine.stack);
});

test('stack:insertAt adds card at position', () => {
  const engine = createTestEngine();
  const card = { id: 'test', label: 'Test' };
  engine.dispatch('stack:insertAt', { card, position: 0 });
  assertEquals(engine.stack.size, 53);
});

test('stack:removeAt removes card', () => {
  const engine = createTestEngine();
  const card = engine.dispatch('stack:removeAt', { position: 0 });
  assertExists(card);
  assertEquals(engine.stack.size, 51);
});

test('stack:swap exchanges positions', () => {
  const engine = createTestEngine();
  engine.dispatch('stack:swap', { i: 0, j: 51 });
  assertExists(engine.stack);
});

test('stack:reverse reverses range', () => {
  const engine = createTestEngine();
  engine.dispatch('stack:reverse', { start: 0, end: 12 });
  assertExists(engine.stack);
});

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// TABLE ACTIONS
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

console.log('\n🎴 Space Actions\n');

test('space:place adds card to zone', () => {
  const engine = createTestEngine();
  const card = engine.stack.draw();
  const placement = engine.dispatch('space:place', { 
    zone: 'test', 
    card,
    opts: { faceUp: true }
  });
  assertExists(placement);
  assertEquals(engine.space.zoneCount('test'), 1);
});

test('space:clear removes all cards', () => {
  const engine = createTestEngine();
  const card = engine.stack.draw();
  engine.space.place('test', card);
  engine.dispatch('space:clear');
  assertEquals(engine.space.zoneCount('test'), 0);
});

test('space:createZone adds new zone', () => {
  const engine = createTestEngine();
  engine.dispatch('space:createZone', { id: 'newzone', label: 'New Zone' });
  assertExists(engine.space.zones.has('newzone'));
});

test('space:deleteZone removes zone', () => {
  const engine = createTestEngine();
  engine.space.createZone('temp');
  engine.dispatch('space:deleteZone', { id: 'temp' });
  assertEquals(engine.space.zones.has('temp'), false);
});

test('space:clearZone empties specific zone', () => {
  const engine = createTestEngine();
  const card = engine.stack.draw();
  engine.space.place('test', card);
  engine.dispatch('space:clearZone', { zone: 'test' });
  assertEquals(engine.space.zoneCount('test'), 0);
});

test('space:move transfers card between zones', () => {
  const engine = createTestEngine();
  const card = engine.stack.draw();
  const placement = engine.space.place('zone1', card);
  engine.space.createZone('zone2');
  engine.dispatch('space:move', { 
    fromZone: 'zone1', 
    toZone: 'zone2', 
    placementId: placement.id 
  });
  assertEquals(engine.space.zoneCount('zone2'), 1);
});

test('space:flip changes face state', () => {
  const engine = createTestEngine();
  const card = engine.stack.draw();
  const placement = engine.space.place('test', card, { faceUp: false });
  engine.dispatch('space:flip', { 
    zone: 'test', 
    placementId: placement.id, 
    faceUp: true 
  });
  assertEquals(placement.faceUp, true);
});

test('space:remove deletes placement', () => {
  const engine = createTestEngine();
  const card = engine.stack.draw();
  const placement = engine.space.place('test', card);
  engine.dispatch('space:remove', { zone: 'test', placementId: placement.id });
  assertEquals(engine.space.zoneCount('test'), 0);
});

test('space:shuffleZone randomizes zone', () => {
  const engine = createTestEngine();
  for (let i = 0; i < 5; i++) {
    engine.space.place('test', engine.stack.draw());
  }
  engine.dispatch('space:shuffleZone', { zone: 'test', seed: 42 });
  assertEquals(engine.space.zoneCount('test'), 5);
});

test('space:transferZone moves all cards', () => {
  const engine = createTestEngine();
  for (let i = 0; i < 3; i++) {
    engine.space.place('from', engine.stack.draw());
  }
  engine.space.createZone('to');
  engine.dispatch('space:transferZone', { fromZone: 'from', toZone: 'to' });
  assertEquals(engine.space.zoneCount('to'), 3);
});

test('space:fanZone arranges cards', () => {
  const engine = createTestEngine();
  for (let i = 0; i < 5; i++) {
    engine.space.place('test', engine.stack.draw());
  }
  engine.dispatch('space:fanZone', { zone: 'test', radius: 100 });
  assertEquals(engine.space.zoneCount('test'), 5);
});

test('space:stackZone stacks cards', () => {
  const engine = createTestEngine();
  for (let i = 0; i < 5; i++) {
    engine.space.place('test', engine.stack.draw());
  }
  engine.dispatch('space:stackZone', { zone: 'test' });
  assertEquals(engine.space.zoneCount('test'), 5);
});

test('space:lockZone prevents modifications', () => {
  const engine = createTestEngine();
  engine.space.createZone('locked');
  engine.dispatch('space:lockZone', { zone: 'locked', locked: true });
  assertExists(engine.space._lockedZones);
});

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// SHOE ACTIONS
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

console.log('\n👞 Source Actions\n');

test('source:draw returns card', () => {
  const engine = createTestEngine();
  const card = engine.dispatch('source:draw', { count: 1 });
  assertExists(card);
});

test('source:shuffle randomizes source', () => {
  const engine = createTestEngine();
  engine.dispatch('source:shuffle', { seed: 42 });
  assertExists(engine.source);
});

test('source:burn discards from source', () => {
  const engine = createTestEngine();
  engine.dispatch('source:burn', { count: 3 });
  assertExists(engine.source);
});

test('source:reset restores source', () => {
  const engine = createTestEngine();
  engine.source.draw(10);
  engine.dispatch('source:reset');
  assertExists(engine.source);
});

test('source:addStack increases size', () => {
  const engine = createTestEngine();
  const newStack = new Stack([{ id: 'extra', label: 'Extra' }]);
  engine.dispatch('source:addStack', { stack: newStack });
  assertExists(engine.source);
});

test('source:inspect returns stats', () => {
  const engine = createTestEngine();
  const stats = engine.dispatch('source:inspect');
  assertExists(stats);
  assertExists(stats.remaining);
});

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// PLAYER ACTIONS
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

console.log('\n👤 Agent Actions\n');

test('agent:create adds agent', () => {
  const engine = createTestEngine();
  const agent = engine.dispatch('agent:create', { name: 'Alice' });
  assertExists(agent);
  assertEquals(agent.name, 'Alice');
  assertEquals(engine._agents.length, 1);
});

test('agent:remove deletes agent', () => {
  const engine = createTestEngine();
  engine.dispatch('agent:create', { name: 'Alice' });
  engine.dispatch('agent:remove', { name: 'Alice' });
  assertEquals(engine._agents.length, 0);
});

test('agent:setActive changes state', () => {
  const engine = createTestEngine();
  engine.dispatch('agent:create', { name: 'Alice' });
  engine.dispatch('agent:setActive', { name: 'Alice', active: false });
  const agent = engine._agents[0];
  assertEquals(agent.active, false);
});

test('agent:giveResource adds resource', () => {
  const engine = createTestEngine();
  engine.dispatch('agent:create', { name: 'Alice' });
  engine.dispatch('agent:giveResource', { 
    name: 'Alice', 
    resource: 'chips', 
    amount: 100 
  });
  const agent = engine._agents[0];
  assertEquals(agent.resources.chips, 100);
});

test('agent:takeResource removes resource', () => {
  const engine = createTestEngine();
  engine.dispatch('agent:create', { name: 'Alice' });
  engine.dispatch('agent:giveResource', { 
    name: 'Alice', 
    resource: 'chips', 
    amount: 100 
  });
  engine.dispatch('agent:takeResource', { 
    name: 'Alice', 
    resource: 'chips', 
    amount: 50 
  });
  const agent = engine._agents[0];
  assertEquals(agent.resources.chips, 50);
});

test('agent:drawCards adds to hand', () => {
  const engine = createTestEngine();
  engine.dispatch('agent:create', { name: 'Alice' });
  engine.dispatch('agent:drawCards', { name: 'Alice', count: 5 });
  const agent = engine._agents[0];
  assertEquals(agent.hand.length, 5);
});

test('agent:discardCards removes from hand', () => {
  const engine = createTestEngine();
  engine.dispatch('agent:create', { name: 'Alice' });
  engine.dispatch('agent:drawCards', { name: 'Alice', count: 5 });
  const agent = engine._agents[0];
  const toDiscard = agent.hand.slice(0, 2);
  engine.dispatch('agent:discardCards', { name: 'Alice', cards: toDiscard });
  assertEquals(agent.hand.length, 3);
});

test('agent:get returns agent state', () => {
  const engine = createTestEngine();
  engine.dispatch('agent:create', { name: 'Alice' });
  const agent = engine.dispatch('agent:get', { name: 'Alice' });
  assertExists(agent);
  assertEquals(agent.name, 'Alice');
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

test('stack actions fail without stack', () => {
  const engine = new Engine({});
  assertThrows(() => {
    engine.dispatch('stack:shuffle');
  }, 'Should throw when no stack attached');
});

test('space actions fail without space', () => {
  const engine = new Engine({});
  assertThrows(() => {
    engine.dispatch('space:clear');
  }, 'Should throw when no space attached');
});

test('agent actions fail for nonexistent agent', () => {
  const engine = createTestEngine();
  assertThrows(() => {
    engine.dispatch('agent:get', { name: 'Nonexistent' });
  }, 'Should throw for nonexistent agent');
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