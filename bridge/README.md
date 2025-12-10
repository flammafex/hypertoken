# HyperToken Environment Bridge

WebSocket server that exposes HyperToken PettingZoo environments for external clients (Python, Jupyter, etc.).

## Quick Start

```bash
# Start the server with default blackjack environment
npx tsx bridge/server.ts

# Or use npm scripts
npm run bridge:server
npm run bridge:blackjack
```

## Usage

### Start the Server

```bash
# Basic usage
npx tsx bridge/server.ts --env blackjack --port 9999

# With options
npx tsx bridge/server.ts \
  --env blackjack \
  --port 9999 \
  --agents 3 \
  --decks 6 \
  --verbose
```

### Connect from Python

```python
from hypertoken import HyperTokenAECEnv

env = HyperTokenAECEnv("ws://localhost:9999")
env.reset()

for agent in env.agent_iter():
    obs, reward, term, trunc, info = env.last()
    if term or trunc:
        action = None
    else:
        action = env.action_space(agent).sample()
    env.step(action)

env.close()
```

## CLI Options

| Option | Short | Default | Description |
|--------|-------|---------|-------------|
| `--port` | `-p` | 9999 | Port to listen on |
| `--env` | `-e` | blackjack | Environment type |
| `--host` | `-h` | 0.0.0.0 | Host to bind to |
| `--verbose` | `-v` | false | Enable verbose logging |
| `--agents` | `-a` | 2 | Number of agents |
| `--decks` | `-d` | 6 | Number of decks (blackjack) |
| `--seed` | `-s` | - | Random seed |

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

## Available Environments

| Name | Type | Description |
|------|------|-------------|
| `blackjack` | AEC | Multi-agent casino blackjack |

### Blackjack Options

| Option | Default | Description |
|--------|---------|-------------|
| `numAgents` | 2 | Number of players |
| `numDecks` | 6 | Number of card decks |
| `initialBankroll` | 1000 | Starting bankroll |
| `defaultBet` | 10 | Default bet per hand |
| `variant` | "american" | "american" or "european" |

## Adding New Environments

1. Implement `AECEnvironment` interface (see `interface/PettingZoo.ts`)
2. Register in `ENV_REGISTRY` in `bridge/server.ts`:

```typescript
const ENV_REGISTRY: Record<string, EnvFactory> = {
  blackjack: (options) => new BlackjackAEC(options),
  'my-env': (options) => new MyEnvironment(options),  // Add here
};
```

## Architecture

```
┌─────────────────────┐     WebSocket      ┌─────────────────────┐
│   Python Client     │ ◄──────────────────► │   Node.js Server    │
│  (pip install)      │    JSON messages    │  (HyperToken Engine) │
│                     │                      │                      │
│  - PettingZoo API   │                      │  - AECEnvironment    │
│  - gymnasium API    │                      │  - BlackjackAEC      │
│  - numpy arrays     │                      │  - WASM acceleration │
└─────────────────────┘                      └─────────────────────┘
```

## Performance

Typical latency:
- Local connection: ~1-2ms per command
- Same network: ~5-10ms per command

For maximum throughput, run the server and client on the same machine.
