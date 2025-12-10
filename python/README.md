# HyperToken Python Bridge

Train AI agents on HyperToken environments using Python and your favorite RL libraries.

HyperToken is a distributed simulation engine for multi-agent games. This package provides a Python interface via WebSocket, compatible with [PettingZoo](https://pettingzoo.farama.org/) and [gymnasium](https://gymnasium.farama.org/).

## Installation

```bash
pip install hypertoken

# With gymnasium support (recommended)
pip install hypertoken[gymnasium]

# With Stable-Baselines3 support
pip install hypertoken[sb3]

# With RLlib support
pip install hypertoken[rllib]

# Everything
pip install hypertoken[all]
```

## Quick Start

### 1. Start the HyperToken Server

```bash
# From the hypertoken repository
npx tsx bridge/server.ts --env blackjack --port 9999

# Or with npm script
npm run bridge:blackjack
```

### 2. Connect from Python

```python
from hypertoken import HyperTokenAECEnv

# PettingZoo AEC API
env = HyperTokenAECEnv("ws://localhost:9999")
env.reset(seed=42)

for agent in env.agent_iter():
    obs, reward, term, trunc, info = env.last()

    if term or trunc:
        action = None
    else:
        action = env.action_space(agent).sample()

    env.step(action)

print(f"Final rewards: {env.rewards()}")
env.close()
```

### 3. Train with Stable-Baselines3

```python
from stable_baselines3 import PPO
from hypertoken import HyperTokenClient

# See examples/train_sb3.py for the full wrapper
env = BlackjackGymWrapper("ws://localhost:9999")

model = PPO("MlpPolicy", env, verbose=1)
model.learn(total_timesteps=50_000)
model.save("blackjack_ppo")
```

## Available Environments

| Environment | Agents | Actions | Description |
|-------------|--------|---------|-------------|
| `blackjack` | 1-6 | Hit, Stand, Double, Split, Insurance | Casino blackjack |

### Blackjack Actions

| ID | Action | Description |
|----|--------|-------------|
| 0 | Hit | Take another card |
| 1 | Stand | End turn with current hand |
| 2 | Double | Double bet, take one card, stand |
| 3 | Split | Split pair into two hands |
| 4 | Insurance | Take insurance bet (if dealer shows Ace) |

### Blackjack Observation

7-element normalized vector:
```
[handValue, dealerUpcard, isSoft, canDouble, canSplit, canInsurance, deckRatio]
```

All values normalized to [0, 1] range.

## API Reference

### HyperTokenAECEnv

PettingZoo AEC (Agent Environment Cycle) compatible environment.

```python
env = HyperTokenAECEnv(url, render_mode=None)

# Properties
env.possible_agents  # List of all possible agent names
env.agents           # List of currently active agents
env.agent_selection  # Current agent whose turn it is

# Spaces
env.observation_space(agent)  # gymnasium.spaces.Box
env.action_space(agent)       # gymnasium.spaces.Discrete

# Core API
env.reset(seed=None)
env.step(action)
obs, reward, term, trunc, info = env.last()

# Iteration
for agent in env.agent_iter():
    ...

# State queries
env.rewards()       # Dict[str, float]
env.terminations()  # Dict[str, bool]
env.truncations()   # Dict[str, bool]
env.infos()         # Dict[str, Dict]
env.action_mask(agent)  # np.ndarray[bool] or None

# Cleanup
env.close()
```

### HyperTokenParallelEnv

PettingZoo Parallel API compatible environment.

```python
env = HyperTokenParallelEnv(url, render_mode=None)

observations, infos = env.reset()

while env.agents:
    actions = {agent: policy(obs) for agent, obs in observations.items()}
    observations, rewards, terms, truncs, infos = env.step(actions)

env.close()
```

### HyperTokenClient

Low-level WebSocket client for direct server communication.

```python
client = HyperTokenClient(url, timeout=30.0)
client.connect()

client.reset(seed=42)
obs = client.observe("player_0")
client.step(action=0)
result = client.last()

latency = client.ping()  # milliseconds
client.close()
```

## Performance

Typical latency over WebSocket:
- Local connection: ~1-2ms per step
- Same network: ~5-10ms per step

For maximum performance, run the server and Python client on the same machine.

```python
from hypertoken import HyperTokenClient

client = HyperTokenClient("ws://localhost:9999")
client.connect()

# Measure latency
latencies = [client.ping() for _ in range(100)]
print(f"Mean latency: {sum(latencies)/len(latencies):.2f}ms")

client.disconnect()
```

## Examples

See the `examples/` directory:

- `train_sb3.py` - Train with Stable-Baselines3
- `train_pettingzoo.py` - Multi-agent training with PettingZoo API
- `jupyter_demo.ipynb` - Interactive Jupyter notebook

## Development

```bash
# Install dev dependencies
pip install -e ".[dev]"

# Run tests
pytest

# Format code
black hypertoken/
ruff check hypertoken/

# Type check
mypy hypertoken/
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

## License

Apache 2.0
