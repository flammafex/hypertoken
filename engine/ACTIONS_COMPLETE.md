# HyperToken Action Reference

Complete documentation for all 58 built-in actions in the HyperToken engine.

---

## Quick Reference

### By Category

| Category | Count | Actions |
|----------|-------|---------|
| **Stack** | 10 | shuffle, draw, reset, burn, peek, cut, insertAt, removeAt, swap, reverse |
| **Space** | 13 | place, clear, move, flip, remove, createZone, deleteZone, clearZone, shuffleZone, transferZone, fanZone, stackZone, spreadZone, lockZone |
| **Source** | 7 | draw, shuffle, burn, reset, addStack, removeStack, inspect |
| **Agent** | 12 | create, remove, setActive, giveResource, takeResource, drawCards, discardCards, get, **transfer, trade, steal** |
| **Game** | 6 | start, end, pause, resume, nextPhase, setProperty |
| **Token** | 5 | transform, attach, detach, merge, split |
| **Batch** | 5 | filter, forEach, collect, count, find |
| **Total** | **58** | **100% Complete** |

---

## Space of Contents

1. [Stack Actions](#stack-actions) (10)
2. [Space Actions](#space-actions) (13)
3. [Source Actions](#source-actions) (7)
4. [Agent Actions](#agent-actions) (12)
5. [Game Actions](#game-actions) (6)
6. [Token Actions](#token-actions) (5)
7. [Batch Actions](#batch-actions) (5)

---

# Stack Actions

Operations on the primary card stack. The stack is a stack-based collection with shuffling, drawing, and manipulation capabilities.

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

**Use cases:** Start of game, after collecting discards

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

**Returns:** Single card (if count=1) or array of cards

**Use cases:** Agent draws cards, dealing hands

---

## `stack:reset`

Reset stack to original unshuffled state.

```javascript
engine.dispatch("stack:reset");
```

**Parameters:** none

**Returns:** void

**Use cases:** Starting a new game, practice mode

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

**Use cases:** Poker (burn before flop), discarding unknown cards

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

**Returns:** Array of cards (does not modify stack)

**Use cases:** Scrying effects, looking ahead, AI planning

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

**Use cases:** Traditional stack cutting, shuffling variations

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
- `position` (number, default: 0): Index to insert at

**Returns:** void

**Use cases:** Putting cards back, magical effects, stack manipulation

---

## `stack:removeAt`

Remove and return card at specific position.

```javascript
const card = engine.dispatch("stack:removeAt", { position: 10 });
```

**Parameters:**
- `position` (number, default: 0): Index to remove from

**Returns:** The removed card

**Use cases:** Removing specific cards, stack manipulation

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

**Use cases:** Stack manipulation, magical effects

---

## `stack:reverse`

Reverse the entire stack order.

```javascript
engine.dispatch("stack:reverse");
```

**Parameters:** none

**Returns:** void

**Use cases:** Stack manipulation, special effects

---

# Space Actions

Operations on the game space and zones. The space supports multiple named zones with spatial positioning and card placement.

---

## `space:place`

Place a card/token in a zone.

```javascript
engine.dispatch("space:place", {
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

## `space:clear`

Clear all tokens from the space.

```javascript
engine.dispatch("space:clear");
```

**Parameters:** none

**Returns:** void

**Use cases:** Reset board, end of game

---

## `space:move`

Move a token from one zone to another.

```javascript
engine.dispatch("space:move", {
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

## `space:flip`

Flip a card face up or face down.

```javascript
engine.dispatch("space:flip", {
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

## `space:remove`

Remove a token from the space.

```javascript
engine.dispatch("space:remove", {
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

## `space:createZone`

Create a new named zone.

```javascript
engine.dispatch("space:createZone", {
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

## `space:deleteZone`

Delete a zone and its contents.

```javascript
engine.dispatch("space:deleteZone", {
  name: "graveyard"
});
```

**Parameters:**
- `name` (string, required): Zone to delete

**Returns:** void

**Use cases:** Cleaning up, removing temporary zones

---

## `space:clearZone`

Clear all tokens from a specific zone.

```javascript
engine.dispatch("space:clearZone", {
  zone: "field"
});
```

**Parameters:**
- `zone` (string, required): Zone to clear

**Returns:** void

**Use cases:** Resetting play area, clearing board section

---

## `space:shuffleZone`

Randomize token positions in a zone.

```javascript
engine.dispatch("space:shuffleZone", {
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

## `space:transferZone`

Move all tokens from one zone to another.

```javascript
engine.dispatch("space:transferZone", {
  from: "stack",
  to: "discard"
});
```

**Parameters:**
- `from` (string, required): Source zone
- `to` (string, required): Destination zone

**Returns:** void

**Use cases:** Bulk movement, end-of-round cleanup

---

## `space:fanZone`

Arrange tokens in a fan layout.

```javascript
engine.dispatch("space:fanZone", {
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

## `space:stackZone`

Stack tokens vertically.

```javascript
engine.dispatch("space:stackZone", {
  zone: "stack",
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

**Use cases:** Stack visualization, pile displays

---

## `space:spreadZone`

Spread tokens in a line.

```javascript
engine.dispatch("space:spreadZone", {
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

**Use cases:** Laying out cards, displaying spaceau

---

## `space:lockZone`

Lock a zone to prevent modifications.

```javascript
engine.dispatch("space:lockZone", {
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

# Source Actions

Operations on multi-stack containers (sources). Useful for games requiring multiple stacks or weighted randomness.

---

## `source:draw`

Draw a card from the source.

```javascript
const card = engine.dispatch("source:draw");
```

**Parameters:** none

**Returns:** Single card from source

**Use cases:** Drawing from combined stacks, blackjack

---

## `source:shuffle`

Shuffle all stacks in the source.

```javascript
engine.dispatch("source:shuffle", { seed: 42 });
```

**Parameters:**
- `seed` (number, optional): Random seed

**Returns:** void

**Use cases:** Reshuffling multi-stack source

---

## `source:burn`

Burn N cards from the source.

```javascript
engine.dispatch("source:burn", { count: 5 });
```

**Parameters:**
- `count` (number, default: 1): Cards to burn

**Returns:** void

**Use cases:** Casino procedures

---

## `source:reset`

Reset source to original state.

```javascript
engine.dispatch("source:reset");
```

**Parameters:** none

**Returns:** void

**Use cases:** New source, reset game

---

## `source:addStack`

Add a stack to the source.

```javascript
engine.dispatch("source:addStack", {
  stack: myStack
});
```

**Parameters:**
- `stack` (Stack, required): Stack to add

**Returns:** void

**Use cases:** Building multi-stack source, adding cards

---

## `source:removeStack`

Remove a stack from the source.

```javascript
engine.dispatch("source:removeStack", {
  index: 0
});
```

**Parameters:**
- `index` (number, required): Stack index to remove

**Returns:** Removed stack

**Use cases:** Removing exhausted stack

---

## `source:inspect`

Inspect source contents.

```javascript
const info = engine.dispatch("source:inspect");
// Returns: { stackCount: 6, totalCards: 312, ... }
```

**Parameters:** none

**Returns:** Source information object

**Use cases:** Debugging, game state display

---

# Agent Actions

Operations on agents, including creation, resource management, and agent-to-agent interactions.

---

## `agent:create`

Create a new agent.

```javascript
engine.dispatch("agent:create", {
  name: "Alice",
  agent: myAIAgent,
  meta: { color: "blue", avatar: "knight" }
});
```

**Parameters:**
- `name` (string, required): Agent name
- `agent` (object, optional): AI agent
- `meta` (object, optional): Custom metadata

**Returns:** Agent object

**Use cases:** Game setup, adding agents

---

## `agent:remove`

Remove a agent from the game.

```javascript
engine.dispatch("agent:remove", {
  name: "Alice"
});
```

**Parameters:**
- `name` (string, required): Agent to remove

**Returns:** void

**Use cases:** Agent elimination, leaving game

---

## `agent:setActive`

Set agent active/inactive state.

```javascript
engine.dispatch("agent:setActive", {
  name: "Alice",
  active: false
});
```

**Parameters:**
- `name` (string, required): Agent name
- `active` (boolean, default: true): Active state

**Returns:** void

**Use cases:** Folding in poker, sitting out, elimination

---

## `agent:giveResource`

Give resources to a agent.

```javascript
engine.dispatch("agent:giveResource", {
  name: "Alice",
  resource: "gold",
  amount: 100
});
```

**Parameters:**
- `name` (string, required): Agent name
- `resource` (string, required): Resource type
- `amount` (number, default: 1): Amount to give

**Returns:** void

**Use cases:** Earning money, gaining points, rewards

---

## `agent:takeResource`

Take resources from a agent.

```javascript
engine.dispatch("agent:takeResource", {
  name: "Alice",
  resource: "gold",
  amount: 50
});
```

**Parameters:**
- `name` (string, required): Agent name
- `resource` (string, required): Resource type
- `amount` (number, default: 1): Amount to take

**Returns:** void

**Use cases:** Spending money, paying costs, penalties

---

## `agent:drawCards`

Agent draws cards from stack/source.

```javascript
engine.dispatch("agent:drawCards", {
  name: "Alice",
  count: 5,
  source: "stack"
});
```

**Parameters:**
- `name` (string, required): Agent name
- `count` (number, default: 1): Cards to draw
- `source` (string, default: "stack"): Source ("stack" or "source")

**Returns:** void

**Use cases:** Drawing cards, dealing hands

---

## `agent:discardCards`

Agent discards specific cards.

```javascript
engine.dispatch("agent:discardCards", {
  name: "Alice",
  cards: [card1, card2]
});
```

**Parameters:**
- `name` (string, required): Agent name
- `cards` (Array<Token> or Token, required): Cards to discard

**Returns:** void

**Use cases:** Discarding, playing cards

---

## `agent:get`

Get agent state.

```javascript
const agent = engine.dispatch("agent:get", {
  name: "Alice"
});
```

**Parameters:**
- `name` (string, required): Agent name

**Returns:** Agent object

**Use cases:** Querying state, AI decision-making

---

## `agent:transfer`

Transfer resources/tokens between agents.

```javascript
// Transfer resources
engine.dispatch("agent:transfer", {
  from: "Alice",
  to: "Bob",
  resource: "gold",
  amount: 50
});

// Transfer a token
engine.dispatch("agent:transfer", {
  from: "Alice",
  to: "Bob",
  token: magicSword
});
```

**Parameters:**
- `from` (string, required): Source agent
- `to` (string, required): Target agent
- `resource` (string): Resource type (if transferring resources)
- `amount` (number, default: 1): Amount to transfer
- `token` (Token): Specific token to transfer

**Returns:** Transfer result object

**Use cases:** Gifting, tribute, payment, lending

**Events:** Emits `agent:transfer`

---

## `agent:trade`

Bidirectional exchange between agents.

```javascript
// Resource for resource
engine.dispatch("agent:trade", {
  agent1: { 
    name: "Alice", 
    offer: { resource: "gold", amount: 100 }
  },
  agent2: { 
    name: "Bob", 
    offer: { resource: "wood", amount: 200 }
  }
});

// Token for resource
engine.dispatch("agent:trade", {
  agent1: { 
    name: "Alice", 
    offer: { token: magicRing }
  },
  agent2: { 
    name: "Bob", 
    offer: { resource: "gold", amount: 500 }
  }
});
```

**Parameters:**
- `agent1` (object, required):
  - `name` (string): Agent name
  - `offer` (object): What they offer
    - `resource` + `amount`, OR `token`
- `agent2` (object, required): Same structure

**Returns:** Trade result with transaction

**Use cases:** Marketplace, bartering, agreements

**Events:** Emits `agent:trade`

**Notes:** Atomic operation - both transfers succeed or both fail

---

## `agent:steal`

Forcibly take resources/tokens (with optional validation).

```javascript
// Basic steal
engine.dispatch("agent:steal", {
  from: "Victim",
  to: "Thief",
  resource: "gold",
  amount: 50
});

// Steal with validation
engine.dispatch("agent:steal", {
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
- `from` (string, required): Victim agent
- `to` (string, required): Thief agent
- `resource` (string): Resource type
- `amount` (number, default: 1): Amount to steal
- `token` (Token): Specific token to steal
- `validate` (function, optional): Validation function

**Returns:** Steal result object

**Use cases:** Theft mechanics, raiding, piracy, combat loot

**Events:** Emits `agent:steal`

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
  tokens: stack.cards,
  predicate: (token) => token.meta.color === "red"
});

// Filter from source
const highValue = engine.dispatch("tokens:filter", {
  source: "stack",
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
- `source` (string): Source to filter from ('stack', 'space', or zone name)

**Returns:** Array of matching tokens

**Use cases:** Finding cards, selecting units, queries

**Events:** Emits `tokens:filtered`

---

## `tokens:forEach`

Apply operation to each token.

```javascript
// Modify tokens
engine.dispatch("tokens:forEach", {
  tokens: agentHand,
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
  tokens: stack.cards,
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
  sources: ["stack", "space", "discard"]
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
  - Standard: 'stack', 'space', 'discard', 'source'
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
const stackSize = engine.dispatch("tokens:count", {
  source: "stack"
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
  tokens: stack.cards,
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

**Stack (10)**
- stack:shuffle
- stack:draw
- stack:reset
- stack:burn
- stack:peek
- stack:cut
- stack:insertAt
- stack:removeAt
- stack:swap
- stack:reverse

**Space (13)**
- space:place
- space:clear
- space:move
- space:flip
- space:remove
- space:createZone
- space:deleteZone
- space:clearZone
- space:shuffleZone
- space:transferZone
- space:fanZone
- space:stackZone
- space:spreadZone
- space:lockZone

**Source (7)**
- source:draw
- source:shuffle
- source:burn
- source:reset
- source:addStack
- source:removeStack
- source:inspect

**Agent (12)**
- agent:create
- agent:remove
- agent:setActive
- agent:giveResource
- agent:takeResource
- agent:drawCards
- agent:discardCards
- agent:get
- agent:transfer
- agent:trade
- agent:steal

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
- Agent transfer actions track transactions in `engine._transactions`
- Token transformations preserve metadata by merging
- Batch operations work on both arrays and engine sources
- See individual examples in `/examples` for real usage

---

**Total: 58 actions - 100% complete**