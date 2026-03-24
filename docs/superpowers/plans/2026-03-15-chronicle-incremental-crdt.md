# Chronicle Incremental CRDT Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rewrite the Rust Chronicle so each action method performs incremental Automerge transactions instead of full-state replacement, enabling proper CRDT merge semantics.

**Architecture:** Chronicle gains 54 action methods that open minimal Automerge transactions touching only affected fields. ActionDispatcher becomes a thin router delegating to Chronicle. A new TS `WasmChronicleAdapter` wraps the Rust Chronicle behind the `IChronicle` interface with dirty-section caching.

**Tech Stack:** Rust (automerge 0.6, wasm-bindgen), TypeScript ESM, Automerge CRDT

**Spec:** `docs/superpowers/specs/2026-03-15-chronicle-incremental-crdt-design.md`

---

## File Structure

### Rust files (create/modify)

| Action | Path | Responsibility |
|--------|------|----------------|
| MODIFY | `core-rs/src/chronicle.rs` | Add DirtySections, cached ObjIds, resolve/ensure helpers, section exports, dirty WASM bindings, rename `change()` to `set_state_full()` |
| CREATE | `core-rs/src/chronicle_actions/mod.rs` | Module declarations for all action submodules |
| CREATE | `core-rs/src/chronicle_actions/helpers.rs` | Transaction-compatible read/write helpers for tokens, placements, scalars |
| CREATE | `core-rs/src/chronicle_actions/stack.rs` | 10 stack action methods on Chronicle |
| CREATE | `core-rs/src/chronicle_actions/space.rs` | 11 space action methods on Chronicle |
| CREATE | `core-rs/src/chronicle_actions/source.rs` | 7 source action methods on Chronicle |
| CREATE | `core-rs/src/chronicle_actions/agent.rs` | 14 agent action methods on Chronicle |
| CREATE | `core-rs/src/chronicle_actions/game_loop.rs` | 5 game loop action methods on Chronicle |
| CREATE | `core-rs/src/chronicle_actions/game_state.rs` | 6 game state action methods on Chronicle |
| CREATE | `core-rs/src/chronicle_actions/rules.rs` | 1 rule action method on Chronicle |
| MODIFY | `core-rs/src/actions.rs` | Drop standalone structs, delegate to Chronicle |
| MODIFY | `core-rs/src/lib.rs` | Add `mod chronicle_actions` declaration |

### TypeScript files (create/modify)

| Action | Path | Responsibility |
|--------|------|----------------|
| CREATE | `core/IChronicle.ts` | Shared interface for Chronicle and WasmChronicleAdapter |
| CREATE | `core/WasmChronicleAdapter.ts` | Wraps Rust Chronicle with cache + dirty tracking |
| MODIFY | `engine/Engine.ts:62,92,197-253,429-461,501+` | Use WasmChronicleAdapter, emit state:changed after WASM dispatch, add new WASM action types |
| MODIFY | `engine/GameLoop.ts:32,58,100,113,129` | Replace `session.change()` with `engine.dispatch()` |
| MODIFY | `engine/RuleEngine.ts:33,83` | Replace `session.change()` with `engine.dispatch()` |
| MODIFY | `engine/actions.ts` | Add handlers for `game:loopInit`, `game:loopStart`, `game:loopStop`, `game:nextTurn`, `game:setPhase`, `rule:markFired` |

---

## Chunk 1: Phase 1 — Foundation

### Task 1: Add DirtySections and cached ObjIds to Chronicle

**Files:**
- Modify: `core-rs/src/chronicle.rs:1-33`
- Test: `core-rs/src/chronicle.rs` (existing tests)

- [ ] **Step 1: Add DirtySections struct and update Chronicle struct**

Add the dirty tracking struct and cached ObjIds to `chronicle.rs`. Place the struct above the Chronicle definition.

```rust
// After the use statements (line 13), before the Chronicle struct doc comment (line 15):

/// Tracks which document sections have been modified since last cache read
#[derive(Default)]
pub(crate) struct DirtySections {
    pub stack: bool,
    pub zones: bool,
    pub source: bool,
    pub game_loop: bool,
    pub game_state: bool,
    pub rules: bool,
    pub agents: bool,
    pub nullifiers: bool,
    pub all: bool, // set on load/merge/init — forces full cache refresh
}

impl DirtySections {
    pub fn mark_all(&mut self) {
        self.all = true;
    }

    pub fn clear(&mut self) {
        *self = DirtySections::default();
    }

    /// Return a JSON summary of which sections are dirty
    pub fn to_json(&self) -> String {
        serde_json::json!({
            "stack": self.stack,
            "zones": self.zones,
            "source": self.source,
            "gameLoop": self.game_loop,
            "gameState": self.game_state,
            "rules": self.rules,
            "agents": self.agents,
            "nullifiers": self.nullifiers,
            "all": self.all
        }).to_string()
    }
}
```

Update the Chronicle struct to hold cached ObjIds and dirty flags:

```rust
#[wasm_bindgen]
pub struct Chronicle {
    // All fields are pub(crate) so chronicle_actions/ submodules can access them.
    // chronicle_actions/ is declared in lib.rs as a sibling module to chronicle,
    // so private fields would be inaccessible from there.
    pub(crate) doc: Automerge,
    // Cached ObjIds for fast access to top-level sections
    pub(crate) stack_id: Option<ObjId>,
    pub(crate) zones_id: Option<ObjId>,
    pub(crate) source_id: Option<ObjId>,
    pub(crate) game_loop_id: Option<ObjId>,
    pub(crate) game_state_id: Option<ObjId>,
    pub(crate) rules_id: Option<ObjId>,
    pub(crate) agents_id: Option<ObjId>,
    pub(crate) nullifiers_id: Option<ObjId>,
    // Dirty tracking for cache invalidation
    pub(crate) dirty: DirtySections,
}
```

**Why pub(crate)?** The `chronicle_actions/` module is declared in `lib.rs` as a sibling to `chronicle`. Rust's privacy rules prevent sibling modules from accessing private fields. `pub(crate)` gives visibility within the crate only — no WASM/external exposure.

- [ ] **Step 2: Update Chronicle::new() to initialize new fields**

```rust
pub fn new() -> Chronicle {
    Chronicle {
        doc: Automerge::new(),
        stack_id: None,
        zones_id: None,
        source_id: None,
        game_loop_id: None,
        game_state_id: None,
        rules_id: None,
        agents_id: None,
        nullifiers_id: None,
        dirty: DirtySections::default(),
    }
}
```

Also update `Default` impl at the bottom of the file.

- [ ] **Step 3: Run tests to verify no regressions**

Run: `cd /Users/sibyl/dev/hypertoken/core-rs && cargo test --target $(rustc -vV | grep host | cut -d' ' -f2) -- chronicle`
Expected: All existing chronicle tests pass (the new fields are just initialized to None/default)

- [ ] **Step 4: Commit**

```bash
git add core-rs/src/chronicle.rs
git commit -m "feat(chronicle): add DirtySections and cached ObjId fields"
```

---

### Task 2: Implement resolve_section_ids() and ensure_section()

**Files:**
- Modify: `core-rs/src/chronicle.rs` (private impl block, ~line 244)

- [ ] **Step 1: Write test for resolve_section_ids**

Add to the `#[cfg(test)] mod tests` block:

```rust
#[test]
fn test_resolve_section_ids() {
    let mut chronicle = Chronicle::new();
    chronicle.set_state(r#"{"stack":{"stack":[],"drawn":[],"discards":[]},"zones":{},"gameLoop":{"turn":0,"running":false,"activeAgentIndex":0,"phase":"setup","maxTurns":10}}"#).unwrap();

    chronicle.resolve_section_ids();

    assert!(chronicle.stack_id.is_some());
    assert!(chronicle.zones_id.is_some());
    assert!(chronicle.game_loop_id.is_some());
    // source, agents, rules, nullifiers not in state — should be None
    assert!(chronicle.source_id.is_none());
    assert!(chronicle.agents_id.is_none());
}
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd /Users/sibyl/dev/hypertoken/core-rs && cargo test --target $(rustc -vV | grep host | cut -d' ' -f2) -- test_resolve_section_ids`
Expected: FAIL — `resolve_section_ids` method does not exist

- [ ] **Step 3: Implement resolve_section_ids() and ensure_section()**

Add to the private `impl Chronicle` block (after `write_state_to_doc`):

