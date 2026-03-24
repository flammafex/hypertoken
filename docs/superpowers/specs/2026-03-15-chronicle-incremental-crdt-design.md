# Chronicle Incremental CRDT Design

**Date**: 2026-03-15
**Status**: Draft
**Scope**: `core-rs/`, `core/`, `engine/`

## Problem

The Rust Chronicle's `write_state_to_doc()` replaces the entire Automerge document tree on every state change. Each call to `change()` creates new Map/List objects for every section (stack, zones, source, agents, etc.), discarding the old ones. This defeats Automerge's field-level CRDT merge semantics:

- **Merge conflicts**: Two peers changing different fields both replace the same top-level objects. Automerge can't diff — last writer wins.
- **Performance**: Drawing one card rewrites every token in every section. O(N) for an O(1) operation.
- **History bloat**: Each change stores a full snapshot instead of a minimal delta.

The TypeScript Chronicle does not have this problem — `Automerge.change()` uses a mutable proxy that tracks field-level diffs natively.

## Solution

Rewrite the Rust Chronicle so each action method performs incremental Automerge operations (field-level transactions). The Chronicle gains action methods directly (`stack_draw`, `space_place`, `game_loop_start`, etc.) that open minimal transactions touching only the affected fields.

## Architecture Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Approach | Operation-based writes | Each action directly mutates Automerge fields via transactions |
| WASM boundary | Rust Chronicle replaces TS Chronicle when active | Single source of truth, no dual-state |
| GameLoop/RuleEngine | Route through `engine.dispatch()` with new action types | Consistent dispatch-everything architecture |
| TS fallback | Full parity maintained | TS path already has correct CRDT semantics; Rust is brought up to match |
| Struct ownership | Chronicle gains action methods; ActionDispatcher becomes thin router | Cleaner single-object model |
| State reads | Cache with dirty tracking | `session.state` returns cached JS object, re-fetches only dirty sections from WASM |
| Token/Batch ops | Remain stateless on ActionDispatcher | Pure functions on JSON, no CRDT mutation needed |

## Document Schema

Unchanged from current. The Automerge document structure:

```
ROOT
├── stack: Map { stack: List[Token], drawn: List[Token], discards: List[Token] }
├── zones: Map { zone_name: List[Placement], ... }
├── source: Map { stackIds: List[String], tokens: List[Token], burned: List[Token], seed: Int, reshufflePolicy: Map }
├── gameLoop: Map { turn: Int, running: Bool, activeAgentIndex: Int, phase: String, maxTurns: Int }
├── rules: Map { fired: Map { ruleName: Int(timestamp) } }
├── agents: Map { name: Map { id, name, active, resources: Map, inventory: List[Token], meta: Map } }
├── gameState: Map { status: String, phase: String, winner: String, ... }
├── version: String
└── nullifiers: Map { hash: Int(timestamp) }
```

Note: `gameLoop` (turn management) and `gameState` (game lifecycle: start/end/pause) are separate sections. `GameLoop` manages turn rotation; `GameStateManager` manages lifecycle status. Both get incremental CRDT methods.

## Rust Chronicle Structure

```rust
#[wasm_bindgen]
pub struct Chronicle {
    doc: Automerge,
    // Cached ObjIds for fast access to top-level sections
    stack_id: Option<ObjId>,
    zones_id: Option<ObjId>,
    source_id: Option<ObjId>,
    game_loop_id: Option<ObjId>,
    game_state_id: Option<ObjId>,
    rules_id: Option<ObjId>,
    agents_id: Option<ObjId>,
    nullifiers_id: Option<ObjId>,
    // Dirty tracking for cache invalidation
    dirty: DirtySections,
}

#[derive(Default)]
struct DirtySections {
    stack: bool,
    zones: bool,
    source: bool,
    game_loop: bool,
    game_state: bool,
    rules: bool,
    agents: bool,
    nullifiers: bool,
    all: bool,  // set on load/merge/init — forces full cache refresh
}
```

Cached `ObjId`s are resolved during `init()`/`load()`/`merge()`/`set_state_full()` via `resolve_section_ids()` and updated when sections are created via `ensure_section()`. This avoids repeated `doc.get(ROOT, "stack")` lookups on every action.

`version` and `extra` fields are not independently tracked — they are refreshed only when `dirty.all = true` (load/merge/sync events). This is acceptable because `version` rarely changes and `extra` is extensible metadata.

