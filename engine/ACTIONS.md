# HyperToken Action Reference

Complete documentation for all 81 built-in actions in the HyperToken engine.

---

## Quick Reference

### By Category

| Category | Count | Documentation |
|----------|-------|---------------|
| **Stack** | 11 | [Stack Actions](./actions/stack.md) |
| **Space** | 14 | [Space Actions](./actions/TABLE.md) |
| **Source** | 7 | [Source Actions](./actions/SHOE.md) |
| **Agent** | 17 | [Agent Actions](./actions/PLAYER.md) |
| **Game** | 9 | [Game Actions](./actions/GAME.md) |
| **GameLoop** | 7 | Game loop lifecycle (loopInit, loopStart, loopStop, nextTurn, setPhase, setMaxTurns, setActiveAgent) |
| **Rules** | 2 | Rule engine state (markFired, initRules) |
| **Token** | 5 | [Token Actions](./actions/TOKEN.md) |
| **Debug** | 1 | Debug helpers (debug:log) |
| **Batch** | 8 | [Batch Actions](./actions/BATCH.md) — `tokens:*`, TS ActionRegistry |
| **Total (TS ActionRegistry)** | **81** | **100% Complete** |

> Category counts reflect the TS `ActionRegistry` via `listActions()` (81 actions). The 8 `tokens:*` Batch actions are included; they route through the TS ActionRegistry like every other action.

---

## Action Categories

### 🎴 [Stack Actions](./actions/stack.md) (11)
Operations on the primary card stack.

**Actions:** shuffle, draw, reset, burn, peek, cut, insertAt, removeAt, swap, reverse, discard

**Use cases:** Shuffling at game start, drawing cards, stack manipulation, dealer procedures

---

### 🎯 [Space Actions](./actions/TABLE.md) (14)
Operations on the game space and zones.

**Actions:** place, clear, move, flip, remove, createZone, deleteZone, clearZone, shuffleZone, transferZone, fanZone, stackZone, spreadZone, lockZone

**Use cases:** Playing cards to zones, moving pieces on board, arranging layouts, zone management

---

### 👟 [Source Actions](./actions/SHOE.md) (7)
Operations on multi-stack containers.

**Actions:** draw, shuffle, burn, reset, addStack, removeStack, inspect

**Use cases:** Casino games with multiple stacks, blackjack, baccarat, weighted randomness

---

### 👥 [Agent Actions](./actions/PLAYER.md) (17)
Agent management and agent-to-agent interactions.

**Actions:** create, remove, setActive, giveResource, takeResource, addToken, removeToken, drawCards, discardCards, get, getAll, transferResource, transferToken, stealResource, stealToken, trade, setMeta

**Use cases:** Game setup, resource management, trading economies, theft mechanics, agent state

---

### 🎮 [Game Actions](./actions/GAME.md) (9)
High-level game state management and lifecycle.

**Actions:** start, end, pause, resume, nextPhase, setProperty, mergeState, setState, getState

**Use cases:** Game flow control, phase transitions, win conditions, custom state tracking

**`game:setState`** — generic game-state writer. Lets game code write game-specific top-level state keys (`doc.watershed`, `doc.cuttle`) and nested field-level writes through `engine.dispatch()` instead of raw `session.change()`.

- **Payload:** `key` (top-level doc key to write, required) plus either `value` (whole-key write) or `patches` (batch of nested field writes). `replace` is only valid with `value`: `true` → `doc[key] = value` (overwrite), otherwise the value is merged into the existing key via `Object.assign`.
- **Patches shape:** `patches: [{ path: string[], value: any }]` — for each entry writes `doc[key].path[0]….path[n] = value`, creating missing objects along the way.
- **Semantics:** All writes happen in a single `session.change("game:setState", ...)`. Whole-key mode assigns `doc[key] = value` when `replace` is set or the key doesn't exist yet, else `Object.assign(doc[key], value)`. Field-level mode ensures `doc[key]` exists, then walks each patch path using `if (!cur[seg]) cur[seg] = {}`.
- **JSON sanitization:** Every value (whole-key `value` and each `patch.value`) is passed through `JSON.parse(JSON.stringify(v))` centrally, stripping `undefined` members that Automerge rejects. Non-serializable values throw `"value must be JSON-serializable"`.
- **Validation:** Throws clear errors: `"key required"`, `"value or patches required"`, `"use either value or patches, not both"`, `"replace is only valid with value"`, `"patches must be a non-empty array"`, `"each patch needs a non-empty string path"`, `"patch value required"`.
- **TS-only:** `game:setState` routes through the TS `ActionRegistry` (consistent with `game:setProperty`, `game:mergeState`).

