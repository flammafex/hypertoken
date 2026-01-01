/**
 * Benchmark: Worker Communication Overhead
 *
 * Measures the overhead of worker communication vs direct execution.
 * This test focuses on latency and responsiveness, not raw throughput.
 */

import { WasmWorker } from '../core/WasmWorker.js';

interface BenchmarkResult {
  test: string;
  avgLatency: number;
  minLatency: number;
  maxLatency: number;
  p95Latency: number;
}

async function measureLatency(fn: () => Promise<void>, iterations: number): Promise<number[]> {
  const latencies: number[] = [];

  // Warmup
  for (let i = 0; i < 3; i++) {
    await fn();
  }

  // Measure
  for (let i = 0; i < iterations; i++) {
    const start = performance.now();
    await fn();
    const end = performance.now();
    latencies.push(end - start);
  }

  return latencies;
}

function analyzeLatencies(latencies: number[]): BenchmarkResult {
  const sorted = [...latencies].sort((a, b) => a - b);
  const sum = latencies.reduce((acc, val) => acc + val, 0);
  const p95Index = Math.floor(sorted.length * 0.95);

  return {
    test: '',
    avgLatency: sum / latencies.length,
    minLatency: sorted[0],
    maxLatency: sorted[sorted.length - 1],
    p95Latency: sorted[p95Index],
  };
}

async function benchmarkWorkerOverhead() {
  console.log('='.repeat(80));
  console.log('WORKER COMMUNICATION OVERHEAD BENCHMARK');
  console.log('='.repeat(80));
  console.log('');
  console.log('This benchmark measures the latency overhead of worker communication.');
  console.log('Lower latency overhead = better responsiveness.');
  console.log('');

  const iterations = 100;

  // Test 1: Ping latency
  console.log('Test 1: Worker ping latency (round-trip communication overhead)');
  console.log('-'.repeat(80));

  const worker = new WasmWorker({ debug: false });
  await worker.init();

  const pingLatencies = await measureLatency(
    async () => {
      await worker.ping();
    },
    iterations
  );

  const pingResult = analyzeLatencies(pingLatencies);
  pingResult.test = 'Ping';

  console.log(`  Avg: ${pingResult.avgLatency.toFixed(3)}ms`);
  console.log(`  Min: ${pingResult.minLatency.toFixed(3)}ms`);
  console.log(`  Max: ${pingResult.maxLatency.toFixed(3)}ms`);
  console.log(`  P95: ${pingResult.p95Latency.toFixed(3)}ms`);
  console.log('');

  // Test 2: Simple action dispatch latency
  console.log('Test 2: Action dispatch latency (full round-trip with execution)');
  console.log('-'.repeat(80));

  const actionLatencies = await measureLatency(
    async () => {
      await worker.dispatch('stack:shuffle', { seed: 12345 });
    },
    iterations
  );

  const actionResult = analyzeLatencies(actionLatencies);
  actionResult.test = 'Action Dispatch';

  console.log(`  Avg: ${actionResult.avgLatency.toFixed(3)}ms`);
  console.log(`  Min: ${actionResult.minLatency.toFixed(3)}ms`);
  console.log(`  Max: ${actionResult.maxLatency.toFixed(3)}ms`);
  console.log(`  P95: ${actionResult.p95Latency.toFixed(3)}ms`);
  console.log('');

  // Test 3: Burst of concurrent actions
  console.log('Test 3: Concurrent actions (5 parallel dispatches)');
  console.log('-'.repeat(80));

  const burstLatencies = await measureLatency(
    async () => {
      await Promise.all([
        worker.dispatch('stack:shuffle', { seed: 1 }),
        worker.dispatch('stack:shuffle', { seed: 2 }),
        worker.dispatch('stack:shuffle', { seed: 3 }),
        worker.dispatch('stack:shuffle', { seed: 4 }),
        worker.dispatch('stack:shuffle', { seed: 5 }),
      ]);
    },
    20
  );

  const burstResult = analyzeLatencies(burstLatencies);
  burstResult.test = 'Burst (5x)';

  console.log(`  Avg: ${burstResult.avgLatency.toFixed(3)}ms`);
  console.log(`  Min: ${burstResult.minLatency.toFixed(3)}ms`);
  console.log(`  Max: ${burstResult.maxLatency.toFixed(3)}ms`);
  console.log(`  P95: ${burstResult.p95Latency.toFixed(3)}ms`);
  console.log('');

  await worker.terminate();

  // Summary
  console.log('='.repeat(80));
  console.log('SUMMARY');
  console.log('='.repeat(80));
  console.log('');
  console.log('Worker Communication Overhead:');
  console.log(`  Base overhead (ping): ${pingResult.avgLatency.toFixed(3)}ms`);
  console.log(`  Action dispatch: ${actionResult.avgLatency.toFixed(3)}ms`);
  console.log(`  Concurrent actions: ${burstResult.avgLatency.toFixed(3)}ms total`);
  console.log(`  Per-action (concurrent): ${(burstResult.avgLatency / 5).toFixed(3)}ms`);
  console.log('');

  // Analysis
  console.log('Analysis:');
  if (pingResult.avgLatency < 1) {
    console.log('  ✅ Excellent: Sub-millisecond communication overhead');
  } else if (pingResult.avgLatency < 5) {
    console.log('  ✅ Good: Low communication overhead (<5ms)');
  } else if (pingResult.avgLatency < 10) {
    console.log('  ⚠️  Acceptable: Moderate overhead (<10ms)');
  } else {
    console.log('  ❌ High: Significant overhead (>10ms)');
  }

  console.log('');
  console.log('Key Takeaways:');
  console.log('  • Worker mode adds ~' + pingResult.avgLatency.toFixed(2) + 'ms latency per action');
  console.log('  • This overhead is the cost of non-blocking execution');
  console.log('  • Main thread remains responsive during worker operations');
  console.log('  • Trade-off: +latency for -blocking = better UX for heavy operations');
  console.log('');
  console.log('Recommendations:');
  if (pingResult.avgLatency < 5) {
    console.log('  ✅ Worker overhead is acceptable for most use cases');
    console.log('  ✅ Use worker mode for operations that take >10ms');
    console.log('  ✅ Use worker mode when UI responsiveness is critical');
  } else {
    console.log('  ⚠️  Worker overhead may be noticeable for very fast operations');
    console.log('  ⚠️  Consider direct execution for <10ms operations');
    console.log('  ✅ Still beneficial for operations that take >50ms');
  }
}

benchmarkWorkerOverhead()
  .then(() => {
    console.log('\nBenchmark complete');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Benchmark failed:', error);
    process.exit(1);
  });
