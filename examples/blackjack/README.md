<div align=center><img src="fine.png" width=256 height=200></div>

# HyperToken Blackjack

A complete **casino-grade** Blackjack implementation using the HyperToken engine, featuring:
- Token-based card representation
- Rule engine for game logic
- Deterministic simulation with seedable RNG
- AI agents with different strategies
- Event-driven architecture
- **🌐 Browser-based Web UI with PWA support**
- **💰 Comprehensive betting system with 6 betting strategies**
- **🎰 Full casino features: Double Down, Split, Insurance, Re-Split, Early & Late Surrender**
- **🎲 Side bets: Perfect Pairs, 21+3, Lucky Ladies, Buster Blackjack**
- **🇪🇺 European blackjack variant with delayed hole card**
- **📊 Card counting agents: Hi-Lo, Hi-Opt I, Omega II, Zen Count**
- **👥 Multi-agent support (2-6 agents at one space)**
- **🤖 OpenAI Gym-compatible RL training environment**

## Quick Start

**Note**: Run examples from the `examples/blackjack` directory with the TypeScript loader:

```bash
cd examples/blackjack
node --loader ../../test/ts-esm-loader.js <command>
```

### Play in Browser (Web UI)
```bash
# Build the web bundle (if not already built)
node web/build.js

# Serve the web directory (use any static server)
npx serve web
# or
python3 -m http.server 8000 --directory web
```

Open `http://localhost:8000` (or the serve URL) in your browser to play!

**Web UI Features:**
- Full casino experience with animated cards and sound effects
- 4 side bets: Perfect Pairs, 21+3, Lucky Ladies, Buster Blackjack
- Multiple betting strategies (Manual, Flat, Martingale, Progressive, Percentage)
- Configurable house rules (dealer hits soft 17, late surrender, re-split aces)
- American and European variants
- Hi-Lo card counting display
- Session statistics tracking
- PWA support (installable, works offline)
- Keyboard shortcuts (H=Hit, S=Stand, D=Double, P=Split, R=Surrender)

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
├── web/                            # Browser-based Web UI
│   ├── index.html                  # Main HTML page
│   ├── blackjack-web.js            # Web UI JavaScript
│   ├── styles.css                  # Styling
│   ├── build.js                    # Bundle build script
│   ├── BlackjackGame.bundle.js     # Bundled game logic
│   ├── cards-sprite.webp           # Card sprite sheet
│   ├── manifest.json               # PWA manifest
│   ├── sw.js                       # Service worker for offline
│   └── icons/                      # PWA icons (72-512px)
├── blackjack-utils.js              # Hand evaluation utilities
├── blackjack-rules.js              # RuleEngine rules
├── game.js                         # Single-player game (simple)
├── multiagent-game.js              # Multi-agent game (advanced)
├── blackjack-betting.js            # Betting system & strategies
├── blackjack-game-browser.js       # Browser-compatible game wrapper
├── side-bets.js                    # Side bet logic (Perfect Pairs, 21+3, etc.)
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
✅ **Betting Actions** - Money management primitives
✅ **Multi-agent Zones** - Per-agent token containers
✅ **Browser Bundling** - Web UI with PWA support  

### Patterns You Can Reuse

1. **Token Design** - How to structure card metadata
2. **Action Definition** - Extending the engine with domain actions
3. **Rule Creation** - Using conditions and effects for game logic
4. **Agent Interface** - Building AI that plays your game
5. **CLI Integration** - Making your simulation interactive
6. **Tournament Mode** - Running bulk simulations for analysis
7. **Betting Systems** - Money management and bankroll tracking
8. **Card Counting** - Adaptive strategy based on game state
9. **Multi-agent Architecture** - Sequential turn-based multiagent
10. **Web UI** - Browser bundling and PWA integration
11. **Side Bets** - Extensible bonus bet system
12. **Gym Environment** - OpenAI Gym-compatible RL training

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

### 🎰 Side Bets
Optional side bets add extra excitement and payout opportunities:

**Perfect Pairs** - Bet on whether your first two cards will be a pair:
```javascript
game.placePerfectPairsBet(10); // Place $10 side bet
game.deal();
const sideBetResults = game.resolveSideBets();

// Payouts:
// - Mixed Pair (different colors): 5:1
// - Colored Pair (same color, different suits): 10:1
// - Perfect Pair (same suit): 30:1
```

