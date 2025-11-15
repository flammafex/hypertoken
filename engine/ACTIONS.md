# HyperToken Action Reference

Complete documentation for all 45 built-in actions in the HyperToken engine.

---

## Action Registry

**Total: 55 actions across 7 categories**

| Category | Count | Actions |
|----------|-------|---------|
| **Deck** | 10 | shuffle, draw, reset, burn, peek, cut, insertAt, removeAt, swap, reverse |
| **Table** | 13 | place, clear, move, flip, remove, zone management, locking |
| **Shoe** | 7 | draw, shuffle, burn, reset, addDeck, removeDeck, inspect |
| **Player** | 9 | create, remove, setActive, giveResource, takeResource, drawCards, discardCards, get |
| **Game** | 6 | start, end, pause, resume, nextPhase, setProperty |
| **Token** | 5 | transform, attach, detach, merge, split |
| **Batch** | 5 | filter, forEach, collect, count, find |
| **TOTAL** | **55** | **100% Complete** ✅ |
---

## Deck Actions

Operations on the primary card deck.

### `deck:shuffle`

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

**Use cases:** Start of game, after collecting discards

---

### `deck:draw`

Draw one or more cards from the top of the deck.

```javascript
// Draw 1 card
const card = engine.dispatch("deck:draw");

// Draw 5 cards
const cards = engine.dispatch("deck:draw", { count: 5 });
```

**Parameters:**
- `count` (number, default: 1): Number of cards to draw

**Returns:** Single card (if count=1) or array of cards

**Use cases:** Player draws cards, dealing hands

---

### `deck:reset`

Reset deck to original unshuffled state.

```javascript
engine.dispatch("deck:reset");
```

**Parameters:** none

**Returns:** void

**Use cases:** Starting a new game, practice mode

---

### `deck:burn`

Discard N cards from top of deck without drawing them (they go to discard pile).

```javascript
// Burn 1 card
engine.dispatch("deck:burn");

// Burn 3 cards
engine.dispatch("deck:burn", { count: 3 });
```

**Parameters:**
- `count` (number, default: 1): Number of cards to burn

**Returns:** void

**Use cases:** Casino-style games, cut card procedures

---

### `deck:peek`

Look at the top N cards without removing them from the deck.

```javascript
// Peek at top card
const card = engine.dispatch("deck:peek");

// Peek at top 3 cards
const cards = engine.dispatch("deck:peek", { count: 3 });
```

**Parameters:**
- `count` (number, default: 1): Number of cards to peek at

**Returns:** Array of cards (does not modify deck)

**Use cases:** Scrying, divination games, cheat detection

---

### `deck:cut`

Cut the deck at a specific position.

```javascript
// Cut at middle (default)
engine.dispatch("deck:cut");

// Cut at position 20, move top to bottom
engine.dispatch("deck:cut", { position: 20, topToBottom: true });

// Cut at position 30, move bottom to top
engine.dispatch("deck:cut", { position: 30, topToBottom: false });
```

**Parameters:**
- `position` (number, optional): Where to cut (default: middle)
- `topToBottom` (boolean, default: true): Direction of cut

**Returns:** void

**Use cases:** Traditional card game procedures

---

### `deck:insertAt`

Insert a card at a specific position in the deck.

```javascript
// Insert at top
engine.dispatch("deck:insertAt", { card: myCard, position: 0 });

// Insert at bottom
engine.dispatch("deck:insertAt", { 
  card: myCard, 
  position: engine.deck._stack.length 
});
```

**Parameters:**
- `card` (Token): Card to insert
- `position` (number, default: 0): Position to insert at

**Returns:** void

**Use cases:** Card manipulation, magic tricks, game mechanics

---

### `deck:removeAt`

Remove and return the card at a specific position.

```javascript
// Remove top card
const card = engine.dispatch("deck:removeAt", { position: 0 });

// Remove 10th card
const card = engine.dispatch("deck:removeAt", { position: 9 });
```

**Parameters:**
- `position` (number, default: 0): Position to remove from

**Returns:** The removed card

**Use cases:** Targeted card removal, searching deck

---

### `deck:swap`

Swap two cards in the deck by position.

```javascript
// Swap first and last card
engine.dispatch("deck:swap", { i: 0, j: 51 });
```

**Parameters:**
- `i` (number): First position
- `j` (number): Second position

**Returns:** void

**Use cases:** Card manipulation, custom shuffle algorithms

---

### `deck:reverse`

Reverse a range of cards in the deck.

```javascript
// Reverse entire deck
engine.dispatch("deck:reverse");

// Reverse first 13 cards
engine.dispatch("deck:reverse", { start: 0, end: 12 });
```

**Parameters:**
- `start` (number, default: 0): Start position
- `end` (number, optional): End position (default: last card)

**Returns:** void

**Use cases:** Custom shuffle techniques, game mechanics

---

## Table Actions

Operations on the game table and card zones.

