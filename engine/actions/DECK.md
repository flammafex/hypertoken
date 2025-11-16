# Deck Actions

Operations on the primary card deck. The deck is a stack-based collection with shuffling, drawing, and manipulation capabilities.

[← Back to Action Reference](../ACTIONS.md)

---

## Actions (10)

1. [deck:shuffle](#deckshuffle) - Randomize deck order
2. [deck:draw](#deckdraw) - Draw cards from top
3. [deck:reset](#deckreset) - Reset to original state
4. [deck:burn](#deckburn) - Discard cards without drawing
5. [deck:peek](#deckpeek) - Look at top cards
6. [deck:cut](#deckcut) - Cut the deck
7. [deck:insertAt](#deckinsertat) - Insert card at position
8. [deck:removeAt](#deckremoveat) - Remove card at position
9. [deck:swap](#deckswap) - Swap two cards
10. [deck:reverse](#deckreverse) - Reverse deck order

---

## `deck:shuffle`

Randomize the order of cards in the deck.

```javascript
// Random shuffle
engine.dispatch("deck:shuffle");

// Deterministic shuffle with seed
engine.dispatch("deck:shuffle", { seed: 42 });
```

**Parameters:**
- `seed` (number, optional): Seed for deterministic shuffle

**Returns:** void

**Events:** `deck:shuffled`

**Use cases:** 
- Start of game
- After collecting discards
- Reproducible simulations (with seed)

**Example:**
```javascript
const engine = new Engine({ deck: myDeck });

// Random shuffle
engine.dispatch("deck:shuffle");

// Same shuffle every time
engine.dispatch("deck:shuffle", { seed: 12345 });
```

---

## `deck:draw`

Draw one or more cards from the top of the deck.

```javascript
// Draw 1 card
const card = engine.dispatch("deck:draw");

// Draw 5 cards
const cards = engine.dispatch("deck:draw", { count: 5 });
```

**Parameters:**
- `count` (number, default: 1): Number of cards to draw

**Returns:** 
- Single card if count=1
- Array of cards if count>1

**Events:** `deck:draw`

**Use cases:**
- Player draws cards
- Dealing hands
- Revealing cards

**Example:**
```javascript
// Deal starting hands
const aliceHand = engine.dispatch("deck:draw", { count: 7 });
const bobHand = engine.dispatch("deck:draw", { count: 7 });
```

---

## `deck:reset`

Reset deck to original unshuffled state.

```javascript
engine.dispatch("deck:reset");
```

**Parameters:** none

**Returns:** void

**Events:** `deck:reset`

**Use cases:**
- Starting a new game
- Practice mode
- Testing specific card orders

**Example:**
```javascript
// Play a round
engine.dispatch("deck:shuffle");
playGame();

// Reset for next game
engine.dispatch("deck:reset");
```

---

## `deck:burn`

Discard N cards from top of deck without drawing them.

```javascript
// Burn 1 card
engine.dispatch("deck:burn");

// Burn 3 cards
engine.dispatch("deck:burn", { count: 3 });
```

**Parameters:**
- `count` (number, default: 1): Number of cards to burn

**Returns:** void

**Events:** `deck:burn`

**Use cases:**
- Poker (burn before flop/turn/river)
- Casino procedures
- Discarding unknown cards
- Anti-cheating measures

**Example:**
```javascript
// Texas Hold'em
engine.dispatch("deck:burn");  // Burn before flop
const flop = engine.dispatch("deck:draw", { count: 3 });
```

---

## `deck:peek`

Look at top N cards without removing them.

```javascript
// Peek at top card
const topCard = engine.dispatch("deck:peek");

// Peek at top 3 cards
const top3 = engine.dispatch("deck:peek", { count: 3 });
```

**Parameters:**
- `count` (number, default: 1): Number of cards to peek at

**Returns:** Array of cards (deck unchanged)

**Events:** `deck:peeked`

**Use cases:**
- Scrying abilities
- AI planning
- Looking ahead
- Card counting

**Example:**
```javascript
// AI looks ahead to decide strategy
const nextCard = engine.dispatch("deck:peek");
if (nextCard.meta.value >= 10) {
  // Play aggressively
}
```

---

## `deck:cut`

Cut the deck at a position.

```javascript
// Cut at middle
engine.dispatch("deck:cut");

// Cut at specific position
engine.dispatch("deck:cut", { position: 26, topToBottom: true });
```

**Parameters:**
- `position` (number, optional): Where to cut (default: middle)
- `topToBottom` (boolean, default: true): Direction of cut

**Returns:** void

**Events:** `deck:cut`

**Use cases:**
- Traditional deck cutting
- Shuffling variations
- Casino procedures

**Example:**
```javascript
// Traditional shuffle + cut
engine.dispatch("deck:shuffle");
engine.dispatch("deck:cut");
```

---

## `deck:insertAt`

Insert a card at a specific position in the deck.

```javascript
engine.dispatch("deck:insertAt", { 
  card: myCard, 
  position: 5 
});
```

**Parameters:**
- `card` (Token, required): Card to insert
- `position` (number, default: 0): Index to insert at (0 = top)

**Returns:** void

**Events:** `deck:inserted`

**Use cases:**
- Putting cards back
- Magical effects ("place on top of deck")
- Deck manipulation
- Tutoring effects

**Example:**
```javascript
// "Search your deck for a card and put it on top"
const searchedCard = findCardInDeck(engine.deck);
engine.dispatch("deck:insertAt", { 
  card: searchedCard, 
  position: 0 
});
```

---

## `deck:removeAt`

Remove and return card at specific position.

```javascript
const card = engine.dispatch("deck:removeAt", { position: 10 });
```

**Parameters:**
- `position` (number, default: 0): Index to remove from

**Returns:** The removed card

**Events:** `deck:removed`

**Use cases:**
- Removing specific cards
- Deck manipulation
- Extracting cards by position

**Example:**
```javascript
// Remove bottom card
const deckSize = engine.deck.cards.length;
const bottomCard = engine.dispatch("deck:removeAt", { 
  position: deckSize - 1 
});
```

---

## `deck:swap`

Swap two cards in the deck by position.

```javascript
engine.dispatch("deck:swap", { 
  position1: 0, 
  position2: 10 
});
```

**Parameters:**
- `position1` (number, required): First card position
- `position2` (number, required): Second card position

**Returns:** void

**Events:** `deck:swapped`

**Use cases:**
- Deck manipulation
- Magical effects
- Reordering specific cards

**Example:**
```javascript
// Swap top and bottom cards
const last = engine.deck.cards.length - 1;
engine.dispatch("deck:swap", { 
  position1: 0, 
  position2: last 
});
```

---

## `deck:reverse`

Reverse the entire deck order.

```javascript
engine.dispatch("deck:reverse");
```

**Parameters:** none

**Returns:** void

**Events:** `deck:reversed`

**Use cases:**
- Deck manipulation
- Special abilities
- Chaos effects

**Example:**
```javascript
// Flip deck upside down
engine.dispatch("deck:reverse");
```

---

## Common Patterns

### Standard Game Setup
```javascript
const deck = new Deck(createStandardCards());
const engine = new Engine({ deck });

engine.dispatch("deck:shuffle");
// Deal to players...
```

### Deterministic Shuffle (for testing)
```javascript
// Always the same shuffle
engine.dispatch("deck:shuffle", { seed: 42 });
// Cards will be in identical order every run
```

### Card Counting / Peeking
```javascript
// Count high cards remaining
const remaining = engine.deck.cards.length;
const next5 = engine.dispatch("deck:peek", { count: 5 });
const highCards = next5.filter(c => c.meta.value >= 10).length;

console.log(`${highCards} high cards in next 5`);
```

### Manipulate Deck Order
```javascript
// Put specific card on top
const aceOfSpades = findCard(engine.deck, 'ace-spades');
engine.dispatch("deck:removeAt", { position: aceIndex });
engine.dispatch("deck:insertAt", { card: aceOfSpades, position: 0 });
```

---

[← Back to Action Reference](../ACTIONS.md)