```rust
/// Resolve and cache ObjIds for all top-level document sections.
/// Called after load/merge/set_state_full to refresh the cache.
pub(crate) fn resolve_section_ids(&mut self) {
    self.stack_id = self.doc.get(automerge::ROOT, "stack")
        .ok().flatten().map(|(_, id)| id);
    self.zones_id = self.doc.get(automerge::ROOT, "zones")
        .ok().flatten().map(|(_, id)| id);
    self.source_id = self.doc.get(automerge::ROOT, "source")
        .ok().flatten().map(|(_, id)| id);
    self.game_loop_id = self.doc.get(automerge::ROOT, "gameLoop")
        .ok().flatten().map(|(_, id)| id);
    self.game_state_id = self.doc.get(automerge::ROOT, "gameState")
        .ok().flatten().map(|(_, id)| id);
    self.rules_id = self.doc.get(automerge::ROOT, "rules")
        .ok().flatten().map(|(_, id)| id);
    self.agents_id = self.doc.get(automerge::ROOT, "agents")
        .ok().flatten().map(|(_, id)| id);
    self.nullifiers_id = self.doc.get(automerge::ROOT, "nullifiers")
        .ok().flatten().map(|(_, id)| id);
}

/// Ensure a top-level section exists, creating it if necessary.
/// Returns the ObjId of the section. Updates the cached ObjId.
pub(crate) fn ensure_section(&mut self, key: &str) -> Result<ObjId> {
    // Check if already cached
    let cached = match key {
        "stack" => &self.stack_id,
        "zones" => &self.zones_id,
        "source" => &self.source_id,
        "gameLoop" => &self.game_loop_id,
        "gameState" => &self.game_state_id,
        "rules" => &self.rules_id,
        "agents" => &self.agents_id,
        "nullifiers" => &self.nullifiers_id,
        _ => return Err(HyperTokenError::InvalidOperation(format!("Unknown section: {}", key))),
    };

    if let Some(id) = cached {
        return Ok(id.clone());
    }

    // Check if it exists in the doc but isn't cached
    if let Ok(Some((_, id))) = self.doc.get(automerge::ROOT, key) {
        let cloned = id.clone();
        match key {
            "stack" => self.stack_id = Some(cloned.clone()),
            "zones" => self.zones_id = Some(cloned.clone()),
            "source" => self.source_id = Some(cloned.clone()),
            "gameLoop" => self.game_loop_id = Some(cloned.clone()),
            "gameState" => self.game_state_id = Some(cloned.clone()),
            "rules" => self.rules_id = Some(cloned.clone()),
            "agents" => self.agents_id = Some(cloned.clone()),
            "nullifiers" => self.nullifiers_id = Some(cloned.clone()),
            _ => {}
        }
        return Ok(cloned);
    }

    // Create the section
    let new_id = self.doc.transact::<_, _, AutomergeError>(|tx| {
        Ok(tx.put_object(automerge::ROOT, key, ObjType::Map)?)
    }).map_err(|e| HyperTokenError::CrdtError(format!("Failed to create section {}: {:?}", key, e)))?;

    let result = new_id.result;
    match key {
        "stack" => self.stack_id = Some(result.clone()),
        "zones" => self.zones_id = Some(result.clone()),
        "source" => self.source_id = Some(result.clone()),
        "gameLoop" => self.game_loop_id = Some(result.clone()),
        "gameState" => self.game_state_id = Some(result.clone()),
        "rules" => self.rules_id = Some(result.clone()),
        "agents" => self.agents_id = Some(result.clone()),
        "nullifiers" => self.nullifiers_id = Some(result.clone()),
        _ => {}
    }
    Ok(result)
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd /Users/sibyl/dev/hypertoken/core-rs && cargo test --target $(rustc -vV | grep host | cut -d' ' -f2) -- test_resolve_section_ids`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add core-rs/src/chronicle.rs
git commit -m "feat(chronicle): implement resolve_section_ids and ensure_section"
```

---

### Task 3: Add section export methods and dirty WASM bindings

**Files:**
- Modify: `core-rs/src/chronicle.rs` (wasm_bindgen impl block)

- [ ] **Step 1: Write test for section exports**

```rust
#[test]
fn test_export_stack() {
    let mut chronicle = Chronicle::new();
    chronicle.set_state(r#"{"stack":{"stack":[{"id":"t1","text":"","char":"□","kind":"default","index":0,"meta":{}}],"drawn":[],"discards":[]}}"#).unwrap();
    chronicle.resolve_section_ids();

    let stack_json = chronicle.export_stack().unwrap();
    let stack: IStackState = serde_json::from_str(&stack_json).unwrap();
    assert_eq!(stack.stack.len(), 1);
    assert_eq!(stack.stack[0].id, "t1");
}

#[test]
fn test_dirty_tracking() {
    let mut chronicle = Chronicle::new();
    chronicle.set_state(r#"{}"#).unwrap();
    chronicle.resolve_section_ids();

    // After set_state, dirty.all should be true
    assert!(chronicle.dirty.all);

    chronicle.dirty.clear();
    assert!(!chronicle.dirty.all);
    assert!(!chronicle.dirty.stack);
}
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd /Users/sibyl/dev/hypertoken/core-rs && cargo test --target $(rustc -vV | grep host | cut -d' ' -f2) -- test_export_stack`
Expected: FAIL — `export_stack` method does not exist

- [ ] **Step 3: Implement section export methods and dirty bindings**

Add to the `#[wasm_bindgen] impl Chronicle` block:

```rust
/// Export stack section as JSON
#[wasm_bindgen(js_name = exportStack)]
pub fn export_stack(&self) -> Result<String> {
    if let Some(ref stack_id) = self.stack_id {
        let stack = self.read_stack_state(stack_id)?;
        serde_json::to_string(&stack)
            .map_err(|e| HyperTokenError::SerializationError(e.to_string()))
    } else {
        Ok("null".to_string())
    }
}

/// Export zones section as JSON
#[wasm_bindgen(js_name = exportZones)]
pub fn export_zones(&self) -> Result<String> {
    if let Some(ref zones_id) = self.zones_id {
        let zones = self.read_zones(zones_id)?;
        serde_json::to_string(&zones)
            .map_err(|e| HyperTokenError::SerializationError(e.to_string()))
    } else {
        Ok("null".to_string())
    }
}

/// Export source section as JSON
#[wasm_bindgen(js_name = exportSource)]
pub fn export_source(&self) -> Result<String> {
    if let Some(ref source_id) = self.source_id {
        let source = self.read_source_state(source_id)?;
        serde_json::to_string(&source)
            .map_err(|e| HyperTokenError::SerializationError(e.to_string()))
    } else {
        Ok("null".to_string())
    }
}

/// Export gameLoop section as JSON
#[wasm_bindgen(js_name = exportGameLoop)]
pub fn export_game_loop(&self) -> Result<String> {
    if let Some(ref gl_id) = self.game_loop_id {
        let gl = self.read_game_loop_state(gl_id)?;
        serde_json::to_string(&gl)
            .map_err(|e| HyperTokenError::SerializationError(e.to_string()))
    } else {
        Ok("null".to_string())
    }
}

/// Export gameState section as JSON
#[wasm_bindgen(js_name = exportGameState)]
pub fn export_game_state(&self) -> Result<String> {
    if let Some(ref gs_id) = self.game_state_id {
        // gameState is stored as a flat map with arbitrary keys
        let mut state = HashMap::new();
        for item in self.doc.map_range(gs_id, ..) {
            let key = item.key.to_string();
            if let Some(val) = self.read_string(gs_id, &key)? {
                state.insert(key, serde_json::Value::String(val));
            } else if let Some(val) = self.read_i64(gs_id, &key)? {
                state.insert(key, serde_json::Value::Number(val.into()));
            } else if let Some(val) = self.read_bool(gs_id, &key)? {
                state.insert(key, serde_json::Value::Bool(val));
            }
        }
        serde_json::to_string(&state)
            .map_err(|e| HyperTokenError::SerializationError(e.to_string()))
    } else {
        Ok("null".to_string())
    }
}

/// Export rules section as JSON
#[wasm_bindgen(js_name = exportRules)]
pub fn export_rules(&self) -> Result<String> {
    if let Some(ref rules_id) = self.rules_id {
        let rules = self.read_rule_state(rules_id)?;
        serde_json::to_string(&rules)
            .map_err(|e| HyperTokenError::SerializationError(e.to_string()))
    } else {
        Ok("null".to_string())
    }
}

/// Export agents section as JSON
#[wasm_bindgen(js_name = exportAgents)]
pub fn export_agents(&self) -> Result<String> {
    if let Some(ref agents_id) = self.agents_id {
        let agents = self.read_agents(agents_id)?;
        serde_json::to_string(&agents)
            .map_err(|e| HyperTokenError::SerializationError(e.to_string()))
    } else {
        Ok("null".to_string())
    }
}

/// Export nullifiers section as JSON
#[wasm_bindgen(js_name = exportNullifiers)]
pub fn export_nullifiers(&self) -> Result<String> {
    if let Some(ref null_id) = self.nullifiers_id {
        let nullifiers = self.read_nullifiers(null_id)?;
        serde_json::to_string(&nullifiers)
            .map_err(|e| HyperTokenError::SerializationError(e.to_string()))
    } else {
        Ok("null".to_string())
    }
}

/// Get dirty section flags as JSON
#[wasm_bindgen(js_name = getDirty)]
pub fn get_dirty(&self) -> String {
    self.dirty.to_json()
}

/// Clear all dirty flags
#[wasm_bindgen(js_name = clearDirty)]
pub fn clear_dirty(&mut self) {
    self.dirty.clear();
}
```

- [ ] **Step 4: Wire set_state, load, merge to call resolve_section_ids and mark dirty.all**

In `set_state()` (line 50), after `self.write_state_to_doc(&state)?;` add:
```rust
self.resolve_section_ids();
self.dirty.mark_all();
```

In `load()` (line 105), after `self.doc = Automerge::load(data)...` add:
```rust
self.resolve_section_ids();
self.dirty.mark_all();
```

In `load_from_base64()` — already calls `self.load()`, so it inherits the fix.

In `merge()` (line 128), after `self.doc.merge(&mut other_doc)...` add:
```rust
self.resolve_section_ids();
self.dirty.mark_all();
```

In `receive_sync_message()` (line 195), after `self.doc.receive_sync_message(...)` add:
```rust
self.resolve_section_ids();
self.dirty.mark_all();
```

- [ ] **Step 5: Run all chronicle tests**

Run: `cd /Users/sibyl/dev/hypertoken/core-rs && cargo test --target $(rustc -vV | grep host | cut -d' ' -f2) -- chronicle`
Expected: All tests PASS including the new ones

- [ ] **Step 6: Commit**

```bash
git add core-rs/src/chronicle.rs
git commit -m "feat(chronicle): add section exports and dirty tracking WASM bindings"
```

---

### Task 4: Rename change() to set_state_full()

**Files:**
- Modify: `core-rs/src/chronicle.rs:78-95`

- [ ] **Step 1: Rename the method and update WASM binding**

Rename the existing `change()` method. Keep the old JS name as an alias but add the new one:

```rust
/// Full-state replacement (initialization and legacy use only).
///
/// For incremental mutations, use the action methods (stack_draw, space_place, etc.).
#[wasm_bindgen(js_name = setStateFull)]
pub fn set_state_full(&mut self, message: &str, new_state_json: &str) -> Result<()> {
    let state: HyperTokenState = serde_json::from_str(new_state_json)
        .map_err(|e| HyperTokenError::SerializationError(format!("Invalid state JSON: {}", e)))?;

    if !message.is_empty() {
        let msg = message.to_string();
        self.doc.transact_with::<_, _, automerge::AutomergeError, _>(
            |_| automerge::transaction::CommitOptions::default().with_message(msg),
            |_tx| Ok(()),
        ).map_err(|e| HyperTokenError::CrdtError(format!("Transaction failed: {:?}", e)))?;
    }

    self.write_state_to_doc(&state)?;
    self.resolve_section_ids();
    self.dirty.mark_all();

    Ok(())
}

/// Legacy alias for set_state_full (backward compatibility)
#[wasm_bindgen(js_name = change)]
pub fn change(&mut self, message: &str, new_state_json: &str) -> Result<()> {
    self.set_state_full(message, new_state_json)
}
```

- [ ] **Step 2: Run all tests**

Run: `cd /Users/sibyl/dev/hypertoken/core-rs && cargo test --target $(rustc -vV | grep host | cut -d' ' -f2)`
Expected: All 50+ tests PASS

- [ ] **Step 3: Commit**

```bash
git add core-rs/src/chronicle.rs
git commit -m "refactor(chronicle): rename change() to set_state_full(), keep legacy alias"
```

---

### Task 5: Create chronicle_actions module structure and helpers

**Files:**
- Create: `core-rs/src/chronicle_actions/mod.rs`
- Create: `core-rs/src/chronicle_actions/helpers.rs`
- Modify: `core-rs/src/lib.rs:28` (add module declaration)

- [ ] **Step 1: Create the module directory and mod.rs**

```rust
// core-rs/src/chronicle_actions/mod.rs
pub mod helpers;
pub mod stack;
pub mod space;
pub mod source;
pub mod agent;
pub mod game_loop;
pub mod game_state;
pub mod rules;
```

- [ ] **Step 2: Create helpers.rs with transaction-compatible read/write utilities**

```rust
// core-rs/src/chronicle_actions/helpers.rs
//
// Transaction-compatible helpers for reading and writing Automerge objects.
// These work inside transact() closures via the Transactable trait.

use automerge::{AutomergeError, ObjId, ObjType, ReadDoc, Value, transaction::Transactable};
use crate::types::{IToken, IPlacementCRDT, Metadata};
use std::collections::HashMap;

// ============================================================================
// Scalar readers (work with both Automerge and Transaction via ReadDoc)
// ============================================================================

pub fn read_string_rd<D: ReadDoc>(doc: &D, obj: &ObjId, key: &str) -> Option<String> {
    match doc.get(obj, key) {
        Ok(Some((Value::Scalar(s), _))) => {
            if let automerge::ScalarValue::Str(v) = s.as_ref() {
                Some(v.to_string())
            } else {
                None
            }
        }
        _ => None,
    }
}

pub fn read_i64_rd<D: ReadDoc>(doc: &D, obj: &ObjId, key: &str) -> Option<i64> {
    match doc.get(obj, key) {
        Ok(Some((Value::Scalar(s), _))) => {
            match s.as_ref() {
                automerge::ScalarValue::Int(v) => Some(*v),
                automerge::ScalarValue::Uint(v) => Some(*v as i64),
                _ => None,
            }
        }
        _ => None,
    }
}

pub fn read_f64_rd<D: ReadDoc>(doc: &D, obj: &ObjId, key: &str) -> Option<f64> {
    match doc.get(obj, key) {
        Ok(Some((Value::Scalar(s), _))) => {
            match s.as_ref() {
                automerge::ScalarValue::F64(v) => Some(*v),
                automerge::ScalarValue::Int(v) => Some(*v as f64),
                automerge::ScalarValue::Uint(v) => Some(*v as f64),
                _ => None,
            }
        }
        _ => None,
    }
}

pub fn read_bool_rd<D: ReadDoc>(doc: &D, obj: &ObjId, key: &str) -> Option<bool> {
    match doc.get(obj, key) {
        Ok(Some((Value::Scalar(s), _))) => {
            if let automerge::ScalarValue::Boolean(v) = s.as_ref() {
                Some(*v)
            } else {
                None
            }
        }
        _ => None,
    }
}

pub fn read_list_string_rd<D: ReadDoc>(doc: &D, list: &ObjId, index: usize) -> Option<String> {
    match doc.get(list, index) {
        Ok(Some((Value::Scalar(s), _))) => {
            if let automerge::ScalarValue::Str(v) = s.as_ref() {
                Some(v.to_string())
            } else {
                None
            }
        }
        _ => None,
    }
}

// ============================================================================
// Token read/write (transaction-compatible)
// ============================================================================

/// Read an IToken from an Automerge map object
pub fn read_token_rd<D: ReadDoc>(doc: &D, obj: &ObjId) -> IToken {
    let id = read_string_rd(doc, obj, "id").unwrap_or_default();
    let label = read_string_rd(doc, obj, "label");
    let group = read_string_rd(doc, obj, "group");
    let text = read_string_rd(doc, obj, "text").unwrap_or_default();
    let char = read_string_rd(doc, obj, "char").unwrap_or_else(|| "□".to_string());
    let kind = read_string_rd(doc, obj, "kind").unwrap_or_else(|| "default".to_string());
    let index = read_i64_rd(doc, obj, "index").unwrap_or(0) as i32;

    let meta: Metadata = read_string_rd(doc, obj, "meta")
        .and_then(|s| serde_json::from_str(&s).ok())
        .unwrap_or_default();

    let _rev = read_bool_rd(doc, obj, "_rev");
    let _tags = read_string_rd(doc, obj, "_tags")
        .and_then(|s| serde_json::from_str(&s).ok());
    let _attachedTo = read_string_rd(doc, obj, "_attachedTo");
    let _attachmentType = read_string_rd(doc, obj, "_attachmentType");
    let _merged = read_bool_rd(doc, obj, "_merged");
    let _mergedInto = read_string_rd(doc, obj, "_mergedInto");
    let _mergedFrom = read_string_rd(doc, obj, "_mergedFrom")
        .and_then(|s| serde_json::from_str(&s).ok());
    let _mergedAt = read_i64_rd(doc, obj, "_mergedAt");
    let _split = read_bool_rd(doc, obj, "_split");
    let _splitInto = read_string_rd(doc, obj, "_splitInto")
        .and_then(|s| serde_json::from_str(&s).ok());
    let _splitFrom = read_string_rd(doc, obj, "_splitFrom");
    let _splitIndex = read_i64_rd(doc, obj, "_splitIndex").map(|v| v as i32);
    let _splitAt = read_i64_rd(doc, obj, "_splitAt");

    IToken {
        id, label, group, text, meta, char, kind, index,
        _rev, _tags, _attachments: None, _attachedTo, _attachmentType,
        _merged, _mergedInto, _mergedFrom, _mergedAt,
        _split, _splitInto, _splitFrom, _splitIndex, _splitAt,
    }
}

/// Read a list of tokens from an Automerge list object
pub fn read_token_list_rd<D: ReadDoc>(doc: &D, list_id: &ObjId) -> Vec<IToken> {
    let len = doc.length(list_id);
    let mut tokens = Vec::with_capacity(len);
    for i in 0..len {
        if let Ok(Some((_, token_id))) = doc.get(list_id, i) {
            tokens.push(read_token_rd(doc, &token_id));
        }
    }
    tokens
}

/// Write an IToken to an Automerge map object (inside a transaction)
pub fn write_token_tx<T: Transactable>(tx: &mut T, obj: &ObjId, token: &IToken) -> std::result::Result<(), AutomergeError> {
    tx.put(obj, "id", token.id.as_str())?;
    if let Some(label) = &token.label {
        tx.put(obj, "label", label.as_str())?;
    }
    if let Some(group) = &token.group {
        tx.put(obj, "group", group.as_str())?;
    }
    tx.put(obj, "text", token.text.as_str())?;
    tx.put(obj, "char", token.char.as_str())?;
    tx.put(obj, "kind", token.kind.as_str())?;
    tx.put(obj, "index", token.index as i64)?;

    let meta_json = serde_json::to_string(&token.meta).unwrap_or_else(|_| "{}".to_string());
    tx.put(obj, "meta", meta_json.as_str())?;

    if let Some(rev) = token._rev { tx.put(obj, "_rev", rev)?; }
    if let Some(tags) = &token._tags {
        let j = serde_json::to_string(tags).unwrap_or_else(|_| "[]".to_string());
        tx.put(obj, "_tags", j.as_str())?;
    }
    if let Some(v) = &token._attachedTo { tx.put(obj, "_attachedTo", v.as_str())?; }
    if let Some(v) = &token._attachmentType { tx.put(obj, "_attachmentType", v.as_str())?; }
    if let Some(v) = token._merged { tx.put(obj, "_merged", v)?; }
    if let Some(v) = &token._mergedInto { tx.put(obj, "_mergedInto", v.as_str())?; }
    if let Some(v) = &token._mergedFrom {
        let j = serde_json::to_string(v).unwrap_or_else(|_| "[]".to_string());
        tx.put(obj, "_mergedFrom", j.as_str())?;
    }
    if let Some(v) = token._mergedAt { tx.put(obj, "_mergedAt", v)?; }
    if let Some(v) = token._split { tx.put(obj, "_split", v)?; }
    if let Some(v) = &token._splitInto {
        let j = serde_json::to_string(v).unwrap_or_else(|_| "[]".to_string());
        tx.put(obj, "_splitInto", j.as_str())?;
    }
    if let Some(v) = &token._splitFrom { tx.put(obj, "_splitFrom", v.as_str())?; }
    if let Some(v) = token._splitIndex { tx.put(obj, "_splitIndex", v as i64)?; }
    if let Some(v) = token._splitAt { tx.put(obj, "_splitAt", v)?; }

    Ok(())
}

/// Write a placement to an Automerge map object (inside a transaction)
pub fn write_placement_tx<T: Transactable>(tx: &mut T, obj: &ObjId, p: &IPlacementCRDT) -> std::result::Result<(), AutomergeError> {
    tx.put(obj, "id", p.id.as_str())?;
    tx.put(obj, "tokenId", p.tokenId.as_str())?;

    let snapshot_obj = tx.put_object(obj, "tokenSnapshot", ObjType::Map)?;
    write_token_tx(tx, &snapshot_obj, &p.tokenSnapshot)?;

    if let Some(x) = p.x { tx.put(obj, "x", x)?; }
    if let Some(y) = p.y { tx.put(obj, "y", y)?; }
    tx.put(obj, "faceUp", p.faceUp)?;
    if let Some(label) = &p.label { tx.put(obj, "label", label.as_str())?; }
    tx.put(obj, "ts", p.ts)?;
    tx.put(obj, "reversed", p.reversed)?;

    let tags_json = serde_json::to_string(&p.tags).unwrap_or_else(|_| "[]".to_string());
    tx.put(obj, "tags", tags_json.as_str())?;

    Ok(())
}

/// Read a placement from an Automerge map object
pub fn read_placement_rd<D: ReadDoc>(doc: &D, obj: &ObjId) -> IPlacementCRDT {
    let id = read_string_rd(doc, obj, "id").unwrap_or_default();
    let token_id = read_string_rd(doc, obj, "tokenId").unwrap_or_default();

    let token_snapshot = if let Ok(Some((_, snap_id))) = doc.get(obj, "tokenSnapshot") {
        read_token_rd(doc, &snap_id)
    } else {
        IToken {
            id: String::new(), label: None, group: None, text: String::new(),
            meta: HashMap::new(), char: "□".to_string(), kind: "default".to_string(),
            index: 0, _rev: None, _tags: None, _attachments: None,
            _attachedTo: None, _attachmentType: None, _merged: None,
            _mergedInto: None, _mergedFrom: None, _mergedAt: None,
            _split: None, _splitInto: None, _splitFrom: None,
            _splitIndex: None, _splitAt: None,
        }
    };

    let x = read_f64_rd(doc, obj, "x");
    let y = read_f64_rd(doc, obj, "y");
    let face_up = read_bool_rd(doc, obj, "faceUp").unwrap_or(true);
    let label = read_string_rd(doc, obj, "label");
    let ts = read_i64_rd(doc, obj, "ts").unwrap_or(0);
    let reversed = read_bool_rd(doc, obj, "reversed").unwrap_or(false);
    let tags: Vec<String> = read_string_rd(doc, obj, "tags")
        .and_then(|s| serde_json::from_str(&s).ok())
        .unwrap_or_default();

    IPlacementCRDT {
        id, tokenId: token_id, tokenSnapshot: token_snapshot,
        x, y, faceUp: face_up, label, ts, reversed, tags,
    }
}
```

- [ ] **Step 3: Add module declaration to lib.rs**

In `core-rs/src/lib.rs`, after line 40 (`mod batch;`), add:
```rust
mod chronicle_actions;
```

- [ ] **Step 4: Create placeholder files for action modules**

Create empty files with module-level comments for each action submodule. Each file will be populated in Phase 2:

```rust
// core-rs/src/chronicle_actions/stack.rs
// Stack action methods for Chronicle (Phase 2)
use crate::chronicle::Chronicle;
```

(Same pattern for `space.rs`, `source.rs`, `agent.rs`, `game_loop.rs`, `game_state.rs`, `rules.rs`)

- [ ] **Step 5: Run cargo check to verify the module compiles**

Run: `cd /Users/sibyl/dev/hypertoken/core-rs && cargo check --target $(rustc -vV | grep host | cut -d' ' -f2)`
Expected: Compiles with no errors (may have unused warnings, that's fine)

- [ ] **Step 6: Commit**

```bash
git add core-rs/src/chronicle_actions/ core-rs/src/lib.rs
git commit -m "feat(chronicle): add chronicle_actions module with transaction helpers"
```

---

## Chunk 2: Phase 2 — Action Methods (Stack, Space, Source)

### Task 6: Implement stack action methods

**Files:**
- Modify: `core-rs/src/chronicle_actions/stack.rs`
- Test: inline `#[cfg(test)]` module

**Methods:** `stack_draw`, `stack_shuffle`, `stack_burn`, `stack_cut`, `stack_reset`, `stack_discard`, `stack_insert_at`, `stack_remove_at`, `stack_swap`, `stack_reverse`

- [ ] **Step 1: Write tests for stack_draw and stack_shuffle**

```rust
// In core-rs/src/chronicle_actions/stack.rs
#[cfg(test)]
mod tests {
    use crate::chronicle::Chronicle;
    use crate::types::{HyperTokenState, IStackState};

    fn init_stack_chronicle() -> Chronicle {
        let mut c = Chronicle::new();
        c.set_state(r#"{"stack":{"stack":[
            {"id":"t1","text":"A","char":"A","kind":"card","index":0,"meta":{}},
            {"id":"t2","text":"B","char":"B","kind":"card","index":1,"meta":{}},
            {"id":"t3","text":"C","char":"C","kind":"card","index":2,"meta":{}},
            {"id":"t4","text":"D","char":"D","kind":"card","index":3,"meta":{}},
            {"id":"t5","text":"E","char":"E","kind":"card","index":4,"meta":{}}
        ],"drawn":[],"discards":[]}}"#).unwrap();
        c.resolve_section_ids();
        c.dirty.clear();
        c
    }

    #[test]
    fn test_stack_draw() {
        let mut c = init_stack_chronicle();
        let drawn_json = c.stack_draw(2).unwrap();
        let drawn: Vec<serde_json::Value> = serde_json::from_str(&drawn_json).unwrap();
        assert_eq!(drawn.len(), 2);

        // Verify state: 3 in stack, 2 in drawn
        let state_json = c.get_state().unwrap();
        let state: HyperTokenState = serde_json::from_str(&state_json).unwrap();
        let stack = state.stack.unwrap();
        assert_eq!(stack.stack.len(), 3);
        assert_eq!(stack.drawn.len(), 2);

        // Only stack should be dirty
        assert!(c.dirty.stack);
        assert!(!c.dirty.zones);
    }

    #[test]
    fn test_stack_shuffle() {
        let mut c = init_stack_chronicle();
        c.stack_shuffle(Some("42".to_string())).unwrap();

        let state_json = c.get_state().unwrap();
        let state: HyperTokenState = serde_json::from_str(&state_json).unwrap();
        let stack = state.stack.unwrap();
        assert_eq!(stack.stack.len(), 5); // same count, different order
        assert!(c.dirty.stack);
    }

    #[test]
    fn test_stack_burn() {
        let mut c = init_stack_chronicle();
        let burned_json = c.stack_burn(1).unwrap();
        let burned: Vec<serde_json::Value> = serde_json::from_str(&burned_json).unwrap();
        assert_eq!(burned.len(), 1);

        let state_json = c.get_state().unwrap();
        let state: HyperTokenState = serde_json::from_str(&state_json).unwrap();
        let stack = state.stack.unwrap();
        assert_eq!(stack.stack.len(), 4);
        assert_eq!(stack.discards.len(), 1);
    }

    #[test]
    fn test_stack_reset() {
        let mut c = init_stack_chronicle();
        c.stack_draw(2).unwrap();
        c.stack_burn(1).unwrap();
        c.dirty.clear();

        c.stack_reset().unwrap();

        let state_json = c.get_state().unwrap();
        let state: HyperTokenState = serde_json::from_str(&state_json).unwrap();
        let stack = state.stack.unwrap();
        assert_eq!(stack.stack.len(), 5);
        assert_eq!(stack.drawn.len(), 0);
        assert_eq!(stack.discards.len(), 0);
        assert!(c.dirty.stack);
    }
}
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd /Users/sibyl/dev/hypertoken/core-rs && cargo test --target $(rustc -vV | grep host | cut -d' ' -f2) -- chronicle_actions::stack`
Expected: FAIL — methods do not exist

- [ ] **Step 3: Implement all 10 stack action methods**

Each method follows the pattern from the spec: clone ObjId, transact, set dirty. The implementation uses helpers from `chronicle_actions/helpers.rs`.

```rust
// core-rs/src/chronicle_actions/stack.rs
use automerge::{AutomergeError, ObjType, ReadDoc, transaction::Transactable};
use crate::chronicle::Chronicle;
use crate::chronicle_actions::helpers::*;
use crate::types::{HyperTokenError, IToken, Result};
use crate::utils::shuffle_vec;

impl Chronicle {
    /// Draw N tokens from the stack into the drawn pile
    pub fn stack_draw(&mut self, count: usize) -> Result<String> {
        let stack_id = self.stack_id.clone()
            .ok_or(HyperTokenError::InvalidOperation("No stack initialized".into()))?;
        let mut drawn_tokens: Vec<IToken> = Vec::new();

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
                            let token = read_token_rd(tx, &token_obj);
                            tx.delete(&stack_arr, idx)?;

                            let new_idx = tx.length(&drawn_arr);
                            let new_obj = tx.insert_object(&drawn_arr, new_idx, ObjType::Map)?;
                            write_token_tx(tx, &new_obj, &token)?;
                            drawn_tokens.push(token);
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

    /// Shuffle the stack with optional deterministic seed
    pub fn stack_shuffle(&mut self, seed: Option<String>) -> Result<()> {
        let stack_id = self.stack_id.clone()
            .ok_or(HyperTokenError::InvalidOperation("No stack initialized".into()))?;

        // Read all tokens, shuffle in memory, write back
        let mut tokens: Vec<IToken> = Vec::new();
        if let Ok(Some((_, stack_arr))) = self.doc.get(&stack_id, "stack") {
            tokens = read_token_list_rd(&self.doc, &stack_arr);
        }

        shuffle_vec(&mut tokens, seed.as_deref());

        self.doc.transact::<_, _, AutomergeError>(|tx| {
            if let Ok(Some((_, stack_arr))) = tx.get(&stack_id, "stack") {
                // Clear existing list
                let len = tx.length(&stack_arr);
                for i in (0..len).rev() {
                    tx.delete(&stack_arr, i)?;
                }
                // Write shuffled tokens
                for (i, token) in tokens.iter().enumerate() {
                    let obj = tx.insert_object(&stack_arr, i, ObjType::Map)?;
                    write_token_tx(tx, &obj, token)?;
                }
            }
            Ok(())
        }).map_err(|e| HyperTokenError::CrdtError(format!("Transaction failed: {:?}", e)))?;

        self.dirty.stack = true;
        Ok(())
    }

    /// Burn N tokens from the stack into the discards pile
    pub fn stack_burn(&mut self, count: usize) -> Result<String> {
        let stack_id = self.stack_id.clone()
            .ok_or(HyperTokenError::InvalidOperation("No stack initialized".into()))?;
        let mut burned: Vec<IToken> = Vec::new();

        self.doc.transact::<_, _, AutomergeError>(|tx| {
            if let Ok(Some((_, stack_arr))) = tx.get(&stack_id, "stack") {
                if let Ok(Some((_, discards_arr))) = tx.get(&stack_id, "discards") {
                    let len = tx.length(&stack_arr);
                    let to_burn = count.min(len);
                    for _ in 0..to_burn {
                        let current_len = tx.length(&stack_arr);
                        if current_len == 0 { break; }
                        let idx = current_len - 1;
                        if let Ok(Some((_, token_obj))) = tx.get(&stack_arr, idx) {
                            let token = read_token_rd(tx, &token_obj);
                            tx.delete(&stack_arr, idx)?;
                            let new_idx = tx.length(&discards_arr);
                            let new_obj = tx.insert_object(&discards_arr, new_idx, ObjType::Map)?;
                            write_token_tx(tx, &new_obj, &token)?;
                            burned.push(token);
                        }
                    }
                }
            }
            Ok(())
        }).map_err(|e| HyperTokenError::CrdtError(format!("Transaction failed: {:?}", e)))?;

        self.dirty.stack = true;
        serde_json::to_string(&burned)
            .map_err(|e| HyperTokenError::SerializationError(e.to_string()))
    }

    /// Cut the stack at the given index (move bottom portion to top)
    pub fn stack_cut(&mut self, index: usize) -> Result<()> {
        let stack_id = self.stack_id.clone()
            .ok_or(HyperTokenError::InvalidOperation("No stack initialized".into()))?;

        let mut tokens: Vec<IToken> = Vec::new();
        if let Ok(Some((_, stack_arr))) = self.doc.get(&stack_id, "stack") {
            tokens = read_token_list_rd(&self.doc, &stack_arr);
        }
        if index >= tokens.len() {
            return Err(HyperTokenError::IndexOutOfBounds(index));
        }
        // Rotate: [0..index] goes to end, [index..] goes to front
        tokens.rotate_left(index);

        self.doc.transact::<_, _, AutomergeError>(|tx| {
            if let Ok(Some((_, stack_arr))) = tx.get(&stack_id, "stack") {
                let len = tx.length(&stack_arr);
                for i in (0..len).rev() { tx.delete(&stack_arr, i)?; }
                for (i, token) in tokens.iter().enumerate() {
                    let obj = tx.insert_object(&stack_arr, i, ObjType::Map)?;
                    write_token_tx(tx, &obj, token)?;
                }
            }
            Ok(())
        }).map_err(|e| HyperTokenError::CrdtError(format!("Transaction failed: {:?}", e)))?;

        self.dirty.stack = true;
        Ok(())
    }

    /// Reset stack: recombine drawn + discards, sort by index
    pub fn stack_reset(&mut self) -> Result<()> {
        let stack_id = self.stack_id.clone()
            .ok_or(HyperTokenError::InvalidOperation("No stack initialized".into()))?;

        let mut all_tokens: Vec<IToken> = Vec::new();
        if let Ok(Some((_, stack_arr))) = self.doc.get(&stack_id, "stack") {
            all_tokens.extend(read_token_list_rd(&self.doc, &stack_arr));
        }
        if let Ok(Some((_, drawn_arr))) = self.doc.get(&stack_id, "drawn") {
            all_tokens.extend(read_token_list_rd(&self.doc, &drawn_arr));
        }
        if let Ok(Some((_, disc_arr))) = self.doc.get(&stack_id, "discards") {
            all_tokens.extend(read_token_list_rd(&self.doc, &disc_arr));
        }
        all_tokens.sort_by_key(|t| t.index);

        self.doc.transact::<_, _, AutomergeError>(|tx| {
            // Rewrite stack list
            if let Ok(Some((_, stack_arr))) = tx.get(&stack_id, "stack") {
                let len = tx.length(&stack_arr);
                for i in (0..len).rev() { tx.delete(&stack_arr, i)?; }
                for (i, token) in all_tokens.iter().enumerate() {
                    let obj = tx.insert_object(&stack_arr, i, ObjType::Map)?;
                    write_token_tx(tx, &obj, token)?;
                }
            }
            // Clear drawn
            if let Ok(Some((_, drawn_arr))) = tx.get(&stack_id, "drawn") {
                let len = tx.length(&drawn_arr);
                for i in (0..len).rev() { tx.delete(&drawn_arr, i)?; }
            }
            // Clear discards
            if let Ok(Some((_, disc_arr))) = tx.get(&stack_id, "discards") {
                let len = tx.length(&disc_arr);
                for i in (0..len).rev() { tx.delete(&disc_arr, i)?; }
            }
            Ok(())
        }).map_err(|e| HyperTokenError::CrdtError(format!("Transaction failed: {:?}", e)))?;

        self.dirty.stack = true;
        Ok(())
    }

    /// Discard a specific token by moving it from drawn to discards
    pub fn stack_discard(&mut self, token_id: &str) -> Result<String> {
        let stack_id = self.stack_id.clone()
            .ok_or(HyperTokenError::InvalidOperation("No stack initialized".into()))?;
        let token_id_owned = token_id.to_string();
        let mut discarded: Option<IToken> = None;

        self.doc.transact::<_, _, AutomergeError>(|tx| {
            if let Ok(Some((_, drawn_arr))) = tx.get(&stack_id, "drawn") {
                let len = tx.length(&drawn_arr);
                for i in 0..len {
                    if let Ok(Some((_, token_obj))) = tx.get(&drawn_arr, i) {
                        let token = read_token_rd(tx, &token_obj);
                        if token.id == token_id_owned {
                            tx.delete(&drawn_arr, i)?;
                            if let Ok(Some((_, disc_arr))) = tx.get(&stack_id, "discards") {
                                let disc_idx = tx.length(&disc_arr);
                                let new_obj = tx.insert_object(&disc_arr, disc_idx, ObjType::Map)?;
                                write_token_tx(tx, &new_obj, &token)?;
                            }
                            discarded = Some(token);
                            break;
                        }
                    }
                }
            }
            Ok(())
        }).map_err(|e| HyperTokenError::CrdtError(format!("Transaction failed: {:?}", e)))?;

        self.dirty.stack = true;
        match discarded {
            Some(token) => serde_json::to_string(&token)
                .map_err(|e| HyperTokenError::SerializationError(e.to_string())),
            None => Err(HyperTokenError::TokenNotFound(token_id.to_string())),
        }
    }

    /// Insert a token at a specific index in the stack
    pub fn stack_insert_at(&mut self, index: usize, token_json: &str) -> Result<()> {
        let stack_id = self.stack_id.clone()
            .ok_or(HyperTokenError::InvalidOperation("No stack initialized".into()))?;
        let token: IToken = serde_json::from_str(token_json)
            .map_err(|e| HyperTokenError::SerializationError(e.to_string()))?;

        self.doc.transact::<_, _, AutomergeError>(|tx| {
            if let Ok(Some((_, stack_arr))) = tx.get(&stack_id, "stack") {
                let obj = tx.insert_object(&stack_arr, index, ObjType::Map)?;
                write_token_tx(tx, &obj, &token)?;
            }
            Ok(())
        }).map_err(|e| HyperTokenError::CrdtError(format!("Transaction failed: {:?}", e)))?;

        self.dirty.stack = true;
        Ok(())
    }

    /// Remove a token at a specific index from the stack
    pub fn stack_remove_at(&mut self, index: usize) -> Result<String> {
        let stack_id = self.stack_id.clone()
            .ok_or(HyperTokenError::InvalidOperation("No stack initialized".into()))?;
        let mut removed: Option<IToken> = None;

        self.doc.transact::<_, _, AutomergeError>(|tx| {
            if let Ok(Some((_, stack_arr))) = tx.get(&stack_id, "stack") {
                if let Ok(Some((_, token_obj))) = tx.get(&stack_arr, index) {
                    removed = Some(read_token_rd(tx, &token_obj));
                    tx.delete(&stack_arr, index)?;
                }
            }
            Ok(())
        }).map_err(|e| HyperTokenError::CrdtError(format!("Transaction failed: {:?}", e)))?;

        self.dirty.stack = true;
        match removed {
            Some(token) => serde_json::to_string(&token)
                .map_err(|e| HyperTokenError::SerializationError(e.to_string())),
            None => Err(HyperTokenError::IndexOutOfBounds(index)),
        }
    }

    /// Swap two tokens in the stack by index
    pub fn stack_swap(&mut self, index_a: usize, index_b: usize) -> Result<()> {
        let stack_id = self.stack_id.clone()
            .ok_or(HyperTokenError::InvalidOperation("No stack initialized".into()))?;

        // Read both tokens first
        let mut token_a: Option<IToken> = None;
        let mut token_b: Option<IToken> = None;
        if let Ok(Some((_, stack_arr))) = self.doc.get(&stack_id, "stack") {
            if let Ok(Some((_, obj_a))) = self.doc.get(&stack_arr, index_a) {
                token_a = Some(read_token_rd(&self.doc, &obj_a));
            }
            if let Ok(Some((_, obj_b))) = self.doc.get(&stack_arr, index_b) {
                token_b = Some(read_token_rd(&self.doc, &obj_b));
            }
        }

        let (ta, tb) = match (token_a, token_b) {
            (Some(a), Some(b)) => (a, b),
            _ => return Err(HyperTokenError::InvalidOperation("Swap indices out of bounds".into())),
        };

        self.doc.transact::<_, _, AutomergeError>(|tx| {
            if let Ok(Some((_, stack_arr))) = tx.get(&stack_id, "stack") {
                // Overwrite position a with token b
                if let Ok(Some((_, obj_a))) = tx.get(&stack_arr, index_a) {
                    write_token_tx(tx, &obj_a, &tb)?;
                }
                // Overwrite position b with token a
                if let Ok(Some((_, obj_b))) = tx.get(&stack_arr, index_b) {
                    write_token_tx(tx, &obj_b, &ta)?;
                }
            }
            Ok(())
        }).map_err(|e| HyperTokenError::CrdtError(format!("Transaction failed: {:?}", e)))?;

        self.dirty.stack = true;
        Ok(())
    }

    /// Reverse the order of tokens in the stack
    pub fn stack_reverse(&mut self) -> Result<()> {
        let stack_id = self.stack_id.clone()
            .ok_or(HyperTokenError::InvalidOperation("No stack initialized".into()))?;

        let mut tokens: Vec<IToken> = Vec::new();
        if let Ok(Some((_, stack_arr))) = self.doc.get(&stack_id, "stack") {
            tokens = read_token_list_rd(&self.doc, &stack_arr);
        }
        tokens.reverse();

        self.doc.transact::<_, _, AutomergeError>(|tx| {
            if let Ok(Some((_, stack_arr))) = tx.get(&stack_id, "stack") {
                let len = tx.length(&stack_arr);
                for i in (0..len).rev() { tx.delete(&stack_arr, i)?; }
                for (i, token) in tokens.iter().enumerate() {
                    let obj = tx.insert_object(&stack_arr, i, ObjType::Map)?;
                    write_token_tx(tx, &obj, token)?;
                }
            }
            Ok(())
        }).map_err(|e| HyperTokenError::CrdtError(format!("Transaction failed: {:?}", e)))?;

        self.dirty.stack = true;
        Ok(())
    }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd /Users/sibyl/dev/hypertoken/core-rs && cargo test --target $(rustc -vV | grep host | cut -d' ' -f2) -- chronicle_actions::stack`
Expected: All PASS

- [ ] **Step 5: Run full test suite to check for regressions**

Run: `cd /Users/sibyl/dev/hypertoken/core-rs && cargo test --target $(rustc -vV | grep host | cut -d' ' -f2)`
Expected: All tests PASS

- [ ] **Step 6: Commit**

```bash
git add core-rs/src/chronicle_actions/stack.rs
git commit -m "feat(chronicle): implement 10 incremental stack action methods"
```

---

### Task 7: Implement space action methods

**Files:**
- Modify: `core-rs/src/chronicle_actions/space.rs`

**Methods:** `space_place`, `space_move`, `space_remove`, `space_flip`, `space_create_zone`, `space_delete_zone`, `space_clear_zone`, `space_lock_zone`, `space_shuffle_zone`, `space_transfer_zone`, `space_clear`

- [ ] **Step 1: Write tests for key space methods**

```rust
#[cfg(test)]
mod tests {
    use crate::chronicle::Chronicle;
    use crate::types::HyperTokenState;

    fn init_space_chronicle() -> Chronicle {
        let mut c = Chronicle::new();
        c.set_state(r#"{"zones":{"hand":[],"table":[]}}"#).unwrap();
        c.resolve_section_ids();
        c.dirty.clear();
        c
    }

    #[test]
    fn test_space_place() {
        let mut c = init_space_chronicle();
        let token_json = r#"{"id":"t1","text":"A","char":"A","kind":"card","index":0,"meta":{}}"#;
        let result = c.space_place("hand", token_json, Some(10.0), Some(20.0)).unwrap();
        let placement: serde_json::Value = serde_json::from_str(&result).unwrap();
        assert_eq!(placement["tokenId"], "t1");
        assert!(c.dirty.zones);
    }

    #[test]
    fn test_space_create_zone() {
        let mut c = init_space_chronicle();
        c.space_create_zone("discard_pile").unwrap();
        let state_json = c.get_state().unwrap();
        let state: HyperTokenState = serde_json::from_str(&state_json).unwrap();
        assert!(state.zones.unwrap().contains_key("discard_pile"));
        assert!(c.dirty.zones);
    }
}
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd /Users/sibyl/dev/hypertoken/core-rs && cargo test --target $(rustc -vV | grep host | cut -d' ' -f2) -- chronicle_actions::space`
Expected: FAIL

- [ ] **Step 3: Implement all 11 space action methods**

Follow the same pattern as stack: clone ObjId, transact, set dirty. Use `crate::utils::generate_id()` for placement IDs. Use `helpers::write_placement_tx` and `helpers::read_placement_rd`. Each method:
- `space_place` — Create placement with UUID, write to zone list, return placement JSON
- `space_move` — Remove from source zone, add to target zone
- `space_remove` — Find by placement ID in zone, delete
- `space_flip` — Find placement, toggle `reversed` and `faceUp` fields
- `space_create_zone` — Insert new empty list in zones map
- `space_delete_zone` — Delete key from zones map
- `space_clear_zone` — Delete all elements from zone list
- `space_lock_zone` — Store lock state as a `_lock:<zone_name>` boolean key within the `zones` map (since zones are `Map { zone_name: List[Placement] }`, we can add scalar keys alongside list keys without conflict). Pattern: `tx.put(&zones_id, format!("_lock:{}", zone_name), locked)`. This avoids adding a new ROOT-level section. The `read_zones` method already filters by type — it only reads List entries, so the boolean `_lock:*` keys are ignored during zone reads.
- `space_shuffle_zone` — Read placements, shuffle, write back
- `space_transfer_zone` — Move all placements from one zone to another
- `space_clear` — Delete all zones and recreate empty zones map

- [ ] **Step 4: Run tests**

Run: `cd /Users/sibyl/dev/hypertoken/core-rs && cargo test --target $(rustc -vV | grep host | cut -d' ' -f2) -- chronicle_actions::space`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add core-rs/src/chronicle_actions/space.rs
git commit -m "feat(chronicle): implement 11 incremental space action methods"
```

---

### Task 8: Implement source action methods

**Files:**
- Modify: `core-rs/src/chronicle_actions/source.rs`

**Methods:** `source_draw`, `source_shuffle`, `source_burn`, `source_add_stack`, `source_remove_stack`, `source_reset`, `source_set_reshuffle_policy`

- [ ] **Step 1: Write tests**

```rust
#[cfg(test)]
mod tests {
    use crate::chronicle::Chronicle;
    use crate::types::HyperTokenState;

    fn init_source_chronicle() -> Chronicle {
        let mut c = Chronicle::new();
        c.set_state(r#"{"source":{"stackIds":["s1"],"tokens":[
            {"id":"t1","text":"","char":"□","kind":"default","index":0,"meta":{}},
            {"id":"t2","text":"","char":"□","kind":"default","index":1,"meta":{}},
            {"id":"t3","text":"","char":"□","kind":"default","index":2,"meta":{}}
        ],"burned":[],"seed":null,"reshufflePolicy":{"mode":"auto"}}}"#).unwrap();
        c.resolve_section_ids();
        c.dirty.clear();
        c
    }

    #[test]
    fn test_source_draw() {
        let mut c = init_source_chronicle();
        let drawn_json = c.source_draw(2).unwrap();
        let drawn: Vec<serde_json::Value> = serde_json::from_str(&drawn_json).unwrap();
        assert_eq!(drawn.len(), 2);
        assert!(c.dirty.source);
    }
}
```

- [ ] **Step 2: Run tests to verify they fail, implement, verify pass**

Same TDD cycle. Follow the stack pattern — each method reads from source section, transacts, sets `dirty.source = true`.

- [ ] **Step 3: Commit**

```bash
git add core-rs/src/chronicle_actions/source.rs
git commit -m "feat(chronicle): implement 7 incremental source action methods"
```

---

## Chunk 3: Phase 2 continued — Agent, GameLoop, GameState, Rules

### Task 9: Implement agent action methods

**Files:**
- Modify: `core-rs/src/chronicle_actions/agent.rs`

**Methods (14):** `agent_create`, `agent_remove`, `agent_set_active`, `agent_give_resource`, `agent_take_resource`, `agent_add_token`, `agent_remove_token`, `agent_transfer_resource`, `agent_transfer_token`, `agent_steal_resource`, `agent_steal_token`, `agent_draw_cards`, `agent_discard_cards`, `agent_trade`

- [ ] **Step 1: Write tests for core agent methods**

```rust
#[cfg(test)]
mod tests {
    use crate::chronicle::Chronicle;

    fn init_agent_chronicle() -> Chronicle {
        let mut c = Chronicle::new();
        c.set_state(r#"{"agents":{},"stack":{"stack":[
            {"id":"t1","text":"","char":"□","kind":"default","index":0,"meta":{}},
            {"id":"t2","text":"","char":"□","kind":"default","index":1,"meta":{}}
        ],"drawn":[],"discards":[]}}"#).unwrap();
        c.resolve_section_ids();
        c.dirty.clear();
        c
    }

    #[test]
    fn test_agent_create() {
        let mut c = init_agent_chronicle();
        c.agent_create("p1", "Player 1", None).unwrap();
        assert!(c.dirty.agents);

        let agents_json = c.export_agents().unwrap();
        let agents: serde_json::Value = serde_json::from_str(&agents_json).unwrap();
        assert!(agents["p1"].is_object());
    }

    #[test]
    fn test_agent_draw_cards() {
        let mut c = init_agent_chronicle();
        c.agent_create("p1", "Player 1", None).unwrap();
        c.dirty.clear();

        c.agent_draw_cards("p1", 1).unwrap();
        assert!(c.dirty.stack);
        assert!(c.dirty.agents);
    }
}
```

- [ ] **Step 2: Implement all 14 agent methods**

Agent data in Automerge is stored as **structured nested maps**, not JSON strings. This is critical for CRDT merge semantics — if two peers modify different fields of the same agent (e.g., one changes resources, another changes inventory), Automerge merges them correctly. JSON strings would be opaque scalars that last-writer-wins.

Per the document schema: `agents: Map { name: Map { id, name, active, resources: Map, inventory: List[Token], meta: Map } }`

Key pattern for agents:
```rust
pub fn agent_create(&mut self, id: &str, name: &str, meta_json: Option<&str>) -> Result<String> {
    let agents_id = self.agents_id.clone()
        .ok_or(HyperTokenError::InvalidOperation("No agents initialized".into()))?;
    let id_owned = id.to_string();
    let name_owned = name.to_string();

    self.doc.transact::<_, _, AutomergeError>(|tx| {
        // Create a Map for this agent under agents_id
        let agent_obj = tx.put_object(&agents_id, name_owned.as_str(), ObjType::Map)?;
        tx.put(&agent_obj, "id", id_owned.as_str())?;
        tx.put(&agent_obj, "name", name_owned.as_str())?;
        tx.put(&agent_obj, "active", true)?;

        // Create nested structures
        tx.put_object(&agent_obj, "resources", ObjType::Map)?;
        tx.put_object(&agent_obj, "inventory", ObjType::List)?;
        tx.put_object(&agent_obj, "meta", ObjType::Map)?;

        Ok(())
    }).map_err(|e| HyperTokenError::CrdtError(format!("Transaction failed: {:?}", e)))?;

    self.dirty.agents = true;
    Ok(serde_json::json!({"id": id, "name": name, "active": true, "resources": {}, "inventory": [], "meta": {}}).to_string())
}

