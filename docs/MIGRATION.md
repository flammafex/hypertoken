# Migration Guide: Upgrading to Worker Mode

This guide helps you migrate existing HyperToken applications to use the new Worker Mode for improved performance and responsiveness.

## Table of Contents

- [Overview](#overview)
- [Breaking Changes](#breaking-changes)
- [Migration Steps](#migration-steps)
- [Common Patterns](#common-patterns)
- [Incremental Adoption](#incremental-adoption)
- [Testing](#testing)
- [Rollback](#rollback)

---

## Overview

**Worker Mode** is a new performance optimization introduced in HyperToken that enables multi-threaded execution using Node.js Worker Threads. It's **fully backwards compatible** - your existing code will continue to work without changes.

### What's New?

- ✅ New `useWorker` option in Engine constructor
- ✅ New `dispatchAsync()` method for async dispatch
- ✅ New `shutdown()` method for cleanup
- ✅ New worker configuration options
- ✅ Existing `dispatch()` still works (with fallback warning in worker mode)

### Compatibility

| Feature | Before | After | Status |
|---------|--------|-------|--------|
| `Engine` constructor | ✅ | ✅ | Compatible |
| `dispatch()` method | ✅ | ✅ | Compatible (with warning) |
| `dispatchAsync()` method | ❌ | ✅ | New |
| WASM acceleration | ✅ | ✅ | Enhanced |
| Browser support | ✅ | ⏳ | Coming soon |

---

## Breaking Changes

### None! 🎉

Worker Mode is **100% backwards compatible**. Your existing code will continue to work without modifications.

However, to take full advantage of worker mode, you should:
1. Switch from `dispatch()` to `dispatchAsync()`
2. Add `await` to action dispatches
3. Call `shutdown()` when done

---

## Migration Steps

### Step 1: Update Engine Initialization

**Before:**
```javascript
import { Engine } from './engine/Engine.js';

const engine = new Engine({
  stack: myStack,
  space: mySpace,
  source: mySource
});
```

**After:**
```javascript
import { Engine } from './engine/Engine.js';

const engine = new Engine({
  stack: myStack,
  space: mySpace,
  source: mySource,
  useWorker: true  // Enable worker mode
});
```

### Step 2: Update Action Dispatch

**Before:**
```javascript
// Synchronous dispatch
const result = engine.dispatch('stack:shuffle', { seed: 42 });
console.log('Result:', result);
```

**After:**
```javascript
// Asynchronous dispatch
const result = await engine.dispatchAsync('stack:shuffle', { seed: 42 });
console.log('Result:', result);
```

### Step 3: Add Cleanup

**Before:**
```javascript
// No cleanup needed
engine.dispatch('stack:shuffle');
// Process exits, engine garbage collected
```

**After:**
```javascript
// Graceful shutdown required
await engine.dispatchAsync('stack:shuffle');
await engine.shutdown();  // Terminate worker thread
```

### Step 4: Update Error Handling

**Before:**
```javascript
try {
  const result = engine.dispatch('stack:shuffle');
} catch (error) {
  console.error('Action failed:', error);
}
```

**After:**
```javascript
try {
  const result = await engine.dispatchAsync('stack:shuffle');
} catch (error) {
  console.error('Action failed:', error);
}
```

---

## Common Patterns

### Pattern 1: Simple Game Loop

**Before:**
```javascript
function gameLoop() {
  engine.dispatch('game:tick');
  engine.dispatch('ai:process');
  engine.dispatch('render:update');

  setTimeout(gameLoop, 16);  // 60 FPS
}

gameLoop();
```

**After:**
```javascript
async function gameLoop() {
  await engine.dispatchAsync('game:tick');
  await engine.dispatchAsync('ai:process');
  await engine.dispatchAsync('render:update');

  setTimeout(gameLoop, 16);  // 60 FPS
}

gameLoop();

// Cleanup on exit
process.on('SIGINT', async () => {
  await engine.shutdown();
  process.exit(0);
});
```

### Pattern 2: Event Handlers

**Before:**
```javascript
button.addEventListener('click', () => {
  engine.dispatch('stack:shuffle');
  updateUI();
});
```

**After:**
```javascript
button.addEventListener('click', async () => {
  await engine.dispatchAsync('stack:shuffle');
  updateUI();
});
```

### Pattern 3: Multiple Actions

**Before:**
```javascript
function dealCards() {
  engine.dispatch('stack:shuffle');
  engine.dispatch('stack:draw', { count: 5 });
  engine.dispatch('agent:receive', { cards: drawn });
}
```

**After (Sequential):**
```javascript
async function dealCards() {
  await engine.dispatchAsync('stack:shuffle');
  await engine.dispatchAsync('stack:draw', { count: 5 });
  await engine.dispatchAsync('agent:receive', { cards: drawn });
}
```

**After (Parallel - Better!):**
```javascript
async function dealCards() {
  await engine.dispatchAsync('stack:shuffle');

  // These can run in parallel
  const [drawn, _] = await Promise.all([
    engine.dispatchAsync('stack:draw', { count: 5 }),
    engine.dispatchAsync('agent:prepare')
  ]);

  await engine.dispatchAsync('agent:receive', { cards: drawn });
}
```

### Pattern 4: Server Initialization

**Before:**
```javascript
const express = require('express');
const app = express();

const engine = new Engine();

app.post('/action', (req, res) => {
  const result = engine.dispatch(req.body.type, req.body.payload);
  res.json({ result });
});

app.listen(3000);
```

**After:**
```javascript
const express = require('express');
const app = express();

const engine = new Engine({ useWorker: true });

app.post('/action', async (req, res) => {
  try {
    const result = await engine.dispatchAsync(req.body.type, req.body.payload);
    res.json({ result });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

const server = app.listen(3000);

// Graceful shutdown
process.on('SIGTERM', async () => {
  server.close();
  await engine.shutdown();
  process.exit(0);
});
```

### Pattern 5: Test Suites

**Before:**
```javascript
describe('Stack operations', () => {
  it('should shuffle', () => {
    const result = engine.dispatch('stack:shuffle');
    expect(result).toBeDefined();
  });
});
```

**After:**
```javascript
describe('Stack operations', () => {
  let engine;

  beforeEach(() => {
    engine = new Engine({ useWorker: true });
  });

  afterEach(async () => {
    await engine.shutdown();
  });

  it('should shuffle', async () => {
    const result = await engine.dispatchAsync('stack:shuffle');
    expect(result).toBeDefined();
  });
});
```

---

## Incremental Adoption

You don't have to migrate everything at once. Worker mode can coexist with sync mode:

### Strategy 1: New Code Only

```javascript
// Old code - keep using sync dispatch
function legacyFunction() {
  engine.dispatch('old:action');
}

// New code - use async dispatch
async function newFunction() {
  await engine.dispatchAsync('new:action');
}
```

### Strategy 2: Per-Engine Basis

```javascript
// Legacy engine - no worker
const legacyEngine = new Engine({
  useWorker: false
});

// New engine - with worker
const modernEngine = new Engine({
  useWorker: true
});

// Use appropriate engine
legacyEngine.dispatch('old:action');
await modernEngine.dispatchAsync('new:action');
```

### Strategy 3: Gradual Migration

```javascript
// Week 1: Enable worker mode
const engine = new Engine({ useWorker: true });

// Week 2: Convert critical paths
async function criticalPath() {
  await engine.dispatchAsync('important:action');
}

// Week 3: Convert remaining code
async function remainingCode() {
  await engine.dispatchAsync('other:action');
}

// Week 4: Add cleanup
process.on('SIGINT', async () => {
  await engine.shutdown();
});
```

---

## Testing

### Unit Tests

**Update test setup:**

```javascript
// Before
beforeEach(() => {
  engine = new Engine();
});

// After
beforeEach(() => {
  engine = new Engine({ useWorker: true });
});

afterEach(async () => {
  await engine.shutdown();
});
```

**Update assertions:**

```javascript
// Before
it('should shuffle', () => {
  const result = engine.dispatch('stack:shuffle');
  expect(result).toBeDefined();
});

// After
it('should shuffle', async () => {
  const result = await engine.dispatchAsync('stack:shuffle');
  expect(result).toBeDefined();
});
```

### Integration Tests

**Test worker initialization:**

```javascript
it('should initialize worker', async () => {
  const engine = new Engine({ useWorker: true });

  // Wait for worker to be ready
  await new Promise(resolve => setTimeout(resolve, 500));

  const result = await engine.dispatchAsync('stack:shuffle');
  expect(result).toBeDefined();

  await engine.shutdown();
});
```

**Test error handling:**

```javascript
it('should handle worker errors', async () => {
  const engine = new Engine({
    useWorker: true,
    workerOptions: { timeout: 100 }
  });

  await expect(
    engine.dispatchAsync('slow:operation')
  ).rejects.toThrow('timeout');

  await engine.shutdown();
});
```

### Performance Tests

**Compare sync vs async:**

```javascript
it('should be faster with worker mode', async () => {
  const syncEngine = new Engine({ useWorker: false });
  const asyncEngine = new Engine({ useWorker: true });

  // Warmup
  syncEngine.dispatch('stack:shuffle');
  await asyncEngine.dispatchAsync('stack:shuffle');

  // Measure sync
  const syncStart = Date.now();
  for (let i = 0; i < 100; i++) {
    syncEngine.dispatch('stack:shuffle');
  }
  const syncTime = Date.now() - syncStart;

  // Measure async
  const asyncStart = Date.now();
  await Promise.all(
    [...Array(100)].map(() =>
      asyncEngine.dispatchAsync('stack:shuffle')
    )
  );
  const asyncTime = Date.now() - asyncStart;

  console.log(`Sync: ${syncTime}ms, Async: ${asyncTime}ms`);

  await asyncEngine.shutdown();
});
```

---

## Rollback

If you need to rollback, it's simple:

### Option 1: Disable Worker Mode

```javascript
// Change this:
const engine = new Engine({ useWorker: true });

// To this:
const engine = new Engine({ useWorker: false });

// Or just:
const engine = new Engine();
```

### Option 2: Revert to Sync Dispatch

```javascript
// Keep async code but use sync execution
const engine = new Engine({ useWorker: false });

// dispatchAsync still works, just executes synchronously
await engine.dispatchAsync('stack:shuffle');
```

### Option 3: Remove Async/Await

```javascript
// Revert async functions to sync
// Before:
async function shuffle() {
  await engine.dispatchAsync('stack:shuffle');
}

// After:
function shuffle() {
  engine.dispatch('stack:shuffle');
}
```

---

## Troubleshooting Migration

### Issue: "Cannot use await in non-async function"

**Error:**
```
SyntaxError: await is only valid in async functions
```

**Solution:**
```javascript
// Wrong
function myFunction() {
  await engine.dispatchAsync('action');  // Error!
}

// Right
async function myFunction() {
  await engine.dispatchAsync('action');  // ✓
}
```

### Issue: "Worker not shutting down"

**Symptom:** Node.js process doesn't exit

**Solution:**
```javascript
// Add shutdown handler
process.on('SIGINT', async () => {
  await engine.shutdown();
  process.exit(0);
});

// Or explicit shutdown
await engine.shutdown();
```

### Issue: "Performance worse with worker mode"

**Symptom:** Slower execution than sync mode

**Cause:** Operations too fast to benefit from workers

**Solution:**
```javascript
// Option 1: Disable worker for fast operations
const engine = new Engine({ useWorker: false });

// Option 2: Enable batching
const engine = new Engine({
  useWorker: true,
  workerOptions: { enableBatching: true }
});

// Option 3: Use selectively
if (operation.estimatedTime > 10) {
  await engine.dispatchAsync(action);
} else {
  engine.dispatch(action);
}
```

### Issue: "Tests timing out"

**Symptom:** Tests fail with timeout errors

**Cause:** Missing `await` or shutdown

**Solution:**
```javascript
// Add timeout
it('should work', async () => {
  await engine.dispatchAsync('action');
}, 10000);  // 10s timeout

// Or cleanup
afterEach(async () => {
  await engine.shutdown();
});
```

---

## Checklist

Use this checklist to ensure complete migration:

### Code Changes
- [ ] Add `useWorker: true` to Engine constructor
- [ ] Replace `dispatch()` with `dispatchAsync()`
- [ ] Add `await` to all `dispatchAsync()` calls
- [ ] Convert functions to `async`
- [ ] Add `shutdown()` calls
- [ ] Update error handling for async

### Testing
- [ ] Update unit tests with `async/await`
- [ ] Add `afterEach` cleanup
- [ ] Test worker initialization
- [ ] Test error handling
- [ ] Run performance benchmarks

### Deployment
- [ ] Update Node.js version (>= 12)
- [ ] Rebuild WASM modules
- [ ] Test in staging environment
- [ ] Monitor performance metrics
- [ ] Plan rollback strategy

### Documentation
- [ ] Update API documentation
- [ ] Document new worker options
- [ ] Add examples
- [ ] Update README

---

## Getting Help

If you encounter issues during migration:

1. **Check the logs** - Enable debug mode:
   ```javascript
   const engine = new Engine({
     useWorker: true,
     workerOptions: { debug: true }
   });
   ```

2. **Review examples** - See working code in:
   - `test/test-engine-worker.ts`
   - `test/test-wasm-worker.ts`
   - `test/benchmark-worker-overhead.ts`

3. **File an issue** - Include:
   - Error message
   - Code snippet
   - Node.js version
   - Expected vs actual behavior

4. **See also:**
   - [Worker Mode Guide](./WORKER_MODE.md)
   - [WASM Integration](../core-rs/README.md)
   - [Engine API](../engine/README.md)

---

## Summary

Worker Mode migration is straightforward:

1. ✅ **Backwards compatible** - No breaking changes
2. ✅ **Incremental** - Migrate at your own pace
3. ✅ **Performance** - <0.2ms overhead, non-blocking execution
4. ✅ **Fallback** - Automatic degradation if worker fails
5. ✅ **Simple rollback** - Just disable `useWorker`

**Minimal migration:**
```javascript
// Before
const engine = new Engine();
engine.dispatch('action');

// After
const engine = new Engine({ useWorker: true });
await engine.dispatchAsync('action');
await engine.shutdown();
```

Happy migrating! 🚀
