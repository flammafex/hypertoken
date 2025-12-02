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
 * Test suite for Script
 * Tests: script execution, serialization, abort handling
 */

import { Engine } from '../engine/Engine.js';
import { Script } from '../engine/Script.js';

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

console.log('\n🧪 Testing Script\n');
console.log('═'.repeat(60));

// ============================================================================
// BASIC SCRIPT OPERATIONS
// ============================================================================

console.log('\n📜 Basic Script Tests\n');

await test('Script initializes correctly', () => {
  const script = new Script('test-script');

  assertEquals(script.name, 'test-script', 'Name should match');
  assertEquals(script.steps.length, 0, 'Should start with no steps');
  assertEquals(script.running, false, 'Should not be running');
  assertEquals(script.index, 0, 'Index should be 0');
});

await test('Script initializes with steps', () => {
  const steps = [
    { type: 'action1', payload: {} },
    { type: 'action2', payload: {} }
  ];
  const script = new Script('test', steps);

  assertEquals(script.steps.length, 2, 'Should have 2 steps');
  assertEquals(script.steps[0].type, 'action1', 'First step should match');
});

await test('Script add() appends steps', () => {
  const script = new Script('test');

  script.add({ type: 'step1', payload: { value: 1 } });
  script.add({ type: 'step2', payload: { value: 2 } });

  assertEquals(script.steps.length, 2, 'Should have 2 steps');
  assertEquals(script.steps[1].payload.value, 2, 'Second step payload should match');
});

await test('Script clear() removes all steps', () => {
  const script = new Script('test');

  script.add({ type: 'step1', payload: {} });
  script.add({ type: 'step2', payload: {} });

  assertEquals(script.steps.length, 2, 'Should have 2 steps before clear');

  script.clear();

  assertEquals(script.steps.length, 0, 'Should have 0 steps after clear');
  assertEquals(script.index, 0, 'Index should be reset');
});

// ============================================================================
// SCRIPT EXECUTION
// ============================================================================

console.log('\n▶️  Script Execution Tests\n');

await test('Script executes all steps', async () => {
  const engine = new Engine();
  const script = new Script('setup-game');

  script.add({ type: 'game:start', payload: {} });
  script.add({ type: 'agent:create', payload: { name: 'Alice' } });
  script.add({ type: 'agent:create', payload: { name: 'Bob' } });

  await script.run(engine);

  assert(engine._gameState.started === true, 'Game should be started');
  assertEquals(engine._agents.length, 2, 'Should have 2 agents');
  assertEquals(engine._agents[0].name, 'Alice', 'First agent should be Alice');
});

await test('Script executes with delays', async () => {
  const engine = new Engine();
  const script = new Script('delayed-script');

  script.add({ type: 'test:action', payload: { id: 1 }, delay: 50 });
  script.add({ type: 'test:action', payload: { id: 2 }, delay: 50 });

  const startTime = Date.now();
  await script.run(engine);
  const elapsed = Date.now() - startTime;

  assert(elapsed >= 100, `Script should take at least 100ms, took ${elapsed}ms`);
});

await test('Script running state management', async () => {
  const engine = new Engine();
  const script = new Script('test');

  script.add({ type: 'test:action', payload: {} });

  assert(!script.running, 'Should not be running initially');

  const runPromise = script.run(engine);

  // Note: running state is set immediately but cleared after await
  await runPromise;

  assert(!script.running, 'Should not be running after completion');
});

await test('Script does not run if already running', async () => {
  const engine = new Engine();
  const script = new Script('test');

  script.add({ type: 'test:action', payload: { id: 1 }, delay: 100 });

  const run1 = script.run(engine);
  const run2 = script.run(engine); // Should return immediately

  await run1;
  await run2;

  // If both ran, we'd have 2 actions dispatched
  // But since second call returns early, we should only have 1
  assertEquals(engine.history.length, 1, 'Should only execute once');
});

// ============================================================================
// ABORT SIGNAL
// ============================================================================

console.log('\n🛑 Abort Signal Tests\n');

await test('Script respects AbortSignal', async () => {
  const engine = new Engine();
  const script = new Script('abortable');

  script.add({ type: 'test:action', payload: { id: 1 } });
  script.add({ type: 'test:action', payload: { id: 2 }, delay: 50 });
  script.add({ type: 'test:action', payload: { id: 3 } });

  const controller = new AbortController();

  // Abort after first action
  setTimeout(() => controller.abort(), 10);

  await script.run(engine, { signal: controller.signal });

  // Should have executed first action, but aborted before third
  assert(engine.history.length < 3, 'Should not execute all actions');
});

await test('Script aborts between steps', async () => {
  const engine = new Engine();
  const script = new Script('test');

  script.add({ type: 'step1', payload: {} });
  script.add({ type: 'step2', payload: {}, delay: 100 });
  script.add({ type: 'step3', payload: {} });

  const controller = new AbortController();

  setTimeout(() => controller.abort(), 50);

  await script.run(engine, { signal: controller.signal });

  // Should execute step1, step2 (aborted during delay), but not step3
  assert(engine.history.length >= 1 && engine.history.length <= 2, 'Should execute 1-2 steps before abort');
});