### `table:place`

Place a card in a zone on the table.

```javascript
// Basic placement
engine.dispatch("table:place", { 
  zone: "field", 
  card: myCard 
});

// Placement with options
engine.dispatch("table:place", { 
  zone: "hand", 
  card: myCard,
  opts: { 
    faceUp: true, 
    x: 100, 
    y: 200, 
    label: "Player 1's card" 
  }
});
```

**Parameters:**
- `zone` (string): Zone name
- `card` (Token): Card to place
- `opts` (object, optional):
  - `faceUp` (boolean): Face up or down
  - `x`, `y` (number): Position coordinates
  - `label` (string): Placement label

**Returns:** Placement object

**Use cases:** Playing cards, dealing to zones

---

### `table:clear`

Remove all cards from all zones on the table.

```javascript
engine.dispatch("table:clear");
```

**Parameters:** none

**Returns:** void

**Use cases:** End of round, reset game state

---

### `table:move`

Move a card from one zone to another.

```javascript
engine.dispatch("table:move", { 
  fromZone: "hand", 
  toZone: "field", 
  placementId: "abc-123" 
});
```

**Parameters:**
- `fromZone` (string): Source zone
- `toZone` (string): Destination zone
- `placementId` (string): ID of placement to move

**Returns:** void

**Use cases:** Playing cards from hand, moving between areas

---

### `table:flip`

Flip a card face up or face down.

```javascript
// Flip face up
engine.dispatch("table:flip", { 
  zone: "field", 
  placementId: "abc-123", 
  faceUp: true 
});

// Toggle face state
engine.dispatch("table:flip", { 
  zone: "field", 
  placementId: "abc-123" 
});
```

**Parameters:**
- `zone` (string): Zone containing the card
- `placementId` (string): ID of placement
- `faceUp` (boolean, optional): New face state (toggle if not provided)

**Returns:** void

**Use cases:** Revealing cards, hiding cards, game mechanics

---

### `table:remove`

Remove a card from the table entirely.

```javascript
engine.dispatch("table:remove", { 
  zone: "field", 
  placementId: "abc-123" 
});
```

**Parameters:**
- `zone` (string): Zone containing the card
- `placementId` (string): ID of placement

**Returns:** void

**Use cases:** Discarding from play, removing destroyed cards

---

### `table:createZone`

Create a new zone on the table.

```javascript
engine.dispatch("table:createZone", { 
  id: "discard", 
  label: "Discard Pile", 
  x: 100, 
  y: 200 
});
```

**Parameters:**
- `id` (string): Unique zone identifier
- `label` (string, optional): Display label
- `x`, `y` (number, optional): Position coordinates

**Returns:** void

**Use cases:** Dynamic game areas, player zones

---

### `table:deleteZone`

Remove a zone from the table (cards in it are removed).

```javascript
engine.dispatch("table:deleteZone", { id: "temporary" });
```

**Parameters:**
- `id` (string): Zone identifier

**Returns:** void

**Use cases:** Cleanup, removing player areas

---

### `table:clearZone`

Remove all cards from a specific zone (zone itself remains).

```javascript
engine.dispatch("table:clearZone", { zone: "hand" });
```

**Parameters:**
- `zone` (string): Zone to clear

**Returns:** void

**Use cases:** Discarding hand, clearing play area

---

### `table:shuffleZone`

Shuffle all cards within a zone.

```javascript
// Random shuffle
engine.dispatch("table:shuffleZone", { zone: "deck" });

// Deterministic shuffle
engine.dispatch("table:shuffleZone", { zone: "deck", seed: 42 });
```

**Parameters:**
- `zone` (string): Zone to shuffle
- `seed` (number, optional): Shuffle seed

**Returns:** void

**Use cases:** Shuffling discard pile, randomizing face-down cards

---

### `table:transferZone`

Move all cards from one zone to another.

```javascript
engine.dispatch("table:transferZone", { 
  fromZone: "hand", 
  toZone: "discard" 
});
```

**Parameters:**
- `fromZone` (string): Source zone
- `toZone` (string): Destination zone

**Returns:** void

**Use cases:** Discarding entire hand, collecting cards

---

### `table:fanZone`

Arrange cards in a zone in a fan pattern (for display).

```javascript
engine.dispatch("table:fanZone", { 
  zone: "hand", 
  radius: 150, 
  angleStep: 10, 
  startAngle: -45 
});
```

**Parameters:**
- `zone` (string): Zone to fan
- `radius` (number, default: 100): Fan radius
- `angleStep` (number, default: 15): Degrees between cards
- `startAngle` (number, default: 0): Starting angle

**Returns:** void

**Use cases:** Displaying hand, visual layouts

---

### `table:stackZone`

Stack all cards in a zone on top of each other.

```javascript
engine.dispatch("table:stackZone", { zone: "deck" });
```

**Parameters:**
- `zone` (string): Zone to stack

**Returns:** void

