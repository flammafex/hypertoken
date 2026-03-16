# HyperToken Core (Rust/WASM)

**CRDT-based state management for HyperToken, compiled to WebAssembly**

This is the Rust implementation of HyperToken's core logic, compiled to WebAssembly for use in Node.js and browsers.

---

## 🎯 Architecture: "Thin Shell, Heavy Core"

```
┌─────────────────────────────────────────────────┐
│           TypeScript (Thin Shell)               │
│  - API Layer                                    │
│  - Event System                                 │
│  - Network I/O                                  │
│  - UI Bindings                                  │
└─────────────────┬───────────────────────────────┘
                  │ WASM Boundary
┌─────────────────▼───────────────────────────────┐
│           Rust/WASM (Heavy Core)                │
│  - CRDT State (automerge-rs)                    │
│  - Stack/Space Operations                       │
│  - Action Dispatch                              │
│  - Rule Evaluation (future)                     │
└─────────────────────────────────────────────────┘
```

**Why Rust/WASM?**

- **Native CRDT**: Uses automerge-rs for efficient CRDT operations
- **Type safety**: Rust's type system catches errors at compile time
- **Portability**: Runs in both Node.js and browsers
- **Determinism**: Seeded PRNG using ChaCha8 for reproducible shuffles

---

## 📦 Components

### Core Data Structures

- **`Token`**: Universal entity representation
- **`Stack`**: CRDT-backed ordered collection (deck/discard pile)
- **`Space`**: 2D placement with zone management
- **`Chronicle`**: Incremental CRDT document (automerge-rs) — DirtySections tracking, cached ObjIds, 54 field-level action methods via `chronicle_actions/`
- **`chronicle_actions/`**: 8 submodules implementing incremental Automerge operations (helpers, stack, space, source, agent, game_loop, game_state, rules)
- **`ActionDispatcher`**: Unified action routing — delegates to Chronicle's incremental methods

---

## 🛠️ Building

### Prerequisites

```bash
# Install Rust
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh

# Install wasm-pack
curl https://rustwasm.github.io/wasm-pack/installer/init.sh -sSf | sh

# Add WASM target
rustup target add wasm32-unknown-unknown
```

### Build Commands

```bash
# From the root of the HyperToken repo:

# Build all targets (Node.js, Web, Bundler)
npm run build:rust

# Build for development (faster, larger binaries)
npm run build:rust:dev

# Build for production (optimized, smaller binaries)
npm run build:rust:release

# Run Rust tests
npm run test:rust

# Clean build artifacts
npm run clean:rust
```

### Build Outputs

```
core-rs/pkg/
├── nodejs/       # For Node.js (also works with bundlers)
├── web/          # For direct browser use (<script type="module">)
└── bundler/      # For Webpack/Rollup/Parcel
```

---

## 🚀 Usage

### From TypeScript/JavaScript

```typescript
import init, { Stack, Space, Token, ActionDispatcher } from './core-rs/pkg/nodejs/hypertoken_core.js';

// Initialize WASM module
await init();

// Create a stack
const stack = new Stack();

// Create tokens
const tokens = Array.from({ length: 52 }, (_, i) => {
  const token = new Token(`card-${i}`, i);
  return token.toJSON();
});

// Initialize stack with tokens
stack.initializeWithTokens(JSON.stringify(tokens));

// Shuffle (deterministic with seed)
stack.shuffle("my-seed");

// Draw 5 cards
const drawnJson = stack.draw(5);
const drawn = JSON.parse(drawnJson);
console.log(`Drew ${drawn.length} cards`);

// Get state
const stateJson = stack.getState();
const state = JSON.parse(stateJson);
console.log(`Remaining in stack: ${state.stack.length}`);
```

### Using ActionDispatcher (Zero Overhead)

**IMPORTANT**: Use typed methods for zero-overhead dispatch. The old JSON-based `dispatch()` method is deprecated.

