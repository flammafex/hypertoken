#!/usr/bin/env node
/*
 * Copyright 2025 The Carpocratian Church of Commonality and Equality, Inc.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

/**
 * Test suite for Agent
 * Tests: agent behaviors, inventory management, turn handling, AI integration
 */

import { Engine } from '../engine/Engine.js';
import { Agent } from '../engine/Agent.js';
import { Token } from '../core/Token.js';
import { Stack } from '../core/Stack.js';
import { Space } from '../core/Space.js';
import { Chronicle } from '../core/Chronicle.js';

// Test helpers
let testCount = 0;
let passCount = 0;
let failCount = 0;

function test(name: string, fn: () => void | Promise<void>) {
  testCount++;
  return (async () => {
    try {
      await fn();
      passCount++;
      console.log(`✓ ${name}`);
    } catch (err: any) {
      failCount++;
      console.error(`✗ ${name}`);
      console.error(`  ${err.message}`);
    }
  })();
}

function assert(condition: boolean, message: string) {
  if (!condition) {
    throw new Error(message || 'Assertion failed');
  }
}

function assertEquals(actual: any, expected: any, message?: string) {
  if (actual !== expected) {
    throw new Error(message || `Expected ${expected}, got ${actual}`);
  }
}

console.log('\n🧪 Testing Agent\n');
console.log('═'.repeat(60));

// ============================================================================
// INITIALIZATION
// ============================================================================

console.log('\n🤖 Agent Initialization Tests\n');

await test('Agent initializes with name', () => {
  const agent = new Agent('Alice');

  assertEquals(agent.name, 'Alice', 'Name should match');
  assert(agent.id.length > 0, 'Should have an ID');
  assert(agent.active, 'Should be active by default');
  assertEquals(agent.turns, 0, 'Should start with 0 turns');
});

await test('Agent initializes with stack from token array', () => {
  const tokens = [
    new Token({ id: '1', label: 'Card 1' }),
    new Token({ id: '2', label: 'Card 2' })
  ];

  const agent = new Agent('Alice', { stack: tokens });

  assert(agent.stack !== null, 'Should have a stack');
  assertEquals(agent.stack?.size, 2, 'Stack should have 2 tokens');
});

await test('Agent initializes with existing stack', () => {
  const session = new Chronicle();
  const tokens = [new Token({ id: '1', label: 'Card 1' })];
  const stack = new Stack(session, tokens);

  const agent = new Agent('Alice', { stack });

  assert(agent.stack === stack, 'Should use provided stack');
});

await test('Agent initializes with space', () => {
  const session = new Chronicle();
  const space = new Space(session);

  const agent = new Agent('Alice', { space });

  assert(agent.space === space, 'Should use provided space');
});

await test('Agent initializes with meta data', () => {
  const meta = { level: 5, class: 'warrior' };
  const agent = new Agent('Alice', { meta });

  assertEquals(agent.meta.level, 5, 'Should have meta data');
  assertEquals(agent.meta.class, 'warrior', 'Meta properties should match');
});

// ============================================================================
// INVENTORY MANAGEMENT
// ============================================================================

console.log('\n📦 Inventory Management Tests\n');

await test('Agent draw() adds cards to inventory', () => {
  const session = new Chronicle();
  const tokens = [
    new Token({ id: '1', label: 'Card 1' }),
    new Token({ id: '2', label: 'Card 2' }),
    new Token({ id: '3', label: 'Card 3' })
  ];
  const stack = new Stack(session, tokens);

  const agent = new Agent('Alice', { stack });

  const drawn = agent.draw(2);

  assertEquals(drawn.length, 2, 'Should draw 2 cards');
  assertEquals(agent.inventory.length, 2, 'Inventory should have 2 cards');
  assertEquals(agent.stack?.size, 1, 'Stack should have 1 card remaining');
});

await test('Agent draw() with no stack returns empty array', () => {
  const agent = new Agent('Alice');

  const drawn = agent.draw(5);

  assertEquals(drawn.length, 0, 'Should return empty array');
  assertEquals(agent.inventory.length, 0, 'Inventory should be empty');
});

