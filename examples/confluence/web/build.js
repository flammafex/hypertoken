#!/usr/bin/env node
/**
 * Build script for Confluence Web
 *
 * Bundles ConfluenceGame.ts + crdt-actions.js + Engine for browser use.
 *
 * Key challenge: Automerge 3.x uses a WASM backend (wasm-bindgen). The JS
 * wrapper imports `* as wasm from "./file.wasm"` and calls wasm functions
 * synchronously at module load time. esbuild's built-in loaders can't handle
 * this — 'empty' creates broken modules, 'dataurl' gives a URL not exports.
 *
 * Solution: a custom esbuild plugin that:
 * 1. Reads the .wasm binary at build time
 * 2. Inlines it as base64 in the output
 * 3. At runtime, synchronously instantiates it with new WebAssembly.Module/Instance
 * 4. Re-exports all WASM exports as named ESM exports
 */
import * as esbuild from 'esbuild';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { readFileSync } from 'fs';

const __dirname = dirname(fileURLToPath(import.meta.url));

// Plugin: inline WASM as base64 and synchronously instantiate at runtime
const wasmInlinePlugin = {
  name: 'wasm-inline',
  setup(build) {
    build.onLoad({ filter: /automerge_wasm_bg\.wasm$/ }, async (args) => {
      // Read the WASM binary
      const wasmBytes = readFileSync(args.path);

      // Get export names at build time so we can generate named ESM exports
      const wasmModule = new WebAssembly.Module(wasmBytes);
      const exportSpec = WebAssembly.Module.exports(wasmModule);
      const exportNames = exportSpec.map(e => e.name);

      // Inline as base64
      const base64 = wasmBytes.toString('base64');

      // Generate module that synchronously instantiates and re-exports
      const exportLines = exportNames
        .map(name => `export const ${name} = instance.exports.${name};`)
        .join('\n');

      return {
        contents: `
const base64 = "${base64}";
const binary = Uint8Array.from(atob(base64), c => c.charCodeAt(0));
const module = new WebAssembly.Module(binary);
const instance = new WebAssembly.Instance(module);
${exportLines}
export default instance.exports;
`,
        loader: 'js',
      };
    });
  },
};

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
      plugins: [wasmInlinePlugin],
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
