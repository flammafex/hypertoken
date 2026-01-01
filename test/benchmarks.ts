#!/usr/bin/env -S node --loader ./test/ts-esm-loader.js
/*
 * Copyright 2025 The Carpocratian Church of Commonality and Equality, Inc.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *      http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

/// <reference types="node" />

/**
 * Performance Benchmarks for HyperToken
 *
 * Tests the performance of core operations including:
 * - Engine action dispatch
 * - Token operations
 * - Stack operations
 * - Space operations
 * - CRDT operations (Chronicle)
 * - Batch operations
 * - Large-scale state management
 */

import { Engine } from '../engine/Engine.js';
import { Stack } from '../core/Stack.js';
import { Space } from '../core/Space.js';
import { Source } from '../core/Source.js';
import { Token } from '../core/Token.js';
import { Chronicle } from '../core/Chronicle.js';

// ============================================================
// Benchmark Infrastructure
// ============================================================

interface BenchmarkResult {
  name: string;
  iterations: number;
  totalTime: number;
  avgTime: number;
  opsPerSecond: number;
  minTime: number;
  maxTime: number;
}

class BenchmarkRunner {
  results: BenchmarkResult[] = [];

  benchmark(name: string, fn: () => void, iterations: number = 1000): BenchmarkResult {
    // Warmup
    for (let i = 0; i < Math.min(100, iterations / 10); i++) {
      fn();
    }

    // Actual benchmark
    const times: number[] = [];
    const start = performance.now();

    for (let i = 0; i < iterations; i++) {
      const iterStart = performance.now();
      fn();
      times.push(performance.now() - iterStart);
    }

    const totalTime = performance.now() - start;
    const avgTime = totalTime / iterations;
    const opsPerSecond = 1000 / avgTime;
    const minTime = Math.min(...times);
    const maxTime = Math.max(...times);

    const result: BenchmarkResult = {
      name,
      iterations,
      totalTime,
      avgTime,
      opsPerSecond,
      minTime,
      maxTime
    };

    this.results.push(result);
    return result;
  }

  async benchmarkAsync(name: string, fn: () => Promise<void>, iterations: number = 100): Promise<BenchmarkResult> {
    // Warmup
    for (let i = 0; i < Math.min(10, iterations / 10); i++) {
      await fn();
    }

    // Actual benchmark
    const times: number[] = [];
    const start = performance.now();

    for (let i = 0; i < iterations; i++) {
      const iterStart = performance.now();
      await fn();
      times.push(performance.now() - iterStart);
    }

    const totalTime = performance.now() - start;
    const avgTime = totalTime / iterations;
    const opsPerSecond = 1000 / avgTime;
    const minTime = Math.min(...times);
    const maxTime = Math.max(...times);

    const result: BenchmarkResult = {
      name,
      iterations,
      totalTime,
      avgTime,
      opsPerSecond,
      minTime,
      maxTime
    };

    this.results.push(result);
    return result;
  }

  printResults(): void {
    console.log('\n' + '='.repeat(80));
    console.log('HYPERTOKEN PERFORMANCE BENCHMARKS');
    console.log('='.repeat(80) + '\n');

    for (const result of this.results) {
      console.log(`📊 ${result.name}`);
      console.log(`   Iterations: ${result.iterations.toLocaleString()}`);
      console.log(`   Total Time: ${result.totalTime.toFixed(2)} ms`);
      console.log(`   Avg Time:   ${result.avgTime.toFixed(4)} ms`);
      console.log(`   Ops/Sec:    ${Math.floor(result.opsPerSecond).toLocaleString()}`);
      console.log(`   Min Time:   ${result.minTime.toFixed(4)} ms`);
      console.log(`   Max Time:   ${result.maxTime.toFixed(4)} ms`);
      console.log('');
    }

    console.log('='.repeat(80));
  }

  getSummary(): string {
    const lines = ['', 'Performance Summary:', ''];

    for (const result of this.results) {
      lines.push(`${result.name}: ${Math.floor(result.opsPerSecond).toLocaleString()} ops/sec (${result.avgTime.toFixed(4)} ms avg)`);
    }

    return lines.join('\n');
  }
}

// ============================================================
// Helper Functions
// ============================================================

function createTestToken(id: string): Token {
  return new Token({
    id,
    label: `Token ${id}`,
    meta: { value: Math.floor(Math.random() * 100) }
  });
}

function createTestTokens(count: number): Token[] {
  const tokens: Token[] = [];
  for (let i = 0; i < count; i++) {
    tokens.push(createTestToken(`token-${i}`));
  }
  return tokens;
}

// ============================================================
// Engine Benchmarks
// ============================================================

