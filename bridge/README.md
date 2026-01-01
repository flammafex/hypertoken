# HyperToken Environment Bridge

WebSocket server that exposes HyperToken PettingZoo environments for external clients (Python, Jupyter, etc.).

## Quick Start

```bash
# Start with default blackjack environment
hypertoken bridge

# Or specify an environment
hypertoken bridge poker
hypertoken bridge hanabi
hypertoken bridge coup
hypertoken bridge liars-dice
```

## Available Environments

| Name | Type | Players | Description |
|------|------|---------|-------------|
| `blackjack` | AEC | 1-7 | Multi-agent casino blackjack |
| `poker` | AEC | 2 | Heads-up Texas Hold'em |
| `hanabi` | AEC | 2-5 | Cooperative card game (theory of mind) |
| `coup` | AEC | 2-6 | Bluffing card game (deception) |
| `liars-dice` | AEC | 2-6 | Bluffing dice game (bidding) |

## Usage

### Start the Server

```bash
# Basic usage
hypertoken bridge --env poker --port 9999

# With authentication (recommended for public deployment)
hypertoken bridge poker --port 9999 --token mysecretkey

# Environment-specific options
hypertoken bridge poker --rich --extended --shaped
hypertoken bridge hanabi -n 4
hypertoken bridge coup -n 5
hypertoken bridge liars-dice -n 3 --dice 4
```

### Connect from Python

```python
from hypertoken import HyperTokenAECEnv

# Local connection
env = HyperTokenAECEnv("ws://localhost:9999")

# With authentication
env = HyperTokenAECEnv("ws://localhost:9999?token=mysecretkey")

env.reset()

for agent in env.agent_iter():
    obs, reward, term, trunc, info = env.last()
    if term or trunc:
        action = None
    else:
        mask = env.action_mask(agent)
        valid_actions = [i for i, v in enumerate(mask) if v]
        action = random.choice(valid_actions)
    env.step(action)

env.close()
```

## CLI Options

### General Options

| Option | Short | Default | Description |
|--------|-------|---------|-------------|
| `--port` | `-p` | 9999 | Port to listen on |
| `--env` | `-e` | blackjack | Environment type |
| `--host` | | 0.0.0.0 | Host to bind to |
| `--verbose` | `-v` | false | Enable verbose logging |
| `--seed` | `-s` | - | Random seed |
| `--token` | | - | API token for authentication |
| `--max-connections` | | - | Max concurrent connections |

### Blackjack Options

| Option | Default | Description |
|--------|---------|-------------|
| `--agents`, `-a` | 2 | Number of players (1-7) |
| `--decks`, `-d` | 6 | Number of card decks |

### Poker Options

| Option | Default | Description |
|--------|---------|-------------|
| `--stack` | 200 | Starting stack (in big blinds) |
| `--rich`, `--rich-obs` | false | Rich observations (73 features) |
| `--extended`, `--extended-actions` | false | 10 bet sizes instead of 6 |
| `--shaped`, `--reward-shaping` | false | Enable reward shaping for training |

### Hanabi Options

| Option | Default | Description |
|--------|---------|-------------|
| `--players`, `-n` | 2 | Number of players (2-5) |

### Coup Options

| Option | Default | Description |
|--------|---------|-------------|
| `--players`, `-n` | 2 | Number of players (2-6) |

### Liar's Dice Options

| Option | Default | Description |
|--------|---------|-------------|
| `--players`, `-n` | 2 | Number of players (2-6) |
| `--dice` | 5 | Starting dice per player |

## Environment Details

### Blackjack

Multi-agent casino blackjack against the dealer.

- **Observation**: 15 features (hand value, dealer upcard, deck state)
- **Actions**: 0=stand, 1=hit, 2=double, 3=split, 4=surrender
- **Rewards**: +bet (win), -bet (lose), 0 (push), +1.5×bet (blackjack)

### Poker (Texas Hold'em)

Heads-up No-Limit Texas Hold'em for self-play training.

- **Observation**: 23 features (standard) or 73 features (rich)
  - Standard: hand strength, pot odds, stack sizes, betting history
  - Rich: adds positional encoding, opponent modeling, hand potential
- **Actions**: 0=fold, 1=check/call, 2-5=bet sizes (or 2-10 with extended)
- **Rewards**: Chips won/lost (optionally shaped with pot equity, fold savings)

```bash
# Best for RL training
hypertoken bridge poker --rich --extended --shaped
```

### Hanabi

Cooperative card game requiring theory of mind. Players see others' cards but not their own.

- **Observation**: Variable size based on player count
  - Other players' hands (visible)
  - Own card knowledge from hints
  - Firework piles, info tokens, life tokens
  - Discard pile, last action
- **Actions**: play card, discard card, give hint (color/number)
- **Rewards**: Shared team score (0-25 based on fireworks built)

```bash
# 4-player Hanabi
hypertoken bridge hanabi -n 4
```

