/*
 * test/testBatchActions.ts
 *
 * Tests for the `tokens:*` Batch actions in the TS ActionRegistry. These are
 * stateless token-collection utilities:
 * 1. tokens:shuffle  — deterministic seeded shuffle of multiple decks
 * 2. tokens:draw     — bottom-draw with per-deck counts
 * 3. tokens:filter   — flag predicates only (kind:/group: are find/count-only)
 * 4. tokens:map      — flip/merge/unmerge operations
 * 5. tokens:find     — first match, incl. kind:/group:
 * 6. tokens:count    — matching count, incl. kind:/group:
 * 7. tokens:forEach  — same operations as map
 * 8. tokens:collect  — gather tokens from named sources in the CRDT doc
 */
import { Engine } from "../engine/Engine.js";

let passed = 0;
let failed = 0;

function assert(condition: any, message: string): void {
  if (!condition) throw new Error(message);
}

async function runTest(name: string, fn: () => Promise<void> | void): Promise<void> {
  try {
    await fn();
    passed++;
    console.log(`  ✓ ${name}`);
  } catch (err) {
    failed++;
    console.error(`  ✗ ${name}`);
    console.error(`    ${err instanceof Error ? err.message : String(err)}`);
  }
}

function token(id: string, extra: Record<string, any> = {}): any {
  return { id, label: id, kind: "default", rev: false, merged: false, split: false, ...extra };
}

