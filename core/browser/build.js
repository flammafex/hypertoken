#!/usr/bin/env node
/**
 * core/browser/build.js
 *
 * Shared esbuild configuration for bundling HyperToken for the browser.
 *
 * Handles:
 * - Node.js built-in polyfills (buffer, crypto, events, worker_threads, etc.)
 * - Automerge WASM binary inlining (via fullfat_base64 entry point)
 * - TypeScript resolution (.ts files)
 * - WebSocket shim (native browser WebSocket)
 *
 * Usage:
 *   node --loader ./test/ts-esm-loader.js core/browser/build.js \
 *     --entry examples/confluence/web/confluence-web.js \
 *     --out examples/confluence/web/confluence.bundle.js
 *
 * Or programmatically:
 *   import { buildForBrowser } from './core/browser/build.js';
 *   await buildForBrowser({ entry: '...', outfile: '...' });
 */
import * as esbuild from 'esbuild';
import { fileURLToPath } from 'url';
import { dirname, join, resolve } from 'path';
import { readFileSync } from 'fs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = resolve(__dirname, '..', '..');

/**
 * Build a HyperToken game/client for the browser.
 *
 * @param options.entry - Entry point JS file (relative to project root)
 * @param options.outfile - Output file path (relative to project root)
 * @param options.minify - Whether to minify (default: false)
 * @param options.sourcemap - Whether to generate sourcemaps (default: true)
 */
export async function buildForBrowser(options = {}) {
  const {
    entry,
    outfile,
    minify = false,
    sourcemap = true,
  } = options;

  if (!entry) throw new Error('entry is required');
  if (!outfile) throw new Error('outfile is required');

  const shimsDir = join(__dirname, 'shims.js');
  const automergeBase64 = join(
    PROJECT_ROOT,
    'node_modules/@automerge/automerge/dist/mjs/entrypoints/fullfat_base64.js',
  );

  const result = await esbuild.build({
    entryPoints: [resolve(PROJECT_ROOT, entry)],
    bundle: true,
    outfile: resolve(PROJECT_ROOT, outfile),
    format: 'esm',
    target: 'es2020',
    platform: 'browser',
    sourcemap,
    minify,
    resolveExtensions: ['.ts', '.js', '.mjs'],
    alias: {
      // Use Automerge's base64 entry point (inlines WASM, no .wasm file loading)
      '@automerge/automerge': automergeBase64,
      // Polyfill Node.js built-ins
      'node:buffer': 'buffer',
      'node:events': 'events',
      'node:crypto': shimsDir,
      'node:worker_threads': shimsDir,
      'node:url': shimsDir,
      'node:path': shimsDir,
      'events': 'events',
      'ws': shimsDir,
    },
    define: {
      'process.env.NODE_ENV': '"production"',
      'global': 'globalThis',
    },
  });

  const stats = readFileSync(resolve(PROJECT_ROOT, outfile));
  console.log(`✓ Built ${outfile} (${(stats.length / 1024 / 1024).toFixed(1)}MB)`);

  return result;
}

// CLI entry point
if (process.argv[1] && !process.argv[1].endsWith('build.js')) {
  // Not running directly
} else {
  const args = process.argv.slice(2);
  let entry = null;
  let outfile = null;
  let minify = false;

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--entry' && args[i + 1]) entry = args[i + 1];
    if (args[i] === '--out' && args[i + 1]) outfile = args[i + 1];
    if (args[i] === '--minify') minify = true;
  }

  if (!entry || !outfile) {
    console.error('Usage: node core/browser/build.js --entry <path> --out <path> [--minify]');
    console.error('Example: node core/browser/build.js --entry examples/confluence/web/confluence-web.js --out examples/confluence/web/confluence.bundle.js');
    process.exit(1);
  }

  buildForBrowser({ entry, outfile, minify }).catch((err) => {
    console.error('Build failed:', err);
    process.exit(1);
  });
}