**Use cases:** Deck piles, compact display

---

### `table:spreadZone`

Spread cards in a zone in a pattern.

```javascript
// Linear spread
engine.dispatch("table:spreadZone", { 
  zone: "river", 
  pattern: "linear", 
  angleStep: 20 
});

// Arc spread
engine.dispatch("table:spreadZone", { 
  zone: "field", 
  pattern: "arc", 
  radius: 200 
});
```

**Parameters:**
- `zone` (string): Zone to spread
- `pattern` (string, default: "linear"): "linear" or "arc"
- `angleStep` (number, default: 15): Spacing between cards
- `radius` (number, default: 100): Arc radius (for "arc" pattern)

**Returns:** void

**Use cases:** Community cards, tableau layouts

---

### `table:lockZone`

Lock a zone to prevent modifications.

```javascript
// Lock zone
engine.dispatch("table:lockZone", { zone: "deck", locked: true });

// Unlock zone
engine.dispatch("table:lockZone", { zone: "deck", locked: false });
```

**Parameters:**
- `zone` (string): Zone to lock/unlock
- `locked` (boolean, default: true): Lock state

**Returns:** void

**Use cases:** Protecting completed areas, enforcing rules

---

## Shoe Actions

Operations on multi-deck shoes (casino-style).

### `shoe:draw`

Draw one or more cards from the shoe.

```javascript
const card = engine.dispatch("shoe:draw");
const cards = engine.dispatch("shoe:draw", { count: 5 });
```

**Parameters:**
- `count` (number, default: 1): Number of cards

**Returns:** Single card or array of cards

**Use cases:** Dealing from shoe

---

### `shoe:shuffle`

Shuffle all cards in the shoe.

```javascript
engine.dispatch("shoe:shuffle");
engine.dispatch("shoe:shuffle", { seed: 42 });
```

**Parameters:**
- `seed` (number, optional): Shuffle seed

**Returns:** void

**Use cases:** Beginning of round, reshuffle threshold

---

### `shoe:burn`

Burn N cards from the shoe.

```javascript
engine.dispatch("shoe:burn", { count: 3 });
```

**Parameters:**
- `count` (number, default: 1): Number of cards

**Returns:** void

**Use cases:** Casino procedures

---

### `shoe:reset`

Reset shoe to original state (all decks restored).

```javascript
engine.dispatch("shoe:reset");
```

**Parameters:** none

**Returns:** void

**Use cases:** New round, reset simulation

---

### `shoe:addDeck`

Add another deck to the shoe.

```javascript
engine.dispatch("shoe:addDeck", { deck: myDeck });
```

**Parameters:**
- `deck` (Deck): Deck to add

**Returns:** void

**Use cases:** Dynamic shoe size, adding expansions

---

### `shoe:removeDeck`

Remove a specific deck from the shoe.

```javascript
engine.dispatch("shoe:removeDeck", { deck: myDeck });
```

**Parameters:**
- `deck` (Deck): Deck to remove

**Returns:** void

**Use cases:** Dynamic shoe management

---

### `shoe:inspect`

Get statistics about the shoe (remaining cards, burned cards, etc.).

```javascript
const stats = engine.dispatch("shoe:inspect");
// Returns: { decks: 6, remaining: 312, burned: 0, seed: 42, policy: {...} }
```

**Parameters:** none

**Returns:** Object with shoe statistics

**Use cases:** Card counting, monitoring shoe state

---

## Player Actions

Operations on player entities in the game.

### `player:create`

Create a new player and add them to the game.

```javascript
engine.dispatch("player:create", { 
  name: "Alice", 
  agent: myAgent, 
  meta: { color: "blue", avatar: "knight" } 
});
```

**Parameters:**
- `name` (string): Player name (must be unique)
- `agent` (object, optional): AI agent for automated play
- `meta` (object, optional): Custom metadata

**Returns:** Player object

**Use cases:** Adding players, starting game

---

### `player:remove`

Remove a player from the game.

```javascript
engine.dispatch("player:remove", { name: "Alice" });
```

**Parameters:**
- `name` (string): Player name

**Returns:** void

**Use cases:** Player elimination, leaving game

---

### `player:setActive`

Set whether a player is active (can take actions).

```javascript
// Deactivate (fold, eliminate)
engine.dispatch("player:setActive", { name: "Alice", active: false });

// Reactivate
engine.dispatch("player:setActive", { name: "Alice", active: true });
```

**Parameters:**
- `name` (string): Player name
- `active` (boolean, default: true): Active state

**Returns:** void

**Use cases:** Folding, elimination, turn management

---

### `player:giveResource`

Give a resource to a player (chips, points, life, etc.).

```javascript
// Give 100 chips
engine.dispatch("player:giveResource", { 
  name: "Alice", 
  resource: "chips", 
  amount: 100 
});

// Give 1 life point
engine.dispatch("player:giveResource", { 
  name: "Bob", 
  resource: "life", 
  amount: 1 
});
```

