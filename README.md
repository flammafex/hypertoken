# ![🧩 HyperToken](hypertoken.webp)

[<div align=center><img src="church.png" width=72 height=72>](https://carpocratian.org/en/church/)

_A mission of [The Carpocratian Church of Commonality and Equality](https://carpocratian.org/en/church/)_.</div>
<div align=center><img src="mission.png" width=256 height=200></div>

**HyperToken** is a modular, token-driven simulation and game engine designed for **AI-human interaction**, **multi-agent systems**, and **rule-based games**.
It provides a flexible framework for creating simulations, turn-based or card-style games, narrative systems, or intelligent agents — all powered by an extensible plugin and event architecture.

Inspired by the creative legacy of Apple's _HyperCard_, **HyperToken** reimagines that spirit for the age of intelligent systems. Where _HyperCard_ made computers writable for artists and educators, **HyperToken** makes AI environments and logic systems writable for designers and philosophers.

This project is an original work and is not affiliated with or endorsed by Apple Inc. The reference to _HyperCard_ is made solely for historical and conceptual comparison.

---

## 🚀 Overview

At its core, HyperToken represents everything as **tokens** — structured data objects governed by **rules**, **policies**, and **actions**.  
These tokens live inside a fully modular simulation loop that can be driven by **humans**, **AI agents**, or **networked participants**.

The engine combines:
- A **data-driven core** (tokens, decks, sessions, events)
- A **rule-based logic engine** with 45+ built-in actions
- A **plugin host** for custom behaviors (analytics, logging, state management)
- Built-in **AI integration** (e.g., via OpenAI models)
- Multiple **interfaces** (CLI, human, network, AI)
- **Reusable rule patterns** (turn order, win conditions, resource management)

HyperToken can serve as the backbone for:
- Games (card, board, RPG, or abstract)
- Interactive and/or visual storytelling
- Multi-agent research and game theory experiments
- Reinforcement-learning environments
- Simulation-driven narratives

---

## ✨ Features

- 🧱 **Token-based world model** — every entity or resource is a token.
- ⚙️ **Rule Engine** — 45+ built-in actions covering deck, table, shoe, player, and game operations.
- 🎨 **Rule Patterns** — reusable patterns for turn order, win conditions, and resource limits.
- 🔌 **Plugin architecture** — analytics, logging, save/load state, and custom extensions.
- 🔁 **Game loop + recorder** — deterministic simulation and replay support.
- 🧠 **AI Integration** — out-of-the-box OpenAI agent interface.
- 🧍 **Human & network interfaces** — CLI, relay server, and multiplayer.
- 🧾 **Schema-driven data** — validated session and token schemas.
- 🗃️ **Session management** — persistent game or simulation states.
- 📊 **Built-in Analytics** — track actions, turns, performance, and game statistics.

---

## 🧭 Architecture

```
./
│
├── exporters.js            # Data exporters (e.g. logs, replays, analytics)
├── pluginLoader.js         # Dynamic plugin registration and loading
│
├── core/                   # Base data models and session logic
│   ├── Deck.js             # Token collections (e.g. cards, inventories)
│   ├── Table.js            # Game table / shared environment
│   ├── Token.js            # Core token representation
│   ├── Shoe.js             # Randomized token containers
│   ├── EventBus.js         # Global event dispatcher
│   ├── SessionManager.js   # Session and state persistence
│   └── loaders/tokenSetLoader.js
│
├── engine/                 # Simulation and rule logic
│   ├── Engine.js           # Core simulation engine
│   ├── GameLoop.js         # Turn-based control flow
│   ├── Action.js           # Action definitions
│   ├── Player.js           # Agent/human participants
│   ├── RuleEngine.js       # Evaluates and enforces rules
│   ├── Policy.js           # Decision or strategy logic
│   ├── PluginHost.js       # External module integration
│   ├── Recorder.js         # Records sessions for playback or analysis
│   ├── Script.js           # Narrative or event scripting
│   ├── actions.js          # Core action registry (10 actions)
│   ├── actions-extended.js # Extended actions (35+ actions)
│   └── ACTIONS.md          # Complete action reference documentation
│
├── interface/              # Input/output and external integration
│   ├── CLIInterface.js     # Command-line interaction
│   ├── HumanInterface.js   # Interactive player interface
│   ├── NetworkInterface.js # Multiplayer networking layer
│   ├── RelayServer.js      # Message relay between clients
│   ├── OpenAIAgent.js      # AI-controlled agent interface
│   ├── Interpreter.js      # Natural language or command parsing
│   └── Narrator.js         # Descriptive storytelling layer
│
├── patterns/               # Reusable rule patterns
│   ├── turn-order.js       # Round-robin, priority, and sequential turns
│   ├── win-conditions.js   # Point-based, elimination, objective completion
│   ├── resource-limits.js  # Hand limits, action budgets, resource caps
│   └── testRulePatterns.js # Pattern validation tests
│
├── plugins/                # Built-in plugins
│   ├── analytics-plugin.js # Game statistics and performance tracking
│   ├── logging-plugin.js   # Structured event logging
│   └── save-state-plugin.js# Session persistence and replay
│
├── examples/               # Complete working examples
│   ├── blackjack/          # Full blackjack with AI agents
│   ├── tarot-reading/      # Tarot divination system
│   └── prisoners-dilemma/  # Game theory tournament system
│
├── test/                   # Core test suites
│   ├── testCore.js
│   ├── testEngine.js
│   ├── testPluginLoader.js
│   └── testExporters.js
│
├── testIntegration.js      # Integration tests
├── testPlugins.js          # Plugin system tests
│
└── schemas/                # JSON Schemas for data validation
    ├── session-state-schema.json
    └── token-set.schema.json
```

---

## 🧩 Core Concepts

### **Tokens**
Tokens are the smallest interactive entities. They can represent cards, resources, characters, or abstract concepts.  
Each token conforms to [`token-set.schema.json`](./schemas/token-set.schema.json) for consistent structure.

### **Actions**
The engine provides **45+ built-in actions** organized by category:
- **Deck actions** (10): shuffle, draw, reset, burn, peek, cut, insertAt, removeAt, swap, reverse
- **Table actions** (13): place, clear, move, flip, remove, zone management, locking
- **Shoe actions** (7): multi-deck container operations
- **Player actions** (9): resource management, card operations, activation
- **Game actions** (6): lifecycle, phases, properties

See [`engine/ACTIONS.md`](./engine/ACTIONS.md) for complete documentation.

### **Rule Patterns**
Reusable patterns for common game mechanics:
- **Turn Order**: Round-robin, priority-based, simultaneous, custom sequences
- **Win Conditions**: Points, elimination, objectives, time limits
- **Resource Limits**: Hand size, action budgets, resource caps, cooldowns

Import and configure patterns to quickly build game logic.

### **Events**
The `EventBus` enables decoupled, event-driven communication among components (e.g., engine, players, interfaces).

### **Sessions**
A `SessionManager` maintains game or simulation state, which can be saved, replayed, or exported.

### **Plugins**
External modules can define new actions, AI agents, or rule sets through the `PluginHost`. Three built-in plugins:
- **Analytics**: Track actions, turns, errors, and performance metrics
- **Logging**: Structured event logging with filtering and exporters
- **Save State**: Session persistence with JSON export/import and replay

---

## ⚡ Getting Started

### **1. Install**
Clone the repository and install dependencies:

```bash
git clone https://git.carpocratian.org/sibyl/hypertoken.git
cd hypertoken
npm install
```

### **2. Run the Examples**

**Blackjack**: Play against the dealer or watch AI tournaments
```bash
# Interactive play
node examples/blackjack/cli.js

# AI tournament
node examples/blackjack/agents/tournament.js
```

**Tarot Reading**: Get divination readings with 8 classic spreads
```bash
node examples/tarot-reading/tarot-cli.js
```

**Prisoner's Dilemma**: Explore 14 game theory strategies
```bash
node examples/prisoners-dilemma/pd-cli.js
```

### **3. Test the System**

```bash
# Core tests
node test/testCore.js
node test/testEngine.js

# Plugin tests
node testPlugins.js

# Integration tests
node testIntegration.js

# Pattern tests
node patterns/testRulePatterns.js
```

### **4. Build Your Own Game**

```javascript
import { Engine } from './engine/Engine.js';
import { Deck } from './core/Deck.js';
import { RuleEngine } from './engine/RuleEngine.js';
import { registerRoundRobinTurns } from './patterns/turn-order.js';
import { registerPointBasedWin } from './patterns/win-conditions.js';

// Create engine with deck
const engine = new Engine();
const deck = new Deck(myTokenSet);
engine.attachDeck(deck);

// Add rule patterns
const ruleEngine = new RuleEngine();
registerRoundRobinTurns(ruleEngine);
registerPointBasedWin(ruleEngine, { targetScore: 100 });

// Add players
engine.addPlayer({ id: 'player1', name: 'Alice' });
engine.addPlayer({ id: 'player2', name: 'Bob' });

// Start game
engine.start();
```

---

## 📚 Examples

HyperToken includes three complete, documented examples:

### 🃏 Blackjack
Complete casino blackjack with:
- Token-based 52-card deck
- Full blackjack rules (dealer logic, splitting, doubling)
- AI agents with different strategies
- Tournament system for testing strategies
- Deterministic simulation with seedable RNG

**[View Blackjack Documentation →](./examples/blackjack/README.md)**

### 🔮 Tarot Reading
Philosophical divination system with:
- Complete 78-card Rider-Waite-Smith deck
- 8 classic spreads (Celtic Cross, Three Card, etc.)
- Interpretive engine with position-specific meanings
- Elemental analysis and pattern recognition
- Reading history and export

**[View Tarot Documentation →](./examples/tarot-reading/README.md)**

### 🎲 Prisoner's Dilemma
Game theory tournament system with:
- 14 classic strategies (Tit for Tat, Grudger, Pavlov, etc.)
- Round-robin tournament format
- Detailed statistics and analysis
- Strategy evolution tracking
- Ecosystem simulation mode

**[View Prisoner's Dilemma Documentation →](./examples/prisoners-dilemma/README.md)**

---

## 🧠 Example Use Cases

| Type | Example |
|------|----------|
| 🎲 Game Simulation | Card games with dynamic AI players |
| 🧬 Research | Multi-agent reinforcement learning |
| 📖 Storytelling | Procedural narrative with scripted events |
| 🛡️ Training | AI learning strategic policy decisions |
| 🎓 Education | Teaching game theory and decision-making |
| 🔬 Experimentation | Testing social dynamics and cooperation |

---

## 🔌 Extending HyperToken

### Using Plugins

```javascript
import analyticsPlugin from './analytics-plugin.js';
import loggingPlugin from './logging-plugin.js';
import saveStatePlugin from './save-state-plugin.js';

// Load plugins
engine.pluginHost.load('analytics', analyticsPlugin.init, {
  trackActions: true,
  trackTiming: true
});

engine.pluginHost.load('logging', loggingPlugin.init, {
  level: 'info',
  format: 'json'
});

engine.pluginHost.load('saveState', saveStatePlugin.init, {
  autoSave: true,
  interval: 5000
});

// Use plugin features
const report = engine.analytics.getReport();
engine.logging.info('Game started', { players: 4 });
await engine.saveState.save('game-checkpoint-1');
```

### Creating Custom Plugins

```javascript
export function init(engine, config = {}) {
  // Initialize plugin state
  const pluginState = {};
  
  // Listen to events
  engine.eventBus.on('action:dispatched', (action) => {
    // React to actions
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
```

---

## 🧰 Development

### Running Tests

```bash
# Core functionality
npm test

# Specific test suites
node test/testCore.js
node test/testEngine.js
node testPlugins.js
node patterns/testRulePatterns.js
```

### Documentation

- **[ACTIONS.md](./engine/ACTIONS.md)**: Complete reference for all 45 built-in actions
- **[Example READMEs](./examples/)**: Detailed documentation for each example
- **[Code Comments](./core/)**: Inline documentation throughout the codebase

### Debugging

Logging and debugging are handled through:
- `Recorder` subsystem for action replay
- `EventBus` for event-driven debugging
- Analytics plugin for performance metrics
- Logging plugin for structured logs

---

## 🧾 License

Copyright The Carpocratian Church of Commonality and Equality, Inc. © 2025  
Licensed under the Apache 2.0 License.  
See [NOTICE](./NOTICE) for details.

---

## 👥 Authors

**Marcellina II (she/her)**

---

## 🧠 Philosophy

> "Every player, every action, and every token tells a story.  
> HyperToken lets those stories play themselves out."

---

# Practical Applications of HyperToken

HyperToken is a modular, framework-agnostic engine for defining and simulating interactions between agents, actions, and rules. Its design makes it suitable for a wide range of creative, educational, and research-oriented purposes.

---

## 1. Game and Simulation Engine

HyperToken can serve as the logic layer for **turn-based or rule-based games**, whether digital or tabletop-inspired.

**Examples:**
- A digital card or token game with custom rule sets.
- Tabletop RPG logic where AI agents narrate or play roles.
- Competitive AI simulations where players are automated agents.

*Stop and think:* a programmable "Tabletop Simulator" without graphics—just logic, state, and plain text.

---

## 2. Agent-Based Modeling

Its modular design makes HyperToken ideal for **multi-agent simulations** that explore decision-making, cooperation, and competition.

**Examples:**
- Economic simulations where agents trade resources under policies.
- Ecological models exploring population dynamics.
- Behavioral simulations in education or research settings.

*Stop and think:* I need to ask a thousand people something. Right now.

---

## 3. Rule and Policy Prototyping

HyperToken allows you to **prototype and test rule systems** before deploying them in larger contexts.

**Examples:**
- Modeling governance or moderation systems.
- Testing policy interactions for fairness or stability.
- Exploring "what if" scenarios in regulatory or social design.

*Stop and think:* I'm just a bill, but now I can show you what your future holds before I'm passed.

---

## 4. AI Orchestration and Storytelling

With interfaces like `OpenAIAgent` and `Narrator`, HyperToken can mediate structured interactions between human and AI agents.

**Examples:**
- AI-driven narrative systems where agents act and react dynamically.
- Interactive fiction with rule-based world mechanics.
- Multi-agent creative collaborations.

*Stop and think:* AI non-playable character residents of a town with crafted lived experiences. Will you just pass them by?

---

## 5. Networked and Collaborative Systems

The inclusion of `RelayServer` and `NetworkInterface` makes it extendable for **multi-user and real-time simulations**.

**Examples:**
- Online multiplayer turn-based games.
- Shared experimental environments for distributed groups.
- Networked decision-making or strategy simulations.

*Stop and think:* 🍣 and ♠️♥️♣️♦️ with the boys from anywhere!

---

## 6. Education and Research

HyperToken's simplicity and modularity make it a valuable **educational platform** for teaching systems thinking, programming, and AI interaction.

**Examples:**
- Teaching logic, probability, and agent systems.
- Classroom experiments in cooperation or competition.
- Researching emergent behaviors in rule-based environments.

*Stop and think:* The codebase is the textbook.

---

### Summary
> **HyperToken is a rule-driven engine for structured interaction.** Whether for games, simulations, AI orchestration, or educational exploration, it provides a flexible foundation for designing, observing, and extending interactive systems.

---

### 🜍 Proemium to the Art of Tokens

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