await test('Agent discardFromHand() with predicate', () => {
  const agent = new Agent('Alice');

  const card1 = new Token({ id: '1', label: 'Red Card', meta: { color: 'red' } });
  const card2 = new Token({ id: '2', label: 'Blue Card', meta: { color: 'blue' } });
  const card3 = new Token({ id: '3', label: 'Red Card 2', meta: { color: 'red' } });

  agent.inventory.push(card1, card2, card3);

  const discarded = agent.discardFromHand(t => t.meta.color === 'red');

  assertEquals(discarded.length, 2, 'Should discard 2 red cards');
  assertEquals(agent.inventory.length, 1, 'Should keep 1 card in hand');
  assertEquals(agent.discard.length, 2, 'Discard pile should have 2 cards');
  assertEquals(agent.inventory[0].meta.color, 'blue', 'Should keep blue card');
});

await test('Agent discardFromHand() with no predicate discards all', () => {
  const agent = new Agent('Alice');

  agent.inventory.push(
    new Token({ id: '1', label: 'Card 1' }),
    new Token({ id: '2', label: 'Card 2' })
  );

  const discarded = agent.discardFromHand();

  assertEquals(discarded.length, 2, 'Should discard all cards');
  assertEquals(agent.inventory.length, 0, 'Inventory should be empty');
  assertEquals(agent.discard.length, 2, 'Discard should have all cards');
});

await test('Agent playCard() moves card to space', () => {
  const session = new Chronicle();
  const space = new Space(session);
  const agent = new Agent('Alice', { space });

  const card = new Token({ id: '1', label: 'Ace of Spades' });
  agent.inventory.push(card);

  const played = agent.playCard(card, 'field');

  assertEquals(played, card, 'Should return played card');
  assertEquals(agent.inventory.length, 0, 'Card should be removed from hand');
  assertEquals(space.zoneCount('field'), 1, 'Card should be in space');
});

await test('Agent playCard() returns null if card not in hand', () => {
  const session = new Chronicle();
  const space = new Space(session);
  const agent = new Agent('Alice', { space });

  const card = new Token({ id: '1', label: 'Card' });

  const played = agent.playCard(card, 'field');

  assertEquals(played, null, 'Should return null');
  assertEquals(space.zoneCount('field'), 0, 'Nothing should be placed');
});

// ============================================================================
// TURN MANAGEMENT
// ============================================================================

console.log('\n🔄 Turn Management Tests\n');

await test('Agent beginTurn() increments turn counter', () => {
  const engine = new Engine();
  const agent = new Agent('Alice');

  assertEquals(agent.turns, 0, 'Should start at 0 turns');

  agent.beginTurn(engine);

  assertEquals(agent.turns, 1, 'Should be at turn 1');

  agent.beginTurn(engine);

  assertEquals(agent.turns, 2, 'Should be at turn 2');
});

await test('Agent beginTurn() emits events', () => {
  const engine = new Engine();
  const agent = new Agent('Alice');

  let agentEventEmitted = false;
  let engineEventEmitted = false;

  agent.on('agent:beginTurn', () => {
    agentEventEmitted = true;
  });

  engine.on('loop:turn:start', () => {
    engineEventEmitted = true;
  });

  agent.beginTurn(engine);

  assert(agentEventEmitted, 'Agent event should be emitted');
  assert(engineEventEmitted, 'Engine event should be emitted');
});

await test('Agent endTurn() emits events', () => {
  const engine = new Engine();
  const agent = new Agent('Alice');

  let agentEventEmitted = false;
  let engineEventEmitted = false;

  agent.on('agent:endTurn', () => {
    agentEventEmitted = true;
  });

  engine.on('loop:turn:end', () => {
    engineEventEmitted = true;
  });

  agent.endTurn(engine);

  assert(agentEventEmitted, 'Agent event should be emitted');
  assert(engineEventEmitted, 'Engine event should be emitted');
});

