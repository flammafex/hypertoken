# Coup

A bluffing and deception card game where players claim to have role cards to take powerful actions. Challenge lies—but if you're wrong, you lose influence!

## Overview

Each player has 2 hidden role cards. On your turn, claim any role's action—even if you don't have it. Other players can challenge your claim. Last player with influence wins.

## Quick Start

```typescript
import { CoupGame } from './CoupGame.js';

// Create 4-player game
const game = new CoupGame({ numPlayers: 4 });

// Get valid actions
const actions = game.getValidActions(0);
// => ['income', 'foreign_aid', 'tax', 'steal:1', 'steal:2', ...]

// Claim Duke and take 3 coins
game.action(0, 'tax');

// Another player challenges
game.action(1, 'challenge');
```

## Roles

| Role | Action | Effect | Can Block |
|------|--------|--------|-----------|
| Duke | Tax | Take 3 coins | Foreign Aid |
| Assassin | Assassinate | Pay 3, target loses influence | - |
| Captain | Steal | Take 2 coins from target | Stealing |
| Ambassador | Exchange | Draw 2, keep what you want | Stealing |
| Contessa | - | - | Assassination |

## Actions

| Action | Cost | Blockable | Challengeable |
|--------|------|-----------|---------------|
| Income | - | No | No |
| Foreign Aid | - | Duke | No |
| Coup | 7 coins | No | No |
| Tax | - | No | Yes (Duke) |
| Assassinate | 3 coins | Contessa | Yes (Assassin) |
| Steal | - | Captain/Ambassador | Yes (Captain) |
| Exchange | - | No | Yes (Ambassador) |

## Game Flow

```
Action Phase → Challenge? → Block? → Block Challenge? → Resolution
     ↓             ↓           ↓            ↓
  Player       Challenger   Target     Challenger
  claims       doubts the   claims     doubts the
  a role       claim        a role     block
```

## Game Phases

- **action:** Current player chooses action
- **challenge:** Others can challenge the action claim
- **block:** Target can attempt to block
- **block_challenge:** Others can challenge the block
- **lose_influence:** Player chooses card to reveal/lose
- **exchange:** Ambassador choosing cards to keep

## Configuration

```typescript
const game = new CoupGame({
  numPlayers: 4,  // 2-6 players
  seed: 12345     // For reproducible games
});
```

## AEC Interface (Reinforcement Learning)

This example includes an Agent-Environment Cycle wrapper for RL training:

```typescript
import { CoupAEC } from './CoupAEC.js';

const env = new CoupAEC({ numPlayers: 4 });
env.reset();

while (!env.isTerminated()) {
  const obs = env.observe();
  const actions = env.getValidActions();
  const action = selectAction(obs, actions);
  const { reward, terminated } = env.step(action);
}
```

### Observation Space

```typescript
{
  myCards: ['duke', 'captain'],  // Your hidden cards
  myCoins: 5,
  opponents: [
    { coins: 3, cardCount: 2, revealedCards: [] },
    { coins: 7, cardCount: 1, revealedCards: ['contessa'] }
  ],
  phase: 'action',
  pendingAction: null
}
```

### Action Space

- `income` - Take 1 coin (safe, no bluff)
- `foreign_aid` - Take 2 coins (blockable by Duke)
- `coup:X` - Pay 7, force player X to lose influence
- `tax` - Claim Duke, take 3 coins
- `steal:X` - Claim Captain, take 2 from player X
- `assassinate:X` - Claim Assassin, pay 3, target loses influence
- `exchange` - Claim Ambassador, swap cards
- `challenge` - Challenge current claim
- `pass` - Allow action/block to proceed
- `block:ROLE` - Block with claimed role
- `lose:INDEX` - Choose which card to lose

## What You'll Learn

- **Bluffing games:** Actions based on claims, not facts
- **Multi-phase turns:** Challenge/block chains
- **Social deduction:** Reading opponent behavior
- **AEC pattern:** Standard interface for RL agents

## Files

```
coup/
├── CoupGame.ts   # Core game logic
├── CoupAEC.ts    # RL environment wrapper
└── index.ts      # Exports
```

## Strategy Tips

- **Income is safe:** No bluffing risk when you need coins
- **Track revealed cards:** Know what roles are gone
- **Coup at 7:** Don't give opponents time to act
- **Bluff consistently:** If you claim Duke once, claim it again
- **Challenge suspicious plays:** Especially late game