## Implementation Constraints

The `self.doc.transact()` closure borrows `self.doc` mutably, which prevents any other borrows of `self` inside the closure. All action methods must follow these rules:

1. **Pre-read**: Clone any `self.*_id` values and read any `self.*` fields **before** entering `transact()`.
2. **Pure closure**: Inside `transact()`, use only the `tx` parameter, cloned ObjIds, and local variables. Never reference `self`.
3. **Post-write**: Set `self.dirty.<section>` flags and store results **after** `transact()` returns.
4. **Helpers are static**: `read_token_from_tx()`, `write_token_to_tx()`, etc. take `&T: Transactable` — no `&self` parameter.
5. **Error safety**: If `transact()` returns an error, dirty flags are not set (correct — state unchanged on failure).

### Automerge 0.6 API Pattern

All Automerge reads inside transactions must use the `if let` pattern proven in the existing codebase, not direct destructuring:

```rust
// CORRECT — matches existing chronicle.rs usage
if let Ok(Some((_, stack_arr))) = tx.get(&stack_id, "stack") {
    let len = tx.length(&stack_arr);
    // ...
}

// WRONG — will not compile with automerge 0.6
let (_, stack_arr) = tx.get(&stack_id, "stack")?.unwrap();
```

## Action Method Pattern

Every action method follows the same pattern:

1. Clone the relevant cached `ObjId`
2. Open `doc.transact()`
3. Read/write only the affected list elements or map fields
4. Close transaction
5. Set `self.dirty.<section> = true`
6. Return result

### Example — `stack_draw` (single-section)

```rust
pub fn stack_draw(&mut self, count: usize) -> Result<String> {
    let stack_id = self.stack_id.clone()
        .ok_or(HyperTokenError::InvalidOperation("No stack initialized".into()))?;
    let mut drawn_tokens = Vec::new();

    self.doc.transact::<_, _, AutomergeError>(|tx| {
        if let Ok(Some((_, stack_arr))) = tx.get(&stack_id, "stack") {
            if let Ok(Some((_, drawn_arr))) = tx.get(&stack_id, "drawn") {
                let len = tx.length(&stack_arr);
                let to_draw = count.min(len);

                for _ in 0..to_draw {
                    let current_len = tx.length(&stack_arr);
                    if current_len == 0 { break; }
                    let idx = current_len - 1;

                    if let Ok(Some((_, token_obj))) = tx.get(&stack_arr, idx) {
                        let token = Self::read_token_from_tx(tx, &token_obj)?;
                        drawn_tokens.push(token.clone());

                        // Delete from stack
                        tx.delete(&stack_arr, idx)?;

                        // Append to drawn list
                        let new_idx = tx.length(&drawn_arr);
                        let new_obj = tx.insert_object(&drawn_arr, new_idx, ObjType::Map)?;
                        Self::write_token_to_tx(tx, &new_obj, &token)?;
                    }
                }
            }
        }
        Ok(())
    }).map_err(|e| HyperTokenError::CrdtError(format!("Transaction failed: {:?}", e)))?;

    self.dirty.stack = true;
    serde_json::to_string(&drawn_tokens)
        .map_err(|e| HyperTokenError::SerializationError(e.to_string()))
}
```

### Example — `agent_draw_cards` (compound, multi-section)

```rust
pub fn agent_draw_cards(&mut self, agent_name: &str, count: usize) -> Result<String> {
    let stack_id = self.stack_id.clone()
        .ok_or(HyperTokenError::InvalidOperation("No stack initialized".into()))?;
    let agents_id = self.agents_id.clone()
        .ok_or(HyperTokenError::InvalidOperation("No agents initialized".into()))?;
    let agent_name_owned = agent_name.to_string();
    let mut drawn_count = 0usize;

    self.doc.transact::<_, _, AutomergeError>(|tx| {
        if let Ok(Some((_, stack_arr))) = tx.get(&stack_id, "stack") {
            if let Ok(Some((_, agent_obj))) = tx.get(&agents_id, agent_name_owned.as_str()) {
                if let Ok(Some((_, inventory_arr))) = tx.get(&agent_obj, "inventory") {
                    let len = tx.length(&stack_arr);
                    let to_draw = count.min(len);

                    for _ in 0..to_draw {
                        let current_len = tx.length(&stack_arr);
                        if current_len == 0 { break; }
                        let idx = current_len - 1;

                        if let Ok(Some((_, token_obj))) = tx.get(&stack_arr, idx) {
                            let token = Self::read_token_from_tx(tx, &token_obj)?;
                            tx.delete(&stack_arr, idx)?;

                            // Add to agent inventory
                            let inv_idx = tx.length(&inventory_arr);
                            let new_obj = tx.insert_object(&inventory_arr, inv_idx, ObjType::Map)?;
                            Self::write_token_to_tx(tx, &new_obj, &token)?;
                            drawn_count += 1;
                        }
                    }
                }
            }
        }
        Ok(())
    }).map_err(|e| HyperTokenError::CrdtError(format!("Transaction failed: {:?}", e)))?;

    // Both sections modified in one transaction
    self.dirty.stack = true;
    self.dirty.agents = true;

    Ok(serde_json::json!({ "drawn": drawn_count }).to_string())
}
```

