# HyperToken Action Reference

Complete documentation for all 76+ built-in actions in the HyperToken engine.

---

## Quick Reference

### By Category

| Category | Count | Documentation |
|----------|-------|---------------|
| **Stack** | 10 | [Stack Actions](./actions/stack.md) |
| **Space** | 14 | [Space Actions](./actions/TABLE.md) |
| **Source** | 7 | [Source Actions](./actions/SHOE.md) |
| **Agent** | 16 | [Agent Actions](./actions/PLAYER.md) |
| **Game** | 7 | [Game Actions](./actions/GAME.md) |
| **GameLoop** | 7 | Game loop lifecycle (loopInit, loopStart, loopStop, nextTurn, setPhase, setMaxTurns, setActiveAgent) |
| **Rules** | 2 | Rule engine state (markFired, initRules) |
| **Token** | 5 | [Token Actions](./actions/TOKEN.md) |
| **Batch** | 8 | [Batch Actions](./actions/BATCH.md) |
| **Total** | **76** | **100% Complete** |

---

## Action Categories

### 🎴 [Stack Actions](./actions/stack.md) (10)
Operations on the primary card stack.

**Actions:** shuffle, draw, reset, burn, peek, cut, insertAt, removeAt, swap, reverse

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

### 👥 [Agent Actions](./actions/PLAYER.md) (16)
Agent management and agent-to-agent interactions.

**Actions:** create, remove, setActive, giveResource, takeResource, addToken, removeToken, drawCards, discardCards, get, getAll, transferResource, transferToken, stealResource, stealToken, trade

**Use cases:** Game setup, resource management, trading economies, theft mechanics, agent state

---

### 🎮 [Game Actions](./actions/GAME.md) (7)
High-level game state management and lifecycle.

**Actions:** start, end, pause, resume, nextPhase, setProperty, getState

**Use cases:** Game flow control, phase transitions, win conditions, custom state tracking

---

### 🔄 [Token Actions](./actions/TOKEN.md) (5)
Token transformation and relationship management.

**Actions:** transform, attach, detach, merge, split

**Use cases:** Equipment systems, status effects, crafting, combining/dividing resources

---

### 📊 [Batch Actions](./actions/BATCH.md) (8)
Collection operations and queries.

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
// Direct transfer
engine.dispatch("agent:transfer", {
  from: "Alice",
  to: "Bob",
  resource: "gold",
  amount: 50
});

// Atomic trade
engine.dispatch("agent:trade", {
  agent1: { name: "Alice", offer: { resource: "gold", amount: 100 } },
  agent2: { name: "Bob", offer: { resource: "wood", amount: 200 } }
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

All actions emit events through the EventBus. Listen for them:

```javascript
// Listen to specific action
engine.eventBus.on("agent:transfer", (data) => {
  console.log(`${data.from} transferred to ${data.to}`);
});

// Listen to all actions
engine.eventBus.on("action:dispatched", (action) => {
  console.log(`Action: ${action.type}`);
});
```

**Common events:**
- `stack:shuffled`
- `agent:transfer`
- `agent:trade`
- `agent:steal`
- `token:transformed`
- `token:attached`
- `token:merged`
- `token:split`
- `tokens:filtered`
- `action:dispatched`
- `action:error`

---

## Error Handling

Actions throw descriptive errors:

```javascript
try {
  engine.dispatch("agent:transfer", {
    from: "Alice",
    to: "Bob",
    resource: "gold",
    amount: 1000
  });
} catch (error) {
  console.error(error.message);
  // "Agent Alice only has 100 gold, cannot transfer 1000"
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
- Transfer: `agent:transfer`
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

**Total: 76 actions - 100% complete and documented**

**Note:** An additional debug action (`debug:log`) exists in the legacy JSON dispatch system. The 76 actions listed here include 67 original actions plus 9 new GameLoop/Rules actions added for the incremental Chronicle CRDT integration. Actions route through dual-path dispatch: WASM Chronicle (incremental field-level ops) or TS ActionRegistry fallback.
