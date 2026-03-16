# Game Actions

High-level game state management and lifecycle control.

[← Back to Action Reference](../ACTIONS.md)

---

## Game State Actions (7)

1. `game:start` - Initialize game state
2. `game:end` - End game and record winner
3. `game:pause` - Pause the game
4. `game:resume` - Resume paused game
5. `game:nextPhase` - Advance to next phase
6. `game:setProperty` - Set arbitrary game property
7. `game:getState` - Get current game state

## GameLoop Actions (7)

These manage the turn-based game loop via `engine.dispatch()`. Used internally by `GameLoop`.

1. `game:loopInit` - Initialize game loop state in CRDT
2. `game:loopStart` - Start the game loop (running = true, turn = 1)
3. `game:loopStop` - Stop the game loop (optional phase)
4. `game:nextTurn` - Advance to next turn
5. `game:setPhase` - Set current phase
6. `game:setMaxTurns` - Set maximum turn count
7. `game:setActiveAgent` - Set active agent by index

## Rules Actions (2)

Rule engine state tracking in the CRDT document.

1. `rule:initRules` - Initialize rules state in CRDT
2. `rule:markFired` - Record that a rule has fired

---

## Quick Examples

```javascript
// Game lifecycle
engine.dispatch("game:start");
// ... play game ...
engine.dispatch("game:end", { 
  winner: "Alice", 
  reason: "checkmate" 
});

// Phase management
engine.dispatch("game:nextPhase");  // setup -> play
engine.dispatch("game:nextPhase");  // play -> scoring
engine.dispatch("game:nextPhase");  // scoring -> end

// Custom properties
engine.dispatch("game:setProperty", {
  key: "round",
  value: 3
});

// Game loop lifecycle
engine.dispatch("game:loopStart", {});
engine.dispatch("game:setPhase", { phase: "betting" });
engine.dispatch("game:setActiveAgent", { index: 0 });
engine.dispatch("game:nextTurn", {});
engine.dispatch("game:loopStop", { phase: "complete" });

// Rule tracking
engine.dispatch("rule:markFired", { name: "low-health", timestamp: Date.now() });
```

---

## Game State Structure

```javascript
engine._gameState = {
  started: true,
  startTime: 1234567890,
  phase: "play",
  turn: 5,
  ended: false,
  // Custom properties...
  round: 3,
  currentAgent: "Alice"
}
```

---

See [complete ACTIONS.md documentation](../ACTIONS-COMPLETE.md) for full details on all game actions.

[← Back to Action Reference](../ACTIONS.md)