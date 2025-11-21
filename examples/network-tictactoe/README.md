# Network Tic-Tac-Toe

> **Real-time multiagent game demonstrating HyperToken's network capabilities**

A complete implementation of networked tic-tac-toe showcasing:
- **Authoritative server** with game state validation
- **WebSocket communication** for real-time updates
- **Turn-based multiagent** with 2 agents
- **Automatic state synchronization** across clients
- **Spectator support** (watch games in progress)

---

## 🎮 Quick Start

### 1. Start the Server

```bash
node server.js
```

The server will start on `ws://localhost:8080` and display:
- Connection status
- Agent registrations
- Moves and turn changes
- Game outcomes

### 2. Connect First Agent

Open a new terminal:

```bash
node client.js
```

This agent will be assigned **X** and go first.

### 3. Connect Second Agent

Open another terminal:

```bash
node client.js
```

This agent will be assigned **O**.

### 4. Play!

Agents take turns entering positions (0-8) to place their mark:

```
 0 │ 1 │ 2
───┼───┼───
 3 │ 4 │ 5
───┼───┼───
 6 │ 7 │ 8
```

---

## 🏗️ Architecture

### Server-Authoritative Model

```
┌─────────────┐
│   Server    │  ← Authoritative game state
│   (Engine)  │  ← Validates all moves
└─────────────┘  ← Broadcasts updates
       │
       ├─────────────┐
       │             │
  ┌────▼───┐   ┌────▼───┐
  │Client X│   │Client O│  ← Render state
  │(Agent)│   │(Agent)│  ← Send moves
  └────────┘   └────────┘  ← Receive updates
```

**Benefits:**
- ✅ **No cheating** - Server validates everything
- ✅ **Consistent state** - Single source of truth
- ✅ **Reliable** - Disconnections don't corrupt game
- ✅ **Scalable** - Easy to add spectators

---

## 🔌 Network Protocol

### Client → Server

**Request game state:**
```json
{ "cmd": "describe" }
```

**Register as agent:**
```json
{
  "cmd": "dispatch",
  "type": "tictactoe:register",
  "payload": { "symbol": "X", "clientId": "client-123" }
}
```

**Make a move:**
```json
{
  "cmd": "dispatch",
  "type": "tictactoe:move",
  "payload": { "position": 4, "clientId": "client-123" }
}
```

**Reset game:**
```json
{
  "cmd": "dispatch",
  "type": "tictactoe:reset",
  "payload": {}
}
```

### Server → Client

**State update:**
```json
{
  "cmd": "describe",
  "state": {
    "_gameState": {
      "board": [null, "X", null, "O", "X", null, null, null, null],
      "currentAgent": "O",
      "winner": null,
      "gameOver": false,
      "agents": { "X": "client-123", "O": "client-456" }
    }
  }
}
```

**Error:**
```json
{
  "cmd": "error",
  "message": "Not your turn"
}
```

---

## 🎯 Game Actions

HyperToken actions powering the game:

### `tictactoe:init`
Initialize empty board and game state.

```javascript
engine.dispatch('tictactoe:init');
```

### `tictactoe:register`
Register a agent (X or O).

```javascript
engine.dispatch('tictactoe:register', { 
  symbol: 'X', 
  clientId: 'client-123' 
});
```

### `tictactoe:move`
Place a mark on the board.

```javascript
engine.dispatch('tictactoe:move', { 
  position: 4,  // center square
  clientId: 'client-123' 
});
```

Automatically:
- ✓ Validates turn order
- ✓ Checks position availability
- ✓ Detects wins/draws
- ✓ Switches turns

### `tictactoe:reset`
Clear board for new game.

```javascript
engine.dispatch('tictactoe:reset');
```

---

## 🔒 Server Validation

The server validates every move:

1. **Game state check** - Is game over?
2. **Position validation** - Valid position (0-8)?
3. **Availability check** - Position empty?
4. **Turn validation** - Is it this agent's turn?
5. **Win detection** - Check all 8 winning lines
6. **Draw detection** - Board full with no winner?

Invalid moves are rejected with error messages.

---

## 🎨 Client Features

### Interactive CLI
- Real-time board updates
- Clear turn indicators
- Win/draw announcements
- Command help system

### Commands
- `0-8` - Make a move
- `reset` - Start new game
- `help` - Show commands
- `quit` - Disconnect

