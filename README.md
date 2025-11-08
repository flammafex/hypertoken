# ![🧩 HyperToken](hypertoken.webp)

[<div align=center><img src="church.png" width=72 height=72>](https://carpocratian.org/en/church/)

_A mission of [The Carpocratian Church of Commonality and Equality](https://carpocratian.org/en/church/)_.</div>
<div align=center><img src="mission.png" width=256 height=200></div>

**HyperToken** is a modular, token-driven simulation and game engine designed for **AI-human interaction**, **multi-agent systems**, and **rule-based games**.
It provides a flexible framework for creating simulations, turn-based or card-style games, narrative systems, or intelligent agents — all powered by an extensible plugin and event architecture.

Inspired by the creative legacy of Apple’s _HyperCard_, **HyperToken** reimagines that spirit for the age of intelligent systems. Where _HyperCard_ made computers writable for artists and educators, **HyperToken** makes AI environments and logic systems writable for designers and philosophers.

This project is an original work and is not affiliated with or endorsed by Apple Inc. The reference to _HyperCard_ is made solely for historical and conceptual comparison.

---

## 🚀 Overview

At its core, HyperToken represents everything as **tokens** — structured data objects governed by **rules**, **policies**, and **actions**.  
These tokens live inside a fully modular simulation loop that can be driven by **humans**, **AI agents**, or **networked participants**.

The engine combines:
- A **data-driven core** (tokens, decks, sessions, events)
- A **rule-based logic engine** for actions and outcomes
- A **plugin host** for custom behaviors
- Built-in **AI integration** (e.g., via OpenAI models)
- Multiple **interfaces** (CLI, human, network, AI)

HyperToken can serve as the backbone for:
- Games (card, board, RPG, or abstract)
- Interactive and/or visual storytelling
- Multi-agent research
- Reinforcement-learning environments
- Simulation-driven narratives

---

## ✨ Features

- 🧱 **Token-based world model** — every entity or resource is a token.
- ⚙️ **Rule Engine** — define legal actions, policies, and system behaviors.
- 🔌 **Plugin architecture** — extend with custom modules or AI agents.
- 🔁 **Game loop + recorder** — deterministic simulation and replay support.
- 🧠 **AI Integration** — out-of-the-box OpenAI agent interface.
- 🧍 **Human & network interfaces** — CLI, relay server, and multiplayer.
- 🧾 **Schema-driven data** — validated session and token schemas.
- 🗃️ **Session management** — persistent game or simulation states.

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
│   └── Script.js           # Narrative or event scripting
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
└── schemas/                # JSON Schemas for data validation
    ├── session-state-schema.json
    └── token-set.schema.json
```

---

## 🧩 Core Concepts

### **Tokens**
Tokens are the smallest interactive entities. They can represent cards, resources, characters, or abstract concepts.  
Each token conforms to [`token-set.schema.json`](./schemas/token-set.schema.json) for consistent structure.

### **Events**
The `EventBus` enables decoupled, event-driven communication among components (e.g., engine, players, interfaces).

### **Actions & Rules**
Actions are possible moves; rules validate or transform them.  
`RuleEngine` and `Policy` modules determine legal sequences and consequences.

### **Sessions**
A `SessionManager` maintains game or simulation state, which can be saved, replayed, or exported.

### **Plugins**
External modules can define new actions, AI agents, or rule sets through the `PluginHost`.

---

## ⚡ Getting Started

### **1. Install**
Clone the repository and install dependencies:

```bash
git clone https://git.carpocratian.org/sibyl/hypertoken.git
cd hypertoken
npm install
```

### **2. Run a basic simulation**
Start a CLI session:

```bash
node ./interface/CLIInterface.js
```

or launch an AI-driven demo (if configured):

```bash
node ./interface/OpenAIAgent.js
```

### **3. Extend it**
To create your own token set or rule system:
1. Define tokens in `schemas/token-set.schema.json` (loaded via `core/loaders/tokenSetLoader.js`).
2. Implement rules in `engine/RuleEngine.js`.
3. Add plugins via `pluginLoader.js` or `PluginHost`.

### **4. Minimal single-token shape:**
```json
{
  "id": "token-001",
  "group": null,
  "label": "Example Token",
  "text": "Rules or descriptive text goes here.",
  "meta": {},
  "char": "□",
  "kind": "default",
  "index": 0
}
```
>Notes
• ```id``` should be unique.
• ```group```, ```label``` are optional (default ```null```); ```text``` defaults to ```""```; ```meta``` defaults to ```{}```.
• ```char``` is useful for CLI/TTY renders.
• Keep example names/mechanics generic; the **minimal token set** example below is **fictional** and not affiliated with any third-party game or publisher.

```json
{
  "name": "Example Token Set",
  "kind": "default",
  "description": "Minimal example token set for HyperToken.",
  "tokens": [
    {
      "id": "example-card-skywarden",
      "group": "aurora",
      "label": "Skywarden Colossus",
      "text": "Aerial, steadfast. When this becomes blocked, you may exhaust it; if you do, it breaks through until end of turn.",
      "meta": {
        "type": "Guardian — Colossus",
        "energy_cost": 6,
        "power": 6,
        "toughness": 6,
        "rarity": "common",
        "set": "First Light",
        "collector_number": 22,
        "artist": "Example Artist",
        "flavor_text": "\"The sky is safest when it is watched.\"",
        "faction": ["Aurora"],
        "image": "https://example.com/skywarden_colossus.png",
        "license": "CC0"
      },
      "char": "◆",
      "kind": "default",
      "index": 0
    }
  ]
}
```
---

## 🧠 Example Use Cases

| Type | Example |
|------|----------|
| 🎲 Game Simulation | A card game (any card game) with dynamic AI player(s) |
| 🧬 Research | Multi-agent reinforcement learning environment |
| 📖 Storytelling | Procedural narrative with scripted events |
| 🛡️ Training | AI that learns strategic policy decisions |

---

## 🔌 Extending HyperToken

Add a new plugin by placing it under [`./engine/plugins/`](./engine/plugins/) or dynamically loading it:

```js
import { registerPlugin } from './pluginLoader.js';
registerPlugin('myCustomAI', './plugins/MyAIAgent.js');
```

Plugins can register new:
- Actions or rule sets  
- Player types (human, AI, networked)  
- Exporters (recorders, analytics)  

---

## 🧰 Development

To work on the engine:
```bash
npm run build
npm test
```

Logging and debugging are handled through the `Recorder` and `EventBus` subsystems.

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

> “Every player, every action, and every token tells a story.  
> HyperToken lets those stories play themselves out.”

# Practical Applications of HyperToken

HyperToken is a modular, framework-agnostic engine for defining and simulating interactions between agents, actions, and rules. Its design makes it suitable for a wide range of creative, educational, and research-oriented purposes.

---

## 1. Game and Simulation Engine

HyperToken can serve as the logic layer for **turn-based or rule-based games**, whether digital or tabletop-inspired.

**Examples:**
- A digital card or token game with custom rule sets.
- Tabletop RPG logic where AI agents narrate or play roles.
- Competitive AI simulations where players are automated agents.

*Stop and think:* a programmable “Tabletop Simulator” without graphics—just logic, state, and plain text.

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
- Exploring “what if” scenarios in regulatory or social design.

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

HyperToken’s simplicity and modularity make it a valuable **educational platform** for teaching systems thinking, programming, and AI interaction.

**Examples:**
- Teaching logic, probability, and agent systems.
- Classroom experiments in cooperation or competition.
- Researching emergent behaviors in rule-based environments.

*Stop and think:* The codebase is the textbook.

---

### Summary
> **HyperToken is a rule-driven engine for structured interaction.** Whether for games, simulations, AI orchestration, or educational exploration, it provides a flexible foundation for designing, observing, and extending interactive systems.

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

