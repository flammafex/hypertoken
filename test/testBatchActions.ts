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

/**
 * Test suite for Batch/Query operations
 * Tests: filter, forEach, collect, count, find
 */

import { Engine } from '../engine/Engine.js';
import { EventBus } from '../core/EventBus.js';
import { Stack } from '../core/Stack.js';
import { Chronicle } from '../core/Chronicle.js';
import { Space } from '../core/Space.js';
import { Token } from '../core/Token.js';
import { IToken } from '../core/types.js';

interface TokenProps extends Partial<IToken> {}

// Helper function to create test tokens
function createToken(id: string, props: TokenProps = {}): Token {
  return new Token({
    id,
    label: props.label ?? `Token ${id}`,
    meta: props.meta ?? {},
    ...props
  });
}

// Helper to create a stack of test cards
function createTestStack(session: Chronicle = new Chronicle()): Stack {
  const tokens = [
    createToken('card-1', { label: 'Red Card', meta: { color: 'red', value: 5 } }),
    createToken('card-2', { label: 'Blue Card', meta: { color: 'blue', value: 3 } }),
    createToken('card-3', { label: 'Red Card', meta: { color: 'red', value: 7 } }),
    createToken('card-4', { label: 'Green Card', meta: { color: 'green', value: 2 } }),
    createToken('card-5', { label: 'Blue Card', meta: { color: 'blue', value: 8 } }),
    createToken('card-6', { label: 'Red Card', meta: { color: 'red', value: 1 } }),
  ];
  return new Stack(session, tokens);
}