```javascript
// Whole-key write
engine.dispatch("game:setState", { key: "watershed", value: { territories: [], turn: 1 } });

// Replace an existing key outright
engine.dispatch("game:setState", { key: "cuttle", value: { phase: "recruit" }, replace: true });

// Batch nested field-level writes
engine.dispatch("game:setState", {
  key: "watershed",
  patches: [
    { path: ["territories", "t1", "owner"], value: "Alice" },
    { path: ["turn"], value: 2 },
  ],
});
```

---

### 🔄 [Token Actions](./actions/TOKEN.md) (5)
Token transformation and relationship management.

**Actions:** transform, attach, detach, merge, split

**Use cases:** Equipment systems, status effects, crafting, combining/dividing resources

---

### 📊 [Batch Actions](./actions/BATCH.md) (8)
Collection operations and queries. The `tokens:*` actions are implemented in the TS `ActionRegistry` like every other action.

**Actions:** filter, map, forEach, collect, count, find, shuffle, draw

**Use cases:** Finding cards, batch modifications, counting resources, state queries, parallel operations

---

### 🔄 GameLoop Actions (7)
Game loop lifecycle management. These actions manage turn-based flow and are used internally by `GameLoop` via `engine.dispatch()`.

**Actions:** loopInit, loopStart, loopStop, nextTurn, setPhase, setMaxTurns, setActiveAgent

**Use cases:** Starting/stopping game loops, advancing turns, phase transitions, setting the active agent

```javascript
engine.dispatch("game:loopStart", {});
engine.dispatch("game:nextTurn", {});
engine.dispatch("game:setPhase", { phase: "betting" });
engine.dispatch("game:setActiveAgent", { index: 0 });
engine.dispatch("game:loopStop", { phase: "complete" });
```

---

### 📏 Rules Actions (2)
Rule engine state tracking.

**Actions:** markFired, initRules

**Use cases:** Recording which rules have fired, initializing rule state in the CRDT

```javascript
engine.dispatch("rule:initRules", {});
engine.dispatch("rule:markFired", { name: "low-health-warning", timestamp: Date.now() });
```

---

### 🐞 Debug Actions (1)
Debug helpers for the legacy JSON dispatch system.

**Actions:** log

**Use cases:** Logging payloads when `engine.debug` is enabled.

```javascript
engine.dispatch("debug:log", { message: "turn started" });
```

---

## Usage Patterns

### Common Workflows

**Starting a Card Game**
```javascript
// 1. Setup
engine.dispatch("game:start");
engine.dispatch("agent:create", { name: "Alice" });
engine.dispatch("agent:create", { name: "Bob" });

// 2. Shuffle and deal
engine.dispatch("stack:shuffle");
engine.dispatch("agent:drawCards", { name: "Alice", count: 5 });
engine.dispatch("agent:drawCards", { name: "Bob", count: 5 });
```

**Agent Trading**
```javascript
// Direct resource transfer
engine.dispatch("agent:transferResource", {
  from: "Alice",
  to: "Bob",
  resource: "gold",
  amount: 50
});

// Atomic trade
engine.dispatch("agent:trade", {
  agent1: "Alice",
  agent2: "Bob",
  offer1: { resource: "gold", amount: 100 },
  offer2: { resource: "wood", amount: 200 }
});
```

**Token Relationships**
```javascript
// Equip weapon
engine.dispatch("token:attach", {
  host: character,
  attachment: sword,
  attachmentType: "weapon"
});

// Power up
engine.dispatch("token:transform", {
  token: character,
  properties: { meta: { strength: 15 } }
});
```

