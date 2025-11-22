<div align=center><img src="fine.png" width=256 height=200></div>

# HyperToken Blackjack

A complete **casino-grade** Blackjack implementation using the HyperToken engine, featuring:
- Token-based card representation
- Rule engine for game logic
- Deterministic simulation with seedable RNG
- AI agents with different strategies
- Event-driven architecture
- **💰 Comprehensive betting system with 6 betting strategies**
- **🎰 Full casino features: Double Down, Split, Insurance**
- **📊 Card counting agents: Hi-Lo, Hi-Opt I, Omega II, Zen Count**
- **👥 Multi-agent support (2-6 agents at one space)**

## Quick Start

**Note**: Run examples from the `examples/blackjack` directory with the TypeScript loader:

```bash
cd examples/blackjack
node --loader ../../test/ts-esm-loader.js <command>
```

### Play Single-Agent Blackjack
```bash
# Play without betting
node --loader ../../test/ts-esm-loader.js cli.js

# Play with betting system
node --loader ../../test/ts-esm-loader.js cli.js --betting
```

Play blackjack in your terminal against the dealer. Standard casino rules apply:
- Dealer hits on 16 or less
- Dealer stands on 17 or more
- Blackjack pays 3:2
- **💎 Double Down**: Double your bet and take one card
- **✂️ Split**: Split matching pairs into two hands
- **🛡️ Insurance**: Protect against dealer blackjack when showing Ace

**Betting Mode Features:**
- Set your starting bankroll
- Place bets each round
- Track session statistics including doubles, splits, and insurance
- See your profit/loss in real-time

### Play Multi-agent (2-6 agents)
```bash
node --loader ../../test/ts-esm-loader.js multiagent-cli.js [numAgents]

# Examples:
node --loader ../../test/ts-esm-loader.js multiagent-cli.js 2  # 2 players
node --loader ../../test/ts-esm-loader.js multiagent-cli.js 4  # 4 players
```

Play blackjack with multiple human agents at one table:
- Each agent has their own bankroll
- Sequential turn-taking
- Individual betting
- Shared dealer

### Run AI Tournament
```bash
# Run 1000 rounds with default agents
node --loader ../../test/ts-esm-loader.js agents/tournament.js

# Run 5000 rounds with specific seed
node --loader ../../test/ts-esm-loader.js agents/tournament.js 5000 42

# Arguments: [rounds] [seed]
```

Watch different AI strategies compete:
- **Basic Strategy**: Follows simplified basic strategy rules
- **Conservative**: Stands on 17+
- **Aggressive**: Stands on 19+
- **Always Hit**: Hits until bust (for comparison)

### Run Betting Strategy Tournament
```bash
node --loader ../../test/ts-esm-loader.js tournament.js [rounds] [seed] [initialBankroll]

# Examples:
node --loader ../../test/ts-esm-loader.js tournament.js 1000       # 1000 rounds
node --loader ../../test/ts-esm-loader.js tournament.js 5000 42    # With seed 42
node --loader ../../test/ts-esm-loader.js tournament.js 1000 42 2000  # Custom bankroll
```

Compare AI playing strategies combined with different betting strategies:
- **Flat Betting**: Consistent bet size
- **Martingale**: Double after loss
- **Percentage**: Bet % of bankroll
- **Progressive**: Increase after wins

## Project Structure
```
blackjack/
├── token-sets/
│   └── standard-deck.json          # 52-card deck definition
├── agents/
│   ├── basic-strategy.js           # AI agent implementations
│   └── tournament.js               # AI vs AI simulation
├── blackjack-utils.js              # Hand evaluation utilities
├── blackjack-rules.js              # RuleEngine rules
├── game.js                         # Single-player game (simple)
├── multiagent-game.js              # Multi-agent game (advanced)
├── blackjack-betting.js            # Betting system & strategies
├── card-counting-agents.js         # Hi-Lo card counting agents
├── cli.js                          # Interactive CLI (supports --betting flag)
├── multiagent-cli.js               # Multi-agent CLI (2-6 players)
├── tournament.js                   # Betting strategy tournament
├── server.js                       # Network server for multiplayer
├── client.js                       # Network client for multiplayer
├── BlackjackEnv.ts                 # Gym environment for RL training
├── train.js                        # Training script using Gym env
├── test.js                         # Quick test script
└── README.md                       # This file
```

