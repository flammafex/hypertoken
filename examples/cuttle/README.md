# Cuttle

A strategic 2-player combat card game where you race to accumulate 21 points while sabotaging your opponent.

## Quick Start

```bash
# Play in terminal (classic rules)
npm run cuttle

# Play with standard rules (cuttle.cards variant)
node --loader ./test/ts-esm-loader.js examples/cuttle/cli.js --variant standard

# Play 3-player cutthroat mode
node --loader ./test/ts-esm-loader.js examples/cuttle/cli.js --variant cutthroat
```

## Game Rules

**Objective:** Be the first to accumulate 21+ points in point cards.

### Card Types

**Point Cards (A-10):** Play for points equal to rank (Ace = 1).

**One-Off Effects (discard after use):**
| Card | Effect |
|------|--------|
| A | Destroy ALL point cards (yours too!) |
| 2 | Destroy a permanent OR counter a one-off |
| 3 | Retrieve any card from scrap pile |
| 4 | Opponent discards 2 cards |
| 5 | Draw 2 cards (or discard 1, draw 3 in standard) |
| 6 | Destroy ALL permanents |
| 7 | Draw and immediately play top card |
| 9 | Return any card to owner's hand |

**Permanents (stay in play):**
| Card | Effect |
|------|--------|
| 8 | Opponent's hand is revealed |
| J | Steal control of opponent's point card |
| Q | Protects your other cards from targeting |
| K | Reduces goal: 21 → 14 → 10 → 7 → 5 |

**Scuttling:** Use a higher card from hand to destroy opponent's point card.

## Variants

### Classic (Default)
- Original rules
- 7 draws and must play immediately
- Goal reduction: 21 → 14 → 10 → 7 → 5

### Standard (cuttle.cards)
- 7 reveals top 2, choose 1 to play
- 5 discards 1, draws 3
- Goal reduction: 21 → 14 → 10 → 5 → 0

### Cutthroat (3-Player)
- 54-card deck with 2 Jokers
- First to 14 points wins
- Jokers can steal royals (J, Q, K)

## Multiplayer

### Start Server
```bash
npm run cuttle:server
```

### Connect Clients
```bash
npm run cuttle:client
```

### Web Interface
Open `examples/cuttle/web/index.html` in a browser for the graphical version.

## What You'll Learn

- **Space zones:** Cards placed in point area, permanent area, scrap pile
- **Token attachments:** Jacks attach to point cards
- **Game phases:** Main phase, counter phase, resolution
- **AI opponents:** Random strategy (great for RL training baseline)

## Files

```
cuttle/
├── cli.js           # Terminal interface
├── CuttleGame.js    # Core game logic
├── game-actions.js  # Action definitions
├── server.js        # Multiplayer server
├── network-client.js # Multiplayer client
└── web/
    ├── index.html   # Web UI
    ├── cuttle-web.js # Web game logic
    └── styles.css   # Styling
```

## Key Patterns

```javascript
import { CuttleGame } from './CuttleGame.js';

// Create game with variant
const game = new CuttleGame({ variant: 'classic' });

// Get valid actions for player
const actions = game.getValidActions(0);

// Execute action
const result = game.action(0, 'point:5');

// Get observation (what player can see)
const obs = game.getObservation(0);
```
