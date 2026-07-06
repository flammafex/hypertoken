# Common Patterns

This guide helps you find the right example for your game type.

## Pattern Quick Reference

| Pattern | Example | Use When |
|---------|---------|----------|
| [Two-Player Card Game](#two-player-card-game) | Cuttle, Blackjack | Head-to-head card games |
| [Multiplayer Networked](#multiplayer-networked) | Cuttle Web, Watershed | Online play |

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

## Multiplayer Networked

**Example:** [Cuttle Web](../examples/cuttle/web/), [Watershed](../examples/watershed/)

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
Is it a 2-player card game?
  └─ Yes → Two-Player Card Game pattern

Is it online multiplayer?
  └─ Yes → Multiplayer Networked pattern
```

---

## Examples by Complexity

| Level | Example | Lines of Code | Good For |
|-------|---------|---------------|----------|
| Beginner | High Card | ~100 | First game |
| Intermediate | Blackjack | ~800 | Cards + betting |
| Intermediate | Cuttle | ~1500 | Complex rules |
| Advanced | Watershed | — | CRDT territory game |

---

## Next Steps

- [First Game Tutorial](./FIRST_GAME.md) - Build your first game
- [Extending Guide](./EXTENDING.md) - Custom actions and rules
- [Architecture Guide](./ARCHITECTURE.md) - System overview
