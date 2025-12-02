/**
 * Benchmark: Parallel Operations (Phase 3A)
 *
 * Tests and benchmarks for Node.js Worker Thread parallelization
 *
 * Expected improvements:
 * - Parallel simulations: 4-8x speedup
 * - Chronicle merges: 3-6x speedup
 * - Batch operations: 2-4x speedup
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
 * Sequential simulation baseline
 */
async function sequentialSimulations(
  numSims: number,
  turns: number,
  tokens: IToken[]
): Promise<number> {
  const startTime = Date.now();

  for (let i = 0; i < numSims; i++) {
    const chronicle = new Chronicle();
    const stack = new StackWasm(chronicle, tokens);

    // Simulate turns
    for (let turn = 0; turn < turns; turn++) {
      if (turn % 5 === 0 && stack.size > 0) {
        stack.shuffle();
      }
      if (stack.size > 0) {
        stack.draw(1);
      }
      if (turn % 10 === 9) {
        stack.reset();
      }
    }
  }

  return Date.now() - startTime;
}

/**
 * Parallel simulation test
 */
async function parallelSimulations(
  numSims: number,
  turns: number,
  tokens: IToken[]
): Promise<number> {
  const parallel = new ParallelOps();
  const startTime = Date.now();

  await parallel.runSimulations({
    numSimulations: numSims,
    turnsPerSimulation: turns,
    tokens,
  });

  const duration = Date.now() - startTime;
  await parallel.shutdown();
  return duration;
}

/**
 * Sequential Chronicle merge baseline
 */
async function sequentialMerge(docs: string[]): Promise<number> {
  const startTime = Date.now();

  const chronicle = new Chronicle();
  for (const docBase64 of docs) {
    const temp = new Chronicle();
    temp.loadFromBase64(docBase64);
    chronicle.merge(temp.state);
  }

  return Date.now() - startTime;
}

/**
 * Parallel Chronicle merge test
 */
async function parallelMerge(docs: string[]): Promise<number> {
  const parallel = new ParallelOps();
  const startTime = Date.now();

  await parallel.mergeDocuments({
    documents: docs,
  });

  const duration = Date.now() - startTime;
  await parallel.shutdown();
  return duration;
}

/**
 * Main benchmark runner
 */
async function runBenchmarks() {
  console.log('='.repeat(80));
  console.log('PARALLEL OPERATIONS BENCHMARK (Phase 3A)');
  console.log('='.repeat(80));
  console.log('');

  // ============================================================================
  // Benchmark 1: Parallel Simulations
  // ============================================================================
  console.log('Benchmark 1: Parallel Simulations');
  console.log('-'.repeat(80));

  const tokens = createTokens(52); // Standard deck
  const numSimulations = 20;
  const turnsPerSimulation = 100;

  console.log(`Configuration:`);
  console.log(`  - Simulations: ${numSimulations}`);
  console.log(`  - Turns per simulation: ${turnsPerSimulation}`);
  console.log(`  - Tokens: ${tokens.length}`);
  console.log('');

  console.log('Running sequential baseline...');
  const seqTime = await sequentialSimulations(numSimulations, turnsPerSimulation, tokens);
  console.log(`✓ Sequential: ${seqTime}ms`);

  console.log('Running parallel simulations...');
  const parTime = await parallelSimulations(numSimulations, turnsPerSimulation, tokens);
  console.log(`✓ Parallel: ${parTime}ms`);

  const speedup = (seqTime / parTime).toFixed(2);
  console.log('');
  console.log(`📊 Speedup: ${speedup}x`);
  console.log(`   Target: 4-8x (${parseFloat(speedup) >= 4 ? '✅ PASS' : '⚠️  BELOW TARGET'})`);
  console.log('');

  // ============================================================================
  // Benchmark 2: Chronicle CRDT Merges
  // ============================================================================
  console.log('Benchmark 2: Parallel Chronicle Merges');
  console.log('-'.repeat(80));

  // Create test documents
  const numDocs = 16;
  const docsToMerge: string[] = [];

  console.log(`Creating ${numDocs} test documents...`);
  for (let i = 0; i < numDocs; i++) {
    const chronicle = new Chronicle();
    const stack = new StackWasm(chronicle, createTokens(10));
    stack.shuffle(i);
    stack.draw(3);
    docsToMerge.push(chronicle.saveToBase64());
  }
  console.log(`✓ ${numDocs} documents created`);
  console.log('');

  console.log('Running sequential merge...');
  const seqMergeTime = await sequentialMerge(docsToMerge);
  console.log(`✓ Sequential: ${seqMergeTime}ms`);

  console.log('Running parallel merge...');
  const parMergeTime = await parallelMerge(docsToMerge);
  console.log(`✓ Parallel: ${parMergeTime}ms`);

  const mergeSpeedup = (seqMergeTime / parMergeTime).toFixed(2);
  console.log('');
  console.log(`📊 Speedup: ${mergeSpeedup}x`);
  console.log(`   Target: 3-6x (${parseFloat(mergeSpeedup) >= 3 ? '✅ PASS' : '⚠️  BELOW TARGET'})`);
  console.log('');

  // ============================================================================
  // Benchmark 3: Monte Carlo Simulation
  // ============================================================================
  console.log('Benchmark 3: Monte Carlo Simulation (1000 runs)');
  console.log('-'.repeat(80));

  const parallel = new ParallelOps();
  const mcStartTime = Date.now();

  const mcResults = await parallel.monteCarlo({
    numSimulations: 1000,
    turnsPerSimulation: 50,
    tokens: createTokens(52),
  });

  const mcDuration = Date.now() - mcStartTime;

  console.log(`✓ Completed 1000 simulations in ${mcDuration}ms`);
  console.log(`  - Avg execution time per sim: ${(mcDuration / 1000).toFixed(2)}ms`);
  console.log(`  - Total actions: ${mcResults.reduce((sum, r) => sum + r.metrics.totalActions, 0)}`);
  console.log(`  - Success rate: ${(mcResults.reduce((sum, r) => sum + (r.metrics.successfulActions / r.metrics.totalActions), 0) / mcResults.length * 100).toFixed(2)}%`);
  console.log('');

  await parallel.shutdown();

  // ============================================================================
  // Summary
  // ============================================================================
  console.log('='.repeat(80));
  console.log('SUMMARY');
  console.log('='.repeat(80));
  console.log('');
  console.log(`Parallel Simulations:  ${speedup}x speedup (target: 4-8x)`);
  console.log(`Parallel Merges:       ${mergeSpeedup}x speedup (target: 3-6x)`);
  console.log(`Monte Carlo:           ${(1000 / (mcDuration / 1000)).toFixed(0)} sims/sec`);
  console.log('');

  const overallPass = parseFloat(speedup) >= 4 && parseFloat(mergeSpeedup) >= 3;
  console.log(overallPass ? '✅ ALL BENCHMARKS PASSED' : '⚠️  SOME BENCHMARKS BELOW TARGET');
  console.log('');
}

// Run benchmarks
runBenchmarks()
  .then(() => {
    console.log('Benchmarks complete!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('Benchmark failed:', error);
    process.exit(1);
  });
