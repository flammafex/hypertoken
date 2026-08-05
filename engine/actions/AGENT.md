# Agent Actions

Agent management and agent-to-agent interactions. Includes creation, resource management, and economic transfers.

[← Back to Action Reference](../ACTIONS.md)

---

## Actions (13)

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

**Transfers (5)**
9. [agent:transferResource](#agenttransferresource) - Transfer a resource amount
10. [agent:transferToken](#agenttransfertoken) - Transfer a specific token
11. [agent:trade](#agenttrade) - Bidirectional exchange (atomic)
12. [agent:stealResource](#agentstealresource) - Forcibly take a resource amount
13. [agent:stealToken](#agentstealtoken) - Forcibly take a specific token

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

Agent discards specific cards (by token id) to the stack's discards.

```javascript
engine.dispatch("agent:discardCards", {
  name: "Alice",
  tokenIds: ["card-1", "card-2"]
});
```

**Parameters:**
- `name` (string, required): Agent name
- `tokenIds` (string[], required): Token ids to discard. Missing ids are silently skipped and duplicates are deduped. Discarded tokens are appended to `stack.discards` in `tokenIds` order.

**Returns:** `Token[]` — the discarded tokens (in `tokenIds` order, deduped).

**Events:** `agent:discarded`

**Use cases:**
- Discarding
- Playing cards
- Hand limit enforcement

**Example:**
```javascript
const agent = engine.dispatch("agent:get", { name: "Alice" });

// Discard specific cards by id
engine.dispatch("agent:discardCards", {
  name: "Alice",
  tokenIds: agent.hand.slice(0, 2).map((t) => t.id)
});
```

---

## Agent-to-Agent Transfers

### `agent:transferResource`

Transfer a resource amount from one agent to another (one-way).

```javascript
engine.dispatch("agent:transferResource", {
  from: "Alice",
  to: "Bob",
  resource: "gold",
  amount: 50
});
```

**Parameters:**
- `from` (string, required): Source agent name
- `to` (string, required): Target agent name
- `resource` (string, required): Resource type
- `amount` (number, default: 1): Amount to transfer

**Returns:** void

**Validation:**
- Both agents must exist
- Source must have at least `amount` of `resource` — otherwise throws `Agent '<from>' has <n> <resource> but <amount> requested`
- Records a `resource_transfer` entry in `doc.transactions` (exposed via `engine._transactions`)

**Use cases:**
- Gifting
- Tribute/taxes
- Payment for services
- Lending

---

### `agent:transferToken`

Transfer a specific token from one agent's inventory to another (one-way).

```javascript
engine.dispatch("agent:transferToken", {
  from: "Alice",
  to: "Bob",
  tokenId: "sword-123"
});
```

**Parameters:**
- `from` (string, required): Source agent name
- `to` (string, required): Target agent name
- `tokenId` (string, required): ID of the token to transfer

**Returns:** void

**Validation:**
- Both agents must exist
- The token must be in the source agent's inventory — otherwise throws `Token "<id>" not found in agent "<from>"`
- Records a `token_transfer` entry in `doc.transactions`

**Use cases:**
- Gifting items
- Trading equipment
- Passing tokens between players

---

### `agent:trade`

Bidirectional exchange between two agents (atomic).

```javascript
// Resource for resource
engine.dispatch("agent:trade", {
  agent1: "Alice",
  agent2: "Bob",
  offer1: { resource: "gold", amount: 100 },
  offer2: { resource: "wood", amount: 200 }
});

// Token for resource
engine.dispatch("agent:trade", {
  agent1: "Alice",
  agent2: "Bob",
  offer1: { token: magicRing },
  offer2: { resource: "gold", amount: 500 }
});

// Token for token
engine.dispatch("agent:trade", {
  agent1: "Alice",
  agent2: "Bob",
  offer1: { token: sword },
  offer2: { token: shield }
});
```

**Parameters:**
- `agent1` (string, required): First agent name
- `agent2` (string, required): Second agent name
- `offer1` (object, required): What agent1 gives
  - `token` (Token): a token to give (optional)
  - `resource` (string) + `amount` (number): a resource amount to give (optional)
  - A single offer may carry both a token and a resource.
- `offer2` (object, required): What agent2 gives (same structure as offer1)

**Returns:** void

**Events:** `agent:trade`

**Validation:**
- Both agents must exist
- Both agents must have what they're offering (token present in inventory; resource balance sufficient)
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

### `agent:stealResource`

Forcibly take a resource amount from another agent.

```javascript
engine.dispatch("agent:stealResource", {
  from: "Victim",
  to: "Thief",
  resource: "gold",
  amount: 50
});
```

**Parameters:**
- `from` (string, required): Victim agent name
- `to` (string, required): Thief agent name
- `resource` (string, required): Resource type to steal
- `amount` (number, default: 1): Amount to steal

**Returns:** void

**Behavior:**
- Steals as much as possible: `stolen = min(amount, available)` — no error on shortfall
- Records a `steal_resource` entry in `doc.transactions` with the actual stolen amount
- No `validate` callback parameter (unlike earlier drafts of this action)

**Use cases:**
- Theft mechanics
- Raiding/piracy
- Combat looting
- Bandit mechanics

---

### `agent:stealToken`

Forcibly take a specific token from another agent's inventory.

```javascript
engine.dispatch("agent:stealToken", {
  from: "Victim",
  to: "Thief",
  tokenId: "sword-123"
});
```

**Parameters:**
- `from` (string, required): Victim agent name
- `to` (string, required): Thief agent name
- `tokenId` (string, required): ID of the token to steal

**Returns:** void

**Behavior:**
- The token must be in the victim's inventory — otherwise throws `Token "<id>" not found in agent "<from>"`
- Records a `steal_token` entry in `doc.transactions`

**Use cases:**
- Pickpocketing
- Disarming
- Stealing equipment

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
    engine.dispatch("agent:transferResource", {
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
    engine.dispatch("agent:stealResource", {
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
    
    engine.dispatch("agent:stealToken", {
      from: loser,
      to: winner,
      tokenId: randomItem.id
    });
  }
}
```

---

[← Back to Action Reference](../ACTIONS.md)
