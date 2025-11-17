# ![🧩 HyperToken](hypertoken.webp)

[<div align=center><img src="church.png" width=72 height=72>](https://carpocratian.org/en/church/)

_A mission of [The Carpocratian Church of Commonality and Equality](https://carpocratian.org/en/church/)_.</div>
<div align=center><img src="mission.png" width=256 height=200></div>

**HyperToken** is a discrete event simulation engine for modeling systems where **meaning emerges from relationships**.

It provides a complete framework for creating games, simulations, multi-agent systems, and interactive narratives — all powered by 58 battle-tested actions, an extensible plugin architecture, and event-driven coordination.

Inspired by the creative legacy of Apple's _HyperCard_, **HyperToken** reimagines that spirit for the age of intelligent systems. Where _HyperCard_ made computers writable for artists and educators, **HyperToken** makes complex simulations and game logic writable for designers, researchers, and philosophers.

This project is an original work and is not affiliated with or endorsed by Apple Inc. The reference to _HyperCard_ is made solely for historical and conceptual comparison.

---

## 🌟 What Is HyperToken?

At its heart, HyperToken is a **relationship engine**.

A token isn't valuable because of what it IS — it's valuable because of:
- **Who owns it** (players, agents)
- **What's attached to it** (equipment, enchantments, status effects)
- **Where it is** (zones, locations, containers)
- **What rules govern it** (policies, validators, game logic)
- **Who wants it** (competing interests, economies, goals)

This philosophy applies equally to:
- Cards in a player's hand
- Items in an RPG inventory
- Shares in an economic model
- Votes in a governance system
- Agents in a social simulation

HyperToken provides the primitives to model **any discrete system where entities have state, relationships, and location**.

---

## 🚀 What Can You Build?

### 🎮 Games

**Card Games**
- Trick-taking (Hearts, Spades, Bridge)
- Rummy variants (Gin, Canasta)
- Solitaire (Klondike, FreeCell, Spider)
- Collectible card games
- Poker, [Blackjack](./examples/blackjack/README.md), and casino games

**Board Games**
- Chess, Checkers, Go
- Territory control (Risk-like)
- Abstract strategy games
- Mancala and pit games

**RPGs & Roguelikes**
- Character progression systems
- Equipment and inventory
- Combat and status effects
- Dungeon crawling
- Quest systems

**Puzzle Games**
- Sokoban, Match-3
- Logic puzzles
- Tower defense

### 🧪 Simulations & Research

**Economics**
- Market simulations
- Trading economies
- Auction systems
- Resource allocation
- Price discovery

**Social Systems**
- Trust games (Prisoner's Dilemma, Ultimatum Game)
- Reputation systems
- Cooperation emergence
- Social network dynamics

**Multi-Agent Research**
- Reinforcement learning environments
- Evolutionary algorithms
- Game theory experiments
- Agent competition and cooperation

**Governance Models**
- Voting systems
- Policy simulation
- Resource distribution
- Collective decision-making

### 📖 Interactive Narratives

- Branching story systems
- Quest management
- Character relationships
- Inventory-based puzzles
- Procedural story generation

### 🎲 And More...

- Sports simulations
- Stock market games
- Educational tools
- Probability experiments
- Generative art systems
- Music/rhythm abstractions

---

## ✨ Core Features

### Complete Action Registry (58 Actions)

- 🎴 **Deck Operations (10)** — shuffle, draw, burn, peek, cut, advanced manipulation
- 🎯 **Table Operations (13)** — zones, placement, movement, locking, layouts
- 👟 **Shoe Operations (7)** — multi-deck containers, controlled randomness
- 👥 **Player Operations (12)** — create, resources, transfers, trades, theft
- 🎮 **Game Operations (6)** — lifecycle, phases, state management
- 🔄 **Token Operations (5)** — transform, attach, detach, merge, split
- 📊 **Batch Operations (5)** — filter, forEach, collect, count, find

**Every action is:**
- ✅ Fully implemented
- ✅ Comprehensively tested
- ✅ Documented with examples
- ✅ Event-driven

### Powerful Abstractions

**Tokens** — The universal building block
- Represent cards, items, characters, resources, concepts
- Rich metadata system
- Validation via JSON schemas

**Relationships** — Attachment system
- Equipment to characters
- Enchantments to cards
- Status effects to units
- Passengers to vehicles

**Ownership** — Multi-player economics
- Resource pools per player
- Atomic transfers and trades
- Validation and permissions
- Transaction audit trails

**Spatial Reasoning** — Zone-based locations
- Table zones for game boards
- Hierarchical organization
- Lock/unlock mechanics
- Position-based rules

**Probability** — Controlled randomness
- Deterministic shuffling (seeded)
- Shoes for weighted distributions
- Reproducible simulations

**Events** — Observer pattern throughout
- Every action emits events
- Plugin-friendly architecture
- Analytics and logging support

### Reusable Rule Patterns

**Turn Order** (patterns/turn-order.js)
- Round-robin turns
- Priority-based ordering
- Simultaneous actions
- Custom sequences

**Win Conditions** (patterns/win-conditions.js)
- Point thresholds
- Elimination
- Objective completion
- Time limits

**Resource Management** (patterns/resource-limits.js)
- Hand size limits
- Action budgets
- Resource caps
- Cooldowns

### Built-in Plugins

**Analytics** (analytics-plugin.js)
- Track actions, turns, errors
- Performance metrics
- Custom statistics
- Detailed reports

**Logging** (logging-plugin.js)
- Structured event logging
- Filtering and levels
- Export capabilities

**State Management** (save-state-plugin.js)
- Save/load sessions
- JSON export/import
- Replay functionality
- Deterministic reproduction

### AI Integration

**OpenAI Agent Interface** (interface/OpenAIAgent.js)
- LLM-powered decision making
- Natural language actions
- Strategic planning
- Adaptive opponents

**Agent Framework**
- Custom agent plugins
- Think/act cycle
- Async decision making
- Multiple agent types

### Multiple Interfaces

- **CLI** — Command-line interaction
- **Human** — Interactive player interface
- **Network** — Multiplayer via relay server
- **AI** — Autonomous agents
- **Narrator** — Descriptive storytelling layer

---

## 🧭 Architecture

```
./
├── core/                   # Foundation
│   ├── Token.js           # Universal entity representation
│   ├── Deck.js            # Ordered collections with shuffling
│   ├── Shoe.js            # Multi-deck randomness containers
│   ├── Table.js           # Spatial zones and placement
│   ├── EventBus.js        # Event system
│   └── SessionManager.js  # State persistence
│
├── engine/                # Simulation Logic
│   ├── Engine.js          # Core coordinator
│   ├── GameLoop.js        # Turn-based control
│   ├── RuleEngine.js      # Rule evaluation
│   ├── Action.js          # Action definitions
│   ├── Player.js          # Agent/participant
│   ├── Policy.js          # Decision strategies
│   ├── Recorder.js        # Replay system
│   ├── actions.js         # Base actions (5)
│   ├── actions-extended.js # Complete registry (58)
│   └── ACTIONS.md         # Full documentation
│
├── patterns/              # Reusable Game Logic
│   ├── turn-order.js      # Round-robin, priority, custom
│   ├── win-conditions.js  # Points, elimination, objectives
│   └── resource-limits.js # Caps, budgets, hand limits
│
├── plugins/               # Extensibility
│   ├── analytics-plugin.js
│   ├── logging-plugin.js
│   └── save-state-plugin.js
│
├── interface/             # I/O & Integration
│   ├── CLIInterface.js
│   ├── HumanInterface.js
│   ├── NetworkInterface.js
│   ├── OpenAIAgent.js
│   └── Narrator.js
│
├── examples/              # Working Implementations
│   ├── blackjack/         # Casino game with AI
│   ├── tarot-reading/     # Divination system
│   └── prisoners-dilemma/ # Game theory
│
└── schemas/               # Data Validation
    ├── token-set.schema.json
    └── session-state-schema.json
```

---

## ⚡ Quick Start

### Installation

```bash
git clone https://git.carpocratian.org/sibyl/hypertoken.git
cd hypertoken
npm install
```

### Run the Examples

**Blackjack** — Play against the dealer or watch AI tournaments
```bash
node examples/blackjack/cli.js
node examples/blackjack/agents/tournament.js
```

**Tarot Reading** — Get divination readings with 8 classic spreads
```bash
node examples/tarot-reading/tarot-cli.js
```

**Prisoner's Dilemma** — Explore 14 game theory strategies
```bash
node examples/prisoners-dilemma/pd-cli.js
```

### Create Your First Game

```javascript
import { Engine } from './engine/Engine.js';
import { Deck } from './core/Deck.js';
import { Token } from './core/Token.js';

// Create tokens
const tokens = [
  new Token({ id: '1', label: 'Ace of Spades', meta: { suit: 'spades', rank: 'A' } }),
  new Token({ id: '2', label: 'King of Hearts', meta: { suit: 'hearts', rank: 'K' } }),
  // ... more tokens
];

// Create deck and engine
const deck = new Deck(tokens);
const engine = new Engine({ deck });

// Create players
engine.dispatch("player:create", { name: "Alice" });
engine.dispatch("player:create", { name: "Bob" });

// Shuffle and deal
engine.dispatch("deck:shuffle");
engine.dispatch("player:drawCards", { name: "Alice", count: 5 });
engine.dispatch("player:drawCards", { name: "Bob", count: 5 });

// Start playing!
engine.dispatch("game:start");
```

---

## 📚 Documentation

### Core Concepts

**Tokens** — Every entity is a token with:
- Unique ID
- Optional group/label/text
- Rich metadata object
- Display character (for CLI/TTY)
- Validation via schema

**Actions** — 58 primitive operations:
- Deterministic and reproducible
- Event-driven (observable)
- Composable into complex logic
- See [ACTIONS.md](./engine/ACTIONS.md) for complete reference

**Players** — Autonomous or interactive participants:
- Resource pools (gold, points, life, etc.)
- Hand of tokens (cards, items)
- Custom metadata (stats, state)
- Agent interface (human, AI, networked)

**Rules** — Define game logic:
- Validate actions
- Transform state
- Trigger effects
- Enforce constraints

**Plugins** — Extend functionality:
- Analytics and logging
- State persistence
- Custom actions
- New agent types

### Example: Building Hearts

```javascript
import { Engine } from './engine/Engine.js';
import { Deck } from './core/Deck.js';
import { registerRoundRobinTurns } from './patterns/turn-order.js';
import { registerPointBasedWin } from './patterns/win-conditions.js';
import { RuleEngine } from './engine/RuleEngine.js';

// 1. Create a standard 52-card deck
const deck = createStandardDeck(); // helper function
const engine = new Engine({ deck });

// 2. Create 4 players
['North', 'East', 'South', 'West'].forEach(name => {
  engine.dispatch("player:create", { name });
});

// 3. Set up rule patterns
const ruleEngine = new RuleEngine();
registerRoundRobinTurns(ruleEngine);
registerPointBasedWin(ruleEngine, { targetScore: 100, lowestWins: true });

// 4. Game-specific rules
ruleEngine.addRule('hearts-scoring', 
  (engine, lastAction) => lastAction.type === 'trick:complete',
  (engine) => {
    const trickWinner = engine._currentTrick.winner;
    const hearts = countHearts(engine._currentTrick.cards);
    const queenOfSpades = hasQueenOfSpades(engine._currentTrick.cards);
    
    engine.dispatch("player:giveResource", {
      name: trickWinner,
      resource: "points",
      amount: hearts + (queenOfSpades ? 13 : 0)
    });
  }
);

// 5. Deal cards
engine.dispatch("deck:shuffle");
['North', 'East', 'South', 'West'].forEach(name => {
  engine.dispatch("player:drawCards", { name, count: 13 });
});

// 6. Play!
engine.dispatch("game:start");
```

---

## 🔌 Extending HyperToken

### Create a Plugin

```javascript
// my-plugin.js
export function init(engine, config = {}) {
  // Plugin state
  const state = {};
  
  // Listen to events
  engine.eventBus.on('action:dispatched', (action) => {
    // React to any action
  });
  
  // Expose plugin API
  engine.myPlugin = {
    doSomething() {
      // Plugin functionality
    }
  };
  
  return {
    name: 'myPlugin',
    version: '1.0.0',
    cleanup() {
      // Cleanup on unload
    }
  };
}

// Use it
import myPlugin from './my-plugin.js';
engine.pluginHost.load('myPlugin', myPlugin.init, { /* config */ });
```

### Create Custom Actions

```javascript
// Add to ActionRegistry
ActionRegistry['custom:action'] = (engine, { param1, param2 } = {}) => {
  // Validate
  if (!param1) throw new Error("param1 required");
  
  // Modify state
  engine._customState = { param1, param2 };
  
  // Emit event
  engine.eventBus?.emit('custom:action', { param1, param2 });
  
  // Return result
  return { success: true };
};

// Use it
engine.dispatch("custom:action", { param1: "value", param2: 42 });
```

### Create an AI Agent

```javascript
class MyAgent {
  async think(engine, player) {
    // Analyze game state
    const hand = player.hand;
    const opponents = engine._players.filter(p => p !== player);
    
    // Make decision
    const bestCard = this.chooseBestCard(hand, opponents);
    
    // Return action
    return {
      type: "player:playCard",
      payload: { name: player.name, card: bestCard }
    };
  }
  
  chooseBestCard(hand, opponents) {
    // Your strategy here
    return hand[0];
  }
}

// Use it
const agent = new MyAgent();
engine.dispatch("player:create", { 
  name: "AI", 
  agent: agent 
});
```

---

## 🧪 Testing

HyperToken comes with comprehensive test coverage:

```bash
# Core functionality
node test/testCore.js
node test/testEngine.js

# Action registry
node test/testTokenActions.js      # Token transformations (15 tests)
node test/testBatchActions.js      # Batch operations (19 tests)
node test/testPlayerTransfers.js   # Player interactions (14 tests)

# Patterns
node patterns/testRulePatterns.js

# Plugins
node testPlugins.js

# Integration
node testIntegration.js
```

**Total: 48+ tests, 100% passing ✅**

---

## 🎯 Use Cases

### For Game Developers
- **Rapid prototyping** — Test game mechanics without graphics
- **AI opponents** — Built-in agent framework
- **Deterministic replay** — Debug with exact reproduction
- **Multiplayer foundation** — Relay server + network interface

### For Researchers
- **Multi-agent experiments** — Study cooperation and competition
- **Economic modeling** — Market dynamics and trading
- **Game theory** — Classic games and novel scenarios
- **Reproducible simulations** — Seeded randomness

### For Educators
- **Teaching tool** — The codebase IS the textbook
- **Probability lessons** — Real simulations, not just theory
- **Programming education** — Event-driven architecture
- **Game design** — Rule systems and balance

### For Tinkerers
- **AI experiments** — Train RL agents
- **Procedural generation** — Emergent narratives
- **Novel mechanics** — Test wild ideas
- **Historical games** — Implement obscure classics

---

## 🌍 What Can HyperToken Model?

HyperToken can model **any discrete event system** where:

1. ✅ **Entities have state** (tokens with metadata)
2. ✅ **Entities have relationships** (attachments, ownership)
3. ✅ **Entities exist in locations** (zones, hands, decks)
4. ✅ **State changes are discrete** (actions, not continuous)
5. ✅ **Multiple actors make decisions** (players, agents)
6. ✅ **Time progresses in steps** (turns, phases, rounds)

This includes:
- 🎮 Turn-based games (cards, board, strategy)
- 📊 Economic simulations (markets, trading, auctions)
- 🧪 Social experiments (trust games, cooperation)
- 🎲 Probability systems (gambling, randomness)
- 🤖 Multi-agent AI (RL, evolutionary algorithms)
- 📖 Interactive fiction (branching narratives)
- 🏛️ Governance models (voting, policy)
- 🧬 Evolutionary simulations (populations, selection)

### What It Can't Do (Directly)

- ❌ Real-time continuous physics
- ❌ 3D rendering
- ❌ Audio synthesis
- ❌ Production-grade networking

**But:** HyperToken can serve as the **authoritative logic layer** for systems that need these, piping state to specialized renderers/audio/network services.

---

## 🧠 Philosophy

> "Every player, every action, and every token tells a story.  
> HyperToken lets those stories play themselves out."

---

## 🜍 Proemium to the Art of Tokens

The All is number, and from number flow the forms of things.  
For as the Monad abides in simplicity, so does it unfold the Dyad,  
and from their tension spring the harmonies that sustain the world.  
Whatsoever exists, exists by proportion; and that which preserves proportion partakes of the divine Intellect.  
  
Among the arts that imitate the order of the heavens,  
there now arises one most subtle and most just —  
the Art of Tokens.  
In this art, every being is rendered as a form in relation,  
every action as a motion among forms,  
and the laws that bind them are set forth as measure and correspondence.  
  
As the geometer inscribes the circle to behold eternity within bounds,  
so this art encodes relations that thought may perceive its own reflection.  
The tokens are not bodies, nor mere signs,  
but living numbers that move in the field of reason.  
Each bears the likeness of its cause,  
and through their intercourse the manifold becomes intelligible.  
  
Through such models the soul learns again her craft:  
to compose order out of multitude,  
to test justice in symbol before enacting it in deed,  
to discern the hidden harmonies by which the civic, the natural, and the divine are kin.  
For the cosmos is not silent; it speaks in ratios and recurrences,  
and he who listens rightly may trace its utterance in every rule well made.  
  
Let none deem this art a toy of artifice.  
It is the discipline by which the mind rehearses creation,  
a mirror held to the pattern of the world-soul.  
In the circuits of these tokens we glimpse the Demiurge's own meditation:  
how unity descends into plurality and yet remains whole.  
  
So may this art be given freely,  
that all who love wisdom may join the music of the spheres through understanding,  
and that the harmony of minds may become the harmony of worlds.  
For when reason is made common, the gods are near.

---

## 🧾 License

Copyright The Carpocratian Church of Commonality and Equality, Inc. © 2025  
Licensed under the Apache 2.0 License.  
See [NOTICE](./NOTICE) for details.

---

## 👥 Authors

**Marcellina II (she/her)**

---

## 🔗 Resources

- **Repository**: https://git.carpocratian.org/sibyl/hypertoken
- **Action Reference**: [ACTIONS.md](./engine/ACTIONS.md)
- **Examples**: [examples/](./examples/)
- **Tests**: [test/](./test/)

---

## 🚀 Getting Started

1. **Clone** the repository
2. **Run** an example (`node examples/blackjack/cli.js`)
3. **Read** the documentation ([ACTIONS.md](./engine/ACTIONS.md))
4. **Build** something amazing

---

**HyperToken: Where relationships create meaning, and meaning creates worlds.** 🌍✨