# Browser AI Demo - Play Blackjack vs Trained Neural Network

This demo lets you play blackjack against a trained AI opponent in your browser.
Both you and the AI play independently against the dealer.

## Quick Start

### 1. Train and Export a Model

First, you need to train a model and export it to ONNX format:

```bash
# Start the HyperToken bridge server
cd /path/to/hypertoken
npx tsx bridge/server.ts --env blackjack --port 9999

# In another terminal, run the training script
cd examples/blackjack
python train_and_export.py --timesteps 25000
```

This will create:
- `blackjack_policy.onnx` - The trained neural network
- `blackjack_policy.json` - Metadata (action mappings, etc.)

### 2. Copy Files to Demo Directory

```bash
cp blackjack_policy.onnx browser-ai/
cp blackjack_policy.json browser-ai/
```

### 3. Serve the Demo

You need to serve the files via HTTP (not file://). Use any static server:

```bash
# Option 1: Python
cd browser-ai
python -m http.server 8000

# Option 2: Node.js (npx)
npx serve browser-ai

# Option 3: VS Code Live Server extension
# Just right-click index.html -> "Open with Live Server"
```

### 4. Open in Browser

Navigate to `http://localhost:8000` (or your server's URL).

## How It Works

The demo uses [ONNX Runtime Web](https://onnxruntime.ai/docs/get-started/with-javascript.html)
to run the trained neural network directly in your browser.

```
┌──────────────────┐     ┌──────────────────┐     ┌──────────────────┐
│   Game State     │ ──▶ │   ONNX Model     │ ──▶ │   AI Decision    │
│   (observation)  │     │   (inference)    │     │   (Hit/Stand)    │
└──────────────────┘     └──────────────────┘     └──────────────────┘
```

The observation vector includes:
1. AI hand value (normalized 0-1)
2. Dealer upcard value (normalized)
3. Is soft hand (0 or 1)
4. Can split (always 0 in this demo)
5. Cards remaining in shoe (normalized)
6. Bet size (fixed)
7. Is AI's turn (always 1)

## Using ONNXAgent in Your Own Code

For more control, use the `ONNXAgent` class from HyperToken:

```javascript
import { ONNXAgent } from 'hypertoken/interface/ONNXAgent.js';

// Create agent
const ai = new ONNXAgent({
  modelPath: '/models/blackjack_policy.onnx',
  actionMap: {
    0: 'blackjack:hit',
    1: 'blackjack:stand'
  },
  selectionStrategy: 'argmax',  // or 'sample' for stochastic
  debug: true
});

// Load model
await ai.load();

// Use with HyperToken Engine
const bot = new Agent('AI', { agent: ai });
await bot.think(engine);  // Returns { type: 'blackjack:hit', payload: {} }
```

## Customizing the AI

### Custom Observation Extractor

If your game has a different observation format:

```javascript
const ai = new ONNXAgent({
  modelPath: '/models/my_policy.onnx',
  observationExtractor: (engine, agent) => {
    // Return array of numbers matching your training observation
    return [
      normalizedValue1,
      normalizedValue2,
      // ...
    ];
  }
});
```

### Stochastic vs Deterministic

- `selectionStrategy: 'argmax'` - Always picks highest probability action
- `selectionStrategy: 'sample'` - Samples from probability distribution (more varied play)

## Troubleshooting

### "Model not found"

Make sure:
1. You've run `train_and_export.py` to create the model
2. The .onnx file is in the same directory as index.html
3. You're serving via HTTP, not file://

### "Input shape mismatch"

Your observation must match the shape used during training (7 values for blackjack).
Check `blackjack_policy.json` for expected shape.

### Slow inference

ONNX Runtime Web uses WebGL by default. If you have GPU issues:

```javascript
// Force CPU execution
ort.env.wasm.numThreads = 4;
ort.env.webgl.disabled = true;
```

## Files

```
browser-ai/
├── index.html              # Game UI
├── game.js                 # Game logic + ONNX inference
├── blackjack_policy.onnx   # Trained model (you create this)
├── blackjack_policy.json   # Model metadata (you create this)
└── README.md               # This file
```
