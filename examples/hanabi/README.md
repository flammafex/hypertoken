# HyperToken Hanabi Environment

Cooperative card game for multi-agent reinforcement learning. Players work together to build firework stacks but cannot see their own cards—only what others hold.

## Why Hanabi for RL Research?

Hanabi is a benchmark for:
- **Theory of Mind**: Understanding what other agents know
- **Cooperative MARL**: All agents share the same goal
- **Imperfect Information**: Can't see your own cards
- **Communication Constraints**: Limited hint tokens

Key papers: [Hanabi Challenge (Bard et al., 2019)](https://arxiv.org/abs/1902.00506), [Other-Play (Hu et al., 2020)](https://arxiv.org/abs/2003.02979)

## Quick Start

### Start Bridge Server

```bash
# 2 players (default)
hypertoken bridge hanabi

# 3-5 players
hypertoken bridge hanabi --players 4
```

### Connect from Python

```python
import websocket
import json

ws = websocket.create_connection("ws://localhost:9999")

# Get environment info
ws.send(json.dumps({"cmd": "env_info"}))
info = json.loads(ws.recv())
print(f"Players: {info['possible_agents']}")
print(f"Obs shape: {info['observation_spaces']['player_0']['shape']}")

# Reset
ws.send(json.dumps({"cmd": "reset"}))
ws.recv()

# Game loop
while True:
    ws.send(json.dumps({"cmd": "agent_selection"}))
    agent = json.loads(ws.recv())["agent"]

    ws.send(json.dumps({"cmd": "action_mask", "agent": agent}))
    mask = json.loads(ws.recv())["mask"]

    # Choose valid action
    valid = [i for i, v in enumerate(mask) if v]
    action = random.choice(valid)

    ws.send(json.dumps({"cmd": "step", "action": action}))
    ws.recv()

    ws.send(json.dumps({"cmd": "terminations"}))
    if json.loads(ws.recv())["terminations"][agent]:
        break

ws.send(json.dumps({"cmd": "infos"}))
print(f"Final score: {json.loads(ws.recv())['infos']['player_0']['score']}")
```

## Game Rules

- **Players**: 2-5 (hand size: 5 cards for 2-3 players, 4 cards for 4-5)
- **Deck**: 5 colors × 5 numbers (50 cards total)
  - Three 1s, two 2s/3s/4s, one 5 per color
- **Goal**: Build 5 firework stacks (one per color) from 1→5
- **Max Score**: 25 (all stacks complete)

### Tokens
- **Information tokens**: 8 (spend to give hints, recover on discard or completing a 5)
- **Life tokens**: 3 (lose one on misplay, game over at 0)

### Actions
1. **Play**: Place a card on a firework stack
   - Success: Card matches (stack value + 1)
   - Failure: Lose a life, card discarded
2. **Discard**: Remove a card, gain 1 info token
3. **Hint**: Tell another player about their cards
   - Costs 1 info token
   - Must indicate ALL cards of one color OR one number

### Game End
- Perfect score (25) - Win!
- Lose all 3 lives - Lose
- Deck empty + one round - Final score

## Observation Space

The observation encodes everything a player can see:

| Feature Group | Size | Description |
|--------------|------|-------------|
| My card knowledge | handSize × 10 | Color/number hints for own cards |
| Other hands | (players-1) × handSize × 10 | Visible cards of other players |
| Fireworks | 5 × 6 | Stack state per color (one-hot 0-5) |
| Info tokens | 9 | One-hot encoding (0-8) |
| Life tokens | 4 | One-hot encoding (0-3) |
| Deck size | 1 | Normalized (0-1) |
| Current player | players | One-hot |
| Discard pile | 25 | Count per color/number |

Total observation size: ~158 features (2 players) to ~208 features (5 players)

## Action Space

Actions are encoded as integers:

| Range | Action Type |
|-------|-------------|
| 0 to handSize-1 | Play card at position |
| handSize to 2×handSize-1 | Discard card at position |
| 2×handSize onwards | Give hint (color/number to player) |

Total actions: 20 (2 players) to 50 (5 players)

## Cooperative Rewards

All players receive the same reward:
- **+1** for each successful play (score increases)
- **0** otherwise

Final score ranges from 0-25. Scores:
- 0-5: Horrible
- 6-10: Poor
- 11-15: Decent
- 16-20: Good
- 21-24: Excellent
- 25: Perfect!

## Configuration Options

```bash
hypertoken bridge hanabi [options]

Options:
  -n, --players <num>   Number of players (2-5, default: 2)
  -s, --seed <num>      Random seed for reproducibility
  -p, --port <port>     Server port (default: 9999)
```

## Research Directions

1. **Ad-hoc teamplay**: Train agents that cooperate with unseen partners
2. **Convention learning**: Discover implicit signaling strategies
3. **Theory of mind**: Model what teammates know vs. don't know
4. **Population-based training**: Self-play with diverse partners

## Module Exports

```typescript
import {
  // Core game
  HanabiGame, HanabiConfig, HanabiGameState,
  HanabiCard, HanabiAction, CardKnowledge,

  // Environment
  HanabiAEC, HanabiAECConfig,

  // Action encoding
  encodeAction, decodeAction, getActionSpaceSize,

  // Constants
  COLORS, NUMBERS,
} from "./examples/hanabi/index.js";
```

## Comparison with Existing Implementations

| Feature | HyperToken | PettingZoo | Hanabi Learning Env |
|---------|------------|------------|---------------------|
| Language | TypeScript | Python | C++ / Python |
| WebSocket API | ✅ | ❌ | ❌ |
| Configurable players | 2-5 | 2-5 | 2-5 |
| Observation encoding | Flexible | Fixed | Fixed |
| Easy deployment | ✅ | ❌ | ❌ |
