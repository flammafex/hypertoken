# HyperToken Poker Environment

Heads-up No-Limit Texas Hold'em for reinforcement learning, compatible with PettingZoo AEC interface.

## Quick Start

### Play Locally (Human vs Bot)

```bash
npx ts-node examples/poker/play.ts
```

### Start Bridge Server

```bash
# Basic
hypertoken bridge poker

# Full RL features
hypertoken bridge poker --rich --extended --shaped

# With authentication
hypertoken bridge poker --rich --extended --shaped --token YOUR_SECRET_KEY
```

### Connect from Python

```python
import websocket
import json

# Connect (add ?token=KEY if auth enabled)
ws = websocket.create_connection("ws://localhost:9999")

# Get environment info
ws.send(json.dumps({"cmd": "env_info"}))
info = json.loads(ws.recv())
print(f"Agents: {info['possible_agents']}")
print(f"Obs shape: {info['observation_spaces']['player_0']['shape']}")

# Reset and play
ws.send(json.dumps({"cmd": "reset"}))
ws.recv()

while True:
    # Get current state
    ws.send(json.dumps({"cmd": "agent_selection"}))
    agent = json.loads(ws.recv())["agent"]

    ws.send(json.dumps({"cmd": "action_mask", "agent": agent}))
    mask = json.loads(ws.recv())["mask"]

    ws.send(json.dumps({"cmd": "observe", "agent": agent}))
    obs = json.loads(ws.recv())["observation"]

    # Choose action (random valid)
    valid_actions = [i for i, v in enumerate(mask) if v]
    action = random.choice(valid_actions)

    # Take action
    ws.send(json.dumps({"cmd": "step", "action": action}))
    ws.recv()

    # Check if done
    ws.send(json.dumps({"cmd": "terminations"}))
    terms = json.loads(ws.recv())["terminations"]
    if terms[agent]:
        break
```

## Environment Features

### Observation Space

| Mode | Features | Flag |
|------|----------|------|
| Basic | 20 | (default) |
| Rich | 73 | `--rich` |

**Rich observation features (73 total):**
- Hole cards (14): rank, suit, high card, pair, suited, connected, gap
- Community cards (10): count per street, board pairs, flush draws
- Hand strength (12): current hand rank, kickers, made hand flags
- Drawing potential (8): flush draws, straight draws, outs
- Board texture (8): wetness, high cards, connectedness
- Betting context (16): pot odds, SPR, position, street, bet sizes
- Position & stack (6): button, stack-to-pot ratio, effective stacks

### Action Space

| Mode | Actions | Flag |
|------|---------|------|
| Basic | 6 | (default) |
| Extended | 10 | `--extended` |

**Basic actions:** Fold, Check, Call, Raise ½ Pot, Raise Pot, All-In

**Extended actions:** Fold, Check, Call, Raise ⅓, Raise ½, Raise ⅔, Raise Pot, Raise 1.5x, Raise 2x, All-In

### Reward Shaping

Enable with `--shaped` for intermediate training signals:

- **Fold savings**: Reward for folding when equity < pot odds
- **Pot equity**: Potential-based shaping using hand equity
- **Action quality**: Bonus for +EV decisions

```python
# Access shaped reward breakdown
ws.send(json.dumps({"cmd": "infos"}))
infos = json.loads(ws.recv())["infos"]
shaped = infos["player_0"].get("shapedReward")
# {baseReward: -5, shapedReward: -4.8, components: {foldSavings: 0, potEquity: 0.15, ...}}
```

## Bridge Protocol

All commands use JSON over WebSocket:

| Command | Parameters | Response |
|---------|------------|----------|
| `reset` | `seed?` | `{ok: true}` |
| `step` | `action` | `{ok: true}` |
| `observe` | `agent` | `{observation: [...]}` |
| `agent_selection` | - | `{agent: "player_0"}` |
| `action_mask` | `agent` | `{mask: [true, false, ...]}` |
| `rewards` | - | `{rewards: {player_0: 5, player_1: -5}}` |
| `terminations` | - | `{terminations: {player_0: true, ...}}` |
| `env_info` | - | Full env metadata |
| `ping` | - | `{pong: timestamp}` |

## Deployment

### Docker

```bash
# Build and run
docker compose up poker-bridge -d

# With API token
docker compose run -e HYPERTOKEN_API_KEY=secret poker-bridge
```

### Manual

```bash
npm install && npm run build
hypertoken bridge poker --rich --extended --shaped --port 9999
```

### Behind nginx (TLS)

```nginx
location / {
    proxy_pass http://127.0.0.1:9999;
    proxy_http_version 1.1;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection "upgrade";
    proxy_read_timeout 86400s;
}
```

Connect via: `wss://your-domain.com?token=YOUR_KEY`

## Security Options

```bash
# Require API token
hypertoken bridge poker --token SECRET_KEY
# Or: export HYPERTOKEN_API_KEY=SECRET_KEY

# Limit concurrent connections
hypertoken bridge poker --max-connections 20
```

Built-in protections:
- Rate limiting: 100 messages/second per connection
- Connection limits: Default 10 concurrent
- API token authentication (optional)

## Training Example

See `train-example.ts` for a complete demonstration:

```bash
npx ts-node examples/poker/train-example.ts
```

This shows:
- Single environment with reward shaping
- Vectorized batch training (16 parallel envs)
- Self-play policy evaluation

## Module Exports

```typescript
import {
  // Core game
  PokerGame, PokerAEC, PokerAECConfig,

  // Hand evaluation
  evaluateHand, compareHands, Card, HandRank,

  // RL features
  extractFeatures, getFeatureNames,
  RewardShaper, RewardShapingConfig,

  // Vectorized training
  VectorizedPoker, makeVectorizedPoker,

  // Self-play
  SelfPlayManager, randomPolicy, callStationPolicy,
} from "./examples/poker/index.js";
```

## Game Rules

- Heads-up (2 players) No-Limit Texas Hold'em
- Blinds: Small blind (default 1), Big blind (default 2)
- Starting stacks: 100 chips (configurable)
- Hand ends on fold, all-in showdown, or river betting complete
