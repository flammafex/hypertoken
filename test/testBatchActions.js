#!/usr/bin/env node
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

/**
 * Test suite for Batch/Query operations
 * Tests: filter, forEach, collect, count, find
 */

import { Engine } from '../engine/Engine.js';
import { EventBus } from '../core/EventBus.js';
import { Stack } from '../core/Stack.js';
import { Space } from '../core/Space.js';
import { Token } from '../core/Token.js';
import { BatchActions } from '../engine/actions-extended.js';

// Helper function to create test tokens
function createToken(id, props = {}) {
  return new Token({
    id,
    label: props.label || `Token ${id}`,
    meta: props.meta || {},
    ...props
  });
}

// Helper to create a stack of test cards
function createTestStack() {
  const tokens = [
    createToken('card-1', { label: 'Red Card', meta: { color: 'red', value: 5 } }),
    createToken('card-2', { label: 'Blue Card', meta: { color: 'blue', value: 3 } }),
    createToken('card-3', { label: 'Red Card', meta: { color: 'red', value: 7 } }),
    createToken('card-4', { label: 'Green Card', meta: { color: 'green', value: 2 } }),
    createToken('card-5', { label: 'Blue Card', meta: { color: 'blue', value: 8 } }),
    createToken('card-6', { label: 'Red Card', meta: { color: 'red', value: 1 } }),
  ];
  return new Stack(tokens);
}