// agent_give_resource — increments a resource field within the agent's resources map
pub fn agent_give_resource(&mut self, agent_name: &str, resource: &str, amount: f64) -> Result<()> {
    let agents_id = self.agents_id.clone()
        .ok_or(HyperTokenError::InvalidOperation("No agents initialized".into()))?;
    let name_owned = agent_name.to_string();
    let res_owned = resource.to_string();

    self.doc.transact::<_, _, AutomergeError>(|tx| {
        if let Ok(Some((_, agent_obj))) = tx.get(&agents_id, name_owned.as_str()) {
            if let Ok(Some((_, resources_obj))) = tx.get(&agent_obj, "resources") {
                let current = read_f64_rd(tx, &resources_obj, res_owned.as_str()).unwrap_or(0.0);
                tx.put(&resources_obj, res_owned.as_str(), current + amount)?;
            }
        }
        Ok(())
    }).map_err(|e| HyperTokenError::CrdtError(format!("Transaction failed: {:?}", e)))?;

    self.dirty.agents = true;
    Ok(())
}

// agent_add_token — appends a token to the agent's inventory list
pub fn agent_add_token(&mut self, agent_name: &str, token_json: &str) -> Result<()> {
    let agents_id = self.agents_id.clone()
        .ok_or(HyperTokenError::InvalidOperation("No agents initialized".into()))?;
    let name_owned = agent_name.to_string();
    let token: IToken = serde_json::from_str(token_json)
        .map_err(|e| HyperTokenError::SerializationError(e.to_string()))?;

    self.doc.transact::<_, _, AutomergeError>(|tx| {
        if let Ok(Some((_, agent_obj))) = tx.get(&agents_id, name_owned.as_str()) {
            if let Ok(Some((_, inventory_arr))) = tx.get(&agent_obj, "inventory") {
                let idx = tx.length(&inventory_arr);
                let token_obj = tx.insert_object(&inventory_arr, idx, ObjType::Map)?;
                write_token_tx(tx, &token_obj, &token)?;
            }
        }
        Ok(())
    }).map_err(|e| HyperTokenError::CrdtError(format!("Transaction failed: {:?}", e)))?;

    self.dirty.agents = true;
    Ok(())
}
```

Compound operation — `agent_draw_cards` (touches both stack and agents sections):
```rust
pub fn agent_draw_cards(&mut self, agent_name: &str, count: usize) -> Result<String> {
    let stack_id = self.stack_id.clone()
        .ok_or(HyperTokenError::InvalidOperation("No stack initialized".into()))?;
    let agents_id = self.agents_id.clone()
        .ok_or(HyperTokenError::InvalidOperation("No agents initialized".into()))?;
    let name_owned = agent_name.to_string();
    let mut drawn_count = 0usize;

    self.doc.transact::<_, _, AutomergeError>(|tx| {
        if let Ok(Some((_, stack_arr))) = tx.get(&stack_id, "stack") {
            if let Ok(Some((_, agent_obj))) = tx.get(&agents_id, name_owned.as_str()) {
                if let Ok(Some((_, inventory_arr))) = tx.get(&agent_obj, "inventory") {
                    let len = tx.length(&stack_arr);
                    let to_draw = count.min(len);

                    for _ in 0..to_draw {
                        let current_len = tx.length(&stack_arr);
                        if current_len == 0 { break; }
                        let idx = current_len - 1;

                        if let Ok(Some((_, token_obj))) = tx.get(&stack_arr, idx) {
                            let token = read_token_rd(tx, &token_obj);
                            tx.delete(&stack_arr, idx)?;

                            let inv_idx = tx.length(&inventory_arr);
                            let new_obj = tx.insert_object(&inventory_arr, inv_idx, ObjType::Map)?;
                            write_token_tx(tx, &new_obj, &token)?;
                            drawn_count += 1;
                        }
                    }
                }
            }
        }
        Ok(())
    }).map_err(|e| HyperTokenError::CrdtError(format!("Transaction failed: {:?}", e)))?;

    self.dirty.stack = true;
    self.dirty.agents = true;
    Ok(serde_json::json!({ "drawn": drawn_count }).to_string())
}
```

All 14 agent methods follow this pattern — navigating the structured Automerge maps (`agent_obj` → `resources`/`inventory`/`meta`) rather than serializing to JSON strings.

- [ ] **Step 3: Update `read_agents` and `export_agents` to handle structured maps**

**CRITICAL:** The existing `read_agents` method (chronicle.rs line 860-873) reads agent data as JSON string scalars via `self.read_string()`. After this task, agents are stored as nested Automerge Maps. `read_string()` on a Map object returns `None`, so `export_agents()` and `get_state()` would silently lose all agent data.

Update `read_agents` to traverse the structured Map:
```rust
fn read_agents(&self, agents_id: &ObjId) -> Result<HashMap<String, serde_json::Value>> {
    let mut agents = HashMap::new();
    for item in self.doc.map_range(agents_id, ..) {
        let key = item.key.to_string();
        // Each agent is a Map with id, name, active, resources, inventory, meta
        if let Ok(Some((Value::Object(ObjType::Map), agent_obj))) = self.doc.get(agents_id, key.as_str()) {
            let mut agent = serde_json::Map::new();
            // Read scalar fields
            if let Some(v) = self.read_string(&agent_obj, "id")? { agent.insert("id".into(), v.into()); }
            if let Some(v) = self.read_string(&agent_obj, "name")? { agent.insert("name".into(), v.into()); }
            if let Some(v) = self.read_bool(&agent_obj, "active")? { agent.insert("active".into(), v.into()); }
            // Read resources map
            if let Ok(Some((_, res_obj))) = self.doc.get(&agent_obj, "resources") {
                let mut resources = serde_json::Map::new();
                for res_item in self.doc.map_range(&res_obj, ..) {
                    let res_key = res_item.key.to_string();
                    if let Some(v) = self.read_f64(&res_obj, &res_key)? { resources.insert(res_key, v.into()); }
                }
                agent.insert("resources".into(), resources.into());
            }
            // Read inventory list
            if let Ok(Some((_, inv_obj))) = self.doc.get(&agent_obj, "inventory") {
                let tokens = read_token_list_rd(&self.doc, &inv_obj);
                agent.insert("inventory".into(), serde_json::to_value(&tokens).unwrap_or_default());
            }
            // Read meta map
            if let Ok(Some((_, meta_obj))) = self.doc.get(&agent_obj, "meta") {
                let mut meta = serde_json::Map::new();
                for meta_item in self.doc.map_range(&meta_obj, ..) {
                    let meta_key = meta_item.key.to_string();
                    if let Some(v) = self.read_string(&meta_obj, &meta_key)? { meta.insert(meta_key, v.into()); }
                }
                agent.insert("meta".into(), meta.into());
            }
            agents.insert(key, serde_json::Value::Object(agent));
        } else if let Some(json_str) = self.read_string(agents_id, key.as_str())? {
            // Legacy: support reading JSON string scalars from old state
            if let Ok(val) = serde_json::from_str::<serde_json::Value>(&json_str) {
                agents.insert(key, val);
            }
        }
    }
    Ok(agents)
}
```

Also update `write_agents_tx` in `write_state_to_doc` to write structured maps (matching the new format) so that `set_state_full()` and `agent_create()` produce compatible data. This is important for round-trip consistency.

- [ ] **Step 4: Run tests, verify pass**

Run: `cd /Users/sibyl/dev/hypertoken/core-rs && cargo test --target $(rustc -vV | grep host | cut -d' ' -f2) -- chronicle_actions::agent`
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add core-rs/src/chronicle_actions/agent.rs
git commit -m "feat(chronicle): implement 14 incremental agent action methods"
```

