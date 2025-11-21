# Batch Actions

Collection operations and queries for working with multiple tokens. Filter, count, collect, and iterate over token collections.

[← Back to Action Reference](../ACTIONS.md)

---

## Actions (5)

1. [tokens:filter](#tokensfilter) - Select tokens matching criteria
2. [tokens:forEach](#tokensforeach) - Apply operation to each token
3. [tokens:collect](#tokenscollect) - Gather tokens from multiple sources
4. [tokens:count](#tokenscount) - Count tokens with optional filter
5. [tokens:find](#tokensfind) - Find first matching token

---

## `tokens:filter`

Select tokens matching a predicate function.

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

// Filter from space zone
const untapped = engine.dispatch("tokens:filter", {
  source: "battlefield",
  predicate: (token) => !token.meta.tapped
});
```

**Parameters:**
- `tokens` (Array<Token>): Tokens to filter (if not using source)
- `predicate` (function, required): `(token) => boolean`
- `source` (string): Source to filter from
  - Standard sources: `'stack'`, `'space'`, `'discard'`, `'source'`
  - Or any space zone name

**Returns:** Array of matching tokens

**Events:** `tokens:filtered`

**Use cases:**
- Finding specific cards
- Selecting units by property
- Legal move generation
- Hand/stack queries

**Example:**
```javascript
// Find all creatures with power >= 5
const strong = engine.dispatch("tokens:filter", {
  source: "battlefield",
  predicate: (t) => t.meta.type === "creature" && t.meta.power >= 5
});

// Find cards you can afford
const agent = engine.dispatch("agent:get", { name: "Alice" });
const affordable = engine.dispatch("tokens:filter", {
  tokens: agent.hand,
  predicate: (card) => card.meta.cost <= agent.resources.mana
});

// Find damaged units
const damaged = engine.dispatch("tokens:filter", {
  source: "battlefield",
  predicate: (unit) => unit.meta.hp < unit.meta.maxHp
});
```

---

## `tokens:forEach`

Apply an operation to each token in a collection.

```javascript
// Modify tokens
engine.dispatch("tokens:forEach", {
  tokens: agentHand,
  operation: (token) => {
    token.meta.buffed = true;
  }
});

// Collect return values
const powers = engine.dispatch("tokens:forEach", {
  source: "battlefield",
  operation: (token) => token.meta.power
});

// Use index parameter
engine.dispatch("tokens:forEach", {
  tokens: stack.cards,
  operation: (token, index) => {
    token.meta.stackPosition = index;
  }
});
```

**Parameters:**
- `tokens` (Array<Token>): Tokens to process
- `operation` (function, required): `(token, index) => any`
- `source` (string): Source to process from

**Returns:** Array of operation return values

**Events:** 
- `tokens:forEach:complete` (success)
- `tokens:forEach:error` (if operation throws)

**Use cases:**
- Batch modifications
- Calculating totals
- Applying effects
- Data extraction

**Example:**
```javascript
// Buff all creatures
engine.dispatch("tokens:forEach", {
  source: "battlefield",
  operation: (creature) => {
    if (creature.meta.type === "creature") {
      creature.meta.power += 1;
      creature.meta.toughness += 1;
    }
  }
});

// Calculate total damage
const totalDamage = engine.dispatch("tokens:forEach", {
  source: "battlefield",
  operation: (unit) => unit.meta.attack || 0
}).reduce((sum, atk) => sum + atk, 0);

// Tag with timestamp
engine.dispatch("tokens:forEach", {
  tokens: newCards,
  operation: (card, index) => {
    card.meta.drawnAt = Date.now();
    card.meta.drawOrder = index;
  }
});
```

---

## `tokens:collect`

Gather tokens from multiple sources into a single array.

```javascript
// From multiple sources
const allTokens = engine.dispatch("tokens:collect", {
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
  - Standard: `'stack'`, `'space'`, `'discard'`, `'source'`
  - Or any space zone name
- `includeAttachments` (boolean, default: false): Also collect attached tokens

**Returns:** Array of all collected tokens (no duplicates)

**Events:** `tokens:collected`

**Use cases:**
- Gathering all tokens
- Full inventory check
- State inspection
- Counting total resources

**Example:**
```javascript
// Get everything in play
const everything = engine.dispatch("tokens:collect", {
  sources: ["stack", "space", "discard", "exile"]
});

console.log(`Total tokens in game: ${everything.length}`);

// Get all agent cards
const agent = engine.dispatch("agent:get", { name: "Alice" });
const allCards = engine.dispatch("tokens:collect", {
  sources: ["hand", "battlefield", "graveyard"]
}).filter(token => token.meta.owner === "Alice");

// Collect with equipment
const characters = engine.dispatch("tokens:collect", {
  sources: ["party"],
  includeAttachments: true
});
// Returns characters AND their equipped items
```

---

## `tokens:count`

Count tokens with optional filtering.

```javascript
// Count all in source
const stackSize = engine.dispatch("tokens:count", {
  source: "stack"
});

// Count matching predicate
const redCount = engine.dispatch("tokens:count", {
  tokens: allCards,
  predicate: (token) => token.meta.color === "red"
});

// Count from source with filter
const expensiveCards = engine.dispatch("tokens:count", {
  source: "hand",
  predicate: (token) => token.meta.cost > 5
});
```

**Parameters:**
- `tokens` (Array<Token>): Tokens to count
- `predicate` (function, optional): Filter before counting
- `source` (string): Source to count from

**Returns:** Number (count)

**Events:** `tokens:counted`

**Use cases:**
- Hand size checks
- Resource counting
- Win condition checks
- UI displays

**Example:**
```javascript
// Check hand limit
const handSize = engine.dispatch("tokens:count", {
  source: "hand"
});

if (handSize > 7) {
  // Discard down to 7
}

// Count creatures
const creatureCount = engine.dispatch("tokens:count", {
  source: "battlefield",
  predicate: (t) => t.meta.type === "creature"
});

// Count resources by type
const goldCount = engine.dispatch("tokens:count", {
  source: "inventory",
  predicate: (t) => t.meta.resource === "gold"
});

console.log(`You have ${goldCount} gold`);
```

---

## `tokens:find`

Find the first token matching a predicate.

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

if (legendary) {
  console.log("Found:", legendary.label);
} else {
  console.log("No legendary cards in play");
}
```

**Parameters:**
- `tokens` (Array<Token>): Tokens to search
- `predicate` (function, required): `(token) => boolean`
- `source` (string): Source to search in

**Returns:** First matching token, or `null`

**Events:** `tokens:found`

**Use cases:**
- Searching for specific cards
- Existence checks
- Finding targets
- Lookups

**Example:**
```javascript
// Find strongest creature
const strongest = engine.dispatch("tokens:find", {
  source: "battlefield",
  predicate: (t) => {
    if (t.meta.type !== "creature") return false;
    
    const allCreatures = engine.space.zones.get("battlefield")
      .filter(p => p.token.meta.type === "creature");
    
    return allCreatures.every(other => 
      t.meta.power >= other.token.meta.power
    );
  }
});

// Find card by name
const aceOfSpades = engine.dispatch("tokens:find", {
  source: "stack",
  predicate: (card) => card.label === "Ace of Spades"
});

// Check if agent has specific card
const agent = engine.dispatch("agent:get", { name: "Alice" });
const hasFireball = engine.dispatch("tokens:find", {
  tokens: agent.hand,
  predicate: (card) => card.meta.name === "Fireball"
}) !== null;
```

---

## Common Patterns

### Complex Filtering
```javascript
// Find all valid targets for a spell
function findValidTargets(engine, spell) {
  return engine.dispatch("tokens:filter", {
    source: "battlefield",
    predicate: (target) => {
      // Must be a creature
      if (target.meta.type !== "creature") return false;
      
      // Must be enemy creature
      if (target.meta.controller === spell.meta.controller) return false;
      
      // Must not have hexproof
      if (target.meta.hexproof) return false;
      
      return true;
    }
  });
}
```

### Batch Operations
```javascript
// Heal all damaged allies
const damaged = engine.dispatch("tokens:filter", {
  source: "battlefield",
  predicate: (unit) => 
    unit.meta.type === "ally" && 
    unit.meta.hp < unit.meta.maxHp
});

engine.dispatch("tokens:forEach", {
  tokens: damaged,
  operation: (unit) => {
    engine.dispatch("token:transform", {
      token: unit,
      properties: {
        meta: { hp: Math.min(unit.meta.hp + 5, unit.meta.maxHp) }
      }
    });
  }
});
```

### Resource Management
```javascript
// Count total resources
function countAllResources(engine, agentName) {
  const agent = engine.dispatch("agent:get", { name: agentName });
  
  const inventory = engine.dispatch("tokens:collect", {
    sources: ["agent-inventory"]
  }).filter(t => t.meta.owner === agentName);
  
  const resources = {};
  
  engine.dispatch("tokens:forEach", {
    tokens: inventory,
    operation: (token) => {
      const type = token.meta.resourceType;
      const amount = token.meta.amount || 1;
      resources[type] = (resources[type] || 0) + amount;
    }
  });
  
  return resources;
}
```

### Win Condition Check
```javascript
// Check if agent has won (collect all 5 artifacts)
function checkVictory(engine, agentName) {
  const artifacts = engine.dispatch("tokens:filter", {
    source: "battlefield",
    predicate: (t) => 
      t.meta.type === "artifact" &&
      t.meta.controller === agentName
  });
  
  const uniqueArtifacts = new Set(artifacts.map(a => a.meta.artifactName));
  
  return uniqueArtifacts.size >= 5;
}
```

### Card Selection UI
```javascript
// Get cards grouped by cost
function groupHandByCost(engine, agentName) {
  const agent = engine.dispatch("agent:get", { name: agentName });
  const grouped = {};
  
  engine.dispatch("tokens:forEach", {
    tokens: agent.hand,
    operation: (card) => {
      const cost = card.meta.cost || 0;
      if (!grouped[cost]) grouped[cost] = [];
      grouped[cost].push(card);
    }
  });
  
  return grouped;
}
```

### Statistics Collection
```javascript
// Calculate stack statistics
function analyzeStack(engine) {
  const all = engine.dispatch("tokens:collect", {
    sources: ["stack"]
  });
  
  return {
    total: engine.dispatch("tokens:count", { tokens: all }),
    
    creatures: engine.dispatch("tokens:count", {
      tokens: all,
      predicate: t => t.meta.type === "creature"
    }),
    
    spells: engine.dispatch("tokens:count", {
      tokens: all,
      predicate: t => t.meta.type === "spell"
    }),
    
    averageCost: engine.dispatch("tokens:forEach", {
      tokens: all,
      operation: t => t.meta.cost || 0
    }).reduce((sum, cost) => sum + cost, 0) / all.length,
    
    rarest: engine.dispatch("tokens:find", {
      tokens: all,
      predicate: t => t.meta.rarity === "mythic"
    })
  };
}
```

---

## Performance Notes

- **filter/forEach/collect** process sequentially - fast for <1000 tokens
- **Predicates** are called once per token - keep them simple
- **Sources** are more efficient than filtering large arrays
- **find** stops at first match - faster than filter when you only need one

---

[← Back to Action Reference](../ACTIONS.md)