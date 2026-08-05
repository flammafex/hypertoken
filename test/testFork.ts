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

import { Engine } from "../engine/Engine.js";
import { Stack } from "../core/Stack.js";
import { Source } from "../core/Source.js";
import { IToken } from "../core/types.js";

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

// Build an engine whose stack/source are bound to the engine's own session so
// that fork() can reconstruct them from the forked session's state.
function makeEngine(): Engine {
  const engine = new Engine();
  const stack = new Stack(engine.session as any, makeTokens(5));
  engine.stack = stack;
  const source = new Source(engine.session as any, [stack]);
  engine.source = source;
  return engine;
}

console.log("\n🧪 Testing Engine.fork()\n");

test("fork reconstructs stack/source bound to the forked session", () => {
  const engine = makeEngine();
  const fork = engine.fork();

  assert(fork.stack !== null, "fork should have a stack");
  assert(fork.source !== null, "fork should have a source");
  assert(fork.stack!.session !== engine.stack!.session, "fork stack must be bound to a different session than the parent");
  assert(fork.source!.session !== engine.source!.session, "fork source must be bound to a different session than the parent");
  assert(fork.stack!.size === engine.stack!.size, "fork stack should start with the same contents as the parent");
  assert(fork.source!.tokens.length === engine.source!.tokens.length, "fork source should start with the same contents as the parent");
});

test("mutating the fork's stack does not affect the parent", () => {
  const engine = makeEngine();
  const fork = engine.fork();

  const parentSizeBefore = engine.stack!.size;
  fork.stack!.shuffle(42);
  fork.stack!.draw();

  assert(fork.stack!.size === parentSizeBefore - 1, "fork stack should reflect its own draw");
  assert(engine.stack!.size === parentSizeBefore, "parent stack size must be unchanged by fork mutation");
});

test("mutating the fork's source does not affect the parent", () => {
  const engine = makeEngine();
  const fork = engine.fork();

  const parentTokensBefore = engine.source!.tokens.length;
  fork.source!.draw(1);

  assert(fork.source!.tokens.length === parentTokensBefore - 1, "fork source should reflect its own draw");
  assert(engine.source!.tokens.length === parentTokensBefore, "parent source must be unchanged by fork mutation");
});

test("fork emits state:updated when its session changes", () => {
  const engine = makeEngine();
  const fork = engine.fork();

  let updated = 0;
  fork.on("state:updated", () => { updated++; });

  fork.stack!.shuffle(7);
  assert(updated > 0, "fork should emit state:updated after a stack mutation");
});

test("mergeFrom propagates fork changes back to the parent", () => {
  const engine = makeEngine();
  const fork = engine.fork();

  const parentSizeBefore = engine.stack!.size;
  fork.stack!.draw();

  engine.mergeFrom(fork);
  assert(engine.stack!.size === parentSizeBefore - 1, "parent should see the fork's draw after merge");
});

console.log(`\n${passCount} passed, ${failCount} failed, ${testCount} total`);
if (failCount > 0) process.exit(1);
