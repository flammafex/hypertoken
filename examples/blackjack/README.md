<div align=center><img src="fine.png" width=256 height=200></div>
# HyperToken Blackjack

A complete implementation of Blackjack using the HyperToken engine, demonstrating:
- Token-based card representation
- Rule engine for game logic
- Deterministic simulation with seedable RNG
- AI agents with different strategies
- Event-driven architecture

## Quick Start

### Play Interactively

```bash
node cli.js
```

Play blackjack in your terminal against the dealer. Standard rules apply:
- Dealer hits on 16 or less
- Dealer stands on 17 or more
- Blackjack pays 3:2

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

## Project Structure

```
blackjack/
├── token-sets/
│   └── standard-deck.json      # 52-card deck definition
├── agents/
│   ├── basic-strategy.js       # AI agent implementations
│   └── tournament.js           # AI vs AI simulation
├── blackjack-utils.js          # Hand evaluation utilities
├── blackjack-rules.js          # RuleEngine rules
├── game.js                     # Main game implementation
├── cli.js                      # Interactive CLI
└── README.md                   # This file
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

2. **Deal Phase**
   - 2 cards to player (both face up)
   - 2 cards to dealer (one face down)
   - Check for immediate blackjack

3. **Player Turn**
   - Hit or Stand
   - Automatic bust detection via RuleEngine

4. **Dealer Turn**
   - Reveal hidden card
   - Auto-play using rules (hit on 16, stand on 17)

5. **Resolution**
   - Compare hands
   - Determine winner
   - Calculate payouts

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

### 1. Action Registry Extension

```javascript
// Add game-specific actions to engine
Object.assign(ActionRegistry, {
  "blackjack:deal": (engine) => {
    // Deal cards, setup zones
  },
  "blackjack:hit": (engine) => {
    // Draw and place card
  }
});
```

### 2. State Tracking

```javascript
engine._gameState = {
  dealerTurn: false,
  gameOver: false,
  result: null
};
```

### 3. Rule-Driven Automation

Rules check conditions after every action and trigger effects:

```javascript
// Dealer must hit on 16 or less
ruleEngine.addRule(
  "dealer-must-hit",
  (engine) => {
    const value = getBestHandValue(dealerCards);
    return value < 17 && engine._gameState.dealerTurn;
  },
  (engine) => engine.dispatch("blackjack:dealer-hit", {})
);
```

### 4. AI Agent Interface

```javascript
class BasicStrategyAgent {
  decide(gameState) {
    // Analyze state, return "hit" or "stand"
    if (playerValue >= 17) return "stand";
    // ... strategy logic
  }
}
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

### Patterns You Can Reuse

1. **Token Design** - How to structure card metadata
2. **Action Definition** - Extending the engine with domain actions
3. **Rule Creation** - Using conditions and effects for game logic
4. **Agent Interface** - Building AI that plays your game
5. **CLI Integration** - Making your simulation interactive
6. **Tournament Mode** - Running bulk simulations for analysis

## Extending This Example

### Add Double Down

```javascript
ActionRegistry["blackjack:double"] = (engine, payload) => {
  const card = engine.shoe.draw();
  engine.table.place("player-hand", card, { faceUp: true });
  engine._gameState.bet *= 2;
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

## Next Steps

1. **Add betting** - Track chips and implement bet sizes
2. **Multi-player** - Support multiple players at the table
3. **Card counting** - Implement Hi-Lo counting agent
4. **Visualize** - Create web UI with canvas rendering
5. **Network play** - Use RelayServer for online multiplayer

## License

Same as HyperToken (Apache 2.0)