await test('Agent reset() clears state', () => {
  const agent = new Agent('Alice');

  agent.inventory.push(new Token({ id: '1', label: 'Card' }));
  agent.discard.push(new Token({ id: '2', label: 'Card' }));
  agent.turns = 5;
  agent.active = false;

  agent.reset();

  assertEquals(agent.inventory.length, 0, 'Inventory should be cleared');
  assertEquals(agent.discard.length, 0, 'Discard should be cleared');
  assertEquals(agent.turns, 0, 'Turns should be reset');
  assert(agent.active, 'Should be active again');
});

// ============================================================================
// STACK OPERATIONS
// ============================================================================

console.log('\n🎴 Stack Operations Tests\n');

await test('Agent shuffleStack() shuffles deck', () => {
  const session = new Chronicle();
  const tokens = [
    new Token({ id: '1', label: 'Card 1' }),
    new Token({ id: '2', label: 'Card 2' }),
    new Token({ id: '3', label: 'Card 3' })
  ];
  const stack = new Stack(session, tokens);

  const agent = new Agent('Alice', { stack });

  agent.shuffleStack(12345);

  // Stack should still have same size
  assertEquals(agent.stack?.size, 3, 'Stack size should remain same');
});

await test('Agent shuffleStack() with no stack returns self', () => {
  const agent = new Agent('Alice');

  const result = agent.shuffleStack();

  assertEquals(result, agent, 'Should return self for chaining');
});

// ============================================================================
// AI AGENT INTEGRATION
// ============================================================================

console.log('\n🧠 AI Agent Integration Tests\n');

await test('Agent think() executes AI agent logic', async () => {
  const engine = new Engine();
  let thinkCalled = false;

  const aiAgent = {
    think: async (eng: Engine, agent: Agent) => {
      thinkCalled = true;
      assertEquals(agent.name, 'Alice', 'Should pass agent reference');
      return { type: 'test:action', payload: { from: 'AI' } };
    }
  };

  const agent = new Agent('Alice', { agent: aiAgent });

  await agent.think(engine);

  assert(thinkCalled, 'AI think should be called');
  assertEquals(engine.history.length, 1, 'Should dispatch action');
  assertEquals(engine.history[0].type, 'test:action', 'Action type should match');
});

await test('Agent think() with no AI agent does nothing', async () => {
  const engine = new Engine();
  const agent = new Agent('Alice');

  await agent.think(engine);

  assertEquals(engine.history.length, 0, 'Should not dispatch any actions');
});

await test('Agent think() handles Script return value', async () => {
  const engine = new Engine();

  const aiAgent = {
    think: async () => {
      return {
        run: async (eng: Engine) => {
          eng.dispatch('action1', {});
          eng.dispatch('action2', {});
        }
      };
    }
  };

  const agent = new Agent('Alice', { agent: aiAgent });

  await agent.think(engine);

  assertEquals(engine.history.length, 2, 'Should execute script');
});

await test('Agent think() emits decision event', async () => {
  const engine = new Engine();
  let decisionEmitted = false;

  const aiAgent = {
    think: async () => ({ type: 'test', payload: {} })
  };

  const agent = new Agent('Alice', { agent: aiAgent });

  agent.on('agent:decision', () => {
    decisionEmitted = true;
  });

  await agent.think(engine);

  assert(decisionEmitted, 'Decision event should be emitted');
});

await test('Agent think() handles errors gracefully', async () => {
  const engine = new Engine();
  let errorEmitted = false;

  const aiAgent = {
    think: async () => {
      throw new Error('AI error');
    }
  };

  const agent = new Agent('Alice', { agent: aiAgent });

  agent.on('agent:error', () => {
    errorEmitted = true;
  });

  await agent.think(engine);

  assert(errorEmitted, 'Error event should be emitted');
});

// ============================================================================
// SERIALIZATION
// ============================================================================

console.log('\n💾 Serialization Tests\n');

