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
 * Test suite for Policy
 * Tests: policy validation, composition, priority, error handling
 */

import { Engine } from '../engine/Engine.js';
import { Policy } from '../engine/Policy.js';

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

console.log('\n🧪 Testing Policy\n');
console.log('═'.repeat(60));

// ============================================================================
// POLICY CREATION
// ============================================================================

console.log('\n🔒 Policy Creation Tests\n');

await test('Policy initializes correctly', () => {
  const policy = new Policy(
    'test-policy',
    (engine) => true,
    (engine) => {}
  );

  assertEquals(policy.name, 'test-policy', 'Name should match');
  assertEquals(policy.priority, 0, 'Default priority should be 0');
  assertEquals(policy.once, false, 'Default once should be false');
  assert(policy.enabled, 'Should be enabled by default');
  assertEquals(policy._hits, 0, 'Hits should start at 0');
  assertEquals(policy._fired, false, 'Fired should be false');
});

await test('Policy initializes with options', () => {
  const policy = new Policy(
    'test',
    () => true,
    () => {},
    { priority: 10, once: true, enabled: false }
  );

  assertEquals(policy.priority, 10, 'Priority should match');
  assertEquals(policy.once, true, 'Once should match');
  assertEquals(policy.enabled, false, 'Enabled should match');
});

// ============================================================================
// POLICY EVALUATION
// ============================================================================

console.log('\n✅ Policy Evaluation Tests\n');

await test('Policy evaluates condition and executes effect', () => {
  const engine = new Engine();
  let effectExecuted = false;

  const policy = new Policy(
    'test',
    (eng) => eng._agents.length > 0,
    (eng) => {
      effectExecuted = true;
    }
  );

  // Condition false - should not execute
  policy.evaluate(engine);
  assert(!effectExecuted, 'Effect should not execute when condition false');

  // Add agent - condition true
  engine._agents.push({ name: 'Alice', id: '1', resources: {} } as any);
  policy.evaluate(engine);

  assert(effectExecuted, 'Effect should execute when condition true');
});

await test('Policy tracks hit count', () => {
  const engine = new Engine();
  const policy = new Policy(
    'test',
    () => true,
    () => {}
  );

  assertEquals(policy._hits, 0, 'Should start with 0 hits');

  policy.evaluate(engine);
  assertEquals(policy._hits, 1, 'Should have 1 hit after first evaluation');

  policy.evaluate(engine);
  assertEquals(policy._hits, 2, 'Should have 2 hits after second evaluation');
});

await test('Policy with once=true fires only once', () => {
  const engine = new Engine();
  let executionCount = 0;

  const policy = new Policy(
    'test',
    () => true,
    () => {
      executionCount++;
    },
    { once: true }
  );

  policy.evaluate(engine);
  assertEquals(executionCount, 1, 'Should execute once');
  assert(policy._fired, 'Should be marked as fired');

  policy.evaluate(engine);
  assertEquals(executionCount, 1, 'Should not execute again');
});

await test('Policy reset() clears fired state', () => {
  const engine = new Engine();
  let executionCount = 0;

  const policy = new Policy(
    'test',
    () => true,
    () => {
      executionCount++;
    },
    { once: true }
  );

  policy.evaluate(engine);
  assertEquals(executionCount, 1, 'Should execute once');

  policy.reset();

  assertEquals(policy._fired, false, 'Fired should be reset');
  assertEquals(policy._hits, 0, 'Hits should be reset');

  policy.evaluate(engine);
  assertEquals(executionCount, 2, 'Should execute again after reset');
});

await test('Policy disabled does not evaluate', () => {
  const engine = new Engine();
  let executed = false;

  const policy = new Policy(
    'test',
    () => true,
    () => {
      executed = true;
    },
    { enabled: false }
  );

  const result = policy.evaluate(engine);

  assert(!executed, 'Effect should not execute when disabled');
  assertEquals(result, false, 'Evaluate should return false');
});

