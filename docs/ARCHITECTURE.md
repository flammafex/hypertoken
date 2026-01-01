# HyperToken Architecture

This guide explains how HyperToken's components work together to power distributed game simulations.

## Overview

HyperToken is built around **CRDTs** (Conflict-free Replicated Data Types) that enable automatic state synchronization across multiple peers without a central server.

### Quick Reference

| Component | Purpose | Think of it as... |
|-----------|---------|-------------------|
| Token | Game entity | A playing card, chess piece, or item |
| Stack | Ordered collection | A deck of cards, draw pile |
| Space | Zones with positions | A game board, tableau |
| Source | Combined decks | A Blackjack shoe (multiple decks) |
| Chronicle | Synchronized state | The "database" that syncs across players |
| Engine | Game coordinator | The game master |

```
┌─────────────────────────────────────────────────────────────────┐
│                          Engine                                  │
│  Coordinates game logic, dispatches actions, manages networking │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│   ┌─────────┐    ┌─────────┐    ┌─────────┐    ┌─────────┐     │
│   │  Stack  │    │  Space  │    │ Source  │    │ Agents  │     │
│   │ (cards) │    │ (zones) │    │ (decks) │    │(players)│     │
│   └────┬────┘    └────┬────┘    └────┬────┘    └────┬────┘     │
│        │              │              │              │           │
│        └──────────────┴──────────────┴──────────────┘           │
│                              │                                   │
│                     ┌────────▼────────┐                         │
│                     │    Chronicle    │                         │
│                     │  (CRDT State)   │                         │
│                     └────────┬────────┘                         │
│                              │                                   │
└──────────────────────────────┼───────────────────────────────────┘
                               │
                    ┌──────────▼──────────┐
                    │   Network Layer     │
                    │  (P2P / WebSocket)  │
                    └─────────────────────┘
```

## Core Components

### Token

**What it is:** An immutable data structure representing any game entity—cards, pieces, items, characters.

**When to use:** Whenever you need to represent a discrete game object.

```javascript
import { Token } from './core/Token.js';

// Create a playing card
const aceOfSpades = new Token({
  id: 'ace-spades',
  label: 'Ace of Spades',
  group: 'spades',
  meta: { rank: 14, suit: 'spades' }
});

// Create a game piece
const knight = new Token({
  id: 'white-knight-1',
  label: 'Knight',
  kind: 'piece',
  meta: { color: 'white', movement: 'L-shape' }
});
```

**Key properties:**
- `id` - Unique identifier
- `label` - Human-readable name
- `group` - Category (suit, type, faction)
- `meta` - Arbitrary game data
- `_tags` - Runtime tags for filtering
- `_attachments` - Items attached to this token

---

### Chronicle