---

### Task 10: Implement game_loop action methods

**Files:**
- Modify: `core-rs/src/chronicle_actions/game_loop.rs`

**Methods (5):** `game_loop_init`, `game_loop_start`, `game_loop_stop`, `game_loop_next_turn`, `game_loop_set_phase`

- [ ] **Step 1: Write tests**

```rust
#[cfg(test)]
mod tests {
    use crate::chronicle::Chronicle;
    use crate::types::{HyperTokenState, IGameLoopState};

    #[test]
    fn test_game_loop_start() {
        let mut c = Chronicle::new();
        c.set_state(r#"{"gameLoop":{"turn":0,"running":false,"activeAgentIndex":-1,"phase":"setup","maxTurns":10}}"#).unwrap();
        c.resolve_section_ids();
        c.dirty.clear();

        c.game_loop_start().unwrap();

        let state_json = c.get_state().unwrap();
        let state: HyperTokenState = serde_json::from_str(&state_json).unwrap();
        let gl = state.gameLoop.unwrap();
        assert!(gl.running);
        assert_eq!(gl.turn, 0);
        assert_eq!(gl.phase, "play");
        assert_eq!(gl.activeAgentIndex, 0);
        assert!(c.dirty.game_loop);
    }

    #[test]
    fn test_game_loop_next_turn() {
        let mut c = Chronicle::new();
        c.set_state(r#"{"gameLoop":{"turn":0,"running":true,"activeAgentIndex":0,"phase":"play","maxTurns":10}}"#).unwrap();
        c.resolve_section_ids();
        c.dirty.clear();

        c.game_loop_next_turn(3).unwrap(); // 3 agents

        let state_json = c.get_state().unwrap();
        let state: HyperTokenState = serde_json::from_str(&state_json).unwrap();
        let gl = state.gameLoop.unwrap();
        assert_eq!(gl.turn, 1);
        assert_eq!(gl.activeAgentIndex, 1);
    }
}
```

