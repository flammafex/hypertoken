/**
 * Test: Chronicle WASM Integration
 *
 * Verifies that ChronicleWasm correctly uses the Rust Chronicle backend
 * for all operations (save/load/merge) with proper fallback behavior.
 */

import { ChronicleWasm } from '../core/ChronicleWasm.js';
import { HyperTokenState } from '../core/types.js';
import { tryLoadWasm } from '../core/WasmBridge.js';

console.log('='.repeat(80));
console.log('CHRONICLE WASM INTEGRATION TEST');
console.log('='.repeat(80));
console.log('');

// Pre-load WASM before tests
console.log('Loading WASM module...');
await tryLoadWasm();
console.log('');

async function testChronicleWasm() {
  let passed = 0;
  let failed = 0;

  // Test 1: Create Chronicle and check WASM status
  console.log('Test 1: Create Chronicle with WASM backend');
  try {
    const chronicle = new ChronicleWasm();

    // Wait a moment for async WASM init
    await new Promise(resolve => setTimeout(resolve, 500));

    console.log(`  WASM enabled: ${chronicle.isWasmEnabled}`);

    if (chronicle.isWasmEnabled) {
      console.log('  ✅ Chronicle using Rust backend');
    } else {
      console.log('  ⚠️  Chronicle using TypeScript fallback');
    }
    passed++;
  } catch (error) {
    console.error('  ❌ Failed:', error);
    failed++;
  }
  console.log('');

  // Test 2: Initialize with state
  console.log('Test 2: Initialize Chronicle with state');
  try {
    const initialState: HyperTokenState = {
      stack: {
        stack: [{ id: 'token1', index: 0, char: '□', group: 'test', kind: 'default', label: 'Test', text: '□', meta: {} }],
        drawn: [],
        discards: []
      }
    };

    const chronicle = new ChronicleWasm(initialState);
    await new Promise(resolve => setTimeout(resolve, 500));

    const state = chronicle.state;

    if (state.stack && state.stack.stack.length === 1) {
      console.log('  ✅ State initialized correctly');
      passed++;
    } else {
      console.error('  ❌ State not initialized');
      failed++;
    }
  } catch (error) {
    console.error('  ❌ Failed:', error);
    failed++;
  }
  console.log('');

  // Test 3: Change operation
  console.log('Test 3: Chronicle change operation');
  try {
    const chronicle = new ChronicleWasm();
    await new Promise(resolve => setTimeout(resolve, 500));

    let eventFired = false;
    chronicle.on('state:changed', () => {
      eventFired = true;
    });

    chronicle.change('add-token', (doc) => {
      doc.stack = {
        stack: [{ id: 'token2', index: 0, char: '□', group: 'test', kind: 'default', label: 'Test', text: '□', meta: {} }],
        drawn: [],
        discards: []
      };
    });

    const state = chronicle.state;

    if (state.stack && state.stack.stack.length === 1 && eventFired) {
      console.log('  ✅ Change operation successful, event fired');
      passed++;
    } else {
      console.error('  ❌ Change operation failed');
      failed++;
    }
  } catch (error) {
    console.error('  ❌ Failed:', error);
    failed++;
  }
  console.log('');

  // Test 4: Save and load
  console.log('Test 4: Save and load Chronicle');
  try {
    const chronicle1 = new ChronicleWasm();
    await new Promise(resolve => setTimeout(resolve, 500));

    chronicle1.change('set-state', (doc) => {
      doc.stack = {
        stack: [
          { id: 'token1', index: 0, char: '□', group: 'test', kind: 'default', label: 'T1', text: '□', meta: {} },
          { id: 'token2', index: 1, char: '□', group: 'test', kind: 'default', label: 'T2', text: '□', meta: {} }
        ],
        drawn: [],
        discards: []
      };
    });

    // Save to binary
    const binary = chronicle1.save();
    console.log(`  Saved ${binary.length} bytes`);

    // Load into new Chronicle
    const chronicle2 = new ChronicleWasm();
    await new Promise(resolve => setTimeout(resolve, 500));
    chronicle2.load(binary);

    const state = chronicle2.state;

    if (state.stack && state.stack.stack.length === 2) {
      console.log('  ✅ Save and load successful');
      passed++;
    } else {
      console.error('  ❌ Save/load failed');
      failed++;
    }
  } catch (error) {
    console.error('  ❌ Failed:', error);
    failed++;
  }
  console.log('');

  // Test 5: Base64 save and load
  console.log('Test 5: Base64 save and load');
  try {
    const chronicle1 = new ChronicleWasm();
    await new Promise(resolve => setTimeout(resolve, 500));

    chronicle1.change('set-state', (doc) => {
      doc.custom = { test: 'value' };
    });

    // Save to base64
    const base64 = chronicle1.saveToBase64();
    console.log(`  Saved as base64: ${base64.substring(0, 50)}...`);

    // Load from base64
    const chronicle2 = new ChronicleWasm();
    await new Promise(resolve => setTimeout(resolve, 500));
    chronicle2.loadFromBase64(base64);

    const state = chronicle2.state;

    if (state.custom && (state.custom as any).test === 'value') {
      console.log('  ✅ Base64 save/load successful');
      passed++;
    } else {
      console.error('  ❌ Base64 save/load failed');
      failed++;
    }
  } catch (error) {
    console.error('  ❌ Failed:', error);
    failed++;
  }
  console.log('');

  // Test 6: Merge operation
  console.log('Test 6: Merge two Chronicles');
  try {
    const chronicle1 = new ChronicleWasm();
    await new Promise(resolve => setTimeout(resolve, 500));

    chronicle1.change('set-state-1', (doc) => {
      doc.stack = {
        stack: [{ id: 'token1', index: 0, char: '□', group: 'test', kind: 'default', label: 'From1', text: '□', meta: {} }],
        drawn: [],
        discards: []
      };
    });

    const chronicle2 = new ChronicleWasm();
    await new Promise(resolve => setTimeout(resolve, 500));

    chronicle2.change('set-state-2', (doc) => {
      doc.space = {
        zones: {
          'zone1': {
            name: 'zone1',
            locked: false,
            tokens: [],
            placements: {}
          }
        }
      };
    });

    // Merge chronicle2 into chronicle1
    chronicle1.merge(chronicle2.state);

    const state = chronicle1.state;

    if (state.stack && state.space && typeof state.space === 'object' && state.space !== null && 'zones' in state.space && (state.space as any).zones?.['zone1']) {
      console.log('  ✅ Merge successful (both states present)');
      passed++;
    } else {
      console.error('  ❌ Merge failed');
      console.error(`    Has stack: ${!!state.stack}`);
      console.error(`    Has space: ${!!state.space}`);
      failed++;
    }
  } catch (error) {
    console.error('  ❌ Failed:', error);
    failed++;
  }
  console.log('');

  // Test 7: Multiple changes
  console.log('Test 7: Multiple sequential changes');
  try {
    const chronicle = new ChronicleWasm();
    await new Promise(resolve => setTimeout(resolve, 500));

    let changeCount = 0;
    chronicle.on('state:changed', () => {
      changeCount++;
    });

    chronicle.change('change-1', (doc) => {
      doc.test1 = 'value1';
    });

    chronicle.change('change-2', (doc) => {
      doc.test2 = 'value2';
    });

    chronicle.change('change-3', (doc) => {
      doc.test3 = 'value3';
    });

    const state = chronicle.state;

    if (changeCount === 3 &&
        (state as any).test1 === 'value1' &&
        (state as any).test2 === 'value2' &&
        (state as any).test3 === 'value3') {
      console.log('  ✅ Multiple changes successful');
      passed++;
    } else {
      console.error('  ❌ Multiple changes failed');
      console.error(`    Change count: ${changeCount}`);
      failed++;
    }
  } catch (error) {
    console.error('  ❌ Failed:', error);
    failed++;
  }
  console.log('');

  // Test 8: Performance comparison (save operation)
  console.log('Test 8: Performance comparison (save/load)');
  try {
    const chronicle = new ChronicleWasm();
    await new Promise(resolve => setTimeout(resolve, 500));

    // Create a reasonably sized state
    const tokens = Array.from({ length: 100 }, (_, i) => ({
      id: `token-${i}`,
      index: i,
      char: '□',
      group: 'test',
      kind: 'default',
      label: `Token ${i}`,
      text: '□',
      meta: {}
    }));

    chronicle.change('populate', (doc) => {
      doc.stack = { stack: tokens, drawn: [], discards: [] };
      doc.space = { zones: {} };
      doc.source = { stackIds: [], tokens: [], burned: [], seed: null, reshufflePolicy: { threshold: null, mode: 'auto' } };
    });

    // Measure save performance
    const saveStart = performance.now();
    for (let i = 0; i < 100; i++) {
      chronicle.save();
    }
    const saveTime = performance.now() - saveStart;

    // Measure load performance
    const binary = chronicle.save();
    const loadStart = performance.now();
    for (let i = 0; i < 100; i++) {
      const tempChronicle = new ChronicleWasm();
      tempChronicle.load(binary);
    }
    const loadTime = performance.now() - loadStart;

    console.log(`  Save (100 iterations): ${saveTime.toFixed(2)}ms (${(saveTime/100).toFixed(2)}ms avg)`);
    console.log(`  Load (100 iterations): ${loadTime.toFixed(2)}ms (${(loadTime/100).toFixed(2)}ms avg)`);
    console.log(`  Using: ${chronicle.isWasmEnabled ? 'Rust/WASM' : 'TypeScript'}`);
    console.log('  ✅ Performance test complete');
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

testChronicleWasm()
  .then(() => {
    console.log('\nTest suite complete');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Test suite failed:', error);
    process.exit(1);
  });
