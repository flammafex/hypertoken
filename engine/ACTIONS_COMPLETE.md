# HyperToken Action Reference

Complete documentation for all 58 built-in actions in the HyperToken engine.

---

## Quick Reference

### By Category

| Category | Count | Actions |
|----------|-------|---------|
| **Deck** | 10 | shuffle, draw, reset, burn, peek, cut, insertAt, removeAt, swap, reverse |
| **Table** | 13 | place, clear, move, flip, remove, createZone, deleteZone, clearZone, shuffleZone, transferZone, fanZone, stackZone, spreadZone, lockZone |
| **Shoe** | 7 | draw, shuffle, burn, reset, addDeck, removeDeck, inspect |
| **Player** | 12 | create, remove, setActive, giveResource, takeResource, drawCards, discardCards, get, **transfer, trade, steal** |
| **Game** | 6 | start, end, pause, resume, nextPhase, setProperty |
| **Token** | 5 | transform, attach, detach, merge, split |
| **Batch** | 5 | filter, forEach, collect, count, find |
| **Total** | **58** | **100% Complete** |

---

## Table of Contents

1. [Deck Actions](#deck-actions) (10)
2. [Table Actions](#table-actions) (13)
3. [Shoe Actions](#shoe-actions) (7)
4. [Player Actions](#player-actions) (12)
5. [Game Actions](#game-actions) (6)
6. [Token Actions](#token-actions) (5)
7. [Batch Actions](#batch-actions) (5)

---

# Deck Actions

Operations on the primary card deck. The deck is a stack-based collection with shuffling, drawing, and manipulation capabilities.

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

**Use cases:** Start of game, after collecting discards

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

**Returns:** Single card (if count=1) or array of cards

**Use cases:** Player draws cards, dealing hands

---

## `deck:reset`

Reset deck to original unshuffled state.

```javascript
engine.dispatch("deck:reset");
```

**Parameters:** none

**Returns:** void

**Use cases:** Starting a new game, practice mode

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

**Use cases:** Poker (burn before flop), discarding unknown cards

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

**Returns:** Array of cards (does not modify deck)

**Use cases:** Scrying effects, looking ahead, AI planning

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

**Use cases:** Traditional deck cutting, shuffling variations

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
- `position` (number, default: 0): Index to insert at

**Returns:** void

**Use cases:** Putting cards back, magical effects, deck manipulation

---

## `deck:removeAt`

Remove and return card at specific position.

```javascript
const card = engine.dispatch("deck:removeAt", { position: 10 });
```

**Parameters:**
- `position` (number, default: 0): Index to remove from

**Returns:** The removed card

**Use cases:** Removing specific cards, deck manipulation

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

**Use cases:** Deck manipulation, magical effects

---

## `deck:reverse`

Reverse the entire deck order.

```javascript
engine.dispatch("deck:reverse");
```

**Parameters:** none

**Returns:** void

**Use cases:** Deck manipulation, special effects

---

# Table Actions

Operations on the game table and zones. The table supports multiple named zones with spatial positioning and card placement.

---

## `table:place`

Place a card/token in a zone.

```javascript
engine.dispatch("table:place", {
  zone: "hand",
  token: myCard,
  x: 100,
  y: 200,
  faceUp: true
});
```

**Parameters:**
- `zone` (string, required): Zone name
- `token` (Token, required): Token to place
- `x` (number, optional): X coordinate
- `y` (number, optional): Y coordinate
- `faceUp` (boolean, default: true): Face up or down
- `label` (string, optional): Label for placement

**Returns:** Placement object with ID

**Use cases:** Playing cards, placing pieces, board movement

---

## `table:clear`

Clear all tokens from the table.

```javascript
engine.dispatch("table:clear");
```

**Parameters:** none

**Returns:** void

**Use cases:** Reset board, end of game

---

## `table:move`

Move a token from one zone to another.

```javascript
engine.dispatch("table:move", {
  from: "hand",
  to: "field",
  placement: placementObject,
  x: 150,
  y: 250
});
```

**Parameters:**
- `from` (string, required): Source zone
- `to` (string, required): Destination zone
- `placement` (object, required): Placement to move
- `x` (number, optional): New X coordinate
- `y` (number, optional): New Y coordinate

**Returns:** Updated placement

**Use cases:** Moving pieces, playing cards, repositioning

---

## `table:flip`

Flip a card face up or face down.

```javascript
engine.dispatch("table:flip", {
  zone: "field",
  placement: placementObject,
  faceUp: true
});
```

**Parameters:**
- `zone` (string, required): Zone containing card
- `placement` (object, required): Placement to flip
- `faceUp` (boolean, optional): New face state (toggles if not specified)

**Returns:** Updated placement

**Use cases:** Revealing cards, flipping pieces

---

## `table:remove`

Remove a token from the table.

```javascript
engine.dispatch("table:remove", {
  zone: "field",
  placement: placementObject
});
```

**Parameters:**
- `zone` (string, required): Zone containing token
- `placement` (object, required): Placement to remove

**Returns:** Removed placement

**Use cases:** Removing captured pieces, discarding cards

---

## `table:createZone`

Create a new named zone.

```javascript
engine.dispatch("table:createZone", {
  name: "graveyard",
  meta: { type: "discard", visible: true }
});
```

**Parameters:**
- `name` (string, required): Zone name
- `meta` (object, optional): Zone metadata

**Returns:** void

**Use cases:** Dynamic board creation, custom zones

---

## `table:deleteZone`

Delete a zone and its contents.

```javascript
engine.dispatch("table:deleteZone", {
  name: "graveyard"
});
```

**Parameters:**
- `name` (string, required): Zone to delete

**Returns:** void

**Use cases:** Cleaning up, removing temporary zones

---

## `table:clearZone`

Clear all tokens from a specific zone.

```javascript
engine.dispatch("table:clearZone", {
  zone: "field"
});
```

**Parameters:**
- `zone` (string, required): Zone to clear

**Returns:** void

**Use cases:** Resetting play area, clearing board section

---

## `table:shuffleZone`

Randomize token positions in a zone.

```javascript
engine.dispatch("table:shuffleZone", {
  zone: "field",
  seed: 42
});
```

**Parameters:**
- `zone` (string, required): Zone to shuffle
- `seed` (number, optional): Random seed

**Returns:** void

**Use cases:** Randomizing positions, chaos effects

---

## `table:transferZone`

Move all tokens from one zone to another.

```javascript
engine.dispatch("table:transferZone", {
  from: "deck",
  to: "discard"
});
```

**Parameters:**
- `from` (string, required): Source zone
- `to` (string, required): Destination zone

**Returns:** void

**Use cases:** Bulk movement, end-of-round cleanup

---

## `table:fanZone`

Arrange tokens in a fan layout.

```javascript
engine.dispatch("table:fanZone", {
  zone: "hand",
  centerX: 400,
  centerY: 500,
  radius: 200,
  arcAngle: 180
});
```

**Parameters:**
- `zone` (string, required): Zone to fan
- `centerX` (number, required): Fan center X
- `centerY` (number, required): Fan center Y
- `radius` (number, default: 100): Fan radius
- `arcAngle` (number, default: 120): Arc angle in degrees

**Returns:** void

**Use cases:** Display hand, arrange cards visually

---

## `table:stackZone`

Stack tokens vertically.

```javascript
engine.dispatch("table:stackZone", {
  zone: "deck",
  x: 100,
  y: 100,
  offsetY: 2
});
```

**Parameters:**
- `zone` (string, required): Zone to stack
- `x` (number, required): Stack base X
- `y` (number, required): Stack base Y
- `offsetY` (number, default: 1): Offset between cards

**Returns:** void

**Use cases:** Deck visualization, pile displays

---

## `table:spreadZone`

Spread tokens in a line.

```javascript
engine.dispatch("table:spreadZone", {
  zone: "field",
  startX: 50,
  startY: 300,
  spacing: 80,
  horizontal: true
});
```

**Parameters:**
- `zone` (string, required): Zone to spread
- `startX` (number, required): Start X position
- `startY` (number, required): Start Y position
- `spacing` (number, default: 50): Space between tokens
- `horizontal` (boolean, default: true): Horizontal or vertical

**Returns:** void

**Use cases:** Laying out cards, displaying tableau

---

## `table:lockZone`

Lock a zone to prevent modifications.

```javascript
engine.dispatch("table:lockZone", {
  zone: "field",
  locked: true
});
```

**Parameters:**
- `zone` (string, required): Zone to lock/unlock
- `locked` (boolean, default: true): Lock state

**Returns:** void

**Use cases:** Freezing game state, preventing cheating

---

# Shoe Actions

Operations on multi-deck containers (shoes). Useful for games requiring multiple decks or weighted randomness.

---

## `shoe:draw`

Draw a card from the shoe.

```javascript
const card = engine.dispatch("shoe:draw");
```

**Parameters:** none

**Returns:** Single card from shoe

**Use cases:** Drawing from combined decks, blackjack

---

## `shoe:shuffle`

Shuffle all decks in the shoe.

```javascript
engine.dispatch("shoe:shuffle", { seed: 42 });
```

**Parameters:**
- `seed` (number, optional): Random seed

**Returns:** void

**Use cases:** Reshuffling multi-deck shoe

---

## `shoe:burn`

Burn N cards from the shoe.

```javascript
engine.dispatch("shoe:burn", { count: 5 });
```

**Parameters:**
- `count` (number, default: 1): Cards to burn

**Returns:** void

**Use cases:** Casino procedures

---

## `shoe:reset`

Reset shoe to original state.

```javascript
engine.dispatch("shoe:reset");
```

**Parameters:** none

**Returns:** void

**Use cases:** New shoe, reset game

---

## `shoe:addDeck`

Add a deck to the shoe.

```javascript
engine.dispatch("shoe:addDeck", {
  deck: myDeck
});
```

**Parameters:**
- `deck` (Deck, required): Deck to add

**Returns:** void

**Use cases:** Building multi-deck shoe, adding cards

---

## `shoe:removeDeck`

Remove a deck from the shoe.

```javascript
engine.dispatch("shoe:removeDeck", {
  index: 0
});
```

**Parameters:**
- `index` (number, required): Deck index to remove

**Returns:** Removed deck

**Use cases:** Removing exhausted deck

---

## `shoe:inspect`

Inspect shoe contents.

```javascript
const info = engine.dispatch("shoe:inspect");
// Returns: { deckCount: 6, totalCards: 312, ... }
```

**Parameters:** none

**Returns:** Shoe information object

**Use cases:** Debugging, game state display

---

# Player Actions

Operations on players, including creation, resource management, and player-to-player interactions.

---

## `player:create`

Create a new player.

```javascript
engine.dispatch("player:create", {
  name: "Alice",
  agent: myAIAgent,
  meta: { color: "blue", avatar: "knight" }
});
```

**Parameters:**
- `name` (string, required): Player name
- `agent` (object, optional): AI agent
- `meta` (object, optional): Custom metadata

**Returns:** Player object

**Use cases:** Game setup, adding players

---

## `player:remove`

Remove a player from the game.

```javascript
engine.dispatch("player:remove", {
  name: "Alice"
});
```

**Parameters:**
- `name` (string, required): Player to remove

**Returns:** void

**Use cases:** Player elimination, leaving game

---

## `player:setActive`

Set player active/inactive state.

```javascript
engine.dispatch("player:setActive", {
  name: "Alice",
  active: false
});
```

**Parameters:**
- `name` (string, required): Player name
- `active` (boolean, default: true): Active state

**Returns:** void

**Use cases:** Folding in poker, sitting out, elimination

---

## `player:giveResource`

Give resources to a player.

```javascript
engine.dispatch("player:giveResource", {
  name: "Alice",
  resource: "gold",
  amount: 100
});
```

**Parameters:**
- `name` (string, required): Player name
- `resource` (string, required): Resource type
- `amount` (number, default: 1): Amount to give

**Returns:** void

**Use cases:** Earning money, gaining points, rewards

---

## `player:takeResource`

Take resources from a player.

```javascript
engine.dispatch("player:takeResource", {
  name: "Alice",
  resource: "gold",
  amount: 50
});
```

**Parameters:**
- `name` (string, required): Player name
- `resource` (string, required): Resource type
- `amount` (number, default: 1): Amount to take

**Returns:** void

**Use cases:** Spending money, paying costs, penalties

---

## `player:drawCards`

Player draws cards from deck/shoe.

```javascript
engine.dispatch("player:drawCards", {
  name: "Alice",
  count: 5,
  source: "deck"
});
```

**Parameters:**
- `name` (string, required): Player name
- `count` (number, default: 1): Cards to draw
- `source` (string, default: "deck"): Source ("deck" or "shoe")

**Returns:** void

**Use cases:** Drawing cards, dealing hands

---

## `player:discardCards`

Player discards specific cards.

```javascript
engine.dispatch("player:discardCards", {
  name: "Alice",
  cards: [card1, card2]
});
```

**Parameters:**
- `name` (string, required): Player name
- `cards` (Array<Token> or Token, required): Cards to discard

**Returns:** void

**Use cases:** Discarding, playing cards

---

## `player:get`

Get player state.

```javascript
const player = engine.dispatch("player:get", {
  name: "Alice"
});
```

**Parameters:**
- `name` (string, required): Player name

**Returns:** Player object

**Use cases:** Querying state, AI decision-making

---

## `player:transfer`

Transfer resources/tokens between players.

```javascript
// Transfer resources
engine.dispatch("player:transfer", {
  from: "Alice",
  to: "Bob",
  resource: "gold",
  amount: 50
});

// Transfer a token
engine.dispatch("player:transfer", {
  from: "Alice",
  to: "Bob",
  token: magicSword
});
```

**Parameters:**
- `from` (string, required): Source player
- `to` (string, required): Target player
- `resource` (string): Resource type (if transferring resources)
- `amount` (number, default: 1): Amount to transfer
- `token` (Token): Specific token to transfer

**Returns:** Transfer result object

**Use cases:** Gifting, tribute, payment, lending

**Events:** Emits `player:transfer`

---

## `player:trade`

Bidirectional exchange between players.

```javascript
// Resource for resource
engine.dispatch("player:trade", {
  player1: { 
    name: "Alice", 
    offer: { resource: "gold", amount: 100 }
  },
  player2: { 
    name: "Bob", 
    offer: { resource: "wood", amount: 200 }
  }
});

// Token for resource
engine.dispatch("player:trade", {
  player1: { 
    name: "Alice", 
    offer: { token: magicRing }
  },
  player2: { 
    name: "Bob", 
    offer: { resource: "gold", amount: 500 }
  }
});
```

**Parameters:**
- `player1` (object, required):
  - `name` (string): Player name
  - `offer` (object): What they offer
    - `resource` + `amount`, OR `token`
- `player2` (object, required): Same structure

**Returns:** Trade result with transaction

**Use cases:** Marketplace, bartering, agreements

**Events:** Emits `player:trade`

**Notes:** Atomic operation - both transfers succeed or both fail

---

## `player:steal`

Forcibly take resources/tokens (with optional validation).

```javascript
// Basic steal
engine.dispatch("player:steal", {
  from: "Victim",
  to: "Thief",
  resource: "gold",
  amount: 50
});

// Steal with validation
engine.dispatch("player:steal", {
  from: "Victim",
  to: "Thief",
  resource: "gold",
  amount: 50,
  validate: (thief, victim, engine) => {
    return thief.meta.hasThiefAbility === true;
  }
});
```

**Parameters:**
- `from` (string, required): Victim player
- `to` (string, required): Thief player
- `resource` (string): Resource type
- `amount` (number, default: 1): Amount to steal
- `token` (Token): Specific token to steal
- `validate` (function, optional): Validation function

**Returns:** Steal result object

**Use cases:** Theft mechanics, raiding, piracy, combat loot

**Events:** Emits `player:steal`

**Notes:** Steals as much as possible (up to requested amount)

---

# Game Actions

High-level game state management and lifecycle.

---

## `game:start`

Initialize game state.

```javascript
engine.dispatch("game:start");
```

**Parameters:** none

**Returns:** void

**Use cases:** Beginning game, reset

**State created:**
- `started: true`
- `startTime: <timestamp>`
- `phase: "setup"`
- `turn: 0`
- `ended: false`

---

## `game:end`

End the game and record winner.

```javascript
engine.dispatch("game:end", {
  winner: "Alice",
  reason: "checkmate"
});
```

**Parameters:**
- `winner` (string, optional): Winner name
- `reason` (string, optional): End reason

**Returns:** void

**Use cases:** Game completion, victory

---

## `game:pause`

Pause the game.

```javascript
engine.dispatch("game:pause");
```

**Parameters:** none

**Returns:** void

**Use cases:** Break time, saving

---

## `game:resume`

Resume paused game.

```javascript
engine.dispatch("game:resume");
```

**Parameters:** none

**Returns:** void

**Use cases:** Continuing after pause

---

## `game:nextPhase`

Advance to next game phase.

```javascript
// Auto-advance
engine.dispatch("game:nextPhase");

// Set specific phase
engine.dispatch("game:nextPhase", {
  phase: "combat"
});
```

**Parameters:**
- `phase` (string, optional): Specific phase to set

**Returns:** void

**Default phases:** setup → play → scoring → end

**Use cases:** Phase transitions, turn structure

---

## `game:setProperty`

Set arbitrary game state property.

```javascript
engine.dispatch("game:setProperty", {
  key: "round",
  value: 3
});
```

**Parameters:**
- `key` (string, required): Property name
- `value` (any, required): Property value

**Returns:** void

**Use cases:** Custom game state, tracking variables

---

# Token Actions

Token transformation and relationship management.

---

## `token:transform`

Modify token properties in-place.

```javascript
// Simple change
engine.dispatch("token:transform", {
  token: myToken,
  properties: { label: "Powered Up" }
});

// Merge metadata
engine.dispatch("token:transform", {
  token: character,
  properties: {
    label: "Hero (Poisoned)",
    meta: { status: "poisoned", hp: 50 }
  }
});
```

**Parameters:**
- `token` (Token, required): Token to transform
- `properties` (object, required): Properties to change
  - Special: `meta` is merged, not replaced

**Returns:** Transformed token

**Use cases:** State changes, buffs/debuffs, upgrades

**Events:** Emits `token:transformed`

---

## `token:attach`

Attach one token to another.

```javascript
engine.dispatch("token:attach", {
  host: characterToken,
  attachment: swordToken,
  attachmentType: "weapon"
});
```

**Parameters:**
- `host` (Token, required): Token to attach to
- `attachment` (Token, required): Token to attach
- `attachmentType` (string, default: "default"): Type of attachment

**Returns:** Host token

**Use cases:** Equipment, enchantments, status effects

**Events:** Emits `token:attached`

**Data structure:**
```javascript
host._attachments = [
  { token: swordToken, type: "weapon", id: "sword-1", attachedAt: <timestamp> }
];
attachment._attachedTo = "host-id";
```

---

## `token:detach`

Remove an attachment.

```javascript
// By ID
engine.dispatch("token:detach", {
  host: character,
  attachmentId: "sword-1"
});

// By reference
engine.dispatch("token:detach", {
  host: character,
  attachment: swordToken
});
```

**Parameters:**
- `host` (Token, required): Host token
- `attachmentId` (string): Attachment ID
- `attachment` (Token): Attachment reference
  - Provide either `attachmentId` or `attachment`

**Returns:** Detached token (or null)

**Use cases:** Unequipping, removing effects

**Events:** Emits `token:detached`

---

## `token:merge`

Combine multiple tokens into one.

```javascript
// Basic merge
const merged = engine.dispatch("token:merge", {
  tokens: [wood1, wood2, wood3],
  resultProperties: {
    label: "Wood Stack",
    meta: { quantity: 15 }
  }
});

// Auto-merge metadata
const fused = engine.dispatch("token:merge", {
  tokens: [redGem, blueGem],
  resultProperties: { label: "Purple Gem" }
  // Automatically merges all meta from both gems
});
```

**Parameters:**
- `tokens` (Array<Token>, required): Tokens to merge (min 2)
- `resultProperties` (object, optional): Properties for result
- `keepOriginals` (boolean, default: false): Don't mark originals as merged

**Returns:** New merged token

**Use cases:** Crafting, stacking resources, combining

**Events:** Emits `token:merged`

**Tracking:**
```javascript
merged._mergedFrom = ["token-1", "token-2"];
merged._mergedAt = <timestamp>;
// If keepOriginals=false:
original._merged = true;
original._mergedInto = "merged-id";
```

---

## `token:split`

Divide one token into multiple.

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
    { label: "Gold 1", meta: { value: 100 } },
    { label: "Gold 2", meta: { value: 100 } },
    { label: "Gold 3", meta: { value: 100 } }
  ]
});
```

**Parameters:**
- `token` (Token, required): Token to split
- `count` (number, required): Number of tokens to create (min 2)
- `properties` (Array<object>, optional): Custom properties per split
  - Metadata is merged with original, not replaced

**Returns:** Array of new split tokens

**Use cases:** Breaking stacks, dividing resources

**Events:** Emits `token:split`

**Tracking:**
```javascript
splitToken._splitFrom = "original-id";
splitToken._splitIndex = 0;
splitToken._splitAt = <timestamp>;

original._split = true;
original._splitInto = ["split-0", "split-1"];
```

---

# Batch Actions

Collection operations and queries for working with multiple tokens.

---

## `tokens:filter`

Select tokens matching criteria.

```javascript
// Filter array
const redCards = engine.dispatch("tokens:filter", {
  tokens: deck.cards,
  predicate: (token) => token.meta.color === "red"
});

// Filter from source
const highValue = engine.dispatch("tokens:filter", {
  source: "deck",
  predicate: (token) => token.meta.value >= 10
});

// Filter from zone
const active = engine.dispatch("tokens:filter", {
  source: "battlefield",
  predicate: (token) => !token.meta.tapped
});
```

**Parameters:**
- `tokens` (Array<Token>): Tokens to filter (if not using source)
- `predicate` (function, required): Filter function
- `source` (string): Source to filter from ('deck', 'table', or zone name)

**Returns:** Array of matching tokens

**Use cases:** Finding cards, selecting units, queries

**Events:** Emits `tokens:filtered`

---

## `tokens:forEach`

Apply operation to each token.

```javascript
// Modify tokens
engine.dispatch("tokens:forEach", {
  tokens: playerHand,
  operation: (token) => {
    token.meta.buffed = true;
  }
});

// Collect values
const powers = engine.dispatch("tokens:forEach", {
  source: "battlefield",
  operation: (token) => token.meta.power
});

// Use index
engine.dispatch("tokens:forEach", {
  tokens: deck.cards,
  operation: (token, index) => {
    token.meta.position = index;
  }
});
```

**Parameters:**
- `tokens` (Array<Token>): Tokens to process
- `operation` (function, required): `(token, index) => result`
- `source` (string): Source to process from

**Returns:** Array of operation results

**Use cases:** Batch modifications, calculations, iterations

**Events:** Emits `tokens:forEach:complete`, `tokens:forEach:error`

---

## `tokens:collect`

Gather tokens from multiple sources.

```javascript
// From multiple sources
const all = engine.dispatch("tokens:collect", {
  sources: ["deck", "table", "discard"]
});

// From specific zones
const inPlay = engine.dispatch("tokens:collect", {
  sources: ["hand", "battlefield", "graveyard"]
});

// Include attachments
const withEquipment = engine.dispatch("tokens:collect", {
  sources: ["battlefield"],
  includeAttachments: true
});
```

**Parameters:**
- `sources` (Array<string>, required): Sources to collect from
  - Standard: 'deck', 'table', 'discard', 'shoe'
  - Or any zone name
- `includeAttachments` (boolean, default: false): Also collect attached tokens

**Returns:** Array of all collected tokens

**Use cases:** Gathering all tokens, inventory, state inspection

**Events:** Emits `tokens:collected`

---

## `tokens:count`

Count tokens with optional filtering.

```javascript
// Count all
const deckSize = engine.dispatch("tokens:count", {
  source: "deck"
});

// Count matching
const redCount = engine.dispatch("tokens:count", {
  tokens: allCards,
  predicate: (token) => token.meta.color === "red"
});

// Count from source with filter
const expensive = engine.dispatch("tokens:count", {
  source: "hand",
  predicate: (token) => token.meta.cost > 5
});
```

**Parameters:**
- `tokens` (Array<Token>): Tokens to count
- `predicate` (function, optional): Filter function
- `source` (string): Source to count from

**Returns:** Number of tokens

**Use cases:** Hand size, resource counts, win conditions

**Events:** Emits `tokens:counted`

---

## `tokens:find`

Find first token matching criteria.

```javascript
// Find by ID
const card = engine.dispatch("tokens:find", {
  tokens: deck.cards,
  predicate: (token) => token.id === "ace-spades"
});

// Find by property
const cheapest = engine.dispatch("tokens:find", {
  source: "hand",
  predicate: (token) => token.meta.cost === 1
});

// Returns null if not found
const legendary = engine.dispatch("tokens:find", {
  source: "battlefield",
  predicate: (token) => token.meta.rarity === "legendary"
});
```

**Parameters:**
- `tokens` (Array<Token>): Tokens to search
- `predicate` (function, required): Match function
- `source` (string): Source to search

**Returns:** First matching token, or null

**Use cases:** Searching, lookups, existence checks

**Events:** Emits `tokens:found`

---

## Action Index

**Deck (10)**
- deck:shuffle
- deck:draw
- deck:reset
- deck:burn
- deck:peek
- deck:cut
- deck:insertAt
- deck:removeAt
- deck:swap
- deck:reverse

**Table (13)**
- table:place
- table:clear
- table:move
- table:flip
- table:remove
- table:createZone
- table:deleteZone
- table:clearZone
- table:shuffleZone
- table:transferZone
- table:fanZone
- table:stackZone
- table:spreadZone
- table:lockZone

**Shoe (7)**
- shoe:draw
- shoe:shuffle
- shoe:burn
- shoe:reset
- shoe:addDeck
- shoe:removeDeck
- shoe:inspect

**Player (12)**
- player:create
- player:remove
- player:setActive
- player:giveResource
- player:takeResource
- player:drawCards
- player:discardCards
- player:get
- player:transfer
- player:trade
- player:steal

**Game (6)**
- game:start
- game:end
- game:pause
- game:resume
- game:nextPhase
- game:setProperty

**Token (5)**
- token:transform
- token:attach
- token:detach
- token:merge
- token:split

**Batch (5)**
- tokens:filter
- tokens:forEach
- tokens:collect
- tokens:count
- tokens:find

---

## Notes

- All actions are synchronous except where noted
- All actions emit events through EventBus
- Player transfer actions track transactions in `engine._transactions`
- Token transformations preserve metadata by merging
- Batch operations work on both arrays and engine sources
- See individual examples in `/examples` for real usage

---

**Total: 58 actions - 100% complete**