async function runTests(): Promise<void> {
  console.log("🎰 Tokens: Batch Actions (TS ActionRegistry)\n");

  // --- Test 1: tokens:shuffle ---
  await runTest("tokens:shuffle: deterministic seeded shuffle, sizes preserved", async () => {
    const engine = new Engine();
    const decks = [
      [token("a1"), token("a2"), token("a3")],
      [token("b1"), token("b2")],
    ];

    const r1 = await engine.dispatch("tokens:shuffle", { decks, seed: 42 });
    const r2 = await engine.dispatch("tokens:shuffle", { decks, seed: 42 });

    assert(Array.isArray(r1) && r1.length === 2, "should return 2 decks");
    assert(r1[0].length === 3 && r1[1].length === 2, "deck sizes preserved");
    assert(JSON.stringify(r1) === JSON.stringify(r2), "same seed must give same order");
    assert(decks[0].length === 3 && decks[1].length === 2, "input decks not mutated");
  });

  // --- Test 2: tokens:draw ---
  await runTest("tokens:draw: bottom-draw with per-deck counts", async () => {
    const engine = new Engine();
    const decks = [
      [token("1"), token("2"), token("3"), token("4"), token("5")],
      [token("a"), token("b"), token("c")],
    ];

    const r = await engine.dispatch("tokens:draw", { decks, counts: [2, 1] });

    assert(r.drawn.length === 2, "drawn per deck");
    assert(r.drawn[0].map((t: any) => t.id).join() === "5,4", `draws from the bottom, reversed: got ${r.drawn[0].map((t: any) => t.id)}`);
    assert(r.drawn[1].map((t: any) => t.id).join() === "c", "single draw from deck 2");
    assert(r.decks[0].map((t: any) => t.id).join() === "1,2,3", `remaining deck 1: got ${r.decks[0].map((t: any) => t.id)}`);
    assert(r.decks[1].map((t: any) => t.id).join() === "a,b", "remaining deck 2");
  });

  await runTest("tokens:draw: clamps count and rejects mismatched lengths", async () => {
    const engine = new Engine();

    const clamped = await engine.dispatch("tokens:draw", { decks: [[token("1"), token("2")]], counts: [9] });
    assert(clamped.drawn[0].length === 2, "draw all when count exceeds deck");
    assert(clamped.decks[0].length === 0, "empty remaining deck");

    let threw = false;
    try {
      await engine.dispatch("tokens:draw", { decks: [[token("1")]], counts: [1, 2] });
    } catch {
      threw = true;
    }
    assert(threw, "deck/count length mismatch must throw");
  });

  // --- Test 3: tokens:filter ---
  await runTest("tokens:filter: flag predicates; rejects kind:/group:", async () => {
    const engine = new Engine();
    const tokens = [
      token("r1", { rev: true }),
      token("n1"),
      token("m1", { merged: true }),
      token("s1", { split: true }),
    ];

    const reversed = await engine.dispatch("tokens:filter", { tokens, predicate: "reversed" });
    assert(reversed.length === 1 && reversed[0].id === "r1", "reversed filter");
    const normal = await engine.dispatch("tokens:filter", { tokens, predicate: "normal" });
    assert(normal.length === 3 && !normal.some((t: any) => t.id === "r1"), "normal filter (all non-reversed tokens)");
    const merged = await engine.dispatch("tokens:filter", { tokens, predicate: "merged" });
    assert(merged.length === 1 && merged[0].id === "m1", "merged filter");
    const split = await engine.dispatch("tokens:filter", { tokens, predicate: "split" });
    assert(split.length === 1 && split[0].id === "s1", "split filter");

    let threw = false;
    try {
      await engine.dispatch("tokens:filter", { tokens, predicate: "kind:default" });
    } catch {
      threw = true;
    }
    assert(threw, "filter must reject kind: predicates (find/count only)");
  });

  // --- Test 4: tokens:map ---
  await runTest("tokens:map: flip/merge/unmerge; inputs not mutated", async () => {
    const engine = new Engine();
    const tokens = [token("a"), token("b", { rev: true })];

    const flipped = await engine.dispatch("tokens:map", { tokens, operation: "flip" });
    assert(flipped[0].rev === true, "false -> true");
    assert(flipped[1].rev === false, "true -> false");
    assert(tokens[0].rev === false && tokens[1].rev === true, "inputs not mutated");

    const merged = await engine.dispatch("tokens:map", { tokens, operation: "merge" });
    assert(merged[0].merged === true, "merge sets merged=true");
    const unmerged = await engine.dispatch("tokens:map", { tokens: merged, operation: "unmerge" });
    assert(unmerged[0].merged === false, "unmerge sets merged=false");

    let threw = false;
    try {
      await engine.dispatch("tokens:map", { tokens, operation: "bogus" });
    } catch {
      threw = true;
    }
    assert(threw, "unknown operation must throw");
  });

  // --- Test 5: tokens:find ---
  await runTest("tokens:find: first match incl. kind:/group:; null when absent", async () => {
    const engine = new Engine();
    const tokens = [
      token("r1", { rev: true, group: "g1" }),
      token("r2", { rev: true }),
      token("special", { kind: "special" }),
    ];

    const found = await engine.dispatch("tokens:find", { tokens, predicate: "reversed" });
    assert(found && found.id === "r1", "first reversed match");
    const byKind = await engine.dispatch("tokens:find", { tokens, predicate: "kind:special" });
    assert(byKind && byKind.id === "special", "kind: predicate");
    const byGroup = await engine.dispatch("tokens:find", { tokens, predicate: "group:g1" });
    assert(byGroup && byGroup.id === "r1", "group: predicate");
    const none = await engine.dispatch("tokens:find", { tokens, predicate: "merged" });
    assert(none === null, "no match -> null");
    const unknown = await engine.dispatch("tokens:find", { tokens, predicate: "bogus" });
    assert(unknown === null, "unknown predicate -> null");
  });

  // --- Test 6: tokens:count ---
  await runTest("tokens:count: number result incl. kind:/group:; unknown -> 0", async () => {
    const engine = new Engine();
    const tokens = [token("r1", { rev: true }), token("n1"), token("special", { kind: "special" })];

    const count = await engine.dispatch("tokens:count", { tokens, predicate: "reversed" });
    assert(count === 1, `reversed count should be 1, got ${count}`);
    const byKind = await engine.dispatch("tokens:count", { tokens, predicate: "kind:special" });
    assert(byKind === 1, "kind: count");
    const unknown = await engine.dispatch("tokens:count", { tokens, predicate: "bogus" });
    assert(unknown === 0, "unknown predicate -> 0");
  });

  // --- Test 7: tokens:forEach ---
  await runTest("tokens:forEach: same operations as map", async () => {
    const engine = new Engine();
    const tokens = [token("a"), token("b")];

    const flipped = await engine.dispatch("tokens:forEach", { tokens, operation: "flip" });
    assert(flipped.every((t: any) => t.rev === true), "all flipped");

    let threw = false;
    try {
      await engine.dispatch("tokens:forEach", { tokens, operation: "bogus" });
    } catch {
      threw = true;
    }
    assert(threw, "unknown operation must throw");
  });

  // --- Test 8: tokens:collect ---
  await runTest("tokens:collect: gathers from stack/discards/drawn/source/zones in order", async () => {
    const engine = new Engine();

    // Seed the CRDT doc with stack/source/zones state via game:setState.
    await engine.dispatch("game:setState", {
      key: "stack",
      value: { stack: [token("s1"), token("s2")], drawn: [token("d1")], discards: [token("di1")] },
      replace: true,
    });
    await engine.dispatch("game:setState", {
      key: "source",
      value: { tokens: [token("src1")] },
      replace: true,
    });
    await engine.dispatch("game:setState", {
      key: "zones",
      value: { hand: [{ tokenSnapshot: token("z1") }, { tokenSnapshot: token("z2") }] },
      replace: true,
    });

    const collected = await engine.dispatch("tokens:collect", {
      sources: ["stack", "discards", "drawn", "source", "hand"],
    });

    const ids = collected.map((t: any) => t.id).join(",");
    assert(ids === "s1,s2,di1,d1,src1,z1,z2", `expected s1,s2,di1,d1,src1,z1,z2 got ${ids}`);

    // Missing sources are skipped silently.
    const partial = await engine.dispatch("tokens:collect", { sources: ["nope", "stack"] });
    assert(partial.length === 2, "unknown source skipped, stack still collected");
  });

  // Summary
  console.log(`\n${passed} passed, ${failed} failed`);
  if (failed > 0) process.exit(1);
  process.exit(0);
}

runTests().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
