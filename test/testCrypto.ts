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

import { generateId } from '../core/crypto.js';

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
// INTEGRATION
// ============================================================================

console.log('\n🎯 Integration Tests\n');

test('IDs are suitable for database/storage', () => {
  const id = generateId();

  // No special characters that would break storage
  assertMatch(id, /^[0-9a-zA-Z\-]+$/, 'ID should only contain safe characters');
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
