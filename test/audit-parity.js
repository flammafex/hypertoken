#!/usr/bin/env -S node --loader ./test/ts-esm-loader.js
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

/**
 * test/audit-parity.js
 *
 * Standalone parity-audit: enforces "code, docs, and WASM routing must agree."
 *
 * Run:  node --loader ./test/ts-esm-loader.js test/audit-parity.js
 *
 * Checks (code is the source of truth; docs are cross-checked against it):
 *   [1] ActionRegistry count (code truth) — engine/actions.ts
 *   [2] WASM allowlist (WASM_ACTIONS) — engine/WasmManager.ts
 *   [3] Allowlisted actions -> Rust handler (FUZZY symbol match, WARN-only)
 *   [4] Allowlisted actions -> chronicle-incremental parity coverage (CRISP, FAIL)
 *   [5] Docs vs registry: engine/ACTIONS.md (counts + membership)
 *   [6] Docs vs registry: engine/ACTIONS_COMPLETE.md (counts + membership)
 *   [7] Rust field-level method count vs docs (54/~56 claims) — chronicle_actions
 *
 * Exit code 1 if any FAIL, else 0. Deterministic; no new dependencies.
 */

import { ActionRegistry } from '../engine/actions.js';
import { WasmManager } from '../engine/WasmManager.js';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '..');

// ── tiny report helpers ─────────────────────────────────────────────────────
let failures = 0;
let warns = 0;
let passes = 0;

function emit(status, msg) {
  const label = status === 'PASS' ? 'PASS' : status === 'FAIL' ? 'FAIL' : 'WARN';
  console.log(`  ${label}  ${msg}`);
  if (status === 'FAIL') failures++;
  else if (status === 'WARN') warns++;
  else passes++;
}

function group(title) {
  console.log('');
  console.log(`[${title}]`);
}

function readFile(rel) {
  return fs.readFileSync(path.join(repoRoot, rel), 'utf8');
}

// ── Rust symbol collection ──────────────────────────────────────────────────
// Collects every `pub fn <name>` across the given files. The regex does not
// require a `(` immediately after the name so generic fns (e.g. `batch_shuffle<T>`)
// are captured too. Test modules use `fn` (not `pub fn`), so they are excluded.
function collectRustPubFns(relPaths) {
  const fns = [];
  for (const rel of relPaths) {
    const src = readFile(rel);
    for (const m of src.matchAll(/^\s*pub fn\s+([a-zA-Z0-9_]+)/gm)) {
      fns.push(m[1]);
    }
  }
  return fns;
}

// ── code-derived truth ──────────────────────────────────────────────────────
const registryActions = Object.keys(ActionRegistry).sort();
const registrySet = new Set(registryActions);
const allowlist = [...WasmManager.WASM_ACTIONS].sort();

// The 7 game-loop verbs are the documented GameLoop lifecycle set. Only three of
// them (loopInit/loopStart/loopStop) literally start with "game:loop", so the
// category split cannot rely on the prefix alone — classify by verb.
const GAMELOOP_VERBS = new Set([
  'loopInit', 'loopStart', 'loopStop', 'nextTurn', 'setPhase', 'setMaxTurns', 'setActiveAgent',
]);

function isGameLoopKey(k) {
  if (!k.startsWith('game:')) return false;
  return GAMELOOP_VERBS.has(k.slice('game:'.length));
}

function registryCategoryCounts() {
  const keys = Object.keys(ActionRegistry);
  return {
    stack: keys.filter((k) => k.startsWith('stack:')).length,
    space: keys.filter((k) => k.startsWith('space:')).length,
    source: keys.filter((k) => k.startsWith('source:')).length,
    agent: keys.filter((k) => k.startsWith('agent:')).length,
    game: keys.filter((k) => k.startsWith('game:') && !isGameLoopKey(k)).length,
    gameloop: keys.filter(isGameLoopKey).length,
    rule: keys.filter((k) => k.startsWith('rule:')).length,
    token: keys.filter((k) => k.startsWith('token:')).length,
    tokens: keys.filter((k) => k.startsWith('tokens:')).length,
    debug: keys.filter((k) => k.startsWith('debug:')).length,
  };
}
const regCat = registryCategoryCounts();

