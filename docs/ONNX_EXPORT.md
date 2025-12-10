# ONNX Policy Export Guide

Train AI agents in Python, deploy them anywhere HyperToken runs.

```
┌─────────────────┐      ┌─────────────────┐      ┌─────────────────┐
│  Train in       │      │  Export to      │      │  Run in         │
│  Python         │  ──▶ │  ONNX           │  ──▶ │  Browser        │
│  (SB3/PyTorch)  │      │  (.onnx file)   │      │  (ONNX Runtime) │
└─────────────────┘      └─────────────────┘      └─────────────────┘
```

## Quick Start

### 1. Train an Agent

```python
from stable_baselines3 import PPO
from hypertoken import HyperTokenAECEnv

# Connect to HyperToken bridge server
env = BlackjackGymWrapper("ws://localhost:9999")

# Train with PPO
model = PPO("MlpPolicy", env)
model.learn(total_timesteps=50_000)
model.save("blackjack_ppo")
```

### 2. Export to ONNX

```python
from hypertoken import export_sb3_to_onnx

export_sb3_to_onnx(
    "blackjack_ppo.zip",
    "blackjack_policy.onnx",
    observation_shape=(7,),
    metadata={
        "actions": ["blackjack:hit", "blackjack:stand"]
    }
)
```

### 3. Use in Browser

```javascript
import { ONNXAgent } from 'hypertoken/interface/ONNXAgent.js';

const ai = new ONNXAgent({
  actionMap: { 0: 'blackjack:hit', 1: 'blackjack:stand' }
});
await ai.load('/models/blackjack_policy.onnx');

// Use with Agent
const bot = new Agent('Bot', { agent: ai });
await bot.think(engine);  // Makes decision via ONNX inference
```

## Supported Frameworks

| Framework | Export Function | Notes |
|-----------|-----------------|-------|
| Stable-Baselines3 | `export_sb3_to_onnx()` | PPO, DQN, A2C, SAC |
| PyTorch | `export_pytorch_to_onnx()` | Any nn.Module |
| TensorFlow | (coming soon) | - |

## Python API Reference

### `export_sb3_to_onnx()`

Export a Stable-Baselines3 model to ONNX format.

```python
from hypertoken import export_sb3_to_onnx

export_sb3_to_onnx(
    model_path="model.zip",          # Path to SB3 model
    output_path="policy.onnx",       # Output ONNX path
    observation_shape=(7,),          # Shape of observation space
    action_type="discrete",          # "discrete" or "continuous"
    opset_version=11,                # ONNX opset version
    metadata={                       # Optional metadata
        "env": "blackjack",
        "actions": ["hit", "stand"],
        "observation_features": ["hand_value", "dealer_card", ...]
    }
)
```

**Parameters:**
- `model_path`: Path to saved SB3 model (.zip file)
- `output_path`: Where to save the .onnx file
- `observation_shape`: Tuple defining observation dimensions
- `action_type`: "discrete" for classification, "continuous" for regression
- `opset_version`: ONNX opset (11 recommended for compatibility)
- `metadata`: Dict saved as JSON alongside the model

**Returns:** Path to exported .onnx file

### `export_pytorch_to_onnx()`

Export a raw PyTorch model to ONNX.

```python
from hypertoken import export_pytorch_to_onnx
import torch.nn as nn

class MyPolicy(nn.Module):
    def __init__(self):
        super().__init__()
        self.net = nn.Sequential(
            nn.Linear(7, 64),
            nn.ReLU(),
            nn.Linear(64, 2),
            nn.Softmax(dim=-1)
        )

    def forward(self, obs):
        return self.net(obs)

model = MyPolicy()
# ... train ...

export_pytorch_to_onnx(
    model,
    "policy.onnx",
    observation_shape=(7,)
)
```

### `verify_onnx()`

Verify an ONNX model loads and runs correctly.

```python
from hypertoken import verify_onnx
import numpy as np

# Basic verification
verify_onnx("policy.onnx")

# With test inference
test_obs = np.array([[0.5, 0.3, 0.0, 0.0, 0.8, 0.1, 1.0]], dtype=np.float32)
verify_onnx("policy.onnx", test_obs)
```

## TypeScript API Reference

### `ONNXAgent`

Run ONNX models in browser or Node.js. Implements `IAgent` interface for use with HyperToken's Agent system.

```typescript
import { ONNXAgent } from 'hypertoken/interface/ONNXAgent.js';

const agent = new ONNXAgent({
  // Path to model (can also be passed to load())
  modelPath: '/path/to/model.onnx',

  // Path to metadata JSON (optional, auto-discovered if same name as model)
  metadataPath: '/path/to/model.json',

  // Map action indices to action type strings
  actionMap: {
    0: 'game:action_a',
    1: 'game:action_b'
  },

  // How to select actions from probabilities
  selectionStrategy: 'argmax',  // or 'sample'

  // Custom observation extractor
  observationExtractor: (engine, agent) => {
    // Return array of numbers matching training observation
    return [/* ... */];
  },

  // Enable debug logging
  debug: false
});

// Load the model
await agent.load();

// Check if ready
console.log(agent.ready);  // true

// Use with HyperToken Agent
const bot = new Agent('Bot', { agent });
await bot.think(engine);  // Returns { type: 'game:action_a', payload: {} }

// Direct inference
const probs = await agent.predict([0.5, 0.3, 0.0, 0.0, 0.8, 0.1, 1.0]);
const actionIndex = agent.selectAction(probs);

// Get model info
const info = agent.getInfo();
// { inputs: ['observation'], outputs: ['action_probs'], metadata: {...} }

// Cleanup
agent.dispose();
```