**21+3** - Bet on a 3-card poker hand (your 2 cards + dealer's up card):
```javascript
game.place21Plus3Bet(10); // Place $10 side bet
game.deal();
const sideBetResults = game.resolveSideBets();

// Payouts:
// - Flush: 5:1
// - Straight: 10:1
// - Three of a Kind: 30:1
// - Straight Flush: 40:1
// - Suited Three of a Kind: 100:1
```

**Lucky Ladies** - Bet on your first two cards totaling 20:
```javascript
game.placeLuckyLadiesBet(10); // Place $10 side bet
game.deal();
// Resolved after hand ends (needs to check for dealer blackjack)
const results = game.resolveDealerDependentSideBets();

// Payouts:
// - Any 20: 4:1
// - Suited 20: 9:1
// - Matched 20 (same rank & suit): 19:1
// - Queen of Hearts Pair: 125:1
// - Q♥ Pair + Dealer Blackjack: 1000:1
```

**Buster Blackjack** - Bet on the dealer busting:
```javascript
game.placeBusterBlackjackBet(10); // Place $10 side bet
game.deal();
// Resolved after dealer plays
const results = game.resolveDealerDependentSideBets();

// Payouts:
// - 3-card bust: 2:1
// - 4-card bust: 4:1
// - 5-card bust: 12:1
// - 6-card bust: 50:1
// - 7-card bust: 100:1
// - 8+ card bust: 250:1
```

### ♻️ Re-Splitting
Split again when you receive another matching card:
```javascript
// Initial split
game.split(); // Split first pair

// If you get another pair on one of the split hands
game.reSplit(0); // Re-split hand #0

// Maximum 4 hands total
// Each hand requires an additional bet equal to the original wager
```

### 🏳️ Early Surrender
Surrender before the dealer checks for blackjack - more favorable to the player:
```javascript
const game = new BlackjackGame({ allowEarlySurrender: true });
game.deal();

// Can surrender immediately after deal, before any other action
if (gameState.canEarlySurrender) {
  game.earlySurrender();  // Forfeit half bet, hand ends immediately
}

// Key differences from late surrender:
// - Available BEFORE dealer checks for blackjack
// - Can surrender even when dealer shows Ace or 10 (might have BJ)
// - More player-favorable (reduces house edge by ~0.39%)
// - Must be used immediately after deal, before hit/stand/double/split
```

### 🏳️ Late Surrender
Surrender after the dealer checks for blackjack:
```javascript
const game = new BlackjackGame({ allowLateSurrender: true });
game.deal();

// Late surrender available after insurance phase
if (gameState.canSurrender) {
  game.surrender();  // Forfeit half bet
}

// Key differences from early surrender:
// - Available AFTER dealer checks for blackjack
// - If dealer has blackjack, player loses full bet (no surrender option)
// - Less favorable than early surrender but still useful
```

### 🇪🇺 European Blackjack Variant
Play European-style blackjack with different dealer card rules:
```javascript
const game = new BlackjackGame({ variant: 'european' });

// Key differences from American blackjack:
// - Dealer receives only 1 card initially (face up)
// - Dealer's hole card dealt AFTER all players finish
// - No insurance available (dealer doesn't show potential blackjack early)
// - If dealer gets blackjack, all double/split bets are lost
```

## Performance

On a typical laptop:
- 1,000 rounds: ~1-2 seconds
- 10,000 rounds: ~10-15 seconds
- 100,000 rounds: ~2 minutes

The bottleneck is rule evaluation. For high-performance sims, cache hand values.

## Architecture Notes

This example provides **three complementary implementations**:

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

### 3. Web UI (`web/`)
- **Purpose**: Browser-based play experience
- **Features**: Full casino experience, all side bets, PWA support, sound effects
- **Best for**: End users, demos, playing without setup
- **Complexity**: Medium - uses bundled game logic with vanilla JS UI

Choose the right one for your needs:
- **Learning HyperToken?** Start with `game.js`
- **Building a multiplayer game?** Use `multiagent-game.js`
- **Just want to play?** Use `cli.js`, `multiagent-cli.js`, or the Web UI

## Reinforcement Learning Training

The `BlackjackEnv.ts` provides a full **OpenAI Gym-compatible** environment for training RL agents.

### Quick Start

```bash
# Run with basic strategy policy (100 episodes)
node --loader ../../test/ts-esm-loader.js train.js

# Run 1000 episodes with verbose output
node --loader ../../test/ts-esm-loader.js train.js -e 1000 -v

# Compare random vs basic strategy
node --loader ../../test/ts-esm-loader.js train.js -p random -e 500
```

### Action Space (6 Discrete Actions)

| Action | ID | Description |
|--------|-----|-------------|
| Hit | 0 | Take another card |
| Stand | 1 | Keep current hand |
| Double | 2 | Double bet, take one card |
| Split | 3 | Split pair into two hands |
| Surrender | 4 | Forfeit half bet |
| Insurance | 5 | Side bet on dealer blackjack |

### Observation Space (19 Features)

```javascript
import { BlackjackEnv, Actions, ObsIndex } from "./BlackjackEnv.js";

const env = new BlackjackEnv({
  agentName: "RLAgent",
  initialBankroll: 1000,
  numDecks: 6,
  baseBet: 10,
  allowSurrender: true
});

// Observation features (all normalized 0-1):
// obs[ObsIndex.HAND_VALUE]       - Player hand value (0-30)
// obs[ObsIndex.DEALER_VALUE]     - Dealer visible card (0-12)
// obs[ObsIndex.IS_SOFT]          - Is soft hand (Ace as 11)
// obs[ObsIndex.DECK_PENETRATION] - Cards remaining in shoe
// obs[ObsIndex.CURRENT_BET]      - Current bet amount
// obs[ObsIndex.BANKROLL]         - Player bankroll
// obs[ObsIndex.CAN_HIT]          - Can hit action
// obs[ObsIndex.CAN_STAND]        - Can stand action
// obs[ObsIndex.CAN_DOUBLE]       - Can double down
// obs[ObsIndex.CAN_SPLIT]        - Can split pair
// obs[ObsIndex.CAN_SURRENDER]    - Can surrender
// obs[ObsIndex.CAN_INSURANCE]    - Can take insurance
// obs[ObsIndex.IS_SPLIT_HAND]    - Playing split hand
// obs[ObsIndex.SPLIT_HAND_VALUE] - Split hand value
// obs[ObsIndex.RUNNING_COUNT]    - Hi-Lo running count
// obs[ObsIndex.TRUE_COUNT]       - True count (adjusted for decks)
// obs[ObsIndex.DEALER_SHOWS_ACE] - Dealer shows Ace
// obs[ObsIndex.HAND_IS_BLACKJACK]- Player has blackjack
// obs[ObsIndex.NUM_CARDS_IN_HAND]- Number of cards in hand
```

### Action Masking

The environment provides action masking to prevent invalid actions:

```javascript
const obs = await env.reset();
const actionMask = env.getActionMask();

// actionMask = [true, true, true, false, true, false]
//               Hit   Stand Double Split  Surr  Ins

// Only select from valid actions
const validActions = actionMask
  .map((valid, i) => valid ? i : -1)
  .filter(i => i >= 0);

const action = validActions[Math.floor(Math.random() * validActions.length)];
const result = await env.step(action);
```

### Card Counting Features

The environment includes Hi-Lo card counting:

```javascript
// Observation includes count info
const rc = obs[ObsIndex.RUNNING_COUNT] * 40 - 20; // Denormalize: -20 to +20
const tc = obs[ObsIndex.TRUE_COUNT] * 20 - 10;    // Denormalize: -10 to +10

// True count > +2 favors player (increase bets)
// True count < -2 favors house (decrease bets)
```

## Future Enhancements

### Planned Features

- **Tournament Modes** - Elimination, sit-and-go formats

### Community Contributions Welcome

- Additional betting strategies (e.g., Labouchere, D'Alembert, Fibonacci)
- More card counting systems (e.g., Wong Halves, Red Seven, KO Count)
- Additional side bets (Royal Match, Super Sevens)
- Blackjack tournaments and elimination formats

## License

Same as HyperToken (Apache 2.0)

---

**HyperToken Blackjack** - A complete **casino-grade** blackjack simulation with all major casino features: Double Down, Split, Insurance, Re-Split, Early & Late Surrender, Side Bets (Perfect Pairs, 21+3, Lucky Ladies, Buster Blackjack), and European variant. Includes a full browser-based Web UI with PWA support, AI agents with professional card counting systems, advanced betting strategies, multiagent architecture, and an OpenAI Gym-compatible RL training environment. A comprehensive example of building complex card games with HyperToken.