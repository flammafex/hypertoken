#!/usr/bin/env node
/**
 * Build script for Confluence Web
 *
 * Bundles ConfluenceGame.ts + crdt-actions.js + Engine for browser use.
 *
 * Key: use Automerge's base64 entry point which inlines the WASM binary
 * and initializes it synchronously — no .wasm file loading needed.
 */
import * as esbuild from 'esbuild';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));

async function build() {
  try {
    await esbuild.build({
      entryPoints: [join(__dirname, 'confluence-web.js')],
      bundle: true,
      outfile: join(__dirname, 'confluence.bundle.js'),
      format: 'esm',
      target: 'es2020',
      platform: 'browser',
      sourcemap: true,
      resolveExtensions: ['.ts', '.js', '.mjs'],
      // Use 'browser' condition so Automerge resolves to its base64 entry
      // point (fullfat_bundler.js → bundler/automerge_wasm.js which imports .wasm)
      // We need to alias to the web entry which uses base64 initSync instead
      alias: {
        '@automerge/automerge': join(__dirname, '../../../node_modules/@automerge/automerge/dist/mjs/entrypoints/fullfat_base64.js'),
        'node:buffer': 'buffer',
        'node:events': 'events',
        'node:crypto': join(__dirname, 'crypto-browser-shim.js'),
        'node:worker_threads': join(__dirname, 'worker-shim.js'),
        'node:url': join(__dirname, 'path-shim.js'),
        'node:path': join(__dirname, 'path-shim.js'),
        'events': 'events',
        'ws': join(__dirname, 'ws-shim.js'),
      },
      define: {
        'process.env.NODE_ENV': '"production"',
        'global': 'globalThis',
      },
    });

    const stats = await import('fs').then(fs => fs.statSync(join(__dirname, 'confluence.bundle.js')));
    console.log(`✓ Built confluence.bundle.js (${(stats.size / 1024 / 1024).toFixed(1)}MB)`);
    console.log('\nBuild complete! Open index.html in a browser to play.');
    console.log('Serve with: npm run confluence:web');
  } catch (error) {
    console.error('Build failed:', error);
    process.exit(1);
  }
}

build();