await test('Policy enable/disable methods work', () => {
  const engine = new Engine();
  const policy = new Policy('test', () => true, () => {});

  assert(policy.enabled, 'Should start enabled');

  policy.disable();
  assert(!policy.enabled, 'Should be disabled');

  policy.enable();
  assert(policy.enabled, 'Should be enabled again');
});

// ============================================================================
// ERROR HANDLING
// ============================================================================

console.log('\n⚠️  Error Handling Tests\n');

await test('Policy handles condition errors gracefully', () => {
  const engine = new Engine();
  let errorEmitted = false;

  engine.on('policy:error', () => {
    errorEmitted = true;
  });

  const policy = new Policy(
    'broken-condition',
    () => {
      throw new Error('Condition error');
    },
    () => {}
  );

  const result = policy.evaluate(engine);

  assert(errorEmitted, 'Error event should be emitted');
  assertEquals(result, false, 'Should return false on error');
});

await test('Policy handles effect errors gracefully', () => {
  const engine = new Engine();
  let errorEmitted = false;

  engine.on('policy:error', () => {
    errorEmitted = true;
  });

  const policy = new Policy(
    'broken-effect',
    () => true,
    () => {
      throw new Error('Effect error');
    }
  );

  policy.evaluate(engine);

  assert(errorEmitted, 'Error event should be emitted');
  assertEquals(policy._hits, 0, 'Hit should not be counted when effect throws');
});

// ============================================================================
// EVENTS
// ============================================================================

console.log('\n📡 Event Tests\n');

await test('Policy emits triggered event', () => {
  const engine = new Engine();
  let triggerEmitted = false;

  engine.on('policy:triggered', (evt) => {
    triggerEmitted = true;
    assertEquals(evt.payload.name, 'test', 'Event should include policy name');
    assertEquals(evt.payload.hits, 1, 'Event should include hit count');
  });

  const policy = new Policy('test', () => true, () => {});

  policy.evaluate(engine);

  assert(triggerEmitted, 'Triggered event should be emitted');
});

await test('Policy emits error event for condition errors', () => {
  const engine = new Engine();
  let errorData: any = null;

  engine.on('policy:error', (evt) => {
    errorData = evt.payload;
  });

  const policy = new Policy(
    'test',
    () => {
      throw new Error('Test error');
    },
    () => {}
  );

  policy.evaluate(engine);

  assert(errorData !== null, 'Error event should be emitted');
  assertEquals(errorData.payload.name, 'test', 'Error should include policy name');
});

// ============================================================================
// POLICY COMPOSITION
// ============================================================================

console.log('\n🔗 Policy Composition Tests\n');

await test('Multiple policies with different priorities', () => {
  const engine = new Engine();
  const executionOrder: string[] = [];

  const policy1 = new Policy(
    'low',
    () => true,
    () => {
      executionOrder.push('low');
    },
    { priority: 1 }
  );

  const policy2 = new Policy(
    'high',
    () => true,
    () => {
      executionOrder.push('high');
    },
    { priority: 10 }
  );

  const policy3 = new Policy(
    'medium',
    () => true,
    () => {
      executionOrder.push('medium');
    },
    { priority: 5 }
  );

  // Manually evaluate in priority order
  [policy2, policy3, policy1].forEach(p => p.evaluate(engine));

  assertEquals(executionOrder[0], 'high', 'High priority should execute first');
  assertEquals(executionOrder[1], 'medium', 'Medium priority should execute second');
  assertEquals(executionOrder[2], 'low', 'Low priority should execute last');
});

await test('Policy conditions can depend on game state', () => {
  const engine = new Engine();
  engine._gameState = { score: 0 };

  const scorePolicy = new Policy(
    'win-check',
    (eng) => (eng._gameState.score || 0) >= 100,
    (eng) => {
      eng._gameState.winner = 'Player';
    }
  );

  // Score too low
  scorePolicy.evaluate(engine);
  assert(!engine._gameState.winner, 'Should not trigger yet');

  // Increase score
  engine._gameState.score = 100;
  scorePolicy.evaluate(engine);

  assertEquals(engine._gameState.winner, 'Player', 'Should trigger at 100');
});

