# Liar's Dice

A classic bluffing game where players make increasingly bold claims about hidden dice. Also known as Perudo or Dudo.

## Overview

Players hide dice under cups and bid on how many dice of a certain face value exist across ALL players' dice. Call "Liar!" to challenge a bid you think is false—but if you're wrong, you lose a die!

## Quick Start

```typescript
import { LiarsDiceGame } from './LiarsDiceGame.js';

// Create 4-player game
const game = new LiarsDiceGame({ numPlayers: 4, startingDice: 5 });

// Get current state
const state = game.getState();

// Get valid actions
const actions = game.getValidActions(0);
// => ['bid:3:4', 'bid:3:5', 'bid:3:6', 'bid:4:2', 'liar']

// Make a bid: "There are at least 3 fours"
game.action(0, 'bid:3:4');

// Challenge previous bid
game.action(1, 'liar');
```

## Rules

1. **Setup:** Each player starts with 5 dice, rolled secretly
2. **Bidding:** "There are at least X dice showing Y across all players"
3. **Bids must increase:** Higher quantity OR same quantity + higher face
4. **Ones are wild:** Count as any face value (2-6)
5. **Challenge:** Call "Liar!" to challenge the previous bid
6. **Resolution:**
   - If bid was false: Bidder loses 1 die
   - If bid was true: Challenger loses 1 die
7. **Elimination:** Player with 0 dice is out
8. **Victory:** Last player with dice wins

## Game Phases

```
bid → bid → bid → "liar!" → resolve → new round
                    ↓
              Count all dice
              Loser removes die
```

## Configuration

```typescript
const game = new LiarsDiceGame({
  numPlayers: 4,      // 2-6 players
  startingDice: 5,    // Dice per player
  seed: 12345         // For reproducible games
});
```

## AEC Interface (Reinforcement Learning)

This example includes an Agent-Environment Cycle wrapper for RL training:

```typescript
import { LiarsDiceAEC } from './LiarsDiceAEC.js';

const env = new LiarsDiceAEC({ numPlayers: 3 });
env.reset();

while (!env.isTerminated()) {
  const obs = env.observe();           // Current player's view
  const actions = env.getValidActions();
  const action = selectAction(obs, actions);  // Your policy
  const { reward, terminated } = env.step(action);
}
```

### Observation Space

```typescript
{
  myDice: [1, 3, 3, 5, 6],     // Your hidden dice
  myDiceCount: 5,
  currentBid: { quantity: 3, face: 4 },
  totalDiceRemaining: 15,      // Sum of all players' dice
  opponentDiceCounts: [5, 5],  // How many dice others have
  amIBidder: false
}
```

### Action Space

- `bid:Q:F` - Bid Q dice showing face F
- `liar` - Challenge the current bid

## What You'll Learn

- **Hidden information games:** Players have private state
- **Bluffing mechanics:** Probability vs. psychology
- **Multi-agent environments:** Turn-based with elimination
- **AEC pattern:** Standard interface for RL agents

## Files

```
liars-dice/
├── LiarsDiceGame.ts   # Core game logic
├── LiarsDiceAEC.ts    # RL environment wrapper
└── index.ts           # Exports
```

## Strategy Tips

- **Count known dice:** Use your own dice to estimate probabilities
- **Bid conservatively early:** Preserve dice for later rounds
- **Bluff on wildcards:** 1s make bids more plausible
- **Watch opponent patterns:** Some players always bluff high