// ── [1] ActionRegistry ──────────────────────────────────────────────────────
console.log('='.repeat(72));
console.log('HYPERTOKEN PARITY AUDIT — code / docs / WASM routing agreement');
console.log('='.repeat(72));

group('1. ActionRegistry (code truth)');
emit('PASS', `registry has ${registryActions.length} registered actions`);
for (const [cat, n] of Object.entries(regCat)) {
  console.log(`        ${cat}: ${n}`);
}

// ── [2] WASM allowlist ──────────────────────────────────────────────────────
group('2. WASM allowlist (WASM_ACTIONS)');
emit('PASS', `allowlist has ${allowlist.length} actions routed to the Rust backend`);
{
  const notInRegistry = allowlist.filter((a) => !registrySet.has(a));
  if (notInRegistry.length === 0) {
    emit('PASS', 'every allowlisted action exists in the ActionRegistry');
  } else {
    emit('FAIL', `allowlisted but NOT in ActionRegistry: ${notInRegistry.join(', ')}`);
  }
}

// ── [3] Allowlisted actions -> Rust handlers (FUZZY) ───────────────────────
group('3. Allowlisted actions -> Rust handler (fuzzy symbol match)');
// FUZZY ASSUMPTION: the repo convention maps `category:verb` to a snake_case
// Rust fn. We try, in order:
//   {category}_{verb_snake}, {verb_snake}, {category}_{verb_snake}_action,
//   {verb_snake}_action, and for tokens:* -> batch_{verb_snake}.
// game:loop* -> game_loop_{rest} (the "loop" prefix is stripped), and non-loop
// game:* -> game_state_{verb_snake} (chronicle_actions) or game_{verb_snake}
// (ActionDispatcher). If none match, a suffix fallback (any fn ending in
// _{verb_snake}) is tried. Because this is a naming heuristic, unmatched
// actions are reported as WARN, never FAIL.
const rustFiles = [
  'core-rs/src/chronicle_actions/stack.rs',
  'core-rs/src/chronicle_actions/space.rs',
  'core-rs/src/chronicle_actions/source.rs',
  'core-rs/src/chronicle_actions/agent.rs',
  'core-rs/src/chronicle_actions/game_loop.rs',
  'core-rs/src/chronicle_actions/game_state.rs',
  'core-rs/src/chronicle_actions/rules.rs',
  'core-rs/src/chronicle_actions/helpers.rs',
  'core-rs/src/actions.rs',
  'core-rs/src/batch.rs',
  'core-rs/src/parallel.rs',
];
const rustFnSet = new Set(collectRustPubFns(rustFiles));

function rustCandidates(actionType) {
  const [cat, verb] = actionType.split(':');
  const snake = verb.replace(/([a-z0-9])([A-Z])/g, '$1_$2').toLowerCase();
  const cands = new Set([
    `${cat}_${snake}`,
    snake,
    `${cat}_${snake}_action`,
    `${snake}_action`,
  ]);
  if (cat === 'tokens') cands.add(`batch_${snake}`);
  if (cat === 'game' && verb.startsWith('loop')) {
    const rest = verb.replace(/^loop/, '').replace(/([a-z0-9])([A-Z])/g, '$1_$2').toLowerCase();
    cands.add(`game_loop_${rest}`);
  }
  if (cat === 'game' && !verb.startsWith('loop')) {
    cands.add(`game_state_${snake}`);
  }
  return { snake, cands };
}

{
  const exact = [];
  const suffix = [];
  const missing = [];
  for (const a of allowlist) {
    const { snake, cands } = rustCandidates(a);
    let found = [...cands].find((c) => rustFnSet.has(c));
    let via = null;
    if (!found) {
      // FUZZY ASSUMPTION: fall back to any fn whose name ends with the verb.
      const sfx = [...rustFnSet].find(
        (f) => f.endsWith(`_${snake}`) || f.endsWith(`_${snake}_action`)
      );
      if (sfx) { found = sfx; via = 'suffix'; }
    }
    if (found) (via ? suffix : exact).push(`${a} -> ${found}`);
    else missing.push(a);
  }
  emit('PASS', `${exact.length} allowlisted actions matched a Rust handler by name`);
  if (suffix.length > 0) {
    emit('WARN', `${suffix.length} matched via fuzzy suffix fallback: ${suffix.join(', ')}`);
  }
  if (missing.length > 0) {
    emit('WARN', `${missing.length} allowlisted actions have NO matching Rust handler: ${missing.join(', ')}`);
  } else {
    emit('PASS', 'all allowlisted actions have a matching Rust handler');
  }
  // FUZZY ASSUMPTION note: token:* and tokens:* handlers live in the
  // ActionDispatcher (core-rs/src/actions.rs) and batch.rs, not chronicle_actions/.
  console.log('        (note: token:* / tokens:* handlers live in actions.rs + batch.rs, not chronicle_actions/)');
}

