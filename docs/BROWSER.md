# Browser Deployment Guide

HyperToken's Engine was designed for Node.js, but can be bundled for the browser
using the shared build infrastructure in `core/browser/`.

## Quick start

```bash
# Build any game for the browser:
npm run build:browser -- --entry examples/your-game/web/client.js --out dist/your-game.bundle.js

# Or use the Confluence build:
npm run confluence:build
```

## How it works

The Engine uses several Node.js built-ins that don't exist in browsers:

| Node.js module | Browser shim | Notes |
|----------------|-------------|-------|
| `node:buffer` | `buffer` npm package | Base64 encoding |
| `node:crypto` | Web Crypto API | `randomBytes`, `createHash`, `randomUUID` |
| `node:events` | `events` npm package | `EventEmitter` |
| `node:worker_threads` | Empty stub | Only used by WASM (disabled with `disableWasm: true`) |
| `node:url` / `node:path` | Empty stub | Only used by WASM |
| `ws` | Native `WebSocket` | Browser has built-in WebSocket |

The shims live in `core/browser/shims.js` and are applied automatically by the
shared esbuild configuration in `core/browser/build.js`.

### Automerge WASM

Automerge 3.x uses a WASM backend. The browser build uses Automerge's
`fullfat_base64` entry point, which inlines the WASM binary as base64 and
initializes it synchronously via `initSync()`. This adds ~2.7MB to the bundle
but eliminates the need for `.wasm` file loading.

## Building a game for the browser

### 1. Write your game client

Create a JS file that imports from the Engine:

```javascript
import { Engine } from '../../../engine/Engine';
import { setupMyGameSync } from '../crdt-actions';

// Use disableWasm: true — required for network sync
const engine = new Engine({ disableWasm: true });
```

**Important:** Always use `disableWasm: true` in browser builds. The WASM
dispatcher doesn't support network sync, and the WASM binary loading is
incompatible with browser bundling.

### 2. Build the bundle

```bash
npm run build:browser -- \
  --entry examples/your-game/web/client.js \
  --out examples/your-game/web/bundle.js \
  --minify
```

### 3. Serve the files

```bash
cd examples/your-game/web
python3 -m http.server 8080
# Open http://localhost:8080
```

### 4. WebSocket URL auto-detection

Your client should auto-detect the WebSocket URL from the page location:

```javascript
function autoDetectWsUrl() {
  if (window.location.protocol === 'file:') return 'ws://localhost:3000';
  const wsProto = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  return wsProto + '//' + window.location.host + '/ws';
}
```

In production behind nginx, this becomes `wss://yourdomain.com/ws`.

## Production deployment

See `examples/confluence/DEPLOY.md` for a complete nginx deployment guide
with WebSocket proxying, HTTPS, and pm2/systemd for the relay server.

## The Automerge proxy issue

Automerge document proxies don't fully support `Object.values()`. When
deriving data from an Automerge-backed state, always serialize first:

```javascript
// Wrong — may return empty/undefined on Automerge proxies
const values = Object.values(state.tokens);

// Correct — serialize to plain object first
const plain = JSON.parse(JSON.stringify(state));
const values = Object.values(plain.tokens);
```

Note: Automerge 3.2.6 appears to have fixed `Object.values()` on proxies,
but the serialization pattern is still recommended for safety.

## Files

| File | Purpose |
|------|---------|
| `core/browser/shims.js` | Browser polyfills for Node.js built-ins |
| `core/browser/build.js` | Shared esbuild configuration + CLI |
| `examples/confluence/DEPLOY.md` | Complete nginx deployment guide |