function benchmarkEngine(runner: BenchmarkRunner): void {
  console.log('⚙️  Running Engine Benchmarks...\n');

  // Simple action dispatch
  runner.benchmarkAsync('Engine: Simple action dispatch (debug:log)', async () => {
    const engine = new Engine();
    await engine.dispatch('debug:log', { msg: 'test' });
  }, 10000);

  // Stack creation and dispatch - setup once, benchmark the action
  runner.benchmarkAsync('Engine: Create with Stack and draw action', async () => {
    const chronicle = new Chronicle();
    const tokens = createTestTokens(52);
    const stack = new Stack(chronicle, tokens);
    const engine = new Engine({ stack });
    await engine.dispatch('stack:draw', { count: 1 });
  }, 100); // Reduced from 1000 to avoid CRDT overload

  // Multiple action dispatch
  runner.benchmarkAsync('Engine: Dispatch 10 sequential actions', async () => {
    const chronicle = new Chronicle();
    const tokens = createTestTokens(52);
    const stack = new Stack(chronicle, tokens);
    const engine = new Engine({ stack });

    for (let i = 0; i < 10; i++) {
      await engine.dispatch('stack:draw', { count: 1 });
    }
  }, 50); // Reduced from 500 to avoid CRDT overload

  // Policy evaluation overhead
  runner.benchmarkAsync('Engine: Action dispatch with 5 policies', async () => {
    const engine = new Engine();

    for (let i = 0; i < 5; i++) {
      engine.registerPolicy(`policy-${i}`, {
        evaluate: () => { /* no-op */ }
      });
    }

    await engine.dispatch('debug:log', { msg: 'test' });
  }, 5000);
}

// ============================================================
// Token Benchmarks
// ============================================================

function benchmarkTokens(runner: BenchmarkRunner): void {
  console.log('🎴 Running Token Benchmarks...\n');

  // Token creation
  runner.benchmark('Token: Create single token', () => {
    new Token({
      id: 'test-token',
      label: 'Test Token',
      meta: { value: 42, type: 'test' }
    });
  }, 50000);

  // Token creation in batch
  runner.benchmark('Token: Create 100 tokens', () => {
    createTestTokens(100);
  }, 1000);

  // Token metadata access
  runner.benchmark('Token: Metadata read operations (10k reads)', () => {
    const token = createTestToken('test');
    for (let i = 0; i < 10000; i++) {
      const _value = token.meta.value;
    }
  }, 100);

  // Token metadata modification
  runner.benchmark('Token: Metadata write operations (1k writes)', () => {
    const token = createTestToken('test');
    for (let i = 0; i < 1000; i++) {
      token.meta.value = i;
    }
  }, 1000);
}

// ============================================================
// Stack Benchmarks
// ============================================================

function benchmarkStack(runner: BenchmarkRunner): void {
  console.log('🃏 Running Stack Benchmarks...\n');

  // Stack creation
  runner.benchmark('Stack: Create with 52 tokens', () => {
    const chronicle = new Chronicle();
    const tokens = createTestTokens(52);
    new Stack(chronicle, tokens);
  }, 100); // Reduced to avoid CRDT overload

  // Stack shuffle
  runner.benchmark('Stack: Shuffle 52 tokens', () => {
    const chronicle = new Chronicle();
    const tokens = createTestTokens(52);
    const stack = new Stack(chronicle, tokens);
    stack.shuffle();
  }, 100); // Reduced to avoid CRDT overload

  // Stack draw
  runner.benchmark('Stack: Draw single card', () => {
    const chronicle = new Chronicle();
    const tokens = createTestTokens(52);
    const stack = new Stack(chronicle, tokens);
    stack.draw(1);
  }, 100); // Reduced to avoid CRDT overload

  // Stack draw multiple
  runner.benchmark('Stack: Draw 5 cards', () => {
    const chronicle = new Chronicle();
    const tokens = createTestTokens(52);
    const stack = new Stack(chronicle, tokens);
    stack.draw(5);
  }, 100); // Reduced to avoid CRDT overload

  // Large stack operations
  runner.benchmark('Stack: Create with 1000 tokens', () => {
    const chronicle = new Chronicle();
    const tokens = createTestTokens(1000);
    new Stack(chronicle, tokens);
  }, 50); // Reduced to avoid CRDT overload

  runner.benchmark('Stack: Shuffle 1000 tokens', () => {
    const chronicle = new Chronicle();
    const tokens = createTestTokens(1000);
    const stack = new Stack(chronicle, tokens);
    stack.shuffle();
  }, 50); // Reduced to avoid CRDT overload
}

// ============================================================
// Space Benchmarks
// ============================================================

