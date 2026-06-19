/*
 * test/testPersistence.ts
 *
 * Phase C: Persistence tests.
 *
 * Tests the StorageAdapter interface and Engine persistence API:
 * 1. MemoryAdapter — save, load, delete, list
 * 2. FilesystemAdapter — save, load, delete, list (Node.js only)
 * 3. Engine.persist() / resume() — save state, load it back
 * 4. Auto-save — verify timer works
 * 5. Save/load with actual game state (Chronicle)
 */
import { Engine } from "../engine/Engine.js";
import { Chronicle } from "../core/Chronicle.js";
import { MemoryAdapter } from "../core/storage/MemoryAdapter.js";
import { FilesystemAdapter } from "../core/storage/FilesystemAdapter.js";
import { STORAGE_VERSION } from "../core/StorageAdapter.js";
import { existsSync, rmSync } from "fs";

let passed = 0;
let failed = 0;

function assert(condition: any, message: string): void {
  if (!condition) throw new Error(message);
}

async function runTest(name: string, fn: () => Promise<void>): Promise<void> {
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
  console.log("💾 Phase C: Persistence Tests\n");

  // ========================================================================
  // 1. MemoryAdapter
  // ========================================================================
  console.log("── MemoryAdapter ──\n");

  await runTest("MemoryAdapter: save and load", async () => {
    const adapter = new MemoryAdapter();
    await adapter.save("test1", "base64-data-here", "test save");

    const loaded = await adapter.load("test1");
    assert(loaded !== null, "Should load saved data");
    assert(loaded!.data === "base64-data-here", `Data should match, got ${loaded!.data}`);
    assert(loaded!.metadata.name === "test1", `Name should match, got ${loaded!.metadata.name}`);
    assert(loaded!.metadata.description === "test save", `Description should match`);
    assert(loaded!.metadata.version === STORAGE_VERSION, `Version should be ${STORAGE_VERSION}`);
    assert(loaded!.metadata.timestamp > 0, "Timestamp should be set");
  });

  await runTest("MemoryAdapter: load non-existent returns null", async () => {
    const adapter = new MemoryAdapter();
    const loaded = await adapter.load("nonexistent");
    assert(loaded === null, "Should return null for non-existent save");
  });

  await runTest("MemoryAdapter: delete", async () => {
    const adapter = new MemoryAdapter();
    await adapter.save("to-delete", "data");
    await adapter.delete("to-delete");
    const loaded = await adapter.load("to-delete");
    assert(loaded === null, "Should be null after delete");
  });

  await runTest("MemoryAdapter: list returns sorted by timestamp", async () => {
    const adapter = new MemoryAdapter();
    await adapter.save("old", "data1");
    await new Promise(r => setTimeout(r, 10));
    await adapter.save("new", "data2");

    const list = await adapter.list();
    assert(list.length === 2, `Should have 2 saves, has ${list.length}`);
    assert(list[0].name === "new", "Newest should be first");
    assert(list[1].name === "old", "Oldest should be second");
  });

  // ========================================================================
  // 2. FilesystemAdapter
  // ========================================================================
  console.log("\n── FilesystemAdapter ──\n");

  const TEST_DIR = "./test-saves";

  await runTest("FilesystemAdapter: save and load", async () => {
    const adapter = new FilesystemAdapter({ dir: TEST_DIR });
    await adapter.save("test1", "base64-data-here", "test save");

    const loaded = await adapter.load("test1");
    assert(loaded !== null, "Should load saved data");
    assert(loaded!.data === "base64-data-here", `Data should match`);
    assert(loaded!.metadata.name === "test1", `Name should match`);
    assert(loaded!.metadata.description === "test save", `Description should match`);
  });

  await runTest("FilesystemAdapter: load non-existent returns null", async () => {
    const adapter = new FilesystemAdapter({ dir: TEST_DIR });
    const loaded = await adapter.load("nonexistent");
    assert(loaded === null, "Should return null for non-existent save");
  });

  await runTest("FilesystemAdapter: delete", async () => {
    const adapter = new FilesystemAdapter({ dir: TEST_DIR });
    await adapter.save("to-delete", "data");
    await adapter.delete("to-delete");
    const loaded = await adapter.load("to-delete");
    assert(loaded === null, "Should be null after delete");
  });

  await runTest("FilesystemAdapter: list returns sorted by timestamp", async () => {
    const adapter = new FilesystemAdapter({ dir: TEST_DIR });
    await adapter.save("old2", "data1");
    await new Promise(r => setTimeout(r, 10));
    await adapter.save("new2", "data2");

    const list = await adapter.list();
    assert(list.length >= 2, `Should have at least 2 saves, has ${list.length}`);
    // Find our saves
    const oldSave = list.find(s => s.name === "old2");
    const newSave = list.find(s => s.name === "new2");
    assert(oldSave && newSave, "Both saves should be in list");
    assert(newSave!.timestamp > oldSave!.timestamp, "New save should have later timestamp");
  });

  // ========================================================================
  // 3. Engine.persist() / resume()
  // ========================================================================
  console.log("\n── Engine Persistence ──\n");

  await runTest("Engine: persist and resume with MemoryAdapter", async () => {
    const engine = new Engine({ disableWasm: true });
    const adapter = new MemoryAdapter();
    engine.useStorage(adapter);

    // Write some state
    engine.session.change("init", (doc: any) => {
      doc.testField = "hello-world";
      doc.counter = 42;
    });

    // Persist
    await engine.persist("test-save", "test description");

    // Create a new engine and resume
    const engine2 = new Engine({ disableWasm: true });
    engine2.useStorage(new MemoryAdapter());

    // The new adapter is empty — need to use the same adapter
    engine2.useStorage(adapter);
    const loaded = await engine2.resume("test-save");

    assert(loaded === true, "resume() should return true when save exists");

    const state = engine2.session.state as any;
    assert(state.testField === "hello-world", `testField should be restored, got ${state.testField}`);
    assert(state.counter === 42, `counter should be restored, got ${state.counter}`);
  });

  await runTest("Engine: resume returns false when no save exists", async () => {
    const engine = new Engine({ disableWasm: true });
    engine.useStorage(new MemoryAdapter());

    const loaded = await engine.resume("nonexistent");
    assert(loaded === false, "resume() should return false when save doesn't exist");
  });

  await runTest("Engine: persist without adapter throws", async () => {
    const engine = new Engine({ disableWasm: true });

    let error: Error | null = null;
    try {
      await engine.persist("test");
    } catch (e) {
      error = e as Error;
    }
    assert(error !== null, "Should throw when no adapter attached");
    assert(error!.message.includes("No storage adapter"), `Error message should mention adapter: ${error!.message}`);
  });

  await runTest("Engine: listSaves returns metadata", async () => {
    const engine = new Engine({ disableWasm: true });
    const adapter = new MemoryAdapter();
    engine.useStorage(adapter);

    await engine.persist("save1", "first");
    await new Promise(r => setTimeout(r, 10));
    await engine.persist("save2", "second");

    const saves = await engine.listSaves();
    assert(saves.length === 2, `Should have 2 saves, has ${saves.length}`);
    assert(saves[0].name === "save2", "Newest should be first");
    assert(saves[1].name === "save1", "Oldest should be second");
  });

  await runTest("Engine: deleteSave removes save", async () => {
    const engine = new Engine({ disableWasm: true });
    const adapter = new MemoryAdapter();
    engine.useStorage(adapter);

    await engine.persist("to-delete", "temp");
    await engine.deleteSave("to-delete");

    const saves = await engine.listSaves();
    assert(saves.length === 0, "Should have 0 saves after delete");
  });

  // ========================================================================
  // 4. Auto-save
  // ========================================================================
  console.log("\n── Auto-save ──\n");

  await runTest("Engine: enableAutoSave and disableAutoSave", async () => {
    const engine = new Engine({ disableWasm: true });
    const adapter = new MemoryAdapter();
    engine.useStorage(adapter);

    // Enable auto-save with 100ms interval
    engine.enableAutoSave(100, "autosave");

    // Wait for a few auto-saves
    await new Promise(r => setTimeout(r, 350));

    // Disable
    engine.disableAutoSave();

    // Should have at least one autosave
    const saves = await engine.listSaves();
    assert(saves.length >= 1, `Should have at least 1 autosave, has ${saves.length}`);

    const autosave = saves.find(s => s.name === "autosave");
    assert(autosave !== undefined, "Should have an 'autosave' entry");
  });

  // ========================================================================
  // 5. Save/load with actual game state
  // ========================================================================
  console.log("\n── Game State Persistence ──\n");

  await runTest("Engine: save and restore actual game state (Chronicle)", async () => {
    const engine = new Engine({ disableWasm: true });
    const adapter = new MemoryAdapter();
    engine.useStorage(adapter);

    // Write complex nested state
    engine.session.change("setup game", (doc: any) => {
      doc.game = {
        players: [
          { id: "p1", name: "Alice", score: 100 },
          { id: "p2", name: "Bob", score: 85 },
        ],
        board: {
          width: 10,
          height: 10,
          cells: { "0,0": { owner: "p1" }, "5,5": { owner: "p2" } },
        },
        turn: 5,
        phase: "playing",
      };
    });

    // Persist
    await engine.persist("game-state-test");

    // Resume in a new engine
    const engine2 = new Engine({ disableWasm: true });
    engine2.useStorage(adapter);
    await engine2.resume("game-state-test");

    const state = engine2.session.state as any;

    assert(state.game.players.length === 2, `Should have 2 players, has ${state.game.players.length}`);
    assert(state.game.players[0].name === "Alice", `Player 0 should be Alice`);
    assert(state.game.players[1].score === 85, `Player 1 score should be 85`);
    assert(state.game.board.width === 10, `Board width should be 10`);
    assert(state.game.board.cells["0,0"].owner === "p1", `Cell 0,0 should be p1`);
    assert(state.game.turn === 5, `Turn should be 5`);
    assert(state.game.phase === "playing", `Phase should be playing`);
  });

  await runTest("Engine: FilesystemAdapter persists across engine instances", async () => {
    const dir = "./test-saves-cross";
    const adapter1 = new FilesystemAdapter({ dir });

    const engine1 = new Engine({ disableWasm: true });
    engine1.useStorage(adapter1);

    engine1.session.change("cross-engine test", (doc: any) => {
      doc.crossEngine = "persisted-value";
    });

    await engine1.persist("cross-test");

    // New engine, new adapter instance, same directory
    const adapter2 = new FilesystemAdapter({ dir });
    const engine2 = new Engine({ disableWasm: true });
    engine2.useStorage(adapter2);

    const loaded = await engine2.resume("cross-test");
    assert(loaded === true, "Should load from filesystem");

    const state = engine2.session.state as any;
    assert(state.crossEngine === "persisted-value", `Value should persist across engines`);

    // Cleanup
    rmSync(dir, { recursive: true, force: true });
  });

  // Cleanup test directory
  if (existsSync(TEST_DIR)) {
    rmSync(TEST_DIR, { recursive: true, force: true });
  }

  // Summary
  console.log(`\n${passed} passed, ${failed} failed`);
  if (failed > 0) process.exit(1);
  process.exit(0);
}

runTests().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
