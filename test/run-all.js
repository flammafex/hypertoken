#!/usr/bin/env node
/**
 * run-all.js — Run every test file, keep going past failures, and print a
 * per-category pass/fail summary. Exits nonzero only if any file failed.
 *
 * Mirrors the invocation conventions in package.json exactly:
 *   - every test/ file runs via `node --loader ./test/ts-esm-loader.js test/<file>`
 *   - testIntegration.js (repo root) runs via plain `node testIntegration.js`
 *
 * Usage:
 *   node test/run-all.js                 # default set (mirrors `npm run test`)
 *   node test/run-all.js --all           # default + extended suites
 *   node test/run-all.js --only <cat>    # run a single category
 *   node test/run-all.js --filter <sub>  # only categories/files whose name contains <sub>
 *   node test/run-all.js --list          # print the mapping without running
 */
import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');

const TIMEOUT_MS = 120_000;

// Default set — mirrors the `test` chain in package.json.
const CATEGORIES = {
  unit: [
    { file: 'testCore.js' },
    { file: 'testEngine.js' },
    { file: 'testExporters.js' },
  ],
  'engine-components': [
    { file: 'testScript.ts' },
    { file: 'testAgent.ts' },
    { file: 'testPolicy.ts' },
  ],
  'core-components': [
    { file: 'testCrypto.ts' },
    { file: 'testRandom.ts' },
  ],
  integration: [
    { file: 'testIntegration.js', integration: true },
  ],
  network: [
    { file: 'testSync.ts' },
    { file: 'testRuleSync.ts' },
  ],
};

// Extended suites — only run with --all.
const EXTENDED = {
  batch: [{ file: 'testBatchActions.ts' }],
  'sync:spike': [{ file: 'testSyncSpike.ts' }],
  'sync:hardening': [{ file: 'testSyncHardening.ts' }],
  persistence: [{ file: 'testPersistence.ts' }],
  'cuttle:sync': [{ file: 'testCuttleSync.ts' }],
  'cuttle:crypto': [{ file: 'testCuttleCrypto.ts' }],
  'cuttle:hardening': [{ file: 'testCuttleHardening.ts' }],
  'watershed:rules': [{ file: 'testWatershedRules.ts' }],
  'watershed:sync': [{ file: 'testWatershedSync.ts' }],
  rooms: [{ file: 'testRoomMultiplexing.ts' }],
  safety: [
    { file: 'testDispatchOutcomes.ts' },
    { file: 'testAuthoritativeProjection.ts' },
  ],
  stress: [{ file: 'stressTest.ts' }],
};

function parseArgs(argv) {
  const opts = { all: false, list: false, filter: null, only: null };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--all') opts.all = true;
    else if (arg === '--list') opts.list = true;
    else if (arg === '--filter') opts.filter = argv[++i] ?? null;
    else if (arg === '--only') opts.only = argv[++i] ?? null;
    else {
      console.error(`Unknown argument: ${arg}`);
      process.exit(2);
    }
  }
  return opts;
}

// Build the ordered list of { category, file, integration } entries.
function buildEntries(opts) {
  const map = { ...CATEGORIES };
  if (opts.all) {
    for (const [cat, files] of Object.entries(EXTENDED)) {
      map[cat] = files;
    }
  }

  let entries = [];
  for (const [category, files] of Object.entries(map)) {
    for (const f of files) {
      entries.push({ category, file: f.file, integration: !!f.integration });
    }
  }

  if (opts.only) {
    const wanted = new Set(opts.only.split(',').map((s) => s.trim()));
    entries = entries.filter((e) => wanted.has(e.category));
  } else if (opts.filter) {
    const sub = opts.filter.toLowerCase();
    entries = entries.filter(
      (e) => e.category.toLowerCase().includes(sub) || e.file.toLowerCase().includes(sub),
    );
  }

  return entries;
}

function printList(entries) {
  const byCat = new Map();
  for (const e of entries) {
    if (!byCat.has(e.category)) byCat.set(e.category, []);
    byCat.get(e.category).push(e);
  }
  for (const [category, list] of byCat) {
    console.log(`[${category}]`);
    for (const e of list) {
      const style = e.integration ? 'node' : 'node --loader ./test/ts-esm-loader.js';
      const target = e.integration ? 'testIntegration.js' : `test/${e.file}`;
      console.log(`  ${style} ${target}`);
    }
  }
}

function buildCommand(e) {
  if (e.integration) {
    return { cmd: 'node', args: ['testIntegration.js'] };
  }
  return {
    cmd: 'node',
    args: ['--loader', './test/ts-esm-loader.js', `test/${e.file}`],
  };
}

// Run one file sequentially. Resolves { ok, timedOut, code, durationMs }.
function runFile(e) {
  return new Promise((resolve) => {
    const { cmd, args } = buildCommand(e);
    const label = `[${e.category}] ${e.file}`;
    const start = Date.now();
    let timedOut = false;

    const child = spawn(cmd, args, { cwd: ROOT, stdio: ['ignore', 'pipe', 'pipe'] });

    const prefix = (stream, chunk) => {
      const text = chunk.toString();
      for (const line of text.split('\n')) {
        if (line.length) console.log(`${label} ${line}`);
      }
    };
    child.stdout.on('data', (d) => prefix('stdout', d));
    child.stderr.on('data', (d) => prefix('stderr', d));

    const timer = setTimeout(() => {
      timedOut = true;
      console.log(`${label} TIMED OUT after ${TIMEOUT_MS / 1000}s — killing`);
      child.kill('SIGKILL');
    }, TIMEOUT_MS);

    child.on('error', (err) => {
      clearTimeout(timer);
      console.log(`${label} failed to start: ${err.message}`);
      resolve({ ok: false, timedOut, code: null, durationMs: Date.now() - start });
    });

    child.on('close', (code) => {
      clearTimeout(timer);
      const ok = !timedOut && code === 0;
      resolve({ ok, timedOut, code, durationMs: Date.now() - start });
    });
  });
}

async function main() {
  const opts = parseArgs(process.argv.slice(2));
  const entries = buildEntries(opts);

  if (entries.length === 0) {
    console.error('No test files matched.');
    process.exit(2);
  }

  if (opts.list) {
    printList(entries);
    return;
  }

  console.log(`Running ${entries.length} test file(s) sequentially...\n`);

  const results = [];
  for (const e of entries) {
    const r = await runFile(e);
    results.push({ ...e, ...r });
  }

  // Summary table
  console.log('\n' + '='.repeat(60));
  console.log('SUMMARY');
  console.log('='.repeat(60));
  const pad = (s, n) => String(s).padEnd(n);
  console.log(`${pad('CATEGORY', 22)}${pad('FILE', 30)}${pad('RESULT', 8)}DURATION`);
  console.log('-'.repeat(60));
  for (const r of results) {
    const status = r.ok ? 'PASS' : 'FAIL';
    const dur = `${(r.durationMs / 1000).toFixed(1)}s`;
    console.log(`${pad(r.category, 22)}${pad(r.file, 30)}${pad(status, 8)}${dur}`);
  }
  console.log('-'.repeat(60));

  const passed = results.filter((r) => r.ok).length;
  const failed = results.length - passed;
  console.log(`${passed} passed, ${failed} failed`);
  console.log('='.repeat(60));

  process.exit(failed > 0 ? 1 : 0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});