// ── [4] Allowlisted actions -> chronicle-incremental parity coverage (CRISP) ─
group('4. Allowlisted actions -> chronicle-incremental parity coverage');
// CRISP: every allowlisted action's canonical dispatch string must appear in
// test/testChronicleIncremental.ts (the TS/WASM parity harness). Missing
// coverage is a hard failure.
{
  const paritySrc = readFile('test/testChronicleIncremental.ts');
  const covered = allowlist.filter((a) => paritySrc.includes(a));
  const missing = allowlist.filter((a) => !paritySrc.includes(a));
  emit('PASS', `${covered.length}/${allowlist.length} allowlisted actions are exercised by the parity harness`);
  if (missing.length > 0) {
    emit('FAIL', `${missing.length} allowlisted actions have NO chronicle-incremental coverage: ${missing.join(', ')}`);
  } else {
    emit('PASS', 'all allowlisted actions have chronicle-incremental coverage');
  }
}

// ── doc parsing helpers ─────────────────────────────────────────────────────
// Per-category counts from a doc's quick-reference table: "| **Stack** | 11 | ..."
function extractCategoryCounts(text) {
  const out = {};
  for (const m of text.matchAll(/^\|\s*\*\*([A-Za-z ]+?)\*\*\s*\|\s*\**(\d+)\**\s*\|/gm)) {
    const name = m[1].trim();
    if (name.toLowerCase() === 'total') continue;
    out[name] = parseInt(m[2], 10);
  }
  return out;
}

// Declared total-action claims, e.g. "all 81 built-in actions", "Total | 81".
function declaredTotals(text) {
  const out = [];
  const patterns = [
    /all\s+(\d+)\s+built-in\s+actions/gi,
    /\*\*Total(?: \(TS ActionRegistry\))?\*\*\s*\|\s*\**(\d+)/gi,
    /Total:\s*\*?\*?(\d+)\s*actions/gi,
    /total to\s+(\d+)\s+actions/gi,
  ];
  for (const re of patterns) {
    for (const m of text.matchAll(re)) out.push(parseInt(m[1], 10));
  }
  return out;
}

