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
/*
 * Regression test for C6: component-level emit() failures must not corrupt
 * the dispatch outcome or drop the action from history.
 *
 * Stack/Source/Space handlers emit events AFTER the CRDT change but INSIDE
 * the dispatch call. If a listener throws, that exception used to propagate
 * out of the session.change call chain, get wrapped in a DispatchError, and
 * cause _recordSuccessfulAction to be skipped — the document mutated but the
 * action was absent from history and the caller saw failure.
 *
 * Emitter.emit now isolates per-listener failures (surfaced via an "error"
 * event), so a throwing listener must not fail the dispatch or drop the action.
 */
import { Engine } from "../engine/Engine.js";
import { Stack } from "../core/Stack.js";
import { Token } from "../core/Token.js";

let passed = 0;
let failed = 0;

// Listener errors are surfaced via the emitter's "error" event (not re-thrown
// asynchronously, which would crash the process). We count them here and assert
// they surfaced without corrupting the synchronous dispatch.
let listenerErrors = 0;

function test(name: string, fn: () => void | Promise<void>) {
  try {
    const result = fn();
    if (result && typeof (result as Promise<void>).then === "function") {
      (result as Promise<void>).then(
        () => {
          passed++;
          console.log(`  ✓ ${name}`);
        },
        (err) => {
          failed++;
          console.error(`  ✗ ${name}`);
          console.error(`    ${err instanceof Error ? err.message : String(err)}`);
        }
      );
    } else {
      passed++;
      console.log(`  ✓ ${name}`);
    }
  } catch (err) {
    failed++;
    console.error(`  ✗ ${name}`);
    console.error(`    ${err instanceof Error ? err.message : String(err)}`);
  }
}

function assert(condition: boolean, message: string) {
  if (!condition) throw new Error(message);
}

function makeEngine(): Engine {
  const engine = new Engine();
  engine.stack = new Stack(engine.session as any, [
    new Token({ id: "a", label: "A" }),
    new Token({ id: "b", label: "B" }),
    new Token({ id: "c", label: "C" }),
  ]);
  // Listener errors surface via the emitter's "error" event; count them here.
  // The throwing listeners are registered on the Stack, so the "error" event
  // fires on the Stack emitter.
  engine.stack.on("error", () => {
    listenerErrors++;
  });
  return engine;
}

async function runTests() {
  console.log("🔌 Emit Isolation Tests\n");

  await new Promise<void>((resolve) => {
    test("throwing stack:draw listener does not fail the dispatch", async () => {
      const engine = makeEngine();
      // A listener that throws on the component-level "draw" event.
      engine.stack!.on("draw", () => {
        throw new Error("listener exploded");
      });

      const outcome = await engine.dispatchChecked("stack:draw");
      assert(outcome.ok === true, `dispatch should succeed, got ${JSON.stringify(outcome)}`);
    });

    test("throwing stack:draw listener still records the action in history", async () => {
      const engine = makeEngine();
      engine.stack!.on("draw", () => {
        throw new Error("listener exploded");
      });

      const before = engine.history.length;
      const outcome = await engine.dispatchChecked("stack:draw");
      assert(outcome.ok === true, `dispatch should succeed, got ${JSON.stringify(outcome)}`);
      assert(
        engine.history.length === before + 1,
        `action should be recorded in history (${before} -> ${engine.history.length})`
      );
      const last = engine.history[engine.history.length - 1];
      assert(last.type === "stack:draw", `last history action should be stack:draw, got ${last.type}`);
    });

    test("throwing listener does not prevent subsequent listeners from running", () => {
      const engine = makeEngine();
      let secondRan = false;
      engine.stack!.on("draw", () => {
        throw new Error("listener exploded");
      });
      engine.stack!.on("draw", () => {
        secondRan = true;
      });

      engine.stack!.draw();
      assert(secondRan, "second listener should still run after the first throws");
    });

    resolve();
  });

  // Listener errors are surfaced via the emitter's "error" event. Assert they
  // surfaced without corrupting the synchronous dispatch.
  assert(listenerErrors >= 3, `listener errors should surface via the error event, got ${listenerErrors}`);

  console.log(`\n${passed} passed, ${failed} failed`);
  if (failed > 0) process.exit(1);
}

runTests();
