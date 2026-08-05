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

import { DispatchError, Engine } from "../engine/Engine.js";
import { registerAction, unregisterAction } from "../engine/actions.js";

let testCount = 0;
let passCount = 0;
let failCount = 0;

async function test(name: string, fn: () => void | Promise<void>): Promise<void> {
  testCount++;
  try {
    await fn();
    passCount++;
    console.log(`✓ ${name}`);
  } catch (err) {
    failCount++;
    console.error(`✗ ${name}`);
    console.error(`  ${err instanceof Error ? err.message : String(err)}`);
  }
}

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

function assertEquals(actual: unknown, expected: unknown, message: string): void {
  if (actual !== expected) throw new Error(`${message}: expected ${String(expected)}, got ${String(actual)}`);
}

async function withAction(type: string, handler: (engine: Engine, payload?: any) => unknown, fn: () => Promise<void>): Promise<void> {
  registerAction(type, handler);
  try {
    await fn();
  } finally {
    unregisterAction(type);
  }
}

console.log("\n🧪 Testing dispatch outcomes\n");

await test("dispatchChecked returns successful values and void", async () => {
  await withAction("test:dispatchValue", () => 42, async () => {
    const engine = new Engine();
    const outcome = await engine.dispatchChecked("test:dispatchValue");
    assert(outcome.ok, "value action should succeed");
    assertEquals(outcome.result, 42, "value result should be preserved");
  });

  await withAction("test:dispatchVoid", () => undefined, async () => {
    const engine = new Engine();
    const outcome = await engine.dispatchChecked("test:dispatchVoid");
    assert(outcome.ok, "void action should succeed");
    assertEquals(outcome.result, undefined, "void result should remain undefined");
    assertEquals(await engine.dispatch("test:dispatchVoid"), undefined, "legacy void dispatch should remain undefined");
  });
});

await test("dispatchChecked reports unknown actions", async () => {
  const engine = new Engine();
  const outcome = await engine.dispatchChecked("test:missing");
  assert(!outcome.ok, "unknown action should fail");
  assertEquals(outcome.error.code, "UNKNOWN_ACTION", "unknown action code should be typed");
  assert(outcome.error.message.includes("test:missing"), "unknown action message should identify the action");
});

await test("dispatchChecked reports synchronous handler throws", async () => {
  await withAction("test:throws", () => { throw new Error("sync exploded"); }, async () => {
    const engine = new Engine();
    const outcome = await engine.dispatchChecked("test:throws");
    assert(!outcome.ok, "throwing action should fail");
    assertEquals(outcome.error.code, "ACTION_HANDLER_ERROR", "throw code should identify handler failure");
    assertEquals(outcome.error.message, "sync exploded", "throw message should be preserved");
  });
});

await test("async handlers resolve before recording their result", async () => {
  await withAction("test:asyncResolve", async () => {
    await Promise.resolve();
    return "resolved";
  }, async () => {
    const engine = new Engine();
    let emittedResult: unknown;
    engine.on("engine:action", event => {
      emittedResult = event.payload.payload.result;
    });

    const outcome = await engine.dispatchChecked("test:asyncResolve");
    assert(outcome.ok, "async action should succeed");
    assertEquals(outcome.result, "resolved", "async result should be resolved");
    const recordedAction = engine.history[engine.history.length - 1];
    assertEquals(recordedAction.result, "resolved", "history should contain the resolved Action.result");
    assertEquals(emittedResult, "resolved", "engine:action should contain the resolved Action.result");
    assert(!(recordedAction.result instanceof Promise), "Action.result must not contain a Promise");
  });
});

await test("async handler rejection has no success effects", async () => {
  await withAction("test:asyncReject", async () => {
    await Promise.resolve();
    throw new Error("async exploded");
  }, async () => {
    const engine = new Engine();
    let actionEvents = 0;
    let policyEvaluations = 0;
    let errorEvents = 0;
    engine.on("engine:action", () => { actionEvents++; });
    engine.on("engine:error", () => { errorEvents++; });
    engine.registerPolicy("counter", { evaluate: () => { policyEvaluations++; } });
    const initialHistoryLength = engine.history.length;

    const outcome = await engine.dispatchChecked("test:asyncReject");
    assert(!outcome.ok, "rejecting action should fail");
    assertEquals(outcome.error.code, "ACTION_HANDLER_ERROR", "reject code should identify handler failure");
    assertEquals(outcome.error.message, "async exploded", "rejection message should be preserved");
    assertEquals(engine.history.length, initialHistoryLength, "failed action should not enter history");
    assertEquals(actionEvents, 0, "failed action should not emit engine:action");
    assertEquals(policyEvaluations, 0, "failed action should not evaluate policies");
    assertEquals(errorEvents, 1, "failed action should preserve engine:error emission");
  });
});

await test("synchronous failures have no success effects", async () => {
  await withAction("test:noEffects", () => { throw new Error("failed"); }, async () => {
    const engine = new Engine();
    let actionEvents = 0;
    let policyEvaluations = 0;
    engine.on("engine:action", () => { actionEvents++; });
    engine.registerPolicy("counter", { evaluate: () => { policyEvaluations++; } });
    const initialHistoryLength = engine.history.length;

    await engine.dispatchChecked("test:noEffects");
    assertEquals(engine.history.length, initialHistoryLength, "failed action should not enter history");
    assertEquals(actionEvents, 0, "failed action should not emit engine:action");
    assertEquals(policyEvaluations, 0, "failed action should not evaluate policies");
  });
});

await test("legacy dispatch rejects with DispatchError", async () => {
  const engine = new Engine();
  let rejection: unknown;
  try {
    await engine.dispatch("test:legacyMissing");
  } catch (err) {
    rejection = err;
  }

  assert(rejection instanceof DispatchError, "legacy dispatch should reject a controlled DispatchError");
  assertEquals(rejection.code, "UNKNOWN_ACTION", "legacy rejection should expose its code");
  assert(typeof rejection.actionId === "string" && rejection.actionId.length > 0, "legacy rejection should expose actionId");
});

await test("throwing engine:action listeners are post-commit errors", async () => {
  await withAction("test:listenerThrows", () => "committed", async () => {
    const engine = new Engine();
    let postCommitErrors = 0;
    engine.on("engine:action", () => {
      throw new Error("listener exploded");
    });
    engine.on("engine:error", event => {
      if (event.payload.payload.postCommit === true) postCommitErrors++;
    });
    const initialHistoryLength = engine.history.length;

    const outcome = await engine.dispatchChecked("test:listenerThrows");
    assert(outcome.ok, "post-commit listener failure must not reverse strict success");
    assertEquals(outcome.result, "committed", "committed result should be returned");
    assertEquals(engine.history.length, initialHistoryLength + 1, "committed action should remain in history");
    assertEquals(postCommitErrors, 1, "listener failure should be reported separately");
  });
});

console.log(`\n${passCount}/${testCount} dispatch outcome tests passed\n`);
if (failCount > 0) process.exit(1);
