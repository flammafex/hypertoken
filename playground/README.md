# HyperToken Playground

An interactive web-based IDE for HyperToken — experience distributed game simulations in 30 seconds with no install required.

The Playground is a **debugger-first environment** for building, testing, and training game simulations. Think of it as a "Bloomberg Terminal for game simulations" — everything you need to understand what's happening in your simulation, all in one place.

## Features

### 🎮 Games
- **Blackjack** — Casino-grade with proper rules, deck management, and AI opponents
- **Tic-Tac-Toe** — Classic strategy game with heuristic AI
- **Prisoner's Dilemma** — Game theory exploration with Tit-for-Tat opponent

### 🔍 State Inspector
Live tree view of engine state with real-time updates:
- Collapsible nested object exploration
- Type indicators (string, number, boolean, array, object)
- Syntax-colored values
- Change detection with flash animations
- Search and filter functionality

### ⏱️ Action Timeline
Horizontal timeline showing every action in your simulation:
- Color-coded nodes by source (user, AI, rule, network)
- Draggable playhead for time-travel debugging
- Hover tooltips with action summaries
- Click for detailed state diffs
- "Return to Live" to exit historical view
- Keyboard navigation (← →)

### 📡 Peer Monitor
Network debugging panel for distributed simulations:
- Connection status summary
- Peer cards with latency and sync status
- Transport indicators (WebRTC 🚀, WebSocket 📡, TURN ⚡)
- Real-time activity sparklines
- Ping functionality

### 📜 Rule Composer
Visual rule builder with two modes:

**Form Mode:**
- Condition builder with dropdowns and comparators
- Action builder with presets (dispatch, set property, advance turn)
- Live code preview
- Rule templates for common patterns

**DSL Mode:**
- Human-readable rule syntax
- Syntax highlighting
- Real-time error detection
- Bidirectional conversion (form ↔ DSL)

### 📊 AI Training Dashboard
Comprehensive training visualization:
- Real-time reward charts with moving averages
- Action distribution bar charts
- Statistics panel (episodes, win rate, convergence)
- Episode trajectory inspector
- Policy heatmaps (for applicable games)
- Configurable training parameters
- Start/pause/resume controls
- Export training results to JSON

### 🎨 Token Canvas
2D spatial visualization for token-based games:
- Drag-and-drop token manipulation
- Zone management with visual boundaries
- Card rendering (suits, ranks, face up/down)
- Zoom and pan controls
- Grid overlay with snap-to-grid
- Token detail popups
- Zone editor for layout patterns (fan, stack, spread)

## Quick Start

### Option 1: npx serve

```bash
npx serve playground/
```

Then open http://localhost:3000

### Option 2: Python

```bash
cd playground
python -m http.server 8000
```

Then open http://localhost:8000

### Option 3: Node.js http-server

```bash
npm install -g http-server
http-server playground/ -p 8080
```

Then open http://localhost:8080

## Games

### Blackjack

Classic casino blackjack against the dealer:

| Action | Description |
|--------|-------------|
| **Hit** | Draw another card |
| **Stand** | Keep your current hand |
| **New Hand** | Deal a fresh hand |

The AI training mode uses configurable policies to explore optimal play strategies. Watch the policy heatmap evolve to show hit/stand probabilities across different hand combinations.

### Tic-Tac-Toe

Play X against an AI opponent (O):
- Click any empty cell to place your mark
- AI uses win/block/center/corner heuristics
- Training pits strategies against each other

The Token Canvas displays the 3×3 grid with visual token placement.

### Prisoner's Dilemma

Classic game theory scenario:

| Your Choice | Opponent Cooperates | Opponent Defects |
|-------------|---------------------|------------------|
| **Cooperate** | 3 / 3 | 0 / 5 |
| **Defect** | 5 / 0 | 1 / 1 |

Opponent uses Tit-for-Tat: cooperates first, then mirrors your previous choice. Training explores how different strategies perform over repeated rounds.

## IDE Panels

### State Inspector (Left Panel)

The State Inspector shows a live tree view of your game's internal state:

```
▼ gameType: "blackjack"
▼ playerHand
  ▼ 0
    ├─ display: "A♠"
    ├─ rank: "A"
    ├─ suit: "spades"
    └─ value: 11
  ▼ 1
    └─ ...
├─ playerValue: 18
▼ dealerHand
  └─ ...
└─ gameOver: false
```

**Features:**
- Auto-expands on state changes
- Highlights changed values with yellow flash
- Resizable panel width
- Search to filter properties

### Action Timeline (Bottom Panel)

Every action is recorded and visualized:

```
[🔵]──[🟢]──[🟡]──[🟣]──[🔵]──▶
 User   AI   Rule  Net   User   Live
```

**Node colors:**
- 🔵 Blue — User actions
- 🟢 Green — AI decisions
- 🟡 Yellow — Rule triggers
- 🟣 Purple — Network sync

**Usage:**
- Drag the playhead to scrub through history
- Click a node to see action details and state diff
- Double-click to jump to that point in time
- Press "Return to Live" to exit historical view

### Peer Monitor (Right Panel)

For networked simulations, the Peer Monitor shows:

```
┌─────────────────────────────┐
│ 3 Connected  2 Syncing      │
├─────────────────────────────┤
│ 🟢 Alice    12ms   Synced ✓ │
│ 🟡 Bob      45ms   Syncing  │
│ 🔴 Charlie  --     Offline  │
└─────────────────────────────┘
```

Activity sparklines show traffic over the last 30 seconds.

### Rule Composer (Panel)

Create reactive rules without writing code:

