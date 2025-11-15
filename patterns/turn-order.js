/*
 * Copyright 2025 The Carpocratian Church of Commonality and Equality, Inc.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *      http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

/**
 * Turn Order Rule Patterns
 * 
 * Common patterns for managing player turns, round progression,
 * and sequential game flow.
 */

/**
 * Register round-robin turn order rules
 * Players take turns in sequence, cycling back to the first player
 * 
 * @param {RuleEngine} ruleEngine
 * @param {Object} opts - Configuration options
 * @param {string} opts.triggerAction - Action type that ends a turn (default: "player:endTurn")
 * @param {boolean} opts.skipInactive - Skip eliminated/inactive players (default: true)
 */
export function registerRoundRobinTurns(ruleEngine, opts = {}) {
  const {
    triggerAction = "player:endTurn",
    skipInactive = true
  } = opts;
  
  ruleEngine.addRule(
    "round-robin-advance",
    (engine, lastAction) => {
      if (!lastAction || lastAction.type !== triggerAction) return false;
      const players = engine._players || [];
      return players.length > 0;
    },
    (engine) => {
      const players = engine._players;
      const currentIdx = players.findIndex(p => p.active);
      
      if (currentIdx === -1) {
        // No active player, start with first
        players[0].active = true;
        return;
      }
      
      // Deactivate current player
      players[currentIdx].active = false;
      
      // Find next player (skip inactive if configured)
      let nextIdx = (currentIdx + 1) % players.length;
      let attempts = 0;
      
      while (skipInactive && attempts < players.length) {
        if (players[nextIdx].status !== "eliminated" && 
            players[nextIdx].status !== "inactive") {
          break;
        }
        nextIdx = (nextIdx + 1) % players.length;
        attempts++;
      }
      
      // Activate next player
      players[nextIdx].active = true;
      
      // Emit turn change event
      engine.emit("turn:changed", {
        payload: {
          from: players[currentIdx].name,
          to: players[nextIdx].name,
          turnNumber: (engine._gameState?.turnNumber || 0) + 1
        }
      });
      
      // Increment turn counter
      if (!engine._gameState) engine._gameState = {};
      engine._gameState.turnNumber = (engine._gameState.turnNumber || 0) + 1;
    },
    { priority: 100 }
  );
}

/**
 * Register round completion detection
 * Detects when all players have completed their turns in a round
 * 
 * @param {RuleEngine} ruleEngine
 * @param {Object} opts - Configuration options
 * @param {Function} opts.onRoundComplete - Callback when round completes
 * @param {string} opts.nextPhase - Phase to transition to (default: "scoring")
 */
export function registerRoundCompletion(ruleEngine, opts = {}) {
  const {
    onRoundComplete = null,
    nextPhase = "scoring"
  } = opts;
  
  ruleEngine.addRule(
    "detect-round-complete",
    (engine) => {
      const players = engine._players || [];
      if (players.length === 0) return false;
      
      // Check if all players have completed their turn
      const allComplete = players.every(p => 
        p.turnComplete === true || p.status === "eliminated"
      );
      
      const inPlay = engine._gameState?.phase === "play";
      
      return allComplete && inPlay;
    },
    (engine) => {
      const roundNum = (engine._gameState?.roundNumber || 0) + 1;
      
      // Emit round complete event
      engine.emit("round:complete", {
        payload: { roundNumber: roundNum }
      });
      
      // Reset turn flags
      engine._players.forEach(p => {
        p.turnComplete = false;
      });
      
      // Execute callback if provided
      if (onRoundComplete) {
        onRoundComplete(engine);
      }
      
      // Advance to next phase
      engine.dispatch("game:nextPhase", { phase: nextPhase });
      
      // Update state
      if (!engine._gameState) engine._gameState = {};
      engine._gameState.roundNumber = roundNum;
      engine._gameState.turnNumber = 0;
    },
    { priority: 90, once: true }
  );
}

/**
 * Register turn time limit enforcement
 * Automatically skips turn if player doesn't act within time limit
 * 
 * @param {RuleEngine} ruleEngine
 * @param {Object} opts - Configuration options
 * @param {number} opts.timeLimit - Time limit in milliseconds (default: 60000)
 * @param {Function} opts.onTimeout - Callback when timeout occurs
 */
