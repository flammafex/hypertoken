# HyperToken Action Reference

Complete documentation for all 58 built-in actions in the HyperToken engine.

---

## Quick Reference

### By Category

| Category | Count | Documentation |
|----------|-------|---------------|
| **Deck** | 10 | [Deck Actions](./actions/DECK.md) |
| **Table** | 13 | [Table Actions](./actions/TABLE.md) |
| **Shoe** | 7 | [Shoe Actions](./actions/SHOE.md) |
| **Player** | 12 | [Player Actions](./actions/PLAYER.md) |
| **Game** | 6 | [Game Actions](./actions/GAME.md) |
| **Token** | 5 | [Token Actions](./actions/TOKEN.md) |
| **Batch** | 5 | [Batch Actions](./actions/BATCH.md) |
| **Total** | **58** | **100% Complete** |

---

## Action Categories

### 🎴 [Deck Actions](./actions/DECK.md) (10)
Operations on the primary card deck.

**Actions:** shuffle, draw, reset, burn, peek, cut, insertAt, removeAt, swap, reverse

**Use cases:** Shuffling at game start, drawing cards, deck manipulation, dealer procedures

---

### 🎯 [Table Actions](./actions/TABLE.md) (13)
Operations on the game table and zones.

**Actions:** place, clear, move, flip, remove, createZone, deleteZone, clearZone, shuffleZone, transferZone, fanZone, stackZone, spreadZone, lockZone

**Use cases:** Playing cards to zones, moving pieces on board, arranging layouts, zone management

---

### 👟 [Shoe Actions](./actions/SHOE.md) (7)
Operations on multi-deck containers.

**Actions:** draw, shuffle, burn, reset, addDeck, removeDeck, inspect

**Use cases:** Casino games with multiple decks, blackjack, baccarat, weighted randomness

---

### 👥 [Player Actions](./actions/PLAYER.md) (12)
Player management and player-to-player interactions.

**Actions:** create, remove, setActive, giveResource, takeResource, drawCards, discardCards, get, transfer, trade, steal

**Use cases:** Game setup, resource management, trading economies, theft mechanics, player state

---

### 🎮 [Game Actions](./actions/GAME.md) (6)
High-level game state management and lifecycle.

**Actions:** start, end, pause, resume, nextPhase, setProperty

**Use cases:** Game flow control, phase transitions, win conditions, custom state tracking

---

### 🔄 [Token Actions](./actions/TOKEN.md) (5)
Token transformation and relationship management.

**Actions:** transform, attach, detach, merge, split

**Use cases:** Equipment systems, status effects, crafting, combining/dividing resources

---

### 📊 [Batch Actions](./actions/BATCH.md) (5)
Collection operations and queries.

**Actions:** filter, forEach, collect, count, find

**Use cases:** Finding cards, batch modifications, counting resources, state queries

---

## Usage Patterns

### Common Workflows

**Starting a Card Game**
```javascript
// 1. Setup
engine.dispatch("game:start");
engine.dispatch("player:create", { name: "Alice" });
engine.dispatch("player:create", { name: "Bob" });

// 2. Shuffle and deal
engine.dispatch("deck:shuffle");
engine.dispatch("player:drawCards", { name: "Alice", count: 5 });
engine.dispatch("player:drawCards", { name: "Bob", count: 5 });
```

**Player Trading**
```javascript
// Direct transfer
engine.dispatch("player:transfer", {
  from: "Alice",
  to: "Bob",
  resource: "gold",
  amount: 50
});

// Atomic trade
engine.dispatch("player:trade", {
  player1: { name: "Alice", offer: { resource: "gold", amount: 100 } },
  player2: { name: "Bob", offer: { resource: "wood", amount: 200 } }
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
  source: "player-inventory",
  predicate: (token) => token.meta.type === "gold"
});
```

---

## Event System

All actions emit events through the EventBus. Listen for them:

```javascript
// Listen to specific action
engine.eventBus.on("player:transfer", (data) => {
  console.log(`${data.from} transferred to ${data.to}`);
});

// Listen to all actions
engine.eventBus.on("action:dispatched", (action) => {
  console.log(`Action: ${action.type}`);
});
```

**Common events:**
- `deck:shuffled`
- `player:transfer`
- `player:trade`
- `player:steal`
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
  engine.dispatch("player:transfer", {
    from: "Alice",
    to: "Bob",
    resource: "gold",
    amount: 1000
  });
} catch (error) {
  console.error(error.message);
  // "Player Alice only has 100 gold, cannot transfer 1000"
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

All 58 actions have comprehensive tests:

```bash
# Run all tests
npm test

# Test specific categories
node test/testTokenActions.js      # 15 tests
node test/testBatchActions.js      # 19 tests
node test/testPlayerTransfers.js   # 14 tests
```

---

## Quick Action Lookup

### By Use Case

**Card Games**
- Deal: `player:drawCards`
- Shuffle: `deck:shuffle`
- Play: `table:place`
- Discard: `player:discardCards`

**Resource Management**
- Give: `player:giveResource`
- Take: `player:takeResource`
- Transfer: `player:transfer`
- Trade: `player:trade`

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
- [Deck Actions](./actions/DECK.md)
- [Table Actions](./actions/TABLE.md)
- [Shoe Actions](./actions/SHOE.md)
- [Player Actions](./actions/PLAYER.md)
- [Game Actions](./actions/GAME.md)
- [Token Actions](./actions/TOKEN.md)
- [Batch Actions](./actions/BATCH.md)

📚 **Other Documentation:**
- [Main README](../README.md)
- [Examples](../examples/)
- [Patterns](../patterns/)
- [Plugins](../plugins/)

---

**Total: 58 actions - 100% complete and documented**