```typescript
import init, { ActionDispatcher, Stack, Space } from './core-rs/pkg/nodejs/hypertoken_core.js';

await init();

// Create dispatcher
const dispatcher = new ActionDispatcher();

// Set up components
const stack = new Stack();
const space = new Space();
dispatcher.setStack(stack);
dispatcher.setSpace(space);

// ✅ RECOMMENDED: Use typed methods (zero overhead)
const drawnJson = dispatcher.stackDraw(5);  // Direct WASM call
const drawn = JSON.parse(drawnJson);
console.log(`Drew ${drawn.length} cards`);

// Shuffle with seed
dispatcher.stackShuffle("my-seed");

// Place token in space
const token = { id: "token-1", index: 0, char: "□", group: "test" };
dispatcher.spacePlace("zone1", JSON.stringify(token));

// ❌ DEPRECATED: JSON-based dispatch (19% overhead - avoid!)
// const result = dispatcher.dispatch(JSON.stringify({
//   type: "stack:draw",
//   count: 5
// }));
```

**Performance**: Typed methods have zero overhead compared to direct StackWasm/SpaceWasm calls.
- ActionDispatcher route: 0.50ms (100 shuffles)
- Direct StackWasm call: 0.59ms (100 shuffles)
- **Overhead: -14.4% (actually FASTER!)**

---

## 🔬 Testing

```bash
# Run Rust unit tests
cd core-rs
cargo test

# Run Rust tests with output
cargo test -- --nocapture

# Run specific test
cargo test test_stack_shuffle

# Run benchmarks (future)
cargo bench
```

---

## 📊 Performance Benchmarking

To compare Rust/WASM vs TypeScript performance:

```bash
# Run TypeScript benchmarks (baseline)
npm run benchmark:all

# Build Rust/WASM
npm run build:rust:release

# TODO: Create Rust/WASM benchmarks
# These will be added in Phase 2
```

---

## 🔄 Migration Guide

### Phase 1: Foundation (✅ COMPLETE)

- ✅ Rust project structure
- ✅ Token, Stack, Space, Chronicle
- ✅ WASM bindings
- ✅ Build system

### Phase 2: Integration (✅ COMPLETE)

- ✅ TypeScript bridge modules (StackWasm, SpaceWasm, SourceWasm)
- ✅ Chronicle WASM integration
- ✅ Performance benchmarks (13.3x improvement verified)
- ✅ Hybrid architecture (TS shell, Rust core)

### Phase 3: Performance Optimization (✅ COMPLETE)

- ✅ Lazy sync pattern (Chronicle synced only when needed)
- ✅ Direct WASM dispatch for Stack/Space/Source
- ✅ Critical path optimization
- ✅ ActionDispatcher with typed methods (zero overhead achieved)
- ✅ Engine.ts integrated with ActionDispatcher (19% regression eliminated)

### Phase 4: Multi-threading (✅ COMPLETE - Node.js)

- ✅ Worker Thread integration (Node.js)
- ✅ Async action dispatch (dispatchAsync)
- ✅ Non-blocking execution
- ✅ Performance benchmarks (<0.2ms overhead)
- 🚧 Web Worker support (browser) - Coming soon

**See:** [Worker Mode Guide](../docs/WORKER_MODE.md) for usage details.

---

## 📁 File Structure

```
core-rs/
├── src/
│   ├── lib.rs              # Main entry point + re-exports
│   ├── token.rs            # Token data structure
│   ├── stack.rs            # Stack operations (10 actions)
│   ├── space.rs            # Space operations (14 actions)
│   ├── source.rs           # Source/deck management (7 actions)
│   ├── agent.rs            # Agent management (16 actions)
│   ├── token_ops.rs        # Token transformations (5 actions)
│   ├── gamestate.rs        # Game lifecycle (7 actions)
│   ├── batch.rs            # Batch operations (8 actions)
│   ├── chronicle.rs        # Incremental CRDT (DirtySections, section exports, cached ObjIds)
│   ├── chronicle_actions/  # Incremental Automerge action methods (54 total)
│   │   ├── mod.rs          # Module declarations
│   │   ├── helpers.rs      # Transaction helpers (resolve/ensure section IDs)
│   │   ├── stack.rs        # 10 stack actions (draw, shuffle, burn, etc.)
│   │   ├── space.rs        # 11 space actions (place, move, flip, etc.)
│   │   ├── source.rs       # 7 source actions (draw, reshuffle, etc.)
│   │   ├── agent.rs        # 14 agent actions (create, give_resource, etc.)
│   │   ├── game_loop.rs    # 5 game loop actions (start, stop, next_turn, etc.)
│   │   ├── game_state.rs   # 6 game state actions (start, end, set_property, etc.)
│   │   └── rules.rs        # 1 rules action (mark_fired)
│   ├── actions.rs          # ActionDispatcher (delegates to Chronicle methods)
│   ├── parallel.rs         # Parallel algorithms
│   ├── types.rs            # Shared types (HyperTokenState, DirtySections)
│   └── utils.rs            # Utility functions
├── Cargo.toml              # Dependencies
├── build.sh                # Build script for all targets
└── README.md               # This file
```

