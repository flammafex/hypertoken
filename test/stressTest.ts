#!/usr/bin/env node
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

/**
 * Stress Test: CRDT Document Growth & HistoryManager Memory
 *
 * Simulates a real-time game session (Watershed-like continuous token placement)
 * and measures:
 *   - Automerge document size (saveToBase64)
 *   - HistoryManager memory (sum of all per-action snapshots)
 *   - Dispatch latency (time per dispatch call)
 *   - Node.js heap usage
 *
 * This test demonstrates the O(n²) memory problem: Engine.dispatch() calls
 * session.saveToBase64() on EVERY dispatch to feed the undo stack, and
 * HistoryManager stores a full document snapshot per action.
 *
 * Run: npm run test:stress
 */

import { Engine } from "../engine/Engine.js";
import { Stack } from "../core/Stack.js";
import { Space } from "../core/Space.js";
import { Token } from "../core/Token.js";

// ── Helpers ──────────────────────────────────────────────────────────────────

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatMs(ms: number): string {
  if (ms < 1) return `${(ms * 1000).toFixed(0)} µs`;
  if (ms < 1000) return `${ms.toFixed(1)} ms`;
  return `${(ms / 1000).toFixed(2)} s`;
}

function heapMB(): number {
  return Math.round(process.memoryUsage().heapUsed / 1024 / 1024 * 10) / 10;
}

// ── Token factory ────────────────────────────────────────────────────────────

let tokenCounter = 0;
function makeToken(label?: string): Token {
  const id = `tok-${tokenCounter++}`;
  return new Token({
    id,
    group: "game",
    label: label ?? `Token ${tokenCounter}`,
    text: "",
    char: "●",
    kind: "marker",
    index: tokenCounter,
    meta: { color: "blue", strength: 1 },
  });
}

// ── Build a large deck ───────────────────────────────────────────────────────

function makeDeck(size: number): Token[] {
  const tokens: Token[] = [];
  for (let i = 0; i < size; i++) {
    tokens.push(makeToken(`card-${i}`));
  }
  return tokens;
}

// ── Measurement ──────────────────────────────────────────────────────────────

interface Measurement {
  actions: number;
  docSize: number;          // saveToBase64().length (bytes, base64-encoded)
  historySize: number;      // sum of all snapshot lengths in HistoryManager
  dispatchLatency: number;  // ms per dispatch (average of last batch)
  heapUsed: number;         // MB
}

function measure(engine: Engine, actionCount: number): Measurement {
  const docSize = engine.session.saveToBase64().length;

  // HistoryManager now stores checkpoints (periodic snapshots) instead of per-action snapshots
  const checkpoints = (engine.historyManager as any)._checkpoints as { index: number; snapshot: string }[];
  let historySize = 0;
  if (checkpoints) {
    for (const cp of checkpoints) historySize += cp.snapshot.length;
  }

  return {
    actions: actionCount,
    docSize,
    historySize,
    dispatchLatency: 0, // filled by caller
    heapUsed: heapMB(),
  };
}

// ── Stress test ──────────────────────────────────────────────────────────────

const DECK_SIZE = 520; // 10 decks of 52 cards — enough for 500+ actions
const MEASURE_AT = [10, 50, 100, 200, 350, 500]; // measure at these action counts