## ActionDispatcher Refactoring

The `ActionDispatcher` becomes a thin routing layer holding a `Chronicle`. It **drops** the `Stack`, `Space`, `Source`, and `AgentManager` fields entirely — these standalone structs are no longer used in the WASM dispatch path.

```rust
#[wasm_bindgen]
pub struct ActionDispatcher {
    chronicle: Chronicle,
    token_ops: TokenOps,   // stateless pure functions, kept directly
    batch_ops: BatchOps,   // stateless pure functions, kept directly
}

impl ActionDispatcher {
    pub fn stack_draw(&mut self, count: usize) -> Result<String> {
        self.chronicle.stack_draw(count)
    }
    // ... all CRDT-mutating methods are one-line delegates to Chronicle

    pub fn token_transform(&self, token_json: &str, props_json: &str) -> Result<String> {
        self.token_ops.transform(token_json, props_json)
    }
    // ... token/batch ops delegate to their respective stateless handlers
}
```

The JS-facing WASM-bindgen API on `ActionDispatcher` remains unchanged — `Engine.ts`'s `_dispatchWasm()` method continues calling `dispatcher.stackDraw()`, `dispatcher.spacePlace()`, etc. The only difference is that under the hood these now transact on Automerge instead of mutating in-memory structs.

### Standalone structs disposition

- `Stack`, `Space`, `Source`, `AgentManager` Rust structs remain in the codebase
- They are still compiled and available for standalone use (benchmarks, tests, non-CRDT scenarios)
- They are **not** instantiated or used by the `ActionDispatcher` in the WASM path
- Engine.ts no longer calls `setStack()`, `setSpace()`, `setSource()` when WASM is active — these methods are removed from `ActionDispatcher` or made no-ops

### Token and Batch Operations

`token:transform`, `token:attach`, `token:detach`, `token:merge`, `token:split` and all `tokens:*` batch operations are **pure functions** — they take token JSON as input and return transformed token JSON as output. They do not read or write CRDT state. These remain delegated to `TokenOps` and `BatchOps` on the `ActionDispatcher`, unchanged.

## TS Integration: WasmChronicleAdapter

A new TS class wraps the Rust Chronicle and implements the `IChronicle` interface (shared with the TS Chronicle):

```ts
interface IChronicle extends Emitter {
    readonly state: HyperTokenState;
    save(): Uint8Array;
    saveToBase64(): string;
    load(data: Uint8Array): void;
    loadFromBase64(b64: string): void;
    merge(other: Uint8Array): void;
    change(message: string, callback: (doc: HyperTokenState) => void): void;
    generateSyncMessage(state?: Uint8Array): string;
    receiveSyncMessage(msg: Uint8Array, state?: Uint8Array): string;
}
```

