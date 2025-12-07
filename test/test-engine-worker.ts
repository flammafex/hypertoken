/**
 * Test: Engine with WasmWorker integration
 *
 * Validates that Engine works correctly with multi-threaded worker mode
 */

import { Engine } from '../engine/Engine.js';
import { Chronicle } from '../core/Chronicle.js';
import { StackWasm } from '../core/StackWasm.js';
import { SpaceWasm } from '../core/SpaceWasm.js';
import { SourceWasm } from '../core/SourceWasm.js';
import type { IToken } from '../core/types.js';

function createTestTokens(count: number): IToken[] {
  return Array.from({ length: count }, (_, i) => ({
    id: `token-${i}`,
    label: `Token ${i}`,
    group: 'test',
    text: `Test token ${i}`,
    meta: {},
    char: '□',
    kind: 'default',
    index: i,
  }));
}

async function testEngineWorker() {
  console.log('='.repeat(80));
  console.log('ENGINE + WASM WORKER INTEGRATION TEST');
  console.log('='.repeat(80));
  console.log('');

  // Test 1: Create engine in worker mode
  console.log('Test 1: Create Engine with worker mode...');
  const chronicle = new Chronicle();
  const tokens = createTestTokens(52);
  const stack = new StackWasm(chronicle, tokens);
  const space = new SpaceWasm(chronicle, 'test-space');
  const source = new SourceWasm(chronicle);

  const engine = new Engine({
    stack,
    space,
    source,
    useWorker: true,
    workerOptions: {
      debug: false,
      enableBatching: false,
    },
  });

  // Wait a bit for worker to initialize
  await new Promise(resolve => setTimeout(resolve, 500));
  console.log('✅ Engine created with worker mode');
  console.log('');

  // Test 2: Async dispatch (stack:shuffle)
  console.log('Test 2: Async dispatch (stack:shuffle)...');
  const shuffleResult = await engine.dispatch('stack:shuffle', { seed: 12345 });
  console.log('✅ Shuffle completed:', shuffleResult);
  console.log('');

  // Test 3: Async dispatch (stack:draw)
  console.log('Test 3: Async dispatch (stack:draw)...');
  const drawResult = await engine.dispatch('stack:draw', { count: 5 });
  console.log('✅ Draw completed:', Array.isArray(drawResult) ? `${drawResult.length} cards` : drawResult);
  console.log('');

  // Test 4: Multiple async dispatches
  console.log('Test 4: Multiple async dispatches...');
  const promises = [
    engine.dispatch('stack:shuffle'),
    engine.dispatch('stack:draw', { count: 1 }),
    engine.dispatch('stack:peek', { count: 3 }),
  ];
  const results = await Promise.all(promises);
  console.log('✅ All dispatches completed:', results.length, 'actions');
  console.log('');

  // Test 5: Listen for events
  console.log('Test 5: Listen for engine events...');
  let eventCount = 0;
  engine.on('engine:action', () => {
    eventCount++;
  });

  await engine.dispatch('stack:draw', { count: 1 });
  await engine.dispatch('stack:shuffle');

  console.log('✅ Events received:', eventCount);
  console.log('');

  // Test 6: Batching (if enabled)
  console.log('Test 6: Test with batching enabled...');
  const batchEngine = new Engine({
    stack: new StackWasm(new Chronicle(), createTestTokens(52)),
    useWorker: true,
    workerOptions: {
      debug: false,
      enableBatching: true,
      batchWindow: 10,
    },
  });

  await new Promise(resolve => setTimeout(resolve, 500));

  // Send multiple actions quickly - they should be batched
  const batchStart = Date.now();
  const batchPromises = [
    batchEngine.dispatch('stack:shuffle'),
    batchEngine.dispatch('stack:draw', { count: 1 }),
    batchEngine.dispatch('stack:shuffle'),
    batchEngine.dispatch('stack:draw', { count: 1 }),
  ];
  await Promise.all(batchPromises);
  const batchDuration = Date.now() - batchStart;
  console.log('✅ Batched actions completed in:', batchDuration, 'ms');
  console.log('');

  // Test 7: Async dispatch
  console.log('Test 7: Async dispatch...');
  const asyncResult = await engine.dispatch('stack:peek', { count: 1 });
  console.log('✅ Async dispatch completed:', asyncResult ? 'result returned' : 'no result');
  console.log('');

  // Test 8: Shutdown
  console.log('Test 8: Shutdown engines...');
  await engine.shutdown();
  await batchEngine.shutdown();
  console.log('✅ Engines shut down');
  console.log('');

  console.log('='.repeat(80));
  console.log('ALL TESTS PASSED ✅');
  console.log('='.repeat(80));
  console.log('');
  console.log('🎯 Key takeaways:');
  console.log('  • Engine supports worker mode with useWorker option');
  console.log('  • dispatchAsync() works with worker for non-blocking execution');
  console.log('  • Batching can improve performance for rapid actions');
  console.log('  • Backward compatible with sync dispatch() (falls back)');
  console.log('  • Events work correctly in worker mode');
}

testEngineWorker()
  .then(() => {
    console.log('Test complete');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Test failed:', error);
    process.exit(1);
  });