function benchmarkSpace(runner: BenchmarkRunner): void {
  console.log('🌌 Running Space Benchmarks...\n');

  // Space creation
  runner.benchmark('Space: Create space', () => {
    const chronicle = new Chronicle();
    new Space(chronicle, 'test-space');
  }, 100); // Reduced to avoid CRDT overload

  // Place tokens
  runner.benchmark('Space: Place single token', () => {
    const chronicle = new Chronicle();
    const space = new Space(chronicle, 'test');
    const token = createTestToken('test');
    space.place('zone1', token);
  }, 100); // Reduced to avoid CRDT overload

  // Place multiple tokens
  runner.benchmark('Space: Place 10 tokens', () => {
    const chronicle = new Chronicle();
    const space = new Space(chronicle, 'test');
    const tokens = createTestTokens(10);
    tokens.forEach(token => space.place('zone1', token));
  }, 100); // Reduced to avoid CRDT overload

  // Move tokens between zones
  runner.benchmark('Space: Move token between zones', () => {
    const chronicle = new Chronicle();
    const space = new Space(chronicle, 'test');
    const token = createTestToken('test');
    space.place('zone1', token);
    space.move(token.id, 'zone1', 'zone2');
  }, 100); // Reduced to avoid CRDT overload

  // Query space
  runner.benchmark('Space: Query cards in zone (100 tokens)', () => {
    const chronicle = new Chronicle();
    const space = new Space(chronicle, 'test');
    const tokens = createTestTokens(100);
    tokens.forEach(token => space.place('zone1', token));
    space.cards('zone1');
  }, 50); // Reduced to avoid CRDT overload
}

// ============================================================
// CRDT (Chronicle) Benchmarks
// ============================================================

function benchmarkCRDT(runner: BenchmarkRunner): void {
  console.log('📜 Running CRDT (Chronicle) Benchmarks...\n');

  // Chronicle creation
  runner.benchmark('Chronicle: Create instance', () => {
    new Chronicle();
  }, 100); // Reduced to avoid CRDT overload

  // Single change
  runner.benchmark('Chronicle: Apply single change', () => {
    const chronicle = new Chronicle();
    chronicle.change('test', (doc) => {
      doc.testValue = 42;
    });
  }, 100); // Reduced to avoid CRDT overload

  // Multiple changes
  runner.benchmark('Chronicle: Apply 10 changes', () => {
    const chronicle = new Chronicle();
    for (let i = 0; i < 10; i++) {
      chronicle.change(`change-${i}`, (doc) => {
        doc[`value${i}`] = i;
      });
    }
  }, 50); // Reduced to avoid CRDT overload

  // Save to binary
  runner.benchmark('Chronicle: Save to binary (after 10 changes)', () => {
    const chronicle = new Chronicle();
    for (let i = 0; i < 10; i++) {
      chronicle.change(`change-${i}`, (doc) => {
        doc[`value${i}`] = i;
      });
    }
    chronicle.save();
  }, 50); // Reduced to avoid CRDT overload

  // Load from binary
  runner.benchmark('Chronicle: Load from binary', () => {
    const chronicle = new Chronicle();
    for (let i = 0; i < 10; i++) {
      chronicle.change(`change-${i}`, (doc) => {
        doc[`value${i}`] = i;
      });
    }
    const saved = chronicle.save();

    const chronicle2 = new Chronicle();
    chronicle2.load(saved);
  }, 50); // Reduced to avoid CRDT overload

  // Base64 encoding
  runner.benchmark('Chronicle: Save to Base64', () => {
    const chronicle = new Chronicle();
    for (let i = 0; i < 10; i++) {
      chronicle.change(`change-${i}`, (doc) => {
        doc[`value${i}`] = i;
      });
    }
    chronicle.saveToBase64();
  }, 50); // Reduced to avoid CRDT overload

  // Merge two documents
  runner.benchmark('Chronicle: Merge two documents (10 changes each)', () => {
    const chronicle1 = new Chronicle();
    const chronicle2 = new Chronicle();

    for (let i = 0; i < 10; i++) {
      chronicle1.change(`change-a-${i}`, (doc) => {
        doc[`valueA${i}`] = i;
      });
      chronicle2.change(`change-b-${i}`, (doc) => {
        doc[`valueB${i}`] = i;
      });
    }

    chronicle1.merge(chronicle2.state);
  }, 50); // Reduced to avoid CRDT overload
}

// ============================================================
// Large-Scale State Benchmarks
// ============================================================

