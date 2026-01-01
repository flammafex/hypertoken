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
 * Test suite for crypto utilities
 * Tests: ID generation, peer ID generation, seed generation
 */

import { generateId, generatePeerId, generateSeed } from '../core/crypto.js';

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

function assertMatch(value: string, pattern: RegExp, message: string) {
  if (!pattern.test(value)) {
    throw new Error(message || `"${value}" does not match ${pattern}`);
  }
}

console.log('\n🧪 Testing Crypto Utilities\n');
console.log('═'.repeat(60));

// ============================================================================
// generateId() TESTS
// ============================================================================

console.log('\n🔑 generateId() Tests\n');

test('generateId() returns non-empty string', () => {
  const id = generateId();

  assert(typeof id === 'string', 'Should return a string');
  assert(id.length > 0, 'Should not be empty');
});

test('generateId() generates unique IDs', () => {
  const id1 = generateId();
  const id2 = generateId();
  const id3 = generateId();

  assert(id1 !== id2, 'First and second IDs should be different');
  assert(id2 !== id3, 'Second and third IDs should be different');
  assert(id1 !== id3, 'First and third IDs should be different');
});

test('generateId() generates many unique IDs', () => {
  const ids = new Set();
  const count = 1000;

  for (let i = 0; i < count; i++) {
    ids.add(generateId());
  }

  assert(ids.size === count, `Should generate ${count} unique IDs`);
});

test('generateId() format is valid UUID or fallback', () => {
  const id = generateId();

  // Should be either UUID format or timestamp-random format
  const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  const fallbackPattern = /^\d+-[0-9a-z]+$/;

  const isValid = uuidPattern.test(id) || fallbackPattern.test(id);

  assert(isValid, `ID should match UUID or fallback format: ${id}`);
});

// ============================================================================
// generatePeerId() TESTS
// ============================================================================

console.log('\n👥 generatePeerId() Tests\n');

test('generatePeerId() returns string with peer prefix', () => {
  const peerId = generatePeerId();

  assert(typeof peerId === 'string', 'Should return a string');
  assert(peerId.startsWith('peer-'), 'Should start with "peer-"');
});

test('generatePeerId() has correct length', () => {
  const peerId = generatePeerId();

  // "peer-" (5 chars) + 7 random chars = 12 total
  assert(peerId.length === 12, `Should be 12 characters, got ${peerId.length}`);
});

test('generatePeerId() generates unique peer IDs', () => {
  const peerId1 = generatePeerId();
  const peerId2 = generatePeerId();
  const peerId3 = generatePeerId();

  assert(peerId1 !== peerId2, 'First and second peer IDs should be different');
  assert(peerId2 !== peerId3, 'Second and third peer IDs should be different');
  assert(peerId1 !== peerId3, 'First and third peer IDs should be different');
});

test('generatePeerId() uses valid characters', () => {
  const peerId = generatePeerId();
  const suffix = peerId.substring(5); // Remove "peer-" prefix

  // Should only contain alphanumeric characters (base36)
  assertMatch(suffix, /^[0-9a-z]+$/, 'Suffix should only contain 0-9 and a-z');
});

test('generatePeerId() generates many unique IDs', () => {
  const peerIds = new Set();
  const count = 500;

  for (let i = 0; i < count; i++) {
    peerIds.add(generatePeerId());
  }

  // There might be rare collisions with 7 chars, but should be very rare
  assert(peerIds.size >= count * 0.99, 'Should generate mostly unique peer IDs');
});

// ============================================================================
// generateSeed() TESTS
// ============================================================================

console.log('\n🌱 generateSeed() Tests\n');

test('generateSeed() returns a number', () => {
  const seed = generateSeed();

  assert(typeof seed === 'number', 'Should return a number');
  assert(Number.isFinite(seed), 'Should be a finite number');
  assert(Number.isInteger(seed), 'Should be an integer');
});

test('generateSeed() is non-negative', () => {
  const seed = generateSeed();

  assert(seed >= 0, 'Seed should be non-negative');
});

test('generateSeed() is within 32-bit range', () => {
  const seed = generateSeed();

  assert(seed <= 0xFFFFFFFF, 'Seed should fit in 32 bits');
});

test('generateSeed() generates different seeds', () => {
  const seed1 = generateSeed();
  const seed2 = generateSeed();
  const seed3 = generateSeed();

  // Very unlikely to get same seed twice
  const allSame = seed1 === seed2 && seed2 === seed3;

  assert(!allSame, 'Seeds should generally be different');
});

test('generateSeed() generates varied seeds', () => {
  const seeds = new Set();
  const count = 100;

  for (let i = 0; i < count; i++) {
    seeds.add(generateSeed());
  }

  // Should have mostly unique seeds
  assert(seeds.size >= count * 0.95, 'Should generate mostly unique seeds');
});

test('generateSeed() distribution spans range', () => {
  const seeds: number[] = [];
  const count = 100;

  for (let i = 0; i < count; i++) {
    seeds.push(generateSeed());
  }

  const min = Math.min(...seeds);
  const max = Math.max(...seeds);

  // Range should be reasonably wide
  const range = max - min;
  const maxRange = 0xFFFFFFFF;

  assert(range > maxRange * 0.1, 'Seeds should span a reasonable range');
});

// ============================================================================
// INTEGRATION
// ============================================================================

console.log('\n🎯 Integration Tests\n');

test('All ID types can be used as object keys', () => {
  const id = generateId();
  const peerId = generatePeerId();

  const obj: Record<string, any> = {};
  obj[id] = 'value1';
  obj[peerId] = 'value2';

  assert(obj[id] === 'value1', 'ID should work as object key');
  assert(obj[peerId] === 'value2', 'Peer ID should work as object key');
});

test('IDs are suitable for database/storage', () => {
  const id = generateId();

  // No special characters that would break storage
  assertMatch(id, /^[0-9a-zA-Z\-]+$/, 'ID should only contain safe characters');
});

test('Seed can be used for PRNG initialization', () => {
  const seed = generateSeed();

  // Simulate PRNG initialization
  const prng = (s: number) => {
    let t = (s += 0x6D2B79F5) | 0;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    return t;
  };

  const value = prng(seed);

  assert(typeof value === 'number', 'PRNG should produce number');
  assert(Number.isInteger(value), 'PRNG should produce integer');
});

// ============================================================================
// RESULTS
// ============================================================================

console.log('\n' + '═'.repeat(60));
console.log(`\n📊 Test Results: ${passCount}/${testCount} passed\n`);

if (failCount === 0) {
  console.log('🎉 All crypto utility tests passed!\n');
  process.exit(0);
} else {
  console.log(`❌ ${failCount} tests failed\n`);
  process.exit(1);
}
