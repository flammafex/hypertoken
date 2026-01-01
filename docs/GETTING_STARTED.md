# Getting Started with HyperToken

Get up and running in 5 minutes.

## Prerequisites

- **Node.js 18+** - [Download](https://nodejs.org/)
- **Git** - [Download](https://git-scm.com/)
- **Rust** (optional) - Only needed if building WASM from source

Verify your setup:
```bash
node --version   # Should be v18.0.0 or higher
npm --version    # Should be v9.0.0 or higher
```

## Quick Start

### 1. Clone and Install

```bash
git clone https://github.com/anthropics/hypertoken.git
cd hypertoken
npm install
```

### 2. Build

```bash
npm run build
```

This compiles TypeScript and prepares examples. Takes ~30 seconds.

### 3. Play a Game

```bash
npm run blackjack
```

You should see:
```
╔═══════════════════════════════════════╗
║         🃏 BLACKJACK 🃏              ║
╠═══════════════════════════════════════╣
║  Balance: $1000                       ║
╚═══════════════════════════════════════╝

Place your bet (1-1000, or 'q' to quit):
```

### 4. Explore More Games

```bash
npm run help              # See all available commands

# Other games to try:
npm run cuttle            # Card combat game
npm run prisoners-dilemma # Game theory simulation
npm run poker             # Texas Hold'em
```

## Verify Your Installation

Run the quick test suite to confirm everything works:

```bash
npm run test:quick
```

Expected output (should take ~10 seconds):
```
✓ Stack operations
✓ Space operations
✓ Engine dispatch
...
All tests passed!
```

## What's Next?

### Build Your First Game

Ready to create something? Follow the [First Game Tutorial](./FIRST_GAME.md) to build a complete card game in 15 minutes.

### Understand the Architecture

Read the [Architecture Guide](./ARCHITECTURE.md) to learn how HyperToken's components (Token, Stack, Space, Engine, Chronicle) work together.

### Try the Examples

| Example | Command | What You'll Learn |
|---------|---------|-------------------|
| Blackjack | `npm run blackjack` | Card games, betting, AI opponents |
| Cuttle | `npm run cuttle` | Combat mechanics, special abilities |
| Prisoner's Dilemma | `npm run prisoners-dilemma` | Game theory, strategies, tournaments |
| Poker | `npm run poker` | RL training environment |

### Build Something

```javascript
import { Token, Stack, Engine } from './core/index.js';

// Create a simple deck
const cards = [];
for (const suit of ['hearts', 'diamonds', 'clubs', 'spades']) {
  for (const rank of ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K']) {
    cards.push(Token.create({ suit, rank }));
  }
}

// Create engine with a stack
const engine = new Engine({
  stack: new Stack(cards)
});

// Shuffle and draw
engine.dispatch('shuffle');
const hand = engine.dispatch('draw', { count: 5 });
console.log('Your hand:', hand);
```

## Multiplayer Quick Start

### Start a Server

Terminal 1:
```bash
npm run blackjack:server
```

### Connect Clients

Terminal 2:
```bash
npm run blackjack:client
```

Terminal 3:
```bash
npm run blackjack:client
```

## Troubleshooting

### Build Fails

```bash
npm run clean    # Reset build artifacts
npm install      # Reinstall dependencies
npm run build    # Try again
```

### WASM Errors

If you see WASM-related errors, the pre-built WASM binaries should work. If not:

```bash
# Requires Rust toolchain
npm run build:rust
npm run build
```

### Tests Fail

```bash
npm run test:quick   # Run minimal test suite
# If this fails, check Node.js version (need 18+)
```

### Need Help?

- Run `npm run help` to see all commands
- Check the [README](../README.md) for detailed documentation
- See [ACTIONS.md](../engine/ACTIONS.md) for the complete action reference

## Project Structure

```
hypertoken/
├── core/        # Token, Stack, Space, Chronicle (start here)
├── engine/      # Engine, GameLoop, Actions (game logic)
├── network/     # P2P networking (multiplayer)
├── interface/   # AI/ML adapters (Gym, ONNX)
├── examples/    # Complete game implementations
└── docs/        # Detailed guides
```

## Common Commands Reference

```bash
# Development
npm run build          # Compile TypeScript
npm run clean          # Reset build artifacts
npm run help           # Show all commands

# Testing
npm run test:quick     # Fast core tests (~10s)
npm run test           # Full test suite (~2min)

# Games
npm run blackjack      # Play Blackjack
npm run cuttle         # Play Cuttle
npm run poker          # Play Poker

# Infrastructure
npm run relay          # Start P2P relay server
npm run bridge         # Start Python bridge
npm run mcp            # Start LLM integration server
```