// ============================================================================
// SERIALIZATION
// ============================================================================

console.log('\n💾 Serialization Tests\n');

await test('Script toJSON() exports correctly', () => {
  const script = new Script('my-script');

  script.add({ type: 'action1', payload: { value: 1 } });
  script.add({ type: 'action2', payload: { value: 2 }, delay: 100 });

  const json = script.toJSON();

  assertEquals(json.name, 'my-script', 'Name should match');
  assertEquals(json.steps.length, 2, 'Should have 2 steps');
  assertEquals(json.steps[1].delay, 100, 'Delay should be preserved');
});

await test('Script fromJSON() imports correctly', () => {
  const jsonData = {
    name: 'imported-script',
    steps: [
      { type: 'action1', payload: { value: 1 } },
      { type: 'action2', payload: { value: 2 } }
    ]
  };

  const script = Script.fromJSON(jsonData);

  assertEquals(script.name, 'imported-script', 'Name should match');
  assertEquals(script.steps.length, 2, 'Should have 2 steps');
  assertEquals(script.running, false, 'Runtime state should be reset');
  assertEquals(script.index, 0, 'Index should be reset');
});

await test('Script fromJSON() handles missing data', () => {
  const script = Script.fromJSON({});

  assertEquals(script.name, 'script', 'Should use default name');
  assertEquals(script.steps.length, 0, 'Should have no steps');
});

await test('Script serialization round-trip', () => {
  const original = new Script('test-script');
  original.add({ type: 'action1', payload: { data: 'test' } });
  original.add({ type: 'action2', payload: { value: 42 }, delay: 50 });

  const json = original.toJSON();
  const restored = Script.fromJSON(json);

  assertEquals(restored.name, original.name, 'Name should match');
  assertEquals(restored.steps.length, original.steps.length, 'Steps count should match');
  assertEquals(restored.steps[1].delay, 50, 'Step properties should be preserved');
});

// ============================================================================
// EVENTS
// ============================================================================

console.log('\n📡 Event Tests\n');

await test('Script emits start event', async () => {
  const engine = new Engine();
  const script = new Script('test-script');

  script.add({ type: 'test:action', payload: {} });

  let startEmitted = false;

  engine.on('script:start', (evt) => {
    startEmitted = true;
    assertEquals(evt.payload.payload.name, 'test-script', 'Event should include script name');
  });

  await script.run(engine);

  assert(startEmitted, 'Start event should be emitted');
});

await test('Script emits complete event', async () => {
  const engine = new Engine();
  const script = new Script('test-script');

  script.add({ type: 'test:action', payload: {} });

  let completeEmitted = false;

  engine.on('script:complete', (evt) => {
    completeEmitted = true;
    assert(evt.payload.payload.completed, 'Should report completion status');
  });

  await script.run(engine);

  assert(completeEmitted, 'Complete event should be emitted');
});

await test('Script emits stop event', () => {
  const engine = new Engine();
  const script = new Script('test-script');

  let stopEmitted = false;

  engine.on('script:stop', () => {
    stopEmitted = true;
  });

  script.stop(engine);

  assert(stopEmitted, 'Stop event should be emitted');
});

await test('Script complete event shows incomplete on abort', async () => {
  const engine = new Engine();
  const script = new Script('test');

  script.add({ type: 'action1', payload: {} });
  script.add({ type: 'action2', payload: {}, delay: 100 });

  let completed = true;

  engine.on('script:complete', (evt) => {
    completed = evt.payload.payload.completed;
  });

  const controller = new AbortController();
  setTimeout(() => controller.abort(), 10);

  await script.run(engine, { signal: controller.signal });

  assert(!completed, 'Complete event should show incomplete status');
});

// ============================================================================
// INTEGRATION
// ============================================================================

console.log('\n🎯 Integration Tests\n');

await test('Script executes complex game scenario', async () => {
  const engine = new Engine();
  const script = new Script('game-setup');

  script
    .add({ type: 'game:start', payload: {} })
    .add({ type: 'agent:create', payload: { name: 'Alice' } })
    .add({ type: 'agent:create', payload: { name: 'Bob' } })
    .add({ type: 'agent:giveResource', payload: { name: 'Alice', resource: 'gold', amount: 100 } })
    .add({ type: 'agent:giveResource', payload: { name: 'Bob', resource: 'gold', amount: 100 } });

  await script.run(engine);

  assert(engine._gameState.started === true, 'Game should be started');
  assertEquals(engine._agents.length, 2, 'Should have 2 agents');
  assertEquals(engine._agents[0].resources.gold, 100, 'Alice should have gold');
  assertEquals(engine._agents[1].resources.gold, 100, 'Bob should have gold');
});

// ============================================================================
// RESULTS
// ============================================================================

console.log('\n' + '═'.repeat(60));
console.log(`\n📊 Test Results: ${passCount}/${testCount} passed\n`);

if (failCount === 0) {
  console.log('🎉 All Script tests passed!\n');
  process.exit(0);
} else {
  console.log(`❌ ${failCount} tests failed\n`);
  process.exit(1);
}
