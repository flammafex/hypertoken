/*
 * test/testConfluenceRules.ts
 *
 * Phase 0+1: Pure game rules tests for ConfluenceGame.
 *
 * Tests:
 * 1. Token placement
 * 2. Board derivation (tokens → cells)
 * 3. Same-cell contention (both tokens preserved — the CRDT showcase)
 * 4. Token merge (provenance: _mergedFrom)
 * 5. Token split (provenance: _splitFrom)
 * 6. Scoring (occupied cells + influence)
 * 7. Consumption model (merged/split tokens can't be reused)
 * 8. Provenance tree
 */
import {
  createInitialState,
  registerPlayer,
  placeToken,
  mergeTokens,
  splitToken,
  deriveBoard,
  deriveScores,
  deriveResult,
  getActiveTokens,
  getTokensAt,
  isTokenConsumed,
  getProvenanceTree,
  isValidPlacement,
  isValidMerge,
  isValidSplit,
} from "../examples/confluence/ConfluenceGame.js";

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

async function runTests(): Promise<void> {
  console.log("🎮 Confluence: Pure Game Rules Tests\n");

  // --- Test 1: Token placement ---
  await runTest("Token placement creates a token", () => {
    let state = createInitialState();
    registerPlayer(state, "p1", "Alice");
    state = placeToken(state, 3, 4, "p1", "op1", 0);

    const tokens = getActiveTokens(state);
    assert(tokens.length === 1, `Should have 1 token, has ${tokens.length}`);
    assert(tokens[0].x === 3 && tokens[0].y === 4, "Token should be at (3,4)");
    assert(tokens[0].strength === 1, "New token should have strength 1");
    assert(tokens[0]._mergedFrom === null, "Placed token should have no merge provenance");
    assert(tokens[0]._splitFrom === null, "Placed token should have no split provenance");
  });

  // --- Test 2: Board derivation ---
  await runTest("Board derivation groups tokens by cell", () => {
    let state = createInitialState();
    registerPlayer(state, "p1", "Alice");
    state = placeToken(state, 0, 0, "p1", "op1", 0);
    state = placeToken(state, 5, 5, "p1", "op2", 1);

    const board = deriveBoard(state);
    assert(board.cells[0][0].tokens.length === 1, "Cell (0,0) should have 1 token");
    assert(board.cells[5][5].tokens.length === 1, "Cell (5,5) should have 1 token");
    assert(board.cells[3][3].tokens.length === 0, "Cell (3,3) should be empty");
    assert(board.cells[0][0].controller === "p1", "Cell (0,0) should be controlled by p1");
  });

  // --- Test 3: Same-cell contention (THE CRDT SHOWCASE) ---
  await runTest("Same-cell contention: both tokens preserved", () => {
    let state = createInitialState();
    registerPlayer(state, "p1", "Alice");
    registerPlayer(state, "p2", "Bob");

    // Both players place on the same cell
    state = placeToken(state, 3, 3, "p1", "op1", 0);
    state = placeToken(state, 3, 3, "p2", "op2", 0);

    const tokensAtCell = getTokensAt(state, 3, 3);
    assert(tokensAtCell.length === 2, `Should have 2 tokens at (3,3), has ${tokensAtCell.length}`);
    assert(tokensAtCell[0].playerId !== tokensAtCell[1].playerId, "Tokens should belong to different players");

    const board = deriveBoard(state);
    assert(board.cells[3][3].contested === true, "Cell should be contested");
    assert(board.cells[3][3].controller === null, "Contested cell should have no controller");
  });

  // --- Test 4: Token merge (provenance) ---
  await runTest("Token merge creates _mergedFrom provenance", () => {
    let state = createInitialState();
    registerPlayer(state, "p1", "Alice");
    state = placeToken(state, 3, 3, "p1", "op1", 0);
    state = placeToken(state, 4, 3, "p1", "op2", 1);

    const tokenA = getTokensAt(state, 3, 3)[0];
    const tokenB = getTokensAt(state, 4, 3)[0];
    state = mergeTokens(state, tokenA.id, tokenB.id, "p1", "op3", 2);

    // Parents should be consumed
    assert(isTokenConsumed(state, tokenA.id), "Token A should be consumed after merge");
    assert(isTokenConsumed(state, tokenB.id), "Token B should be consumed after merge");

    // New token should exist with provenance
    const activeTokens = getActiveTokens(state);
    assert(activeTokens.length === 1, `Should have 1 active token, has ${activeTokens.length}`);
    assert(activeTokens[0].strength === 2, `Merged token should have strength 2, has ${activeTokens[0].strength}`);
    assert(
      activeTokens[0]._mergedFrom !== null &&
      activeTokens[0]._mergedFrom!.length === 2,
      "Merged token should have _mergedFrom with 2 parents",
    );
    assert(
      activeTokens[0]._mergedFrom!.includes(tokenA.id),
      "Merged token should list token A as parent",
    );
    assert(
      activeTokens[0]._mergedFrom!.includes(tokenB.id),
      "Merged token should list token B as parent",
    );
  });

  // --- Test 5: Token split (provenance) ---
  await runTest("Token split creates _splitFrom provenance", () => {
    let state = createInitialState();
    registerPlayer(state, "p1", "Alice");
    state = placeToken(state, 3, 3, "p1", "op1", 0);
    state = placeToken(state, 4, 3, "p1", "op2", 1);
    state = mergeTokens(state, "tok-op1", "tok-op2", "p1", "op3", 2);

    // Split the merged token
    state = splitToken(state, "tok-op3", "p1", 3, 4, "op4", 3);

    // Parent should be consumed
    assert(isTokenConsumed(state, "tok-op3"), "Merged token should be consumed after split");

    // Two new tokens should exist
    const activeTokens = getActiveTokens(state);
    assert(activeTokens.length === 2, `Should have 2 active tokens, has ${activeTokens.length}`);

    // Both should have _splitFrom pointing to the parent
    for (const token of activeTokens) {
      assert(token._splitFrom === "tok-op3", `Token ${token.id} should have _splitFrom = tok-op3`);
      assert(token.strength === 1, `Split token should have strength 1, has ${token.strength}`);
    }
  });

  // --- Test 6: Scoring ---
  await runTest("Scoring: occupied cells + influence", () => {
    let state = createInitialState();
    registerPlayer(state, "p1", "Alice");
    registerPlayer(state, "p2", "Bob");

    // Alice places at (5,5)
    state = placeToken(state, 5, 5, "p1", "op1", 0);
    // Bob places far away at (0,0)
    state = placeToken(state, 0, 0, "p2", "op2", 0);

    const scores = deriveScores(state);
    const alice = scores.find((s) => s.playerId === "p1")!;
    const bob = scores.find((s) => s.playerId === "p2")!;

    assert(alice.tokenCount === 1, `Alice should have 1 token, has ${alice.tokenCount}`);
    assert(bob.tokenCount === 1, `Bob should have 1 token, has ${bob.tokenCount}`);

    // Alice controls (5,5) + adjacent empty cells that only she's adjacent to
    // (5,5) has 8 neighbors, all empty and only Alice is adjacent → she controls them
    assert(alice.controlledCells > 1, `Alice should control more than 1 cell (occupied + influence), has ${alice.controlledCells}`);

    // Same for Bob
    assert(bob.controlledCells > 1, `Bob should control more than 1 cell, has ${bob.controlledCells}`);
  });

  // --- Test 7: Consumption model ---
  await runTest("Consumed tokens can't be merged or split again", () => {
    let state = createInitialState();
    registerPlayer(state, "p1", "Alice");
    state = placeToken(state, 3, 3, "p1", "op1", 0);
    state = placeToken(state, 4, 3, "p1", "op2", 1);
    state = mergeTokens(state, "tok-op1", "tok-op2", "p1", "op3", 2);

    // Try to merge the consumed token again — should fail validation
    assert(!isValidMerge(state, "tok-op1", "tok-op3", "p1"), "Should not be able to merge consumed token");
    assert(!isValidSplit(state, "tok-op1", "p1"), "Should not be able to split consumed token");
  });

  // --- Test 8: Provenance tree ---
  await runTest("Provenance tree traces merge/split history", () => {
    let state = createInitialState();
    registerPlayer(state, "p1", "Alice");
    state = placeToken(state, 3, 3, "p1", "op1", 0);
    state = placeToken(state, 4, 3, "p1", "op2", 1);
    state = mergeTokens(state, "tok-op1", "tok-op2", "p1", "op3", 2);
    state = splitToken(state, "tok-op3", "p1", 3, 4, "op4", 3);

    // Get provenance tree for one of the split tokens
    const tree = getProvenanceTree(state, "tok-op4-a");
    assert(tree !== null, "Provenance tree should exist");

    // Should trace back through split → merge → original placements
    assert(tree!.token._splitFrom === "tok-op3", "Should trace split from merged token");

    // Find the merged token in parents
    const mergedParent = tree!.parents.find((p) => p.token.id === "tok-op3");
    assert(mergedParent !== undefined, "Should find merged token as parent");

    // Merged token should have two parents (original placements)
    assert(mergedParent!.parents.length === 2, `Merged token should have 2 parents, has ${mergedParent!.parents.length}`);
    assert(
      mergedParent!.parents.some((p) => p.token.id === "tok-op1"),
      "Should trace back to tok-op1",
    );
    assert(
      mergedParent!.parents.some((p) => p.token.id === "tok-op2"),
      "Should trace back to tok-op2",
    );
  });

  // --- Test 9: Validation rejects invalid actions ---
  await runTest("Validation rejects invalid placements", () => {
    const state = createInitialState();
    state.players["p1"] = { peerId: "p1", name: "Alice", color: "#e94560", joinedAt: 0 };

    assert(!isValidPlacement(state, -1, 0, "p1"), "Should reject negative x");
    assert(!isValidPlacement(state, 0, -1, "p1"), "Should reject negative y");
    assert(!isValidPlacement(state, 100, 0, "p1"), "Should reject out-of-bounds x");
    assert(!isValidPlacement(state, 0, 100, "p1"), "Should reject out-of-bounds y");
    assert(!isValidPlacement(state, 5, 5, "unknown"), "Should reject unknown player");
  });

  // --- Test 10: Merge requires adjacency ---
  await runTest("Merge requires adjacent tokens", () => {
    let state = createInitialState();
    registerPlayer(state, "p1", "Alice");
    state = placeToken(state, 0, 0, "p1", "op1", 0);
    state = placeToken(state, 5, 5, "p1", "op2", 1);

    // Not adjacent — should fail
    assert(!isValidMerge(state, "tok-op1", "tok-op2", "p1"), "Should reject merge of non-adjacent tokens");
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
