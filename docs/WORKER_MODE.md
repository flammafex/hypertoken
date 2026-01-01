# Worker Mode Guide

> **✅ UPDATE: Rust/WASM Migration 100% Complete!**
> All worker operations now use the high-performance Rust/WASM core. Worker Mode combines multi-threading with WASM execution for improved performance (benchmarks show ~20x improvement for Stack/Space operations).

## Overview

Worker Mode enables multi-threaded execution of HyperToken operations using Node.js Worker Threads (server) or Web Workers (browser). This allows compute-intensive operations to run in parallel without blocking the main thread, providing better responsiveness and performance for heavy workloads.

The same `useWorker: true` API works in both environments - HyperToken automatically detects the runtime and uses the appropriate worker implementation.

## Table of Contents

- [Quick Start](#quick-start)
- [When to Use Worker Mode](#when-to-use-worker-mode)
- [Performance Characteristics](#performance-characteristics)
- [Configuration](#configuration)
- [API Reference](#api-reference)
- [Advanced Usage](#advanced-usage)
- [Troubleshooting](#troubleshooting)
- [Browser Support](#browser-support)

---

## Quick Start

### Basic Setup

```javascript
import { Engine } from './engine/Engine.js';

// Create engine with worker mode enabled
const engine = new Engine({
  useWorker: true
});

// Use async API for non-blocking execution
await engine.dispatchAsync('stack:shuffle', { seed: 42 });
await engine.dispatchAsync('stack:draw', { count: 5 });

// Shutdown when done
await engine.shutdown();
```

### With Custom Options

```javascript
const engine = new Engine({
  useWorker: true,
  workerOptions: {
    debug: true,              // Enable debug logging
    timeout: 30000,           // 30s timeout per action
    enableBatching: true,     // Batch rapid actions
    batchWindow: 10           // 10ms batching window
  }
});
```

---

## When to Use Worker Mode

### ✅ Use Worker Mode When:

1. **Heavy Computation** - Operations take >10ms
   ```javascript
   // Shuffling large decks
   await engine.dispatchAsync('stack:shuffle', { seed: Date.now() });

   // Processing many tokens
   await engine.dispatchAsync('agent:drawCards', { count: 1000 });
   ```

2. **UI Responsiveness Critical** - Main thread must stay responsive
   ```javascript
   // Game server handling multiple clients
   const server = new Engine({ useWorker: true });

   // Web UI with smooth animations
   const ui = new Engine({ useWorker: true });
   ```

3. **Concurrent Workflows** - Multiple operations in parallel
   ```javascript
   // Execute multiple actions concurrently
   await Promise.all([
     engine.dispatchAsync('stack:shuffle'),
     engine.dispatchAsync('space:validate'),
     engine.dispatchAsync('agent:process')
   ]);
   ```

4. **Batch Processing** - Rapid sequences of actions
   ```javascript
   const engine = new Engine({
     useWorker: true,
     workerOptions: { enableBatching: true }
   });

   // These get automatically batched
   for (let i = 0; i < 100; i++) {
     await engine.dispatchAsync('stack:draw', { count: 1 });
   }
   ```

### ❌ Don't Use Worker Mode When:

1. **Simple Operations** - Actions complete in <1ms
2. **Single Synchronous Flow** - No parallelization benefit
3. **Debugging** - Sync mode easier to debug
4. **Legacy Browsers** - Older browsers without ES Module Worker support

---

## Performance Characteristics

### Benchmarks (Node.js)

Based on real-world measurements:

| Metric | Value | Meaning |
|--------|-------|---------|
| **Ping Overhead** | 0.097ms | Round-trip communication cost |
| **Action Dispatch** | 0.194ms | Full execution + overhead |
| **Concurrent (5x)** | 0.109ms/action | Parallel execution benefit |
| **P95 Latency** | 0.292ms | 95th percentile response time |

### Trade-offs

**Advantages:**
- ✅ Non-blocking main thread
- ✅ True parallelization
- ✅ Better throughput for heavy operations
- ✅ Graceful degradation (falls back to sync on failure)

**Costs:**
- ❌ +0.2ms latency per action
- ❌ Memory overhead (~2-3MB per worker)
- ❌ Complexity (async/await required)

### Rule of Thumb

```
If operation_time > 10ms:
    worker_mode_benefit = operation_time - 0.2ms

Example:
    50ms operation → 49.8ms benefit ✅
    1ms operation  → -0.2ms penalty ❌
```

---

## Configuration

### Engine Options

```typescript
interface EngineOptions {
  useWorker?: boolean;      // Enable worker mode (default: false)
  workerOptions?: {
    // Common options (Node.js and Browser)
    debug?: boolean;        // Debug logging (default: false)
    timeout?: number;       // Action timeout in ms (default: 30000)
    enableBatching?: boolean; // Batch rapid actions (default: false)
    batchWindow?: number;   // Batching window in ms (default: 10)

    // Browser-specific options
    workerPath?: string;    // Path to worker script (default: '/workers/hypertoken.worker.js')
    wasmPath?: string;      // Path to WASM files (default: '/wasm/')
  };
}
```

### Worker Options Explained

#### `debug: boolean`
Enables detailed logging of worker operations:
```javascript
const engine = new Engine({
  useWorker: true,
  workerOptions: { debug: true }
});

// Logs:
// 🔧 Worker: Loading WASM...
// ✅ Worker: WASM loaded and initialized
// ✅ Worker: Ready and listening for messages
```

#### `timeout: number`
Maximum time to wait for action completion:
```javascript
const engine = new Engine({
  useWorker: true,
  workerOptions: { timeout: 5000 }  // 5 second timeout
});

try {
  await engine.dispatchAsync('slow:operation');
} catch (error) {
  // Throws if operation takes >5s
}
```

#### `enableBatching: boolean`
Batches actions within a time window:
```javascript
const engine = new Engine({
  useWorker: true,
  workerOptions: {
    enableBatching: true,
    batchWindow: 10  // 10ms window
  }
});

// These actions may be batched together
await engine.dispatchAsync('stack:draw', { count: 1 });
await engine.dispatchAsync('stack:draw', { count: 1 });
await engine.dispatchAsync('stack:draw', { count: 1 });
```

**Benefits:**
- Reduces worker communication overhead
- Better throughput for rapid actions
- Automatic optimization

**Trade-offs:**
- Adds up to `batchWindow` latency
- All batched actions succeed or fail together

---

## API Reference

### Engine Methods

#### `dispatchAsync(type, payload, opts)`

Asynchronous action dispatch with worker execution.

```typescript
async dispatchAsync(
  type: string,
  payload: IActionPayload = {},
  opts: any = {}
): Promise<any>
```

**Parameters:**
- `type` - Action type (e.g., `'stack:shuffle'`)
- `payload` - Action payload
- `opts` - Additional options

**Returns:** Promise resolving to action result

**Example:**
```javascript
const result = await engine.dispatchAsync('stack:shuffle', {
  seed: 12345
});
console.log('Shuffle result:', result);
```

#### `dispatch(type, payload, opts)`

Synchronous action dispatch (backwards compatible).

```typescript
dispatch(
  type: string,
  payload: IActionPayload = {},
  opts: any = {}
): any
```

**Note:** When worker mode enabled, this falls back to sync execution and logs a warning.

**Example:**
```javascript
// Still works, but blocks main thread
const result = engine.dispatch('stack:peek', { count: 1 });
```

#### `shutdown()`

Gracefully terminates worker and cleans up resources.

```typescript
async shutdown(): Promise<void>
```

**Example:**
```javascript
await engine.shutdown();
// Engine can no longer dispatch actions
```

### Worker Events

The worker forwards events to the engine:

```javascript
engine.on('state:updated', (payload) => {
  console.log('State changed:', payload);
});

engine.on('engine:action', ({ payload }) => {
  console.log('Action completed:', payload);
});

engine.on('engine:error', ({ payload }) => {
  console.error('Error:', payload.error);
});

engine.on('engine:shutdown', () => {
  console.log('Engine shut down');
});
```

---

## Advanced Usage

### Concurrent Action Patterns

#### Pattern 1: Parallel Independent Actions
```javascript
// Execute multiple actions concurrently
const [shuffleResult, drawResult, validateResult] = await Promise.all([
  engine.dispatchAsync('stack:shuffle'),
  engine.dispatchAsync('stack:draw', { count: 5 }),
  engine.dispatchAsync('space:validate')
]);
```

#### Pattern 2: Sequential Dependent Actions
```javascript
// Execute actions in sequence
await engine.dispatchAsync('stack:shuffle');
const drawn = await engine.dispatchAsync('stack:draw', { count: 5 });
await engine.dispatchAsync('agent:receive', { tokens: drawn });
```

#### Pattern 3: Batch Processing
```javascript
const engine = new Engine({
  useWorker: true,
  workerOptions: { enableBatching: true, batchWindow: 50 }
});

// Process items in batches
const items = [...Array(100)];
const results = await Promise.all(
  items.map(item => engine.dispatchAsync('process:item', item))
);
```

### Error Handling

```javascript
const engine = new Engine({
  useWorker: true,
  workerOptions: { timeout: 5000 }
});

try {
  const result = await engine.dispatchAsync('risky:operation');
  console.log('Success:', result);
} catch (error) {
  if (error.message.includes('timeout')) {
    console.error('Operation timed out');
  } else if (error.message.includes('Worker')) {
    console.error('Worker error:', error);
    // Falls back to sync execution automatically
  } else {
    console.error('Action failed:', error);
  }
}
```

### Graceful Fallback

Worker mode includes automatic fallback to sync execution:

```javascript
const engine = new Engine({ useWorker: true });

// If worker fails to initialize:
// 1. Logs error
// 2. Falls back to direct WASM execution
// 3. Engine continues to work

await engine.dispatchAsync('stack:shuffle');
// Works even if worker failed!
```

### Custom Timeout Handling

```javascript
const engine = new Engine({
  useWorker: true,
  workerOptions: { timeout: 30000 }
});

// Override timeout for specific action
const controller = new AbortController();
setTimeout(() => controller.abort(), 1000);

try {
  await Promise.race([
    engine.dispatchAsync('long:operation'),
    new Promise((_, reject) =>
      controller.signal.addEventListener('abort', () =>
        reject(new Error('Custom timeout'))
      )
    )
  ]);
} catch (error) {
  console.error('Operation aborted:', error);
}
```

---

## Troubleshooting

### Worker Fails to Initialize

**Symptom:** Warning message "Engine: WasmWorker initialization failed"

**Causes:**
- Missing WASM files in `core-rs/pkg/nodejs/`
- Incorrect file paths
- Node.js version <12 (Worker Threads not available)

**Solution:**
```bash
# Rebuild WASM modules
cd core-rs
./build.sh

# Or use npm script
npm run build:rust
```

### "No pending request for response" Warnings

**Symptom:** Console shows "No pending request for response: [id]"

**Cause:** Worker shutting down while requests pending

**Solution:**
```javascript
// Always await shutdown
await engine.shutdown();

// Don't dispatch after shutdown
try {
  await engine.dispatchAsync('action');
} catch (error) {
  // Handle gracefully
}
```

### High Memory Usage

**Symptom:** Memory usage increases over time

**Cause:** Worker threads not being terminated

**Solution:**
```javascript
// Always shutdown when done
process.on('SIGINT', async () => {
  await engine.shutdown();
  process.exit(0);
});

// Or use try-finally
try {
  await engine.dispatchAsync('action');
} finally {
  await engine.shutdown();
}
```

### Slow Performance

**Symptom:** Worker mode slower than sync mode

**Causes:**
1. Operations too fast (<10ms)
2. No batching enabled for rapid actions
3. Excessive parallelization

**Solutions:**
```javascript
// 1. Disable worker for fast operations
const engine = new Engine({ useWorker: false });

// 2. Enable batching
const engine = new Engine({
  useWorker: true,
  workerOptions: { enableBatching: true }
});

// 3. Limit concurrent operations
const limit = 5;
const chunks = chunk(actions, limit);
for (const chunk of chunks) {
  await Promise.all(chunk.map(a => engine.dispatchAsync(a)));
}
```

---

## Browser Support

### Status: ✅ Available

Browser support via Web Workers is now fully implemented! The same `useWorker: true` API works in both Node.js and browsers.

### Quick Start (Browser)

```javascript
import { Engine } from './engine/Engine.js';

const engine = new Engine({
  useWorker: true,
  workerOptions: {
    workerPath: '/workers/hypertoken.worker.js',
    wasmPath: '/wasm/'
  }
});

// Wait for worker initialization
await new Promise(resolve => setTimeout(resolve, 500));

// Use the same API as Node.js
await engine.dispatch('stack:shuffle', { seed: 42 });
const cards = await engine.dispatch('stack:draw', { count: 5 });

// Cleanup
await engine.shutdown();
```

### Browser-Specific Options

```typescript
interface WorkerOptions {
  // Common options (both Node.js and Browser)
  debug?: boolean;        // Enable debug logging
  timeout?: number;       // Request timeout in ms (default: 30000)
  enableBatching?: boolean; // Batch rapid actions
  batchWindow?: number;   // Batching window in ms

  // Browser-specific options
  workerPath?: string;    // Path to worker script (default: '/workers/hypertoken.worker.js')
  wasmPath?: string;      // Path to WASM files (default: '/wasm/')
}
```

### Server Requirements

For the browser demo to work, your server must:

1. **Serve WASM with correct MIME type**:
   ```
   Content-Type: application/wasm
   ```

2. **Support ES Modules in Workers** (modern browsers required)

3. **Optional: Enable SharedArrayBuffer** for maximum performance:
   ```
   Cross-Origin-Opener-Policy: same-origin
   Cross-Origin-Embedder-Policy: require-corp
   ```

### File Structure

```
your-app/
├── workers/
│   └── hypertoken.worker.js  # Copy from hypertoken/workers/
├── wasm/                      # Copy from hypertoken/core-rs/pkg/web/
│   ├── hypertoken_core.js
│   ├── hypertoken_core_bg.wasm
│   └── ...
└── your-app.js
```

### Architecture

The browser implementation uses three key components:

1. **UniversalWorker** (`core/UniversalWorker.ts`)
   - Auto-detects Node.js vs Browser environment
   - Instantiates appropriate worker implementation
   - Provides unified API

2. **WebWorker** (`core/WebWorker.ts`)
   - Browser Web Worker manager
   - Same API as Node.js `WasmWorker`
   - Uses `Worker` constructor with `{ type: 'module' }`

3. **Worker Script** (`workers/hypertoken.worker.js`)
   - Runs in Web Worker context
   - Loads WASM from web build
   - Processes action requests

### Environment Detection

The `UniversalWorker` automatically detects the environment:

```javascript
// Check environment programmatically
import { UniversalWorker, getEnvironment, supportsWorkers } from './core/UniversalWorker.js';

console.log(getEnvironment());    // 'node' or 'browser'
console.log(supportsWorkers());   // true/false

// UniversalWorker handles this automatically
const worker = new UniversalWorker({ debug: true });
await worker.init();
console.log(worker.environment);  // 'node' or 'browser'
```

### Browser Demo

A complete browser demo is available at `examples/browser-demo/`:

```bash
# Build WASM for web
npm run build:rust

# Serve the project
npx serve .

# Open http://localhost:3000/examples/browser-demo/
```

### Browser Compatibility

| Browser | Minimum Version | Notes |
|---------|-----------------|-------|
| Chrome | 80+ | Full support |
| Firefox | 79+ | Full support |
| Safari | 15+ | Full support |
| Edge | 80+ | Full support |

Requirements:
- ES Modules support
- Web Workers with module support
- WebAssembly support

---

## Best Practices

### 1. Always Shutdown

```javascript
// Good
const engine = new Engine({ useWorker: true });
try {
  await engine.dispatchAsync('action');
} finally {
  await engine.shutdown();
}

// Bad
const engine = new Engine({ useWorker: true });
await engine.dispatchAsync('action');
// Worker keeps running!
```

### 2. Use Batching for Rapid Actions

```javascript
// Good - batching enabled
const engine = new Engine({
  useWorker: true,
  workerOptions: { enableBatching: true }
});

for (let i = 0; i < 100; i++) {
  await engine.dispatchAsync('stack:draw', { count: 1 });
}

// Bad - no batching
const engine = new Engine({ useWorker: true });
for (let i = 0; i < 100; i++) {
  await engine.dispatchAsync('stack:draw', { count: 1 });
}
```

### 3. Handle Errors Gracefully

```javascript
// Good
try {
  await engine.dispatchAsync('action');
} catch (error) {
  console.error('Action failed:', error);
  // Continue execution
}

// Bad
await engine.dispatchAsync('action');
// Unhandled promise rejection!
```

### 4. Choose Right API for Use Case

```javascript
// Good - async for heavy operations
await engine.dispatchAsync('stack:shuffle');

// Good - sync for quick reads
const top = engine.dispatch('stack:peek', { count: 1 });

// Bad - sync for heavy operations
engine.dispatch('heavy:operation'); // Blocks!
```

### 5. Monitor Worker Health

```javascript
const engine = new Engine({
  useWorker: true,
  workerOptions: { debug: true }
});

engine.on('engine:error', ({ payload }) => {
  console.error('Worker error:', payload.error);
  // Maybe restart worker or switch to sync mode
});
```

---

## Performance Tuning

### Optimize for Throughput

```javascript
const engine = new Engine({
  useWorker: true,
  workerOptions: {
    enableBatching: true,
    batchWindow: 50,  // Larger window = more batching
    timeout: 60000    // Higher timeout for batch processing
  }
});
```

### Optimize for Latency

```javascript
const engine = new Engine({
  useWorker: true,
  workerOptions: {
    enableBatching: false,  // No batching delay
    timeout: 1000           // Fast timeout
  }
});
```

### Optimize for Concurrency

```javascript
// Multiple workers (advanced)
const workers = [...Array(4)].map(() =>
  new Engine({ useWorker: true })
);

// Round-robin dispatch
let current = 0;
async function dispatch(action, payload) {
  const worker = workers[current];
  current = (current + 1) % workers.length;
  return worker.dispatchAsync(action, payload);
}
```

---

## See Also

- [WASM Integration](../core-rs/README.md) - Rust/WASM architecture
- [Engine API](../engine/README.md) - Core engine documentation
- [Benchmarks](../test/benchmark-worker-overhead.ts) - Performance tests
