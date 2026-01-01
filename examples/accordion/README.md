# 🃏 Accordion Solitaire &mdash; Good luck, robot!

**The nearly impossible solitaire game - perfect for probability research!**

Estimated win rate: **~1 in 1000+ games** (possibly worse!)

---

## About

Accordion Solitaire is one of the hardest solitaire games to win. It's so difficult that it's actually perfect for:
- Testing random number generators
- Studying probability
- Running simulations
- Observing emergent patterns
- AI training (can a neural network learn to win?)

### Rules

1. **Setup**: Deal all 52 cards in a row, face up
2. **Movement**: A card can move onto:
   - The card **1 position to its left**, OR
   - The card **3 positions to its left**
3. **Match condition**: Cards can only move if they match in:
   - **Rank** (e.g., both 7s), OR
   - **Suit** (e.g., both ♠)
4. **Goal**: Collapse all 52 cards into a single pile

### Why It's Hard

- No planning ahead possible - each move changes all future possibilities
- Seemingly good moves can block you later
- The 3-left vs 1-left choice creates exponential complexity
- Almost impossible to backtrack mentally
- **Estimated win rate: < 0.1%**

---

## Usage

### Interactive Play

```bash
node accordion.js
```

Commands:
- `m <from> <to>` - Move card from position `from` to `to`
- `h` - Show all legal moves (hint)
- `u` - Undo last move
- `a` - Auto-play using greedy strategy
- `q` - Quit

### Auto-Play One Game

```bash
node accordion.js --auto
```

Watch the algorithm play using a greedy strategy (prefers 3-left moves).

### Run Simulations

```bash
# Run 100 games
node accordion.js --simulate 100

# Run 1000 games (takes a minute)
node accordion.js --simulate 1000

# Run 10000 games (serious statistics!)
node accordion.js --simulate 10000
```

### Replay Specific Game

```bash
# Play specific seed
node accordion.js --seed 42 --auto
```

Seeds make games reproducible - same shuffle every time!

---

## Example Output

```
🃏 Accordion Solitaire - Cards Dealt!

Current row:
[0:2♠] [1:4♥] [2:3♦] [3:10♥] [4:3♣] [5:7♥] ...

Cards remaining: 52 | Moves: 0

> h

Legal moves:
  4 -> 3: 3♣ onto 10♥ (1-left)
  4 -> 1: 3♣ onto 4♥ (3-left)
  5 -> 2: 7♥ onto 3♦ (3-left)
  8 -> 5: 5♥ onto 7♥ (3-left)

> m 4 1

Move 1: 3♣ -> 4♥
(moved 3 positions left)

Cards remaining: 51 | Moves: 1
```

---

## Simulation Results

From a **100-game simulation**:

```
============================================================
SIMULATION RESULTS
============================================================
Games played: 100
Wins: 0 (0.00%)
Win rate: ~1 in 100+
Average moves per game: 34.7

Best result: 9 cards left
Worst result: 30 cards left

Distribution of final card counts:
 9 cards:    1 (  1.0%) █
10 cards:    1 (  1.0%) █
11 cards:    5 (  5.0%) ███
12 cards:    8 (  8.0%) ████
13 cards:    3 (  3.0%) ██
14 cards:   11 ( 11.0%) ██████
15 cards:    9 (  9.0%) █████
16 cards:   10 ( 10.0%) █████
17 cards:    7 (  7.0%) ████
18 cards:    8 (  8.0%) ████
19 cards:    9 (  9.0%) █████
20 cards:    7 (  7.0%) ████
...
```

**Key observations:**
- Modal outcome: 14-16 cards remaining
- Best case: 9 cards (but still not winning!)
- Most games end with 10-25 cards
- No wins in 100 games is typical

---

## Strategy Notes

### Greedy Strategy (Default)

The built-in strategy prefers **3-left moves** over 1-left moves.

**Reasoning:**
- 3-left moves "compress" the row more
- Creates more opportunities for future moves
- Slightly better win rate than random

### Why It Still Fails

Even with the greedy strategy:
- Win rate remains abysmal
- The game state space is too large
- Local optimums create global deadlocks
- No amount of lookahead seems to help

### Could AI Do Better?

This is an **open question!** Ideas:
- Deep reinforcement learning (DQN, PPO)
- Monte Carlo tree search
- Genetic algorithms
- Exhaustive search on smaller stacks

**Research opportunity:** Can you create an agent that wins >1%?

---

## Implementation Details

### HyperToken Integration

This implementation uses HyperToken's:
- **Chronicle** for CRDT-based state management
- **Stack** for standard 52-card deck with deterministic shuffling
- **Token** for card representation
- **Seeded RNG** for reproducible games

### Game State

```javascript
game.row = [card1, card2, card3, ...];  // The card row
game.moveCount = 42;                     // Moves made
game.history = [[...], [...], ...];     // For undo
```

### Performance

- Single game: ~50ms
- 100 games: ~1 second
- 1000 games: ~10 seconds
- 10000 games: ~90 seconds

All processing is single-threaded JavaScript.

---

## Research Ideas

### Probability Studies

1. **Win rate**: How often can this actually be won?
2. **Move distribution**: How many moves until stuck?
3. **Best possible**: Is there a theoretical upper bound?
4. **Card ordering**: Do certain shuffles create more wins?

### AI Challenges

1. **Can you beat 1% win rate?**
2. **What's the minimum lookahead needed?**
3. **Can transfer learning help?** (Train on smaller stacks)
4. **Is there a hidden strategy?**

### Statistical Analysis

1. **Rank vs suit**: Which matters more?
2. **Position effects**: Are certain positions more critical?
3. **Collapse rate**: How fast does the row shrink?
4. **Deadlock patterns**: What configurations are unwinnable?

---

## Files

```
accordion/
├── accordion.js       # Main game implementation
└── README.md          # This file
```

---

## Fun Facts

- **Origin**: Believed to be from late 1800s
- **Other names**: Idle Year, Methuselah, Tower of Babel
- **Difficulty**: Ranked among hardest solitaires
- **Win rate**: Estimated < 0.1% (some say < 0.01%!)
- **Perfect for**: When you want to feel humble

---

## Challenges

### Personal Challenges

- **The Lucky One**: Win a single game (good luck!)
- **Nine's the Best**: Get down to 9 cards or fewer
- **Speed Runner**: Complete 10 games in under 30 seconds
- **Simulation King**: Run 10,000 games and analyze results

### AI Challenges

- **Beat Random**: Create agent better than random play
- **Beat Greedy**: Beat the 3-left preference strategy
- **Reach 5%**: Get 5% win rate (would be revolutionary!)
- **The Holy Grail**: Prove optimal strategy exists

---

## Why This Matters

Accordion Solitaire isn't just a game - it's a **probability puzzle**:

1. **Emergent Complexity**: Simple rules → extreme difficulty
2. **Research Value**: Perfect testbed for AI/ML
3. **Statistical Goldmine**: Rich data for analysis
4. **Humility Lesson**: Sometimes math just says "no"

**It embodies the spirit of HyperToken**: A simple, deterministic system that generates fascinating emergent behavior.

---

## Try It Now!

```bash
# Play interactively
node accordion.js

# See how bad it really is
node accordion.js --simulate 1000
```

Good luck - you'll need it! 🍀

---

**Remember:** If you win even once, you've accomplished something statistically remarkable! 🎉
