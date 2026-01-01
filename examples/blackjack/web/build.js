#!/usr/bin/env node
/**
 * Build script for Blackjack Web
 * Compiles blackjack-game-browser.js for browser use
 */

import * as esbuild from 'esbuild';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));

async function build() {
  try {
    // Bundle BlackjackGame for browser
    await esbuild.build({
      entryPoints: [join(__dirname, '../blackjack-game-browser.js')],
      bundle: true,
      outfile: join(__dirname, 'BlackjackGame.bundle.js'),
      format: 'esm',
      target: 'es2020',
      platform: 'browser',
      sourcemap: true,
    });

    console.log('Built BlackjackGame.bundle.js');

    // Also build for production (minified)
    await esbuild.build({
      entryPoints: [join(__dirname, '../blackjack-game-browser.js')],
      bundle: true,
      outfile: join(__dirname, 'BlackjackGame.bundle.min.js'),
      format: 'esm',
      target: 'es2020',
      platform: 'browser',
      minify: true,
    });

    console.log('Built BlackjackGame.bundle.min.js (minified)');
    console.log('\nBuild complete! Open index.html in a browser to play.');

  } catch (error) {
    console.error('Build failed:', error);
    process.exit(1);
  }
}

build();
