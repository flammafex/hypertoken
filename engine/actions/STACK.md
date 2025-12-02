# Stack Actions

Operations on the primary card stack. The stack is a stack-based collection with shuffling, drawing, and manipulation capabilities.

[← Back to Action Reference](../ACTIONS.md)

---

## Actions (10)

1. [stack:shuffle](#stackshuffle) - Randomize stack order
2. [stack:draw](#stackdraw) - Draw cards from top
3. [stack:reset](#stackreset) - Reset to original state
4. [stack:burn](#stackburn) - Discard cards without drawing
5. [stack:peek](#stackpeek) - Look at top cards
6. [stack:cut](#stackcut) - Cut the stack
7. [stack:insertAt](#stackinsertat) - Insert card at position
8. [stack:removeAt](#stackremoveat) - Remove card at position
9. [stack:swap](#stackswap) - Swap two cards
10. [stack:reverse](#stackreverse) - Reverse stack order

---

## `stack:shuffle`

Randomize the order of cards in the stack.

```javascript
// Random shuffle
engine.dispatch("stack:shuffle");

// Deterministic shuffle with seed
engine.dispatch("stack:shuffle", { seed: 42 });
```

**Parameters:**
- `seed` (number, optional): Seed for deterministic shuffle

**Returns:** void

**Events:** `stack:shuffled`

**Use cases:** 
- Start of game
- After collecting discards
- Reproducible simulations (with seed)

**Example:**
```javascript
const engine = new Engine({ stack: myStack });

// Random shuffle
engine.dispatch("stack:shuffle");

// Same shuffle every time
engine.dispatch("stack:shuffle", { seed: 12345 });
```

---

## `stack:draw`

Draw one or more cards from the top of the stack.

```javascript
// Draw 1 card
const card = engine.dispatch("stack:draw");

// Draw 5 cards
const cards = engine.dispatch("stack:draw", { count: 5 });
```

**Parameters:**
- `count` (number, default: 1): Number of cards to draw

**Returns:** 
- Single card if count=1
- Array of cards if count>1

**Events:** `stack:draw`

**Use cases:**
- Agent draws cards
- Dealing hands
- Revealing cards

**Example:**
```javascript
// Deal starting hands
const aliceHand = engine.dispatch("stack:draw", { count: 7 });
const bobHand = engine.dispatch("stack:draw", { count: 7 });
```

---

## `stack:reset`

Reset stack to original unshuffled state.

```javascript
engine.dispatch("stack:reset");
```

**Parameters:** none

**Returns:** void

**Events:** `stack:reset`

**Use cases:**
- Starting a new game
- Practice mode
- Testing specific card orders

**Example:**
```javascript
// Play a round
engine.dispatch("stack:shuffle");
playGame();

// Reset for next game
engine.dispatch("stack:reset");
```

---

## `stack:burn`

Discard N cards from top of stack without drawing them.

```javascript
// Burn 1 card
engine.dispatch("stack:burn");

// Burn 3 cards
engine.dispatch("stack:burn", { count: 3 });
```

**Parameters:**
- `count` (number, default: 1): Number of cards to burn

**Returns:** void

**Events:** `stack:burn`

**Use cases:**
- Poker (burn before flop/turn/river)
- Casino procedures
- Discarding unknown cards
- Anti-cheating measures

**Example:**
```javascript
// Texas Hold'em
engine.dispatch("stack:burn");  // Burn before flop
const flop = engine.dispatch("stack:draw", { count: 3 });
```

---

## `stack:peek`

Look at top N cards without removing them.

```javascript
// Peek at top card
const topCard = engine.dispatch("stack:peek");

// Peek at top 3 cards
const top3 = engine.dispatch("stack:peek", { count: 3 });
```

**Parameters:**
- `count` (number, default: 1): Number of cards to peek at

**Returns:** Array of cards (stack unchanged)

**Events:** `stack:peeked`

**Use cases:**
- Scrying abilities
- AI planning
- Looking ahead
- Card counting

**Example:**
```javascript
// AI looks ahead to decide strategy
const nextCard = engine.dispatch("stack:peek");
if (nextCard.meta.value >= 10) {
  // Play aggressively
}
```

---

## `stack:cut`

Cut the stack at a position.

```javascript
// Cut at middle
engine.dispatch("stack:cut");

// Cut at specific position
engine.dispatch("stack:cut", { position: 26, topToBottom: true });
```

**Parameters:**
- `position` (number, optional): Where to cut (default: middle)
- `topToBottom` (boolean, default: true): Direction of cut

**Returns:** void

**Events:** `stack:cut`

**Use cases:**
- Traditional stack cutting
- Shuffling variations
- Casino procedures

**Example:**
```javascript
// Traditional shuffle + cut
engine.dispatch("stack:shuffle");
engine.dispatch("stack:cut");
```

---

## `stack:insertAt`

Insert a card at a specific position in the stack.

```javascript
engine.dispatch("stack:insertAt", { 
  card: myCard, 
  position: 5 
});
```

**Parameters:**
- `card` (Token, required): Card to insert
- `position` (number, default: 0): Index to insert at (0 = top)

**Returns:** void

**Events:** `stack:inserted`

**Use cases:**
- Putting cards back
- Magical effects ("place on top of stack")
- Stack manipulation
- Tutoring effects

**Example:**
```javascript
// "Search your stack for a card and put it on top"
const searchedCard = findCardInStack(engine.stack);
engine.dispatch("stack:insertAt", { 
  card: searchedCard, 
  position: 0 
});
```

---

## `stack:removeAt`

Remove and return card at specific position.

```javascript
const card = engine.dispatch("stack:removeAt", { position: 10 });
```

**Parameters:**
- `position` (number, default: 0): Index to remove from

**Returns:** The removed card

**Events:** `stack:removed`

**Use cases:**
- Removing specific cards
- Stack manipulation
- Extracting cards by position

**Example:**
```javascript
// Remove bottom card
const stackSize = engine.stack.cards.length;
const bottomCard = engine.dispatch("stack:removeAt", { 
  position: stackSize - 1 
});
```

---

## `stack:swap`

Swap two cards in the stack by position.

```javascript
engine.dispatch("stack:swap", { 
  position1: 0, 
  position2: 10 
});
```

**Parameters:**
- `position1` (number, required): First card position
- `position2` (number, required): Second card position

**Returns:** void

**Events:** `stack:swapped`

**Use cases:**
- Stack manipulation
- Magical effects
- Reordering specific cards

**Example:**
```javascript
// Swap top and bottom cards
const last = engine.stack.cards.length - 1;
engine.dispatch("stack:swap", { 
  position1: 0, 
  position2: last 
});
```

---

## `stack:reverse`

Reverse the entire stack order.

```javascript
engine.dispatch("stack:reverse");
```

**Parameters:** none

**Returns:** void

**Events:** `stack:reversed`

**Use cases:**
- Stack manipulation
- Special abilities
- Chaos effects

**Example:**
```javascript
// Flip stack upside down
engine.dispatch("stack:reverse");
```

---

## Common Patterns

### Standard Game Setup
```javascript
const stack = new Stack(createStandardCards());
const engine = new Engine({ stack });

engine.dispatch("stack:shuffle");
// Deal to agents...
```

### Deterministic Shuffle (for testing)
```javascript
// Always the same shuffle
engine.dispatch("stack:shuffle", { seed: 42 });
// Cards will be in identical order every run
```

### Card Counting / Peeking
```javascript
// Count high cards remaining
const remaining = engine.stack.cards.length;
const next5 = engine.dispatch("stack:peek", { count: 5 });
const highCards = next5.filter(c => c.meta.value >= 10).length;

console.log(`${highCards} high cards in next 5`);
```

### Manipulate Stack Order
```javascript
// Put specific card on top
const aceOfSpades = findCard(engine.stack, 'ace-spades');
engine.dispatch("stack:removeAt", { position: aceIndex });
engine.dispatch("stack:insertAt", { card: aceOfSpades, position: 0 });
```

---

[← Back to Action Reference](../ACTIONS.md)
