# ![🧩 HyperToken](hypertoken.webp)

[<div align=center><img src="church.png" width=72 height=72>](https://carpocratian.org/en/church/)

_A mission of [The Carpocratian Church of Commonality and Equality](https://carpocratian.org/en/church/)_.</div>
<div align=center><img src="mission.png" width=256 height=200></div>

**HyperToken** is a **Local-First Multiagent Engine** and **AI Research Platform**.

It combines **CRDTs (Automerge)** for state synchronization, **OpenAI Gym** for agent training, and a **Host-Authoritative** architecture to create permissionless, persistent worlds without a blockchain.

Inspired by the creative legacy of Apple's _HyperCard_, **HyperToken** reimagines that spirit for the age of intelligent systems. Where _HyperCard_ made computers wrispace for artists and educators, **HyperToken** makes complex simulations and game logic wrispace for designers, researchers, and philosophers.

This project is an original work and is not affiliated with or endorsed by Apple Inc. The reference to _HyperCard_ is made solely for historical and conceptual comparison.

---

## 🌟 What Is HyperToken?

At its heart, HyperToken is a **relationship engine** that lives in the network.

A token isn't valuable because of what it IS — it's valuable because of:
- **Who owns it** (agents, agents)
- **What's attached to it** (equipment, enchantments, status effects)
- **Where it is** (zones, locations, containers)
- **What rules govern it** (policies, validators, game logic)
- **Who wants it** (competing interests, economies, goals)

This philosophy applies equally to cards in a blackjack source, shares in an economic model, or agents in a social simulation. HyperToken provides the primitives to model **any discrete system where entities have state, relationships, and location**, automatically synchronizing that truth between peers.

---

## 🌍 Use Cases

HyperToken is designed for two distinct audiences: creators building games and researchers modeling systems.

| **For Creators & Communities** | **For Researchers & Enterprise** |
| :--- | :--- |
| **[👉 Read Community Use Cases](./COMMUNITY_USE_CASES.md)** | **[👉 Read Enterprise Use Cases](./ENTERPRISE_USE_CASES.md)** |
| • **Serverless Multiagent Games**<br>Host games on your own device; zero infrastructure costs. | • **Reinforcement Learning Environments**<br>Train AlphaZero-style agents using the standardized Gym interface. |
| • **"Headless" Autonomous Worlds**<br>Persistent game states that live in the swarm, not on a server. | • **Market & Economic Simulations**<br>Model complex trading economies to test incentive structures. |
| • **Anti-Cheat P2P Gaming**<br>Host-authoritative logic ensures fair play without a central authority. | • **Rapid Mechanic Prototyping**<br>Script complex mechanics in text/CLI before committing to Unity/Unreal. |
| • **Emergent Narrative Systems**<br>Items and NPCs that carry their own history across sessions. | • **Supply Chain & Logistics Logic**<br>Distinct tracking of assets moving through zones with strict rules. |

---

## ✨ Core Features

### The Distributed Engine
- **State Kernel:** Built on **Automerge CRDTs**. History is preserved, merges are atomic, and the "truth" is mathematically guaranteed across peers.
- **Networking:** Native **P2P Synchronization**. Clients exchange state deltas, not just message events.
- **Time:** Distributed **GameLoop**. Turns, phases, and active agent states are synchronized alongside data.
- **AI Training:** Built-in **OpenAI Gym** interface. Connect your game logic directly to TensorFlow or PyTorch.

### Complete Action Registry (58 Actions)
- 🎴 **Stack Operations (10)** — Atomic draw queues, cryptographic shuffling, burn/peek operations.
- 🎯 **Space Operations (13)** — Spatial zones, layout management, locking/unlocking.
- 👟 **Source Operations (7)** — Multi-stack containers for weighted randomness.
- 👥 **Agent Operations (12)** — Resource pools, atomic transfers, secure trading, theft mechanics.
- 🎮 **Game Operations (6)** — Lifecycle, phase transitions, property management.
- 🔄 **Token Operations (5)** — Transform, attach/detach, merge/split entities.
- 📊 **Batch Operations (5)** — High-performance filtering and querying.

**Every action is:**
- ✅ Fully implemented
- ✅ Comprehensively tested
- ✅ Documented with examples
- ✅ Event-driven

### Reusable Rule Patterns
- **Turn Order** (patterns/turn-order.js): Round-robin, priority, simultaneous.
- **Win Conditions** (patterns/win-conditions.js): Thresholds, elimination, objectives.
- **Resource Management** (patterns/resource-limits.js): Hand limits, budgets, caps.

---

## 🧭 Architecture

    
```

./
├── core/                   # Foundation
│   ├── Token.ts            # Universal entity representation
│   ├── stack.ts             # Atomic CRDT-backed collections
│   ├── Source.ts             # Multi-stack randomness
│   ├── Space.ts            # Spatial zones and placement
│   ├── Chronicle.ts   # Automerge State Kernel
│   └── ConsensusCore.ts      # P2P Synchronization Logic
│
├── engine/                 # Simulation Logic
│   ├── Engine.ts           # Core coordinator
│   ├── GameLoop.ts         # Distributed time/turn control
│   ├── RuleEngine.ts       # Global law enforcement
│   ├── Agent.ts           # Agent/participant wrapper
│   └── actions-extended.ts # Complete 58-action registry
│
├── interface/              # I/O & Integration
│   ├── NetworkInterface.ts # WebSocket/P2P transport
│   ├── RelayServer.ts      # Lightweight signal relay
│   ├── Gym.ts              # Reinforcement Learning Standard API
│   └── OpenAIAgent.js      # LLM Integration
│
├── examples/               # Working Implementations
│   ├── blackjack/          # Multiagent Casino Game & AI Gym
│   ├── tarot-reading/      # Divination system
│   └── prisoners-dilemma/  # Game theory
│
└── schemas/                # Data Validation
    ├── token-set.schema.json
    └── session-state-schema.json
```
---

## ⚡ Quick Start

### Installation

```bash
git clone [https://git.carpocratian.org/sibyl/hypertoken.git](https://git.carpocratian.org/sibyl/hypertoken.git)
cd hypertoken
npm install
npx tsc
```

### Run the Examples

**Blackjack** — Play against the dealer or watch AI tournaments
```bash
node dist/examples/blackjack/server.js
node dist/examples/blackjack/client.js Alice
node dist/examples/blackjack/client.js Bob
```

**Tarot Reading** — Get divination readings with 8 classic spreads
```bash
node examples/tarot-reading/tarot-cli.js
```

**Prisoner's Dilemma** — Explore 14 game theory strategies
```bash
node examples/prisoners-dilemma/pd-cli.js
```

---

## 🧠 Philosophy

> "Every agent, every action, and every token tells a story.  
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