// Test runner
function runTests() {
  console.log('🧪 Testing Batch/Query Operations\n');
  
  let passed = 0;
  let failed = 0;
  
  function test(name, fn) {
    try {
      fn();
      console.log(`✅ ${name}`);
      passed++;
    } catch (error) {
      console.log(`❌ ${name}`);
      console.log(`   Error: ${error.message}`);
      failed++;
    }
  }
  
  // Setup engine for tests
  const engine = new Engine();
  engine.eventBus = new EventBus();
  
  // ============================================================
  // TEST: tokens:filter
  // ============================================================
  
  test('tokens:filter - filter by color', () => {
    const stack = createTestStack();
    
    const redCards = BatchActions['tokens:filter'](engine, {
      tokens: stack._stack,
      predicate: (token) => token.meta.color === 'red'
    });
    
    if (redCards.length !== 3) {
      throw new Error(`Expected 3 red cards, got ${redCards.length}`);
    }
    if (!redCards.every(card => card.meta.color === 'red')) {
      throw new Error('Not all filtered cards are red');
    }
  });
  
  test('tokens:filter - filter by value threshold', () => {
    const stack = createTestStack();
    
    const highValue = BatchActions['tokens:filter'](engine, {
      tokens: stack._stack,
      predicate: (token) => token.meta.value >= 5
    });
    
    if (highValue.length !== 3) {
      throw new Error(`Expected 3 high-value cards, got ${highValue.length}`);
    }
  });
  
  test('tokens:filter - from stack source', () => {
    engine.stack = createTestStack();
    
    const blueCards = BatchActions['tokens:filter'](engine, {
      source: 'stack',
      predicate: (token) => token.meta.color === 'blue'
    });
    
    if (blueCards.length !== 2) {
      throw new Error(`Expected 2 blue cards, got ${blueCards.length}`);
    }
  });
  
  test('tokens:filter - from space zone', () => {
    engine.space = new Space('test');
    const stack = createTestStack();
    
    // Place some cards on space
    stack._stack.slice(0, 4).forEach(token => {
      engine.space.place('play', token);
    });
    
    const redCards = BatchActions['tokens:filter'](engine, {
      source: 'play',
      predicate: (token) => token.meta.color === 'red'
    });
    
    if (redCards.length !== 2) {
      throw new Error(`Expected 2 red cards in play zone, got ${redCards.length}`);
    }
  });
  
  // ============================================================
  // TEST: tokens:forEach
  // ============================================================
  
  test('tokens:forEach - modify all tokens', () => {
    const tokens = [
      createToken('t1', { meta: { power: 5 } }),
      createToken('t2', { meta: { power: 3 } }),
      createToken('t3', { meta: { power: 7 } })
    ];
    
    BatchActions['tokens:forEach'](engine, {
      tokens,
      operation: (token) => {
        token.meta.power += 2; // Buff all
      }
    });
    
    if (tokens[0].meta.power !== 7 || tokens[1].meta.power !== 5 || tokens[2].meta.power !== 9) {
      throw new Error('Tokens not properly modified');
    }
  });
  
  test('tokens:forEach - collect return values', () => {
    const tokens = [
      createToken('t1', { meta: { value: 5 } }),
      createToken('t2', { meta: { value: 10 } }),
      createToken('t3', { meta: { value: 15 } })
    ];
    
    const results = BatchActions['tokens:forEach'](engine, {
      tokens,
      operation: (token) => token.meta.value * 2
    });
    
    if (results.length !== 3) {
      throw new Error('Wrong number of results');
    }
    if (results[0] !== 10 || results[1] !== 20 || results[2] !== 30) {
      throw new Error('Wrong calculation results');
    }
  });
  
  test('tokens:forEach - with index parameter', () => {
    const tokens = [
      createToken('t1'),
      createToken('t2'),
      createToken('t3')
    ];
    
    BatchActions['tokens:forEach'](engine, {
      tokens,
      operation: (token, index) => {
        token.meta.index = index;
      }
    });
    
    if (tokens[0].meta.index !== 0 || tokens[1].meta.index !== 1 || tokens[2].meta.index !== 2) {
      throw new Error('Index not properly passed');
    }
  });
  
  // ============================================================
  // TEST: tokens:collect
  // ============================================================
  
  test('tokens:collect - from multiple sources', () => {
    engine.stack = createTestStack();
    engine.space = new Space('test');
    
    // Draw some cards to space
    const drawn = engine.stack.drawMany(3);
    drawn.forEach(card => engine.space.place('hand', card));
    
    const allTokens = BatchActions['tokens:collect'](engine, {
      sources: ['stack', 'space']
    });
    
    // Should have remaining stack cards + cards on space
    if (allTokens.length !== 6) {
      throw new Error(`Expected 6 total tokens, got ${allTokens.length}`);
    }
  });
  
  test('tokens:collect - from space zones', () => {
    engine.space = new Space('test');
    const stack = createTestStack();
    
    // Place cards in different zones
    engine.space.place('zone1', stack._stack[0]);
    engine.space.place('zone1', stack._stack[1]);
    engine.space.place('zone2', stack._stack[2]);
    engine.space.place('zone2', stack._stack[3]);
    
    const collected = BatchActions['tokens:collect'](engine, {
      sources: ['zone1', 'zone2']
    });
    
    if (collected.length !== 4) {
      throw new Error(`Expected 4 tokens, got ${collected.length}`);
    }
  });
  
  test('tokens:collect - include attachments', () => {
    engine.space = new Space('test');
    
    const host = createToken('host');
    const attachment1 = createToken('att1');
    const attachment2 = createToken('att2');
    
    // Attach tokens
    host._attachments = [
      { token: attachment1, type: 'weapon', id: 'att1' },
      { token: attachment2, type: 'armor', id: 'att2' }
    ];
    
    engine.space.place('play', host);
    
    const withAttachments = BatchActions['tokens:collect'](engine, {
      sources: ['play'],
      includeAttachments: true
    });
    
    if (withAttachments.length !== 3) {
      throw new Error(`Expected 3 tokens (1 host + 2 attachments), got ${withAttachments.length}`);
    }
  });
  
  // ============================================================
  // TEST: tokens:count
  // ============================================================
  
  test('tokens:count - count all', () => {
    const stack = createTestStack();
    
    const count = BatchActions['tokens:count'](engine, {
      tokens: stack._stack
    });
    
    if (count !== 6) {
      throw new Error(`Expected 6 tokens, got ${count}`);
    }
  });
  
  test('tokens:count - count with predicate', () => {
    const stack = createTestStack();
    
    const redCount = BatchActions['tokens:count'](engine, {
      tokens: stack._stack,
      predicate: (token) => token.meta.color === 'red'
    });
    
    if (redCount !== 3) {
      throw new Error(`Expected 3 red cards, got ${redCount}`);
    }
  });
  
  test('tokens:count - from source', () => {
    engine.stack = createTestStack();
    
    const totalCount = BatchActions['tokens:count'](engine, {
      source: 'stack'
    });
    
    if (totalCount !== 6) {
      throw new Error(`Expected 6 cards in stack, got ${totalCount}`);
    }
  });
  
  test('tokens:count - from source with predicate', () => {
    engine.space = new Space('test');
    const stack = createTestStack();
    
    // Place cards
    stack._stack.forEach(card => engine.space.place('field', card));
    
    const highValueCount = BatchActions['tokens:count'](engine, {
      source: 'field',
      predicate: (token) => token.meta.value >= 5
    });
    
    if (highValueCount !== 3) {
      throw new Error(`Expected 3 high-value cards, got ${highValueCount}`);
    }
  });
  
  // ============================================================
  // TEST: tokens:find
  // ============================================================
  
  test('tokens:find - find by id', () => {
    const stack = createTestStack();
    
    const found = BatchActions['tokens:find'](engine, {
      tokens: stack._stack,
      predicate: (token) => token.id === 'card-3'
    });
    
    if (!found || found.id !== 'card-3') {
      throw new Error('Failed to find correct token');
    }
  });
  
  test('tokens:find - find by property', () => {
    const stack = createTestStack();
    
    const found = BatchActions['tokens:find'](engine, {
      tokens: stack._stack,
      predicate: (token) => token.meta.color === 'green'
    });
    
    if (!found || found.meta.color !== 'green') {
      throw new Error('Failed to find green card');
    }
  });
  
  test('tokens:find - return null when not found', () => {
    const stack = createTestStack();
    
    const found = BatchActions['tokens:find'](engine, {
      tokens: stack._stack,
      predicate: (token) => token.meta.color === 'purple'
    });
    
    if (found !== null) {
      throw new Error('Should return null when token not found');
    }
  });
  
  test('tokens:find - find first match', () => {
    const stack = createTestStack();
    
    const found = BatchActions['tokens:find'](engine, {
      tokens: stack._stack,
      predicate: (token) => token.meta.color === 'red'
    });
    
    // Should find card-1 (first red card)
    if (!found || found.id !== 'card-1') {
      throw new Error('Should find first matching token');
    }
  });
  
  // ============================================================
  // INTEGRATION TEST: Complex query scenario
  // ============================================================
  
  test('Integration - complex filtering and batch operations', () => {
    engine.stack = createTestStack();
    engine.space = new Space('test');
    
    // Draw cards to hand
    const drawn = engine.stack.drawMany(4);
    drawn.forEach(card => engine.space.place('hand', card));
    
    // Collect all tokens
    const allTokens = BatchActions['tokens:collect'](engine, {
      sources: ['stack', 'hand']
    });
    
    if (allTokens.length !== 6) {
      throw new Error('Failed to collect all tokens');
    }
    
    // Filter for high-value cards
    const highValue = BatchActions['tokens:filter'](engine, {
      tokens: allTokens,
      predicate: (token) => token.meta.value >= 5
    });
    
    // Count red cards
    const redCount = BatchActions['tokens:count'](engine, {
      tokens: allTokens,
      predicate: (token) => token.meta.color === 'red'
    });
    
    // Find the highest value card
    let highestCard = allTokens[0];
    BatchActions['tokens:forEach'](engine, {
      tokens: allTokens,
      operation: (token) => {
        if (token.meta.value > highestCard.meta.value) {
          highestCard = token;
        }
      }
    });
    
    if (highValue.length !== 3) {
      throw new Error('Wrong high-value count');
    }
    if (redCount !== 3) {
      throw new Error('Wrong red card count');
    }
    if (highestCard.meta.value !== 8) {
      throw new Error('Failed to find highest value card');
    }
  });

  // ============================================================
  // SUMMARY
  // ============================================================
  
  console.log('\n' + '='.repeat(50));
  console.log(`✅ Passed: ${passed}`);
  console.log(`❌ Failed: ${failed}`);
  console.log(`📊 Total: ${passed + failed}`);
  
  if (failed === 0) {
    console.log('\n🎉 All batch/query operation tests passed!');
  } else {
    console.log('\n⚠️  Some tests failed. Review output above.');
  }
  
  return failed === 0;
}

// Run tests if executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  const success = runTests();
  process.exit(success ? 0 : 1);
}

export { runTests };