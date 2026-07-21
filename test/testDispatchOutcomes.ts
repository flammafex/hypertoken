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
import { Token } from "../core/Token.js";
import { Stack } from "../core/Stack.js";

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
    const engine = new Engine({ disableWasm: true });
    const outcome = await engine.dispatchChecked("test:dispatchValue");
    assert(outcome.ok, "value action should succeed");
    assertEquals(outcome.result, 42, "value result should be preserved");
  });

  await withAction("test:dispatchVoid", () => undefined, async () => {
    const engine = new Engine({ disableWasm: true });
    const outcome = await engine.dispatchChecked("test:dispatchVoid");
    assert(outcome.ok, "void action should succeed");
    assertEquals(outcome.result, undefined, "void result should remain undefined");
    assertEquals(await engine.dispatch("test:dispatchVoid"), undefined, "legacy void dispatch should remain undefined");
  });
});

await test("dispatchChecked reports unknown actions", async () => {
  const engine = new Engine({ disableWasm: true });
  const outcome = await engine.dispatchChecked("test:missing");
  assert(!outcome.ok, "unknown action should fail");
  assertEquals(outcome.error.code, "UNKNOWN_ACTION", "unknown action code should be typed");
  assert(outcome.error.message.includes("test:missing"), "unknown action message should identify the action");
});

await test("dispatchChecked reports synchronous handler throws", async () => {
  await withAction("test:throws", () => { throw new Error("sync exploded"); }, async () => {
    const engine = new Engine({ disableWasm: true });
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
    const engine = new Engine({ disableWasm: true });
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
    const engine = new Engine({ disableWasm: true });
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
    const engine = new Engine({ disableWasm: true });
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
  const engine = new Engine({ disableWasm: true });
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

await test("WASM execution errors do not fall back to TypeScript", async () => {
  const engine = new Engine({ disableWasm: true });
  engine._wasmDispatcher = {
    stackPeek: () => { throw new Error("wasm exploded"); },
  } as any;
  const initialHistoryLength = engine.history.length;

  const outcome = await engine.dispatchChecked("stack:peek", { count: 1 });
  assert(!outcome.ok, "WASM throw should fail dispatch");
  assertEquals(outcome.error.code, "WASM_EXECUTION_ERROR", "WASM failure should have a distinct code");
  assertEquals(outcome.error.message, "wasm exploded", "WASM failure should not be replaced by TS fallback error");
  assertEquals(engine.history.length, initialHistoryLength, "WASM failure should not enter history");
});

await test("schema-incompatible WASM actions route directly to TypeScript", async () => {
  const engine = new Engine({ disableWasm: true });
  let wasmCalls = 0;
  engine._wasmDispatcher = {
    spacePlace: () => {
      wasmCalls++;
      throw new Error("incompatible WASM route used");
    },
  } as any;

  const card = new Token({ id: "safe-ts-card", label: "Safe route" });
  const outcome = await engine.dispatchChecked("space:place", {
    zone: "table",
    card,
    opts: { x: 7, y: 9, faceUp: false },
  });

  assert(outcome.ok, "valid public space:place payload should succeed");
  assertEquals(wasmCalls, 0, "incompatible WASM handler must not be attempted");
  assertEquals(engine.space.zoneCount("table"), 1, "TypeScript handler should place the card");
  const placement = engine.space.zone("table")[0];
  assertEquals(placement.x, 7, "TypeScript placement options should be retained");
  assertEquals(placement.faceUp, false, "TypeScript faceUp option should be retained");
});

const absentWasmSectionCases: Array<{
  name: string;
  type: string;
  payload: any;
  wasmMethod: string;
  setup?: (engine: Engine) => void;
  verify: (engine: Engine, outcome: any) => void;
}> = [
  {
    name: "stack:draw",
    type: "stack:draw",
    payload: { count: 1 },
    wasmMethod: "stackDraw",
    setup: (engine) => {
      engine.stack = new Stack(engine.session as any, [new Token({ id: "ts-draw-card" })]);
    },
    verify: (engine, outcome) => {
      assert(outcome.ok, "stack:draw should succeed through TypeScript");
      assert(Array.isArray(outcome.result), "counted TypeScript stack draw should return an array");
      assertEquals(outcome.result[0]?.id, "ts-draw-card", "TypeScript stack draw result should be preserved");
      assertEquals(engine.stack?.size, 0, "TypeScript stack should be mutated");
    },
  },
  {
    name: "agent:create with optional id",
    type: "agent:create",
    payload: { name: "TS Agent" },
    wasmMethod: "agentCreate",
    verify: (engine, outcome) => {
      assert(outcome.ok, "agent:create should succeed through TypeScript");
      assert(typeof outcome.result.id === "string", "TypeScript should generate the optional agent id");
      assertEquals(outcome.result.name, "TS Agent", "TypeScript agent result should be preserved");
      assertEquals((engine.session.state as any).agents["TS Agent"].id, outcome.result.id, "agent should be committed");
    },
  },
  {
    name: "game:setProperty",
    type: "game:setProperty",
    payload: { key: "safeRoute", value: 42 },
    wasmMethod: "gameSetProperty",
    verify: (engine, outcome) => {
      assert(outcome.ok, "game:setProperty should succeed through TypeScript");
      assertEquals(engine._gameState.safeRoute, 42, "TypeScript game state mutation should be committed");
    },
  },
];

for (const routeCase of absentWasmSectionCases) {
  await test(`${routeCase.name} bypasses absent WASM capability`, async () => {
    const engine = new Engine({ disableWasm: true });
    routeCase.setup?.(engine);
    let wasmCalls = 0;
    engine._wasmDispatcher = {
      [routeCase.wasmMethod]: () => {
        wasmCalls++;
        throw new Error(`WASM ${routeCase.name} should not be attempted`);
      },
    } as any;

    const outcome = await engine.dispatchChecked(routeCase.type, routeCase.payload);
    routeCase.verify(engine, outcome);
    assertEquals(wasmCalls, 0, `${routeCase.name} must select TypeScript before execution`);
  });
}

await test("throwing engine:action listeners are post-commit errors", async () => {
  await withAction("test:listenerThrows", () => "committed", async () => {
    const engine = new Engine({ disableWasm: true });
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