### Coup

Bluffing card game with hidden roles. Tiny state space, rich deception dynamics.

- **Roles**: Duke, Assassin, Captain, Ambassador, Contessa
- **Observation**: 106 features
  - Own coins, influences, revealed cards
  - Other players' coins and revealed cards
  - Current action phase, pending challenges/blocks
- **Actions**: 40 possible (income, foreign aid, coup, role actions, challenges, blocks)
- **Rewards**: +1 (win), -1 (eliminated)

```bash
# 4-player Coup
hypertoken bridge coup -n 4
```

### Liar's Dice

Bluffing dice game with bidding. Simpler than poker but retains imperfect information.

- **Rules**: Players bid on total dice showing a face value (ones are wild)
- **Observation**: ~31 features
  - Own dice (one-hot encoded)
  - Other players' dice counts
  - Current bid, last bidder
- **Actions**: 0=call "Liar!", 1+=bid (quantity, face) combinations
- **Rewards**: +1 (last player standing), -1 (eliminated)

```bash
# 3 players with 4 dice each
hypertoken bridge liars-dice -n 3 --dice 4
```

## Multi-Environment Deployment

Run all environments on different ports:

```bash
hypertoken bridge blackjack -p 9991 --token $TOKEN &
hypertoken bridge poker -p 9992 --token $TOKEN --rich &
hypertoken bridge hanabi -p 9993 --token $TOKEN &
hypertoken bridge coup -p 9994 --token $TOKEN &
hypertoken bridge liars-dice -p 9995 --token $TOKEN &
```

Or use nginx to route by path:

```nginx
location /ws/poker { proxy_pass http://127.0.0.1:9992; }
location /ws/hanabi { proxy_pass http://127.0.0.1:9993; }
# etc.
```

## Protocol

The server uses a simple JSON protocol over WebSocket.

### Request Format

```json
{ "cmd": "command_name", ...args }
```

### Commands

| Command | Arguments | Response | Description |
|---------|-----------|----------|-------------|
| `reset` | `seed?` | `{ ok: true }` | Reset environment |
| `step` | `action` | `{ ok: true }` | Execute action |
| `observe` | `agent` | `{ observation: [...] }` | Get observation |
| `last` | - | `{ observation, reward, terminated, truncated, info }` | Get last step result |
| `agents` | - | `{ agents: [...] }` | Get active agents |
| `possible_agents` | - | `{ possible_agents: [...] }` | Get all agents |
| `agent_selection` | - | `{ agent: "..." }` | Get current agent |
| `observation_space` | `agent` | `{ space: {...} }` | Get obs space |
| `action_space` | `agent` | `{ space: {...} }` | Get action space |
| `action_mask` | `agent` | `{ mask: [...] }` | Get valid actions |
| `rewards` | - | `{ rewards: {...} }` | Get all rewards |
| `terminations` | - | `{ terminations: {...} }` | Get termination status |
| `truncations` | - | `{ truncations: {...} }` | Get truncation status |
| `infos` | - | `{ infos: {...} }` | Get info dicts |
| `render` | - | `{ ok: true }` | Render to console |
| `close` | - | `{ ok: true }` | Close environment |
| `ping` | - | `{ pong: timestamp }` | Latency check |
| `env_info` | - | `{ env_type, possible_agents, spaces, ... }` | Full env info |

### Error Response

```json
{ "error": "Error message" }
```

## Adding New Environments

1. Implement `AECEnvironment` interface (see `interface/PettingZoo.ts`)
2. Register in `ENV_REGISTRY` in `bridge/server.ts`:

```typescript
const ENV_REGISTRY: Record<string, EnvFactory> = {
  blackjack: (options) => new BlackjackAEC(options),
  poker: (options) => new PokerAEC(options),
  hanabi: (options) => new HanabiAEC(options),
  coup: (options) => new CoupAEC(options),
  'liars-dice': (options) => new LiarsDiceAEC(options),
  'my-env': (options) => new MyEnvironment(options),  // Add here
};
```

## Architecture

```
┌─────────────────────┐     WebSocket      ┌─────────────────────┐
│   Python Client     │ ◄────────────────► │   Node.js Server    │
│  (pip install)      │    JSON messages   │  (HyperToken Engine)│
│                     │                    │                     │
│  - PettingZoo API   │                    │  - AECEnvironment   │
│  - gymnasium API    │                    │  - Game engines     │
│  - numpy arrays     │                    │  - WASM acceleration│
└─────────────────────┘                    └─────────────────────┘
```

## Performance

Typical latency:
- Local connection: ~1-2ms per command
- Same network: ~5-10ms per command
- Internet (with TLS): ~20-50ms per command

For maximum throughput, run the server and client on the same machine.

## Security

For public deployments:
- Always use `--token` for API authentication
- Use `--max-connections` to limit concurrent connections
- Deploy behind nginx with TLS
- Consider rate limiting at the nginx level