// Action-type strings from markdown headings: "## `agent:create`",
// "## `tokens:map` / `batch:map`" (captures both).
function extractHeadingActions(text) {
  const out = [];
  for (const line of text.split('\n')) {
    if (!/^#{1,4}\s/.test(line)) continue;
    for (const m of line.matchAll(/`([a-zA-Z]+:[a-zA-Z]+)`/g)) out.push(m[1]);
  }
  return [...new Set(out)];
}

// Action list from "**Actions:** a, b, c" lines, attributed to the enclosing
// "### ... [Xxx Actions](...) (N)" / "### ... Xxx Actions (N)" heading.
function extractSectionedActionLists(text) {
  const out = [];
  const CAT_PREFIX = {
    stack: 'stack', space: 'space', source: 'source', agent: 'agent',
    game: 'game', gameloop: 'game', rules: 'rule', token: 'token',
    batch: 'tokens', debug: 'debug',
  };
  let cur = null;
  for (const line of text.split('\n')) {
    const h = line.match(/^###\s+.*?([A-Za-z]+)\s+Actions/);
    if (h) {
      cur = CAT_PREFIX[h[1].toLowerCase()] ?? null;
      continue;
    }
    if (cur && /^\*\*Actions:\*\*/.test(line.trim())) {
      const verbs = line
        .replace('**Actions:**', '')
        .split(',')
        .map((s) => s.trim().replace(/`/g, ''))
        .filter(Boolean);
      for (const v of verbs) out.push(`${cur}:${v}`);
    }
  }
  return out;
}

const CAT_MAP = {
  stack: 'stack', space: 'space', source: 'source', agent: 'agent',
  game: 'game', gameloop: 'gameloop', rules: 'rule', token: 'token',
  batch: 'tokens', debug: 'debug',
};

function compareDocToRegistry(docRel, docLabel) {
  const text = readFile(docRel);
  const totals = declaredTotals(text);
  const catCounts = extractCategoryCounts(text);
  const headingActions = extractHeadingActions(text);
  const sectionedActions = extractSectionedActionLists(text);
  const documentedActions = headingActions.length > 0 ? headingActions : sectionedActions;

  // Total count claims vs registry.
  const distinct = [...new Set(totals)];
  if (distinct.length === 0) {
    emit('WARN', `${docLabel}: no declared total-action count found to compare`);
  } else {
    for (const n of distinct) {
      const occ = totals.filter((x) => x === n).length;
      if (n === registryActions.length) {
        emit('PASS', `${docLabel}: declares ${n} total actions (${occ}x) == registry ${registryActions.length}`);
      } else {
        emit('FAIL', `${docLabel}: declares ${n} total actions (${occ}x) != registry ${registryActions.length}`);
      }
    }
  }

  // Per-category counts vs registry.
  for (const [docName, docN] of Object.entries(catCounts)) {
    const regKey = CAT_MAP[docName.toLowerCase()];
    if (!regKey) { emit('WARN', `${docLabel}: unknown category "${docName}" in table`); continue; }
    const regN = regCat[regKey];
    if (docN === regN) {
      emit('PASS', `${docLabel}: category ${docName} = ${docN} == registry ${regN}`);
    } else {
      emit('FAIL', `${docLabel}: category ${docName} = ${docN} != registry ${regN}`);
    }
  }

  // Membership diff (informational; reinforces the count contract).
  if (documentedActions.length > 0) {
    const docOnly = documentedActions.filter((a) => !registrySet.has(a));
    const regOnly = registryActions.filter((a) => !documentedActions.includes(a));
    if (docOnly.length === 0 && regOnly.length === 0) {
      emit('PASS', `${docLabel}: documented action list matches registry exactly (${documentedActions.length} actions)`);
    } else {
      if (docOnly.length > 0) {
        emit('WARN', `${docLabel}: documented-but-not-registered: ${docOnly.join(', ')}`);
      }
      if (regOnly.length > 0) {
        emit('WARN', `${docLabel}: registered-but-not-documented: ${regOnly.join(', ')}`);
      }
    }
  } else {
    emit('WARN', `${docLabel}: no per-action headings/list to diff against registry`);
  }
}

// ── [5] ACTIONS.md ──────────────────────────────────────────────────────────
group('5. Docs vs registry: engine/ACTIONS.md');
compareDocToRegistry('engine/ACTIONS.md', 'ACTIONS.md');

// ── [6] ACTIONS_COMPLETE.md ─────────────────────────────────────────────────
group('6. Docs vs registry: engine/ACTIONS_COMPLETE.md');
compareDocToRegistry('engine/ACTIONS_COMPLETE.md', 'ACTIONS_COMPLETE.md');

// ── [7] Rust field-level method count vs docs (54/~56 claims) ───────────────
group('7. Rust field-level method count vs docs (54/~56 claims)');
// Code truth: count `pub fn` in the chronicle_actions action modules
// (stack, space, source, agent, game_loop, game_state, rules). helpers.rs is
// excluded (it holds transaction primitives, not action methods) — matching the
// codemap's own inventory. Test modules use `fn`, so they are excluded too.
{
  const ACTION_MODULES = ['stack', 'space', 'source', 'agent', 'game_loop', 'game_state', 'rules'];
  const actualPerModule = {};
  for (const mod of ACTION_MODULES) {
    actualPerModule[mod] = collectRustPubFns([`core-rs/src/chronicle_actions/${mod}.rs`]).length;
  }
  const actualTotal = Object.values(actualPerModule).reduce((a, b) => a + b, 0);
  const helpersCount = collectRustPubFns(['core-rs/src/chronicle_actions/helpers.rs']).length;
  emit('PASS', `code: ${actualTotal} action methods in chronicle_actions (${helpersCount} helpers excluded)`);
  console.log(`        per-module: ${Object.entries(actualPerModule).map(([m, n]) => `${m}=${n}`).join(', ')}`);

  // Find every 54-57 claim in the two docs and compare each to the actual count.
  function findCountClaims(text) {
    const out = [];
    for (const m of text.matchAll(/\b(5[4-7])\b/g)) {
      const start = Math.max(0, m.index - 50);
      const snippet = text.slice(start, m.index + m[0].length + 50).replace(/\s+/g, ' ').trim();
      out.push({ count: parseInt(m[1], 10), snippet });
    }
    const seen = new Set();
    return out.filter((o) => {
      const k = `${o.count}|${o.snippet}`;
      if (seen.has(k)) return false;
      seen.add(k);
      return true;
    });
  }

  const codemapClaims = findCountClaims(readFile('core-rs/src/chronicle_actions/codemap.md'));
  const wasmClaims = findCountClaims(readFile('WASM_INTEGRATION.md'));

  for (const c of codemapClaims) {
    if (c.count === actualTotal) {
      emit('PASS', `codemap.md: claims ${c.count} action methods == code (${actualTotal})`);
    } else {
      emit('FAIL', `codemap.md: claims ${c.count} action methods != code (${actualTotal})`);
    }
    console.log(`        ...${c.snippet}`);
  }
  for (const c of wasmClaims) {
    if (c.count === actualTotal) {
      emit('PASS', `WASM_INTEGRATION.md: claims ${c.count} action methods == code (${actualTotal})`);
    } else {
      emit('FAIL', `WASM_INTEGRATION.md: claims ${c.count} action methods != code (${actualTotal})`);
    }
    console.log(`        ...${c.snippet}`);
  }

  // Per-module claims in the docs.
  function moduleClaims(text, format) {
    const out = [];
    if (format === 'codemap') {
      for (const m of text.matchAll(/`([a-z_]+)\.rs`\s+(\d+)/g)) {
        out.push({ mod: m[1], count: parseInt(m[2], 10) });
      }
    } else {
      for (const m of text.matchAll(/`([a-z_]+)\.rs`\s+#\s+(\d+)\s+[a-z ]+actions?/gi)) {
        out.push({ mod: m[1], count: parseInt(m[2], 10) });
      }
    }
    return out.filter((o) => ACTION_MODULES.includes(o.mod));
  }

  const codemapMods = moduleClaims(readFile('core-rs/src/chronicle_actions/codemap.md'), 'codemap');
  const wasmMods = moduleClaims(readFile('WASM_INTEGRATION.md'), 'wasm');
  for (const m of codemapMods) {
    if (m.count === actualPerModule[m.mod]) {
      emit('PASS', `codemap.md: ${m.mod} = ${m.count} == code`);
    } else {
      emit('FAIL', `codemap.md: ${m.mod} = ${m.count} != code (${actualPerModule[m.mod]})`);
    }
  }
  for (const m of wasmMods) {
    if (m.count === actualPerModule[m.mod]) {
      emit('PASS', `WASM_INTEGRATION.md: ${m.mod} = ${m.count} == code`);
    } else {
      emit('FAIL', `WASM_INTEGRATION.md: ${m.mod} = ${m.count} != code (${actualPerModule[m.mod]})`);
    }
  }
}

// ── [8] Summary ─────────────────────────────────────────────────────────────
group('8. Summary');
console.log('='.repeat(72));
console.log('SUMMARY');
console.log('='.repeat(72));
console.log(`  Passed:   ${passes}`);
console.log(`  Failed:   ${failures}`);
console.log(`  Warnings: ${warns}`);
console.log('');
if (failures > 0) {
  console.log(`VERDICT: FAIL (${failures} hard mismatch${failures > 1 ? 'es' : ''} — code/docs/WASM routing disagree)`);
  console.log('Exit code: 1');
  process.exit(1);
} else {
  console.log('VERDICT: PASS (code, docs, and WASM routing agree)');
  console.log('Exit code: 0');
  process.exit(0);
}