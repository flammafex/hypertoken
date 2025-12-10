# Python Bridge Integration Guide

This guide covers integrating HyperToken environments with Python-based reinforcement learning frameworks.

## Overview

HyperToken provides a WebSocket bridge that allows Python clients to interact with TypeScript-based game environments. The architecture consists of:

1. **Node.js Server** (`bridge/server.ts`) - Hosts the HyperToken environment
2. **Python Client** (`python/hypertoken/`) - PettingZoo-compatible wrapper

```
┌─────────────────────┐     WebSocket      ┌─────────────────────┐
│   Python Client     │ ◄──────────────────► │   Node.js Server    │
│                     │    JSON messages    │                      │
│  - PettingZoo API   │                      │  - AECEnvironment    │
│  - gymnasium spaces │                      │  - Game logic        │
│  - numpy arrays     │                      │  - WASM acceleration │
└─────────────────────┘                      └─────────────────────┘
```

## Quick Start

### Installation

```bash
# Python package
cd python/
pip install -e .

# Or with optional dependencies
pip install -e ".[sb3]"  # Stable-Baselines3
pip install -e ".[all]"  # Everything
```

### Starting the Server

```bash
# Basic
npx tsx bridge/server.ts --env blackjack --port 9999

# With options
npx tsx bridge/server.ts \
  --env blackjack \
  --port 9999 \
  --agents 3 \
  --decks 6 \
  --verbose
```

### Python Client

```python
from hypertoken import HyperTokenAECEnv

env = HyperTokenAECEnv("ws://localhost:9999")
env.reset(seed=42)

for agent in env.agent_iter():
    obs, reward, term, trunc, info = env.last()
    action = env.action_space(agent).sample() if not (term or trunc) else None
    env.step(action)

env.close()
```

## Protocol Reference

### Message Format

All messages are JSON objects with a `cmd` field:

```json
{"cmd": "reset", "seed": 42}
{"cmd": "step", "action": 0}
{"cmd": "observe", "agent": "player_0"}
```

### Commands

| Command | Request | Response |
|---------|---------|----------|
| `reset` | `{cmd: "reset", seed?: number}` | `{ok: true}` |
| `step` | `{cmd: "step", action: number}` | `{ok: true}` |
| `observe` | `{cmd: "observe", agent: string}` | `{observation: number[]}` |
| `last` | `{cmd: "last"}` | `{observation, reward, terminated, truncated, info}` |
| `agents` | `{cmd: "agents"}` | `{agents: string[]}` |
| `possible_agents` | `{cmd: "possible_agents"}` | `{possible_agents: string[]}` |
| `agent_selection` | `{cmd: "agent_selection"}` | `{agent: string}` |
| `observation_space` | `{cmd: "observation_space", agent: string}` | `{space: {shape, low, high}}` |
| `action_space` | `{cmd: "action_space", agent: string}` | `{space: {n}}` |
| `action_mask` | `{cmd: "action_mask", agent: string}` | `{mask: boolean[] \| null}` |
| `rewards` | `{cmd: "rewards"}` | `{rewards: {agent: number}}` |
| `terminations` | `{cmd: "terminations"}` | `{terminations: {agent: boolean}}` |
| `truncations` | `{cmd: "truncations"}` | `{truncations: {agent: boolean}}` |
| `infos` | `{cmd: "infos"}` | `{infos: {agent: {}}}` |
| `render` | `{cmd: "render"}` | `{ok: true}` |
| `close` | `{cmd: "close"}` | `{ok: true}` |
| `ping` | `{cmd: "ping"}` | `{pong: timestamp}` |
| `env_info` | `{cmd: "env_info"}` | Full environment metadata |

### Space Definitions

**Box Space** (continuous observations):
```json
{
  "shape": [7],
  "low": [0, 0, 0, 0, 0, 0, 0],
  "high": [1, 1, 1, 1, 1, 1, 1]
}
```

**Discrete Space** (action space):
```json
{
  "n": 5,
  "shape": []
}
```

## Framework Integration

### Stable-Baselines3

For single-agent training, wrap the AEC environment:

```python
from stable_baselines3 import PPO
from gymnasium import Env, spaces
import numpy as np
from hypertoken import HyperTokenClient

class GymWrapper(Env):
    def __init__(self, url="ws://localhost:9999"):
        super().__init__()
        self.client = HyperTokenClient(url)
        self.client.connect()

        agents = self.client.possible_agents()
        self.agent_id = agents[0]

        obs_space = self.client.observation_space(self.agent_id)
        act_space = self.client.action_space(self.agent_id)

        self.observation_space = spaces.Box(
            low=np.array(obs_space["low"], dtype=np.float32),
            high=np.array(obs_space["high"], dtype=np.float32),
        )
        self.action_space = spaces.Discrete(act_space["n"])

    def reset(self, seed=None, options=None):
        self.client.reset(seed)
        obs = self.client.observe(self.agent_id)
        return np.array(obs, dtype=np.float32), {}

    def step(self, action):
        self.client.step(int(action))
        obs = self.client.observe(self.agent_id)
        result = self.client.last()
        return (
            np.array(obs, dtype=np.float32),
            result["reward"],
            result["terminated"],
            result["truncated"],
            result.get("info", {}),
        )

    def close(self):
        self.client.close()

# Train
env = GymWrapper()
model = PPO("MlpPolicy", env, verbose=1)
model.learn(total_timesteps=50_000)
```

