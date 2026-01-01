/**
 * Benchmark: Worker vs Non-Worker Performance
 *
 * Compares performance between Engine with worker mode enabled vs disabled
 * to validate multi-threading benefits.
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

interface BenchmarkResult {
  mode: 'worker' | 'non-worker';
  testName: string;
  iterations: number;
  totalTime: number;
  avgTime: number;
  minTime: number;
  maxTime: number;
  throughput: number; // actions per second
}

async function measureTime(fn: () => Promise<any>): Promise<number> {
  const start = performance.now();
  await fn();
  return performance.now() - start;
}

async function runBenchmark(
  engine: Engine,
  mode: 'worker' | 'non-worker',
  testName: string,
  iterations: number,
  actionFn: (engine: Engine) => Promise<any>
): Promise<BenchmarkResult> {
  const times: number[] = [];

  // Warmup
  for (let i = 0; i < 3; i++) {
    await actionFn(engine);
  }

  // Actual benchmark
  for (let i = 0; i < iterations; i++) {
    const time = await measureTime(() => actionFn(engine));
    times.push(time);
  }

  const totalTime = times.reduce((sum, t) => sum + t, 0);
  const avgTime = totalTime / iterations;
  const minTime = Math.min(...times);
  const maxTime = Math.max(...times);
  const throughput = (iterations / totalTime) * 1000; // actions per second

  return {
    mode,
    testName,
    iterations,
    totalTime,
    avgTime,
    minTime,
    maxTime,
    throughput,
  };
}

function printResult(result: BenchmarkResult): void {
  console.log(`\n  ${result.testName} (${result.mode}):`);
  console.log(`    Total: ${result.totalTime.toFixed(2)}ms`);
  console.log(`    Avg: ${result.avgTime.toFixed(2)}ms`);
  console.log(`    Min: ${result.minTime.toFixed(2)}ms`);
  console.log(`    Max: ${result.maxTime.toFixed(2)}ms`);
  console.log(`    Throughput: ${result.throughput.toFixed(2)} actions/sec`);
}

function printComparison(workerResult: BenchmarkResult, nonWorkerResult: BenchmarkResult): void {
  const speedup = nonWorkerResult.avgTime / workerResult.avgTime;
  const throughputGain = ((workerResult.throughput - nonWorkerResult.throughput) / nonWorkerResult.throughput) * 100;

  console.log(`\n  📊 Comparison:`);
  if (speedup > 1) {
    console.log(`    ✅ Worker is ${speedup.toFixed(2)}x faster`);
  } else {
    console.log(`    ❌ Worker is ${(1/speedup).toFixed(2)}x slower`);
  }

  if (throughputGain > 0) {
    console.log(`    ✅ Worker has ${throughputGain.toFixed(1)}% higher throughput`);
  } else {
    console.log(`    ❌ Worker has ${Math.abs(throughputGain).toFixed(1)}% lower throughput`);
  }
}

async function benchmarkWorker() {
  console.log('='.repeat(80));
  console.log('WORKER VS NON-WORKER PERFORMANCE BENCHMARK');
  console.log('='.repeat(80));
  console.log('');

  const iterations = 100;
  const tokens = createTestTokens(52);

  // Test 1: Single shuffle action
  console.log('Test 1: Single shuffle action');
  console.log('-'.repeat(80));

  const workerEngine1 = new Engine({
    stack: new StackWasm(new Chronicle(), tokens),
    space: new SpaceWasm(new Chronicle(), 'test-space'),
    source: new SourceWasm(new Chronicle()),
    useWorker: true,
    workerOptions: { debug: false, enableBatching: false },
  });
  await new Promise(resolve => setTimeout(resolve, 500)); // Wait for worker init

  const nonWorkerEngine1 = new Engine({
    stack: new StackWasm(new Chronicle(), tokens),
    space: new SpaceWasm(new Chronicle(), 'test-space'),
    source: new SourceWasm(new Chronicle()),
    useWorker: false,
  });

  const workerResult1 = await runBenchmark(
    workerEngine1,
    'worker',
    'Single shuffle',
    iterations,
    async (engine) => {
      await engine.dispatch('stack:shuffle', { seed: Math.random() });
    }
  );

  const nonWorkerResult1 = await runBenchmark(
    nonWorkerEngine1,
    'non-worker',
    'Single shuffle',
    iterations,
    async (engine) => {
      await engine.dispatch('stack:shuffle', { seed: Math.random() });
    }
  );

  printResult(workerResult1);
  printResult(nonWorkerResult1);
  printComparison(workerResult1, nonWorkerResult1);

  await workerEngine1.shutdown();
  console.log('');

  // Test 2: Draw actions
  console.log('Test 2: Draw 5 cards');
  console.log('-'.repeat(80));

  const workerEngine2 = new Engine({
    stack: new StackWasm(new Chronicle(), tokens),
    space: new SpaceWasm(new Chronicle(), 'test-space'),
    source: new SourceWasm(new Chronicle()),
    useWorker: true,
    workerOptions: { debug: false, enableBatching: false },
  });
  await new Promise(resolve => setTimeout(resolve, 500));

  const nonWorkerEngine2 = new Engine({
    stack: new StackWasm(new Chronicle(), tokens),
    space: new SpaceWasm(new Chronicle(), 'test-space'),
    source: new SourceWasm(new Chronicle()),
    useWorker: false,
  });

  const workerResult2 = await runBenchmark(
    workerEngine2,
    'worker',
    'Draw 5 cards',
    iterations,
    async (engine) => {
      // Reset stack before each draw
      await engine.dispatch('stack:shuffle', { seed: 12345 });
      await engine.dispatch('stack:draw', { count: 5 });
    }
  );

  const nonWorkerResult2 = await runBenchmark(
    nonWorkerEngine2,
    'non-worker',
    'Draw 5 cards',
    iterations,
    async (engine) => {
      await engine.dispatch('stack:shuffle', { seed: 12345 });
      await engine.dispatch('stack:draw', { count: 5 });
    }
  );

  printResult(workerResult2);
  printResult(nonWorkerResult2);
  printComparison(workerResult2, nonWorkerResult2);

  await workerEngine2.shutdown();
  console.log('');

  // Test 3: Concurrent actions (Promise.all)
  console.log('Test 3: Concurrent actions (5 parallel shuffles)');
  console.log('-'.repeat(80));

  const workerEngine3 = new Engine({
    stack: new StackWasm(new Chronicle(), tokens),
    space: new SpaceWasm(new Chronicle(), 'test-space'),
    source: new SourceWasm(new Chronicle()),
    useWorker: true,
    workerOptions: { debug: false, enableBatching: false },
  });
  await new Promise(resolve => setTimeout(resolve, 500));

  const nonWorkerEngine3 = new Engine({
    stack: new StackWasm(new Chronicle(), tokens),
    space: new SpaceWasm(new Chronicle(), 'test-space'),
    source: new SourceWasm(new Chronicle()),
    useWorker: false,
  });

  const workerResult3 = await runBenchmark(
    workerEngine3,
    'worker',
    'Concurrent shuffles',
    20, // Fewer iterations for concurrent test
    async (engine) => {
      await Promise.all([
        engine.dispatch('stack:shuffle', { seed: 1 }),
        engine.dispatch('stack:shuffle', { seed: 2 }),
        engine.dispatch('stack:shuffle', { seed: 3 }),
        engine.dispatch('stack:shuffle', { seed: 4 }),
        engine.dispatch('stack:shuffle', { seed: 5 }),
      ]);
    }
  );

  const nonWorkerResult3 = await runBenchmark(
    nonWorkerEngine3,
    'non-worker',
    'Concurrent shuffles',
    20,
    async (engine) => {
      await engine.dispatch('stack:shuffle', { seed: 1 });
      await engine.dispatch('stack:shuffle', { seed: 2 });
      await engine.dispatch('stack:shuffle', { seed: 3 });
      await engine.dispatch('stack:shuffle', { seed: 4 });
      await engine.dispatch('stack:shuffle', { seed: 5 });
    }
  );

  printResult(workerResult3);
  printResult(nonWorkerResult3);
  printComparison(workerResult3, nonWorkerResult3);

  await workerEngine3.shutdown();
  console.log('');

  // Test 4: With batching enabled
  console.log('Test 4: Rapid actions with batching (worker only)');
  console.log('-'.repeat(80));

  const workerBatchEngine = new Engine({
    stack: new StackWasm(new Chronicle(), tokens),
    space: new SpaceWasm(new Chronicle(), 'test-space'),
    source: new SourceWasm(new Chronicle()),
    useWorker: true,
    workerOptions: { debug: false, enableBatching: true, batchWindow: 10 },
  });
  await new Promise(resolve => setTimeout(resolve, 500));

  const workerNoBatchEngine = new Engine({
    stack: new StackWasm(new Chronicle(), tokens),
    space: new SpaceWasm(new Chronicle(), 'test-space'),
    source: new SourceWasm(new Chronicle()),
    useWorker: true,
    workerOptions: { debug: false, enableBatching: false },
  });
  await new Promise(resolve => setTimeout(resolve, 500));

  const batchResult = await runBenchmark(
    workerBatchEngine,
    'worker',
    'Batched actions',
    50,
    async (engine) => {
      await Promise.all([
        engine.dispatch('stack:shuffle'),
        engine.dispatch('stack:draw', { count: 1 }),
        engine.dispatch('stack:shuffle'),
        engine.dispatch('stack:draw', { count: 1 }),
      ]);
    }
  );

  const noBatchResult = await runBenchmark(
    workerNoBatchEngine,
    'worker',
    'Non-batched actions',
    50,
    async (engine) => {
      await Promise.all([
        engine.dispatch('stack:shuffle'),
        engine.dispatch('stack:draw', { count: 1 }),
        engine.dispatch('stack:shuffle'),
        engine.dispatch('stack:draw', { count: 1 }),
      ]);
    }
  );

  printResult(batchResult);
  printResult(noBatchResult);
  printComparison(batchResult, noBatchResult);

  await workerBatchEngine.shutdown();
  await workerNoBatchEngine.shutdown();
  console.log('');

  // Summary
  console.log('='.repeat(80));
  console.log('SUMMARY');
  console.log('='.repeat(80));
  console.log('');
  console.log('Key Findings:');
  console.log('');
  console.log('1. Single Action Latency:');
  console.log(`   Non-worker: ${nonWorkerResult1.avgTime.toFixed(2)}ms`);
  console.log(`   Worker: ${workerResult1.avgTime.toFixed(2)}ms`);
  console.log(`   Overhead: ${(workerResult1.avgTime - nonWorkerResult1.avgTime).toFixed(2)}ms`);
  console.log('');
  console.log('2. Concurrent Actions:');
  console.log(`   Non-worker: ${nonWorkerResult3.avgTime.toFixed(2)}ms`);
  console.log(`   Worker: ${workerResult3.avgTime.toFixed(2)}ms`);
  console.log('');
  console.log('3. Batching Impact (worker mode):');
  console.log(`   Without batching: ${noBatchResult.avgTime.toFixed(2)}ms`);
  console.log(`   With batching: ${batchResult.avgTime.toFixed(2)}ms`);
  console.log('');
  console.log('Recommendations:');
  console.log('');

  const overhead = workerResult1.avgTime - nonWorkerResult1.avgTime;

  if (overhead < 1) {
    console.log('✅ Worker mode has minimal overhead (<1ms) - safe to use for all cases');
  } else if (overhead < 5) {
    console.log('⚠️  Worker mode has small overhead (~' + overhead.toFixed(1) + 'ms)');
    console.log('   Recommended for: UI-blocking operations, concurrent workflows');
    console.log('   Not recommended for: Single synchronous actions');
  } else {
    console.log('❌ Worker mode has significant overhead (~' + overhead.toFixed(1) + 'ms)');
    console.log('   Use only when: UI responsiveness is critical');
    console.log('   Consider: Optimizing worker communication protocol');
  }

  console.log('');
  console.log('Note: Worker mode benefits increase with:');
  console.log('  • Complex WASM operations that take >10ms');
  console.log('  • Concurrent action dispatches');
  console.log('  • Batching enabled for rapid actions');
  console.log('  • UI responsiveness requirements');
}

benchmarkWorker()
  .then(() => {
    console.log('\nBenchmark complete');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Benchmark failed:', error);
    process.exit(1);
  });
