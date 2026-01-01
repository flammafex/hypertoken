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
 * Test suite for random utilities
 * Tests: mulberry32 PRNG, shuffleArray with and without seed
 */

import { mulberry32, shuffleArray } from '../core/random.js';

// Test helpers
let testCount = 0;
let passCount = 0;
let failCount = 0;

function test(name: string, fn: () => void) {
  testCount++;
  try {
    fn();
    passCount++;
    console.log(`✓ ${name}`);
  } catch (err: any) {
    failCount++;
    console.error(`✗ ${name}`);
    console.error(`  ${err.message}`);
  }
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

console.log('\n🧪 Testing Random Utilities\n');
console.log('═'.repeat(60));

// ============================================================================
// mulberry32() TESTS
// ============================================================================

console.log('\n🎲 mulberry32() PRNG Tests\n');

test('mulberry32() returns a function', () => {
  const rng = mulberry32(12345);

  assert(typeof rng === 'function', 'Should return a function');
});

test('mulberry32() generates numbers in [0, 1) range', () => {
  const rng = mulberry32(12345);

  for (let i = 0; i < 100; i++) {
    const value = rng();

    assert(value >= 0, `Value should be >= 0, got ${value}`);
    assert(value < 1, `Value should be < 1, got ${value}`);
  }
});

test('mulberry32() with same seed produces same sequence', () => {
  const rng1 = mulberry32(54321);
  const rng2 = mulberry32(54321);

  const sequence1 = [rng1(), rng1(), rng1(), rng1(), rng1()];
  const sequence2 = [rng2(), rng2(), rng2(), rng2(), rng2()];

  for (let i = 0; i < 5; i++) {
    assertEquals(sequence1[i], sequence2[i], `Value ${i} should match`);
  }
});

test('mulberry32() with different seeds produces different sequences', () => {
  const rng1 = mulberry32(11111);
  const rng2 = mulberry32(22222);

  const val1 = rng1();
  const val2 = rng2();

  assert(val1 !== val2, 'Different seeds should produce different values');
});

test('mulberry32() generates well-distributed values', () => {
  const rng = mulberry32(99999);
  const values: number[] = [];

  for (let i = 0; i < 1000; i++) {
    values.push(rng());
  }

  const mean = values.reduce((sum, v) => sum + v, 0) / values.length;

  // Mean should be close to 0.5
  assert(mean > 0.4 && mean < 0.6, `Mean should be ~0.5, got ${mean}`);
});

test('mulberry32() is repeatable after recreation', () => {
  const seed = 77777;

  const rng1 = mulberry32(seed);
  const value1 = rng1();
  const value2 = rng1();

  // Recreate with same seed
  const rng2 = mulberry32(seed);
  const value3 = rng2();
  const value4 = rng2();

  assertEquals(value1, value3, 'First values should match');
  assertEquals(value2, value4, 'Second values should match');
});

test('mulberry32() handles edge case seeds', () => {
  const seeds = [0, 1, -1, 0xFFFFFFFF, 0x80000000];

  for (const seed of seeds) {
    const rng = mulberry32(seed);
    const value = rng();

    assert(value >= 0 && value < 1, `Seed ${seed} should produce valid value`);
  }
});

// ============================================================================
// shuffleArray() TESTS
// ============================================================================

console.log('\n🔀 shuffleArray() Tests\n');

test('shuffleArray() returns an array', () => {
  const arr = [1, 2, 3, 4, 5];
  const shuffled = shuffleArray(arr);

  assert(Array.isArray(shuffled), 'Should return an array');
});

test('shuffleArray() preserves array length', () => {
  const arr = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
  const shuffled = shuffleArray(arr);

  assertEquals(shuffled.length, 10, 'Length should be preserved');
});

test('shuffleArray() preserves all elements', () => {
  const arr = [1, 2, 3, 4, 5];
  const shuffled = shuffleArray([...arr]); // Copy to avoid mutation

  const sorted = [...shuffled].sort((a, b) => a - b);

  for (let i = 0; i < arr.length; i++) {
    assertEquals(sorted[i], arr[i], `Element ${arr[i]} should be preserved`);
  }
});

test('shuffleArray() with seed is deterministic', () => {
  const arr = [1, 2, 3, 4, 5, 6, 7, 8];

  const shuffled1 = shuffleArray([...arr], 12345);
  const shuffled2 = shuffleArray([...arr], 12345);

  for (let i = 0; i < arr.length; i++) {
    assertEquals(shuffled1[i], shuffled2[i], `Position ${i} should match`);
  }
});

test('shuffleArray() with different seeds produces different results', () => {
  const arr = [1, 2, 3, 4, 5, 6, 7, 8];

  const shuffled1 = shuffleArray([...arr], 11111);
  const shuffled2 = shuffleArray([...arr], 22222);

  let differences = 0;
  for (let i = 0; i < arr.length; i++) {
    if (shuffled1[i] !== shuffled2[i]) {
      differences++;
    }
  }

  assert(differences > 0, 'Different seeds should produce different orders');
});

test('shuffleArray() without seed uses Math.random', () => {
  const arr = [1, 2, 3, 4, 5, 6, 7, 8];

  const shuffled1 = shuffleArray([...arr]);
  const shuffled2 = shuffleArray([...arr]);

  let differences = 0;
  for (let i = 0; i < arr.length; i++) {
    if (shuffled1[i] !== shuffled2[i]) {
      differences++;
    }
  }

  // Should be different (very unlikely to be the same)
  assert(differences > 0, 'Without seed, shuffles should differ');
});

test('shuffleArray() actually shuffles (not identity)', () => {
  const arr = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
  const shuffled = shuffleArray([...arr], 99999);

  let identical = true;
  for (let i = 0; i < arr.length; i++) {
    if (arr[i] !== shuffled[i]) {
      identical = false;
      break;
    }
  }

  assert(!identical, 'Shuffled array should not be identical to original');
});

test('shuffleArray() works with empty array', () => {
  const arr: number[] = [];
  const shuffled = shuffleArray(arr);

  assertEquals(shuffled.length, 0, 'Empty array should remain empty');
});

test('shuffleArray() works with single element', () => {
  const arr = [42];
  const shuffled = shuffleArray([...arr]);

  assertEquals(shuffled.length, 1, 'Should have 1 element');
  assertEquals(shuffled[0], 42, 'Element should be preserved');
});

test('shuffleArray() works with two elements', () => {
  const arr = ['A', 'B'];

  // With seed, should be deterministic
  const shuffled1 = shuffleArray([...arr], 111);
  const shuffled2 = shuffleArray([...arr], 111);

  assertEquals(shuffled1[0], shuffled2[0], 'Same seed should produce same order');
  assert(shuffled1.includes('A') && shuffled1.includes('B'), 'Both elements should be present');
});

test('shuffleArray() works with different data types', () => {
  const strings = ['apple', 'banana', 'cherry', 'date'];
  const shuffled = shuffleArray([...strings], 777);

  assertEquals(shuffled.length, 4, 'String array should preserve length');
  assert(shuffled.includes('apple'), 'All strings should be present');
});

test('shuffleArray() is in-place mutation', () => {
  const arr = [1, 2, 3, 4, 5];
  const original = arr;
  const shuffled = shuffleArray(arr, 555);

  assert(shuffled === original, 'Should return same array reference');
});

// ============================================================================
// STATISTICAL TESTS
// ============================================================================

console.log('\n📊 Statistical Distribution Tests\n');

test('shuffleArray() produces uniform distribution', () => {
  const arr = [0, 1, 2, 3, 4];
  const counts: number[][] = arr.map(() => arr.map(() => 0));

  const iterations = 1000;

  for (let i = 0; i < iterations; i++) {
    const shuffled = shuffleArray([...arr], i);

    for (let pos = 0; pos < arr.length; pos++) {
      counts[pos][shuffled[pos]]++;
    }
  }

  // Each element should appear in each position roughly equally
  const expected = iterations / arr.length;
  const tolerance = 0.3; // 30% tolerance

  for (let pos = 0; pos < arr.length; pos++) {
    for (let value = 0; value < arr.length; value++) {
      const count = counts[pos][value];
      const diff = Math.abs(count - expected);
      const ratio = diff / expected;

      assert(
        ratio < tolerance,
        `Position ${pos}, value ${value}: count ${count} too far from expected ${expected}`
      );
    }
  }
});

test('mulberry32() consecutive values are not correlated', () => {
  const rng = mulberry32(12345);
  const values: number[] = [];

  for (let i = 0; i < 100; i++) {
    values.push(rng());
  }

  // Check that consecutive values don't have obvious pattern
  let consecutiveIncreases = 0;

  for (let i = 1; i < values.length; i++) {
    if (values[i] > values[i - 1]) {
      consecutiveIncreases++;
    }
  }

  // Should be roughly 50% increases
  const ratio = consecutiveIncreases / (values.length - 1);

  assert(ratio > 0.4 && ratio < 0.6, `Increase ratio should be ~0.5, got ${ratio}`);
});

// ============================================================================
// INTEGRATION
// ============================================================================

console.log('\n🎯 Integration Tests\n');

test('Complete shuffle workflow with seed', () => {
  // Simulate a card deck shuffle
  const deck = [];
  for (let i = 1; i <= 52; i++) {
    deck.push(i);
  }

  const seed = 202511;
  const shuffled = shuffleArray([...deck], seed);

  // Verify all cards present
  assertEquals(shuffled.length, 52, 'All 52 cards should be present');

  const sorted = [...shuffled].sort((a, b) => a - b);
  for (let i = 0; i < 52; i++) {
    assertEquals(sorted[i], i + 1, `Card ${i + 1} should be present`);
  }

  // Verify reproducible
  const shuffled2 = shuffleArray([...deck], seed);
  for (let i = 0; i < 52; i++) {
    assertEquals(shuffled[i], shuffled2[i], `Position ${i} should match`);
  }
});

// ============================================================================
// RESULTS
// ============================================================================

console.log('\n' + '═'.repeat(60));
console.log(`\n📊 Test Results: ${passCount}/${testCount} passed\n`);

if (failCount === 0) {
  console.log('🎉 All random utility tests passed!\n');
  process.exit(0);
} else {
  console.log(`❌ ${failCount} tests failed\n`);
  process.exit(1);
}