**Form Mode Example:**
```
WHEN
  [Action Type] [equals] [stack:draw]
  AND [Stack Size] [<] [10]

THEN
  [Dispatch Action] [stack:reshuffle]

OPTIONS
  Priority: 50
  ☐ Fire once only
```

**DSL Mode Example:**
```
RULE "auto-reshuffle"
  WHEN action.type = "stack:draw"
   AND stack.size < 10
  THEN dispatch "stack:reshuffle"
  PRIORITY 50
```

Rules can be imported/exported as JSON for sharing.

### Training Dashboard (Panel)

Configure and monitor AI training:

**Progress:**
```
████████████░░░░░░░░  Episode 450/1000 (45%)
ETA: 2:30  |  Speed: 180 ep/s
```

**Metrics:**
- Episode reward chart with 50-episode moving average
- Win/loss/tie statistics
- Convergence detection (improving → stable → converged)
- Action frequency distribution

**Episode Inspector:**
- Click any episode to see its full trajectory
- Step-by-step state/action/reward breakdown
- Replay episodes visually

**Policy Heatmap (Blackjack):**
- Player value (4-21) vs Dealer showing (2-A)
- Color gradient showing hit probability
- Compare learned policy to basic strategy

### Token Canvas (Panel)

Spatial visualization for token-based games:

```
┌──────────────────┐
│   Dealer Hand    │
│   [?] [K♠]       │
└──────────────────┘

┌──────────────────┐
│   Player Hand    │
│ [A♠][5♥][9♣]     │
└──────────────────┘
```

**Interactions:**
- Drag tokens between zones
- Double-click to flip cards
- Double-click zones to edit layout
- Zoom in/out with controls
- Toggle grid overlay

## Keyboard Shortcuts

| Key | Action |
|-----|--------|
| `←` `→` | Navigate timeline |
| `Space` | Pause/resume training |
| `Escape` | Close modals |
| `F` | Flip selected token |
| `Delete` | Remove selected token |

## File Structure

```
playground/
├── index.html              # Main HTML with panel layout
├── playground.js           # Core application logic
│
├── components/
│   ├── state-inspector.js  # Live state tree view
│   ├── action-timeline.js  # Action history timeline
│   ├── peer-monitor.js     # Network peer status
│   ├── rule-composer.js    # Visual rule builder
│   ├── dsl-editor.js       # DSL text editor
│   ├── training-dashboard.js # AI training UI
│   ├── token-canvas.js     # 2D spatial view
│   ├── token-detail.js     # Token popup
│   └── zone-editor.js      # Zone configuration
│
├── training/
│   └── TrainingSession.js  # Training loop manager
│
├── rules/
│   ├── RuleManager.js      # Rule storage & execution
│   ├── DSLParser.js        # Parse DSL to JSON
│   └── DSLGenerator.js     # Generate DSL from JSON
│
├── network/
│   └── MockNetworkManager.js # Simulated P2P network
│
└── games/
    ├── blackjack.js        # Blackjack implementation
    ├── tictactoe.js        # Tic-Tac-Toe implementation
    └── prisoners.js        # Prisoner's Dilemma
```

## Technical Notes

- **No build step** — Uses ES modules with Preact + HTM from CDN
- **Preact + HTM** — React-like components in ~3kb, no JSX compilation
- **Canvas API** — Token Canvas uses 2D canvas for smooth rendering
- **Chart.js** — Reward charts loaded from CDN
- **localStorage** — Rules persist across sessions
- **Mobile responsive** — Works on tablets and phones

## Deployment

### GitHub Pages

1. Push the `playground/` folder to a `gh-pages` branch
2. Enable GitHub Pages in repository settings
3. Access at `https://<username>.github.io/<repo>/playground/`

### Netlify / Vercel

Point to the `playground/` directory as the publish directory.

### Static Hosting

Copy the entire `playground/` folder to any static file server. No server-side code required.

## Extending the Playground

### Adding a New Game

1. Create `games/your-game.js` implementing:
   - `init()` — Set up initial state
   - `render()` — Update DOM
   - `cleanup()` — Remove event listeners
   - `getState()` — Return current observation
   - `step(action)` — Execute action, return `{ observation, reward, terminated, truncated, info }`
   - `reset()` — Reset to initial state
   - `getActionLabels()` — Map action indices to names

2. Register in `playground.js`:
   ```javascript
   import { YourGame } from './games/your-game.js';
   const games = { ..., yourgame: YourGame };
   ```

3. Add option in `index.html`:
   ```html
   <option value="yourgame">Your Game</option>
   ```

### Adding Custom Rules

Use the Rule Composer UI, or programmatically:

```javascript
const ruleManager = window.__HYPERTOKEN_RULES__;

ruleManager.addRule({
  id: crypto.randomUUID(),
  name: 'my-rule',
  enabled: true,
  conditions: {
    match: 'all',
    items: [
      { type: 'action', field: 'type', comparator: 'equals', value: 'game:start' }
    ]
  },
  actions: [
    { type: 'log', message: 'Game started!' }
  ],
  options: { priority: 50, once: false }
});
```

### Accessing State Programmatically

```javascript
// Current game state
const state = window.__HYPERTOKEN_STATE__();

// Action history
const history = window.__HYPERTOKEN_HISTORY__();

// Rule manager
const rules = window.__HYPERTOKEN_RULES__();
```

## License

Apache 2.0 — See main repository LICENSE file.

---

**HyperToken Playground** — A complete debugging environment for distributed game simulations. Build, test, train, and understand your simulations without leaving your browser.