## Features

### 💰 Betting System

Complete bankroll and chip management integrated into all game modes:

**Features:**
- Initial bankroll configuration
- Bet placement with min/max limits
- Payout calculations (3:2 for blackjack, 1:1 for wins)
- Session statistics tracking
- Broke detection

**Betting Strategies:**
- **Flat Betting**: Always bet the same amount
- **Martingale**: Double bet after loss, reset after win
- **Percentage**: Bet a percentage of current bankroll
- **Progressive**: Increase bet after wins
- **Kelly Criterion**: Optimal bet sizing based on player edge and variance
- **Oscar's Grind**: Progressive system with profit targets and cycle tracking

**Usage:**
```javascript
import { BettingManager, KellyCriterionStrategy, OscarsGrindStrategy } from './blackjack-betting.js';

const betting = new BettingManager(1000, { minBet: 5, maxBet: 500 });
betting.placeBet(25);
const payout = betting.resolveBet('agent'); // Win!
console.log(betting.getStats());

// Advanced strategies
const kellyStrategy = new KellyCriterionStrategy(0.005, 0.005);
const oscarStrategy = new OscarsGrindStrategy(10, 10);
const betSize = kellyStrategy.getBetSize(gameState, betting, null, trueCount);
```

### 🎯 Card Counting Agents

Multiple professional card counting systems with bet spread adjustment:

**Features:**
- Running count tracking
- True count calculation (accounts for decks remaining)
- Automatic bet sizing based on advantage
- Strategy deviations at key counts
- Multiple counting styles (aggressive, conservative)
- Multi-level counting systems for advanced play
- Ace side-counting for precision

**Counting Systems:**
- **HiLoCountingAgent**: Classic balanced system (1-8x bet spread)
  - Simple: 2-6 = +1, 10-A = -1
- **HiOptICountingAgent**: More accurate with Ace side-count (1-8x spread)
  - 3-6 = +1, 10-K = -1, Aces tracked separately
- **OmegaIICountingAgent**: Multi-level balanced system (1-10x spread)
  - 2,3,7 = +1, 4,5,6 = +2, 9 = -1, 10-K = -2
- **ZenCountAgent**: Balanced multi-level system (1-8x spread)
  - 2,3,7 = +1, 4,5,6 = +2, A = -1, 10-K = -2
- **AggressiveCountingAgent**: Wide spread Hi-Lo variant (1-12x spread)
- **ConservativeCountingAgent**: Small spread Hi-Lo variant (1-4x spread)

**Usage:**
```javascript
import { HiLoCountingAgent, HiOptICountingAgent, OmegaIICountingAgent, ZenCountAgent } from './card-counting-agents.js';

// Basic Hi-Lo counter
const hiloCounter = new HiLoCountingAgent("Hi-Lo Counter", 10, 8);

// Advanced multi-level counter
const omegaCounter = new OmegaIICountingAgent("Omega II Counter", 10, 10);

// Get count statistics
const betSize = hiloCounter.getBetSize(gameState, bettingManager);
const decision = hiloCounter.decide(gameState);
console.log(hiloCounter.getCountStats()); // { runningCount, trueCount, ... }
```

### 👥 Multi-Agent Support

Play with 2-6 agents at a single table:

**Features:**
- Support for 2-6 agents
- Individual bankrolls and betting
- Sequential turn-taking
- Automatic dealer play after all agents finish
- Per-agent statistics
- Network multiplayer support

