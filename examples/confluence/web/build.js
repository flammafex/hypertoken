#!/usr/bin/env node
/**
 * Build script for Confluence Web
 * Bundles ConfluenceGame.ts + crdt-actions.js + Engine for browser use.
 */
import * as esbuild from 'esbuild';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));

async function build() {
  try {
    // Bundle the web client with all dependencies
    await esbuild.build({
      entryPoints: [join(__dirname, 'confluence-web.js')],
      bundle: true,
      outfile: join(__dirname, 'confluence.bundle.js'),
      format: 'esm',
      target: 'es2020',
      platform: 'browser',
      sourcemap: true,
      define: {
        'process.env.NODE_ENV': '"production"',
      },
    });

    console.log('✓ Built confluence.bundle.js');
    console.log('\nBuild complete! Open index.html in a browser to play.');
    console.log('Serve with: python3 -m http.server 8080 (from this directory)');
  } catch (error) {
    console.error('Build failed:', error);
    process.exit(1);
  }
}

build();