**Parameters:**
- `name` (string): Player name
- `resource` (string): Resource type
- `amount` (number, default: 1): Amount to give

**Returns:** void

**Use cases:** Scoring, rewards, resource management

---

### `player:takeResource`

Take a resource from a player.

```javascript
engine.dispatch("player:takeResource", { 
  name: "Alice", 
  resource: "chips", 
  amount: 50 
});
```

**Parameters:**
- `name` (string): Player name
- `resource` (string): Resource type
- `amount` (number, default: 1): Amount to take

**Returns:** void

**Use cases:** Costs, penalties, betting

---

### `player:drawCards`

Player draws cards from deck or shoe into their hand.

```javascript
// Draw from deck
engine.dispatch("player:drawCards", { name: "Alice", count: 5 });

// Draw from shoe
engine.dispatch("player:drawCards", { 
  name: "Bob", 
  count: 2, 
  source: "shoe" 
});
```

**Parameters:**
- `name` (string): Player name
- `count` (number, default: 1): Number of cards
- `source` (string, default: "deck"): "deck" or "shoe"

**Returns:** void

**Use cases:** Drawing cards, dealing hands

---

### `player:discardCards`

Player discards specific cards from their hand.

```javascript
engine.dispatch("player:discardCards", { 
  name: "Alice", 
  cards: [card1, card2] 
});
```

**Parameters:**
- `name` (string): Player name
- `cards` (Token or array): Card(s) to discard

**Returns:** void

**Use cases:** Discarding, card effects

---

### `player:get`

Get a player's complete state.

```javascript
const player = engine.dispatch("player:get", { name: "Alice" });
// Returns: { name, id, active, resources, hand, zones, meta }
```

**Parameters:**
- `name` (string): Player name

**Returns:** Player object

**Use cases:** Inspecting player state, UI updates

---

## Game State Actions

High-level game flow management.

### `game:start`

Initialize game state (call at beginning of game).

```javascript
engine.dispatch("game:start");
```

**Parameters:** none

**Returns:** void

**Side effects:** Sets `engine._gameState` with:
- `started: true`
- `startTime: <timestamp>`
- `phase: "setup"`
- `turn: 0`

**Use cases:** Starting a new game

---

### `game:end`

End the game and record the winner.

```javascript
engine.dispatch("game:end", { 
  winner: "Alice", 
  reason: "victory" 
});
```

**Parameters:**
- `winner` (string, optional): Winner name
- `reason` (string, optional): End reason

**Returns:** void

**Use cases:** Game over, declaring winner

---

### `game:pause`

Pause the game (for save/load, interruptions).

```javascript
engine.dispatch("game:pause");
```

**Parameters:** none

**Returns:** void

**Use cases:** Save/load, interruptions

---

### `game:resume`

Resume a paused game.

```javascript
engine.dispatch("game:resume");
```

**Parameters:** none

**Returns:** void

**Use cases:** Loading saved game, continuing after pause

---

### `game:nextPhase`

Advance to the next phase of the game.

```javascript
// Auto-advance (setup → play → scoring → end)
engine.dispatch("game:nextPhase");

// Set specific phase
engine.dispatch("game:nextPhase", { phase: "play" });
```

**Parameters:**
- `phase` (string, optional): Phase name (auto-advances if not provided)

**Returns:** void

**Use cases:** Turn-based games, structured phases

---

### `game:setProperty`

Set an arbitrary game state property.

```javascript
engine.dispatch("game:setProperty", { key: "round", value: 3 });
engine.dispatch("game:setProperty", { key: "dealer", value: "Alice" });
```

**Parameters:**
- `key` (string): Property name
- `value` (any): Property value

**Returns:** void

**Use cases:** Custom game state, tracking variables

---

## Token Actions

### `token:transform`

Modify token properties in-place without moving them.

**Use cases:** State changes, status effects, card flipping, buffs/debuffs

```javascript
// Simple property change
engine.dispatch("token:transform", {
  token: myCard,
  properties: { label: "Tapped Card" }
});

// Merge metadata (preserves existing properties)
engine.dispatch("token:transform", {
  token: character,
  properties: {
    label: "Hero (Poisoned)",
    meta: { status: "poisoned", hp: 50 } // Preserves other meta props
  }
});

// Multiple properties at once
engine.dispatch("token:transform", {
  token: unit,
  properties: {
    label: "Veteran Warrior",
    text: "Has seen many battles",
    char: "⚔️",
    meta: { level: 5, experience: 1000 }
  }
});
```

**Parameters:**
- `token` (Token, required): Token to transform
- `properties` (Object): Properties to change
  - Special handling for `meta` - merges with existing metadata

**Returns:** The transformed token

---

### `token:attach`

Attach one token to another, creating relationships like equipment, enchantments, or status effects.

**Use cases:** Equipment systems, enchantments, auras, passenger tokens