**Usage:**
```javascript
import { Engine } from '../../engine/Engine.js';
import { MultiagentBlackjackGame } from './multiagent-game.js';

const engine = new Engine();
const game = new MultiagentBlackjackGame(engine, {
  isHost: true,
  numAgents: 3,
  agentNames: ['Alice', 'Bob', 'Carol'],
  initialBankroll: 1000
});

// Agents place bets
engine._agents.forEach(agent => agent.resources.currentBet = 10);

game.deal();
game.hit();   // Current agent hits
game.stand(); // Current agent stands
```

## How It Works

### Token-Based Cards

Each card is a Token with metadata:
```json
{
  "id": "hearts-ace",
  "group": "hearts",
  "label": "A",
  "meta": {
    "suit": "hearts",
    "rank": "A",
    "value": [1, 11],
    "color": "red"
  },
  "char": "🂱"
}
```

### Game Flow

1. **Initialization**
   - Create Source with 6 stacks (standard casino rules)
   - Shuffle with optional seed for deterministic play
   - Setup Space with agent/dealer zones
   - Initialize betting managers for each agent

2. **Betting Phase** *(NEW!)*
   - Agents place bets within min/max limits
   - Card counting agents adjust bet sizes based on count

3. **Deal Phase**
   - 2 cards to each agent (both face up)
   - 2 cards to dealer (one face down)
   - Check for immediate blackjack

4. **Agent Turns** *(Sequential in multi-agent)*
   - Hit or Stand
   - Automatic bust detection via RuleEngine
   - Card counting agents update their count

5. **Dealer Turn**
   - Reveal hidden card
   - Auto-play using rules (hit on 16, stand on 17)

6. **Resolution**
   - Compare hands
   - Determine winners
   - Calculate and distribute payouts

### Rule Engine Integration

The RuleEngine automatically enforces game logic:
```javascript
// Auto-check for agent bust after hit
ruleEngine.addRule(
  "agent-bust-check",
  (engine, lastAction) => {
    if (lastAction.type !== "blackjack:hit") return false;
    const cards = engine.space.zone("agent-hand").map(p => p.card);
    return isBusted(cards);
  },
  (engine) => {
    engine.dispatch("blackjack:agent-busted", {});
  },
  { priority: 100 }
);
```

### Deterministic Replay

Use seeds to replay exact games:
```javascript
const game = new BlackjackGame({ seed: 12345 });
// Game will play identically every time with seed 12345
```

## Architecture Patterns

### 1. Betting System Integration
```javascript
// Initialize with betting
const game = new BlackjackGame({ 
  initialBankroll: 1000,
  minBet: 5,
  maxBet: 500
});

// Place bet before dealing
game.deal(betAmount);

// Payout calculated automatically
const state = game.stand();
console.log(state.payout); // { bet, payout, netGain, bankroll }
```

### 2. Card Counting
```javascript
// Counting agent decides bet and play
const counter = new HiLoCountingAgent();
const betSize = counter.getBetSize(gameState, bettingManager);
const decision = counter.decide(gameState); // "hit" or "stand"

// Count is updated automatically from visible cards
console.log(counter.trueCount); // +2 (agent has advantage)
```

### 3. Multi-agent Management
```javascript
// Agents take turns sequentially
while (!gameState.allAgentsFinished) {
  const currentAgent = game.getCurrentAgent();
  // Current agent makes decision
  game.hit(); // or game.stand()
}
// Dealer plays automatically after all agents finish
```

## What This Demonstrates

### Core HyperToken Features Used

✅ **Stack/Source/Space** - Token container primitives  
✅ **Engine** - Event-driven state machine  
✅ **ActionRegistry** - Extensible action system  
✅ **RuleEngine** - Declarative game logic  
✅ **Determinism** - Seedable shuffle for replay  
✅ **Serialization** - Game state can be saved/loaded  
✅ **Events** - Observable state transitions  
✅ **Betting Actions** - Money management primitives *(NEW!)*  
✅ **Multi-agent Zones** - Per-agent token containers *(NEW!)*  

### Patterns You Can Reuse