**Batch Operations**
```javascript
// Find all red cards
const redCards = engine.dispatch("tokens:filter", {
  source: "hand",
  predicate: (token) => token.meta.color === "red"
});

// Count resources
const goldCount = engine.dispatch("tokens:count", {
  source: "agent-inventory",
  predicate: (token) => token.meta.type === "gold"
});
```

---

## Event System

Every successful dispatch emits `engine:action` on the engine, and every state mutation emits `state:updated`. Listen with `engine.on(...)` and filter on the action type:

```javascript
// Listen to all actions
engine.on("engine:action", (e) => {
  console.log(`Action: ${e.payload.type}`);
});

// Listen to a specific action
engine.on("engine:action", (e) => {
  const action = e.payload;
  if (action.type === "agent:transferResource") {
    const { from, to, resource, amount } = action.payload;
    console.log(`${from} transferred ${amount} ${resource} to ${to}`);
  }
});
```

**Common events:**
- `engine:action` — every successful dispatch (payload = the `Action`)
- `engine:error` — dispatch failures and unknown actions
- `state:updated` — session state changed (after each mutation)
- `game:started`, `game:ended`, `game:paused`, `game:resumed`, `game:phaseChanged`
- `turn:changed`, `loop:start`, `loop:stop`
- `rule:triggered`, `rule:error`, `rule:cleared`
- `policy:triggered`, `policy:error`
- `agent:beginTurn`
- `engine:undo`, `engine:restored`, `engine:compacted`, `engine:merged`, `engine:saved`

---

## Error Handling

Actions throw descriptive errors:

```javascript
try {
  engine.dispatch("agent:transferResource", {
    from: "Alice",
    to: "Bob",
    resource: "gold",
    amount: 1000
  });
} catch (error) {
  console.error(error.message);
  // "Agent 'Alice' has 100 gold but 1000 requested"
}
```

---

## Custom Actions

Extend the action registry:

```javascript
import { ActionRegistry } from './engine/ActionRegistry.js';

ActionRegistry['custom:myAction'] = (engine, payload) => {
  // Your logic here
  engine.eventBus?.emit('custom:myAction', payload);
  return result;
};

// Use it
engine.dispatch("custom:myAction", { ... });
```

---

## Testing

Run the test suite:

```bash
# Run all tests
npm test
```

---

## Quick Action Lookup

### By Use Case

**Card Games**
- Deal: `agent:drawCards`
- Shuffle: `stack:shuffle`
- Play: `space:place`
- Discard: `agent:discardCards`

**Resource Management**
- Give: `agent:giveResource`
- Take: `agent:takeResource`
- Transfer: `agent:transferResource` (resources) / `agent:transferToken` (tokens)
- Trade: `agent:trade`

**Token Lifecycle**
- Create: Use Token constructor
- Modify: `token:transform`
- Combine: `token:merge`
- Split: `token:split`
- Destroy: Remove from collections

**Queries**
- Find one: `tokens:find`
- Find many: `tokens:filter`
- Count: `tokens:count`
- Collect all: `tokens:collect`

**Game Flow**
- Start: `game:start`
- Phases: `game:nextPhase`
- End: `game:end`
- Pause: `game:pause`, `game:resume`

---

## Documentation Structure

Each category file includes:
- ✅ Complete action signatures
- ✅ Parameter descriptions
- ✅ Return values
- ✅ Code examples
- ✅ Use cases
- ✅ Related events
- ✅ Notes and gotchas

---

## Navigation

📖 **Action Categories:**
- [Stack Actions](./actions/stack.md)
- [Space Actions](./actions/TABLE.md)
- [Source Actions](./actions/SHOE.md)
- [Agent Actions](./actions/PLAYER.md)
- [Game Actions](./actions/GAME.md)
- [Token Actions](./actions/TOKEN.md)
- [Batch Actions](./actions/BATCH.md)

📚 **Other Documentation:**
- [Main README](../README.md)
- [Examples](../examples/)
- [Patterns](../patterns/)
- [Plugins](../plugins/)

---

**Total: 81 actions in the TS ActionRegistry — 100% complete and documented**

**Note:** Counts reflect the TypeScript `ActionRegistry` via `listActions()` (81 actions), including the 8 `tokens:*` Batch actions. All actions route through the single-path TS `ActionRegistry`, which mutates the Automerge Chronicle via `session.change()`.
