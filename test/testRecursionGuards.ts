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
 * Regression tests for recursion hazards (I6/I7).
 *
 * 1. RuleEngine: a rule whose condition is always true and whose action
 *    re-triggers the rule must NOT recurse forever (bounded by the depth guard).
 * 2. Engine policy evaluation: a policy that dispatches an action whenever its
 *    condition holds must NOT recurse synchronously forever (bounded).
 */

import { Engine } from '../engine/Engine.js';
import { RuleEngine } from '../engine/RuleEngine.js';
import { Policy } from '../engine/Policy.js';
import { registerAction, unregisterAction } from '../engine/actions.js';

// Test helpers
let testCount = 0;
let passCount = 0;
let failCount = 0;

function test(name: string, fn: () => void | Promise<void>) {
  testCount++;
  return (async () => {
    try {
      await fn();
      passCount++;
      console.log(`✓ ${name}`);
    } catch (err: any) {
      failCount++;
      console.error(`✗ ${name}`);
      console.error(`  ${err.message}`);
    }
  })();
}

function assert(condition: boolean, message: string) {
  if (!condition) {
    throw new Error(message || 'Assertion failed');
  }
}

console.log('\n🧪 Testing Recursion Guards\n');
console.log('═'.repeat(60));

// ============================================================================
// RULEENGINE RECURSION GUARD (I6)
// ============================================================================

console.log('\n📜 RuleEngine Recursion Guard Tests\n');

await test('RuleEngine: always-true rule that re-triggers itself is bounded', async () => {
  registerAction("test:noop", () => undefined);

  const engine = new Engine();
  const ruleEngine = new RuleEngine(engine);
  engine.useRuleEngine(ruleEngine);

  let fireCount = 0;

  // Condition is always true; the sequence dispatches an action which emits
  // `engine:action`, re-entering evaluate. Without the depth guard this would
  // recurse forever (spinning asynchronously).
  ruleEngine.addRule(
    "runaway",
    () => true,
    (eng: Engine) => {
      fireCount++;
      return eng.dispatch("test:noop", {});
    }
  );

  // Kick off the cascade with a single dispatch.
  await engine.dispatch("test:noop", {});

  // The guard must bound the recursion: it should have fired a bounded number
  // of times (<= the max evaluate depth) rather than looping forever.
  assert(fireCount > 0, `Rule should have fired at least once (got ${fireCount})`);
  assert(fireCount <= 10, `Rule recursion should be bounded (fired ${fireCount} times)`);

  unregisterAction("test:noop");
});

await test('RuleEngine: normal non-recursive rule still fires exactly once', async () => {
  registerAction("test:noop2", () => undefined);

  const engine = new Engine();
  const ruleEngine = new RuleEngine(engine);
  engine.useRuleEngine(ruleEngine);

  let fireCount = 0;

  // Condition only true for a specific action; the sequence does NOT re-trigger.
  ruleEngine.addRule(
    "one-shot",
    (_eng: Engine, lastAction?: any) => lastAction?.type === "test:noop2",
    () => { fireCount++; }
  );

  await engine.dispatch("test:noop2", {});

  assert(fireCount === 1, `Normal rule should fire exactly once (got ${fireCount})`);

  unregisterAction("test:noop2");
});

// ============================================================================
// POLICY RECURSION GUARD (I7)
// ============================================================================

console.log('\n🔒 Policy Recursion Guard Tests\n');

await test('Engine: policy that dispatches whenever condition holds is bounded', async () => {
  registerAction("test:noop3", () => undefined);

  const engine = new Engine();
  let effectCount = 0;

  const runawayPolicy = new Policy(
    "runaway",
    () => true,
    (eng: Engine) => {
      effectCount++;
      // Dispatch synchronously (not awaited) — this re-enters
      // _recordSuccessfulAction, which re-evaluates all policies.
      eng.dispatch("test:noop3", {});
    }
  );

  engine.registerPolicy("runaway", runawayPolicy);

  // Kick off the cascade with a single dispatch.
  await engine.dispatch("test:noop3", {});

  // The guard must bound the synchronous recursion instead of stack-overflowing.
  assert(effectCount > 0, `Policy should have fired at least once (got ${effectCount})`);
  assert(effectCount <= 10, `Policy recursion should be bounded (fired ${effectCount} times)`);

  unregisterAction("test:noop3");
});

await test('Engine: normal non-recursive policy still fires exactly once', async () => {
  registerAction("test:noop4", () => undefined);

  const engine = new Engine();
  let effectCount = 0;

  const normalPolicy = new Policy(
    "normal",
    () => true,
    () => { effectCount++; }
  );

  engine.registerPolicy("normal", normalPolicy);

  await engine.dispatch("test:noop4", {});

  assert(effectCount === 1, `Normal policy should fire exactly once (got ${effectCount})`);

  unregisterAction("test:noop4");
});

// ============================================================================
// RESULTS
// ============================================================================

console.log('\n' + '═'.repeat(60));
console.log(`\n📊 Test Results: ${passCount}/${testCount} passed\n`);

if (failCount === 0) {
  console.log('🎉 All Recursion Guard tests passed!\n');
  process.exit(0);
} else {
  console.log(`❌ ${failCount} tests failed\n`);
  process.exit(1);
}
