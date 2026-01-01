# Extending HyperToken

This guide shows how to customize HyperToken with custom actions, rules, policies, and agents.

## Overview

| Extension Point | Purpose | When to Use |
|-----------------|---------|-------------|
| [Custom Actions](#custom-actions) | Add new game operations | New mechanics not in built-in actions |
| [Rules](#rules) | Trigger logic on conditions | "When X happens, do Y" |
| [Policies](#policies) | Validate/react after actions | Enforce constraints, auto-triggers |
| [Agents](#agents) | Player/AI representation | Track player state, resources |

---

## Custom Actions

Actions are the operations your game can perform. Register new ones in the ActionRegistry.

### Basic Custom Action

```javascript
import { ActionRegistry } from './engine/actions.js';

// Register a custom action
ActionRegistry['game:rollDice'] = (engine, { count = 1, sides = 6 }) => {
  const rolls = [];
  for (let i = 0; i < count; i++) {
    rolls.push(Math.floor(Math.random() * sides) + 1);
  }
  engine.emit('dice:rolled', { rolls });
  return rolls;
};

// Use it
const rolls = await engine.dispatch('game:rollDice', { count: 2, sides: 6 });
console.log(rolls); // [4, 2]
```

### Action with State Mutation

```javascript
ActionRegistry['player:addGold'] = (engine, { playerId, amount }) => {
  // Mutate through Chronicle for CRDT sync
  engine.session.change(`add ${amount} gold to ${playerId}`, (doc) => {
    if (!doc.players) doc.players = {};
    if (!doc.players[playerId]) doc.players[playerId] = { gold: 0 };
    doc.players[playerId].gold += amount;
  });

  engine.emit('player:goldChanged', { playerId, amount });
  return engine.session.state.players[playerId].gold;
};
```

### Action with Validation

```javascript
ActionRegistry['card:play'] = (engine, { playerId, cardId, targetZone }) => {
  const player = engine.session.state.players?.[playerId];
  if (!player) {
    throw new Error(`Player ${playerId} not found`);
  }

  const cardIndex = player.hand.findIndex(c => c.id === cardId);
  if (cardIndex === -1) {
    throw new Error(`Card ${cardId} not in player's hand`);
  }

  const card = player.hand[cardIndex];

  engine.session.change(`play card ${cardId}`, (doc) => {
    // Remove from hand
    doc.players[playerId].hand.splice(cardIndex, 1);
  });

  // Place on board
  engine.space.place(targetZone, card, { faceUp: true });

  return { played: card, zone: targetZone };
};
```

### Action Naming Convention

```
namespace:operation

Examples:
  stack:shuffle     # Stack operations
  space:place       # Space operations
  player:addGold    # Player operations
  game:rollDice     # Game-level operations
  card:play         # Card-specific operations
```

---

## Rules

Rules automatically trigger when conditions are met. Use RuleEngine for complex game logic.

### Basic Rule

```javascript
import { RuleEngine } from './engine/RuleEngine.js';

const rules = new RuleEngine(engine);

// Rule: Draw a card when hand is empty
rules.addRule(
  'auto-draw-on-empty-hand',
  (engine, lastAction) => {
    const hand = engine.session.state.currentPlayer?.hand || [];
    return hand.length === 0 && engine.stack.size > 0;
  },
  async () => {
    await engine.dispatch('stack:draw');
  }
);
```

### Rule with Priority

Higher priority rules run first:

```javascript
// High priority rule (runs first)
rules.addRule(
  'check-win-condition',
  (engine) => engine.session.state.players?.some(p => p.points >= 21),
  () => engine.dispatch('game:end'),
  { priority: 100 }
);

// Normal priority
rules.addRule(
  'auto-cleanup',
  (engine) => engine.session.state.discardPile?.length > 10,
  () => engine.dispatch('discard:shuffle'),
  { priority: 0 }
);
```

### One-Time Rules

Rules that only fire once:

```javascript
rules.addRule(
  'first-blood',
  (engine) => engine.session.state.firstDamageDealt,
  () => {
    console.log('First blood!');
    engine.dispatch('achievement:unlock', { id: 'first-blood' });
  },
  { once: true }
);
```

### Rule Based on Last Action

```javascript
rules.addRule(
  'counter-spell',
  (engine, lastAction) => {
    return lastAction?.type === 'spell:cast' &&
           engine.session.state.currentPlayer?.mana >= 2;
  },
  async (engine, lastAction) => {
    await engine.dispatch('spell:counter', { targetSpell: lastAction.payload.spellId });
  }
);
```

### Attaching Rules to Engine

```javascript
const engine = new Engine({ stack, space });
const rules = new RuleEngine(engine);

// Rules auto-evaluate after each action
// Because RuleEngine listens to 'engine:action' events
```

---

## Policies

Policies evaluate after every action. Use them for validation, constraints, and auto-triggers.

### Basic Policy

```javascript
// Policy: Auto-reshuffle when deck is empty
engine.registerPolicy('auto-reshuffle', {
  evaluate(engine) {
    if (engine.stack && engine.stack.size === 0) {
      engine.stack.reset();
      engine.stack.shuffle();
      engine.emit('deck:reshuffled');
    }
  }
});
```

### Validation Policy

```javascript
engine.registerPolicy('max-hand-size', {
  evaluate(engine) {
    const MAX_HAND = 7;
    const hand = engine.session.state.currentPlayer?.hand || [];

    if (hand.length > MAX_HAND) {
      engine.emit('hand:overflow', {
        count: hand.length,
        max: MAX_HAND
      });
      // Could auto-discard or require player action
    }
  }
});
```

### Chained Policy

```javascript
engine.registerPolicy('turn-end-checks', {
  evaluate(engine) {
    // Check win condition
    const winner = checkWinner(engine);
    if (winner !== null) {
      engine.dispatch('game:end', { winner });
      return;
    }

    // Check draw condition
    if (isDraw(engine)) {
      engine.dispatch('game:draw');
      return;
    }

    // Advance turn
    if (engine.session.state.actionsTakenThisTurn > 0) {
      engine.dispatch('turn:advance');
    }
  }
});
```

### Managing Policies

```javascript
// Register
engine.registerPolicy('my-policy', { evaluate: fn });

// Unregister
engine.unregisterPolicy('my-policy');

// Clear all
engine.clearPolicies();
```

---

## Agents

Agents represent players or AI entities with their own state.

### Agent via Actions

```javascript
// Create agent
await engine.dispatch('agent:create', {
  id: 'player-1',
  name: 'Alice',
  meta: { avatar: 'warrior' }
});

// Give resources
await engine.dispatch('agent:giveResource', {
  name: 'Alice',
  resource: 'gold',
  amount: 100
});

// Give tokens (cards, items)
await engine.dispatch('agent:addToken', {
  name: 'Alice',
  token: { id: 'sword-1', label: 'Iron Sword' }
});

// Transfer between agents
await engine.dispatch('agent:transferResource', {
  from: 'Alice',
  to: 'Bob',
  resource: 'gold',
  amount: 50
});
```

### Custom Agent Class

```javascript
class GameAgent {
  constructor(id, name) {
    this.id = id;
    this.name = name;
    this.hand = [];
    this.resources = { gold: 0, mana: 0 };
    this.active = true;
  }

  canAfford(cost) {
    return Object.entries(cost).every(
      ([resource, amount]) => (this.resources[resource] || 0) >= amount
    );
  }

  spend(cost) {
    if (!this.canAfford(cost)) return false;
    for (const [resource, amount] of Object.entries(cost)) {
      this.resources[resource] -= amount;
    }
    return true;
  }

  addToHand(card) {
    this.hand.push(card);
  }

  removeFromHand(cardId) {
    const idx = this.hand.findIndex(c => c.id === cardId);
    if (idx >= 0) {
      return this.hand.splice(idx, 1)[0];
    }
    return null;
  }
}
```

### AI Agent with Strategy

```javascript
class AIAgent extends GameAgent {
  constructor(id, name, strategy = 'random') {
    super(id, name);
    this.strategy = strategy;
  }

  selectAction(validActions, gameState) {
    switch (this.strategy) {
      case 'random':
        return validActions[Math.floor(Math.random() * validActions.length)];

      case 'aggressive':
        // Prefer attack actions
        const attacks = validActions.filter(a => a.startsWith('attack:'));
        return attacks.length > 0 ? attacks[0] : validActions[0];

      case 'defensive':
        // Prefer defensive actions
        const defends = validActions.filter(a =>
          a.startsWith('block:') || a.startsWith('heal:')
        );
        return defends.length > 0 ? defends[0] : validActions[0];

      default:
        return validActions[0];
    }
  }
}
```

---

## Combining Extensions

### Complete Example: Card Game

```javascript
import { Engine } from './engine/Engine.js';
import { Stack } from './core/Stack.js';
import { Space } from './core/Space.js';
import { Chronicle } from './core/Chronicle.js';
import { ActionRegistry } from './engine/actions.js';
import { RuleEngine } from './engine/RuleEngine.js';

// 1. Custom Actions
ActionRegistry['game:dealHands'] = (engine, { cardsPerPlayer }) => {
  const players = engine.session.state.players || [];
  for (const player of players) {
    const cards = engine.stack.draw(cardsPerPlayer);
    engine.session.change(`deal to ${player.name}`, (doc) => {
      const p = doc.players.find(p => p.id === player.id);
      p.hand = Array.isArray(cards) ? cards : [cards];
    });
  }
};

// 2. Setup
const session = new Chronicle();
const deck = new Stack(session, createDeck());
const board = new Space(session, 'board');

const engine = new Engine({ stack: deck, space: board });

// Initialize players in CRDT
session.change('init players', (doc) => {
  doc.players = [
    { id: 'p1', name: 'Alice', hand: [], score: 0 },
    { id: 'p2', name: 'Bob', hand: [], score: 0 }
  ];
});

// 3. Rules
const rules = new RuleEngine(engine);

rules.addRule(
  'win-at-21',
  (engine) => engine.session.state.players?.some(p => p.score >= 21),
  () => {
    const winner = engine.session.state.players.find(p => p.score >= 21);
    engine.dispatch('game:end', { winner: winner.name });
  },
  { priority: 100 }
);

// 4. Policies
engine.registerPolicy('auto-draw', {
  evaluate(engine) {
    const current = getCurrentPlayer(engine);
    if (current?.hand.length === 0 && engine.stack.size > 0) {
      engine.dispatch('player:draw', { playerId: current.id });
    }
  }
});

// 5. Start game
await engine.dispatch('stack:shuffle');
await engine.dispatch('game:dealHands', { cardsPerPlayer: 5 });
```

---

## Best Practices

### Action Design
- Keep actions atomic (one operation each)
- Return meaningful results
- Emit events for side effects
- Validate inputs early

### Rule Design
- Use descriptive names
- Set appropriate priorities
- Consider `once: true` for one-time events
- Keep conditions fast

### Policy Design
- Keep evaluation fast (runs after every action)
- Don't dispatch actions that trigger infinite loops
- Use for constraints and auto-triggers

### CRDT Considerations
- All persistent state goes through `session.change()`
- Local-only state can be regular properties
- Use deterministic operations for sync

---

## Next Steps

- [Architecture Guide](./ARCHITECTURE.md) - How components connect
- [Testing Guide](./TESTING.md) - Test your extensions
- [Actions Reference](../engine/ACTIONS.md) - Built-in actions