// Test runner
function runTests(): void {
  console.log('🧪 Testing Batch/Query Operations\n');

  let passed = 0;
  let failed = 0;

  let engine: Engine;

  function test(name: string, fn: () => void): void {
    try {
      engine = createEngine();
      fn();
      console.log(`✅ ${name}`);
      passed++;
    } catch (error) {
      console.log(`❌ ${name}`);
      if (error instanceof Error) {
        console.log(`   Error: ${error.message}`);
      } else {
        console.log(`   Error: ${String(error)}`);
      }
      failed++;
    }
  }

  // Helper to create isolated engines for each test
  function createEngine(): Engine {
    const instance = new Engine();
    instance.eventBus = new EventBus();
    return instance;
  }

  // ============================================================
  // TEST: tokens:filter
  // ============================================================

  test('tokens:filter - filter by color', () => {
    const stack = createTestStack();

    const redCards = BatchActions['tokens:filter'](engine, {
      tokens: stack.tokens,
      predicate: (token: Token) => token.meta.color === 'red'
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
      tokens: stack.tokens,
      predicate: (token: Token) => token.meta.value >= 5
    });

    if (highValue.length !== 3) {
      throw new Error(`Expected 3 high-value cards, got ${highValue.length}`);
    }
  });

  test('tokens:filter - from stack source', () => {
    engine.stack = createTestStack(engine.session);

    const blueCards = BatchActions['tokens:filter'](engine, {
      source: 'stack',
      predicate: (token: Token) => token.meta.color === 'blue'
    });

    if (blueCards.length !== 2) {
      throw new Error(`Expected 2 blue cards, got ${blueCards.length}`);
    }
  });

  test('tokens:filter - from space zone', () => {
    engine.space = new Space(engine.session, 'test');
    const stack = createTestStack();

    // Place some cards on space
    stack.tokens.slice(0, 4).forEach(token => {
      engine.space.place('play', token);
    });

    const redCards = BatchActions['tokens:filter'](engine, {
      source: 'play',
      predicate: (token: Token) => token.meta.color === 'red'
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
      operation: (token: Token) => {
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
      operation: (token: Token) => token.meta.value * 2
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
      operation: (_token: Token, index: number) => {
        tokens[index].meta.visited = true;
      }
    });

    if (!tokens.every(t => t.meta.visited)) {
      throw new Error('Index-based operation failed');
    }
  });

  test('tokens:forEach - from stack source', () => {
    const stack = createTestStack();
    engine.stack = stack;

    BatchActions['tokens:forEach'](engine, {
      source: 'stack',
      operation: (token: Token) => {
        token.meta.visited = true;
      }
    });

    if (!stack.tokens.every(t => t.meta.visited)) {
      throw new Error('Stack tokens not processed');
    }
  });

  // ============================================================
  // TEST: tokens:collect
  // ============================================================

     test('tokens:collect - from stack and attachments', () => {
     engine.stack = createTestStack(engine.session);
       engine.space = new Space(engine.session, 'test');

     const stack = engine.stack;
       const token = createToken('host', { label: 'Host', meta: { type: 'host' } });
    const attachments = [
      createToken('att-1', { label: 'Attachment 1' }),
        createToken('att-2', { label: 'Attachment 2' })
      ];

     // Simulate attachments
     token._attachments = attachments.map(att => ({ token: att }));

      // Place after attachments are recorded so the snapshot includes them
     engine.space.place('play', token);

     const blueCards = BatchActions['tokens:collect'](engine, {
       sources: ['stack', 'play'],
        includeAttachments: true
   });

      const expectedCount = (stack?.tokens?.length ?? 0) + attachments.length + 1; // host token
      if (blueCards.length !== expectedCount) {
       throw new Error(`Expected ${expectedCount} tokens, got ${blueCards.length}`);
      }
    });

  // ============================================================
  // TEST: tokens:count
  // ============================================================

  test('tokens:count - total tokens', () => {
    engine.stack = createTestStack(engine.session);

    const count = BatchActions['tokens:count'](engine, {
      source: 'stack'
    });

    if (count !== 6) {
      throw new Error(`Expected 6 tokens, got ${count}`);
    }
  });

  test('tokens:count - with predicate', () => {
    engine.stack = createTestStack(engine.session);

    const redCount = BatchActions['tokens:count'](engine, {
      source: 'stack',
      predicate: (token: Token) => token.meta.color === 'red'
    });

    if (redCount !== 3) {
      throw new Error(`Expected 3 red tokens, got ${redCount}`);
    }
  });

  test('tokens:count - from space zones', () => {
    engine.stack = createTestStack(engine.session);
    engine.space = new Space(engine.session, 'test');

    const stack = engine.stack;
    stack.tokens.forEach(card => engine.space.place('field', card));

    const highValueCount = BatchActions['tokens:count'](engine, {
      source: 'field',
      predicate: (token: Token) => token.meta.value >= 5
    });

    if (highValueCount !== 3) {
      throw new Error(`Expected 3 high value tokens, got ${highValueCount}`);
    }
  });

  // ============================================================
  // TEST: tokens:find
  // ============================================================

  test('tokens:find - find red card from stack', () => {
    engine.stack = createTestStack(engine.session);

    const found = BatchActions['tokens:find'](engine, {
      source: 'stack',
      predicate: (token: Token) => token.meta.color === 'red'
    });

    if (!found || found.meta.color !== 'red') {
      throw new Error('Expected to find a red card');
    }
  });

  test('tokens:find - find high value card', () => {
    engine.stack = createTestStack(engine.session);

    const found = BatchActions['tokens:find'](engine, {
      source: 'stack',
      predicate: (token: Token) => token.meta.value >= 7
    });

    if (!found || found.meta.value < 7) {
      throw new Error('Expected to find a high value card');
    }
  });

  test('tokens:find - find in space zone', () => {
    engine.space = new Space(engine.session, 'test');
    const stack = createTestStack();

    stack.tokens.slice(0, 3).forEach(token => engine.space.place('zone1', token));

    const found = BatchActions['tokens:find'](engine, {
      source: 'zone1',
      predicate: (token: Token) => token.meta.color === 'blue'
    });

    if (!found || found.meta.color !== 'blue') {
      throw new Error('Expected to find a blue token');
    }
  });

  test('tokens:find - returns null when not found', () => {
    engine.stack = createTestStack(engine.session);

    const found = BatchActions['tokens:find'](engine, {
      source: 'stack',
      predicate: (token: Token) => token.meta.color === 'purple'
    });

    if (found !== null) {
      throw new Error('Expected null when token not found');
    }
  });

  console.log(`\nResults: ${passed} passed, ${failed} failed`);

  if (failed > 0) {
    process.exit(1);
  }
}

runTests();