```javascript
// Equip a sword
engine.dispatch("token:attach", {
  host: characterToken,
  attachment: swordToken,
  attachmentType: "weapon"
});

// Attach an enchantment
engine.dispatch("token:attach", {
  host: creature,
  attachment: flightEnchantment,
  attachmentType: "enchantment"
});

// Apply a status effect
engine.dispatch("token:attach", {
  host: player,
  attachment: poisonToken,
  attachmentType: "status"
});
```

**Parameters:**
- `host` (Token, required): Token to attach to
- `attachment` (Token, required): Token to attach
- `attachmentType` (string, optional): Type of attachment (default: "default")

**Returns:** The host token (now with `_attachments` array)

**Data structure created:**
```javascript
host._attachments = [
  {
    token: attachmentToken,
    type: "weapon",
    attachedAt: 1234567890,
    id: "sword-001"
  }
];

attachment._attachedTo = "host-id";
attachment._attachmentType = "weapon";
```

---

### `token:detach`

Remove an attachment from a host token.

**Use cases:** Unequipping items, removing enchantments, expiring status effects

```javascript
// Detach by attachment ID
engine.dispatch("token:detach", {
  host: character,
  attachmentId: "sword-001"
});

// Detach by reference
engine.dispatch("token:detach", {
  host: character,
  attachment: swordToken
});
```

**Parameters:**
- `host` (Token, required): Token to detach from
- `attachmentId` (string): ID of attachment to remove
- `attachment` (Token): Reference to attachment token
  - *(Provide either attachmentId or attachment)*

**Returns:** The detached token (or null if not found)

---

### `token:merge`

Combine multiple tokens into a single token.

**Use cases:** Resource stacking, unit upgrades, crafting systems, combining items

```javascript
// Merge resources
const woodStack = engine.dispatch("token:merge", {
  tokens: [wood1, wood2, wood3],
  resultProperties: {
    label: "Wood Stack",
    meta: { quantity: 15 }
  }
});

// Auto-merge metadata
const fusedGem = engine.dispatch("token:merge", {
  tokens: [redGem, blueGem],
  resultProperties: {
    label: "Purple Gem"
  }
  // Automatically merges all meta properties from both gems
});

// Keep originals (for non-destructive merge)
engine.dispatch("token:merge", {
  tokens: [unit1, unit2],
  resultProperties: { label: "Army" },
  keepOriginals: true  // Don't mark originals as merged
});
```

**Parameters:**
- `tokens` (Array<Token>, required): Tokens to merge (minimum 2)
- `resultProperties` (Object, optional): Properties for the merged token
  - Uses first token as base if not specified
  - Auto-merges metadata from all tokens unless `meta` is explicitly provided
- `keepOriginals` (boolean, default: false): If false, marks originals as `_merged`

**Returns:** New merged token with tracking metadata

**Tracking metadata:**
```javascript
mergedToken._mergedFrom = ["token-1", "token-2"];
mergedToken._mergedAt = 1234567890;

// If keepOriginals is false:
originalToken._merged = true;
originalToken._mergedInto = "merged-token-id";
```

---

### `token:split`

Split one token into multiple tokens.

**Use cases:** Breaking resource stacks, dividing armies, splitting cards

```javascript
// Simple split
const [half1, half2] = engine.dispatch("token:split", {
  token: stack,
  count: 2
});

// Split with custom properties
const pieces = engine.dispatch("token:split", {
  token: goldPile,
  count: 3,
  properties: [
    { label: "Gold Piece 1", meta: { value: 100 } },
    { label: "Gold Piece 2", meta: { value: 100 } },
    { label: "Gold Piece 3", meta: { value: 100 } }
  ]
});

// Split with metadata preservation
const months = engine.dispatch("token:split", {
  token: yearToken,
  count: 12,
  properties: [
    { label: "January", meta: { index: 0 } },
    { label: "February", meta: { index: 1 } },
    // ... properties merge with original token.meta
  ]
});
```

**Parameters:**
- `token` (Token, required): Token to split
- `count` (number, required): Number of tokens to create (minimum 2)
- `properties` (Array<Object>, optional): Custom properties for each split
  - Index corresponds to split token
  - Metadata is **merged** with original, not replaced

**Returns:** Array of new split tokens

**Tracking metadata:**
```javascript
splitToken._splitFrom = "original-token-id";
splitToken._splitIndex = 0;  // Position in split
splitToken._splitAt = 1234567890;

originalToken._split = true;
originalToken._splitInto = ["token-split-0", "token-split-1"];
```

---

## Batch Actions

### `tokens:filter`

Filter a collection of tokens based on a predicate function.

**Use cases:** Finding all red cards, getting high-value items, selecting tokens by type

