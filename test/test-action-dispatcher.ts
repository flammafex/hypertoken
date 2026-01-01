/**
 * Test: ActionDispatcher Integration
 *
 * Verifies that Engine correctly uses the typed ActionDispatcher methods
 * with zero overhead (no JSON serialization on top of WASM calls).
 */

import { Engine } from '../engine/Engine.js';
import { StackWasm } from '../core/StackWasm.js';
import { SpaceWasm } from '../core/SpaceWasm.js';
import { SourceWasm } from '../core/SourceWasm.js';
import { tryLoadWasm } from '../core/WasmBridge.js';
import { Action } from '../engine/Action.js';
import { Chronicle } from '../core/Chronicle.js';

console.log('='.repeat(80));
console.log('ACTION DISPATCHER INTEGRATION TEST');
console.log('='.repeat(80));
console.log('');

// Pre-load WASM
console.log('Loading WASM module...');
await tryLoadWasm();
console.log('');

async function testActionDispatcher() {
  let passed = 0;
  let failed = 0;

  // Test 1: Create Engine with WASM components
  console.log('Test 1: Create Engine with WASM ActionDispatcher');
  try {
    const tokens = Array.from({ length: 52 }, (_, i) => ({
      id: `card-${i}`,
      index: i,
      char: '□',
      group: 'cards',
      kind: 'default',
      label: `Card ${i}`,
      text: '□',
      meta: {}
    }));

    const chronicle = new Chronicle();
    const stack = new StackWasm(chronicle, tokens);

    const space = new SpaceWasm(chronicle, 'test-space');
    const source = new SourceWasm(chronicle);

    const engine = new Engine({ stack, space, source });

    // Check if WASM dispatcher is initialized
    const hasDispatcher = (engine as any)._wasmDispatcher !== null;

    if (hasDispatcher) {
      console.log('  ✅ Engine has WASM ActionDispatcher initialized');
      passed++;
    } else {
      console.log('  ❌ WASM ActionDispatcher not initialized');
      failed++;
    }
  } catch (error) {
    console.error('  ❌ Failed:', error);
    failed++;
  }
  console.log('');

  // Test 2: Test stack:shuffle via ActionDispatcher
  console.log('Test 2: Execute stack:shuffle via ActionDispatcher');
  try {
    const tokens = Array.from({ length: 52 }, (_, i) => ({
      id: `card-${i}`,
      index: i,
      char: '□',
      group: 'cards',
      kind: 'default',
      label: `Card ${i}`,
      text: '□',
      meta: {}
    }));

    const chronicle = new Chronicle();
    const stack = new StackWasm(chronicle, tokens);

    const engine = new Engine({ stack, space: new SpaceWasm(chronicle, 'test-space') });

    // Enable debug to see if WASM is used
    engine.debug = true;

    const action = new Action('stack:shuffle', { seed: 'test-seed' });
    engine.apply(action);

    console.log('  ✅ stack:shuffle executed via ActionDispatcher');
    passed++;
  } catch (error) {
    console.error('  ❌ Failed:', error);
    failed++;
  }
  console.log('');

  // Test 3: Test stack:draw via ActionDispatcher
  console.log('Test 3: Execute stack:draw via ActionDispatcher');
  try {
    const tokens = Array.from({ length: 52 }, (_, i) => ({
      id: `card-${i}`,
      index: i,
      char: '□',
      group: 'cards',
      kind: 'default',
      label: `Card ${i}`,
      text: '□',
      meta: {}
    }));

    const chronicle = new Chronicle();
    const stack = new StackWasm(chronicle, tokens);

    const engine = new Engine({ stack, space: new SpaceWasm(chronicle, 'test-space') });

    const action = new Action('stack:draw', { count: 5 });
    const result = engine.apply(action);

    if (result && result.length === 5) {
      console.log(`  ✅ Drawn 5 cards: ${result.map((t: any) => t.id).join(', ')}`);
      passed++;
    } else {
      console.error('  ❌ Failed to draw 5 cards');
      failed++;
    }
  } catch (error) {
    console.error('  ❌ Failed:', error);
    failed++;
  }
  console.log('');

  // Test 4: Performance comparison (ActionDispatcher vs direct call)
  console.log('Test 4: Performance comparison (ActionDispatcher vs StackWasm direct)');
  try {
    const tokens = Array.from({ length: 52 }, (_, i) => ({
      id: `card-${i}`,
      index: i,
      char: '□',
      group: 'cards',
      kind: 'default',
      label: `Card ${i}`,
      text: '□',
      meta: {}
    }));

    // Test ActionDispatcher route
    const chronicle1 = new Chronicle();
    const stack1 = new StackWasm(chronicle1, tokens);
    const engine = new Engine({ stack: stack1, space: new SpaceWasm(chronicle1, 'test-space') });

    const dispatcherStart = performance.now();
    for (let i = 0; i < 100; i++) {
      engine.apply(new Action('stack:shuffle', { seed: `seed-${i}` }));
    }
    const dispatcherTime = performance.now() - dispatcherStart;

    // Test direct StackWasm call
    const chronicle2 = new Chronicle();
    const stack2 = new StackWasm(chronicle2, tokens);

    const directStart = performance.now();
    for (let i = 0; i < 100; i++) {
      stack2.shuffle(i);
    }
    const directTime = performance.now() - directStart;

    const overhead = ((dispatcherTime - directTime) / directTime) * 100;

    console.log(`  ActionDispatcher route: ${dispatcherTime.toFixed(2)}ms (100 shuffles)`);
    console.log(`  Direct StackWasm call:  ${directTime.toFixed(2)}ms (100 shuffles)`);
    console.log(`  Overhead: ${overhead.toFixed(1)}%`);

    if (overhead < 5) {
      console.log('  ✅ Overhead is negligible (<5%)');
      passed++;
    } else if (overhead < 10) {
      console.log('  ⚠️  Overhead is acceptable (<10%)');
      passed++;
    } else {
      console.log('  ❌ Overhead is too high (>10%)');
      failed++;
    }
  } catch (error) {
    console.error('  ❌ Failed:', error);
    failed++;
  }
  console.log('');

  // Test 5: Fallback to TypeScript on WASM failure
  console.log('Test 5: Fallback to TypeScript on WASM error');
  try {
    const chronicle = new Chronicle();
    const stack = new StackWasm(chronicle);
    const engine = new Engine({ stack, space: new SpaceWasm(chronicle, 'test-space') });

    // Force dispatcher to null to trigger fallback
    (engine as any)._wasmDispatcher = null;

    const action = new Action('stack:shuffle', { seed: 'test' });
    engine.apply(action);

    console.log('  ✅ Fallback to TypeScript ActionRegistry works');
    passed++;
  } catch (error) {
    console.error('  ❌ Failed:', error);
    failed++;
  }
  console.log('');

  // Summary
  console.log('='.repeat(80));
  console.log('SUMMARY');
  console.log('='.repeat(80));
  console.log(`  Tests passed: ${passed}`);
  console.log(`  Tests failed: ${failed}`);
  console.log('');

  if (failed === 0) {
    console.log('✅ ALL TESTS PASSED');
  } else {
    console.log(`❌ ${failed} TEST(S) FAILED`);
    process.exit(1);
  }
}

testActionDispatcher()
  .then(() => {
    console.log('\nTest suite complete');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Test suite failed:', error);
    process.exit(1);
  });
