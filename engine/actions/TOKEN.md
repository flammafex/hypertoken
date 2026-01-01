# Token Actions

Token transformation and relationship management. Modify properties, create attachments, combine/split tokens.

[← Back to Action Reference](../ACTIONS.md)

---

## Actions (5)

1. [token:transform](#tokentransform) - Modify token properties
2. [token:attach](#tokenattach) - Attach one token to another
3. [token:detach](#tokendetach) - Remove attachment
4. [token:merge](#tokenmerge) - Combine tokens
5. [token:split](#tokensplit) - Divide token into multiple

---

## `token:transform`

Modify token properties in-place.

```javascript
// Simple property change
engine.dispatch("token:transform", {
  token: myToken,
  properties: { label: "Powered Up Sword" }
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
  - `meta` is **merged**, not replaced

**Returns:** Transformed token

**Events:** `token:transformed`

**Use cases:**
- State changes (hp, status)
- Buffs/debuffs
- Upgrades/downgrades
- Evolution

**Example:**
```javascript
// Apply poison status
engine.dispatch("token:transform", {
  token: character,
  properties: {
    meta: { 
      status: "poisoned",
      poisonDamage: 5,
      turnsRemaining: 3
    }
  }
});

// Level up
engine.dispatch("token:transform", {
  token: character,
  properties: {
    label: "Hero (Level 5)",
    meta: {
      level: 5,
      strength: 18,
      maxHp: 100
    }
  }
});
```

---

## `token:attach`

Attach one token to another (equipment, status effects, etc).

```javascript
engine.dispatch("token:attach", {
  host: characterToken,
  attachment: swordToken,
  attachmentType: "weapon"
});
```

**Parameters:**
- `host` (Token, required): Token to attach to
- `attachment` (Token, required): Token being attached
- `attachmentType` (string, default: "default"): Type of attachment

**Returns:** Host token

**Events:** `token:attached`

**Data structure created:**
```javascript
host._attachments = [
  {
    token: swordToken,
    type: "weapon",
    id: "sword-1",
    attachedAt: 1234567890
  }
];

attachment._attachedTo = "host-id";
```

**Use cases:**
- Equipment systems
- Enchantments
- Status effects
- Vehicle passengers
- Card enhancements

**Example:**
```javascript
// Equip weapon
engine.dispatch("token:attach", {
  host: knight,
  attachment: excalibur,
  attachmentType: "weapon"
});

// Equip armor
engine.dispatch("token:attach", {
  host: knight,
  attachment: plateArmor,
  attachmentType: "armor"
});

// Apply buff
engine.dispatch("token:attach", {
  host: knight,
  attachment: blessingToken,
  attachmentType: "buff"
});

// Check attachments
console.log(knight._attachments);
// [
//   { token: excalibur, type: "weapon", ... },
//   { token: plateArmor, type: "armor", ... },
//   { token: blessingToken, type: "buff", ... }
// ]
```

---

## `token:detach`

Remove an attachment from a host token.

```javascript
// By attachment ID
engine.dispatch("token:detach", {
  host: character,
  attachmentId: "sword-1"
});

// By attachment reference
engine.dispatch("token:detach", {
  host: character,
  attachment: swordToken
});
```

**Parameters:**
- `host` (Token, required): Host token
- `attachmentId` (string): Attachment ID to remove
- `attachment` (Token): Attachment reference to remove
  - **Must provide either `attachmentId` or `attachment`**

**Returns:** Detached token (or null if not found)

**Events:** `token:detached`

**Use cases:**
- Unequipping items
- Removing status effects
- Disenchanting
- Effect expiration

**Example:**
```javascript
// Unequip weapon
const sword = engine.dispatch("token:detach", {
  host: knight,
  attachment: excalibur
});

// Remove buff by ID
engine.dispatch("token:detach", {
  host: knight,
  attachmentId: "blessing-123"
});

// Remove all attachments of a type
knight._attachments
  .filter(a => a.type === "debuff")
  .forEach(a => {
    engine.dispatch("token:detach", {
      host: knight,
      attachmentId: a.id
    });
  });
```

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

// Keep originals
const combined = engine.dispatch("token:merge", {
  tokens: [card1, card2],
  resultProperties: { label: "Combo Card" },
  keepOriginals: true
});
```

**Parameters:**
- `tokens` (Array<Token>, required): Tokens to merge (minimum 2)
- `resultProperties` (object, optional): Properties for merged token
- `keepOriginals` (boolean, default: false): Don't mark originals as merged

**Returns:** New merged token

**Events:** `token:merged`

**Tracking data:**
```javascript
merged._mergedFrom = ["token-1-id", "token-2-id"];
merged._mergedAt = 1234567890;

// If keepOriginals=false:
original._merged = true;
original._mergedInto = "merged-id";
```

**Use cases:**
- Crafting systems
- Stacking resources
- Card fusion
- Item combination
- Alchemy

**Example:**
```javascript
// Craft sword from materials
const sword = engine.dispatch("token:merge", {
  tokens: [iron, wood, leather],
  resultProperties: {
    label: "Iron Sword",
    meta: {
      type: "weapon",
      damage: 10,
      durability: 100
    }
  }
});

// Stack coins
const coinStack = engine.dispatch("token:merge", {
  tokens: [coin1, coin2, coin3, coin4, coin5],
  resultProperties: {
    label: "5 Gold Coins",
    meta: { value: 5 }
  }
});
```

---

## `token:split`

Divide one token into multiple tokens.

```javascript
// Simple split into N tokens
const [half1, half2] = engine.dispatch("token:split", {
  token: goldPile,
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
```

**Parameters:**
- `token` (Token, required): Token to split
- `count` (number, required): Number of tokens to create (minimum 2)
- `properties` (Array<object>, optional): Custom properties for each split
  - Length must equal `count`
  - Metadata is **merged** with original, not replaced

**Returns:** Array of new split tokens

**Events:** `token:split`

**Tracking data:**
```javascript
splitToken._splitFrom = "original-id";
splitToken._splitIndex = 0;  // 0, 1, 2, etc
splitToken._splitAt = 1234567890;

original._split = true;
original._splitInto = ["split-0-id", "split-1-id"];
```

**Use cases:**
- Breaking resource stacks
- Dividing loot
- Splitting currency
- Fragmenting items

**Example:**
```javascript
// Split gold pile
const coins = engine.dispatch("token:split", {
  token: goldPile,
  count: 10,
  properties: Array(10).fill(null).map((_, i) => ({
    label: `Gold Coin ${i+1}`,
    meta: { value: 1 }
  }))
});

// Distribute among agents
coins.forEach((coin, i) => {
  const agentName = agents[i % agents.length];
  // Give coin to agent...
});

// Split damaged item
const [broken1, broken2] = engine.dispatch("token:split", {
  token: sword,
  count: 2,
  properties: [
    { label: "Broken Blade" },
    { label: "Sword Hilt" }
  ]
});
```

---

## Common Patterns

### Equipment System
```javascript
// Equip full set
const knight = createCharacter("Knight");

["weapon", "armor", "helmet", "boots"].forEach(type => {
  const item = findItemOfType(type);
  engine.dispatch("token:attach", {
    host: knight,
    attachment: item,
    attachmentType: type
  });
});

// Calculate total stats
function getTotalStats(character) {
  let stats = { ...character.meta };
  
  character._attachments?.forEach(attachment => {
    Object.keys(attachment.token.meta).forEach(key => {
      if (typeof stats[key] === 'number') {
        stats[key] += attachment.token.meta[key] || 0;
      }
    });
  });
  
  return stats;
}
```

### Status Effect Duration
```javascript
// Apply timed debuff
const poisonEffect = new Token({
  id: crypto.randomUUID(),
  label: "Poison",
  meta: { damagePerTurn: 5, turnsRemaining: 3 }
});

engine.dispatch("token:attach", {
  host: character,
  attachment: poisonEffect,
  attachmentType: "debuff"
});

// Each turn, tick down effects
function processStatusEffects(character) {
  character._attachments?.forEach(att => {
    if (att.type === "debuff" && att.token.meta.turnsRemaining) {
      att.token.meta.turnsRemaining--;
      
      if (att.token.meta.turnsRemaining <= 0) {
        engine.dispatch("token:detach", {
          host: character,
          attachmentId: att.id
        });
      }
    }
  });
}
```

### Crafting System
```javascript
// Recipe: 2 iron + 1 wood = sword
function craftSword(materials) {
  const iron = materials.filter(m => m.meta.type === "iron").slice(0, 2);
  const wood = materials.filter(m => m.meta.type === "wood").slice(0, 1);
  
  if (iron.length < 2 || wood.length < 1) {
    throw new Error("Insufficient materials");
  }
  
  return engine.dispatch("token:merge", {
    tokens: [...iron, ...wood],
    resultProperties: {
      label: "Iron Sword",
      meta: {
        type: "weapon",
        damage: 10,
        durability: iron[0].meta.quality + iron[1].meta.quality
      }
    }
  });
}
```

### Currency System
```javascript
// Break large bill into smaller
function makeChange(largeNote, denomination) {
  const value = largeNote.meta.value;
  const count = value / denomination;
  
  return engine.dispatch("token:split", {
    token: largeNote,
    count: count,
    properties: Array(count).fill(null).map(() => ({
      label: `$${denomination}`,
      meta: { value: denomination }
    }))
  });
}

// Usage
const hundred = new Token({ 
  label: "$100", 
  meta: { value: 100 } 
});

const tens = makeChange(hundred, 10);
// Returns 10 tokens worth $10 each
```

---

[← Back to Action Reference](../ACTIONS.md)