```javascript
// Filter tokens from an array
const redCards = engine.dispatch("tokens:filter", {
  tokens: deck.cards,
  predicate: (token) => token.meta.color === "red"
});

// Filter from deck
const highValue = engine.dispatch("tokens:filter", {
  source: "deck",
  predicate: (token) => token.meta.value >= 10
});

// Filter from table zone
const activeUnits = engine.dispatch("tokens:filter", {
  source: "battlefield",
  predicate: (token) => !token.meta.tapped
});
```

**Parameters:**
- `tokens` (Array<Token>): Tokens to filter (if not using source)
- `predicate` (Function, required): Function that returns true for matching tokens
- `source` (string): Source to filter from ('deck', 'table', or zone name)

**Returns:** Array of matching tokens

---

### `tokens:forEach`

Apply an operation to each token in a collection. Returns array of operation results.

**Use cases:** Buffing all units, damaging all creatures, transforming multiple tokens

```javascript
// Modify tokens
engine.dispatch("tokens:forEach", {
  tokens: playerHand,
  operation: (token) => {
    token.meta.buffed = true;
    token.meta.power += 2;
  }
});

// Collect computed values
const totalPower = engine.dispatch("tokens:forEach", {
  tokens: army,
  operation: (token) => token.meta.power
}).reduce((sum, power) => sum + power, 0);

// Use index parameter
engine.dispatch("tokens:forEach", {
  source: "deck",
  operation: (token, index) => {
    token.meta.position = index;
  }
});
```

**Parameters:**
- `tokens` (Array<Token>): Tokens to process (if not using source)
- `operation` (Function, required): Function to apply to each token `(token, index) => result`
- `source` (string): Source to process ('deck', 'table', or zone name)

**Returns:** Array of operation return values

---

### `tokens:collect`

Gather tokens from multiple sources into a single array.

**Use cases:** Getting all tokens in play, collecting from multiple zones, inventory management

```javascript
// Collect from multiple standard sources
const allTokens = engine.dispatch("tokens:collect", {
  sources: ["deck", "table", "discard"]
});

// Collect from specific zones
const cardsInPlay = engine.dispatch("tokens:collect", {
  sources: ["hand", "battlefield", "graveyard"]
});

// Include attached tokens (equipment, enchantments, etc.)
const allWithEquipment = engine.dispatch("tokens:collect", {
  sources: ["battlefield"],
  includeAttachments: true  // Also collects attached tokens
});
```

**Parameters:**
- `sources` (Array<string>, required): Sources to collect from
  - Standard sources: `'deck'`, `'table'`, `'discard'`, `'shoe'`
  - Or any table zone name
- `includeAttachments` (boolean, default: false): Also collect attached tokens from hosts

**Returns:** Array of all collected tokens

**Source types:**
- `'deck'` - All tokens in the deck
- `'table'` - All tokens on the table (all zones)
- `'discard'` - All discarded tokens
- `'shoe'` - All tokens in all shoe decks
- Zone name (e.g. `'hand'`, `'play'`) - Tokens in that specific zone

---

### `tokens:count`

Count tokens, optionally filtering by predicate.

**Use cases:** Checking hand size, counting resources, validating game state

```javascript
// Count all tokens
const deckSize = engine.dispatch("tokens:count", {
  source: "deck"
});

// Count matching tokens
const redCount = engine.dispatch("tokens:count", {
  tokens: allCards,
  predicate: (token) => token.meta.color === "red"
});

// Count from source with predicate
const expensiveCards = engine.dispatch("tokens:count", {
  source: "hand",
  predicate: (token) => token.meta.cost > 5
});
```

**Parameters:**
- `tokens` (Array<Token>): Tokens to count (if not using source)
- `predicate` (Function, optional): Filter function - only counts matching tokens
- `source` (string): Source to count from ('deck', 'table', or zone name)

**Returns:** Number of tokens (matching if predicate provided)

---

### `tokens:find`

Find the first token matching a predicate. Returns null if not found.

**Use cases:** Finding specific cards, locating tokens by ID, searching for matches

```javascript
// Find by ID
const aceOfSpades = engine.dispatch("tokens:find", {
  tokens: deck.cards,
  predicate: (token) => token.id === "spades-ace"
});

// Find by property
const cheapestCard = engine.dispatch("tokens:find", {
  source: "hand",
  predicate: (token) => token.meta.cost === 1
});

// Find complex match
const legendaryCreature = engine.dispatch("tokens:find", {
  source: "battlefield",
  predicate: (token) => 
    token.meta.type === "creature" && 
    token.meta.rarity === "legendary"
});

// Check if found
if (legendaryCreature) {
  console.log("Found:", legendaryCreature.label);
} else {
  console.log("No legendary creatures in play");
}
```

**Parameters:**
- `tokens` (Array<Token>): Tokens to search (if not using source)
- `predicate` (Function, required): Function that returns true for desired token
- `source` (string): Source to search ('deck', 'table', or zone name)

**Returns:** First matching token, or null if none found

---

## Utility Functions

Helper functions for working with actions.

### `listActions()`

Get all available action types.

