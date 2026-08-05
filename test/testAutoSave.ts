/*
 * test/testAutoSave.ts
 *
 * Regression test for I5: Engine.shutdown() must stop the auto-save timer.
 *
 * Before the fix, shutdown() never called disableAutoSave(), so the interval
 * kept firing persist() on a shut-down engine. Because the timer was not
 * `.unref()`'d, a CLI process with auto-save enabled never exited.
 *
 * This test verifies:
 * 1. After shutdown(), the auto-save timer no longer fires persist().
 * 2. The auto-save timer is unref'd (Node.js), so it doesn't keep the
 *    process alive.
 */
import { Engine } from "../engine/Engine.js";
import { MemoryAdapter } from "../core/storage/MemoryAdapter.js";

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

const sleep = (ms: number) => new Promise<void>(r => setTimeout(r, ms));

async function runTests(): Promise<void> {
  console.log("💾 Auto-save shutdown regression tests\n");

  await runTest("shutdown() stops the auto-save timer from firing persist()", async () => {
    const engine = new Engine();
    const adapter = new MemoryAdapter();
    engine.useStorage(adapter);

    let saveCount = 0;
    engine.on("engine:saved", () => { saveCount++; });

    // Short interval so the test runs fast.
    engine.enableAutoSave(50, "autosave");

    // Wait for at least one auto-save to fire.
    await sleep(120);
    assert(saveCount >= 1, `Expected at least 1 auto-save before shutdown, got ${saveCount}`);

    const beforeShutdown = saveCount;

    // Shut the engine down — this must clear the auto-save timer.
    await engine.shutdown();

    // Wait well past the interval; no additional persists should fire.
    await sleep(200);

    assert(
      saveCount === beforeShutdown,
      `Auto-save timer kept firing after shutdown: ${beforeShutdown} -> ${saveCount}`,
    );
  });

  await runTest("shutdown() clears the auto-save timer handle", async () => {
    const engine = new Engine();
    engine.useStorage(new MemoryAdapter());
    engine.enableAutoSave(50, "autosave");

    const timerBefore = (engine as any)._autoSaveTimer;
    assert(timerBefore != null, "Auto-save timer should be set after enableAutoSave");

    await engine.shutdown();

    const timerAfter = (engine as any)._autoSaveTimer;
    assert(timerAfter == null, "Auto-save timer should be cleared after shutdown");
  });

  await runTest("auto-save timer is unref'd (Node.js)", async () => {
    const engine = new Engine();
    engine.useStorage(new MemoryAdapter());
    engine.enableAutoSave(50, "autosave");

    const timer = (engine as any)._autoSaveTimer;
    assert(timer != null, "Auto-save timer should be set");

    // In Node.js, setInterval returns a Timeout object with hasRef().
    // A `.unref()`'d timer reports hasRef() === false.
    if (typeof timer.hasRef === "function") {
      assert(timer.hasRef() === false, "Auto-save timer should be unref'd (hasRef() === false)");
    } else {
      // Non-Node environment (e.g. browser) — nothing to assert.
      console.log("    (skipping hasRef check: non-Node timer)");
    }

    await engine.shutdown();
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