**What it is:** The CRDT state container. Wraps [Automerge](https://automerge.org/) to provide automatic conflict resolution when multiple peers modify state simultaneously.

**When to use:** You rarely interact with Chronicle directly—Stack, Space, and Source use it internally.

```javascript
import { Chronicle } from './core/Chronicle.js';

// Create a session (shared state container)
const session = new Chronicle();

// All changes go through session.change()
session.change("draw a card", (doc) => {
  doc.hand.push(card);
});

// State auto-syncs with other peers
session.on('state:changed', ({ doc, source }) => {
  console.log('State updated from:', source); // 'local', 'merge', or 'load'
});
```

**Why CRDTs matter:**
- No central server needed
- Automatic conflict resolution
- Offline-capable (changes merge when reconnected)
- Deterministic state across all peers

---

### Stack

**What it is:** A CRDT-backed ordered collection of tokens. Think: deck of cards, draw pile, discard pile.

**When to use:** Card games, any ordered token collection.

```javascript
import { Chronicle } from './core/Chronicle.js';
import { Stack } from './core/Stack.js';
import { Token } from './core/Token.js';

// Create tokens
const cards = [
  new Token({ id: 'card-1', label: 'Ace', meta: { rank: 1 } }),
  new Token({ id: 'card-2', label: 'King', meta: { rank: 13 } }),
  // ...
];

// Create stack with Chronicle session
const session = new Chronicle();
const deck = new Stack(session, cards);

// Operations
deck.shuffle();              // Randomize order
const card = deck.draw();    // Draw one card
const hand = deck.draw(5);   // Draw multiple cards
deck.burn(2);                // Discard from top without drawing
deck.discard(card);          // Add to discard pile
deck.reset();                // Restore to original state
```

**State structure:**
```javascript
session.state.stack = {
  stack: [...],    // Cards remaining
  drawn: [...],    // Cards drawn
  discards: [...]  // Cards discarded
};
```

**Stack vs Array:**

| Need | Use Stack | Use Array |
|------|-----------|-----------|
| Draw/discard semantics | ✓ | |
| Shuffle with seed | ✓ | |
| CRDT sync | ✓ | |
| Simple list | | ✓ |
| No sync needed | | ✓ |

---

### Space

**What it is:** A CRDT-backed 2D zone manager. Think: game board, play areas, tableau.

**When to use:** Board games, spatial card layouts, any game with zones.

```javascript
import { Chronicle } from './core/Chronicle.js';
import { Space } from './core/Space.js';

const session = new Chronicle();
const board = new Space(session, 'game-board');

// Create zones
board.createZone('hand');
board.createZone('battlefield');
board.createZone('graveyard');

// Place tokens in zones
const placement = board.place('hand', card, {
  x: 0,
  y: 0,
  faceUp: true
});

// Move between zones
board.move('hand', 'battlefield', placement.id);

// Flip face up/down
board.flip('battlefield', placement.id);

// Zone operations
board.shuffleZone('hand');
board.clearZone('graveyard');
board.lockZone('deck');  // Prevent modifications
```

**State structure:**
```javascript
session.state.zones = {
  'hand': [{ id, tokenId, tokenSnapshot, x, y, faceUp, ... }],
  'battlefield': [...],
  // ...
};
```

**Stack vs Space:**

| Need | Use Stack | Use Space |
|------|-----------|-----------|
| Cards have positions (x, y) | | ✓ |
| Cards belong to named zones | | ✓ |
| Cards can be face up/down | | ✓ |
| Simple draw pile | ✓ | |
| Order is all that matters | ✓ | |

---

### Source

**What it is:** A CRDT-backed multi-stack manager with reshuffle policies. Think: shoe in Blackjack, combined decks.

**When to use:** When you need multiple decks combined, or automatic reshuffling.

```javascript
import { Chronicle } from './core/Chronicle.js';
import { Stack } from './core/Stack.js';
import { Source } from './core/Source.js';

const session = new Chronicle();
const deck1 = new Stack(session, cards1);
const deck2 = new Stack(session, cards2);

// Combine decks into a source
const shoe = new Source(session, [deck1, deck2]);

// Configure auto-reshuffle when 10 cards remain
shoe.reshuffleWhen(10, { mode: 'auto' });

// Draw from combined source
const card = shoe.draw();
shoe.shuffle();
shoe.burn(2);
```

**Stack vs Source:**

| Need | Use Stack | Use Source |
|------|-----------|------------|
| Single deck | ✓ | |
| Multiple decks combined | | ✓ |
| Auto-reshuffle | | ✓ |
| Burn pile separate | ✓ | ✓ |

---

### Engine

**What it is:** The game coordinator. Manages components, dispatches actions, handles networking.

**When to use:** Every game needs an Engine.

```javascript
import { Engine } from './engine/Engine.js';
import { Stack } from './core/Stack.js';
import { Chronicle } from './core/Chronicle.js';

// Create components
const session = new Chronicle();
const deck = new Stack(session, cards);

// Create engine
const engine = new Engine({ stack: deck });

// Dispatch actions (async, supports WASM acceleration)
await engine.dispatch('stack:shuffle');
const card = await engine.dispatch('stack:draw');
const hand = await engine.dispatch('stack:draw', { count: 5 });

// Connect to multiplayer server
engine.connect('ws://localhost:8080');

// Listen for events
engine.on('state:updated', () => console.log('State changed'));
engine.on('net:ready', () => console.log('Connected to server'));
```

**Key features:**
- **Action dispatch**: Unified interface for all game operations
- **WASM acceleration**: Optional Rust-powered performance
- **Networking**: Built-in P2P and WebSocket support
- **Policies**: Register game rules that evaluate after each action
- **History**: Undo/redo support

---

## Data Flow

### Single Player

```
User Action → Engine.dispatch() → Action applied → State updated
                                        │
                                        ▼
                               Chronicle.change()
                                        │
                                        ▼
                               Event emitted
```

### Multiplayer

```
Local Action → Engine.dispatch() → Chronicle.change() → Network sync
                                                              │
                                                              ▼
                                                        Other peers
                                                              │
                                                              ▼
                                                   Chronicle.merge()
                                                              │
                                                              ▼
                                                    State converges
```

---

## Action Types

Engine dispatches actions by type. Common patterns:

### Stack Actions
```javascript
await engine.dispatch('stack:draw', { count: 1 });
await engine.dispatch('stack:shuffle', { seed: 12345 });
await engine.dispatch('stack:burn', { count: 2 });
await engine.dispatch('stack:reset');
```

### Space Actions
```javascript
await engine.dispatch('space:place', { zone: 'hand', token });
await engine.dispatch('space:move', { fromZone: 'hand', toZone: 'play', placementId });
await engine.dispatch('space:flip', { zone: 'play', placementId });
await engine.dispatch('space:createZone', { name: 'discard' });
```

### Agent Actions
```javascript
await engine.dispatch('agent:create', { id: 'p1', name: 'Alice' });
await engine.dispatch('agent:giveResource', { name: 'Alice', resource: 'gold', amount: 100 });
await engine.dispatch('agent:drawCards', { name: 'Alice', count: 5 });
```

### Game Actions
```javascript
await engine.dispatch('game:start');
await engine.dispatch('game:nextPhase', { phase: 'combat' });
await engine.dispatch('game:end', { winner: 'Alice', reason: 'victory' });
```

See [engine/ACTIONS.md](../engine/ACTIONS.md) for the complete action reference.

---

## Choosing Components

| Need | Use |
|------|-----|
| Individual game objects | Token |
| Ordered draw/discard pile | Stack |
| Board with zones | Space |
| Multiple combined decks | Source |
| Game coordination | Engine |

### Decision Tree

```
Do you need to represent a game object?
  └─ Yes → Token

Do you have an ordered collection (deck, pile)?
  ├─ Single deck → Stack
  └─ Multiple decks combined → Source

Do you have zones or a board?
  └─ Yes → Space

Do you need multiplayer sync?
  └─ Chronicle (used internally by Stack/Space/Source)

Building a game?
  └─ Engine (coordinates everything)
```

### Common Patterns

**Card game (Blackjack, Poker):**
```javascript
const engine = new Engine({ stack: deck });
```

**Board game (Chess, Go):**
```javascript
const engine = new Engine({ space: board });
```

**Complex card game (Magic, Hearthstone):**
```javascript
const engine = new Engine({
  stack: deck,      // Draw pile
  space: board      // Battlefield, hand zones
});
```

**Casino game (Blackjack shoe):**
```javascript
const engine = new Engine({ source: shoe });
```

---

## Extending HyperToken

HyperToken can be customized with custom actions, rules, policies, and agents. See the [Extending Guide](./EXTENDING.md) for details on:

- Registering custom actions
- Creating game rules with RuleEngine
- Adding policies that evaluate after each action
- Building AI agents

---

## Performance

### WASM Acceleration

HyperToken includes optional Rust-compiled WASM for performance-critical operations:

```javascript
const engine = new Engine({
  stack: deck,
  useWorker: true  // Enable multi-threaded WASM
});
```

### When to Use WASM

- Large token collections (1000+ cards)
- High-frequency operations (AI training)
- Complex batch operations

For typical games, TypeScript is fast enough.

---

## Next Steps

- [Getting Started](./GETTING_STARTED.md) - Installation and quick start
- [First Game Tutorial](./FIRST_GAME.md) - Build your first game
- [Actions Reference](../engine/ACTIONS.md) - All available actions
- [Worker Mode](./WORKER_MODE.md) - WASM performance optimization
