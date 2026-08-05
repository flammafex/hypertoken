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
 * core/browser/shims.js
 *
 * Browser polyfills for Node.js built-ins used by HyperToken's Engine.
 *
 * The Engine was designed for Node.js and uses:
 * - node:buffer (Buffer for base64 encoding)
 * - node:crypto (randomBytes, createHash, randomUUID)
 * - node:events (EventEmitter — provided by the 'events' npm package)
 * - node:worker_threads (Worker — not needed for sync)
 * - node:url / node:path (fileURLToPath, dirname, join — not needed for sync)
 * - ws (WebSocket — browser has native WebSocket)
 *
 * This file provides shims for the Node.js-only APIs. The 'buffer' and
 * 'events' packages are installed as devDependencies and bundled by esbuild.
 *
 * Usage in esbuild config:
 *   alias: {
 *     'node:buffer': 'buffer',
 *     'node:events': 'events',
 *     'node:crypto': './core/browser/shims.js#crypto',
 *     ...
 *   }
 *
 * Or use the shared build script: core/browser/build.js
 */

// ============================================================================
// Crypto shim — uses Web Crypto API
// ============================================================================

export const webcrypto = globalThis.crypto;

export function randomBytes(size) {
  const bytes = new Uint8Array(size);
  globalThis.crypto.getRandomValues(bytes);
  return bytes;
}

export function randomUUID() {
  return globalThis.crypto.randomUUID();
}

export function createHash(algorithm) {
  if (algorithm !== 'sha256' && algorithm !== 'sha1') {
    console.warn(`[browser-shim] ${algorithm} not supported, falling back to sha256`);
  }
  const chunks = [];
  return {
    update(data) {
      if (typeof data === 'string') {
        chunks.push(new TextEncoder().encode(data));
      } else if (data instanceof Uint8Array) {
        chunks.push(data);
      } else if (data instanceof ArrayBuffer) {
        chunks.push(new Uint8Array(data));
      }
      return this;
    },
    async digest(encoding) {
      const combined = new Uint8Array(chunks.reduce((sum, c) => sum + c.length, 0));
      let offset = 0;
      for (const chunk of chunks) {
        combined.set(chunk, offset);
        offset += chunk.length;
      }
      const hashBuffer = await globalThis.crypto.subtle.digest('SHA-256', combined);
      if (encoding === 'hex') {
        const bytes = new Uint8Array(hashBuffer);
        return Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('');
      }
      return new Uint8Array(hashBuffer);
    },
  };
}

// ============================================================================
// Worker shim — not available in browser
// ============================================================================

export class Worker {
  constructor() {
    throw new Error('Worker not available in browser — Web Workers require separate configuration');
  }
}

// ============================================================================
// Path/URL shim — not used in browser
// ============================================================================

export function fileURLToPath() { return ''; }
export function dirname() { return ''; }
export function join() { return ''; }
export function resolve() { return ''; }
export function extname() { return ''; }

// ============================================================================
// WebSocket shim — browser has native WebSocket
// ============================================================================

export class WebSocket extends globalThis.WebSocket {
  constructor(url, protocols) {
    super(url, protocols);
  }
}

export default {
  webcrypto,
  randomBytes,
  randomUUID,
  createHash,
  Worker,
  WebSocket,
  fileURLToPath,
  dirname,
  join,
  resolve,
  extname,
};
