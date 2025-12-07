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
 * Test suite for Recorder
 * Tests: recording, replay, import/export
 */

import { Engine } from '../engine/Engine.js';
import { Recorder } from '../engine/Recorder.js';
import { Action } from '../engine/Action.js';

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

console.log('\n🧪 Testing Recorder\n');
console.log('═'.repeat(60));

// ============================================================================
// BASIC RECORDING
// ============================================================================

console.log('\n📹 Basic Recording Tests\n');

await test('Recorder starts and stops recording', () => {
  const engine = new Engine();
  const recorder = new Recorder(engine);

  assert(!recorder.enabled, 'Should start disabled');

  recorder.start();
  assert(recorder.enabled, 'Should be enabled after start');

  recorder.stop();
  assert(!recorder.enabled, 'Should be disabled after stop');
});

await test('Recorder captures actions', async () => {
  const engine = new Engine();
  const recorder = new Recorder(engine);

  recorder.start();

  await engine.dispatch('test:action1', { value: 1 });
  await engine.dispatch('test:action2', { value: 2 });

  recorder.stop();

  assertEquals(recorder.log.length, 2, 'Should have recorded 2 actions');
  assertEquals(recorder.log[0].type, 'test:action1', 'First action type should match');
  assertEquals(recorder.log[1].payload.value, 2, 'Second action payload should match');
});

await test('Recorder does not capture when stopped', async () => {
  const engine = new Engine();
  const recorder = new Recorder(engine);

  await engine.dispatch('test:before', {});

  recorder.start();
  await engine.dispatch('test:during', {});
  recorder.stop();

  await engine.dispatch('test:after', {});

  assertEquals(recorder.log.length, 1, 'Should only have 1 action');
  assertEquals(recorder.log[0].type, 'test:during', 'Should only capture during recording');
});

await test('Recorder clear empties log', async () => {
  const engine = new Engine();
  const recorder = new Recorder(engine);

  recorder.start();
  await engine.dispatch('test:action1', {});
  await engine.dispatch('test:action2', {});
  recorder.stop();

  assertEquals(recorder.log.length, 2, 'Should have 2 actions before clear');

  recorder.clear();

  assertEquals(recorder.log.length, 0, 'Should have 0 actions after clear');
});

// ============================================================================
// IMPORT/EXPORT
// ============================================================================

console.log('\n💾 Import/Export Tests\n');

await test('Recorder exports to JSON', async () => {
  const engine = new Engine();
  const recorder = new Recorder(engine);

  recorder.start();
  await engine.dispatch('game:start', {});
  await engine.dispatch('agent:create', { name: 'Alice' });
  recorder.stop();

  const json = recorder.exportJSON();

  assert(typeof json === 'string', 'Export should be a string');
  assert(json.includes('game:start'), 'Export should contain action type');
  assert(json.includes('Alice'), 'Export should contain payload data');
});

await test('Recorder imports from JSON string', () => {
  const engine = new Engine();
  const recorder = new Recorder(engine);

  const testLog = [
    { type: 'test:action1', payload: { value: 1 } },
    { type: 'test:action2', payload: { value: 2 } }
  ];

  const json = JSON.stringify(testLog);
  const success = recorder.importJSON(json);

  assert(success, 'Import should succeed');
  assertEquals(recorder.log.length, 2, 'Should have 2 imported actions');
  assertEquals(recorder.log[0].type, 'test:action1', 'First action should match');
});

await test('Recorder imports from array', () => {
  const engine = new Engine();
  const recorder = new Recorder(engine);

  const testLog = [
    { type: 'test:action1', payload: {} },
    { type: 'test:action2', payload: {} }
  ];

  const success = recorder.importJSON(testLog);

  assert(success, 'Import should succeed');
  assertEquals(recorder.log.length, 2, 'Should have 2 imported actions');
});

await test('Recorder handles invalid import gracefully', () => {
  const engine = new Engine();
  const recorder = new Recorder(engine);

  const success = recorder.importJSON('invalid json{');

  assert(!success, 'Import should fail');
  assertEquals(recorder.log.length, 0, 'Log should be empty after failed import');
});

// ============================================================================
// REPLAY
// ============================================================================

console.log('\n▶️  Replay Tests\n');