### Visual Feedback
```
╔══════════════════════════════════════════╗
║  TIC-TAC-TOE MULTIPLAYER                ║
╚══════════════════════════════════════════╝

You are: X

 X │ 1 │ O
───┼───┼───
 3 │ X │ 5
───┼───┼───
 O │ 7 │ 8

X's turn

Your move (0-8, or "help"): 
```

---

## 🚀 Advanced Usage

### Custom Server Port

```bash
# Start server on port 3000
node server.js 3000

# Connect client to custom port
node client.js ws://localhost:3000
```

### Remote Server

```bash
# Connect to remote server
node client.js ws://game-server.example.com:8080
```

### Spectator Mode

Start a third client - it will join as spectator:
```bash
node client.js
```

Spectators see the game but cannot make moves.

---

## 🧪 Testing

The example includes comprehensive error handling:

**Test scenarios:**
1. ✓ Move out of turn → Rejected
2. ✓ Move to occupied square → Rejected
3. ✓ Move after game over → Rejected
4. ✓ Invalid position (-1, 10) → Rejected
5. ✓ Client disconnect → Game continues
6. ✓ Win detection → Game ends
7. ✓ Draw detection → Game ends

---

## 🏆 Win Conditions

8 possible winning lines:

**Rows:**
- 0, 1, 2 (top)
- 3, 4, 5 (middle)
- 6, 7, 8 (bottom)

**Columns:**
- 0, 3, 6 (left)
- 1, 4, 7 (center)
- 2, 5, 8 (right)

**Diagonals:**
- 0, 4, 8 (\)
- 2, 4, 6 (/)

---

## 🔧 Integration with HyperToken

This example demonstrates:

### Engine
- ✅ Game state management
- ✅ Action dispatch and validation
- ✅ Event emission

### RelayServer
- ✅ WebSocket hosting
- ✅ Client management
- ✅ State broadcasting

### Action Registry
- ✅ Custom game actions
- ✅ Turn validation
- ✅ Win detection logic

### Events
- ✅ `agent:registered`
- ✅ `game:started`
- ✅ `move:made`
- ✅ `turn:changed`
- ✅ `game:won`
- ✅ `game:draw`
- ✅ `game:reset`

---

## 🎓 Learning Objectives

This example teaches:

1. **Server-authoritative architecture** - Why and how
2. **WebSocket communication** - Real-time bidirectional
3. **State synchronization** - Keeping clients in sync
4. **Turn-based game logic** - Validation and flow
5. **Error handling** - Graceful failures
6. **Event-driven design** - Reacting to state changes

---

## 🌟 Extension Ideas

### Easy
- [ ] Add agent names
- [ ] Track win/loss statistics
- [ ] Implement rematch functionality
- [ ] Add move history/undo

### Medium
- [ ] Implement timer per turn
- [ ] Add chat between agents
- [ ] Create game lobby system
- [ ] Support multiple concurrent games

### Advanced
- [ ] Add AI opponent option
- [ ] Implement ELO rating system
- [ ] Create web-based UI
- [ ] Add replay system
- [ ] Tournament bracket support

---

## 🐛 Troubleshooting

### "Connection refused"
- Ensure server is running: `node server.js`
- Check firewall settings
- Verify port 8080 is available

### "Position already taken"
- Board displays current state
- Wait for state update after opponent's move

### "Not your turn"
- Turn indicator shows current agent
- Wait for your symbol's turn

### Client disconnect
- Server continues game
- Reconnect not yet implemented (future feature)

---

## 📚 Further Reading

**HyperToken Documentation:**
- [Engine Architecture](../../engine/Engine.js)
- [Action System](../../engine/ACTIONS.md)
- [Network Interface](../../interface/NetworkInterface.js)
- [Relay Server](../../interface/RelayServer.js)

**Multiagent Game Design:**
- [Networked Game Architecture](https://gafferongames.com/post/what_every_programmer_needs_to_know_about_game_networking/)
- [Server-Authoritative Design](https://developer.valvesoftware.com/wiki/Source_Multiagent_Networking)

---

## 📝 License

Copyright © 2025 The Carpocratian Church of Commonality and Equality, Inc.

Licensed under the Apache License, Version 2.0.

---

## 🙏 Credits

Built on **HyperToken** by:
- **The Carpocratian Church of Commonality and Equality, Inc.**
- **Marcellina II (she/her)**

Classic tic-tac-toe rules dating back to ancient Egypt (~1300 BCE).

---

**Enjoy your multiagent tic-tac-toe game!** 🎮✨