export function registerTurnTimer(ruleEngine, opts = {}) {
  const {
    timeLimit = 60000, // 60 seconds
    onTimeout = null
  } = opts;
  
  ruleEngine.addRule(
    "enforce-turn-timer",
    (engine) => {
      const turnStart = engine._gameState?.turnStartTime;
      const waitingForPlayer = engine._gameState?.waitingForPlayer;
      
      if (!turnStart || !waitingForPlayer) return false;
      
      const elapsed = Date.now() - turnStart;
      return elapsed > timeLimit;
    },
    (engine) => {
      const activePlayer = engine._players?.find(p => p.active);
      
      // Emit timeout event
      engine.emit("turn:timeout", {
        payload: { 
          player: activePlayer?.name,
          elapsed: Date.now() - engine._gameState.turnStartTime
        }
      });
      
      // Execute callback if provided
      if (onTimeout) {
        onTimeout(engine, activePlayer);
      }
      
      // Force skip turn
      engine.dispatch("player:endTurn", { forced: true });
      
      // Clear timer state
      delete engine._gameState.turnStartTime;
      delete engine._gameState.waitingForPlayer;
    },
    { priority: 95 }
  );
}

/**
 * Register first player selection rules
 * Determines who goes first based on various criteria
 * 
 * @param {RuleEngine} ruleEngine
 * @param {Object} opts - Configuration options
 * @param {string} opts.method - Selection method: "random", "youngest", "oldest", "score"
 */
export function registerFirstPlayerSelection(ruleEngine, opts = {}) {
  const { method = "random" } = opts;
  
  ruleEngine.addRule(
    "select-first-player",
    (engine) => {
      const gameStarted = engine._gameState?.started;
      const noActivePlayer = !engine._players?.some(p => p.active);
      return gameStarted && noActivePlayer;
    },
    (engine) => {
      const players = engine._players || [];
      if (players.length === 0) return;
      
      let firstPlayer;
      
      switch (method) {
        case "random":
          firstPlayer = players[Math.floor(Math.random() * players.length)];
          break;
          
        case "youngest":
          firstPlayer = players.reduce((youngest, p) => 
            (!youngest || p.age < youngest.age) ? p : youngest
          );
          break;
          
        case "oldest":
          firstPlayer = players.reduce((oldest, p) => 
            (!oldest || p.age > oldest.age) ? p : oldest
          );
          break;
          
        case "score":
          firstPlayer = players.reduce((highest, p) => 
            (!highest || p.score > highest.score) ? p : highest
          );
          break;
          
        default:
          firstPlayer = players[0];
      }
      
      // Set first player as active
      players.forEach(p => p.active = false);
      firstPlayer.active = true;
      
      // Emit event
      engine.emit("turn:firstPlayer", {
        payload: { 
          player: firstPlayer.name,
          method 
        }
      });
      
      // Initialize turn state
      if (!engine._gameState) engine._gameState = {};
      engine._gameState.turnNumber = 1;
      engine._gameState.turnStartTime = Date.now();
    },
    { priority: 100, once: true }
  );
}

/**
 * Register simultaneous turn handling
 * All players act simultaneously rather than sequentially
 * 
 * @param {RuleEngine} ruleEngine
 * @param {Object} opts - Configuration options
 * @param {Function} opts.onAllReady - Callback when all players have acted
 */
export function registerSimultaneousTurns(ruleEngine, opts = {}) {
  const { onAllReady = null } = opts;
  
  ruleEngine.addRule(
    "check-all-players-ready",
    (engine) => {
      const players = engine._players || [];
      if (players.length === 0) return false;
      
      const allReady = players.every(p => 
        p.actionSubmitted === true || p.status === "eliminated"
      );
      
      const waitingForActions = engine._gameState?.waitingForActions;
      
      return allReady && waitingForActions;
    },
    (engine) => {
      // Emit all ready event
      engine.emit("turn:allReady", {
        payload: { 
          players: engine._players.map(p => p.name)
        }
      });
      
      // Execute callback if provided
      if (onAllReady) {
        onAllReady(engine);
      }
      
      // Reset action flags
      engine._players.forEach(p => {
        p.actionSubmitted = false;
      });
      
      // Clear waiting state
      engine._gameState.waitingForActions = false;
      
      // Resolve actions
      engine.dispatch("game:resolveActions");
    },
    { priority: 90 }
  );
}

/**
 * Example: Setting up a game with round-robin turns
 */
export function exampleUsage() {
  // In your game initialization:
  /*
  import { RuleEngine } from './RuleEngine.js';
  import { 
    registerRoundRobinTurns,
    registerRoundCompletion,
    registerTurnTimer
  } from './turn-order.js';
  
  const engine = new Engine({ ... });
  const ruleEngine = new RuleEngine(engine);
  
  // Set up turn order
  registerRoundRobinTurns(ruleEngine, {
    triggerAction: "player:endTurn",
    skipInactive: true
  });
  
  // Detect round completion
  registerRoundCompletion(ruleEngine, {
    nextPhase: "scoring",
    onRoundComplete: (engine) => {
      console.log("Round complete!");
    }
  });
  
  // Add turn timer (optional)
  registerTurnTimer(ruleEngine, {
    timeLimit: 30000, // 30 seconds
    onTimeout: (engine, player) => {
      console.log(`${player.name} timed out!`);
    }
  });
  
  // Start game
  engine.dispatch("game:start");
  */
}