await test('Agent snapshot() captures state', () => {
  const agent = new Agent('Alice', { meta: { level: 5 } });

  agent.inventory.push(new Token({ id: '1', label: 'Card 1' }));
  agent.discard.push(new Token({ id: '2', label: 'Card 2' }));
  agent.turns = 3;

  const snapshot = agent.snapshot();

  assertEquals(snapshot.name, 'Alice', 'Name should match');
  assertEquals(snapshot.inventory.length, 1, 'Inventory size should match');
  assertEquals(snapshot.discard.length, 1, 'Discard size should match');
  assertEquals(snapshot.turns, 3, 'Turns should match');
  assertEquals(snapshot.meta.level, 5, 'Meta should match');
});

await test('Agent fromJSON() restores state', () => {
  const data = {
    name: 'Bob',
    id: 'custom-id',
    inventory: [{ id: '1', label: 'Card' }],
    discard: [{ id: '2', label: 'Card' }],
    turns: 5,
    active: false,
    meta: { class: 'mage' }
  };

  const agent = Agent.fromJSON(data);

  assertEquals(agent.name, 'Bob', 'Name should match');
  assertEquals(agent.id, 'custom-id', 'ID should match');
  assertEquals(agent.inventory.length, 1, 'Inventory should be restored');
  assertEquals(agent.discard.length, 1, 'Discard should be restored');
  assertEquals(agent.turns, 5, 'Turns should match');
  assertEquals(agent.active, false, 'Active state should match');
  assertEquals(agent.meta.class, 'mage', 'Meta should match');
});

await test('Agent serialization round-trip', () => {
  const original = new Agent('Alice', { meta: { level: 10 } });
  original.inventory.push(new Token({ id: '1', label: 'Card' }));
  original.turns = 7;

  const json = original.toJSON();
  const restored = Agent.fromJSON(json);

  assertEquals(restored.name, original.name, 'Name should match');
  assertEquals(restored.turns, original.turns, 'Turns should match');
  assertEquals(restored.inventory.length, original.inventory.length, 'Inventory size should match');
});

// ============================================================================
// EVENTS
// ============================================================================

console.log('\n📡 Event Tests\n');

await test('Agent emits draw event', () => {
  const session = new Chronicle();
  const tokens = [new Token({ id: '1', label: 'Card' })];
  const stack = new Stack(session, tokens);
  const agent = new Agent('Alice', { stack });

  let drawEventEmitted = false;

  agent.on('agent:draw', (evt) => {
    drawEventEmitted = true;
    assertEquals(evt.payload.payload.count, 1, 'Event should include count');
  });

  agent.draw(1);

  assert(drawEventEmitted, 'Draw event should be emitted');
});

await test('Agent emits discard event', () => {
  const agent = new Agent('Alice');
  agent.inventory.push(new Token({ id: '1', label: 'Card' }));

  let discardEventEmitted = false;

  agent.on('agent:discard', () => {
    discardEventEmitted = true;
  });

  agent.discardFromHand();

  assert(discardEventEmitted, 'Discard event should be emitted');
});

await test('Agent emits playCard event', () => {
  const session = new Chronicle();
  const space = new Space(session);
  const agent = new Agent('Alice', { space });

  const card = new Token({ id: '1', label: 'Card' });
  agent.inventory.push(card);

  let playEventEmitted = false;

  agent.on('agent:playCard', (evt) => {
    playEventEmitted = true;
    assertEquals(evt.payload.payload.zone, 'field', 'Event should include zone');
  });

  agent.playCard(card, 'field');

  assert(playEventEmitted, 'PlayCard event should be emitted');
});

await test('Agent emits reset event', () => {
  const agent = new Agent('Alice');

  let resetEventEmitted = false;

  agent.on('agent:reset', () => {
    resetEventEmitted = true;
  });

  agent.reset();

  assert(resetEventEmitted, 'Reset event should be emitted');
});

// ============================================================================
// RESULTS
// ============================================================================

console.log('\n' + '═'.repeat(60));
console.log(`\n📊 Test Results: ${passCount}/${testCount} passed\n`);

if (failCount === 0) {
  console.log('🎉 All Agent tests passed!\n');
  process.exit(0);
} else {
  console.log(`❌ ${failCount} tests failed\n`);
  process.exit(1);
}
