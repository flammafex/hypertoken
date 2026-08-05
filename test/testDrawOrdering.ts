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
 * test/testDrawOrdering.ts
 *
 * Regression test for draw ordering consistency (Issue I9).
 *
 * Previously, Source.draw() returned the drawn slice in bottom-first order
 * (the first element was the bottom of the slice), while Stack._drawMany() and
 * the tokens:draw action returned top-first order (the first element is the
 * top card). Same-domain primitives disagreed on ordering semantics.
 *
 * The fix makes Source.draw() consistent with Stack._drawMany() and
 * tokens:draw: drawing from the top returns cards in top-first order.
 */
import { Chronicle } from "../core/Chronicle.js";
import { Source } from "../core/Source.js";
import { Stack } from "../core/Stack.js";
import { Token } from "../core/Token.js";
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

function ids(tokens: IToken[]): string[] {
  return tokens.map(t => t.id);
}

function makeTokens(n: number): IToken[] {
  return Array.from({ length: n }, (_, i) => new Token({ id: `card-${i}` }));
}

console.log("\n🧪 Testing draw ordering consistency (Source vs Stack)\n");

test("Source.draw(3) returns cards in top-first order", () => {
  const chronicle = new Chronicle();
  const stack = new Stack(chronicle, makeTokens(5));
  const source = new Source(chronicle, [stack]);

  // Source tokens are [card-0, card-1, card-2, card-3, card-4]; the top card
  // is the last element (card-4). Drawing 3 from the top must return
  // [card-4, card-3, card-2] — top-first.
  const drawn = source.draw(3) as IToken[];
  assert(Array.isArray(drawn), "draw(3) should return an array");
  assert(ids(drawn).join(",") === "card-4,card-3,card-2",
    `expected top-first order card-4,card-3,card-2, got ${ids(drawn).join(",")}`);
});

test("Stack.draw(3) returns cards in top-first order (comparison)", () => {
  const chronicle = new Chronicle();
  const stack = new Stack(chronicle, makeTokens(5));

  const drawn = stack.draw(3) as IToken[];
  assert(Array.isArray(drawn), "draw(3) should return an array");
  assert(ids(drawn).join(",") === "card-4,card-3,card-2",
    `expected top-first order card-4,card-3,card-2, got ${ids(drawn).join(",")}`);
});

test("Source.draw(3) and Stack.draw(3) agree on ordering", () => {
  const sourceChronicle = new Chronicle();
  const sourceStack = new Stack(sourceChronicle, makeTokens(5));
  const source = new Source(sourceChronicle, [sourceStack]);

  const stackChronicle = new Chronicle();
  const stack = new Stack(stackChronicle, makeTokens(5));

  const sourceDrawn = source.draw(3) as IToken[];
  const stackDrawn = stack.draw(3) as IToken[];

  assert(ids(sourceDrawn).join(",") === ids(stackDrawn).join(","),
    `Source and Stack should agree on draw order: source=[${ids(sourceDrawn)}] stack=[${ids(stackDrawn)}]`);
});

test("Source.draw(1) still returns a single token", () => {
  const chronicle = new Chronicle();
  const stack = new Stack(chronicle, makeTokens(3));
  const source = new Source(chronicle, [stack]);

  const card = source.draw(1);
  assert(!Array.isArray(card), "draw(1) should return a single token");
  assert(card && card.id === "card-2", `expected top card card-2, got ${card?.id}`);
});

console.log(`\n${passed} passed, ${failed} failed\n`);
if (failed > 0) process.exit(1);