1. **Token Design** - How to structure card metadata
2. **Action Definition** - Extending the engine with domain actions
3. **Rule Creation** - Using conditions and effects for game logic
4. **Agent Interface** - Building AI that plays your game
5. **CLI Integration** - Making your simulation interactive
6. **Tournament Mode** - Running bulk simulations for analysis
7. **Betting Systems** - Money management and bankroll tracking *(NEW!)*
8. **Card Counting** - Adaptive strategy based on game state *(NEW!)*
9. **Multi-agent Architecture** - Sequential turn-based multiagent *(NEW!)*

## Casino Features (Fully Implemented!) 🎰

HyperToken Blackjack now includes a complete casino experience with all advanced play options:

### 💎 Double Down
Double your bet and receive exactly one more card, then automatically stand:
```javascript
// In CLI: Press 'd' when you have exactly 2 cards
game.doubleDown();

// The implementation:
// 1. Doubles the current bet
// 2. Draws exactly one card
// 3. Automatically stands
// 4. Resolves with doubled payout
```

### ✂️ Split
When you have two cards of the same rank, split them into two separate hands:
```javascript
// In CLI: Press 'l' when you have a matching pair
game.split();

// The implementation:
// 1. Checks for matching card ranks
// 2. Places additional bet equal to original
// 3. Creates separate hand zones
// 4. Deals one card to each hand
// 5. Resolves each hand independently
```

### 🛡️ Insurance
When dealer shows an Ace, take insurance to protect against dealer blackjack:
```javascript
// In CLI: Press 'i' when dealer shows Ace
game.takeInsurance();

// The implementation:
// 1. Allows bet up to half the original wager
// 2. If dealer has blackjack, insurance pays 2:1
// 3. If dealer doesn't have blackjack, insurance bet is lost
// 4. Original hand still resolves normally
```

These features are available in:
- ✅ Single-player CLI (`cli.js`)
- ✅ Multi-agent games (`multiagent-game.js`)
- ✅ Network multiplayer (`client.js` / `server.js`)
- ✅ All game modes with full betting integration

## Performance

On a typical laptop:
- 1,000 rounds: ~1-2 seconds
- 10,000 rounds: ~10-15 seconds
- 100,000 rounds: ~2 minutes

The bottleneck is rule evaluation. For high-performance sims, cache hand values.

## Architecture Notes

This example provides **two complementary implementations**:

### 1. Simple Single-Player (`game.js`)
- **Purpose**: Learning and simple use cases
- **Features**: Single player vs dealer, optional betting
- **Best for**: CLI games, tournaments, AI training
- **Complexity**: Low - direct approach with minimal abstractions

### 2. Advanced Multi-Agent (`multiagent-game.js`)
- **Purpose**: Production-ready multi-player games
- **Features**: 2-6 agents, networking, CRDT state sync
- **Best for**: Multiplayer games, networked play, complex scenarios
- **Complexity**: Higher - uses full Engine/Agent/CRDT architecture

Choose the right one for your needs:
- **Learning HyperToken?** Start with `game.js`
- **Building a multiplayer game?** Use `multiagent-game.js`
- **Just want to play?** Use `cli.js` or `multiagent-cli.js`

## Future Enhancements

### Planned Features

- **Web UI** - Canvas-based visualization with interactive controls
- **AI Training** - Reinforcement learning integration (partial support via `BlackjackEnv.ts`)
- **Tournament Modes** - Elimination, sit-and-go formats
- **Surrender** - Early surrender and late surrender options

### Community Contributions Welcome

- Side bets (pairs, 21+3, perfect pairs)
- Mobile/web clients using the network server
- Re-splitting support (split again after initial split)
- European blackjack variant (dealer doesn't check for blackjack)
- Additional betting strategies (e.g., Labouchere, D'Alembert)
- More card counting systems (e.g., Wong Halves, Red Seven)

## License

Same as HyperToken (Apache 2.0)

---

**HyperToken Blackjack** - A complete **casino-grade** blackjack simulation with Double Down, Split, and Insurance. Showcases token-based game design, AI agents, betting systems, card counting, and multiagent architecture.