# Common Patterns

This guide helps you find the right example for your game type.

## Pattern Quick Reference

| Pattern | Example | Use When |
|---------|---------|----------|
| [Single-Player Card Game](#single-player-card-game) | Accordion | Solitaire, puzzles |
| [Two-Player Card Game](#two-player-card-game) | Cuttle, Blackjack | Head-to-head card games |
| [Multi-Player Card Game](#multi-player-card-game) | Poker | 3+ player card games |
| [Bluffing Game](#bluffing-game) | Coup, Liar's Dice | Hidden info, deception |
| [Game Theory Simulation](#game-theory-simulation) | Prisoner's Dilemma | Strategy simulations |
| [RL Training Environment](#rl-training-environment) | Poker, Hanabi | AI/ML training |
| [Multiplayer Networked](#multiplayer-networked) | Cuttle Web, Dungeon Raiders | Online play |

---

## Single-Player Card Game

**Example:** [Accordion](../examples/accordion/)

**Use when:** Building solitaire games, puzzles, or simulations.

**Key Components:**
- Stack for the deck
- No Engine needed (direct Stack manipulation)
- Simulation mode for probability analysis

```javascript
import { Chronicle } from './core/Chronicle.js';
import { Stack } from './core/Stack.js';

const session = new Chronicle();
const deck = new Stack(session, cards);

deck.shuffle();
const card = deck.draw();

// Game logic directly on Stack
while (hasValidMoves()) {
  makeMove();
}
```

**Key Pattern:** Direct Stack manipulation without Engine overhead.

---

## Two-Player Card Game

**Example:** [Cuttle](../examples/cuttle/), [Blackjack](../examples/blackjack/)

**Use when:** Building head-to-head card games with alternating turns.

**Key Components:**
- Stack for shared deck
- Space for player zones (hand, play area)
- Turn-based game loop
- AI opponent (random or strategic)

```javascript
class TwoPlayerGame {
  constructor() {
    this.session = new Chronicle();
    this.deck = new Stack(this.session, cards);
    this.board = new Space(this.session, 'board');

    this.board.createZone('player0-hand');
    this.board.createZone('player1-hand');
    this.board.createZone('table');

    this.currentPlayer = 0;
  }

  getValidActions(player) {
    // Return list of valid action strings
    return ['draw', 'play:card-1', 'pass'];
  }

  action(player, actionStr) {
    if (player !== this.currentPlayer) {
      return { success: false, message: 'Not your turn' };
    }
    // Execute action
    this.currentPlayer = 1 - this.currentPlayer;
    return { success: true };
  }
}
```

**Key Pattern:** Action strings (e.g., `'play:card-5'`) for serializable moves.

---

## Multi-Player Card Game

**Example:** [Poker](../examples/poker/), [Hanabi](../examples/hanabi/)

**Use when:** Building games with 3+ players.

**Key Components:**
- Stack for deck
- Per-player state (hands, resources)
- Turn order management
- Elimination handling

```javascript
class MultiPlayerGame {
  constructor(numPlayers) {
    this.players = Array(numPlayers).fill(null).map((_, i) => ({
      id: i,
      hand: [],
      chips: 100,
      alive: true
    }));
    this.currentPlayer = 0;
  }

  nextPlayer() {
    do {
      this.currentPlayer = (this.currentPlayer + 1) % this.players.length;
    } while (!this.players[this.currentPlayer].alive);
  }

  eliminatePlayer(index) {
    this.players[index].alive = false;
    const remaining = this.players.filter(p => p.alive);
    if (remaining.length === 1) {
      this.winner = remaining[0].id;
    }
  }
}
```

**Key Pattern:** Turn rotation skipping eliminated players.

---

## Bluffing Game

**Example:** [Coup](../examples/coup/), [Liar's Dice](../examples/liars-dice/)

**Use when:** Building games with hidden information and deception.

**Key Components:**
- Hidden state per player
- Observable state (what others can see)
- Challenge/block phases
- Claim verification

```javascript
class BluffingGame {
  getObservation(player) {
    // Only show what this player can see
    return {
      myHand: this.players[player].hand,
      myCoins: this.players[player].coins,
      opponents: this.players
        .filter((_, i) => i !== player)
        .map(p => ({
          coins: p.coins,
          cardCount: p.hand.filter(c => !c.revealed).length,
          revealedCards: p.hand.filter(c => c.revealed)
        }))
    };
  }

  challenge(challenger, claimedRole) {
    const target = this.pendingAction.player;
    const hasRole = this.players[target].hand.some(c => c.role === claimedRole);

    if (hasRole) {
      // Challenger loses
      this.mustLoseInfluence = challenger;
    } else {
      // Bluffer caught
      this.mustLoseInfluence = target;
    }
  }
}
```

**Key Pattern:** `getObservation(player)` returns player-specific view.

---

## Game Theory Simulation

**Example:** [Prisoner's Dilemma](../examples/prisoners-dilemma/)

**Use when:** Running strategy tournaments or game theory experiments.

**Key Components:**
- Strategy interfaces
- Payoff matrices
- Tournament runner
- Statistics collection

```javascript
// Strategy interface
class Strategy {
  constructor(name) {
    this.name = name;
    this.history = [];
  }

  decide(opponentHistory) {
    throw new Error('Implement in subclass');
  }

  record(myMove, theirMove) {
    this.history.push({ myMove, theirMove });
  }
}

// Example strategies
class AlwaysCooperate extends Strategy {
  decide() { return 'cooperate'; }
}

class TitForTat extends Strategy {
  decide(opponentHistory) {
    if (opponentHistory.length === 0) return 'cooperate';
    return opponentHistory[opponentHistory.length - 1];
  }
}

// Tournament
function runTournament(strategies, rounds = 100) {
  const scores = {};
  for (const s of strategies) scores[s.name] = 0;

  for (let i = 0; i < strategies.length; i++) {
    for (let j = i + 1; j < strategies.length; j++) {
      const [score1, score2] = playMatch(strategies[i], strategies[j], rounds);
      scores[strategies[i].name] += score1;
      scores[strategies[j].name] += score2;
    }
  }
  return scores;
}
```

**Key Pattern:** Strategy objects with `decide()` method.

---

## RL Training Environment

**Example:** [Poker AEC](../examples/poker/PokerAEC.ts), [Hanabi AEC](../examples/hanabi/HanabiAEC.ts)

**Use when:** Training AI agents with reinforcement learning.

**Key Components:**
- AEC (Agent-Environment Cycle) interface
- Observation encoding
- Action masking
- Reward shaping

```javascript
class GameAEC {
  reset() {
    this.game = new Game();
    return this.observe();
  }

  observe() {
    const player = this.currentPlayer();
    return {
      observation: this.encodeState(player),
      validActions: this.getValidActions(),
      reward: 0,
      terminated: false
    };
  }

  step(action) {
    const result = this.game.action(this.currentPlayer(), action);

    return {
      observation: this.encodeState(this.currentPlayer()),
      validActions: this.getValidActions(),
      reward: this.calculateReward(),
      terminated: this.game.isOver()
    };
  }

  getValidActions() {
    // Return action mask or list
    return this.game.getValidActions(this.currentPlayer());
  }

  encodeState(player) {
    // Return numeric array for neural network
    const obs = this.game.getObservation(player);
    return [
      ...this.encodeHand(obs.myHand),
      ...this.encodeOpponents(obs.opponents),
      // etc.
    ];
  }
}
```

**Key Pattern:** AEC interface with `reset()`, `step()`, `observe()`.

---

## Multiplayer Networked

**Example:** [Cuttle Web](../examples/cuttle/web/), [Dungeon Raiders](../examples/dungeon-raiders/)

**Use when:** Building online multiplayer games.

**Key Components:**
- WebSocket server
- Client state sync
- Chronicle for CRDT sync
- Reconnection handling

### Server Pattern

```javascript
import { WebSocketServer } from 'ws';

const wss = new WebSocketServer({ port: 8080 });
const game = new Game();
const clients = new Map();

wss.on('connection', (ws) => {
  const playerId = clients.size;
  clients.set(ws, playerId);

  // Send initial state
  ws.send(JSON.stringify({
    type: 'init',
    playerId,
    state: game.getObservation(playerId)
  }));

  ws.on('message', (data) => {
    const { action } = JSON.parse(data);
    const result = game.action(playerId, action);

    // Broadcast to all clients
    for (const [client, id] of clients) {
      client.send(JSON.stringify({
        type: 'update',
        state: game.getObservation(id)
      }));
    }
  });
});
```

### Client Pattern

```javascript
const ws = new WebSocket('ws://localhost:8080');
let playerId = null;

ws.onmessage = (event) => {
  const msg = JSON.parse(event.data);

  if (msg.type === 'init') {
    playerId = msg.playerId;
    renderGame(msg.state);
  } else if (msg.type === 'update') {
    renderGame(msg.state);
  }
};

function sendAction(action) {
  ws.send(JSON.stringify({ action }));
}
```

**Key Pattern:** Server validates, broadcasts; clients render.

---

## Choosing Your Pattern

```
Is it single-player?
  └─ Yes → Single-Player Card Game pattern

Is there hidden information?
  ├─ Yes, with bluffing → Bluffing Game pattern
  └─ Yes, cooperative → Hanabi pattern

How many players?
  ├─ 2 players → Two-Player Card Game pattern
  └─ 3+ players → Multi-Player Card Game pattern

Is it for AI training?
  └─ Yes → RL Training Environment pattern

Is it online multiplayer?
  └─ Yes → Multiplayer Networked pattern

Is it a simulation/experiment?
  └─ Yes → Game Theory Simulation pattern
```

---

## Examples by Complexity

| Level | Example | Lines of Code | Good For |
|-------|---------|---------------|----------|
| Beginner | Accordion | ~400 | Learning Stack |
| Beginner | High Card | ~100 | First game |
| Intermediate | Blackjack | ~800 | Cards + betting |
| Intermediate | Cuttle | ~1500 | Complex rules |
| Advanced | Poker | ~2000 | RL training |
| Advanced | Coup | ~1200 | Bluffing + phases |

---

## Next Steps

- [First Game Tutorial](./FIRST_GAME.md) - Build your first game
- [Extending Guide](./EXTENDING.md) - Custom actions and rules
- [Architecture Guide](./ARCHITECTURE.md) - System overview