```javascript
import { listActions } from './actions.js';

const actions = listActions();
// Returns: ["deck:shuffle", "deck:draw", ...]
```

---

### `listActionsByCategory()`

Get actions organized by category.

```javascript
import { listActionsByCategory } from './actions.js';

const categories = listActionsByCategory();
// Returns: { deck: [...], table: [...], shoe: [...], player: [...], game: [...] }
```

---

### `hasAction(type)`

Check if an action exists.

```javascript
import { hasAction } from './actions.js';

if (hasAction("deck:shuffle")) {
  // Action exists
}
```

---

### `registerAction(type, handler)`

Register a custom action.

```javascript
import { registerAction } from './actions.js';

registerAction("mygame:custom", (engine, payload) => {
  // Custom logic
});
```

---

### `unregisterAction(type)`

Remove an action from the registry.

```javascript
import { unregisterAction } from './actions.js';

unregisterAction("mygame:custom");
```

---

## Usage Examples

### Basic Card Game

```javascript
// Setup
engine.dispatch("game:start");
engine.dispatch("deck:shuffle", { seed: 42 });

// Deal
engine.dispatch("player:create", { name: "Alice" });
engine.dispatch("player:create", { name: "Bob" });
engine.dispatch("player:drawCards", { name: "Alice", count: 5 });
engine.dispatch("player:drawCards", { name: "Bob", count: 5 });

// Play
const aliceHand = engine.dispatch("player:get", { name: "Alice" }).hand;
engine.dispatch("table:place", { 
  zone: "field", 
  card: aliceHand[0],
  opts: { faceUp: true }
});

// End
engine.dispatch("game:end", { winner: "Alice" });
```

---

### Poker Setup

```javascript
// 6-deck shoe
engine.dispatch("shoe:shuffle");
engine.dispatch("shoe:burn", { count: 3 });

// Create zones
engine.dispatch("table:createZone", { id: "flop" });
engine.dispatch("table:createZone", { id: "turn" });
engine.dispatch("table:createZone", { id: "river" });

// Deal hole cards
for (const player of ["Alice", "Bob", "Charlie"]) {
  engine.dispatch("player:drawCards", { name: player, count: 2, source: "shoe" });
}
```
### Equipment System

```javascript
// Create character and weapon
const hero = new Token({ id: "hero", label: "Hero", meta: { hp: 100 } });
const sword = new Token({ id: "sword", label: "Iron Sword", meta: { damage: 10 } });

// Equip weapon
engine.dispatch("token:attach", {
  host: hero,
  attachment: sword,
  attachmentType: "weapon"
});

// Check equipped items
const weapons = hero._attachments?.filter(a => a.type === "weapon");

// Unequip weapon
engine.dispatch("token:detach", {
  host: hero,
  attachment: sword
});
```

### Crafting System

```javascript
// Combine materials
const ironOre = new Token({ id: "iron-ore", meta: { material: "iron", quality: 5 } });
const coal = new Token({ id: "coal", meta: { material: "coal", quality: 3 } });

const steel = engine.dispatch("token:merge", {
  tokens: [ironOre, coal],
  resultProperties: {
    label: "Steel Ingot",
    meta: { material: "steel", quality: 8 }
  }
});
```

### Resource Management

```javascript
// Stack resources
const wood1 = new Token({ id: "w1", meta: { type: "wood", qty: 5 } });
const wood2 = new Token({ id: "w2", meta: { type: "wood", qty: 3 } });

const stack = engine.dispatch("token:merge", {
  tokens: [wood1, wood2],
  resultProperties: {
    label: "Wood Stack",
    meta: { type: "wood", qty: 8 }
  }
});

// Later, split the stack
const [pile1, pile2] = engine.dispatch("token:split", {
  token: stack,
  count: 2,
  properties: [
    { meta: { qty: 4 } },
    { meta: { qty: 4 } }
  ]
});
```

### Status Effects

```javascript
// Apply poisoned status
const poisonEffect = new Token({ 
  id: "poison-1", 
  label: "Poison",
  meta: { damagePerTurn: 2, duration: 3 }
});

engine.dispatch("token:attach", {
  host: creature,
  attachment: poisonEffect,
  attachmentType: "status"
});

// Transform creature to show poison
engine.dispatch("token:transform", {
  token: creature,
  properties: {
    char: "☠️",
    meta: { isPoisoned: true }
  }
});

// After duration expires
engine.dispatch("token:detach", {
  host: creature,
  attachment: poisonEffect
});
```

---

## Events

All token transformation actions emit events through the EventBus:

- `token:transformed` - When a token is transformed
- `token:attached` - When a token is attached
- `token:detached` - When a token is detached
- `token:merged` - When tokens are merged
- `token:split` - When a token is split

```javascript
engine.eventBus.on("token:transformed", ({ token, properties }) => {
  console.log(`${token.label} transformed with`, properties);
});

engine.eventBus.on("token:attached", ({ host, attachment, attachmentType }) => {
  console.log(`${attachment.label} attached to ${host.label} as ${attachmentType}`);
});
```