- [ ] **Step 2: Implement all 5 methods**

Each file needs the same import pattern as `stack.rs`:
```rust
use automerge::{AutomergeError, ObjType, ReadDoc, transaction::Transactable};
use crate::chronicle::Chronicle;
use crate::chronicle_actions::helpers::*;
use crate::types::{HyperTokenError, Result};
```

Each method transacts on the `gameLoop` map fields:

```rust
pub fn game_loop_start(&mut self) -> Result<()> {
    let gl_id = self.game_loop_id.clone()
        .ok_or(HyperTokenError::InvalidOperation("No gameLoop initialized".into()))?;

    self.doc.transact::<_, _, AutomergeError>(|tx| {
        tx.put(&gl_id, "running", true)?;
        tx.put(&gl_id, "turn", 0i64)?;
        tx.put(&gl_id, "phase", "play")?;
        tx.put(&gl_id, "activeAgentIndex", 0i64)?;
        Ok(())
    }).map_err(|e| HyperTokenError::CrdtError(format!("Transaction failed: {:?}", e)))?;

    self.dirty.game_loop = true;
    Ok(())
}

pub fn game_loop_next_turn(&mut self, agent_count: usize) -> Result<()> {
    let gl_id = self.game_loop_id.clone()
        .ok_or(HyperTokenError::InvalidOperation("No gameLoop initialized".into()))?;

    // Read current values before transaction
    let current_turn = read_i64_rd(&self.doc, &gl_id, "turn").unwrap_or(0);
    let current_agent = read_i64_rd(&self.doc, &gl_id, "activeAgentIndex").unwrap_or(0);

    let new_turn = current_turn + 1;
    let new_agent = if agent_count > 0 {
        (current_agent + 1) % agent_count as i64
    } else { 0 };

    self.doc.transact::<_, _, AutomergeError>(|tx| {
        tx.put(&gl_id, "turn", new_turn)?;
        tx.put(&gl_id, "activeAgentIndex", new_agent)?;
        Ok(())
    }).map_err(|e| HyperTokenError::CrdtError(format!("Transaction failed: {:?}", e)))?;

    self.dirty.game_loop = true;
    Ok(())
}
```

Remaining methods:

```rust
pub fn game_loop_init(&mut self, max_turns: i32) -> Result<()> {
    let gl_id = self.ensure_section("gameLoop")?;

    self.doc.transact::<_, _, AutomergeError>(|tx| {
        tx.put(&gl_id, "turn", 0i64)?;
        tx.put(&gl_id, "running", false)?;
        tx.put(&gl_id, "activeAgentIndex", -1i64)?;
        tx.put(&gl_id, "phase", "setup")?;
        tx.put(&gl_id, "maxTurns", max_turns as i64)?;
        Ok(())
    }).map_err(|e| HyperTokenError::CrdtError(format!("Transaction failed: {:?}", e)))?;

    self.dirty.game_loop = true;
    Ok(())
}

pub fn game_loop_stop(&mut self, phase: &str) -> Result<()> {
    let gl_id = self.game_loop_id.clone()
        .ok_or(HyperTokenError::InvalidOperation("No gameLoop initialized".into()))?;
    let phase_owned = phase.to_string();

    self.doc.transact::<_, _, AutomergeError>(|tx| {
        tx.put(&gl_id, "running", false)?;
        tx.put(&gl_id, "phase", phase_owned.as_str())?;
        Ok(())
    }).map_err(|e| HyperTokenError::CrdtError(format!("Transaction failed: {:?}", e)))?;

    self.dirty.game_loop = true;
    Ok(())
}

pub fn game_loop_set_phase(&mut self, phase: &str) -> Result<()> {
    let gl_id = self.game_loop_id.clone()
        .ok_or(HyperTokenError::InvalidOperation("No gameLoop initialized".into()))?;
    let phase_owned = phase.to_string();

    self.doc.transact::<_, _, AutomergeError>(|tx| {
        tx.put(&gl_id, "phase", phase_owned.as_str())?;
        Ok(())
    }).map_err(|e| HyperTokenError::CrdtError(format!("Transaction failed: {:?}", e)))?;

    self.dirty.game_loop = true;
    Ok(())
}
```

Note: `game_loop_init` uses `ensure_section("gameLoop")` (creates if absent), while the others use `self.game_loop_id` (fail if not initialized). This is because `init` may be called before any state exists.

- [ ] **Step 3: Run tests, commit**

```bash
git add core-rs/src/chronicle_actions/game_loop.rs
git commit -m "feat(chronicle): implement 5 incremental game_loop action methods"
```

---

### Task 11: Implement game_state action methods

**Files:**
- Modify: `core-rs/src/chronicle_actions/game_state.rs`
- Modify: `core-rs/src/types.rs` (add `gameState` field to `HyperTokenState`)
- Modify: `core-rs/src/chronicle.rs` (update `read_state_from_doc` and `write_state_to_doc`)

**Methods (6):** `game_state_start`, `game_state_end`, `game_state_pause`, `game_state_resume`, `game_state_next_phase`, `game_state_set_property`

- [ ] **Step 0: Add `gameState` field to HyperTokenState and update read/write**

**CRITICAL:** The `HyperTokenState` struct in `types.rs` (line 248-278) has no `gameState` field. Without it, `get_state()` won't include game_state data — it'll land in the `extra` HashMap as broken data since the ROOT key maps to an Automerge Map object.

Add to `types.rs` after the `gameLoop` field (line 261):
```rust
#[serde(skip_serializing_if = "Option::is_none")]
pub gameState: Option<HashMap<String, serde_json::Value>>,
```

Update `read_state_from_doc()` in `chronicle.rs` (in the ROOT key iteration, around line 582-596) to read the `gameState` section:
```rust
"gameState" => {
    let mut state = HashMap::new();
    // Read all fields from gameState map as JSON values
    if let Ok(Some((_, gs_obj))) = self.doc.get(automerge::ROOT, "gameState") {
        for item in self.doc.map_range(&gs_obj, ..) {
            let key = item.key.to_string();
            if let Some(v) = self.read_string(&gs_obj, &key)? {
                state.insert(key, serde_json::Value::String(v));
            } else if let Some(v) = self.read_i64(&gs_obj, &key)? {
                state.insert(key, serde_json::json!(v));
            } else if let Some(v) = self.read_bool(&gs_obj, &key)? {
                state.insert(key, serde_json::Value::Bool(v));
            }
        }
    }
    ht_state.gameState = Some(state);
}
```

Update `write_state_to_doc()` to write the `gameState` section.

- [ ] **Step 1: Write tests and implement**

Follow the same pattern as game_loop. The `gameState` section stores lifecycle data (started, ended, paused, phase, winner, etc.) as map fields. Each method uses `ensure_section("gameState")` since gameState may not exist yet in the document, then writes the relevant fields.

```rust
pub fn game_state_start(&mut self) -> Result<String> {
    let gs_id = self.ensure_section("gameState")?;
    let now = chrono::Utc::now().timestamp_millis();

    self.doc.transact::<_, _, AutomergeError>(|tx| {
        tx.put(&gs_id, "started", true)?;
        tx.put(&gs_id, "startTime", now)?;
        tx.put(&gs_id, "phase", "setup")?;
        tx.put(&gs_id, "turn", 0i64)?;
        tx.put(&gs_id, "ended", false)?;
        Ok(())
    }).map_err(|e| HyperTokenError::CrdtError(format!("Transaction failed: {:?}", e)))?;

    self.dirty.game_state = true;
    self.export_game_state()
}
```

- [ ] **Step 2: Run tests, commit**

```bash
git add core-rs/src/chronicle_actions/game_state.rs
git commit -m "feat(chronicle): implement 6 incremental game_state action methods"
```

