# Agent Actions

Agent management and agent-to-agent interactions. Includes creation, resource management, and economic transfers.

[← Back to Action Reference](../ACTIONS.md)

---

## Actions (12)

**Management (4)**
1. [agent:create](#agentcreate) - Create a new agent
2. [agent:remove](#agentremove) - Remove a agent
3. [agent:setActive](#agentsetactive) - Set active/inactive state
4. [agent:get](#agentget) - Get agent state

**Resources (4)**
5. [agent:giveResource](#agentgiveresource) - Give resources to agent
6. [agent:takeResource](#agenttakeresource) - Take resources from agent
7. [agent:drawCards](#agentdrawcards) - Agent draws cards
8. [agent:discardCards](#agentdiscardcards) - Agent discards cards

**Transfers (3)** ⭐ New
9. [agent:transfer](#agenttransfer) - Direct resource/token transfer
10. [agent:trade](#agenttrade) - Bidirectional exchange (atomic)
11. [agent:steal](#agentsteal) - Forcible taking (with validation)

---

## Agent Management

### `agent:create`

Create a new agent and add to the game.

```javascript
engine.dispatch("agent:create", {
  name: "Alice",
  agent: myAIAgent,
  meta: { color: "blue", avatar: "knight" }
});
```

**Parameters:**
- `name` (string, required): Agent name (must be unique)
- `agent` (object, optional): AI agent for autonomous play
- `meta` (object, optional): Custom metadata

**Returns:** Agent object

**Events:** `agent:created`

**Agent structure:**
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
// Human agent
engine.dispatch("agent:create", { name: "Alice" });

// AI agent
const agent = new MyAIAgent();
engine.dispatch("agent:create", { 
  name: "Bot", 
  agent 
});

// With metadata
engine.dispatch("agent:create", {
  name: "Agent1",
  meta: { color: "#FF0000", team: "red" }
});
```

---

### `agent:remove`

Remove a agent from the game.

```javascript
engine.dispatch("agent:remove", {
  name: "Alice"
});
```

**Parameters:**
- `name` (string, required): Agent to remove

**Returns:** void

**Events:** `agent:removed`

**Use cases:**
- Agent elimination
- Leaving game
- Disconnection

---

### `agent:setActive`

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

**Events:** `agent:activeChanged`

**Use cases:**
- Folding in poker
- Sitting out
- Temporary elimination
- Turn skipping

**Example:**
```javascript
// Agent folds
engine.dispatch("agent:setActive", { 
  name: "Alice", 
  active: false 
});

// Agent rejoins
engine.dispatch("agent:setActive", { 
  name: "Alice", 
  active: true 
});
```

---

### `agent:get`

Get agent state.

```javascript
const agent = engine.dispatch("agent:get", {
  name: "Alice"
});
```

**Parameters:**
- `name` (string, required): Agent name

**Returns:** Agent object

**Use cases:**
- Querying state
- AI decision-making
- Displaying info
- Debugging

**Example:**
```javascript
const agent = engine.dispatch("agent:get", { name: "Alice" });
console.log(`${agent.name} has ${agent.resources.gold} gold`);
console.log(`Hand size: ${agent.hand.length}`);
```

---

## Resource Management

### `agent:giveResource`

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

**Events:** `agent:resourceGiven`

**Use cases:**
- Earning money
- Gaining points
- Rewards
- Income

**Example:**
```javascript
// Award victory points
engine.dispatch("agent:giveResource", {
  name: "Alice",
  resource: "points",
  amount: 10
});

// Give starting gold
engine.dispatch("agent:giveResource", {
  name: "Alice",
  resource: "gold",
  amount: 500
});
```

---

### `agent:takeResource`

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

**Events:** `agent:resourceTaken`

**Notes:** Won't go below 0

**Use cases:**
- Spending money
- Paying costs
- Penalties
- Taxes

**Example:**
```javascript
// Pay building cost
engine.dispatch("agent:takeResource", {
  name: "Alice",
  resource: "gold",
  amount: 200
});
```

---

### `agent:drawCards`

Agent draws cards from stack or source.

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

**Events:** `agent:drew`

**Use cases:**
- Drawing cards
- Dealing hands
- "Draw N cards" abilities

**Example:**
```javascript
// Deal starting hand
engine.dispatch("agent:drawCards", { 
  name: "Alice", 
  count: 7 
});

// Draw from source (blackjack)
engine.dispatch("agent:drawCards", {
  name: "Alice",
  count: 2,
  source: "source"
});
```

---

### `agent:discardCards`

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

**Events:** `agent:discarded`

**Use cases:**
- Discarding
- Playing cards
- Hand limit enforcement

**Example:**
```javascript
const agent = engine.dispatch("agent:get", { name: "Alice" });

// Discard single card
engine.dispatch("agent:discardCards", {
  name: "Alice",
  cards: agent.hand[0]
});

// Discard multiple
engine.dispatch("agent:discardCards", {
  name: "Alice",
  cards: agent.hand.slice(0, 2)
});
```

---

## Agent-to-Agent Transfers

### `agent:transfer`

Transfer resources or tokens from one agent to another (one-way).

```javascript
// Transfer resources
engine.dispatch("agent:transfer", {
  from: "Alice",
  to: "Bob",
  resource: "gold",
  amount: 50
});

// Transfer a specific token
engine.dispatch("agent:transfer", {
  from: "Alice",
  to: "Bob",
  token: magicSwordToken
});
```

**Parameters:**
- `from` (string, required): Source agent name
- `to` (string, required): Target agent name
- `resource` (string): Resource type (if transferring resources)
- `amount` (number, default: 1): Amount to transfer
- `token` (Token): Specific token to transfer (alternative to resource)

**Returns:**
```javascript
{
  success: true,
  from: { agent: "Alice", remaining: 50 },
  to: { agent: "Bob", total: 100 }
}
// OR for token transfers:
{
  success: true,
  token: { id: "sword-1", ... }
}
```

**Events:** `agent:transfer`

**Validation:**
- Source agent must exist
- Target agent must exist
- Source must have sufficient resources/token
- Transaction is recorded in `engine._transactions`

**Use cases:**
- Gifting
- Tribute/taxes
- Payment for services
- Lending

**Example:**
```javascript
// Pay another agent
engine.dispatch("agent:transfer", {
  from: "Alice",
  to: "Bob",
  resource: "gold",
  amount: 100
});

// Give item to teammate
engine.dispatch("agent:transfer", {
  from: "Alice",
  to: "Bob",
  token: healingPotion
});

// Check transaction history
console.log(engine._transactions);
```

---

### `agent:trade`

Bidirectional exchange between two agents (atomic).

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

// Token for token
engine.dispatch("agent:trade", {
  agent1: { 
    name: "Alice", 
    offer: { token: sword }
  },
  agent2: { 
    name: "Bob", 
    offer: { token: shield }
  }
});
```

**Parameters:**
- `agent1` (object, required):
  - `name` (string): Agent name
  - `offer` (object): What they're offering
    - `resource` (string) + `amount` (number), OR
    - `token` (Token)
- `agent2` (object, required): Same structure as agent1

**Returns:**
```javascript
{
  success: true,
  transaction: {
    type: 'trade',
    agent1: "Alice",
    agent2: "Bob",
    offer1: { ... },
    offer2: { ... },
    timestamp: 1234567890
  }
}
```

**Events:** `agent:trade`

**Validation:**
- Both agents must exist
- Both agents must have what they're offering
- Trade is atomic - both transfers succeed or both fail
- Transaction is recorded

**Use cases:**
- Marketplace trading
- Bartering
- Item exchange
- Resource economy

**Example:**
```javascript
// Multiagent economy
const tradeResult = engine.dispatch("agent:trade", {
  agent1: { 
    name: "Merchant", 
    offer: { resource: "food", amount: 50 }
  },
  agent2: { 
    name: "Farmer", 
    offer: { resource: "gold", amount: 100 }
  }
});

if (tradeResult.success) {
  console.log("Trade completed!");
}
```

---

### `agent:steal`

Forcibly take resources/tokens from another agent (with optional validation).

```javascript
// Basic steal
engine.dispatch("agent:steal", {
  from: "Victim",
  to: "Thief",
  resource: "gold",
  amount: 50
});

// Steal with validation (ability check)
engine.dispatch("agent:steal", {
  from: "Victim",
  to: "Thief",
  resource: "gold",
  amount: 50,
  validate: (thief, victim, engine) => {
    return thief.meta.hasThiefAbility === true;
  }
});

// Steal a token
engine.dispatch("agent:steal", {
  from: "Victim",
  to: "Thief",
  token: treasureChest
});
```

**Parameters:**
- `from` (string, required): Victim agent name
- `to` (string, required): Thief agent name
- `resource` (string): Resource type to steal
- `amount` (number, default: 1): Amount to steal
- `token` (Token): Specific token to steal
- `validate` (function, optional): `(thief, victim, engine) => boolean`

**Returns:**
```javascript
{
  success: true,
  stolen: 30,  // Actual amount stolen (may be less than requested)
  from: { agent: "Victim", remaining: 20 },
  to: { agent: "Thief", total: 30 }
}
```

**Events:** `agent:steal`

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
  const result = engine.dispatch("agent:steal", {
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
const stealResult = engine.dispatch("agent:steal", {
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
    agent1: 'Alice',
    agent2: 'Bob',
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
// Create agents
["Alice", "Bob", "Charlie"].forEach(name => {
  engine.dispatch("agent:create", { name });
  engine.dispatch("agent:giveResource", {
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
  
  postOffer(agentName, gives, wants) {
    this.offers.push({ agent: agentName, gives, wants });
  }
  
  acceptOffer(buyerName, offerId) {
    const offer = this.offers[offerId];
    
    this.engine.dispatch("agent:trade", {
      agent1: { name: buyerName, offer: offer.wants },
      agent2: { name: offer.agent, offer: offer.gives }
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
    engine.dispatch("agent:transfer", {
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
  const loserAgent = engine.dispatch("agent:get", { name: loser });
  const goldAmount = Math.floor((loserAgent.resources.gold || 0) / 2);
  
  if (goldAmount > 0) {
    engine.dispatch("agent:steal", {
      from: loser,
      to: winner,
      resource: "gold",
      amount: goldAmount
    });
  }
  
  // Steal random item
  if (loserAgent.hand.length > 0) {
    const randomItem = loserAgent.hand[
      Math.floor(Math.random() * loserAgent.hand.length)
    ];
    
    engine.dispatch("agent:steal", {
      from: loser,
      to: winner,
      token: randomItem
    });
  }
}
```

---

[← Back to Action Reference](../ACTIONS.md)
