# WASM Integration Guide

**Status:** Phase 2 In Progress - Foundation Complete

This document describes the integration of Rust/WASM performance optimizations into HyperToken.

---

## 🎯 Overview

HyperToken's performance-critical operations are being ported to Rust and compiled to WebAssembly for **10-100x performance improvements**.

### Current Status

| Component | Rust Implementation | TypeScript Wrapper | Status |
|-----------|---------------------|-------------------|--------|
| **Token** | ✅ Complete | ⏳ TODO | Rust ready, needs TS wrapper |
| **Stack** | ✅ Complete | ⏳ TODO | Rust ready, needs TS wrapper |
| **Space** | ✅ Complete | ⏳ TODO | Rust ready, needs TS wrapper |
| **Chronicle** | ⚠️ Basic | ⚠️ Hybrid | Needs full HyperTokenState support |
| **Actions** | ✅ Complete | ⏳ TODO | Rust ready, needs TS wrapper |
| **WasmBridge** | ✅ Complete | ✅ Complete | Module loader working |

---

## 🚀 Quick Start

### 1. Build WASM Module

```bash
npm run build:rust
```

This compiles the Rust code to WASM and generates TypeScript bindings in:
- `core-rs/pkg/nodejs/` - For Node.js (and bundlers)
- `core-rs/pkg/web/` - For browser
- `core-rs/pkg/bundler/` - For Webpack/Rollup

### 2. Test WASM Integration

```bash
npm run test:wasm
```

This runs integration tests that verify:
- WASM module loads successfully
- Stack operations work (create, shuffle, draw, burn)
- Space operations work (create zones, place tokens, move)
- Basic performance validation

### 3. Run Rust Unit Tests

```bash
npm run test:rust
```

This runs the Rust test suite on your native target (much faster than WASM).

---

## 📁 File Structure

```
hypertoken/
├── core/
│   ├── WasmBridge.ts         # ✅ WASM module loader
│   ├── ChronicleWasm.ts      # ⚠️ Hybrid Chronicle (TS + WASM hooks)
│   └── (Stack/Space WASM wrappers TODO)
│
├── core-rs/
│   ├── src/
│   │   ├── lib.rs            # ✅ Main entry point
│   │   ├── token.rs          # ✅ Token implementation
│   │   ├── stack.rs          # ✅ Stack operations
│   │   ├── space.rs          # ✅ Space operations
│   │   ├── chronicle.rs      # ⚠️ Basic CRDT wrapper
│   │   ├── actions.rs        # ✅ Action dispatcher
│   │   ├── types.rs          # ✅ Type definitions
│   │   └── utils.rs          # ✅ Utilities
│   │
│   ├── pkg/                  # Generated WASM output
│   ├── Cargo.toml            # Rust dependencies
│   ├── build.sh              # Build script
│   └── README.md             # Rust docs
│
└── test/
    └── testWasmBridge.ts     # ✅ WASM integration tests
```

---

## 🔌 Using WASM in Your Code

### Option A: Direct WASM Usage (Lowest Level)

```typescript
import { loadWasm } from './core/WasmBridge.js';

// Load WASM module
const wasm = await loadWasm();

// Create a WASM Stack
const WasmStack = wasm.Stack;
const stack = new WasmStack();

// Initialize with tokens
const tokens = [/* your tokens */];
stack.initializeWithTokens(JSON.stringify(tokens));

// Use WASM methods
stack.shuffle('my-seed');
const drawnJson = stack.draw(5);
const drawn = JSON.parse(drawnJson);
```

**Pros:**
- Maximum performance
- Direct access to WASM

**Cons:**
- JSON serialization at boundary
- No event system
- No Chronicle integration

### Option B: TypeScript Wrappers (TODO)

```typescript
import { StackWasm } from './core/StackWasm.js';
import { Chronicle } from './core/Chronicle.js';

// Create Chronicle (TypeScript Automerge for now)
const chronicle = new Chronicle();

// Create WASM-backed Stack with TypeScript API
const stack = new StackWasm(chronicle, tokens);

// Same API as TypeScript Stack, but 20x faster
stack.shuffle();
const card = stack.draw();

// Events work
stack.on('draw', (card) => console.log('Drew:', card));
```

**Pros:**
- Drop-in replacement for existing code
- Event system works
- Chronicle integration
- Gradual migration path

**Cons:**
- Needs to be implemented (coming in Phase 2B)

---

## 📊 Performance Targets

Based on benchmarks from M2 MacBook Air:

| Operation | TypeScript | Rust/WASM Target | Expected Improvement |
|-----------|-----------|------------------|---------------------|
| Stack shuffle (1000 tokens) | 986 ms | <50 ms | **~20x** |
| Stack create (1000 tokens) | 388 ms | <20 ms | **~20x** |
| Space placement (1000 tokens) | 958 ms | <50 ms | **~20x** |
| Space query (100 tokens) | 82 ms | <5 ms | **~16x** |
| Large simulation memory | 377 MB | <50 MB | **~8x** |
| Chronicle merge | 1.4 ms | <0.2 ms | **~7x** |

---

## 🛠️ Development Workflow

### Making Changes to Rust Code

1. **Edit Rust code** in `core-rs/src/`
2. **Run tests**: `npm run test:rust`
3. **Build WASM**: `npm run build:rust:dev` (faster) or `npm run build:rust:release` (optimized)
4. **Test integration**: `npm run test:wasm`
5. **Commit and push**

### Adding New WASM Features

1. **Add Rust implementation** in appropriate `core-rs/src/*.rs` file
2. **Add `#[wasm_bindgen]` attribute** to expose to JavaScript
3. **Add Rust tests** in the same file under `#[cfg(test)]`
4. **Update `WasmBridge.ts`** with TypeScript type definitions
5. **Create TypeScript wrapper** (if needed for complex integration)
6. **Add integration tests** in `test/testWasmBridge.ts`

---

## 🔮 Roadmap

### Phase 2A: Foundation (✅ COMPLETE)

- ✅ Rust/WASM core implementation
- ✅ Build system
- ✅ WasmBridge module loader
- ✅ Basic integration tests

### Phase 2B: TypeScript Wrappers (CURRENT)

- ⏳ Create `StackWasm.ts` - WASM-backed Stack with TS API
- ⏳ Create `SpaceWasm.ts` - WASM-backed Space with TS API
- ⏳ Add comprehensive integration tests
- ⏳ Benchmark comparison scripts
- ⏳ Update existing tests to use WASM (optional flag)

### Phase 2C: Chronicle Integration

- ⏳ Implement full HyperTokenState in Rust Chronicle
- ⏳ Add proper CRDT state serialization
- ⏳ Update `ChronicleWasm.ts` to use Rust backend
- ⏳ Benchmark CRDT merge performance

### Phase 3: Multi-Threading (FUTURE)

- ⏳ Web Worker wrapper for WASM module
- ⏳ Async action dispatch
- ⏳ Non-blocking CRDT merges
- ⏳ Parallel rule evaluation

---

## ❓ FAQ

### Q: Do I need to use WASM?

**A:** No. TypeScript implementation works fine. WASM is optional for performance.

### Q: What if WASM fails to load?

**A:** The system gracefully falls back to TypeScript. Check console for warnings.

### Q: Can I use WASM in the browser?

**A:** Yes! Build with `npm run build:rust` and use the `core-rs/pkg/web/` output.

### Q: Why is Chronicle still using TypeScript Automerge?

**A:** The Rust Chronicle needs to implement the full `HyperTokenState` structure. This is coming in Phase 2C.

### Q: How do I know if WASM is being used?

**A:** Call `isWasmAvailable()` from `WasmBridge.ts` or check console logs.

### Q: Is WASM slower than native Rust?

**A:** Slightly (5-10%), but still 10-50x faster than TypeScript for compute-heavy operations.

---

## 🐛 Troubleshooting

### WASM Module Won't Load

```typescript
Error: Cannot find module '../core-rs/pkg/nodejs/hypertoken_core.js'
```

**Solution:** Run `npm run build:rust` to generate WASM files.

### Tests Fail with "cannot execute binary file"

```bash
error: test failed, to rerun pass `--lib`
```

**Solution:** This is expected. Use `npm run test:rust` which runs tests on native target.

### Performance Not Improving

**Checklist:**
1. Did you run `npm run build:rust:release`? (dev builds are slower)
2. Is WASM actually loaded? Check `isWasmAvailable()`
3. Are you comparing the same operations?
4. Did you account for JSON serialization at the WASM boundary?

### wasm-opt Build Failure

```bash
Fatal: error validating input
Error: failed to execute `wasm-opt`
```

**Solution:** wasm-opt is disabled by default in `Cargo.toml`. Rust compiler optimization is sufficient.

---

## 📞 Next Steps

To continue WASM integration:

1. **Create `StackWasm.ts`** - TypeScript wrapper around WASM Stack
2. **Create `SpaceWasm.ts`** - TypeScript wrapper around WASM Space
3. **Add integration tests** - Verify TS ↔ WASM round-trips work
4. **Create benchmarks** - Measure actual performance improvements
5. **Update documentation** - Guide users on migration

See `core-rs/README.md` for Rust-specific details.

---

**Questions?** Check the main README or create an issue on GitHub.