#### Selection Strategies

- **`'argmax'`** (default): Always selects the action with highest probability. Deterministic behavior.
- **`'sample'`**: Samples from the probability distribution. More varied, exploration-like behavior.

#### Custom Observation Extractor

When your game's observation format differs from the default:

```typescript
const agent = new ONNXAgent({
  observationExtractor: (engine, playerAgent) => {
    const state = engine.describe();

    // Extract and normalize features
    return [
      state.playerHealth / 100,
      state.enemyHealth / 100,
      state.playerPosition.x / mapWidth,
      state.playerPosition.y / mapHeight,
      // ... more features
    ];
  }
});
```

## Browser Setup

### Option 1: CDN (Simplest)

Add ONNX Runtime to your HTML:

```html
<script src="https://cdn.jsdelivr.net/npm/onnxruntime-web/dist/ort.min.js"></script>
```

### Option 2: npm

```bash
npm install onnxruntime-web
```

```javascript
import * as ort from 'onnxruntime-web';
```

### Option 3: Self-hosted

Download from [ONNX Runtime releases](https://github.com/microsoft/onnxruntime/releases) and serve locally.

## Node.js Setup

```bash
npm install onnxruntime-node
```

The `ONNXAgent` class automatically detects the environment and loads the appropriate runtime.

## Metadata Format

The metadata JSON file (saved alongside .onnx) contains:

```json
{
  "env": "blackjack",
  "actions": ["blackjack:hit", "blackjack:stand"],
  "observation_features": [
    "player_value_norm",
    "dealer_value_norm",
    "is_soft_hand",
    "can_split",
    "cards_remaining_norm",
    "bet_size_norm",
    "is_my_turn"
  ],
  "observation_shape": [7],
  "_export_info": {
    "algorithm": "PPO",
    "observation_shape": [7],
    "action_type": "discrete",
    "opset_version": 11
  }
}
```

When loaded, `ONNXAgent` automatically creates the action mapping from the `actions` array.

## Complete Example: Blackjack

### Training Script

```python
# examples/blackjack/train_and_export.py
from stable_baselines3 import PPO
from hypertoken import export_sb3_to_onnx, verify_onnx
import numpy as np

# 1. Train
env = BlackjackGymWrapper("ws://localhost:9999")
model = PPO("MlpPolicy", env, verbose=1)
model.learn(total_timesteps=25000)
model.save("blackjack_ppo")

# 2. Export
export_sb3_to_onnx(
    "blackjack_ppo.zip",
    "blackjack_policy.onnx",
    observation_shape=(7,),
    metadata={
        "env": "blackjack",
        "actions": ["blackjack:hit", "blackjack:stand"]
    }
)

# 3. Verify
test_obs = np.array([[0.5, 0.3, 0.0, 0.0, 0.8, 0.1, 1.0]], dtype=np.float32)
verify_onnx("blackjack_policy.onnx", test_obs)
```

### Browser Usage

```javascript
// game.js
import { ONNXAgent } from 'hypertoken/interface/ONNXAgent.js';
import { Agent } from 'hypertoken/engine/Agent.js';

// Create AI with blackjack-specific observation extractor
const ai = new ONNXAgent({
  observationExtractor: (engine, agent) => {
    const state = engine.describe();
    return [
      state.playerValue / 30,
      state.dealerUpcard / 12,
      state.isSoftHand ? 1 : 0,
      state.canSplit ? 1 : 0,
      state.cardsRemaining / 312,
      state.betSize / 1000,
      1  // Is my turn
    ];
  },
  debug: true
});

await ai.load('/models/blackjack_policy.onnx');

// Create bot player
const bot = new Agent('AI_Player', { agent: ai });

// In game loop
async function playRound() {
  while (!game.isOver) {
    if (game.currentPlayer === bot) {
      const decision = await bot.think(engine);
      // decision = { type: 'blackjack:hit', payload: {} }
      engine.dispatch(decision.type, decision.payload);
    }
  }
}
```

## Troubleshooting

### "Model not found" in browser

Ensure the .onnx file is served with correct MIME type:
```
.onnx → application/octet-stream
```

For nginx:
```nginx
types {
    application/octet-stream onnx;
}
```

### "Input shape mismatch"

Your observation must match the shape used during training. Check:
1. The `observation_shape` parameter during export
2. The `metadata.json` file for expected shape
3. Your observation extractor returns the correct number of values

### Slow inference in browser

```javascript
// Use more threads
ort.env.wasm.numThreads = 4;

// Or disable WebGL if having GPU issues
ort.env.webgl.disabled = true;
```

### Model too large

- Quantize your model during export
- Use a smaller network architecture
- Consider INT8 quantization for significant size reduction

### Different results between Python and JavaScript

1. Ensure observation normalization matches exactly
2. Check for floating point precision differences
3. Verify action mapping is correct

## Best Practices

1. **Always normalize observations** to 0-1 range for stable training
2. **Include metadata** with action mappings and observation descriptions
3. **Verify models** before deployment with `verify_onnx()`
4. **Test in target environment** - browser behavior may differ slightly from Python
5. **Use `argmax` selection** for production, `sample` for exploration/variety
6. **Handle edge cases** - what if model returns unexpected probabilities?

## See Also

- [Python Bridge Documentation](./PYTHON_BRIDGE.md)
- [Worker Mode Documentation](./WORKER_MODE.md)
- [ONNX Runtime Web](https://onnxruntime.ai/docs/get-started/with-javascript.html)
- [Stable-Baselines3](https://stable-baselines3.readthedocs.io/)