---

### Task 12: Implement rules action method

**Files:**
- Modify: `core-rs/src/chronicle_actions/rules.rs`

**Methods (1):** `rule_mark_fired`

- [ ] **Step 1: Write test and implement**

```rust
impl Chronicle {
    pub fn rule_mark_fired(&mut self, rule_name: &str, timestamp: i64) -> Result<()> {
        let rules_id = self.rules_id.clone()
            .ok_or(HyperTokenError::InvalidOperation("No rules initialized".into()))?;
        let name = rule_name.to_string();

        self.doc.transact::<_, _, AutomergeError>(|tx| {
            if let Ok(Some((_, fired_id))) = tx.get(&rules_id, "fired") {
                tx.put(&fired_id, name.as_str(), timestamp)?;
            }
            Ok(())
        }).map_err(|e| HyperTokenError::CrdtError(format!("Transaction failed: {:?}", e)))?;

        self.dirty.rules = true;
        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use crate::chronicle::Chronicle;
    use crate::types::HyperTokenState;

    #[test]
    fn test_rule_mark_fired() {
        let mut c = Chronicle::new();
        c.set_state(r#"{"rules":{"fired":{}}}"#).unwrap();
        c.resolve_section_ids();
        c.dirty.clear();

        c.rule_mark_fired("win_check", 1234567890).unwrap();

        let state_json = c.get_state().unwrap();
        let state: HyperTokenState = serde_json::from_str(&state_json).unwrap();
        assert_eq!(state.rules.unwrap().fired["win_check"], 1234567890);
        assert!(c.dirty.rules);
    }
}
```

- [ ] **Step 2: Run tests, commit**

```bash
git add core-rs/src/chronicle_actions/rules.rs
git commit -m "feat(chronicle): implement rule_mark_fired action method"
```

---

### Task 13: Run full Rust test suite

- [ ] **Step 1: Run all tests**

Run: `cd /Users/sibyl/dev/hypertoken/core-rs && cargo test --target $(rustc -vV | grep host | cut -d' ' -f2)`
Expected: All tests PASS (existing + new action method tests)

- [ ] **Step 2: Run cargo clippy for lint warnings**

Run: `cd /Users/sibyl/dev/hypertoken/core-rs && cargo clippy --target $(rustc -vV | grep host | cut -d' ' -f2) -- -W clippy::all 2>&1 | head -50`
Expected: No errors (warnings are acceptable)

---

## Chunk 4: Phase 3 — ActionDispatcher Rewire

### Task 14: Rewrite ActionDispatcher to delegate to Chronicle

**Files:**
- Modify: `core-rs/src/actions.rs`

- [ ] **Step 1: Write test verifying dispatcher delegates to chronicle**

```rust
#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_dispatcher_stack_draw_via_chronicle() {
        let mut dispatcher = ActionDispatcher::new();
        dispatcher.initialize_state(r#"{"stack":{"stack":[
            {"id":"t1","text":"","char":"□","kind":"default","index":0,"meta":{}},
            {"id":"t2","text":"","char":"□","kind":"default","index":1,"meta":{}}
        ],"drawn":[],"discards":[]}}"#).unwrap();

        let result = dispatcher.stack_draw(1).unwrap();
        let drawn: Vec<serde_json::Value> = serde_json::from_str(&result).unwrap();
        assert_eq!(drawn.len(), 1);
    }

    #[test]
    fn test_dispatcher_creation() {
        let dispatcher = ActionDispatcher::new();
        // Chronicle is always present now
        assert!(dispatcher.chronicle.get_state().is_ok());
    }
}
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd /Users/sibyl/dev/hypertoken/core-rs && cargo test --target $(rustc -vV | grep host | cut -d' ' -f2) -- actions::tests`
Expected: FAIL — `initialize_state` and new structure don't exist

- [ ] **Step 3: Rewrite ActionDispatcher**

Replace the struct and all CRDT-mutating methods to delegate to Chronicle. Keep `TokenOps` and `BatchOps` as direct fields. Remove `Stack`, `Space`, `Source`, `AgentManager`, `GameStateManager` fields.

```rust
// core-rs/src/actions.rs
use wasm_bindgen::prelude::*;
use crate::chronicle::Chronicle;
use crate::token_ops::TokenOps;
use crate::batch::BatchOps;
use crate::types::{HyperTokenError, Result};

#[wasm_bindgen]
pub struct ActionDispatcher {
    chronicle: Chronicle,
    token_ops: TokenOps,
    batch_ops: BatchOps,
}

#[wasm_bindgen]
impl ActionDispatcher {
    #[wasm_bindgen(constructor)]
    pub fn new() -> ActionDispatcher {
        ActionDispatcher {
            chronicle: Chronicle::new(),
            token_ops: TokenOps::new(),
            batch_ops: BatchOps::new(),
        }
    }

    /// Initialize the chronicle with a full state
    #[wasm_bindgen(js_name = initializeState)]
    pub fn initialize_state(&mut self, state_json: &str) -> Result<()> {
        self.chronicle.set_state(state_json)?;
        Ok(())
    }

    /// Get chronicle state as JSON
    #[wasm_bindgen(js_name = getState)]
    pub fn get_state(&self) -> Result<String> {
        self.chronicle.get_state()
    }

    /// Get dirty flags
    #[wasm_bindgen(js_name = getDirty)]
    pub fn get_dirty(&self) -> String {
        self.chronicle.get_dirty()
    }

    /// Clear dirty flags
    #[wasm_bindgen(js_name = clearDirty)]
    pub fn clear_dirty(&mut self) {
        self.chronicle.clear_dirty()
    }

    // === CRDT-mutating methods: one-line delegates to Chronicle ===

    #[wasm_bindgen(js_name = stackDraw)]
    pub fn stack_draw(&mut self, count: usize) -> Result<String> {
        self.chronicle.stack_draw(count)
    }

    #[wasm_bindgen(js_name = stackShuffle)]
    pub fn stack_shuffle(&mut self, seed: Option<String>) -> Result<()> {
        self.chronicle.stack_shuffle(seed)
    }

    #[wasm_bindgen(js_name = stackBurn)]
    pub fn stack_burn(&mut self, count: usize) -> Result<String> {
        self.chronicle.stack_burn(count)
    }

    // --- Stack (10) ---
    #[wasm_bindgen(js_name = stackCut)]
    pub fn stack_cut(&mut self, position: usize) -> Result<String> { self.chronicle.stack_cut(position) }
    #[wasm_bindgen(js_name = stackReset)]
    pub fn stack_reset(&mut self) -> Result<()> { self.chronicle.stack_reset() }
    #[wasm_bindgen(js_name = stackDiscard)]
    pub fn stack_discard(&mut self, count: usize) -> Result<String> { self.chronicle.stack_discard(count) }
    #[wasm_bindgen(js_name = stackInsertAt)]
    pub fn stack_insert_at(&mut self, token_json: &str, index: usize) -> Result<()> { self.chronicle.stack_insert_at(token_json, index) }
    #[wasm_bindgen(js_name = stackRemoveAt)]
    pub fn stack_remove_at(&mut self, index: usize) -> Result<String> { self.chronicle.stack_remove_at(index) }
    #[wasm_bindgen(js_name = stackSwap)]
    pub fn stack_swap(&mut self, i: usize, j: usize) -> Result<()> { self.chronicle.stack_swap(i, j) }
    #[wasm_bindgen(js_name = stackReverse)]
    pub fn stack_reverse(&mut self) -> Result<()> { self.chronicle.stack_reverse() }

    // --- Space (11) ---
    #[wasm_bindgen(js_name = spacePlace)]
    pub fn space_place(&mut self, zone: &str, token_json: &str, x: Option<f64>, y: Option<f64>) -> Result<String> { self.chronicle.space_place(zone, token_json, x, y) }
    #[wasm_bindgen(js_name = spaceMove)]
    pub fn space_move(&mut self, placement_id: &str, from_zone: &str, to_zone: &str) -> Result<()> { self.chronicle.space_move(placement_id, from_zone, to_zone) }
    #[wasm_bindgen(js_name = spaceRemove)]
    pub fn space_remove(&mut self, zone: &str, placement_id: &str) -> Result<String> { self.chronicle.space_remove(zone, placement_id) }
    #[wasm_bindgen(js_name = spaceFlip)]
    pub fn space_flip(&mut self, zone: &str, placement_id: &str) -> Result<()> { self.chronicle.space_flip(zone, placement_id) }
    #[wasm_bindgen(js_name = spaceCreateZone)]
    pub fn space_create_zone(&mut self, name: &str) -> Result<()> { self.chronicle.space_create_zone(name) }
    #[wasm_bindgen(js_name = spaceDeleteZone)]
    pub fn space_delete_zone(&mut self, name: &str) -> Result<()> { self.chronicle.space_delete_zone(name) }
    #[wasm_bindgen(js_name = spaceClearZone)]
    pub fn space_clear_zone(&mut self, name: &str) -> Result<()> { self.chronicle.space_clear_zone(name) }
    #[wasm_bindgen(js_name = spaceLockZone)]
    pub fn space_lock_zone(&mut self, name: &str, locked: bool) -> Result<()> { self.chronicle.space_lock_zone(name, locked) }
    #[wasm_bindgen(js_name = spaceShuffleZone)]
    pub fn space_shuffle_zone(&mut self, name: &str, seed: Option<String>) -> Result<()> { self.chronicle.space_shuffle_zone(name, seed) }
    #[wasm_bindgen(js_name = spaceTransferZone)]
    pub fn space_transfer_zone(&mut self, from: &str, to: &str) -> Result<()> { self.chronicle.space_transfer_zone(from, to) }
    #[wasm_bindgen(js_name = spaceClear)]
    pub fn space_clear(&mut self) -> Result<()> { self.chronicle.space_clear() }

    // --- Source (7) ---
    #[wasm_bindgen(js_name = sourceDraw)]
    pub fn source_draw(&mut self, count: usize) -> Result<String> { self.chronicle.source_draw(count) }
    #[wasm_bindgen(js_name = sourceShuffle)]
    pub fn source_shuffle(&mut self, seed: Option<String>) -> Result<()> { self.chronicle.source_shuffle(seed) }
    #[wasm_bindgen(js_name = sourceBurn)]
    pub fn source_burn(&mut self, count: usize) -> Result<String> { self.chronicle.source_burn(count) }
    #[wasm_bindgen(js_name = sourceAddStack)]
    pub fn source_add_stack(&mut self, tokens_json: &str, stack_id: &str) -> Result<()> { self.chronicle.source_add_stack(tokens_json, stack_id) }
    #[wasm_bindgen(js_name = sourceRemoveStack)]
    pub fn source_remove_stack(&mut self, stack_id: &str) -> Result<()> { self.chronicle.source_remove_stack(stack_id) }
    #[wasm_bindgen(js_name = sourceReset)]
    pub fn source_reset(&mut self, tokens_json: &str) -> Result<()> { self.chronicle.source_reset(tokens_json) }
    #[wasm_bindgen(js_name = sourceSetReshufflePolicy)]
    pub fn source_set_reshuffle_policy(&mut self, threshold: i32, mode: &str) -> Result<()> { self.chronicle.source_set_reshuffle_policy(threshold, mode) }

    // --- Agent (14) ---
    #[wasm_bindgen(js_name = agentCreate)]
    pub fn agent_create(&mut self, id: &str, name: &str, meta_json: Option<String>) -> Result<String> { self.chronicle.agent_create(id, name, meta_json.as_deref()) }
    #[wasm_bindgen(js_name = agentRemove)]
    pub fn agent_remove(&mut self, name: &str) -> Result<()> { self.chronicle.agent_remove(name) }
    #[wasm_bindgen(js_name = agentSetActive)]
    pub fn agent_set_active(&mut self, name: &str, active: bool) -> Result<()> { self.chronicle.agent_set_active(name, active) }
    #[wasm_bindgen(js_name = agentGiveResource)]
    pub fn agent_give_resource(&mut self, name: &str, resource: &str, amount: f64) -> Result<()> { self.chronicle.agent_give_resource(name, resource, amount) }
    #[wasm_bindgen(js_name = agentTakeResource)]
    pub fn agent_take_resource(&mut self, name: &str, resource: &str, amount: f64) -> Result<()> { self.chronicle.agent_take_resource(name, resource, amount) }
    #[wasm_bindgen(js_name = agentAddToken)]
    pub fn agent_add_token(&mut self, name: &str, token_json: &str) -> Result<()> { self.chronicle.agent_add_token(name, token_json) }
    #[wasm_bindgen(js_name = agentRemoveToken)]
    pub fn agent_remove_token(&mut self, name: &str, token_id: &str) -> Result<String> { self.chronicle.agent_remove_token(name, token_id) }
    #[wasm_bindgen(js_name = agentTransferResource)]
    pub fn agent_transfer_resource(&mut self, from: &str, to: &str, resource: &str, amount: f64) -> Result<()> { self.chronicle.agent_transfer_resource(from, to, resource, amount) }
    #[wasm_bindgen(js_name = agentTransferToken)]
    pub fn agent_transfer_token(&mut self, from: &str, to: &str, token_id: &str) -> Result<()> { self.chronicle.agent_transfer_token(from, to, token_id) }
    #[wasm_bindgen(js_name = agentStealResource)]
    pub fn agent_steal_resource(&mut self, from: &str, to: &str, resource: &str, amount: f64) -> Result<()> { self.chronicle.agent_steal_resource(from, to, resource, amount) }
    #[wasm_bindgen(js_name = agentStealToken)]
    pub fn agent_steal_token(&mut self, from: &str, to: &str, token_id: &str) -> Result<()> { self.chronicle.agent_steal_token(from, to, token_id) }
    #[wasm_bindgen(js_name = agentDrawCards)]
    pub fn agent_draw_cards(&mut self, name: &str, count: usize) -> Result<String> { self.chronicle.agent_draw_cards(name, count) }
    #[wasm_bindgen(js_name = agentDiscardCards)]
    pub fn agent_discard_cards(&mut self, name: &str, token_ids_json: &str) -> Result<()> { self.chronicle.agent_discard_cards(name, token_ids_json) }
    #[wasm_bindgen(js_name = agentTrade)]
    pub fn agent_trade(&mut self, from: &str, to: &str, offer_json: &str, request_json: &str) -> Result<()> { self.chronicle.agent_trade(from, to, offer_json, request_json) }

    // --- GameLoop (5) ---
    #[wasm_bindgen(js_name = gameLoopInit)]
    pub fn game_loop_init(&mut self, max_turns: i32) -> Result<()> { self.chronicle.game_loop_init(max_turns) }
    #[wasm_bindgen(js_name = gameLoopStart)]
    pub fn game_loop_start(&mut self) -> Result<()> { self.chronicle.game_loop_start() }
    #[wasm_bindgen(js_name = gameLoopStop)]
    pub fn game_loop_stop(&mut self, phase: &str) -> Result<()> { self.chronicle.game_loop_stop(phase) }
    #[wasm_bindgen(js_name = gameLoopNextTurn)]
    pub fn game_loop_next_turn(&mut self, agent_count: usize) -> Result<()> { self.chronicle.game_loop_next_turn(agent_count) }
    #[wasm_bindgen(js_name = gameLoopSetPhase)]
    pub fn game_loop_set_phase(&mut self, phase: &str) -> Result<()> { self.chronicle.game_loop_set_phase(phase) }

    // --- GameState (6) ---
    #[wasm_bindgen(js_name = gameStateStart)]
    pub fn game_state_start(&mut self) -> Result<()> { self.chronicle.game_state_start() }
    #[wasm_bindgen(js_name = gameStateEnd)]
    pub fn game_state_end(&mut self, winner: Option<String>) -> Result<()> { self.chronicle.game_state_end(winner.as_deref()) }
    #[wasm_bindgen(js_name = gameStatePause)]
    pub fn game_state_pause(&mut self) -> Result<()> { self.chronicle.game_state_pause() }
    #[wasm_bindgen(js_name = gameStateResume)]
    pub fn game_state_resume(&mut self) -> Result<()> { self.chronicle.game_state_resume() }
    #[wasm_bindgen(js_name = gameStateNextPhase)]
    pub fn game_state_next_phase(&mut self, phase: &str) -> Result<()> { self.chronicle.game_state_next_phase(phase) }
    #[wasm_bindgen(js_name = gameStateSetProperty)]
    pub fn game_state_set_property(&mut self, key: &str, value_json: &str) -> Result<()> { self.chronicle.game_state_set_property(key, value_json) }

    // --- Rules (1) ---
    #[wasm_bindgen(js_name = ruleMarkFired)]
    pub fn rule_mark_fired(&mut self, name: &str, timestamp: i64) -> Result<()> { self.chronicle.rule_mark_fired(name, timestamp) }

    // === Stateless operations: delegate to TokenOps/BatchOps directly ===

    #[wasm_bindgen(js_name = tokenTransform)]
    pub fn token_transform(&self, token_json: &str, properties_json: &str) -> Result<String> {
        self.token_ops.transform(token_json, properties_json)
    }

    // ... (all other token/batch ops unchanged)

    // === Save/Load/Sync: delegate to Chronicle ===

    #[wasm_bindgen(js_name = save)]
    pub fn save(&self) -> Result<Vec<u8>> { self.chronicle.save() }

    #[wasm_bindgen(js_name = saveToBase64)]
    pub fn save_to_base64(&self) -> Result<String> { self.chronicle.save_to_base64() }

    #[wasm_bindgen(js_name = load)]
    pub fn load(&mut self, data: &[u8]) -> Result<()> { self.chronicle.load(data) }

    #[wasm_bindgen(js_name = loadFromBase64)]
    pub fn load_from_base64(&mut self, base64: &str) -> Result<()> { self.chronicle.load_from_base64(base64) }

    #[wasm_bindgen(js_name = merge)]
    pub fn merge(&mut self, other: &[u8]) -> Result<()> { self.chronicle.merge(other) }

    // === Section exports ===

    #[wasm_bindgen(js_name = exportStack)]
    pub fn export_stack(&self) -> Result<String> { self.chronicle.export_stack() }

    #[wasm_bindgen(js_name = exportZones)]
    pub fn export_zones(&self) -> Result<String> { self.chronicle.export_zones() }

    #[wasm_bindgen(js_name = exportSource)]
    pub fn export_source(&self) -> Result<String> { self.chronicle.export_source() }

    #[wasm_bindgen(js_name = exportGameLoop)]
    pub fn export_game_loop(&self) -> Result<String> { self.chronicle.export_game_loop() }

    #[wasm_bindgen(js_name = exportGameState)]
    pub fn export_game_state(&self) -> Result<String> { self.chronicle.export_game_state() }

    #[wasm_bindgen(js_name = exportRules)]
    pub fn export_rules(&self) -> Result<String> { self.chronicle.export_rules() }

    #[wasm_bindgen(js_name = exportAgents)]
    pub fn export_agents(&self) -> Result<String> { self.chronicle.export_agents() }

    #[wasm_bindgen(js_name = exportNullifiers)]
    pub fn export_nullifiers(&self) -> Result<String> { self.chronicle.export_nullifiers() }
}
```

