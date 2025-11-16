# Player Actions

Player management and player-to-player interactions. Includes creation, resource management, and economic transfers.

[← Back to Action Reference](../ACTIONS.md)

---

## Actions (12)

**Management (4)**
1. [player:create](#playercreate) - Create a new player
2. [player:remove](#playerremove) - Remove a player
3. [player:setActive](#playersetactive) - Set active/inactive state
4. [player:get](#playerget) - Get player state

**Resources (4)**
5. [player:giveResource](#playergiveresource) - Give resources to player
6. [player:takeResource](#playertakeresource) - Take resources from player
7. [player:drawCards](#playerdrawcards) - Player draws cards
8. [player:discardCards](#playerdiscardcards) - Player discards cards

**Transfers (3)** ⭐ New
9. [player:transfer](#playertransfer) - Direct resource/token transfer
10. [player:trade](#playertrade) - Bidirectional exchange (atomic)
11. [player:steal](#playersteal) - Forcible taking (with validation)

---

## Player Management

### `player:create`

Create a new player and add to the game.

```javascript
engine.dispatch("player:create", {
  name: "Alice",
  agent: myAIAgent,
  meta: { color: "blue", avatar: "knight" }
});
```

**Parameters:**
- `name` (string, required): Player name (must be unique)
- `agent` (object, optional): AI agent for autonomous play
- `meta` (object, optional): Custom metadata

**Returns:** Player object

**Events:** `player:created`

**Player structure:**
```javascript
{
  id: "uuid",
  name: "Alice",
  active: true,
  resources: {},
  hand: [],
  zones: Map,
  meta: { ... }
}
```

**Example:**
```javascript
// Human player
engine.dispatch("player:create", { name: "Alice" });

// AI player
const agent = new MyAIAgent();
engine.dispatch("player:create", { 
  name: "Bot", 
  agent 
});

// With metadata
engine.dispatch("player:create", {
  name: "Player1",
  meta: { color: "#FF0000", team: "red" }
});
```

---

### `player:remove`

Remove a player from the game.

```javascript
engine.dispatch("player:remove", {
  name: "Alice"
});
```

**Parameters:**
- `name` (string, required): Player to remove

**Returns:** void

**Events:** `player:removed`

**Use cases:**
- Player elimination
- Leaving game
- Disconnection

---

### `player:setActive`

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

**Events:** `player:activeChanged`

**Use cases:**
- Folding in poker
- Sitting out
- Temporary elimination
- Turn skipping

**Example:**
```javascript
// Player folds
engine.dispatch("player:setActive", { 
  name: "Alice", 
  active: false 
});

// Player rejoins
engine.dispatch("player:setActive", { 
  name: "Alice", 
  active: true 
});
```

---

### `player:get`

Get player state.

```javascript
const player = engine.dispatch("player:get", {
  name: "Alice"
});
```

**Parameters:**
- `name` (string, required): Player name

**Returns:** Player object

**Use cases:**
- Querying state
- AI decision-making
- Displaying info
- Debugging

**Example:**
```javascript
const player = engine.dispatch("player:get", { name: "Alice" });
console.log(`${player.name} has ${player.resources.gold} gold`);
console.log(`Hand size: ${player.hand.length}`);
```

---

## Resource Management

### `player:giveResource`

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

**Events:** `player:resourceGiven`

**Use cases:**
- Earning money
- Gaining points
- Rewards
- Income

**Example:**
```javascript
// Award victory points
engine.dispatch("player:giveResource", {
  name: "Alice",
  resource: "points",
  amount: 10
});

// Give starting gold
engine.dispatch("player:giveResource", {
  name: "Alice",
  resource: "gold",
  amount: 500
});
```

---

### `player:takeResource`

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

**Events:** `player:resourceTaken`

**Notes:** Won't go below 0

**Use cases:**
- Spending money
- Paying costs
- Penalties
- Taxes

**Example:**
```javascript
// Pay building cost
engine.dispatch("player:takeResource", {
  name: "Alice",
  resource: "gold",
  amount: 200
});
```

---

### `player:drawCards`

Player draws cards from deck or shoe.

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

**Events:** `player:drew`

**Use cases:**
- Drawing cards
- Dealing hands
- "Draw N cards" abilities

**Example:**
```javascript
// Deal starting hand
engine.dispatch("player:drawCards", { 
  name: "Alice", 
  count: 7 
});

// Draw from shoe (blackjack)
engine.dispatch("player:drawCards", {
  name: "Alice",
  count: 2,
  source: "shoe"
});
```

---

### `player:discardCards`

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

**Events:** `player:discarded`

**Use cases:**
- Discarding
- Playing cards
- Hand limit enforcement

**Example:**
```javascript
const player = engine.dispatch("player:get", { name: "Alice" });

// Discard single card
engine.dispatch("player:discardCards", {
  name: "Alice",
  cards: player.hand[0]
});

// Discard multiple
engine.dispatch("player:discardCards", {
  name: "Alice",
  cards: player.hand.slice(0, 2)
});
```

---

## Player-to-Player Transfers

### `player:transfer`

Transfer resources or tokens from one player to another (one-way).

```javascript
// Transfer resources
engine.dispatch("player:transfer", {
  from: "Alice",
  to: "Bob",
  resource: "gold",
  amount: 50
});

// Transfer a specific token
engine.dispatch("player:transfer", {
  from: "Alice",
  to: "Bob",
  token: magicSwordToken
});
```

**Parameters:**
- `from` (string, required): Source player name
- `to` (string, required): Target player name
- `resource` (string): Resource type (if transferring resources)
- `amount` (number, default: 1): Amount to transfer
- `token` (Token): Specific token to transfer (alternative to resource)

**Returns:**
```javascript
{
  success: true,
  from: { player: "Alice", remaining: 50 },
  to: { player: "Bob", total: 100 }
}
// OR for token transfers:
{
  success: true,
  token: { id: "sword-1", ... }
}
```

**Events:** `player:transfer`

**Validation:**
- Source player must exist
- Target player must exist
- Source must have sufficient resources/token
- Transaction is recorded in `engine._transactions`

**Use cases:**
- Gifting
- Tribute/taxes
- Payment for services
- Lending

**Example:**
```javascript
// Pay another player
engine.dispatch("player:transfer", {
  from: "Alice",
  to: "Bob",
  resource: "gold",
  amount: 100
});

// Give item to teammate
engine.dispatch("player:transfer", {
  from: "Alice",
  to: "Bob",
  token: healingPotion
});

// Check transaction history
console.log(engine._transactions);
```

---

### `player:trade`

Bidirectional exchange between two players (atomic).

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

// Token for token
engine.dispatch("player:trade", {
  player1: { 
    name: "Alice", 
    offer: { token: sword }
  },
  player2: { 
    name: "Bob", 
    offer: { token: shield }
  }
});
```

**Parameters:**
- `player1` (object, required):
  - `name` (string): Player name
  - `offer` (object): What they're offering
    - `resource` (string) + `amount` (number), OR
    - `token` (Token)
- `player2` (object, required): Same structure as player1

**Returns:**
```javascript
{
  success: true,
  transaction: {
    type: 'trade',
    player1: "Alice",
    player2: "Bob",
    offer1: { ... },
    offer2: { ... },
    timestamp: 1234567890
  }
}
```

**Events:** `player:trade`

**Validation:**
- Both players must exist
- Both players must have what they're offering
- Trade is atomic - both transfers succeed or both fail
- Transaction is recorded

**Use cases:**
- Marketplace trading
- Bartering
- Item exchange
- Resource economy

**Example:**
```javascript
// Multiplayer economy
const tradeResult = engine.dispatch("player:trade", {
  player1: { 
    name: "Merchant", 
    offer: { resource: "food", amount: 50 }
  },
  player2: { 
    name: "Farmer", 
    offer: { resource: "gold", amount: 100 }
  }
});

if (tradeResult.success) {
  console.log("Trade completed!");
}
```

---

### `player:steal`

Forcibly take resources/tokens from another player (with optional validation).

```javascript
// Basic steal
engine.dispatch("player:steal", {
  from: "Victim",
  to: "Thief",
  resource: "gold",
  amount: 50
});

// Steal with validation (ability check)
engine.dispatch("player:steal", {
  from: "Victim",
  to: "Thief",
  resource: "gold",
  amount: 50,
  validate: (thief, victim, engine) => {
    return thief.meta.hasThiefAbility === true;
  }
});

// Steal a token
engine.dispatch("player:steal", {
  from: "Victim",
  to: "Thief",
  token: treasureChest
});
```

**Parameters:**
- `from` (string, required): Victim player name
- `to` (string, required): Thief player name
- `resource` (string): Resource type to steal
- `amount` (number, default: 1): Amount to steal
- `token` (Token): Specific token to steal
- `validate` (function, optional): `(thief, victim, engine) => boolean`

**Returns:**
```javascript
{
  success: true,
  stolen: 30,  // Actual amount stolen (may be less than requested)
  from: { player: "Victim", remaining: 20 },
  to: { player: "Thief", total: 30 }
}
```

**Events:** `player:steal`

**Behavior:**
- Steals as much as possible (up to requested amount)
- If victim has less than requested, steals all available
- Throws error if victim has nothing to steal
- Optional validation function can prevent steal
- Transaction is recorded

**Use cases:**
- Theft abilities
- Raiding/piracy
- Combat looting
- Bandit mechanics

**Example:**
```javascript
// Simple theft
try {
  const result = engine.dispatch("player:steal", {
    from: "Merchant",
    to: "Bandit",
    resource: "gold",
    amount: 100
  });
  
  console.log(`Stole ${result.stolen} gold!`);
} catch (error) {
  console.log("Theft failed:", error.message);
}

// Theft with skill check
const stealResult = engine.dispatch("player:steal", {
  from: "Merchant",
  to: "Rogue",
  resource: "gold",
  amount: 50,
  validate: (rogue, merchant, engine) => {
    // Success based on stats
    const skill = Math.random() * rogue.meta.stealth;
    const awareness = Math.random() * merchant.meta.awareness;
    return skill > awareness;
  }
});
```

---

## Transaction Tracking

All transfer actions record transactions in `engine._transactions`:

```javascript
// After transfers
console.log(engine._transactions);

// Output:
[
  {
    type: 'resource_transfer',
    from: 'Alice',
    to: 'Bob',
    resource: 'gold',
    amount: 50,
    timestamp: 1234567890
  },
  {
    type: 'trade',
    player1: 'Alice',
    player2: 'Bob',
    offer1: { resource: 'gold', amount: 100 },
    offer2: { resource: 'wood', amount: 200 },
    timestamp: 1234567891
  },
  {
    type: 'steal_resource',
    from: 'Victim',
    to: 'Thief',
    resource: 'gold',
    amount: 30,
    timestamp: 1234567892
  }
]
```

**Use for:**
- Audit logs
- Replay functionality
- Statistics
- Dispute resolution
- Game history

---

## Common Patterns

### Game Setup
```javascript
// Create players
["Alice", "Bob", "Charlie"].forEach(name => {
  engine.dispatch("player:create", { name });
  engine.dispatch("player:giveResource", {
    name,
    resource: "gold",
    amount: 1000
  });
});
```

### Trading Economy
```javascript
// Marketplace system
class Marketplace {
  constructor(engine) {
    this.engine = engine;
    this.offers = [];
  }
  
  postOffer(playerName, gives, wants) {
    this.offers.push({ player: playerName, gives, wants });
  }
  
  acceptOffer(buyerName, offerId) {
    const offer = this.offers[offerId];
    
    this.engine.dispatch("player:trade", {
      player1: { name: buyerName, offer: offer.wants },
      player2: { name: offer.player, offer: offer.gives }
    });
    
    this.offers.splice(offerId, 1);
  }
}
```

### Tribute System
```javascript
// Vassals pay lords
function collectTribute(engine, vassals, lord, amount) {
  vassals.forEach(vassal => {
    engine.dispatch("player:transfer", {
      from: vassal,
      to: lord,
      resource: "gold",
      amount: amount
    });
  });
}
```

### Combat Looting
```javascript
// Winner loots loser
function combatLoot(engine, winner, loser) {
  const loserPlayer = engine.dispatch("player:get", { name: loser });
  const goldAmount = Math.floor((loserPlayer.resources.gold || 0) / 2);
  
  if (goldAmount > 0) {
    engine.dispatch("player:steal", {
      from: loser,
      to: winner,
      resource: "gold",
      amount: goldAmount
    });
  }
  
  // Steal random item
  if (loserPlayer.hand.length > 0) {
    const randomItem = loserPlayer.hand[
      Math.floor(Math.random() * loserPlayer.hand.length)
    ];
    
    engine.dispatch("player:steal", {
      from: loser,
      to: winner,
      token: randomItem
    });
  }
}
```

---

[← Back to Action Reference](../ACTIONS.md)