await test('Policy effects can modify engine state', () => {
  const engine = new Engine();
  engine._gameState = { round: 1 };

  const roundPolicy = new Policy(
    'advance-round',
    (eng) => eng._agents.length >= 2,
    (eng) => {
      eng._gameState.round++;
    }
  );

  assertEquals(engine._gameState.round, 1, 'Should start at round 1');

  // Not enough agents
  roundPolicy.evaluate(engine);
  assertEquals(engine._gameState.round, 1, 'Round should not advance');

  // Add agents
  engine._agents.push({ name: 'Alice' } as any, { name: 'Bob' } as any);
  roundPolicy.evaluate(engine);

  assertEquals(engine._gameState.round, 2, 'Round should advance');
});

// ============================================================================
// COMPLEX SCENARIOS
// ============================================================================

console.log('\n🎯 Complex Scenario Tests\n');

await test('Game end policy with multiple conditions', () => {
  const engine = new Engine();
  engine._gameState = { turns: 0, maxTurns: 10 };
  engine._agents.push({ name: 'Alice', resources: { score: 0 } } as any);

  const gameEndPolicy = new Policy(
    'game-end',
    (eng) => {
      const state = eng._gameState;
      const maxScore = Math.max(...eng._agents.map(a => a.resources?.score || 0));

      return state.turns >= state.maxTurns || maxScore >= 100;
    },
    (eng) => {
      eng._gameState.ended = true;
    },
    { once: true }
  );

  // Game just started
  gameEndPolicy.evaluate(engine);
  assert(!engine._gameState.ended, 'Game should not end yet');

  // Max turns reached
  engine._gameState.turns = 10;
  gameEndPolicy.evaluate(engine);

  assert(engine._gameState.ended === true, 'Game should end at max turns');
});

await test('Resource management policy', () => {
  const engine = new Engine();
  engine._agents.push(
    { name: 'Alice', resources: { gold: 50 } } as any,
    { name: 'Bob', resources: { gold: 30 } } as any
  );

  const taxPolicy = new Policy(
    'tax-collection',
    (eng) => (eng._gameState.turn ?? 0) % 5 === 0,
    (eng) => {
      eng._agents.forEach((agent: any) => {
        const tax = Math.floor((agent.resources.gold || 0) * 0.1);
        agent.resources.gold = (agent.resources.gold || 0) - tax;
        engine._gameState.treasury = (engine._gameState.treasury || 0) + tax;
      });
    }
  );

  engine._gameState = { turn: 5, treasury: 0 };
  taxPolicy.evaluate(engine);

  assertEquals(engine._agents[0].resources.gold, 45, 'Alice should pay 5 gold tax');
  assertEquals(engine._agents[1].resources.gold, 27, 'Bob should pay 3 gold tax');
  assertEquals(engine._gameState.treasury, 8, 'Treasury should collect 8 gold');
});

// ============================================================================
// SERIALIZATION
// ============================================================================

console.log('\n💾 Serialization Tests\n');

await test('Policy toJSON() exports state', () => {
  const policy = new Policy(
    'test-policy',
    () => true,
    () => {},
    { priority: 5, once: true }
  );

  policy._hits = 3;
  policy._fired = true;

  const json = policy.toJSON();

  assertEquals(json.name, 'test-policy', 'Name should match');
  assertEquals(json.priority, 5, 'Priority should match');
  assertEquals(json.once, true, 'Once should match');
  assertEquals(json.enabled, true, 'Enabled should match');
  assertEquals(json.hits, 3, 'Hits should match');
  assertEquals(json.fired, true, 'Fired should match');
});

// ============================================================================
// RESULTS
// ============================================================================

console.log('\n' + '═'.repeat(60));
console.log(`\n📊 Test Results: ${passCount}/${testCount} passed\n`);

if (failCount === 0) {
  console.log('🎉 All Policy tests passed!\n');
  process.exit(0);
} else {
  console.log(`❌ ${failCount} tests failed\n`);
  process.exit(1);
}