async function main() {
  console.log("📊 Stress Test: CRDT Document Growth & HistoryManager Memory\n");
  console.log(`Deck size: ${DECK_SIZE} tokens`);
  console.log(`Measuring at: ${MEASURE_AT.join(", ")} actions\n`);

  // Create engine (pure TS path — the common case)
  const engine = new Engine();
  const deck = makeDeck(DECK_SIZE);
  engine.stack = new Stack(engine.session as any, deck, { seed: 42 });
  engine.space = new Space(engine.session as any, "board");

  // Create zones for placement
  engine.dispatch("space:createZone", { name: "zone-a" });
  engine.dispatch("space:createZone", { name: "zone-b" });

  console.log("Initial state:");
  const initial = measure(engine, 0);
  console.log(`  Document: ${formatBytes(initial.docSize)}`);
  console.log(`  Heap: ${initial.heapUsed} MB\n`);

  const measurements: Measurement[] = [];
  let actionCount = 0;
  let measureIdx = 0;

  console.log(`${"Actions".padEnd(8)} ${"Doc Size".padEnd(12)} ${"History".padEnd(12)} ${"Dispatch".padEnd(12)} ${"Heap".padEnd(10)}`);
  console.log(`${"─".repeat(8)} ${"─".repeat(11)} ${"─".repeat(11)} ${"─".repeat(11)} ${"─".repeat(9)}`);

  const maxActions = MEASURE_AT[MEASURE_AT.length - 1];
  const startTime = Date.now();

  for (let i = 0; i < maxActions; i++) {
    // Alternate between draw and place (simulates real gameplay)
    const zone = i % 2 === 0 ? "zone-a" : "zone-b";
    const x = (i % 20);
    const y = Math.floor(i / 20);

    const t0 = Date.now();
    try {
      // Draw a card, then place it
      const drawn = await engine.dispatch("stack:draw", { count: 1 });
      if (drawn && drawn.length > 0) {
        const card = drawn[0];
        await engine.dispatch("space:place", { zone, card, opts: { x, y } });
        actionCount += 2; // two dispatches per iteration
      } else {
        // Deck exhausted — reset and continue
        engine.dispatch("stack:reset", {});
        engine.dispatch("stack:shuffle", { seed: i });
        actionCount += 2;
      }
    } catch (e) {
      // If something fails (e.g., zone full), just continue
    }
    const dt = Date.now() - t0;

    // Measure at checkpoints
    if (measureIdx < MEASURE_AT.length && actionCount >= MEASURE_AT[measureIdx]) {
      const m = measure(engine, actionCount);
      m.dispatchLatency = dt;
      measurements.push(m);
      console.log(
        `${String(m.actions).padEnd(8)} ${formatBytes(m.docSize).padEnd(12)} ${formatBytes(m.historySize).padEnd(12)} ${formatMs(m.dispatchLatency).padEnd(12)} ${m.heapUsed} MB`
      );
      measureIdx++;
    }
  }

  const totalTime = Date.now() - startTime;
  console.log(`\nTotal time: ${formatMs(totalTime)} for ${actionCount} actions`);
  console.log(`Average dispatch latency: ${formatMs(totalTime / actionCount)}`);

  // ── Analysis ───────────────────────────────────────────────────────────────

  console.log("\n📋 Analysis\n");

  if (measurements.length >= 2) {
    const first = measurements[0];
    const last = measurements[measurements.length - 1];

    const docGrowth = last.docSize - first.docSize;
    const actionDelta = last.actions - first.actions;
    const bytesPerAction = docGrowth / actionDelta;
    const historyRatio = last.historySize / last.docSize;

    console.log(`Document growth: ${formatBytes(first.docSize)} → ${formatBytes(last.docSize)} (${actionDelta} actions)`);
    console.log(`Growth rate: ~${Math.round(bytesPerAction)} bytes/action (base64)`);
    console.log(`HistoryManager memory: ${formatBytes(last.historySize)} (${historyRatio.toFixed(0)}× document size)`);
    console.log(`Heap: ${first.heapUsed} MB → ${last.heapUsed} MB`);

    // O(n²) check: if historySize grows superlinearly relative to actions
    if (measurements.length >= 3) {
      const mid = measurements[Math.floor(measurements.length / 2)];
      const earlyRate = mid.historySize / mid.actions;
      const lateRate = last.historySize / last.actions;
      if (lateRate > earlyRate * 1.5) {
        console.log(`\n⚠️  O(n²) confirmed: history memory per action is growing`);
        console.log(`   Early: ${formatBytes(Math.round(earlyRate))}/action → Late: ${formatBytes(Math.round(lateRate))}/action`);
      }
    }

    // Verdict
    console.log("\n🔍 Verdict\n");
    if (last.historySize > 10 * 1024 * 1024) {
      console.log("❌ HistoryManager exceeds 10 MB — O(n²) snapshot storage is the bottleneck.");
      console.log("   Engine.dispatch() calls session.saveToBase64() on every action,");
      console.log("   and HistoryManager stores each result. This is O(n²) in action count.");
    } else if (last.historySize > 1024 * 1024) {
      console.log("⚠️  HistoryManager exceeds 1 MB — approaching problematic territory.");
    } else {
      console.log("✅ HistoryManager memory is manageable at this scale.");
    }

    if (last.docSize > 1024 * 1024) {
      console.log("❌ Document exceeds 1 MB — sync and persistence will be slow.");
    } else if (last.docSize > 200 * 1024) {
      console.log("⚠️  Document exceeds 200 KB — growth is significant.");
    } else {
      console.log("✅ Document size is manageable at this scale.");
    }
  }

  // Exit cleanly
  process.exit(0);
}

main().catch((err) => {
  console.error("Stress test failed:", err);
  process.exit(1);
});