---

## 🐛 Debugging

### Enable console logging

```rust
// In Rust code
#[cfg(target_arch = "wasm32")]
web_sys::console::log_1(&"Debug message".into());
```

### Browser DevTools

1. Build with debug symbols: `npm run build:rust:dev`
2. Open browser DevTools
3. Errors will show Rust stack traces

### Node.js

```bash
# Run with WASM debugging
NODE_OPTIONS='--inspect' node your-script.js
```

---

## 🤝 Contributing

When adding new features to the Rust core:

1. **Add to appropriate module** (token.rs, stack.rs, space.rs)
2. **Add WASM bindings** with `#[wasm_bindgen]`
3. **Add tests** in the same file under `#[cfg(test)]`
4. **Update TypeScript bridge** to expose new functionality
5. **Run tests**: `npm run test:rust`

---

## 📚 Resources

- [Rust Book](https://doc.rust-lang.org/book/)
- [wasm-bindgen Guide](https://rustwasm.github.io/wasm-bindgen/)
- [automerge-rs Docs](https://docs.rs/automerge/)
- [WebAssembly MDN](https://developer.mozilla.org/en-US/docs/WebAssembly)

---

## 🚦 Status

| Component | Actions | Status |
|-----------|---------|--------|
| **Core Modules** |
| Token | - | ✅ Complete |
| Stack | 10 | ✅ Complete |
| Space | 14 | ✅ Complete |
| Source | 7 | ✅ Complete |
| Chronicle | 54 incremental | ✅ Complete (DirtySections, field-level ops) |
| **Action Modules** |
| Agent | 16 | ✅ Complete |
| TokenOps | 5 | ✅ Complete |
| GameState | 7 | ✅ Complete |
| Batch | 8 | ✅ Complete |
| **Chronicle Action Modules** |
| chronicle_actions/stack | 10 | ✅ Complete |
| chronicle_actions/space | 11 | ✅ Complete |
| chronicle_actions/source | 7 | ✅ Complete |
| chronicle_actions/agent | 14 | ✅ Complete |
| chronicle_actions/game_loop | 5 | ✅ Complete |
| chronicle_actions/game_state | 6 | ✅ Complete |
| chronicle_actions/rules | 1 | ✅ Complete |
| **Integration** |
| ActionDispatcher | 67 | ✅ Complete (delegates to Chronicle) |
| Engine.ts Wiring | 76+ | ✅ Complete (dual-path dispatch) |
| IChronicle + WasmChronicleAdapter | - | ✅ Complete |
| Worker Mode (Node.js) | - | ✅ Complete |
| **Future** |
| Worker Mode (Browser) | - | 🚧 Coming soon |
| RuleEngine | - | 🚧 Future |

---

## 📄 License

Apache License 2.0 - See LICENSE file in root directory

---

## 🎯 Migration Complete

Core actions have been ported to Rust/WASM.

**What's Next:**

- 🚧 **Web Worker support** - Enable multi-threading in browsers
- 🚧 **Performance profiling** - Identify bottlenecks and optimization opportunities
- 🚧 **Browser optimizations** - Streaming and caching for web deployments

**Want to contribute?**

See the main [README](../README.md) for how to get started!
