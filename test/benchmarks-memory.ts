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
 * Memory Usage Benchmarks for HyperToken
 *
 * Tests memory consumption and garbage collection behavior for:
 * - Token storage
 * - CRDT state growth
 * - Engine state management
 * - Large-scale simulations
 */

import { Engine } from '../engine/Engine.js';
import { Stack } from '../core/Stack.js';
import { Space } from '../core/Space.js';
import { Source } from '../core/Source.js';
import { Token } from '../core/Token.js';
import { Chronicle } from '../core/Chronicle.js';

// ============================================================
// Memory Measurement Utilities
// ============================================================

interface MemorySnapshot {
  heapUsed: number;
  heapTotal: number;
  external: number;
  arrayBuffers: number;
}

function getMemoryUsage(): MemorySnapshot {
  if (typeof process === 'undefined') {
    return { heapUsed: 0, heapTotal: 0, external: 0, arrayBuffers: 0 };
  }
  const mem = process.memoryUsage();
  return {
    heapUsed: mem.heapUsed,
    heapTotal: mem.heapTotal,
    external: mem.external,
    arrayBuffers: mem.arrayBuffers
  };
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(2)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

async function forceGC(): Promise<void> {
  if (typeof global !== 'undefined' && (global as any).gc) {
    (global as any).gc();
    // Wait a bit for GC to complete
    await new Promise(resolve => setTimeout(resolve, 100));
  }
}

async function measureMemory(name: string, fn: () => void | Promise<void>): Promise<void> {
  await forceGC();
  const before = getMemoryUsage();

  await fn();

  await forceGC();
  const after = getMemoryUsage();

  const heapDiff = after.heapUsed - before.heapUsed;
  const externalDiff = after.external - before.external;

  console.log(`\n📊 ${name}`);
  console.log(`   Heap Used:    ${formatBytes(before.heapUsed)} → ${formatBytes(after.heapUsed)} (Δ ${formatBytes(heapDiff)})`);
  console.log(`   External:     ${formatBytes(before.external)} → ${formatBytes(after.external)} (Δ ${formatBytes(externalDiff)})`);
  console.log(`   Total Impact: ${formatBytes(heapDiff + externalDiff)}`);
}

// ============================================================
// Helper Functions
// ============================================================

function createTestToken(id: string): Token {
  return new Token({
    id,
    label: `Token ${id}`,
    meta: {
      value: Math.floor(Math.random() * 100),
      type: 'test',
      description: 'A test token for benchmarking'
    }
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
// Token Memory Benchmarks
// ============================================================

async function benchmarkTokenMemory(): Promise<void> {
  console.log('\n' + '='.repeat(80));
  console.log('TOKEN MEMORY USAGE');
  console.log('='.repeat(80));

  await measureMemory('Single Token', () => {
    createTestToken('test');
  });

  await measureMemory('100 Tokens', () => {
    createTestTokens(100);
  });

  await measureMemory('1,000 Tokens', () => {
    createTestTokens(1000);
  });

  await measureMemory('10,000 Tokens', () => {
    createTestTokens(10000);
  });

  await measureMemory('100,000 Tokens', () => {
    createTestTokens(100000);
  });
}

// ============================================================
// Stack Memory Benchmarks
// ============================================================

async function benchmarkStackMemory(): Promise<void> {
  console.log('\n' + '='.repeat(80));
  console.log('STACK MEMORY USAGE');
  console.log('='.repeat(80));

  await measureMemory('Stack with 52 tokens', () => {
    const chronicle = new Chronicle();
    const tokens = createTestTokens(52);
    new Stack(chronicle, tokens);
  });

  await measureMemory('Stack with 1,000 tokens', () => {
    const chronicle = new Chronicle();
    const tokens = createTestTokens(1000);
    new Stack(chronicle, tokens);
  });

  await measureMemory('10 Stacks with 52 tokens each', () => {
    const chronicle = new Chronicle();
    for (let i = 0; i < 10; i++) {
      const tokens = createTestTokens(52);
      new Stack(chronicle, tokens);
    }
  });

  await measureMemory('Stack with 10,000 tokens', () => {
    const chronicle = new Chronicle();
    const tokens = createTestTokens(10000);
    new Stack(chronicle, tokens);
  });
}

// ============================================================
// Space Memory Benchmarks
// ============================================================

async function benchmarkSpaceMemory(): Promise<void> {
  console.log('\n' + '='.repeat(80));
  console.log('SPACE MEMORY USAGE');
  console.log('='.repeat(80));

  await measureMemory('Empty Space', () => {
    const chronicle = new Chronicle();
    new Space(chronicle, 'test');
  });

  await measureMemory('Space with 100 tokens placed', () => {
    const chronicle = new Chronicle();
    const space = new Space(chronicle, 'test');
    const tokens = createTestTokens(100);
    tokens.forEach(token => space.place('zone1', token));
  });

  await measureMemory('Space with 1,000 tokens placed', () => {
    const chronicle = new Chronicle();
    const space = new Space(chronicle, 'test');
    const tokens = createTestTokens(1000);
    tokens.forEach(token => space.place('zone1', token));
  });

  await measureMemory('Space with 10 zones, 100 tokens each', () => {
    const chronicle = new Chronicle();
    const space = new Space(chronicle, 'test');

    for (let zone = 0; zone < 10; zone++) {
      const tokens = createTestTokens(100);
      tokens.forEach(token => space.place(`zone${zone}`, token));
    }
  });

  await measureMemory('Space with 10,000 tokens placed', () => {
    const chronicle = new Chronicle();
    const space = new Space(chronicle, 'test');
    const tokens = createTestTokens(10000);
    tokens.forEach(token => space.place('zone1', token));
  });
}

// ============================================================
// CRDT Memory Benchmarks
// ============================================================

async function benchmarkCRDTMemory(): Promise<void> {
  console.log('\n' + '='.repeat(80));
  console.log('CRDT (CHRONICLE) MEMORY USAGE');
  console.log('='.repeat(80));

  await measureMemory('Empty Chronicle', () => {
    new Chronicle();
  });

  await measureMemory('Chronicle with 10 changes', () => {
    const chronicle = new Chronicle();
    for (let i = 0; i < 10; i++) {
      chronicle.change(`change-${i}`, (doc) => {
        doc[`value${i}`] = { data: `test-${i}`, count: i };
      });
    }
  });

  await measureMemory('Chronicle with 100 changes', () => {
    const chronicle = new Chronicle();
    for (let i = 0; i < 100; i++) {
      chronicle.change(`change-${i}`, (doc) => {
        doc[`value${i}`] = { data: `test-${i}`, count: i };
      });
    }
  });

  await measureMemory('Chronicle with 1,000 changes', () => {
    const chronicle = new Chronicle();
    for (let i = 0; i < 1000; i++) {
      chronicle.change(`change-${i}`, (doc) => {
        doc[`value${i}`] = { data: `test-${i}`, count: i };
      });
    }
  });

  await measureMemory('Chronicle serialized to binary', () => {
    const chronicle = new Chronicle();
    for (let i = 0; i < 100; i++) {
      chronicle.change(`change-${i}`, (doc) => {
        doc[`value${i}`] = { data: `test-${i}`, count: i };
      });
    }
    chronicle.save();
  });

  await measureMemory('Chronicle merge (2 docs, 100 changes each)', () => {
    const chronicle1 = new Chronicle();
    const chronicle2 = new Chronicle();

    for (let i = 0; i < 100; i++) {
      chronicle1.change(`change-a-${i}`, (doc) => {
        doc[`valueA${i}`] = i;
      });
      chronicle2.change(`change-b-${i}`, (doc) => {
        doc[`valueB${i}`] = i;
      });
    }

    chronicle1.merge(chronicle2.state);
  });
}

// ============================================================
// Engine Memory Benchmarks
// ============================================================

async function benchmarkEngineMemory(): Promise<void> {
  console.log('\n' + '='.repeat(80));
  console.log('ENGINE MEMORY USAGE');
  console.log('='.repeat(80));

  await measureMemory('Empty Engine', () => {
    new Engine();
  });

  await measureMemory('Engine with Stack (52 tokens)', () => {
    const chronicle = new Chronicle();
    const tokens = createTestTokens(52);
    const stack = new Stack(chronicle, tokens);
    new Engine({ stack });
  });

  await measureMemory('Engine with Stack and Space', () => {
    const chronicle = new Chronicle();
    const tokens = createTestTokens(52);
    const stack = new Stack(chronicle, tokens);
    const space = new Space(chronicle, 'game');
    new Engine({ stack, space });
  });

  await measureMemory('Engine with 100 action dispatches', async () => {
    const chronicle = new Chronicle();
    const tokens = createTestTokens(100);
    const stack = new Stack(chronicle, tokens);
    const engine = new Engine({ stack });

    for (let i = 0; i < 100; i++) {
      await engine.dispatch('stack:draw', { count: 1 });
    }
  });

  await measureMemory('Engine snapshot (complex state)', async () => {
    const chronicle = new Chronicle();
    const tokens = createTestTokens(100);
    const stack = new Stack(chronicle, tokens);
    const space = new Space(chronicle, 'game');
    const engine = new Engine({ stack, space });

    for (let i = 0; i < 50; i++) {
      await engine.dispatch('stack:draw', { count: 1 });
    }

    engine.snapshot();
  });

  await measureMemory('10 Independent Engines (52 tokens each)', () => {
    const engines = [];
    for (let i = 0; i < 10; i++) {
      const chronicle = new Chronicle();
      const tokens = createTestTokens(52);
      const stack = new Stack(chronicle, tokens);
      engines.push(new Engine({ stack }));
    }
  });
}

// ============================================================
// Real-World Scenario Memory Benchmarks
// ============================================================

async function benchmarkRealWorldMemory(): Promise<void> {
  console.log('\n' + '='.repeat(80));
  console.log('REAL-WORLD SCENARIO MEMORY USAGE');
  console.log('='.repeat(80));

  await measureMemory('Multiplayer card game (4 players, full deck)', () => {
    const chronicle = new Chronicle();
    const tokens = createTestTokens(52);
    const stack = new Stack(chronicle, tokens);
    const space = new Space(chronicle, 'game');
    const engine = new Engine({ stack, space });

    stack.shuffle();

    // Deal cards to 4 players
    for (let player = 0; player < 4; player++) {
      const cards = stack.draw(13);
      if (cards && Array.isArray(cards)) {
        cards.forEach((card: Token) => space.place(`player${player}`, card));
      }
    }
  });

  await measureMemory('Large simulation (1000 tokens, 500 actions)', async () => {
    const chronicle = new Chronicle();
    const tokens = createTestTokens(1000);
    const stack = new Stack(chronicle, tokens);
    const space = new Space(chronicle, 'simulation');
    const engine = new Engine({ stack, space });

    for (let i = 0; i < 500; i++) {
      if (i % 2 === 0) {
        await engine.dispatch('stack:draw', { count: 1 });
      } else {
        await engine.dispatch('stack:shuffle', {});
      }
    }
  });

  await measureMemory('Tournament system (10 games, 52 tokens each)', async () => {
    const games = [];
    for (let i = 0; i < 10; i++) {
      const chronicle = new Chronicle();
      const tokens = createTestTokens(52);
      const stack = new Stack(chronicle, tokens);
      const space = new Space(chronicle, `game${i}`);
      const engine = new Engine({ stack, space });

      stack.shuffle();
      for (let j = 0; j < 20; j++) {
        await engine.dispatch('stack:draw', { count: 1 });
      }

      games.push(engine);
    }
  });

  await measureMemory('Persistent world (large state with history)', async () => {
    const chronicle = new Chronicle();
    const tokens = createTestTokens(500);
    const stack = new Stack(chronicle, tokens);
    const space = new Space(chronicle, 'world');
    const sourceStack = new Stack(chronicle, createTestTokens(500));
    const source = new Source(chronicle, [sourceStack]);
    const engine = new Engine({ stack, space, source });

    // Simulate activity
    for (let i = 0; i < 200; i++) {
      await engine.dispatch('stack:shuffle', {});
      await engine.dispatch('stack:draw', { count: 5 });
      await engine.dispatch('source:draw', { count: 3 });
    }

    // Create snapshot
    engine.snapshot();
  });
}

// ============================================================
// Main Suite
// ============================================================

async function runMemoryBenchmarks(): Promise<void> {
  console.log('\n🧠 HyperToken Memory Usage Benchmark Suite');
  if (typeof process !== 'undefined') {
    console.log(`   Running on Node.js ${process.version}`);
    console.log(`   Platform: ${process.platform} ${process.arch}`);
  }

  if (typeof global === 'undefined' || !(global as any).gc) {
    console.log('\n⚠️  Warning: GC not exposed. Run with --expose-gc for accurate results.');
    console.log('   Example: node --expose-gc --loader ./test/ts-esm-loader.js test/benchmarks-memory.ts\n');
  }

  await benchmarkTokenMemory();
  await benchmarkStackMemory();
  await benchmarkSpaceMemory();
  await benchmarkCRDTMemory();
  await benchmarkEngineMemory();
  await benchmarkRealWorldMemory();

  console.log('\n' + '='.repeat(80));
  console.log('✅ All memory benchmarks completed!');
  console.log('='.repeat(80) + '\n');

  // Force exit since event listeners may keep process alive
  process.exit(0);
}

// Run benchmarks
runMemoryBenchmarks().catch((err) => {
  console.error('Benchmark failed:', err);
  process.exit(1);
});
