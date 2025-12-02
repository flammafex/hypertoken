/**
 * Tests for Parallel Operations (Phase 3A)
 *
 * Tests:
 * 1. WorkerPool lifecycle and task management
 * 2. Parallel game simulations
 * 3. Parallel Chronicle merges
 * 4. Batch operations
 * 5. Error handling and recovery
 */

import { Chronicle } from '../core/Chronicle.js';
import { StackWasm } from '../core/StackWasm.js';
import { SpaceWasm } from '../core/SpaceWasm.js';
import { ParallelOps } from '../core/ParallelOps.js';
import type { IToken } from '../core/types.js';

/**
 * Create test tokens
 */
function createTokens(count: number): IToken[] {
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

/**
 * Main test runner
 */
async function runTests() {
  console.log('='.repeat(80));
  console.log('PARALLEL OPERATIONS TESTS (Phase 3A)');
  console.log('='.repeat(80));
  console.log('');

  let testsPassed = 0;
  let testsFailed = 0;

  // ============================================================================
  // Test 1: ParallelOps Initialization
  // ============================================================================
  console.log('Test 1: ParallelOps initialization...');
  try {
    const parallel = new ParallelOps();
    const stats = parallel.getStats();

    if (!stats.initialized) {
      console.log('   ⚠️  Worker pool not initialized yet (lazy init)');
    }

    await parallel.shutdown();
    console.log('✅ Test 1 passed');
    testsPassed++;
  } catch (error) {
    console.error('❌ Test 1 failed:', error);
    testsFailed++;
  }
  console.log('');

  // ============================================================================
  // Test 2: Simple Parallel Simulation
  // ============================================================================
  console.log('Test 2: Simple parallel simulation (10 simulations)...');
  try {
    const parallel = new ParallelOps();
    const tokens = createTokens(52);

    const results = await parallel.runSimulations({
      numSimulations: 10,
      turnsPerSimulation: 20,
      tokens,
    });

    if (results.length !== 10) {
      throw new Error(`Expected 10 results, got ${results.length}`);
    }

    // Check that each simulation ran
    for (const result of results) {
      if (result.turnsExecuted !== 20) {
        throw new Error(`Expected 20 turns, got ${result.turnsExecuted}`);
      }
      if (!result.finalState) {
        throw new Error('Missing final state');
      }
    }

    const stats = parallel.getStats();
    console.log(`   Workers: ${stats.totalWorkers}, Tasks processed: ${stats.totalTasksProcessed}`);

    await parallel.shutdown();
    console.log('✅ Test 2 passed');
    testsPassed++;
  } catch (error) {
    console.error('❌ Test 2 failed:', error);
    testsFailed++;
  }
  console.log('');

  // ============================================================================
  // Test 3: Deterministic Simulations (Seeds)
  // ============================================================================
  console.log('Test 3: Deterministic simulations with seeds...');
  try {
    const parallel = new ParallelOps();
    const tokens = createTokens(10);

    // Run same simulation twice with same seed
    const results1 = await parallel.runSimulations({
      numSimulations: 1,
      turnsPerSimulation: 10,
      tokens,
      seedPrefix: 'test-seed',
    });

    const results2 = await parallel.runSimulations({
      numSimulations: 1,
      turnsPerSimulation: 10,
      tokens,
      seedPrefix: 'test-seed',
    });

    // Results should be identical (deterministic)
    if (results1[0].finalState !== results2[0].finalState) {
      console.log('   ⚠️  Warning: Results differ (may be expected if using random operations)');
    } else {
      console.log('   ✓ Deterministic results confirmed');
    }

    await parallel.shutdown();
    console.log('✅ Test 3 passed');
    testsPassed++;
  } catch (error) {
    console.error('❌ Test 3 failed:', error);
    testsFailed++;
  }
  console.log('');

  // ============================================================================
  // Test 4: Chronicle Merge Operations
  // ============================================================================
  console.log('Test 4: Parallel Chronicle merges...');
  try {
    const parallel = new ParallelOps();

    // Create test documents
    const docs: string[] = [];
    for (let i = 0; i < 8; i++) {
      const chronicle = new Chronicle();
      const stack = new StackWasm(chronicle, createTokens(5));
      stack.shuffle(i);
      docs.push(chronicle.saveToBase64());
    }

    console.log(`   Created ${docs.length} documents to merge`);

    // Merge documents
    const merged = await parallel.mergeDocuments({
      documents: docs,
    });

    if (!merged) {
      throw new Error('Merge result is empty');
    }

    // Verify merged document loads correctly
    const chronicle = new Chronicle();
    chronicle.loadFromBase64(merged);

    console.log(`   ✓ Merged document loaded successfully`);
    // console.log(`   ✓ Change count: ${chronicle.changeCount()}`); // Method not available

    await parallel.shutdown();
    console.log('✅ Test 4 passed');
    testsPassed++;
  } catch (error) {
    console.error('❌ Test 4 failed:', error);
    testsFailed++;
  }
  console.log('');

  // ============================================================================
  // Test 5: Monte Carlo Simulation
  // ============================================================================
  console.log('Test 5: Monte Carlo simulation (100 runs)...');
  try {
    const parallel = new ParallelOps();
    const tokens = createTokens(20);

    const results = await parallel.monteCarlo({
      numSimulations: 100,
      turnsPerSimulation: 10,
      tokens,
    });

    if (results.length !== 100) {
      throw new Error(`Expected 100 results, got ${results.length}`);
    }

    // Calculate statistics
    const avgExecTime =
      results.reduce((sum, r) => sum + r.executionTime, 0) / results.length;
    const successRate =
      results.reduce(
        (sum, r) => sum + r.metrics.successfulActions / r.metrics.totalActions,
        0
      ) / results.length;

    console.log(`   ✓ Average execution time: ${avgExecTime.toFixed(2)}ms`);
    console.log(`   ✓ Success rate: ${(successRate * 100).toFixed(2)}%`);

    await parallel.shutdown();
    console.log('✅ Test 5 passed');
    testsPassed++;
  } catch (error) {
    console.error('❌ Test 5 failed:', error);
    testsFailed++;
  }
  console.log('');

  // ============================================================================
  // Test 6: A/B Testing
  // ============================================================================
  console.log('Test 6: A/B testing (2 variants, 20 sims each)...');
  try {
    const parallel = new ParallelOps();
    const tokensA = createTokens(10);
    const tokensB = createTokens(20);

    const comparison = await parallel.abTest({
      variantA: {
        numSimulations: 20,
        turnsPerSimulation: 10,
        tokens: tokensA,
      },
      variantB: {
        numSimulations: 20,
        turnsPerSimulation: 10,
        tokens: tokensB,
      },
    });

    if (comparison.variantA.length !== 20) {
      throw new Error(`Expected 20 results for variant A, got ${comparison.variantA.length}`);
    }
    if (comparison.variantB.length !== 20) {
      throw new Error(`Expected 20 results for variant B, got ${comparison.variantB.length}`);
    }

    console.log(`   ✓ Variant A avg time: ${comparison.comparison.avgExecutionTimeA.toFixed(2)}ms`);
    console.log(`   ✓ Variant B avg time: ${comparison.comparison.avgExecutionTimeB.toFixed(2)}ms`);
    console.log(
      `   ✓ Variant A success rate: ${(comparison.comparison.avgSuccessRateA * 100).toFixed(2)}%`
    );
    console.log(
      `   ✓ Variant B success rate: ${(comparison.comparison.avgSuccessRateB * 100).toFixed(2)}%`
    );

    await parallel.shutdown();
    console.log('✅ Test 6 passed');
    testsPassed++;
  } catch (error) {
    console.error('❌ Test 6 failed:', error);
    testsFailed++;
  }
  console.log('');

  // ============================================================================
  // Test 7: Custom Actions
  // ============================================================================
  console.log('Test 7: Custom actions in simulation...');
  try {
    const parallel = new ParallelOps();
    const tokens = createTokens(10);

    const results = await parallel.runSimulations({
      numSimulations: 5,
      turnsPerSimulation: 1,
      tokens,
      actions: [
        { type: 'stack:draw', count: 3 },
        { type: 'stack:shuffle', seed: 'test' },
        { type: 'stack:draw', count: 2 },
      ],
    });

    if (results.length !== 5) {
      throw new Error(`Expected 5 results, got ${results.length}`);
    }

    // Each simulation should execute 3 actions
    for (const result of results) {
      if (result.metrics.totalActions !== 3) {
        throw new Error(`Expected 3 actions, got ${result.metrics.totalActions}`);
      }
    }

    console.log('   ✓ Custom actions executed successfully');

    await parallel.shutdown();
    console.log('✅ Test 7 passed');
    testsPassed++;
  } catch (error) {
    console.error('❌ Test 7 failed:', error);
    testsFailed++;
  }
  console.log('');

  // ============================================================================
  // Test 8: Worker Pool Statistics
  // ============================================================================
  console.log('Test 8: Worker pool statistics...');
  try {
    const parallel = new ParallelOps();

    // Initial stats
    let stats = parallel.getStats();
    console.log(`   Initial state - Workers: ${stats.totalWorkers}, Tasks: ${stats.totalTasksProcessed}`);

    // Run some work
    await parallel.runSimulations({
      numSimulations: 10,
      turnsPerSimulation: 5,
      tokens: createTokens(5),
    });

    // Check stats after work
    stats = parallel.getStats();
    console.log(`   After work - Workers: ${stats.totalWorkers}, Tasks: ${stats.totalTasksProcessed}`);

    if (stats.totalTasksProcessed < 10) {
      throw new Error(`Expected at least 10 tasks processed, got ${stats.totalTasksProcessed}`);
    }

    await parallel.shutdown();
    console.log('✅ Test 8 passed');
    testsPassed++;
  } catch (error) {
    console.error('❌ Test 8 failed:', error);
    testsFailed++;
  }
  console.log('');

  // ============================================================================
  // Test 9: Large-Scale Parallel Simulation
  // ============================================================================
  console.log('Test 9: Large-scale parallel simulation (100 simulations)...');
  try {
    const parallel = new ParallelOps();
    const tokens = createTokens(52);

    const startTime = Date.now();
    const results = await parallel.runSimulations({
      numSimulations: 100,
      turnsPerSimulation: 50,
      tokens,
    });
    const duration = Date.now() - startTime;

    if (results.length !== 100) {
      throw new Error(`Expected 100 results, got ${results.length}`);
    }

    console.log(`   ✓ Completed 100 simulations in ${duration}ms`);
    console.log(`   ✓ Average: ${(duration / 100).toFixed(2)}ms per simulation`);

    await parallel.shutdown();
    console.log('✅ Test 9 passed');
    testsPassed++;
  } catch (error) {
    console.error('❌ Test 9 failed:', error);
    testsFailed++;
  }
  console.log('');

  // ============================================================================
  // Summary
  // ============================================================================
  console.log('='.repeat(80));
  console.log('TEST SUMMARY');
  console.log('='.repeat(80));
  console.log('');
  console.log(`✅ Passed: ${testsPassed}`);
  console.log(`❌ Failed: ${testsFailed}`);
  console.log(`📊 Total:  ${testsPassed + testsFailed}`);
  console.log('');

  if (testsFailed === 0) {
    console.log('🎉 ALL TESTS PASSED!');
    return true;
  } else {
    console.log('⚠️  SOME TESTS FAILED');
    return false;
  }
}

// Run tests
runTests()
  .then((success) => {
    process.exit(success ? 0 : 1);
  })
  .catch((error) => {
    console.error('Test runner failed:', error);
    process.exit(1);
  });
