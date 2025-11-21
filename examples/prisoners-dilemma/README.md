# Prisoner's Dilemma Tournament System

> **Classic game theory experiment built with HyperToken**

A complete implementation of the Prisoner's Dilemma with 14 classic strategies and a tournament system for exploring cooperation, competition, and emergence of social norms.

---

## 🎮 What is Prisoner's Dilemma?

The Prisoner's Dilemma is a fundamental problem in game theory that demonstrates why rational individuals might not cooperate, even when it's in their best interest.

### The Setup

Two agents simultaneously choose to **cooperate** (C) or **defect** (D):

```
                Agent 2
              C         D
         C  (3,3)     (0,5)
Agent 1
         D  (5,0)     (1,1)
```

**Payoffs**:
- Both cooperate → 3 points each (**Reward**)
- Both defect → 1 point each (**Punishment**)
- One defects, other cooperates → 5 points (**Temptation**), 0 points (**Sucker's Payoff**)

### The Dilemma

Each agent's best individual strategy is to defect, but if both defect, they get a worse outcome than if both had cooperated!

---

## 🚀 Quick Start

### Run a Tournament

```bash
node pd-cli.js
```

### Run a Demo

```javascript
import { runDemo } from './pd-cli.js';
await runDemo();
```

### Custom Tournament

```javascript
import { Tournament } from './tournament.js';
import { STRATEGIES } from './strategies.js';

const engine = new Engine();
const tournament = new Tournament(engine, { rounds: 100 });

// Add strategies
tournament.addStrategy('Tit for Tat', STRATEGIES.titForTat.fn);
tournament.addStrategy('Always Cooperate', STRATEGIES.alwaysCooperate.fn);
tournament.addStrategy('Always Defect', STRATEGIES.alwaysDefect.fn);

// Run
await tournament.run();
tournament.printResults();
```

---

## 📚 Included Strategies

### 14 Classic Strategies

| Strategy | Description | Behavior |
|----------|-------------|----------|
| **Tit for Tat** | Winner of Axelrod's tournament | Cooperate first, then copy opponent |
| **Always Cooperate** | Pure altruist | Always cooperates |
| **Always Defect** | Pure defector | Always defects |
| **Grudger** | Grim trigger | Cooperates until defected against once |
| **Pavlov** | Win-stay, lose-shift | Repeats if good payoff, switches if bad |
| **Tit for Two Tats** | More forgiving | Only retaliates after 2 defections |
| **Generous Tit for Tat** | Occasional forgiveness | Tit for Tat with 10% forgiveness |
| **Suspicious Tit for Tat** | Starts hostile | Like Tit for Tat but defects first |
| **Adaptive** | Learns opponent | Matches opponent's cooperation rate |
| **Gradual** | Escalating punishment | Punishes more each time, then forgives |
| **Prober** | Tests opponent | Probes for weakness, exploits if found |
| **Soft Majority** | Democratic | Cooperates if opponent cooperated ≥50% |
| **Hard Majority** | Strict democratic | Cooperates only if opponent cooperated >50% |
| **Random** | Unpredicspace | 50/50 random choice |

---

## 🏆 Tournament System

### Round-Robin Format

Every strategy plays every other strategy for a set number of rounds (default: 100).

### Scoring

Strategies accumulate points based on payoffs:
- Total Score: Sum of all points
- Average Score: Points per round
- Win Rate: Percentage of games won

### Example Output

```
════════════════════════════════════════════════════════════
TOURNAMENT RESULTS
════════════════════════════════════════════════════════════

FINAL STANDINGS:

Rank  Strategy                 Score     Avg     W-L-T       Win%    Coop%
────────────────────────────────────────────────────────────────────
1     Tit for Tat              2850      3.800   5-1-1       71.4%   85.2%
2     Generous Tit for Tat     2790      3.720   4-2-1       57.1%   88.1%
3     Grudger                  2650      3.533   4-2-1       57.1%   67.3%
4     Adaptive                 2580      3.440   3-3-1       42.9%   72.5%
5     Always Cooperate         2100      2.800   0-6-1       0.0%    100.0%
6     Always Defect            2050      2.733   6-1-0       85.7%   0.0%
...

KEY INSIGHTS:

🏆 Winner: Tit for Tat
   Total Score: 2850
   Average Score: 3.800 per round
   Win Rate: 71.4%
   Cooperation Rate: 85.2%

🤝 Most Cooperative: Always Cooperate (100.0%)
⚔️  Most Competitive: Always Defect (0.0%)

📊 Average Cooperation Rate: 65.3%
════════════════════════════════════════════════════════════
```

---

## 🧠 Strategy Analysis

### Why Tit for Tat Often Wins

1. **Nice** - Never defects first
2. **Retaliatory** - Punishes defection immediately
3. **Forgiving** - Returns to cooperation quickly
4. **Clear** - Easy for opponents to understand

### Key Insights

**Cooperation Pays**: Strategies that balance cooperation with retaliation tend to score highest.

**Always Defect Paradox**: Wins individual games but loses tournaments because it forces mutual defection.

**Forgiveness Matters**: Slightly more forgiving strategies (Generous Tit for Tat) can outperform strict retaliation.

**Context Dependent**: Best strategy depends on the population of opponents.

---

## 💻 API Reference

### Game Class

```javascript
import { createGame, COOPERATE, DEFECT } from './prisoners-dilemma.js';

const game = createGame(engine, {
  rounds: 100,
  payoffs: PAYOFFS // optional custom payoffs
});

// Initialize
game.initialize(
  { name: 'Alice', strategy: titForTat },
  { name: 'Bob', strategy: alwaysDefect }
);

// Play
await game.playGame();

// Get results
const results = game.getResults();
console.log(game.getSummary());
```

### Tournament Class

```javascript
import { Tournament } from './tournament.js';

const tournament = new Tournament(engine, {
  rounds: 100,
  verbose: true
});

tournament.addStrategy('My Strategy', myStrategyFunction);
await tournament.run();
tournament.printResults();
```

### Custom Strategy

```javascript
function myStrategy(ownHistory, opponentHistory, round) {
  // ownHistory: array of your past moves
  // opponentHistory: array of opponent's past moves
  // round: current round number
  
  if (round === 1) {
    return COOPERATE;
  }
  
  // Your logic here
  return COOPERATE; // or DEFECT
}
```

---

## 🔬 Educational Use

### Game Theory Concepts

This implementation demonstrates:
- **Nash Equilibrium** - Mutual defection
- **Pareto Optimality** - Mutual cooperation
- **Dominant Strategies** - Individual rationality
- **Evolutionary Stability** - Tournament evolution
- **Emergence** - Social norms from simple rules

### Classroom Activities

1. **Compare Strategies** - Run tournaments with different strategy sets
2. **Design Strategies** - Create new strategies and test them
3. **Parameter Exploration** - Vary payoffs, rounds, populations
4. **Agent Evolution** - Track which strategies survive over generations
5. **Real-World Parallels** - Discuss arms races, trade, climate change

---

## 📊 Advanced Features

### Custom Payoff Matrix

```javascript
const customPayoffs = {
  CC: { p1: 4, p2: 4 },  // Higher cooperation reward
  CD: { p1: 0, p2: 6 },  // Higher temptation
  DC: { p1: 6, p2: 0 },
  DD: { p1: 2, p2: 2 }   // Higher punishment
};

const game = createGame(engine, { payoffs: customPayoffs });
```

### Export Results

```bash
node pd-cli.js --export
```

Saves results to `tournament-results-{timestamp}.json`

### Select Specific Strategies

```bash
node pd-cli.js --strategies=titForTat,grudger,pavlov --rounds=200
```

---

## 🎯 Real-World Applications

### Where Prisoner's Dilemma Appears

- **International Relations** - Arms races, trade agreements
- **Business** - Price competition, cooperation vs. competition
- **Environmental Policy** - Climate change, resource management
- **Biology** - Evolution of cooperation in nature
- **Social Networks** - Trust, reputation, reciprocity
- **Cryptocurrency** - Byzantine fault tolerance, consensus

---

## 📈 Performance

- **Fast**: 100-round tournament with 14 strategies completes in <1 second
- **Scalable**: Can handle hundreds of strategies
- **Memory Efficient**: Tracks only essential game history

---

## 🧪 Testing

Run the test suite:

```bash
node testPD.js
```

Tests cover:
- Game mechanics
- Strategy behavior
- Tournament logic
- Edge cases

---

## 🎓 Further Reading

### Classic Papers

- Axelrod, R. (1984). *The Evolution of Cooperation*
- Nowak, M. A., & Sigmund, K. (1993). "A strategy of win-stay, lose-shift"
- Press, W. H., & Dyson, F. J. (2012). "Iterated Prisoner's Dilemma"

### Online Resources

- [Stanford Encyclopedia: Prisoner's Dilemma](https://plato.stanford.edu/entries/prisoner-dilemma/)
- [Axelrod's Tournament Results](http://www.prisoners-dilemma.com/)
- [Nicky Case: Evolution of Trust](https://ncase.me/trust/)

---

## 🔧 Integration with HyperToken

This implementation uses:
- ✅ **Engine** - Core game coordination
- ✅ **Actions** - Agent creation, resource management
- ✅ **Events** - Round completion, game end
- ✅ **Multi-Agent System** - Strategy-based agents

### Extending the System

Add new strategies:
```javascript
import { STRATEGIES } from './strategies.js';

STRATEGIES.myNewStrategy = {
  name: 'My New Strategy',
  fn: (ownHist, oppHist) => {
    // Your logic
  },
  description: 'Does something interesting'
};
```

Track additional metrics:
```javascript
tournament.on('game:end', (results) => {
  // Custom analysis
});
```

---

## 📝 License

Copyright 2025 The Carpocratian Church of Commonality and Equality, Inc.

Licensed under the Apache License, Version 2.0

---

## 🤝 Contributing

Ideas for extensions:
- Evolutionary tournaments (strategies that adapt)
- Spatial Prisoner's Dilemma (grid-based)
- N-agent variations (public goods games)
- Noisy environments (misunderstandings)
- Memory-limited strategies
- Neural network strategies

---

**Built with HyperToken - Proving that cooperation can emerge from simple rules** 🎮