### Resource Management

```javascript
// Count total resources
const woodCount = engine.dispatch("tokens:count", {
  source: "inventory",
  predicate: (token) => token.meta.type === "wood"
});

// Collect all resources
const allResources = engine.dispatch("tokens:collect", {
  sources: ["inventory", "storage", "chest"]
});

// Filter valuable items
const valuables = engine.dispatch("tokens:filter", {
  tokens: allResources,
  predicate: (token) => token.meta.value >= 100
});
```

### Card Game Queries

```javascript
// Find playable cards
const playable = engine.dispatch("tokens:filter", {
  source: "hand",
  predicate: (token) => token.meta.cost <= currentMana
});

// Count creatures in play
const creatureCount = engine.dispatch("tokens:count", {
  source: "battlefield",
  predicate: (token) => token.meta.type === "creature"
});

// Collect all cards
const allMyCards = engine.dispatch("tokens:collect", {
  sources: ["hand", "battlefield", "graveyard"]
});
```

### Batch Operations

```javascript
// Damage all enemy units
engine.dispatch("tokens:forEach", {
  source: "enemy-field",
  operation: (token) => {
    token.meta.hp -= 2;
    if (token.meta.hp <= 0) {
      token.meta.destroyed = true;
    }
  }
});

// Buff all friendly units
const friendlyUnits = engine.dispatch("tokens:filter", {
  source: "battlefield",
  predicate: (token) => token.meta.controller === "player"
});

engine.dispatch("tokens:forEach", {
  tokens: friendlyUnits,
  operation: (token) => {
    token.meta.power += 1;
    token.meta.defense += 1;
  }
});
```

### Complex Queries

```javascript
// Find most powerful unit
const units = engine.dispatch("tokens:collect", {
  sources: ["battlefield"]
});

let strongest = null;
engine.dispatch("tokens:forEach", {
  tokens: units,
  operation: (token) => {
    if (!strongest || token.meta.power > strongest.meta.power) {
      strongest = token;
    }
  }
});

// Count tokens by type
const typeMap = {};
engine.dispatch("tokens:forEach", {
  source: "deck",
  operation: (token) => {
    const type = token.meta.type || "other";
    typeMap[type] = (typeMap[type] || 0) + 1;
  }
});
```

### Inventory System

```javascript
// Collect all equipped items
const equipped = engine.dispatch("tokens:collect", {
  sources: ["character"],
  includeAttachments: true
});

// Find specific item
const magicSword = engine.dispatch("tokens:find", {
  tokens: equipped,
  predicate: (token) => 
    token.meta.itemType === "weapon" && 
    token.meta.magical === true
});

// Count items by rarity
const legendaryCount = engine.dispatch("tokens:count", {
  tokens: equipped,
  predicate: (token) => token.meta.rarity === "legendary"
});
```

---

## Events

All batch/query operations emit events:

- `tokens:filtered` - When filtering completes
- `tokens:forEach:complete` - When forEach finishes
- `tokens:forEach:error` - When forEach operation fails
- `tokens:collected` - When collection completes
- `tokens:counted` - When counting completes
- `tokens:found` - When find completes

```javascript
engine.eventBus.on("tokens:filtered", ({ source, count, total }) => {
  console.log(`Filtered ${count} of ${total} tokens from ${source}`);
});

engine.eventBus.on("tokens:collected", ({ sources, count }) => {
  console.log(`Collected ${count} tokens from ${sources.join(", ")}`);
});
```
---

## Performance Notes

All actions are synchronous and execute in O(1) or O(n) time where n is the number of affected cards.

**Fast operations** (O(1)):
- Most single-card operations
- Property setting
- Resource management

**Moderate operations** (O(n)):
- Shuffling
- Zone transfers
- Drawing multiple cards

**Consider batching** for:
- Dealing to many players
- Moving many cards
- Bulk resource changes

---

## Extension Pattern

To add game-specific actions:

```javascript
import { ActionRegistry } from './actions.js';

// Extend for your game
Object.assign(ActionRegistry, {
  "poker:showdown": (engine) => {
    // Game-specific logic
  },
   
  "poker:bet": (engine, { player, amount }) => {
    engine.dispatch("player:takeResource", { 
      name: player, 
      resource: "chips", 
      amount 
    });
    engine.dispatch("game:setProperty", { 
      key: "pot", 
      value: (engine._gameState.pot || 0) + amount 
    });
  }
});
```


**Best practice:** Use standard actions for common operations, only add custom actions for game-specific logic.

---

## Complete Action Summary

**45 total actions** covering:

✅ Deck manipulation (10)  
✅ Table/zone management (13)  
✅ Multi-deck shoes (7)  
✅ Player management (9)  
✅ Game flow control (6)

**This is a complete game engine action set.** Users should rarely need to add basic operations - only game-specific logic.