await test('Recorder replays actions to target engine', async () => {
  const engine1 = new Engine();
  const recorder = new Recorder(engine1);

  // Record actions
  recorder.start();
  await engine1.dispatch('agent:create', { name: 'Alice' });
  await engine1.dispatch('agent:create', { name: 'Bob' });
  recorder.stop();

  // Replay to new engine
  const engine2 = new Engine();
  await recorder.replay(engine2);

  assertEquals(engine2._agents.length, 2, 'Target should have 2 agents');
  assertEquals(engine2._agents[0].name, 'Alice', 'First agent should be Alice');
  assertEquals(engine2._agents[1].name, 'Bob', 'Second agent should be Bob');
});

await test('Recorder replay with delay', async () => {
  const engine1 = new Engine();
  const recorder = new Recorder(engine1);

  recorder.start();
  await engine1.dispatch('test:action', { id: 1 });
  await engine1.dispatch('test:action', { id: 2 });
  recorder.stop();

  const engine2 = new Engine();
  const startTime = Date.now();

  await recorder.replay(engine2, { delay: 50 });

  const elapsed = Date.now() - startTime;
  assert(elapsed >= 50, `Replay should take at least 50ms, took ${elapsed}ms`);
});

await test('Recorder replay stopOnError = true', async () => {
  const engine1 = new Engine();
  const recorder = new Recorder(engine1);

  // Create a log with actions (note: engine handles unknown actions gracefully)
  recorder.importJSON([
    { type: 'agent:create', payload: { name: 'Alice' } },
    { type: 'invalid:action:that:fails', payload: {} },
    { type: 'agent:create', payload: { name: 'Bob' } }
  ]);

  const engine2 = new Engine();

  await recorder.replay(engine2, { stopOnError: true });

  // Engine handles unknown actions gracefully, so all actions complete
  // Alice is created, invalid action is skipped, Bob is created
  assertEquals(engine2._agents.length, 2, 'All valid actions should complete');
});

await test('Recorder replay stopOnError = false continues', async () => {
  const engine1 = new Engine();
  const recorder = new Recorder(engine1);

  recorder.importJSON([
    { type: 'agent:create', payload: { name: 'Alice' } },
    { type: 'invalid:action', payload: {} },
    { type: 'agent:create', payload: { name: 'Bob' } }
  ]);

  const engine2 = new Engine();
  await recorder.replay(engine2, { stopOnError: false });

  assertEquals(engine2._agents.length, 2, 'Should continue after error, both created');
});

await test('Recorder emits replay events', async () => {
  const engine1 = new Engine();
  const recorder = new Recorder(engine1);

  recorder.start();
  await engine1.dispatch('test:action', {});
  recorder.stop();

  const engine2 = new Engine();
  let startEmitted = false;
  let completeEmitted = false;

  engine2.on('recorder:replay:start', () => {
    startEmitted = true;
  });

  engine2.on('recorder:replay:complete', () => {
    completeEmitted = true;
  });

  await recorder.replay(engine2);

  assert(startEmitted, 'Start event should be emitted');
  assert(completeEmitted, 'Complete event should be emitted');
});

// ============================================================================
// EVENTS
// ============================================================================

console.log('\n📡 Event Tests\n');

await test('Recorder emits start/stop events', () => {
  const engine = new Engine();
  const recorder = new Recorder(engine);

  let startEmitted = false;
  let stopEmitted = false;

  engine.on('recorder:start', () => {
    startEmitted = true;
  });

  engine.on('recorder:stop', () => {
    stopEmitted = true;
  });

  recorder.start();
  recorder.stop();

  assert(startEmitted, 'Start event should be emitted');
  assert(stopEmitted, 'Stop event should be emitted');
});

await test('Recorder emits clear event', () => {
  const engine = new Engine();
  const recorder = new Recorder(engine);

  let clearEmitted = false;

  engine.on('recorder:clear', () => {
    clearEmitted = true;
  });

  recorder.clear();

  assert(clearEmitted, 'Clear event should be emitted');
});

await test('Recorder emits import event', () => {
  const engine = new Engine();
  const recorder = new Recorder(engine);

  let importEmitted = false;

  engine.on('recorder:import', () => {
    importEmitted = true;
  });

  recorder.importJSON([]);

  assert(importEmitted, 'Import event should be emitted');
});

// ============================================================================
// RESULTS
// ============================================================================

console.log('\n' + '═'.repeat(60));
console.log(`\n📊 Test Results: ${passCount}/${testCount} passed\n`);

if (failCount === 0) {
  console.log('🎉 All Recorder tests passed!\n');
  process.exit(0);
} else {
  console.log(`❌ ${failCount} tests failed\n`);
  process.exit(1);
}
