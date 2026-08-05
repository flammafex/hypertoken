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
 * Regression tests for I4: action handlers and Engine getters must not leak
 * live Automerge proxies to callers. Every returned value should be a plain
 * JS object (materialized via JSON round-trip), not a CRDT proxy.
 */

import { Engine } from '../engine/Engine.js';
import { Stack } from '../core/Stack.js';
import { Token } from '../core/Token.js';
import { Chronicle } from '../core/Chronicle.js';

// Test helpers
let passed = 0;
let failed = 0;

function test(name: string, fn: () => void | Promise<void>) {
  return (async () => {
    try {
      await fn();
      passed++;
      console.log(`✓ ${name}`);
    } catch (err: any) {
      failed++;
      console.error(`✗ ${name}`);
      console.error(`  ${err.message}`);
    }
  })();
}

function assert(condition: boolean, message: string) {
  if (!condition) throw new Error(message || 'Assertion failed');
}

/** True when `value` is a plain object (not an Automerge proxy). */
function isPlainObject(value: any): boolean {
  if (value === null || typeof value !== 'object') return false;
  const proto = Object.getPrototypeOf(value);
  return proto === Object.prototype || proto === null;
}

/** True when `value` is a plain array whose elements are plain objects. */
function isPlainArray(value: any): boolean {
  if (!Array.isArray(value)) return false;
  return value.every((v: any) => isPlainObject(v));
}

console.log('\n🧪 Testing proxy leaks (I4)\n');
console.log('═'.repeat(60));

// ============================================================================
// game:setState returns a plain object
// ============================================================================

await test('game:setState returns a plain object (not a proxy)', async () => {
  const engine = new Engine();
  const result: any = await engine.dispatch('game:setState', {
    key: 'watershed',
    value: { energy: 5, owner: 'alice' },
    replace: true,
  });

  assert(isPlainObject(result), 'returned value should be a plain object');
  assert(result.energy === 5, 'data shape preserved (energy)');
  assert(result.owner === 'alice', 'data shape preserved (owner)');

  // Mutating the returned object must not throw (a proxy would throw outside
  // a change context).
  result.energy = 99;
  assert(result.energy === 99, 'mutating returned object should not throw');
  assert(JSON.stringify(result).includes('"energy":99'), 'JSON.stringify works on returned object');
});

await test('game:setState merge path returns a plain object', async () => {
  const engine = new Engine();
  await engine.dispatch('game:setState', { key: 'cfg', value: { a: 1 }, replace: true });
  const result: any = await engine.dispatch('game:setState', { key: 'cfg', value: { b: 2 } });

  assert(isPlainObject(result), 'merged value should be a plain object');
  assert(result.a === 1 && result.b === 2, 'merge preserved both fields');
});

// ============================================================================
// game:setState on a scalar-typed existing key does not throw
// ============================================================================

await test('game:setState on scalar-typed existing key does not throw', async () => {
  const engine = new Engine();
  // First write a scalar value.
  await engine.dispatch('game:setState', { key: 'score', value: 42, replace: true });
  // Now merge an object onto the scalar key — must replace, not Object.assign.
  const result: any = await engine.dispatch('game:setState', { key: 'score', value: { x: 1 } });

  assert(isPlainObject(result), 'scalar key should be replaced with a plain object');
  assert(result.x === 1, 'replacement value preserved');
});

await test('game:setState on array-typed existing key does not throw', async () => {
  const engine = new Engine();
  await engine.dispatch('game:setState', { key: 'list', value: [1, 2, 3], replace: true });
  const result: any = await engine.dispatch('game:setState', { key: 'list', value: { y: 7 } });

  assert(isPlainObject(result), 'array key should be replaced with a plain object');
  assert(result.y === 7, 'replacement value preserved');
});

// ============================================================================
// agent:get / agent:getAll return plain objects
// ============================================================================

await test('agent:get returns a plain object', async () => {
  const engine = new Engine();
  await engine.dispatch('agent:create', { name: 'Alice', meta: { hp: 10 } });

  const agent: any = await engine.dispatch('agent:get', { name: 'Alice' });
  assert(isPlainObject(agent), 'agent:get should return a plain object');
  assert(agent.name === 'Alice', 'agent name preserved');
  assert(isPlainObject(agent.meta), 'nested meta should be a plain object');
  assert(agent.meta.hp === 10, 'nested meta data preserved');

  agent.meta.hp = 999;
  assert(agent.meta.hp === 999, 'mutating returned agent should not throw');
});

await test('agent:getAll returns plain objects', async () => {
  const engine = new Engine();
  await engine.dispatch('agent:create', { name: 'Alice' });
  await engine.dispatch('agent:create', { name: 'Bob' });

  const agents: any = await engine.dispatch('agent:getAll');
  assert(isPlainArray(agents), 'agent:getAll should return an array of plain objects');
  assert(agents.length === 2, 'both agents returned');
  assert(agents.map((a: any) => a.name).sort().join(',') === 'Alice,Bob', 'agent names preserved');
});

// ============================================================================
// engine._agents / engine._gameState return plain objects
// ============================================================================

await test('engine._agents returns plain objects', async () => {
  const engine = new Engine();
  await engine.dispatch('agent:create', { name: 'Alice' });

  const agents = engine._agents;
  assert(isPlainArray(agents), 'engine._agents should be an array of plain objects');
  assert(agents.length === 1 && agents[0].name === 'Alice', 'agent data preserved');
});

await test('engine._gameState returns a plain object', async () => {
  const engine = new Engine();
  await engine.dispatch('game:setState', { key: 'gameState', value: { phase: 'play' }, replace: true });

  const gs = engine._gameState;
  assert(isPlainObject(gs), 'engine._gameState should be a plain object');
  assert(gs.phase === 'play', 'gameState data preserved');
});

// ============================================================================
// stack:peek returns plain objects
// ============================================================================

await test('stack:peek returns plain objects', async () => {
  const session = new Chronicle();
  const stack = new Stack(session, [new Token({ id: 'a' }), new Token({ id: 'b' }), new Token({ id: 'c' })]);
  const engine = new Engine({ stack });

  const peeked: any = await engine.dispatch('stack:peek', { count: 2 });
  assert(isPlainArray(peeked), 'stack:peek should return an array of plain objects');
  assert(peeked.length === 2, 'peeked correct count');
  assert(peeked.map((t: any) => t.id).join(',') === 'c,b', 'peek order preserved (top of stack first)');
});

// ============================================================================
// Summary
// ============================================================================

console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
process.exit(0);
