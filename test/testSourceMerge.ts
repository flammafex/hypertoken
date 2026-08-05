/*
 * test/testSourceMerge.ts
 *
 * Regression test for CRDT merge semantics in core/Source.ts.
 *
 * Previously, Source.addStacks() and Source.removeStack() replaced the whole
 * `tokens` list (doc.source.tokens = [...]) inside a single change(). Under
 * Automerge, whole-list assignment creates a NEW list object at the `tokens`
 * key, which is last-writer-wins under concurrent edits. This caused:
 *   - Concurrent addStacks + draw  → the other peer's draw was silently lost
 *     (tokens resurrected).
 *   - Two concurrent addStacks     → one stack's tokens were entirely lost.
 *
 * The fix pushes tokens granularly (and splices them out granularly on
 * remove), so concurrent edits merge correctly. These tests would have caught
 * the regression.
 */
import { Chronicle } from "../core/Chronicle.js";
import { Source } from "../core/Source.js";
import { Stack } from "../core/Stack.js";
import { Token } from "../core/Token.js";

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

function assert(condition: any, message: string): void {
  if (!condition) throw new Error(message);
}

function tokenIds(tokens: { id: string }[]): string[] {
  return tokens.map(t => t.id).sort();
}

function hasId(tokens: { id: string }[], id: string): boolean {
  return tokens.some(t => t.id === id);
}

// Build a Stack on its own fresh Chronicle so its `tokens` getter reflects the
// intended token list (a Stack created on a Chronicle that already has
// `doc.stack` does not re-initialize and would read the existing stack state).
function makeStack(ids: string[]): Stack {
  const chronicle = new Chronicle();
  return new Stack(chronicle, ids.map(id => new Token({ id })));
}

// Build a base Chronicle with an initialized Source, then fork two divergent
// branches so we can exercise concurrent edits and merge them back together.
function setupBase(initialTokens: string[]): Chronicle {
  const base = new Chronicle();
  new Source(base, [makeStack(initialTokens)]); // initializes source with the initial tokens
  return base;
}

test("concurrent addStacks + draw: both operations survive the merge", () => {
  const base = setupBase(["t1", "t2", "t3"]);

  const chronicleA = base.fork();
  const chronicleB = base.fork();
  const sourceA = new Source(chronicleA, [], { autoInit: false });
  const sourceB = new Source(chronicleB, [], { autoInit: false });

  // A adds a new stack of tokens; B concurrently draws one token.
  sourceA.addStacks([makeStack(["a1", "a2"])]);
  sourceB.draw(1);

  // Merge both directions so each side converges.
  chronicleA.merge(chronicleB);
  chronicleB.merge(chronicleA);

  const tokensA = sourceA.tokens;
  const tokensB = sourceB.tokens;

  // Both peers must converge to the same state.
  assert(tokenIds(tokensA).join(",") === tokenIds(tokensB).join(","),
    `A and B should converge: A=[${tokenIds(tokensA)}] B=[${tokenIds(tokensB)}]`);

  // The added tokens must be present (not lost to the concurrent draw).
  assert(hasId(tokensA, "a1"), "added token a1 should survive the merge");
  assert(hasId(tokensA, "a2"), "added token a2 should survive the merge");

  // Exactly one token was drawn, so the total must be 3 initial + 2 added - 1 drawn = 4.
  assert(tokensA.length === 4, `expected 4 tokens after merge, got ${tokensA.length}: [${tokenIds(tokensA)}]`);
});

test("two concurrent addStacks: neither stack's tokens are lost", () => {
  const base = setupBase(["t1", "t2"]);

  const chronicleA = base.fork();
  const chronicleB = base.fork();
  const sourceA = new Source(chronicleA, [], { autoInit: false });
  const sourceB = new Source(chronicleB, [], { autoInit: false });

  // A and B each add a different stack concurrently.
  sourceA.addStacks([makeStack(["x1", "x2"])]);
  sourceB.addStacks([makeStack(["y1", "y2"])]);

  chronicleA.merge(chronicleB);
  chronicleB.merge(chronicleA);

  const tokensA = sourceA.tokens;
  const tokensB = sourceB.tokens;

  assert(tokenIds(tokensA).join(",") === tokenIds(tokensB).join(","),
    `A and B should converge: A=[${tokenIds(tokensA)}] B=[${tokenIds(tokensB)}]`);

  // Both stacks' tokens must survive.
  assert(hasId(tokensA, "x1") && hasId(tokensA, "x2"), "A's stack tokens should survive");
  assert(hasId(tokensA, "y1") && hasId(tokensA, "y2"), "B's stack tokens should survive");

  // 2 initial + 2 + 2 = 6 tokens.
  assert(tokensA.length === 6, `expected 6 tokens after merge, got ${tokensA.length}: [${tokenIds(tokensA)}]`);
});

test("concurrent removeStack + draw: removal and draw both survive the merge", () => {
  const base = new Chronicle();
  const s1 = makeStack(["a1", "a2"]);
  const s2 = makeStack(["b1", "b2"]);
  new Source(base, [s1, s2]); // source tokens: [a1, a2, b1, b2]

  const chronicleA = base.fork();
  const chronicleB = base.fork();
  const sourceA = new Source(chronicleA, [s1, s2], { autoInit: false });
  const sourceB = new Source(chronicleB, [s1, s2], { autoInit: false });

  // A removes stack s1 (tokens a1, a2); B concurrently draws one token.
  sourceA.removeStack(s1);
  sourceB.draw(1);

  chronicleA.merge(chronicleB);
  chronicleB.merge(chronicleA);

  const tokensA = sourceA.tokens;
  const tokensB = sourceB.tokens;

  assert(tokenIds(tokensA).join(",") === tokenIds(tokensB).join(","),
    `A and B should converge: A=[${tokenIds(tokensA)}] B=[${tokenIds(tokensB)}]`);

  // Removed stack's tokens must be gone.
  assert(!hasId(tokensA, "a1") && !hasId(tokensA, "a2"), "removed stack tokens should be gone");

  // The concurrent draw must survive (one token removed).
  // 4 initial - 2 removed - 1 drawn = 1 token remaining.
  assert(tokensA.length === 1, `expected 1 token after merge, got ${tokensA.length}: [${tokenIds(tokensA)}]`);
});

// Summary
console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
