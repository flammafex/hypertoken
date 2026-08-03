# WASM Integration Guide

**Status:** Incremental Chronicle CRDT Integration Complete 🚀

This document describes the integration of Rust/WASM performance optimizations into HyperToken.

---

## 🎯 Overview

HyperToken's performance-critical operations are implemented in Rust and compiled to WebAssembly for **significant performance improvements** (~20x for Stack/Space operations). The Rust Chronicle now provides **incremental field-level Automerge operations** via 54 action methods, with dirty-section tracking to minimize WASM↔JS boundary crossings.

### Current Status

| Component | Rust Implementation | TypeScript Integration | Status |
|-----------|---------------------|----------------------|--------|
| **Chronicle** | ✅ Complete (54 incremental actions) | ✅ `WasmChronicleAdapter` + `IChronicle` | **READY** - Field-level CRDT ops with dirty-section caching |
| **Actions** | ✅ Complete | ✅ Dual-path dispatch in Engine | **READY** - WASM or TS fallback per action |
| **WasmBridge** | ✅ Complete | ✅ Complete | Module loader working |

The engine uses `WasmChronicleAdapter` → `ActionDispatcher` → `chronicle_actions/` for WASM dispatch. There are no per-component WASM wrappers — the previous per-component wrapper classes have been removed in favor of the unified `ActionDispatcher` + `WasmChronicleAdapter` architecture.

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
npm run test:wasm        # WASM module loading + Chronicle incremental CRDT parity
```

This runs integration tests that verify:
- WASM module loads successfully
- `WasmChronicleAdapter` correctly proxies Chronicle operations
- TS/WASM behavioral parity for all 54 incremental action methods
- Dirty-section caching minimizes WASM↔JS boundary crossings

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
│   ├── IChronicle.ts         # ✅ Interface abstracting Chronicle / WasmChronicleAdapter
│   ├── WasmChronicleAdapter.ts # ✅ Dirty-section caching proxy for WASM Chronicle
│   ├── WasmBridge.ts         # ✅ WASM module loader
│   └── WasmManager.ts        # ✅ Creates ActionDispatcher + WasmChronicleAdapter, builds _dispatchTable
│
├── core-rs/
│   ├── src/
│   │   ├── lib.rs            # ✅ Main entry point
│   │   ├── token.rs          # ✅ Token implementation
│   │   ├── stack.rs          # ✅ Stack operations
│   │   ├── space.rs          # ✅ Space operations
│   │   ├── chronicle.rs      # ✅ Incremental CRDT (DirtySections, section exports, 54 action methods)
│   │   ├── chronicle_actions/ # ✅ Action method modules
│   │   │   ├── helpers.rs    #    Transaction helpers (resolve/ensure)
│   │   │   ├── stack.rs      #    10 stack actions
│   │   │   ├── space.rs      #    11 space actions
│   │   │   ├── source.rs     #    7 source actions
│   │   │   ├── agent.rs      #    14 agent actions
│   │   │   ├── game_loop.rs  #    5 game loop actions
│   │   │   ├── game_state.rs #    6 game state actions
│   │   │   └── rules.rs      #    1 rules action
│   │   ├── actions.rs        # ✅ ActionDispatcher (delegates to Chronicle methods)
│   │   ├── types.rs          # ✅ Type definitions (HyperTokenState)
│   │   └── utils.rs          # ✅ Utilities
│   │
│   ├── pkg/                  # Generated WASM output
│   ├── Cargo.toml            # Rust dependencies
│   ├── build.sh              # Build script
│   └── README.md             # Rust docs
│
└── test/
    ├── testWasmBridge.ts          # ✅ WASM module loading tests
    └── testChronicleIncremental.ts # ✅ Chronicle incremental CRDT parity tests
```

---

## 🔌 Using WASM in Your Code

### Option A: Engine with WASM Dispatch (Recommended)

The standard way to use WASM is through the `Engine`, which transparently routes supported actions to the Rust `ActionDispatcher` and falls back to the TS `ActionRegistry` otherwise.

```typescript
import { Engine } from './engine/Engine.js';

// WASM is loaded automatically if available; falls back to TS if not.
const engine = new Engine();

// All dispatch goes through engine.dispatch() — WASM or TS path is chosen per action.
await engine.dispatch('stack:draw', { count: 5 });
await engine.dispatch('space:place', { zone: 'hand', token: card });
```