```ts
class WasmChronicleAdapter extends Emitter implements IChronicle {
    private _wasm: WasmChronicle;
    private _cache: Partial<HyperTokenState> = {};

    get state(): HyperTokenState {
        const dirty = this._wasm.getDirty();
        if (dirty.all) {
            this._cache = JSON.parse(this._wasm.getState());
        } else {
            if (dirty.stack)       this._cache.stack       = JSON.parse(this._wasm.exportStack());
            if (dirty.zones)       this._cache.zones       = JSON.parse(this._wasm.exportZones());
            if (dirty.source)      this._cache.source      = JSON.parse(this._wasm.exportSource());
            if (dirty.gameLoop)    this._cache.gameLoop    = JSON.parse(this._wasm.exportGameLoop());
            if (dirty.gameState)   this._cache.gameState   = JSON.parse(this._wasm.exportGameState());
            if (dirty.rules)       this._cache.rules       = JSON.parse(this._wasm.exportRules());
            if (dirty.agents)      this._cache.agents      = JSON.parse(this._wasm.exportAgents());
            if (dirty.nullifiers)  this._cache.nullifiers  = JSON.parse(this._wasm.exportNullifiers());
        }
        this._wasm.clearDirty();
        return this._cache as HyperTokenState;
    }

    change(message: string, callback: (doc: HyperTokenState) => void): void {
        throw new Error("Direct change() not supported with WASM Chronicle. Use engine.dispatch().");
    }

    save(): Uint8Array         { return this._wasm.save(); }
    saveToBase64(): string     { return this._wasm.saveToBase64(); }

    load(data: Uint8Array) {
        this._wasm.load(data);
        this.emit("state:changed", { doc: this.state, source: "load" });
    }

    loadFromBase64(b64: string) {
        this._wasm.loadFromBase64(b64);
        this.emit("state:changed", { doc: this.state, source: "load" });
    }

    merge(other: Uint8Array) {
        this._wasm.merge(other);
        this.emit("state:changed", { doc: this.state, source: "merge" });
    }

    generateSyncMessage(state?: Uint8Array) { return this._wasm.generateSyncMessage(state); }

    receiveSyncMessage(msg: Uint8Array, state?: Uint8Array) {
        const result = this._wasm.receiveSyncMessage(msg, state);
        this.emit("state:changed", { doc: this.state, source: "sync" });
        return result;
    }
}
```

### Event Emission

The TS Chronicle emits `"state:changed"` on every mutation. The Engine listens for this to emit `"state:updated"`, which GameLoop's `_syncState()` depends on.

With the WASM path, mutations go through `Engine.dispatch()` → `_dispatchWasm()` → `ActionDispatcher` → `Chronicle`. The `WasmChronicleAdapter` does not see these calls directly. Therefore, **the Engine dispatch path must emit `"state:changed"` after each successful WASM dispatch**:

```ts
// In Engine.dispatch(), after successful WASM action:
this.session.emit("state:changed", { source: "dispatch" });
```

This preserves the reactive chain: `state:changed` → `state:updated` → GameLoop `_syncState()`.

For `load()`, `merge()`, and `receiveSyncMessage()`, the `WasmChronicleAdapter` emits `"state:changed"` directly (shown above).

### Engine Integration

```ts
// Engine constructor
if (wasmAvailable) {
    this.session = new WasmChronicleAdapter(wasmChronicle);
} else {
    this.session = new Chronicle();
}
```

`Engine.session` is typed as `IChronicle`. Both `Chronicle` and `WasmChronicleAdapter` implement this interface. All existing code reading `this.session.state.*` works unchanged.

### WasmBridge Integration

`WasmBridge.ts` continues to expose both `Chronicle` and `ActionDispatcher` from the WASM module. Engine initializes `ActionDispatcher` (which internally holds a `Chronicle`). The `WasmChronicleAdapter` wraps the dispatcher's chronicle for the `session` interface.

## GameLoop and RuleEngine Migration

These components currently call `session.change()` directly. Instead of dual-path branching, they are migrated to use `engine.dispatch()` with new action types. This keeps the architecture consistent — all state mutations flow through dispatch.

### New Action Types

```ts
// GameLoop actions — added to ActionRegistry and WASM_ACTIONS
"game:loopInit"     // { maxTurns }
"game:loopStart"    // {}
"game:loopStop"     // { reason }
"game:nextTurn"     // { agentCount }
"game:setPhase"     // { phase }

// RuleEngine actions
"rule:markFired"    // { name, timestamp }
```

### GameLoop Migration

```ts
// GameLoop.start() — BEFORE
start() {
    if (this.running) return;
    this.session.change("start loop", (doc) => {
        doc.gameLoop.running = true;
        doc.gameLoop.turn = 0;
        doc.gameLoop.phase = "play";
        doc.gameLoop.activeAgentIndex = 0;
    });
    this._syncState();
}

// GameLoop.start() — AFTER
start() {
    if (this.running) return;
    this.engine.dispatch("game:loopStart", {});
    // _syncState() is triggered automatically via state:changed → state:updated listener
}
```

