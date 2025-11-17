<div align=center><img src="fine.png" width=256 height=200></div>

# HyperToken Blackjack

A complete implementation of Blackjack using the HyperToken engine, demonstrating:
- Token-based card representation
- Rule engine for game logic
- Deterministic simulation with seedable RNG
- AI agents with different strategies
- Event-driven architecture
- **💰 Comprehensive betting system with bankroll management**
- **📊 Card counting agents using Hi-Lo system**
- **👥 Multi-player support (2-6 players at one table)**

## Quick Start

### Play Single-Player Blackjack
```bash
node cli.js
```

Play blackjack in your terminal against the dealer. Standard rules apply:
- Dealer hits on 16 or less
- Dealer stands on 17 or more
- Blackjack pays 3:2

### Play with Betting System
```bash
node cli-with-betting.js
```

Play with full money management:
- Set your starting bankroll
- Place bets each round
- Track session statistics
- See your profit/loss in real-time

### Play Multi-player (2-6 players)
```bash
node multiplayer-cli.js
```

Play blackjack with multiple human players at one table:
- Each player has their own bankroll
- Sequential turn-taking
- Individual betting
- Shared dealer

### Run AI Tournament
```bash
# Run 1000 rounds with default agents
node agents/tournament.js

# Run 5000 rounds with specific seed
node agents/tournament.js 5000 42

# Arguments: [rounds] [seed]
```

Watch different AI strategies compete:
- **Basic Strategy**: Follows simplified basic strategy rules
- **Conservative**: Stands on 17+
- **Aggressive**: Stands on 19+
- **Always Hit**: Hits until bust (for comparison)

### Run Betting Strategy Tournament
```bash
node tournament-with-betting.js
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
├── game.js                         # Main game implementation
├── game-with-betting.js            # Game with betting integration
├── blackjack-betting.js            # Betting system (NEW!)
├── card-counting-agents.js         # Hi-Lo card counting (NEW!)
├── multiplayer-game.js             # Multi-player support (NEW!)
├── multiplayer-cli.js              # Multi-player CLI (NEW!)
├── cli.js                          # Interactive CLI
├── cli-with-betting.js             # CLI with betting (NEW!)
├── tournament-with-betting.js      # Betting strategy tournament (NEW!)
└── README.md                       # This file
```

## New Features

### ✅ Phase 1: Betting System

Complete bankroll and chip management:

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

**Usage:**
```javascript
import { BettingManager } from './blackjack-betting.js';

const betting = new BettingManager(1000, { minBet: 5, maxBet: 500 });
betting.placeBet(25);
const payout = betting.resolveBet('player'); // Win!
console.log(betting.getStats());
```

### ✅ Phase 2: Card Counting Agents

Hi-Lo card counting system with bet spread adjustment:

**Features:**
- Running count tracking
- True count calculation (accounts for decks remaining)
- Automatic bet sizing based on advantage
- Strategy deviations at key counts
- Multiple counting styles (aggressive, conservative, wonging)

**Agents:**
- **HiLoCountingAgent**: Standard 1-8x bet spread
- **AggressiveCountingAgent**: Wide 1-12x bet spread
- **ConservativeCountingAgent**: Small 1-4x bet spread

**Usage:**
```javascript
import { HiLoCountingAgent } from './card-counting-agents.js';

const counter = new HiLoCountingAgent("Card Counter", 10, 8);
const betSize = counter.getBetSize(gameState, bettingManager);
const decision = counter.decide(gameState);
console.log(counter.getCountStats()); // { runningCount, trueCount, ... }
```

### ✅ Phase 3: Multi-player Support

Play with 2-6 players at a single table:

**Features:**
- Support for 2-6 players
- Individual bankrolls and betting
- Sequential turn-taking
- Automatic dealer play after all players finish
- Per-player statistics

