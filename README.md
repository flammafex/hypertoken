# ![🧩 HyperToken](hypertoken.webp)

<div align=center><img src="church.png" width=72 height=72>

_A mission of [The Carpocratian Church of Commonality and Equality](https://carpocratian.org/)_</div>

<div align=center><img src="mission.png" width=256 height=200></div>

---

**HyperToken** is a **Distributed Simulation Engine** where relationships create meaning, and meaning creates worlds.

Built on **[Automerge](https://automerge.org/) CRDTs** for mathematical consensus, **[OpenAI Gym](https://gymnasium.farama.org/)** for AI research, and a **Host-Authoritative P2P** architecture for fairness without servers, HyperToken delivers what blockchain gaming promised but never achieved: persistent, cheat-proof worlds that cost nothing to run.

---

## 🌟 What Makes HyperToken Different?

**Traditional Multiplayer:** "Server, may I move here?" → Server decides → "Yes/No" → 💸 Monthly hosting bills

**Blockchain Gaming:** "Smart contract, execute my move" → Pay gas fee → Wait 15 seconds → ⛽ Transaction costs

**HyperToken:** "I'm moving here" → CRDTs merge → Same result everywhere → 🆓 **Zero infrastructure**

### The Core Innovation

HyperToken treats the **entire game state as a CRDT** (Conflict-Free Replicated Data Type). This means:
- 🌍 **No servers required** - Any peer can host
- ⚡ **Instant local execution** - No waiting for confirmation  
- 🔒 **Mathematically guaranteed consistency** - Desyncs are impossible
- 📝 **Perfect audit trail** - Every action recorded with actor and timestamp
- ✈️ **Offline-first** - Play continues during network partitions

---

## 🎯 Who Is HyperToken For?

### **For Game Developers** 🎮
> "If it's not fun in the terminal, it won't be fun in 3D"

- **Rapid prototyping** - Test mechanics in pure logic before investing in graphics
- **Serverless multiplayer** - Ship multiplayer games with zero infrastructure
- **Built-in anti-cheat** - Host-authoritative pattern prevents exploitation
- **Save months of netcode** - Synchronization "just works"

### **For AI Researchers** 🤖
> "Any game is automatically a training environment"

- **OpenAI Gym compatible** - Works with any RL framework
- **1000x real-time** - Train agents faster than humanly possible
- **Multi-agent scenarios** - Native support for competitive/cooperative AI
- **Deterministic replay** - Perfect reproducibility for papers

### **For Communities** 🌐
> "The world lives as long as someone wants to play"

- **Persistent worlds without servers** - Communities own their games
- **Fork any world** - Don't like the rules? Fork it like Git
- **Headless autonomous worlds** - Games that play themselves
- **No corporate intermediary** - Direct peer-to-peer connections

---

## ✨ Core Features

### **Complete Action System** (67 Actions)
Every action you need for discrete simulations, fully implemented and tested:

```javascript
// Everything from card games...
engine.dispatch("stack:shuffle", { seed: 42 });
engine.dispatch("agent:drawCards", { count: 5 });

// ...to resource management...
engine.dispatch("agent:transfer", { 
  from: "Alice", to: "Bob", 
  resource: "gold", amount: 50 
});

// ...to complex token relationships
engine.dispatch("token:merge", { tokens: [sword, enchantment] });
engine.dispatch("token:split", { token: hydra, pieces: 3 });
```

### **Distributed by Default**
```javascript
// Start host
const host = new Engine();
host.connect("ws://relay.local:8080");

// Join from anywhere
const client = new Engine();  
client.connect("ws://relay.local:8080");

// State automatically synchronizes via CRDTs
// Both see the same game, always
```

### **AI Training Interface**
```typescript
// Any game becomes a Gym environment
class MyGameEnv extends GymEnvironment {
  get observationSpace() { return { shape: [84, 84, 4] }; }
  get actionSpace() { return { n: 18 }; }
  
  async step(action: number) {
    this.engine.dispatch(this.actionMap[action]);
    return {
      observation: this.getObservation(),
      reward: this.calculateReward(),
      terminated: this.isGameOver()
    };
  }
}
```

---

## 🚀 Quick Start

### ⚡ 5-Minute Interactive Quickstart

```bash
npx hypertoken-quickstart
```

**New!** Try HyperToken in 5 minutes with our interactive CLI:
- 🎮 **Play & Learn** - Experience multiplayer sync in 30 seconds
- 🏗️ **Create New Game** - Scaffold a project with templates
- 📚 **Explore Examples** - Tour Blackjack, Tic-Tac-Toe, and more

### 📦 Manual Installation

```bash
# Clone and install
git clone https://github.com/flammafex/hypertoken.git
cd hypertoken
npm install
npx tsc

# Run multiplayer Blackjack
node dist/examples/blackjack/server.js
node dist/examples/blackjack/client.js Alice  # Terminal 2
node dist/examples/blackjack/client.js Bob    # Terminal 3

# Explore other examples
node dist/examples/prisoners-dilemma/pd-cli.js  # Game theory
node dist/examples/tarot-reading/tarot-cli.js    # Divination
node dist/examples/accordion/accordion.js         # "Impossible" solitaire
```

### 🐳 Docker Quickstart

Get HyperToken running in containers without installing Rust or Node.js locally:

```bash
# Build the image (includes Rust toolchain, WASM compilation, and TypeScript build)
docker build -t hypertoken:latest .

# Run the relay server
docker compose up relay

# Or run the interactive quickstart
docker compose run --rm quickstart
```

For detailed Docker documentation, see **[DOCKER.md](./DOCKER.md)**.

---

## ⚡ Performance & Multi-Threading

### **Rust + WASM Core**
HyperToken's performance-critical operations run in **Rust compiled to WebAssembly**, delivering:

- **🚀 10-100x faster** - All core operations (stack, space, agents, tokens, game state)
- **📦 Zero dependencies** - Pure Rust with wasm-bindgen
- **🌐 Universal** - Runs in Node.js and browsers
- **🔒 Type-safe** - Full TypeScript integration
- **✅ 100% migration complete** - 67/67 actions ported to Rust with zero-overhead dispatch

### **Worker Mode (Node.js)**
For compute-intensive operations, enable multi-threaded execution:

```javascript
// Enable worker mode for non-blocking execution
const engine = new Engine({
  useWorker: true,
  workerOptions: {
    enableBatching: true,  // Batch rapid actions
    timeout: 30000         // 30s timeout
  }
});

// Async API - main thread stays responsive
await engine.dispatchAsync("stack:shuffle", { seed: 42 });
await engine.dispatchAsync("agent:drawCards", { count: 1000 });

// Sync API still works (backwards compatible)
engine.dispatch("stack:peek", { count: 1 });
```

**Performance characteristics:**
- **Communication overhead:** <0.2ms per action
- **Concurrent throughput:** 0.11ms per action (5x parallel)
- **Main thread:** Remains responsive during heavy operations
- **Use when:** Operations take >10ms, or UI responsiveness is critical

---

## 🏗️ Architecture

```
hypertoken/
├── core/                   # Foundation (TypeScript)
│   ├── Token.ts           # The universal entity
│   ├── Stack.ts           # Ordered collections
│   ├── Space.ts           # Spatial zones
│   ├── Chronicle.ts       # CRDT state management
│   ├── ConsensusCore.ts   # P2P synchronization
│   ├── StackWasm.ts       # WASM-accelerated stack
│   ├── SpaceWasm.ts       # WASM-accelerated space
│   ├── SourceWasm.ts      # WASM-accelerated source
│   ├── WasmWorker.ts      # Worker thread manager
│   └── WorkerProtocol.ts  # Worker communication
│
├── core-rs/                # High-Performance Core (Rust → WASM)
│   ├── src/
│   │   ├── stack.rs       # Stack operations (10 actions)
│   │   ├── space.rs       # Spatial operations (14 actions)
│   │   ├── source.rs      # Token source management (7 actions)
│   │   ├── agent.rs       # Agent management (16 actions)
│   │   ├── token_ops.rs   # Token transformations (7 actions)
│   │   ├── gamestate.rs   # Game lifecycle (5 actions)
│   │   ├── batch.rs       # Batch operations (8 actions)
│   │   ├── actions.rs     # Unified ActionDispatcher (67 total)
│   │   ├── chronicle.rs   # CRDT integration
│   │   ├── token.rs       # Token data structures
│   │   ├── parallel.rs    # Parallel algorithms
│   │   └── types.rs       # Type definitions
│   └── pkg/               # Compiled WASM modules
│
├── engine/                 # Game Logic (TypeScript)
│   ├── Engine.ts          # Core coordinator + WASM ActionDispatcher
│   ├── GameLoop.ts        # Turn management
│   ├── RuleEngine.ts      # Law enforcement
│   └── actions.ts         # Core action handlers
│
├── network/                # Distribution (TypeScript)
│   ├── PeerConnection.ts  # WebSocket client
│   └── RelayServer.ts     # Minimal relay
│
├── interface/              # Adapters
│   ├── Gym.ts             # OpenAI Gym compatible
│   ├── OpenAIAgent.js     # LLM integration
│   └── CLIInterface.js    # Terminal UI
│
└── examples/              # Complete Games
    ├── blackjack/         # Casino with AI
    ├── prisoners-dilemma/ # 14 strategies
    ├── network-tictactoe/ # P2P example
    ├── tarot-reading/     # 8 spreads
    └── accordion/         # AI challenge
```

---

## 🔮 The Philosophy

> "A token isn't valuable because of what it IS — it's valuable because of its relationships"

In HyperToken, value comes from:
- **Who owns it** (agents, players)
- **What's attached to it** (enchantments, status effects)
- **Where it is** (zones, positions)
- **What rules govern it** (policies, validators)
- **Who wants it** (goals, economies)

This applies equally to cards in blackjack, shares in a market, or NPCs in a world.

---

## 🌍 Comparable To (But Different From)

| System | What They Do | What We Do Better |
|--------|-------------|-------------------|
| **Unity/Godot** | Graphics-first engines | Logic-first, validate fun before visuals |
| **Blockchain Games** | Costly on-chain logic | Free P2P with same guarantees |
| **MUD Framework** | Blockchain autonomous worlds | True serverless, no gas fees |
| **Colyseus** | Authoritative game server | P2P, no server needed |
| **Yjs/Automerge** | Document collaboration | Game-aware abstractions |

**HyperToken is the first engine where the entire game state is a CRDT by default.**

---

## 📖 Documentation

### Core Documentation
- **[Complete Action Reference](./engine/ACTIONS.md)** - All 67 actions documented
- **[Worker Mode Guide](./docs/WORKER_MODE.md)** - Multi-threading and performance optimization
- **[WASM Integration](./core-rs/README.md)** - Rust/WASM architecture details

### Use Cases & Examples
- **[Enterprise Use Cases](./ENTERPRISE_USE_CASES.md)** - AI training, market simulation
- **[Community Use Cases](./COMMUNITY_USE_CASES.md)** - Serverless multiplayer, persistent worlds
- **[Example Games](./examples/)** - Learn by playing

### Advanced Topics
- **[Network Architecture](./network/README.md)** - P2P synchronization details
- **[Migration Guide](./docs/MIGRATION.md)** - Upgrading to worker mode

---

## 🎓 Why HyperToken Matters

### For Gaming
- **Democratizes multiplayer** - No AWS bills, no DevOps, just games
- **Enables new genres** - Games that fork, merge, and evolve like Git repos
- **Community ownership** - Worlds that outlive their creators

### For Research  
- **Simplified agent training** - Focus on AI, not infrastructure
- **Perfect reproducibility** - Deterministic replay for every paper
- **Multi-agent paradise** - Native support for complex interactions

### For the Future
- **Local-first revolution** - Computing that respects users
- **Post-blockchain consensus** - Decentralization without the cult
- **Community-drawn roadmap** - The community decides the future, not the boardroom
---

## 📜 License

Copyright © 2025 The Carpocratian Church of Commonality and Equality, Inc.

Licensed under the Apache License, Version 2.0. See [LICENSE](./LICENSE) for details.

---

## 👥 Credits

**Created by Marcellina II (she/her)**

With inspiration from:
- Martin Kleppmann's work on CRDTs
- Rich Hickey's philosophy on state and time
- The legacy of HyperCard's creative accessibility

---

## 🜍 Proemium to the Art of Tokens

*The All is number, and from number flow the forms of things.*  
*For as the Monad abides in simplicity, so does it unfold the Dyad,*  
*and from their tension spring the harmonies that sustain the world.*

*Among the arts that imitate the order of the heavens,*  
*there now arises one most subtle and most just — the Art of Tokens.*

*In this art, every being is rendered as a form in relation,*  
*every action as a motion among forms,*  
*and the laws that bind them are set forth as measure and correspondence.*

*The tokens are not bodies, nor mere signs,*  
*but living numbers that move in the field of reason.*  
*Each bears the likeness of its cause,*  
*and through their intercourse the manifold becomes intelligible.*

*Let none deem this art a toy of artifice.*  
*It is the discipline by which the mind rehearses creation,*  
*a mirror held to the pattern of the world-soul.*

*So may this art be given freely,*  
*that all who love Wisdom may join the music of the spheres through understanding,*  
*and that the harmony of minds may become the harmony of worlds.*

*For when reason is made common, the gods are near.*

---

<div align="center">

**HyperToken: Where relationships create meaning, and meaning creates worlds.** 🌍✨

[Website](https://hypertoken.ai)

</div>