Both the TS `ActionRegistry` and the Rust `Chronicle` implement handlers for `game:loopStart`. The TS handler calls `session.change()` with the callback (existing behavior). The Rust handler calls `chronicle.game_loop_start()` which does incremental Automerge writes.

### Rust Chronicle Methods for GameLoop

```rust
impl Chronicle {
    pub fn game_loop_init(&mut self, max_turns: i32) -> Result<()> { ... }
    pub fn game_loop_start(&mut self) -> Result<()> { ... }
    pub fn game_loop_stop(&mut self, phase: &str) -> Result<()> { ... }
    pub fn game_loop_next_turn(&mut self, agent_count: usize) -> Result<()> { ... }
    pub fn game_loop_set_phase(&mut self, phase: &str) -> Result<()> { ... }
}
```

### Rust Chronicle Methods for RuleEngine

```rust
impl Chronicle {
    pub fn rule_mark_fired(&mut self, rule_name: &str, timestamp: i64) -> Result<()> { ... }
}
```

## Existing `change()` Method Disposition

The current Rust Chronicle `change(message, new_state_json)` method does full-state replacement via `write_state_to_doc()`. After the redesign:

- Renamed to `set_state_full(state_json)` — clarifies that it's a full replacement
- Kept only for initialization (`setState` from JS) and test setup
- Calls `resolve_section_ids()` after writing to refresh cached ObjIds
- Sets `dirty.all = true`
- Not used in the normal action dispatch path

## Sync, Merge, Save/Load, Undo/Redo

**Save/Load**: Existing `save()` / `load()` methods unchanged. After `load()`, call `resolve_section_ids()` and set `dirty.all = true`.

**Merge**: After `doc.merge()`, set `dirty.all = true` (conservative — any section could have changed).

**Sync**: `generateSyncMessage()` and `receiveSyncMessage()` work directly on the Automerge doc. After `receiveSyncMessage()`, set `dirty.all = true`.

**Undo/Redo**: Engine snapshots via `saveToBase64()` before each action and restores on undo. Works identically — `loadFromBase64()` triggers `resolve_section_ids()` + `dirty.all = true`, cache invalidates automatically.

### ObjId Cache Invariant

Cached `ObjId`s can become stale if `set_state_full()` replaces a top-level section (via `put_object()` which creates a new Automerge object). Rule: **`resolve_section_ids()` must be called after any operation that uses `put_object()` on ROOT-level keys.** This includes `set_state_full()`, `load()`, `merge()`, and `receiveSyncMessage()`. The incremental action methods never call `put_object()` on existing sections — they only mutate fields within existing objects — so the cache remains valid during normal operation.

## File Structure

### New Rust files
```
core-rs/src/
├── chronicle.rs              ← REWRITTEN: DirtySections, cached ObjIds, section exports, set_state_full
├── chronicle_actions/        ← NEW
│   ├── mod.rs
│   ├── stack.rs              ← 10 methods
│   ├── space.rs              ← 11 methods
│   ├── source.rs             ← 7 methods
│   ├── agent.rs              ← 14 methods
│   ├── game_loop.rs          ← 5 methods
│   ├── game_state.rs         ← 6 methods (start, end, pause, resume, nextPhase, setProperty)
│   ├── rules.rs              ← 1 method
│   └── helpers.rs            ← read/write token, string, list helpers for Automerge transactions
├── actions.rs                ← SIMPLIFIED: thin delegate to Chronicle + TokenOps + BatchOps
```

### New/modified TS files
```
core/IChronicle.ts            ← NEW: shared interface for Chronicle and WasmChronicleAdapter
core/WasmChronicleAdapter.ts  ← NEW: wraps Rust Chronicle with cache + dirty tracking
engine/Engine.ts              ← MODIFIED: use WasmChronicleAdapter when WASM available,
                                 emit state:changed after WASM dispatch,
                                 remove setStack/setSpace/setSource calls on WASM path
engine/GameLoop.ts            ← MODIFIED: use engine.dispatch() instead of session.change()
engine/RuleEngine.ts          ← MODIFIED: use engine.dispatch() instead of session.change()
engine/actions.ts             ← MODIFIED: add handlers for game:loopStart, game:loopStop,
                                 game:nextTurn, game:setPhase, rule:markFired
```