**Usage:**
```javascript
import { MultiplayerBlackjackGame } from './multiplayer-game.js';

const game = new MultiplayerBlackjackGame({
  numPlayers: 3,
  playerNames: ['Alice', 'Bob', 'Carol'],
  initialBankroll: 1000
});

game.collectBets([10, 25, 50]); // Each player's bet
game.deal();
game.hit();  // Current player hits
game.stand(); // Current player stands
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
   - Create Shoe with 6 decks (standard casino rules)
   - Shuffle with optional seed for deterministic play
   - Setup Table with player/dealer zones
   - Initialize betting managers for each player

2. **Betting Phase** *(NEW!)*
   - Players place bets within min/max limits
   - Card counting agents adjust bet sizes based on count

3. **Deal Phase**
   - 2 cards to each player (both face up)
   - 2 cards to dealer (one face down)
   - Check for immediate blackjack

4. **Player Turns** *(Sequential in multi-player)*
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
// Auto-check for player bust after hit
ruleEngine.addRule(
  "player-bust-check",
  (engine, lastAction) => {
    if (lastAction.type !== "blackjack:hit") return false;
    const cards = engine.table.zone("player-hand").map(p => p.card);
    return isBusted(cards);
  },
  (engine) => {
    engine.dispatch("blackjack:player-busted", {});
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
console.log(counter.trueCount); // +2 (player has advantage)
```

### 3. Multi-player Management
```javascript
// Players take turns sequentially
while (!gameState.allPlayersFinished) {
  const currentPlayer = game.getCurrentPlayer();
  // Current player makes decision
  game.hit(); // or game.stand()
}
// Dealer plays automatically after all players finish
```

## What This Demonstrates

### Core HyperToken Features Used

✅ **Deck/Shoe/Table** - Token container primitives  
✅ **Engine** - Event-driven state machine  
✅ **ActionRegistry** - Extensible action system  
✅ **RuleEngine** - Declarative game logic  
✅ **Determinism** - Seedable shuffle for replay  
✅ **Serialization** - Game state can be saved/loaded  
✅ **Events** - Observable state transitions  
✅ **Betting Actions** - Money management primitives *(NEW!)*  
✅ **Multi-player Zones** - Per-player token containers *(NEW!)*  

### Patterns You Can Reuse

1. **Token Design** - How to structure card metadata
2. **Action Definition** - Extending the engine with domain actions
3. **Rule Creation** - Using conditions and effects for game logic
4. **Agent Interface** - Building AI that plays your game
5. **CLI Integration** - Making your simulation interactive
6. **Tournament Mode** - Running bulk simulations for analysis
7. **Betting Systems** - Money management and bankroll tracking *(NEW!)*
8. **Card Counting** - Adaptive strategy based on game state *(NEW!)*
9. **Multi-player Architecture** - Sequential turn-based multiplayer *(NEW!)*

## Extending This Example

### Add Double Down
```javascript
ActionRegistry["blackjack:double"] = (engine, payload) => {
  const card = engine.shoe.draw();
  engine.table.place("player-hand", card, { faceUp: true });
  engine._bettingManager.currentBet *= 2;
  engine.dispatch("blackjack:stand");
};
```

### Add Splitting Pairs
```javascript
ActionRegistry["blackjack:split"] = (engine) => {
  const playerHand = engine.table.zone("player-hand");
  const [card1, card2] = playerHand.splice(0, 2);
  
  engine.table.createZone("player-hand-2");
  engine.table.place("player-hand", card1.card);
  engine.table.place("player-hand-2", card2.card);
  
  engine._gameState.splitHand = true;
};
```

### Add Insurance
```javascript
ruleEngine.addRule(
  "offer-insurance",
  (engine) => {
    const dealerUpCard = engine.table.zone("dealer-hand")[1].card;
    return dealerUpCard.label === "A";
  },
  (engine) => {
    engine.dispatch("blackjack:insurance-offered", {});
  }
);
```

## Performance

On a typical laptop:
- 1,000 rounds: ~1-2 seconds
- 10,000 rounds: ~10-15 seconds
- 100,000 rounds: ~2 minutes

The bottleneck is rule evaluation. For high-performance sims, cache hand values.

## Future Enhancements

### Planned Features

4. **Visualize** - Create web UI with canvas rendering
5. **Network play** - Use RelayServer for online multiplayer

### Community Contributions Welcome

- Additional betting strategies (Kelly Criterion, Oscar's Grind)
- More card counting systems (Hi-Opt, Omega II, Zen Count)
- Advanced play options (surrender, insurance)
- Side bets (pairs, 21+3, perfect pairs)
- Tournament formats (elimination, sit-and-go)

## License

Same as HyperToken (Apache 2.0)

---

**HyperToken Blackjack** - A complete, extensible blackjack simulation showcasing token-based game design, AI agents, betting systems, card counting, and multiplayer architecture.