**Build sequencing note:** Do NOT remove `setStack`/`setSpace`/`setSource` yet — they are still called by `Engine.ts` until Task 17. Make them **no-ops** in this task:

```rust
// Temporary no-ops (removed in Task 17 when Engine.ts is updated)
#[wasm_bindgen(js_name = setStack)]
pub fn set_stack(&mut self, _stack_json: &str) -> Result<()> { Ok(()) }
#[wasm_bindgen(js_name = setSpace)]
pub fn set_space(&mut self, _space_json: &str) -> Result<()> { Ok(()) }
#[wasm_bindgen(js_name = setSource)]
pub fn set_source(&mut self, _source_json: &str) -> Result<()> { Ok(()) }
```

After Task 17 completes (Engine.ts uses `initializeState()` instead), remove these no-ops in a follow-up commit. The JS-facing API names for action methods (`stackDraw`, `spacePlace`, etc.) remain identical.

**Read-only and layout WASM actions:** The current `WASM_ACTIONS` set in Engine.ts includes actions NOT in the 54-method inventory:
- Read-only: `stack:peek`, `agent:get`, `agent:getAll`, `game:getState`, `source:inspect`
- Layout: `space:fanZone`, `space:spreadZone`, `space:stackZone`
- Debug: `debug:log`

These do NOT need Chronicle action methods (they don't mutate CRDT state). Keep them as delegates on ActionDispatcher that read from Chronicle's export methods:

```rust
// Read-only delegates — read from Chronicle exported state
#[wasm_bindgen(js_name = stackPeek)]
pub fn stack_peek(&self, count: usize) -> Result<String> { self.chronicle.export_stack() } // returns full stack for TS to slice

#[wasm_bindgen(js_name = agentGet)]
pub fn agent_get(&self, name: &str) -> Result<String> {
    // Read agent from exported agents JSON
    let agents_json = self.chronicle.export_agents()?;
    let agents: serde_json::Value = serde_json::from_str(&agents_json)
        .map_err(|e| HyperTokenError::SerializationError(e.to_string()))?;
    Ok(agents[name].to_string())
}

#[wasm_bindgen(js_name = agentGetAll)]
pub fn agent_get_all(&self) -> Result<String> { self.chronicle.export_agents() }

#[wasm_bindgen(js_name = gameGetState)]
pub fn game_get_state(&self) -> Result<String> { self.chronicle.export_game_state() }

#[wasm_bindgen(js_name = sourceInspect)]
pub fn source_inspect(&self) -> Result<String> { self.chronicle.export_source() }
```

Layout actions (`space:fanZone`, `space:spreadZone`, `space:stackZone`) and `debug:log` should be **removed from WASM_ACTIONS** in Task 17 so they fall through to the TS path. These are pure presentation/debug operations that don't need CRDT semantics.

Also ensure `_dispatchWasm()` dispatch branches exist for all 54 CRDT-mutating actions. Actions in `WASM_ACTIONS` that don't have a dispatch branch will throw at the final `throw new Error(...)`. Task 17 Step 3 must add branches for any missing actions (e.g., `stack:discard`, `source:addStack`, `source:removeStack`, `source:reset`, `source:setReshufflePolicy`, `agent:trade`, `agent:drawCards`, `agent:discardCards`).

- [ ] **Step 4: Run all Rust tests**

Run: `cd /Users/sibyl/dev/hypertoken/core-rs && cargo test --target $(rustc -vV | grep host | cut -d' ' -f2)`
Expected: All PASS

- [ ] **Step 5: Commit**

```bash
git add core-rs/src/actions.rs
git commit -m "refactor(actions): rewrite ActionDispatcher to delegate to Chronicle"
```

---

## Chunk 5: Phase 4 — TypeScript Integration

### Task 15: Create IChronicle interface

**Files:**
- Create: `core/IChronicle.ts`

- [ ] **Step 1: Create the interface file**

```typescript
// core/IChronicle.ts

export interface IChronicle {
    readonly state: any; // HyperTokenState
    save(): Uint8Array;
    saveToBase64(): string;
    load(data: Uint8Array): void;
    loadFromBase64(b64: string): void;
    merge(other: Uint8Array): void;
    change(message: string, callback: (doc: any) => void, source?: string): void;
    generateSyncMessage(state?: Uint8Array): string;
    receiveSyncMessage(msg: Uint8Array, state?: Uint8Array): string;
    // Emitter methods
    on(type: string, fn: Function): any;
    off(type: string, fn: Function): any;
    emit(type: string, payload?: any): boolean;
}
```

- [ ] **Step 2: Commit**

```bash
git add core/IChronicle.ts
git commit -m "feat(core): create IChronicle interface"
```

---

### Task 16: Create WasmChronicleAdapter

**Files:**
- Create: `core/WasmChronicleAdapter.ts`

- [ ] **Step 1: Create the adapter**

```typescript
// core/WasmChronicleAdapter.ts
import { Emitter } from './events.js';
import type { IChronicle } from './IChronicle.js';

export class WasmChronicleAdapter extends Emitter implements IChronicle {
    private _wasm: any; // ActionDispatcher from WASM module
    private _cache: Record<string, any> = {};

    constructor(wasmDispatcher: any) {
        super();
        this._wasm = wasmDispatcher;
        // Initial full load
        this._cache = JSON.parse(this._wasm.getState());
        this._wasm.clearDirty();
    }

    get state(): any {
        const dirtyJson = this._wasm.getDirty();
        const dirty = JSON.parse(dirtyJson);

        if (dirty.all) {
            this._cache = JSON.parse(this._wasm.getState());
        } else {
            if (dirty.stack) this._cache.stack = JSON.parse(this._wasm.exportStack());
            if (dirty.zones) this._cache.zones = JSON.parse(this._wasm.exportZones());
            if (dirty.source) this._cache.source = JSON.parse(this._wasm.exportSource());
            if (dirty.gameLoop) this._cache.gameLoop = JSON.parse(this._wasm.exportGameLoop());
            if (dirty.gameState) this._cache.gameState = JSON.parse(this._wasm.exportGameState());
            if (dirty.rules) this._cache.rules = JSON.parse(this._wasm.exportRules());
            if (dirty.agents) this._cache.agents = JSON.parse(this._wasm.exportAgents());
            if (dirty.nullifiers) this._cache.nullifiers = JSON.parse(this._wasm.exportNullifiers());
        }
        this._wasm.clearDirty();
        return this._cache;
    }

    change(message: string, callback: (doc: any) => void, source: string = "local"): void {
        throw new Error(
            "Direct change() not supported with WASM Chronicle. Use engine.dispatch() instead."
        );
    }

    save(): Uint8Array {
        return this._wasm.save();
    }

    saveToBase64(): string {
        return this._wasm.saveToBase64();
    }

    load(data: Uint8Array): void {
        this._wasm.load(data);
        this._cache = {};
        this.emit("state:changed", { doc: this.state, source: "load" });
    }

    loadFromBase64(b64: string): void {
        this._wasm.loadFromBase64(b64);
        this._cache = {};
        this.emit("state:changed", { doc: this.state, source: "load" });
    }

    merge(other: Uint8Array): void {
        this._wasm.merge(other);
        this._cache = {};
        this.emit("state:changed", { doc: this.state, source: "merge" });
    }

    generateSyncMessage(state?: Uint8Array): string {
        return this._wasm.generateSyncMessage(state || null);
    }

    receiveSyncMessage(msg: Uint8Array, state?: Uint8Array): string {
        const result = this._wasm.receiveSyncMessage(msg, state || null);
        this._cache = {};
        this.emit("state:changed", { doc: this.state, source: "sync" });
        return result;
    }
}
```

- [ ] **Step 2: Commit**

```bash
git add core/WasmChronicleAdapter.ts
git commit -m "feat(core): create WasmChronicleAdapter with dirty-section caching"
```

---

### Task 17: Modify Engine.ts for WASM Chronicle integration

**Files:**
- Modify: `engine/Engine.ts`

- [ ] **Step 1: Update session type and WASM initialization**

At `engine/Engine.ts:62`, change the type. Import `IChronicle` from `core/IChronicle.js`:
```typescript
import type { IChronicle } from '../core/IChronicle.js';
// ...
session: IChronicle; // either Chronicle or WasmChronicleAdapter
```

In the WASM initialization path (around line 197-253), replace the `setStack`/`setSpace`/`setSource` calls with `initializeState`:
```typescript
// Replace:
//   this._wasmDispatcher.setStack(wasmStack);
//   this._wasmDispatcher.setSpace(wasmSpace);
//   this._wasmDispatcher.setSource(wasmSource);
// With:
this._wasmDispatcher.initializeState(JSON.stringify(this.session.state));
this.session = new WasmChronicleAdapter(this._wasmDispatcher);
```

**Constructor ordering:** The Engine constructor creates `GameLoop` which (after Task 18) calls `this.engine.dispatch("game:loopInit", ...)`. This requires the Engine's action registry to be available. The WASM session swap must happen BEFORE GameLoop construction so GameLoop doesn't capture a stale session reference. Sequence must be:

1. `this.session = new Chronicle()` (TS chronicle, initial)
2. If WASM available: `this._wasmDispatcher = new ActionDispatcher()`
3. `this._wasmDispatcher.initializeState(JSON.stringify(this.session.state))`
4. `this.session = new WasmChronicleAdapter(this._wasmDispatcher)`
5. NOW create GameLoop (it will use `this.engine.session` which is already WasmChronicleAdapter)

If WASM loading is async, GameLoop creation must be deferred until after the WASM swap completes, or GameLoop must handle session replacement gracefully (which Task 18 ensures by using `this.engine.session` instead of a stored reference).

- [ ] **Step 2: Add state:changed emission after WASM dispatch**

**Important:** `_dispatchWasm()` has dozens of early `return` statements (one per action type). Do NOT add the emission inside `_dispatchWasm()` — it would need to be at every return point. Instead, add it in `apply()` (the caller) after the WASM branch succeeds:

```typescript
// In apply(), around the WASM branch:
if (this._wasmDispatcher && WASM_ACTIONS.has(action.type)) {
    const result = this._dispatchWasm(action.type, action.payload);
    this.session.emit("state:changed", { source: "dispatch" });
    return result;
}
```

This ensures `state:changed` fires exactly once after every successful WASM dispatch, regardless of which action type was handled.

Also verify that Engine relays `state:changed` to `state:updated`. If this relay does not already exist, add it:
```typescript
// In Engine constructor, after session is set:
this.session.on("state:changed", () => {
    this.emit("state:updated", { state: this.session.state });
});
```

This is needed because GameLoop (after Task 18) removes explicit `_syncState()` calls and relies on the `state:updated` event chain: `state:changed` → Engine relays → `state:updated` → GameLoop `_syncState()`.

- [ ] **Step 3: Add new action types to WASM_ACTIONS set**

At `engine/Engine.ts:429-461`, add these to the `WASM_ACTIONS` Set:
```typescript
"game:loopInit", "game:loopStart", "game:loopStop",
"game:nextTurn", "game:setPhase", "game:setMaxTurns",
"game:start", "game:end", "game:pause", "game:resume", "game:nextPhase", "game:setProperty",
"rule:markFired",
```

Add corresponding dispatch branches in `_dispatchWasm()`:
```typescript
// GameLoop actions
if (type === "game:loopInit") return dispatcher.gameLoopInit(payload.maxTurns ?? 100);
if (type === "game:loopStart") return dispatcher.gameLoopStart();
if (type === "game:loopStop") return dispatcher.gameLoopStop(payload.phase ?? "stopped");
if (type === "game:nextTurn") return dispatcher.gameLoopNextTurn(payload.agentCount ?? 0);
if (type === "game:setPhase") return dispatcher.gameLoopSetPhase(payload.phase);
if (type === "game:setMaxTurns") return dispatcher.gameLoopInit(payload.maxTurns ?? 100);

// GameState actions
if (type === "game:start") return dispatcher.gameStateStart();
if (type === "game:end") return dispatcher.gameStateEnd(payload.winner ?? null);
if (type === "game:pause") return dispatcher.gameStatePause();
if (type === "game:resume") return dispatcher.gameStateResume();
if (type === "game:nextPhase") return dispatcher.gameStateNextPhase(payload.phase);
if (type === "game:setProperty") return dispatcher.gameStateSetProperty(payload.key, JSON.stringify(payload.value));

// Rules actions
if (type === "rule:markFired") return dispatcher.ruleMarkFired(payload.name, payload.timestamp ?? Date.now());
```

- [ ] **Step 4: Commit**

```bash
git add engine/Engine.ts
git commit -m "feat(engine): integrate WasmChronicleAdapter and new dispatch actions"
```

---

### Task 18: Migrate GameLoop.ts to use dispatch

**Files:**
- Modify: `engine/GameLoop.ts:32,58,100,113,129`

- [ ] **Step 1: Fix stale session reference and replace session.change() calls**

**Critical:** GameLoop currently stores `this.session = engine.session` at construction time (line 28). After Engine reassigns `this.session` to WasmChronicleAdapter, GameLoop still holds the old Chronicle reference. Fix this in two ways:

1. **Remove the stored session reference** — GameLoop already has `this.engine`, so always access state through `this.engine.session.state` instead of `this.session.state`
2. **Replace all session.change() calls with engine.dispatch()**

```typescript
// GameLoop.ts — changes needed:

// Line 13: REMOVE the session field entirely
// session: Chronicle;  // DELETE THIS LINE

// Line 28: REMOVE session assignment
// this.session = engine.session;  // DELETE THIS LINE

// Lines 51-56: Update state getters to use engine.session
get turn(): number { return this.engine.session.state.gameLoop?.turn ?? 0; }
get running(): boolean { return this.engine.session.state.gameLoop?.running ?? false; }
get activeAgentIndex(): number { return this.engine.session.state.gameLoop?.activeAgentIndex ?? -1; }
get phase(): string { return this.engine.session.state.gameLoop?.phase ?? "setup"; }
get maxTurns(): number { return this.engine.session.state.gameLoop?.maxTurns ?? Infinity; }
```

Constructor (line 32):
```typescript
// BEFORE: this.session.change("init loop", (doc) => { doc.gameLoop = {...} });
// AFTER:
this.engine.dispatch("game:loopInit", { maxTurns });
```

maxTurns setter (line 58):
```typescript
// BEFORE: this.session.change("set maxTurns", (doc) => { if (doc.gameLoop) doc.gameLoop.maxTurns = value; });
// AFTER:
this.engine.dispatch("game:setMaxTurns", { maxTurns: value });
```

start() (line 100):
```typescript
// BEFORE: this.session.change("start loop", (doc) => { ... });
// AFTER:
this.engine.dispatch("game:loopStart", {});
```

stop() (line 113):
```typescript
// BEFORE: this.session.change("stop loop", (doc) => { ... });
// AFTER:
this.engine.dispatch("game:loopStop", { phase: "stopped" });
```

nextTurn() (line 129):
```typescript
// BEFORE: this.session.change("next turn", (doc) => { ... });
// AFTER:
this.engine.dispatch("game:nextTurn", { agentCount: this._agents.length });
```

Note: GameLoop already has `engine: Engine` as a field and constructor parameter (line 12, 27). No new parameter needed.

- [ ] **Step 2: Commit**

```bash
git add engine/GameLoop.ts
git commit -m "refactor(gameloop): migrate session.change() to engine.dispatch()"
```

---

### Task 19: Migrate RuleEngine.ts to use dispatch

**Files:**
- Modify: `engine/RuleEngine.ts:33,83`

- [ ] **Step 1: Replace session.change() calls**

Constructor (line 33):
```typescript
// BEFORE: this.session.change("init rules", (doc) => { doc.rules = { fired: {} }; });
// AFTER: Initialize rules via dispatch instead of direct session.change()
if (!this.engine.session.state.rules) {
    this.engine.dispatch("rule:initRules", {});
}
```

Also add a `rule:initRules` handler in Task 20's action entries:
```typescript
"rule:initRules": (engine: Engine, payload: any) => {
    engine.session.change("init rules", (doc: any) => {
        doc.rules = { fired: {} };
    });
},
```
And add `rule:initRules` to WASM_ACTIONS with a `Chronicle::rule_init()` method in `rules.rs` that calls `ensure_section("rules")` and creates the `fired` sub-map.

evaluate() (line 83):
```typescript
// BEFORE: this.session.change("mark fired", (doc) => { if (doc.rules) doc.rules.fired[rule.name] = Date.now(); });
// AFTER:
this.engine.dispatch("rule:markFired", { name: rule.name, timestamp: Date.now() });
```

- [ ] **Step 2: Commit**

```bash
git add engine/RuleEngine.ts
git commit -m "refactor(ruleengine): migrate session.change() to engine.dispatch()"
```

---

### Task 20: Add new action handlers to actions.ts

**Files:**
- Modify: `engine/actions.ts`

- [ ] **Step 1: Add new action handlers as object literal entries**

**IMPORTANT:** `engine/actions.ts` uses object literal pattern `{ "action:type": (engine, payload) => { ... } }` — NOT `registry.register()`. The first parameter is `engine: Engine`, not `session`. Access session via `engine.session`.

Add these entries inside the `ActionRegistry` object literal:

```typescript
// Add these entries to the ActionRegistry object in engine/actions.ts:

"game:loopInit": (engine: Engine, payload: any) => {
    engine.session.change("init loop", (doc: any) => {
        doc.gameLoop = {
            turn: 0, running: false, activeAgentIndex: -1,
            phase: "setup", maxTurns: payload.maxTurns ?? 100,
        };
    });
},

"game:loopStart": (engine: Engine, payload: any) => {
    engine.session.change("start loop", (doc: any) => {
        if (doc.gameLoop) {
            doc.gameLoop.running = true;
            doc.gameLoop.turn = 0;
            doc.gameLoop.phase = "play";
            doc.gameLoop.activeAgentIndex = 0;
        }
    });
},

"game:loopStop": (engine: Engine, payload: any) => {
    engine.session.change("stop loop", (doc: any) => {
        if (doc.gameLoop) {
            doc.gameLoop.running = false;
            doc.gameLoop.phase = payload.phase ?? "stopped";
        }
    });
},

"game:nextTurn": (engine: Engine, payload: any) => {
    const agentCount = payload.agentCount ?? 0;
    engine.session.change("next turn", (doc: any) => {
        if (!doc.gameLoop) return;
        doc.gameLoop.turn++;
        doc.gameLoop.activeAgentIndex = agentCount > 0
            ? (doc.gameLoop.activeAgentIndex + 1) % agentCount
            : 0;
    });
},

"game:setPhase": (engine: Engine, payload: any) => {
    engine.session.change("set phase", (doc: any) => {
        if (doc.gameLoop) doc.gameLoop.phase = payload.phase;
    });
},

"game:setMaxTurns": (engine: Engine, payload: any) => {
    engine.session.change("set maxTurns", (doc: any) => {
        if (doc.gameLoop) doc.gameLoop.maxTurns = payload.maxTurns;
    });
},

"rule:markFired": (engine: Engine, payload: any) => {
    engine.session.change("mark fired", (doc: any) => {
        if (doc.rules) doc.rules.fired[payload.name] = payload.timestamp ?? Date.now();
    });
},
```

Note: These handlers are for the **TS fallback path** only. On the WASM path, these actions are routed to `_dispatchWasm()` which delegates to `ActionDispatcher` → `Chronicle`. The TS handlers call `engine.session.change()` which invokes the Automerge proxy (already correct CRDT semantics).

**Important — TS/WASM parity for existing GameActions:** The existing `GameActions` handlers (for `game:start`, `game:end`, `game:pause`, `game:resume`, `game:nextPhase`, `game:setProperty` at actions.ts lines 336-383) mutate `engine._gameState` directly — an in-memory object, NOT CRDT state. This means the TS path and WASM path use fundamentally different state storage for these actions. For true parity, the existing `GameActions` handlers should be updated to also write to `engine.session.change()` (mirroring the CRDT writes). Until then, game state is only CRDT-backed on the WASM path. This is acceptable for Phase 4 as a known limitation — Phase 5 parity tests should skip game state comparisons or test them separately.

- [ ] **Step 2: Commit**

```bash
git add engine/actions.ts
git commit -m "feat(actions): add TS handlers for game loop and rule dispatch actions"
```

---

### Task 21: Run full test suite

- [ ] **Step 1: Run TS quick tests**

Run: `cd /Users/sibyl/dev/hypertoken && npm run test:quick`
Expected: All PASS

- [ ] **Step 2: Run TS unit tests**

Run: `cd /Users/sibyl/dev/hypertoken && npm run test:unit`
Expected: All PASS

- [ ] **Step 3: Run full Rust tests**

Run: `cd /Users/sibyl/dev/hypertoken/core-rs && cargo test --target $(rustc -vV | grep host | cut -d' ' -f2)`
Expected: All PASS

- [ ] **Step 4: Commit all integration changes**

```bash
git add -A
git commit -m "feat: complete Chronicle incremental CRDT integration (Phase 4)"
```

---

## Chunk 6: Phase 5 — Parity Validation

### Task 22: Create parity test harness

**Files:**
- Create: `test/testChronicleIncremental.ts`

- [ ] **Step 1: Write parity tests comparing TS and WASM paths**

```typescript
// test/testChronicleIncremental.ts
import { test, assert } from './helpers.js';
import { Engine } from '../engine/Engine.js';
import { Chronicle } from '../core/Chronicle.js';
import { isWasmAvailable, tryLoadWasm } from '../core/WasmBridge.js';

const initStateJson = JSON.stringify({
    stack: { stack: [
        { id: "t1", text: "A", char: "A", kind: "card", index: 0, meta: {} },
        { id: "t2", text: "B", char: "B", kind: "card", index: 1, meta: {} },
        { id: "t3", text: "C", char: "C", kind: "card", index: 2, meta: {} },
    ], drawn: [], discards: [] },
    zones: { hand: [], table: [] },
    agents: {},
    gameLoop: { turn: 0, running: false, activeAgentIndex: -1, phase: "setup", maxTurns: 10 },
    rules: { fired: {} },
});

// Helper: create a TS-only engine (no WASM)
function createTsEngine(): Engine {
    const engine = new Engine();
    // Initialize state via TS Chronicle's change() method
    engine.session.change("init", (doc: any) => Object.assign(doc, JSON.parse(initStateJson)));
    return engine;
}

// Helper: create a WASM engine (requires WASM to be loaded)
function createWasmEngine(): Engine {
    // Engine auto-detects WASM availability via isWasmAvailable()
    // and switches to WasmChronicleAdapter when WASM is loaded.
    // The WASM path uses dispatcher.initializeState() instead of session.change().
    const engine = new Engine();
    if (engine._wasmDispatcher) {
        engine._wasmDispatcher.initializeState(initStateJson);
    }
    return engine;
}

// Helper: run same action sequence through both paths, compare state
function parityCheck(actions: Array<{type: string, payload: any}>) {
    const tsEngine = createTsEngine();
    const wasmEngine = createWasmEngine();

    for (const action of actions) {
        tsEngine.dispatch(action.type, action.payload);
        wasmEngine.dispatch(action.type, action.payload);
    }

    const tsState = JSON.parse(JSON.stringify(tsEngine.session.state));
    const wasmState = JSON.parse(JSON.stringify(wasmEngine.session.state));
    return { tsState, wasmState, tsEngine, wasmEngine };
}

// Attempt to load WASM before running tests
await tryLoadWasm().catch(() => {});
const wasmLoaded = isWasmAvailable();

test("parity: stack:draw produces same state", async () => {
    if (!wasmLoaded) { console.log("WASM not available, skipping"); return; }
    const { tsState, wasmState } = parityCheck([
        { type: "stack:draw", payload: { count: 2 } },
    ]);
    assert.equal(tsState.stack.stack.length, wasmState.stack.stack.length);
    assert.equal(tsState.stack.drawn.length, wasmState.stack.drawn.length);
});

test("parity: multiple action types produce same state", async () => {
    if (!wasmLoaded) { console.log("WASM not available, skipping"); return; }
    const { tsState, wasmState } = parityCheck([
        { type: "stack:draw", payload: { count: 1 } },
        { type: "space:place", payload: { zone: "hand", tokenId: "t3", x: 0, y: 0 } },
        { type: "agent:create", payload: { id: "p1", name: "Player 1" } },
        { type: "game:loopStart", payload: {} },
    ]);
    assert.equal(tsState.stack.stack.length, wasmState.stack.stack.length);
    assert.equal(JSON.stringify(tsState.agents), JSON.stringify(wasmState.agents));
});

test("parity: save/load round-trip through WASM", async () => {
    if (!wasmLoaded) { console.log("WASM not available, skipping"); return; }
    const engine = createWasmEngine();
    engine.dispatch("stack:draw", { count: 1 });

    const saved = engine.session.saveToBase64();
    const engine2 = createWasmEngine();
    engine2.session.loadFromBase64(saved);

    const s1 = JSON.parse(JSON.stringify(engine.session.state));
    const s2 = JSON.parse(JSON.stringify(engine2.session.state));
    assert.equal(s1.stack.stack.length, s2.stack.stack.length);
    assert.equal(s1.stack.drawn.length, s2.stack.drawn.length);
});

test("parity: WASM documents can merge cleanly", async () => {
    if (!wasmLoaded) { console.log("WASM not available, skipping"); return; }
    // Create two WASM engines from the SAME initial state (shared ancestor)
    const engine1 = createWasmEngine();
    const engine2 = createWasmEngine();

    // Load engine2 from engine1's saved state so they share an Automerge history root
    const snapshot = engine1.session.save();
    engine2.session.load(snapshot);

    // Each engine makes different non-conflicting changes
    engine1.dispatch("agent:create", { id: "p1", name: "Player 1" });
    engine2.dispatch("stack:draw", { count: 1 });

    // Merge engine2 into engine1 — should combine cleanly (shared ancestor)
    const bytes2 = engine2.session.save();
    engine1.session.merge(bytes2);

    const state = engine1.session.state;
    assert.ok(state.agents?.["Player 1"], "Should have agent from engine1");
    assert.equal(state.stack.drawn.length, 1, "Should have drawn card from engine2");
});
```

**Note:** The exact Engine WASM initialization path depends on how `Engine` detects and activates WASM. The tests above use `isWasmAvailable()` and `tryLoadWasm()` from `WasmBridge.ts` which is the existing pattern. If the Engine constructor auto-detects WASM, the `createWasmEngine()` helper may need adjustment. The key invariant: WASM initialization uses `dispatcher.initializeState(json)`, NOT `session.change()` (which throws on WasmChronicleAdapter).

- [ ] **Step 2: Run parity tests**

Run: `cd /Users/sibyl/dev/hypertoken && node --loader ./test/ts-esm-loader.js test/testChronicleIncremental.js`
Expected: All PASS

- [ ] **Step 3: Commit**

```bash
git add test/testChronicleIncremental.ts
git commit -m "test: add Chronicle incremental CRDT parity validation tests"
```

---

## Summary

| Phase | Tasks | Methods | Key Deliverable |
|-------|-------|---------|-----------------|
| 1 — Foundation | 1-5 | 0 | DirtySections, ObjId cache, section exports, helpers.rs |
| 2 — Action Methods | 6-12 | 54 | All action methods on Chronicle |
| 3 — Dispatcher Rewire | 14 | 0 | ActionDispatcher delegates to Chronicle |
| 4 — TS Integration | 15-21 | 0 | WasmChronicleAdapter, Engine/GameLoop/RuleEngine migration |
| 5 — Parity Validation | 22 | 0 | Test harness proving TS/WASM equivalence |

**Total: 22 tasks, ~100 steps**