### Unchanged
- `stack.rs`, `space.rs`, `source.rs`, `agent.rs` — kept for standalone use and benchmarks
- `token.rs`, `token_ops.rs`, `batch.rs`, `parallel.rs`, `types.rs`, `utils.rs` — unchanged
- `core/Chronicle.ts` — unchanged (TS fallback path)

## Implementation Phases

### Phase 1 — Foundation
Add `DirtySections`, cached `ObjId`s, `resolve_section_ids()`, `ensure_section()`, section export methods (`export_stack`, `export_zones`, etc.), `get_dirty`/`clear_dirty` WASM bindings, and `chronicle_actions/helpers.rs` to the Chronicle. Rename existing `change()` to `set_state_full()`. No behavioral change; all existing tests pass.

### Phase 2 — Action Methods
Implement action methods category by category in `chronicle_actions/`:
- `stack.rs` — 10 methods
- `space.rs` — 11 methods
- `source.rs` — 7 methods
- `agent.rs` — 14 methods
- `game_loop.rs` — 5 methods
- `game_state.rs` — 6 methods
- `rules.rs` — 1 method

Each category gets tests verifying:
1. Action produces correct state (read back from Automerge doc)
2. Only the expected section(s) are marked dirty
3. Result matches what the standalone struct would produce for the same operation

### Phase 3 — ActionDispatcher Rewire
Rewrite `ActionDispatcher` to hold a `Chronicle` instead of standalone structs. Remove `setStack`/`setSpace`/`setSource` methods. All CRDT-mutating dispatch methods become one-line delegates to Chronicle. `TokenOps` and `BatchOps` remain on the dispatcher. Existing WASM boundary tests pass (same JS-facing API).

### Phase 4 — TS Integration
- Create `IChronicle` interface
- Create `WasmChronicleAdapter`
- Modify `Engine.ts`: use `WasmChronicleAdapter` when WASM available, emit `state:changed` after WASM dispatch, type `session` as `IChronicle`
- Modify `GameLoop.ts`: replace `session.change()` calls with `engine.dispatch()`
- Modify `RuleEngine.ts`: replace `session.change()` calls with `engine.dispatch()`
- Add new action handlers to `engine/actions.ts`: `game:loopStart`, `game:loopStop`, `game:nextTurn`, `game:setPhase`, `rule:markFired`
- Run full test suite: `npm run test` — both WASM and TS paths exercised

### Phase 5 — Parity Validation
Create parity test harness running every action through both paths (TS Chronicle via ActionRegistry and WASM Chronicle via ActionDispatcher). Verify:
- Resulting state is identical for each action
- Automerge documents produced by both paths can merge cleanly
- Undo/redo works through WASM path
- Save/load round-trips through WASM path

## Action Method Inventory

### Stack (10 methods)
`stack_draw`, `stack_shuffle`, `stack_burn`, `stack_cut`, `stack_reset`, `stack_discard`, `stack_insert_at`, `stack_remove_at`, `stack_swap`, `stack_reverse`

### Space (11 methods)
`space_place`, `space_move`, `space_remove`, `space_flip`, `space_create_zone`, `space_delete_zone`, `space_clear_zone`, `space_lock_zone`, `space_shuffle_zone`, `space_transfer_zone`, `space_clear`

### Source (7 methods)
`source_draw`, `source_shuffle`, `source_burn`, `source_add_stack`, `source_remove_stack`, `source_reset`, `source_set_reshuffle_policy`

### Agent (14 methods)
`agent_create`, `agent_remove`, `agent_set_active`, `agent_give_resource`, `agent_take_resource`, `agent_add_token`, `agent_remove_token`, `agent_transfer_resource`, `agent_transfer_token`, `agent_steal_resource`, `agent_steal_token`, `agent_draw_cards`, `agent_discard_cards`, `agent_trade`

### GameLoop (5 methods)
`game_loop_init`, `game_loop_start`, `game_loop_stop`, `game_loop_next_turn`, `game_loop_set_phase`

### GameState (6 methods)
`game_state_start`, `game_state_end`, `game_state_pause`, `game_state_resume`, `game_state_next_phase`, `game_state_set_property`

### Rules (1 method)
`rule_mark_fired`

**Total: 54 action methods + transaction helpers**