To force the TypeScript path (e.g. for browser builds that don't ship the WASM binary):

```typescript
const engine = new Engine({ disableWasm: true });
```

### Option B: WasmChronicleAdapter + ActionDispatcher (Low Level)

For direct access to the WASM Chronicle without the Engine, use `WasmManager` to wire up an `ActionDispatcher` and `WasmChronicleAdapter`:

```typescript
import { WasmManager } from './core/WasmManager.js';
import { WasmChronicleAdapter } from './core/WasmChronicleAdapter.js';

// WasmManager loads the WASM module via WasmBridge, instantiates the Rust
// ActionDispatcher, and builds a _dispatchTable mapping action types to
// typed dispatcher methods.
const manager = new WasmManager();
await manager.init();

// The adapter is an IChronicle implementation that caches dirty sections
// and re-exports only changed sections across the WASM↔JS boundary.
const chronicle: IChronicle = new WasmChronicleAdapter(manager);

// Dispatch a typed action — routed through manager._dispatchTable → Rust.
chronicle.applyAction('stack:draw', { count: 5 });
```

**Pros:**
- ✅ Field-level Automerge operations (no full-state replacement)
- ✅ Dirty-section caching minimizes WASM↔JS boundary crossings
- ✅ TS `ActionRegistry` fallback for any action not yet supported in WASM
- ✅ `IChronicle` interface abstracts both backends

---

## 📊 Performance Targets

The Rust Chronicle uses incremental field-level Automerge operations (54 action methods) with dirty-section caching. This avoids full-state replacement on every action.

> **Note on Chronicle Performance:** Performance benchmarks are pending. Run `npm run benchmark:chronicle` to measure incremental action performance (field-level ops vs full-state replacement), dirty-section caching impact on WASM↔JS boundary overhead, and Chronicle CRDT merge performance (Rust vs TS).

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

### Phase 2B: Chronicle Incremental CRDT (✅ COMPLETE)

- ✅ Implement full HyperTokenState in Rust Chronicle (types.rs)
- ✅ **54 incremental action methods** — field-level Automerge operations (no full-state replacement)
- ✅ **DirtySections tracking** — per-section dirty flags minimize WASM↔JS re-exports
- ✅ **`chronicle_actions/`** — 8 submodules (helpers, stack, space, source, agent, game_loop, game_state, rules)
- ✅ **`IChronicle` interface** — abstracts over Chronicle (Automerge) and WasmChronicleAdapter
- ✅ **`WasmChronicleAdapter`** — dirty-section caching proxy, selectively re-exports only changed sections
- ✅ **Dual-path dispatch** — Engine routes to WASM ActionDispatcher or TS ActionRegistry per action
- ✅ **GameLoop/RuleEngine migrated** — use `engine.dispatch()` instead of direct `session.change()`
- ✅ Incremental sync support via automerge SyncState
- ⏳ Performance benchmarks pending (run `npm run benchmark:chronicle`)

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

### Q: How does the dual-path dispatch work?

**A:** `Engine.dispatch()` checks if the action is in the WASM-supported set. If so, it routes to the Rust `ActionDispatcher` which calls incremental Chronicle methods. Otherwise, it falls back to the TS `ActionRegistry` which uses `session.change()`. The `IChronicle` interface lets both paths work transparently. The mutating `agent:*` actions (create, remove, setActive, setMeta, giveResource, takeResource, addToken, removeToken, transferResource, transferToken, stealResource, stealToken, drawCards) are WASM-routed; `agent:trade`, `agent:discardCards`, `agent:get`, and `agent:getAll` stay on the TS fallback (payload/return-shape divergence).

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

Chronicle incremental CRDT integration is complete! ✅ To continue WASM integration:

**Next: Benchmarks**
1. Create comprehensive benchmark suite comparing TS vs WASM Chronicle
2. Measure incremental action performance (field-level ops vs full-state replacement)
3. Measure dirty-section caching impact on WASM↔JS boundary overhead
4. Measure Chronicle CRDT merge performance (Rust vs TS)

**Future: Multi-Threading**
1. Web Worker wrapper for WASM module
2. Async action dispatch
3. Non-blocking CRDT merges
4. Parallel rule evaluation

**To Build WASM Module:**
```bash
# Install wasm-pack (one-time setup)
curl https://rustwasm.github.io/wasm-pack/installer/init.sh -sSf | sh

# Build WASM
npm run build:rust
```

See `core-rs/README.md` for Rust-specific details.

---

**Questions?** Check the main README or create an issue on GitHub.
