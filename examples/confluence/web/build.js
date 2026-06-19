#!/usr/bin/env node
/**
 * Build script for Confluence Web
 * Bundles ConfluenceGame.ts + crdt-actions.js + Engine for browser use.
 *
 * The Engine uses Node.js built-ins (node:buffer, node:crypto, etc.) that
 * don't exist in browsers. We polyfill them and mark WASM-only imports
 * as external (we use disableWasm: true).
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
      // Polyfill Node.js built-ins for browser
      alias: {
        'node:buffer': 'buffer',
        'node:events': 'events',
        'node:crypto': join(__dirname, 'crypto-browser-shim.js'),
        'node:worker_threads': join(__dirname, 'worker-shim.js'),
        'node:url': join(__dirname, 'path-shim.js'),
        'node:path': join(__dirname, 'path-shim.js'),
        'events': 'events',
        'ws': join(__dirname, 'ws-shim.js'),
      },
      // Handle .wasm files — stub them out (we use disableWasm: true)
      loader: {
        '.wasm': 'empty',
      },
      // Redirect the Automerge WASM binary import to our stub
      // (the 'empty' loader creates a broken module; this provides a working one)
      plugins: [{
        name: 'wasm-stub',
        setup(build) {
          build.onResolve({ filter: /automerge_wasm_bg\.wasm$/ }, () => ({
            path: join(__dirname, 'wasm-stub.js'),
          }));
        },
      }],
      define: {
        'process.env.NODE_ENV': '"production"',
        'global': 'globalThis',
      },
    });

    console.log('✓ Built confluence.bundle.js');
    console.log('\nBuild complete! Open index.html in a browser to play.');
    console.log('Serve with: npm run confluence:web');
  } catch (error) {
    console.error('Build failed:', error);
    process.exit(1);
  }
}

build();
