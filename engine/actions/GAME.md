# Game Actions

High-level game state management and lifecycle control.

[← Back to Action Reference](../ACTIONS.md)

---

## Actions (6)

1. `game:start` - Initialize game state
2. `game:end` - End game and record winner
3. `game:pause` - Pause the game
4. `game:resume` - Resume paused game
5. `game:nextPhase` - Advance to next phase
6. `game:setProperty` - Set arbitrary game property

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