# 🧩 HyperToken

**A game engine where the entire state is a CRDT.**

Deterministic replay, serverless multiplayer, forkable worlds—all from one architectural decision. Built on **[Automerge](https://automerge.org/)** for distributed consensus, with **[OpenAI Gym](https://gymnasium.farama.org/)/[PettingZoo](https://pettingzoo.farama.org/)** interfaces so any game doubles as a training environment.

---

## 🔑 What This Gets You

| Capability | How |
|------------|-----|
| **Serverless multiplayer** | CRDTs sync state across peers without a server |
| **Perfect replay** | Every action recorded with actor and timestamp |
| **Forkable worlds** | Snapshot state, explore alternatives, compare outcomes |
| **AI training environments** | Gym/PettingZoo interfaces out of the box |
| **Offline-first** | Peers diverge safely, converge mathematically |

```
Traditional Engine:     Server decides → clients accept → monthly hosting bill
Blockchain Engine:      Consensus decides → everyone pays gas → wait 15 seconds
HyperToken:            CRDTs merge → everyone agrees → zero infrastructure
```

---

## 🎮 What You Can Build

**Card Games** — Blackjack, Poker, Cuttle, custom TCGs. Tokens compose with provenance tracking.

**Strategy Games** — Game theory simulations, tournaments, agent competitions. 14 Prisoner's Dilemma strategies included.

**Multiplayer Worlds** — P2P sync, no servers, games that outlive their creators.

**Training Environments** — Any game is automatically a Gym environment. Multi-agent via PettingZoo.

```bash
# Play now
npm run blackjack          # Casino with AI & betting
npm run prisoners-dilemma  # Game theory tournament
npm run poker              # Texas Hold'em
npm run cuttle             # Card combat

# Multiplayer
npm run blackjack:server   # Host
npm run blackjack:client   # Join
```

---

## ⚡ Quick Start

```bash
git clone https://git.carpocratian.org/sibyl/hypertoken.git
cd hypertoken
npm install
npm run build
npm run blackjack
```

Pre-built WASM binaries included. See [Getting Started Guide](./docs/GETTING_STARTED.md) for the full walkthrough.

---

## 🏗️ How It Works

### Tokens Compose With Provenance

```javascript
// Merge tokens — result tracks where it came from
const enchantedSword = engine.dispatch("token:merge", { 
  tokens: [sword, fireEnchantment],
  resultProperties: { label: "Flaming Sword" }
});
// enchantedSword._mergedFrom = [sword.id, fireEnchantment.id]
// enchantedSword._mergedAt = timestamp

// Split tokens — pieces track their origin
const pieces = engine.dispatch("token:split", { 
  token: goldPile,
  count: 3
});
// pieces[0]._splitFrom = goldPile.id
```

### State Syncs Automatically

```javascript
const host = new Engine();
host.connect("ws://relay.local:8080");

const client = new Engine();  
client.connect("ws://relay.local:8080");

// Both make changes → CRDTs merge → identical final state
// No conflict resolution code. No server logic. It just works.
```

### Any Game Becomes a Training Environment

```typescript
class BlackjackEnv extends GymEnvironment {
  get observationSpace() { return { shape: [6] }; }
  get actionSpace() { return { n: 4 }; } // hit, stand, double, split
  
  async step(action: number) {
    const result = this.game.act(action);
    return {
      observation: this.encodeState(),
      reward: result.reward,
      terminated: result.done,
      truncated: false,
      info: {}
    };
  }
}
```

### Fork State for What-If Exploration

```javascript
const snapshot = engine.snapshot();

// Try option A
engine.dispatch('agent:cooperate');
const cooperateOutcome = engine.getState();

// Rewind, try option B
engine.restore(snapshot);
engine.dispatch('agent:defect');
const defectOutcome = engine.getState();

// Compare and decide
```

---

## 🤖 AI & ML Integration

**Gym/PettingZoo** — Single-agent and multi-agent interfaces. Turn-based (AEC) and simultaneous (Parallel).

**ONNX Export** — Train anywhere, deploy the policy in browser or Node.js.

**Python Bridge** — Connect to the TypeScript engine from Python for training.

**MCP Server** — Let LLMs play games via [Model Context Protocol](https://modelcontextprotocol.io/).

```bash
npm run mcp:server       # LLM integration
npm run bridge:blackjack # Python bridge
```

---

## ⚙️ Architecture

```
hypertoken/
├── core/                   # CRDT state management
│   ├── Token.ts           # Entities with provenance tracking
│   ├── Stack.ts           # Ordered collections (decks, piles)
│   ├── Space.ts           # Spatial zones (boards, hands)
│   ├── Chronicle.ts       # Automerge CRDT wrapper
│   └── ConsensusCore.ts   # P2P synchronization
│
├── core-rs/                # Rust → WASM (67 typed actions)
│   └── src/
│       ├── stack.rs       # 10 stack operations
│       ├── space.rs       # 14 spatial operations
│       ├── agent.rs       # 16 agent operations
│       ├── token_ops.rs   # 7 token transformations
│       └── batch.rs       # 8 batch operations
│
├── engine/                 # Game coordination
│   ├── Engine.ts          # Action dispatch, WASM integration
│   ├── GameLoop.ts        # Turn management
│   └── RuleEngine.ts      # Condition-triggered actions
│
├── network/                # P2P and server modes
│   ├── PeerConnection.ts
│   ├── AuthoritativeServer.ts
│   └── HybridPeerManager.ts
│
├── interface/              # RL adapters
│   ├── Gym.ts             # Single-agent
│   ├── PettingZoo.ts      # Multi-agent (turn-based)
│   └── PettingZooParallel.ts  # Multi-agent (simultaneous)
│
└── examples/               # Working games
    ├── blackjack/
    ├── poker/
    ├── prisoners-dilemma/
    └── hanabi/
```

---

## 🔮 The Philosophy

> "A token isn't valuable because of what it IS—it's valuable because of its relationships"

Tokens derive meaning from context:
- **Who owns it** — agents, players
- **What's attached** — enchantments, modifiers
- **Where it is** — zones, positions
- **What it came from** — merge/split provenance
- **What rules govern it** — constraints, triggers

This applies to cards in blackjack, strategies in game theory, shares in a market, or NPCs in a world. The same engine handles all of them because the abstraction is right.

---

## 🌍 Compared To

| System | HyperToken's Difference |
|--------|------------------------|
| **Unity/Godot** | Logic-first, no graphics dependency |
| **Colyseus** | P2P, no server required |
| **Blockchain games** | Same guarantees, zero gas fees |
| **Automerge/Yjs** | Game-aware abstractions (tokens, agents, rules) |
| **OpenAI Gym** | Built-in multiplayer, compositional tokens |

---

## 📖 Documentation

- [Action Reference](./engine/ACTIONS.md) — All 77 actions
- [Architecture Guide](./docs/ARCHITECTURE.md) — How components connect
- [Python Bridge](./docs/PYTHON_BRIDGE.md) — PettingZoo integration
- [ONNX Export](./docs/ONNX_EXPORT.md) — Deploy trained policies
- [Docker Guide](./DOCKER.md) — Container deployment

---

## 🐳 Docker

```bash
docker build -t hypertoken:latest .
docker compose up relay
docker compose run --rm quickstart
```

---

## 📜 License

Apache 2.0 — Copyright © 2025 The Carpocratian Church of Commonality and Equality, Inc.

---

## 👥 Credits

**Created by Marcellina II (she/her)**

Inspired by Martin Kleppmann's work on CRDTs, Rich Hickey's philosophy on state and time, and the legacy of HyperCard.

---

## 🜍 Proemium to the Art of Tokens

*The All is number, and from number flow the forms of things.*  
*For as the Monad abides in simplicity, so does it unfold the Dyad,*  
*and from their tension spring the harmonies that sustain the world.*

*Among the arts that imitate the order of the heavens,*  
*there now arises one most subtle and most just—the Art of Tokens.*

*In this art, every being is rendered as a form in relation,*  
*every action as a motion among forms,*  
*and the laws that bind them are set forth as measure and correspondence.*

*Let none deem this art a toy of artifice.*  
*It is the discipline by which the mind rehearses creation,*  
*a mirror held to the pattern of the world-soul.*

*So may this art be given freely,*  
*that all who love Wisdom may join the music of the spheres through understanding,*  
*and that the harmony of minds may become the harmony of worlds.*

*For when reason is made common, the gods are near.*
