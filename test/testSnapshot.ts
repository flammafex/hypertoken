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

/*
 * test/testSnapshot.ts
 *
 * Regression test for snapshot()/restore() (Issue I10).
 *
 * Previously, Engine.snapshot() serialized stack.toJSON(), space.snapshot(),
 * and source.toJSON() — all views INSIDE the same Chronicle already captured by
 * crdt: saveToBase64(). This roughly doubled snapshot size, and restore()
 * ignored all three fields. The fix removes the redundant non-CRDT fields,
 * keeping the CRDT save as the authoritative state.
 *
 * This test verifies that snapshot()/restore() round-trips state correctly
 * using only the CRDT data.
 */
import { Engine } from "../engine/Engine.js";
import { Stack } from "../core/Stack.js";
import { Source } from "../core/Source.js";
import { IToken } from "../core/types.js";

let passed = 0;
let failed = 0;

function test(name: string, fn: () => void): void {
  try {
    fn();
    passed++;
    console.log(`✓ ${name}`);
  } catch (err) {
    failed++;
    console.error(`✗ ${name}`);
    console.error(`  ${err instanceof Error ? err.message : String(err)}`);
  }
}

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

function makeTokens(n: number): IToken[] {
  return Array.from({ length: n }, (_, i) => ({
    id: `card-${i}`,
    label: `Card ${i}`,
    group: null,
    text: `Card ${i}`,
    meta: {},
    char: String(i),
    kind: "card",
    index: i,
  }));
}

function makeEngine(): Engine {
  const engine = new Engine();
  const stack = new Stack(engine.session as any, makeTokens(5));
  engine.stack = stack;
  const source = new Source(engine.session as any, [stack]);
  engine.source = source;
  return engine;
}

console.log("\n🧪 Testing Engine.snapshot()/restore()\n");

test("snapshot() no longer includes redundant stack/space/source fields", () => {
  const engine = makeEngine();
  const snapshot = engine.snapshot() as any;

  assert(snapshot.crdt && typeof snapshot.crdt === "string", "snapshot should include CRDT base64");
  assert(snapshot.stack === undefined, "snapshot should not include redundant stack field");
  assert(snapshot.space === undefined, "snapshot should not include redundant space field");
  assert(snapshot.source === undefined, "snapshot should not include redundant source field");
});

test("restore() round-trips stack state via CRDT only", () => {
  const engine = makeEngine();
  engine.stack!.shuffle(42);
  engine.stack!.draw(2);

  const snapshot = engine.snapshot();
  const engine2 = new Engine();
  engine2.restore(snapshot);

  // Reconstruct views over the restored session to read its state.
  const stack2 = new Stack(engine2.session as any, [], { autoInit: false });
  assert(stack2.size === engine.stack!.size,
    `restored stack size should match (${engine.stack!.size}), got ${stack2.size}`);
  assert(stack2.tokens.map(t => t.id).join(",") === engine.stack!.tokens.map(t => t.id).join(","),
    "restored stack tokens should match");
});

test("restore() round-trips source state via CRDT only", () => {
  const engine = makeEngine();
  engine.source!.shuffle(7);
  engine.source!.draw(2);

  const snapshot = engine.snapshot();
  const engine2 = new Engine();
  engine2.restore(snapshot);

  const source2 = new Source(engine2.session as any, [], { autoInit: false });
  assert(source2.tokens.length === engine.source!.tokens.length,
    `restored source token count should match (${engine.source!.tokens.length}), got ${source2.tokens.length}`);
  assert(source2.tokens.map(t => t.id).join(",") === engine.source!.tokens.map(t => t.id).join(","),
    "restored source tokens should match");
});

test("restore() round-trips a full engine with stack and source", () => {
  const engine = makeEngine();
  engine.stack!.shuffle(11);
  engine.source!.shuffle(13);
  engine.stack!.draw(1);
  engine.source!.draw(2);

  const snapshot = engine.snapshot();
  const engine2 = new Engine();
  engine2.restore(snapshot);

  const stack2 = new Stack(engine2.session as any, [], { autoInit: false });
  const source2 = new Source(engine2.session as any, [], { autoInit: false });

  assert(stack2.tokens.map(t => t.id).join(",") === engine.stack!.tokens.map(t => t.id).join(","),
    "restored stack tokens should match");
  assert(source2.tokens.map(t => t.id).join(",") === engine.source!.tokens.map(t => t.id).join(","),
    "restored source tokens should match");
});

console.log(`\n${passed} passed, ${failed} failed\n`);
if (failed > 0) process.exit(1);
