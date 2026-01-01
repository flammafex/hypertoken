# Testing Guide

This guide explains how to run tests and write new ones for HyperToken.

## Quick Start

```bash
# Fast verification (~10 seconds)
npm run test:quick

# Full test suite (~2 minutes)
npm run test
```

## Test Commands Reference

### By Speed

| Command | Time | What it tests |
|---------|------|---------------|
| `npm run test:quick` | ~10s | Core + Engine basics |
| `npm run test:unit` | ~30s | All unit tests |
| `npm run test` | ~2min | Everything |

### By Category

#### Core Tests
```bash
npm run test:core          # Token, Stack, Space, Chronicle
npm run test:crypto        # Cryptographic utilities
npm run test:random        # Random number generation
```

#### Engine Tests
```bash
npm run test:engine        # Engine dispatch, actions
npm run test:recorder      # Action recording/replay
npm run test:script        # Script execution
npm run test:agent         # Agent system
npm run test:policy        # Policy evaluation
```

#### Action Tests
```bash
npm run test:token         # Token operations (transform, attach, merge)
npm run test:batch         # Batch operations
npm run test:player-transfers  # Agent resource transfers
```

#### Network Tests
```bash
npm run test:sync          # CRDT synchronization
npm run test:rule-sync     # Rule engine sync
npm run test:network       # All network tests
```

#### WASM Tests
```bash
npm run test:wasm          # WASM bridge
npm run test:wasm:stack    # StackWasm
npm run test:wasm:space    # SpaceWasm
npm run test:rust          # Rust unit tests (requires Rust)
```

#### Plugin Tests
```bash
npm run test:plugins       # Plugin system
npm run test:plugin-loader # Plugin loading
npm run test:plugins-all   # All plugin tests
```

#### Integration
```bash
npm run test:integration   # End-to-end tests
npm run test:pd            # Prisoner's Dilemma example
```

### Composite Commands

```bash
npm run test:unit              # core + engine + exporters + token + batch + transfers
npm run test:engine-components # recorder + script + agent + policy
npm run test:core-components   # crypto + random
```

## Running Individual Tests

Tests use a custom TypeScript loader for ESM support:

```bash
# Run a specific test file
node --loader ./test/ts-esm-loader.js test/testCore.js

# Run with Node directly (JavaScript files)
node test/testCore.js
```

## Writing Tests

### Basic Structure

```javascript
// test/testMyFeature.js

import { Engine } from '../engine/Engine.js';
import { Stack } from '../core/Stack.js';
import { Chronicle } from '../core/Chronicle.js';

// Test helpers
let passed = 0;
let failed = 0;

function test(name, fn) {
  try {
    fn();
    passed++;
    console.log(`✓ ${name}`);
  } catch (err) {
    failed++;
    console.error(`✗ ${name}`);
    console.error(`  ${err.message}`);
  }
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

// Tests
test('Stack shuffles cards', () => {
  const session = new Chronicle();
  const cards = [{ id: 'a' }, { id: 'b' }, { id: 'c' }];
  const stack = new Stack(session, cards);

  stack.shuffle(42);  // Seeded for reproducibility

  assert(stack.size === 3, 'Should have 3 cards');
});

test('Engine dispatches actions', async () => {
  const session = new Chronicle();
  const stack = new Stack(session, [{ id: 'card1' }]);
  const engine = new Engine({ stack });

  const card = await engine.dispatch('stack:draw');

  assert(card.id === 'card1', 'Should draw correct card');
});

// Summary
console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
```

### Testing Async Code

```javascript
async function runTests() {
  await test('async operation', async () => {
    const result = await engine.dispatch('stack:shuffle');
    assert(result === undefined, 'Shuffle returns undefined');
  });
}

runTests().catch(console.error);
```

### Testing Events

```javascript
test('emits events on draw', () => {
  const session = new Chronicle();
  const stack = new Stack(session, [{ id: 'a' }]);

  let emitted = false;
  stack.on('draw', () => { emitted = true; });

  stack.draw();

  assert(emitted, 'Should emit draw event');
});
```

### Testing CRDT State

```javascript
test('CRDT state updates correctly', () => {
  const session = new Chronicle();
  const stack = new Stack(session, [{ id: 'a' }, { id: 'b' }]);

  stack.draw();

  assert(session.state.stack.stack.length === 1, 'Stack should have 1 card');
  assert(session.state.stack.drawn.length === 1, 'Drawn should have 1 card');
});
```

### Testing with Seeds

Use seeds for reproducible random behavior:

```javascript
test('shuffle is reproducible with seed', () => {
  const session1 = new Chronicle();
  const session2 = new Chronicle();
  const cards = [{ id: 'a' }, { id: 'b' }, { id: 'c' }];

  const stack1 = new Stack(session1, cards);
  const stack2 = new Stack(session2, cards);

  stack1.shuffle(12345);
  stack2.shuffle(12345);

  const order1 = stack1.tokens.map(t => t.id).join(',');
  const order2 = stack2.tokens.map(t => t.id).join(',');

  assert(order1 === order2, 'Same seed should produce same order');
});
```

## Benchmarks

```bash
npm run benchmark              # Performance benchmarks
npm run benchmark:memory       # Memory usage
npm run benchmark:chronicle    # CRDT operations
npm run benchmark:all          # All benchmarks
```

## Test File Locations

```
test/
├── testCore.js           # Stack, Space, Token basics
├── testEngine.js         # Engine dispatch
├── testAgent.ts          # Agent system
├── testPolicy.ts         # Policies
├── testSync.ts           # Network sync
├── testWasmBridge.ts     # WASM integration
├── benchmarks.ts         # Performance tests
└── ts-esm-loader.js      # TypeScript ESM loader
```

## CI/CD Expectations

The full test suite (`npm run test`) should:
- Complete in under 3 minutes
- Exit with code 0 on success
- Exit with code 1 on failure
- Print summary of passed/failed tests

## Debugging Tests

```bash
# Run with Node inspector
node --inspect --loader ./test/ts-esm-loader.js test/testCore.js

# Add debug logging
const engine = new Engine({ stack });
engine.debug = true;  // Enables verbose logging
```

## Common Issues

### "Cannot find module"
Ensure you've built the project:
```bash
npm run build
```

### TypeScript Errors
Use the ESM loader:
```bash
node --loader ./test/ts-esm-loader.js test/myTest.ts
```

### WASM Tests Fail
WASM tests require built binaries:
```bash
npm run build:rust
npm run test:wasm
```