### RLlib

```python
from ray import tune
from ray.rllib.algorithms.ppo import PPOConfig

# Register custom environment
from ray.tune.registry import register_env

def env_creator(config):
    from hypertoken import HyperTokenAECEnv
    return HyperTokenAECEnv(config.get("url", "ws://localhost:9999"))

register_env("hypertoken-blackjack", env_creator)

# Train
config = (
    PPOConfig()
    .environment("hypertoken-blackjack")
    .training(lr=0.0003)
)

results = tune.run(
    "PPO",
    config=config.to_dict(),
    stop={"training_iteration": 100},
)
```

### PettingZoo SuperSuit

```python
from hypertoken import HyperTokenAECEnv
import supersuit as ss

# Create environment
env = HyperTokenAECEnv("ws://localhost:9999")

# Apply wrappers
env = ss.clip_reward_v0(env, lower_bound=-1, upper_bound=1)
env = ss.frame_stack_v1(env, 4)
```

## Performance Optimization

### Measuring Latency

```python
from hypertoken import HyperTokenClient

client = HyperTokenClient("ws://localhost:9999")
client.connect()

# Warm up
for _ in range(10):
    client.ping()

# Measure
latencies = [client.ping() for _ in range(100)]
print(f"Mean: {sum(latencies)/len(latencies):.2f}ms")
print(f"P99: {sorted(latencies)[98]:.2f}ms")

client.disconnect()
```

### Batch Operations

For training, minimize round-trips by batching operations:

```python
# Instead of multiple observe() calls
# Use env_info() to get all spaces upfront
info = client.env_info()
spaces = info["observation_spaces"]
```

### Local vs Remote

| Connection | Typical Latency |
|------------|-----------------|
| localhost | 1-2ms |
| LAN | 5-10ms |
| Internet | 50-200ms |

For best performance, run the server and client on the same machine.

## Adding New Environments

### 1. Implement AECEnvironment

```typescript
// my-game/MyGameAEC.ts
import { AECEnvironment } from "../interface/PettingZoo.js";

export class MyGameAEC extends AECEnvironment {
  observationSpace(agent: string): Space {
    return { shape: [10], low: [...], high: [...] };
  }

  actionSpace(agent: string): Space {
    return { n: 4 };
  }

  async reset(seed?: number): Promise<void> {
    // Initialize game state
  }

  observe(agent: string): Observation {
    // Return observation array
  }

  async step(action: ActionID): Promise<void> {
    // Execute action
  }

  render(): void {
    // Console output
  }

  close(): void {
    // Cleanup
  }
}
```

### 2. Register in Server

```typescript
// bridge/server.ts
import { MyGameAEC } from "../my-game/MyGameAEC.js";

const ENV_REGISTRY: Record<string, EnvFactory> = {
  blackjack: (options) => new BlackjackAEC(options),
  "my-game": (options) => new MyGameAEC(options),  // Add here
};
```

### 3. Use from Python

```python
env = HyperTokenAECEnv("ws://localhost:9999")
# Server started with --env my-game
```

## Troubleshooting

### Connection Refused

```
RuntimeError: Not connected. Call connect() first.
```

Make sure the server is running:
```bash
npx tsx bridge/server.ts --env blackjack --port 9999
```

### Timeout

```
websocket._exceptions.WebSocketTimeoutException
```

Increase timeout:
```python
client = HyperTokenClient(url, timeout=60.0)
```

### Invalid Action

Actions must be valid according to the action mask:
```python
mask = env.action_mask(agent)
if mask is not None and not mask[action]:
    valid_actions = np.where(mask)[0]
    action = np.random.choice(valid_actions)
```

### High Latency

- Run server and client on same machine
- Use localhost instead of 127.0.0.1
- Disable verbose logging on server
- Check for network issues

## FAQ

**Q: Can I run multiple environments?**

A: Yes, start multiple servers on different ports:
```bash
npx tsx bridge/server.ts --port 9999 &
npx tsx bridge/server.ts --port 9998 &
```

**Q: Can I train with GPU acceleration?**

A: The Python side (neural networks) can use GPU. The HyperToken server
uses CPU but has optional WASM acceleration for game logic.

**Q: Is there async support?**

A: The current client is synchronous. Async support (using `asyncio` and
`websockets`) is planned for a future release.

**Q: Can I use this with Jupyter notebooks?**

A: Yes! See `python/examples/jupyter_demo.ipynb` for an example.