function benchmarkLargeScale(runner: BenchmarkRunner): void {
  console.log('🏗️  Running Large-Scale State Benchmarks...\n');

  // Large engine state
  runner.benchmark('Large: Engine with 10 stacks (52 tokens each)', () => {
    const chronicle = new Chronicle();
    const stacks = [];

    for (let i = 0; i < 10; i++) {
      const tokens = createTestTokens(52);
      stacks.push(new Stack(chronicle, tokens));
    }
  }, 10); // Reduced to avoid CRDT overload

  // Large space operations
  runner.benchmark('Large: Space with 1000 tokens placed', () => {
    const chronicle = new Chronicle();
    const space = new Space(chronicle, 'large');
    const tokens = createTestTokens(1000);

    tokens.forEach(token => space.place('zone1', token));
  }, 5); // Reduced to avoid CRDT overload

  // Complex engine state snapshot
  runner.benchmarkAsync('Large: Snapshot engine with complex state', async () => {
    const chronicle = new Chronicle();
    const tokens = createTestTokens(100);
    const stack = new Stack(chronicle, tokens);
    const space = new Space(chronicle, 'test');
    const engine = new Engine({ stack, space });

    // Add some complexity
    for (let i = 0; i < 20; i++) {
      await engine.dispatch('stack:draw', { count: 1 });
    }

    engine.snapshot();
  }, 10); // Reduced to avoid CRDT overload

  // Source operations
  runner.benchmark('Large: Source with 1000 tokens', () => {
    const chronicle = new Chronicle();
    const tokens = createTestTokens(1000);
    const stack = new Stack(chronicle, tokens);
    new Source(chronicle, [stack]);
  }, 10); // Reduced to avoid CRDT overload
}

// ============================================================
// Composite Benchmarks (Real-World Scenarios)
// ============================================================

function benchmarkRealWorld(runner: BenchmarkRunner): void {
  console.log('🎮 Running Real-World Scenario Benchmarks...\n');

  // Blackjack hand deal
  runner.benchmarkAsync('Scenario: Deal blackjack hand (2 cards, 2 players)', async () => {
    const chronicle = new Chronicle();
    const tokens = createTestTokens(52);
    const stack = new Stack(chronicle, tokens);
    const engine = new Engine({ stack });

    stack.shuffle();
    await engine.dispatch('stack:draw', { count: 2 });
    await engine.dispatch('stack:draw', { count: 2 });
  }, 50); // Reduced to avoid CRDT overload

  // Card game round
  runner.benchmarkAsync('Scenario: Complete card game round (4 players, 5 cards each)', async () => {
    const chronicle = new Chronicle();
    const tokens = createTestTokens(52);
    const stack = new Stack(chronicle, tokens);
    const space = new Space(chronicle, 'game');
    const engine = new Engine({ stack, space });

    stack.shuffle();

    for (let player = 0; player < 4; player++) {
      const cards = await engine.dispatch('stack:draw', { count: 5 });
      if (cards) {
        cards.forEach((card: Token) => space.place(`player${player}`, card));
      }
    }
  }, 25); // Reduced to avoid CRDT overload

  // Token filtering and manipulation (native array operations)
  runner.benchmark('Scenario: Filter and modify 200 tokens', () => {
    const tokens = createTestTokens(200);

    const filtered = tokens.filter((token: Token) => token.meta.value > 30);

    filtered.forEach((token: Token) => {
      token.meta.boosted = true;
      token.meta.value *= 2;
    });
  }, 500);

  // State persistence
  runner.benchmarkAsync('Scenario: Save and restore complete game state', async () => {
    const chronicle = new Chronicle();
    const tokens = createTestTokens(52);
    const stack = new Stack(chronicle, tokens);
    const space = new Space(chronicle, 'game');
    const engine = new Engine({ stack, space });

    // Simulate game actions
    stack.shuffle();
    for (let i = 0; i < 10; i++) {
      await engine.dispatch('stack:draw', { count: 1 });
    }

    // Save state
    const snapshot = engine.snapshot();

    // Restore state
    const engine2 = new Engine();
    engine2.restore(snapshot);
  }, 25); // Reduced to avoid CRDT overload
}

// ============================================================
// Main Benchmark Suite
// ============================================================

async function runAllBenchmarks(): Promise<void> {
  const runner = new BenchmarkRunner();

  console.log('\n🎯 HyperToken Performance Benchmark Suite');
  if (typeof process !== 'undefined') {
    console.log(`   Running on Node.js ${process.version}`);
    console.log(`   Platform: ${process.platform} ${process.arch}`);
  }
  console.log('');

  benchmarkEngine(runner);
  benchmarkTokens(runner);
  benchmarkStack(runner);
  benchmarkSpace(runner);
  benchmarkCRDT(runner);
  benchmarkLargeScale(runner);
  benchmarkRealWorld(runner);

  runner.printResults();

  console.log('\n✅ All benchmarks completed!\n');

  // Force exit since event listeners may keep process alive
  process.exit(0);
}

// Run benchmarks
runAllBenchmarks().catch((err) => {
  console.error('Benchmark failed:', err);
  process.exit(1);
});
