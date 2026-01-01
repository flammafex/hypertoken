# HyperToken Browser Demo

This demo showcases the HyperToken Web Worker + WASM execution in a browser environment.

## Features

- Web Worker execution for non-blocking operations
- WASM-powered high-performance operations
- Real-time statistics and logging
- Environment detection (Node.js vs Browser)

## Requirements

1. **WASM Build**: The WASM modules must be built for the web target:
   ```bash
   npm run build:rust
   ```

2. **Local Server**: The demo must be served via HTTP (not file://) due to:
   - ES Module imports
   - Web Worker restrictions
   - WASM loading requirements
   - CORS policies

## Running the Demo

### Option 1: Using the provided server script

```bash
# From the project root
npm run serve:demo
```

Then open http://localhost:8080/examples/browser-demo/ in your browser.

### Option 2: Using any static file server

```bash
# From the project root
npx serve .

# Or with Python
python -m http.server 8080

# Or with any other static file server
```

Then navigate to http://localhost:<port>/examples/browser-demo/

## Server Configuration

For optimal performance, ensure your server sends the correct headers:

### Required Headers

```
Content-Type: application/wasm (for .wasm files)
Content-Type: application/javascript (for .js files)
```

### Optional Headers (for SharedArrayBuffer support)

```
Cross-Origin-Opener-Policy: same-origin
Cross-Origin-Embedder-Policy: require-corp
```

These headers enable `SharedArrayBuffer` for zero-copy data transfer between the main thread and Web Worker.

## File Structure

```
examples/browser-demo/
├── index.html      # Demo page
├── main.js         # Demo logic
└── README.md       # This file

workers/
└── hypertoken.worker.js  # Web Worker script

core-rs/pkg/web/    # WASM build (generated)
├── hypertoken_core.js
├── hypertoken_core_bg.wasm
└── ...
```

## How It Works

1. **Engine Initialization**: When you click "Initialize Engine", the demo:
   - Loads the `Engine` module
   - Creates an Engine with `useWorker: true`
   - The Engine detects browser environment
   - Creates a `WebWorker` instance (via `UniversalWorker`)
   - WebWorker loads the WASM module in a separate thread

2. **Action Dispatch**: When you click action buttons:
   - Actions are serialized and sent to the Web Worker
   - The Worker processes them using WASM
   - Results are sent back to the main thread
   - The main thread updates the UI

3. **Benefits**:
   - Main thread never blocks during WASM operations
   - Smooth UI even during heavy computations
   - Same API as Node.js worker mode

## Troubleshooting

### "Module not found" errors

Make sure you're running a local server from the project root, not the demo directory.

### "Worker failed to load" errors

1. Check browser console for detailed errors
2. Verify WASM files exist in `core-rs/pkg/web/`
3. Ensure server sends correct MIME types for .wasm files

### "WASM not initialized" errors

1. Run `npm run build:rust` to build WASM modules
2. Check that `core-rs/pkg/web/` contains the built files

### CORS errors

Ensure you're accessing the demo via HTTP, not file://. Web Workers and ES modules require proper HTTP serving.

## Browser Compatibility

| Browser | Supported | Notes |
|---------|-----------|-------|
| Chrome 80+ | Yes | Full support |
| Firefox 79+ | Yes | Full support |
| Safari 15+ | Yes | Full support |
| Edge 80+ | Yes | Full support |

Older browsers may not support ES modules in Web Workers or WebAssembly.

## API Usage

```javascript
// In a browser environment
import { Engine } from '../../engine/Engine.js';

const engine = new Engine({
  useWorker: true,
  workerOptions: {
    debug: true,
    workerPath: '/workers/hypertoken.worker.js',
    wasmPath: '/wasm'
  }
});

// Wait for initialization
await new Promise(resolve => setTimeout(resolve, 500));

// Dispatch actions
await engine.dispatch('stack:shuffle', { seed: 42 });
const cards = await engine.dispatch('stack:draw', { count: 5 });

// Cleanup
await engine.shutdown();
```

## See Also

- [WORKER_MODE.md](../../docs/WORKER_MODE.md) - Complete worker mode documentation
- [core/UniversalWorker.ts](../../core/UniversalWorker.ts) - Environment-agnostic worker wrapper
- [core/WebWorker.ts](../../core/WebWorker.ts) - Browser Web Worker implementation
