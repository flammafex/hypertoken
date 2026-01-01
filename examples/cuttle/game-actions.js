/**
 * Network Cuttle Game Actions
 *
 * Registers Cuttle game actions with the HyperToken ActionRegistry
 * for network multiplayer support.
 *
 * Game instances are stored per-engine (engine._cuttleGame) to support
 * multiple concurrent games in different rooms.
 */

import { ActionRegistry } from "../../engine/actions.js";
import { CuttleGame } from "./CuttleGame.js";

// Default game settings (can be overridden per-room)
let defaultVariant = "classic";

/**
 * Set the default game variant
 */
export function setGameVariant(variant) {
  if (variant === "standard" || variant === "classic" || variant === "cutthroat") {
    defaultVariant = variant;
  }
}

/**
 * Get the game instance for an engine
 */
export function getGameInstance(engine) {
  return engine?._cuttleGame || null;
}

// Extend ActionRegistry with Cuttle actions
Object.assign(ActionRegistry, {
  /**
   * Initialize a new Cuttle game
   */
  "cuttle:init": (engine, { seed, variant } = {}) => {
    // Use passed value, or fall back to default setting
    const v = variant || defaultVariant;
    const gameInstance = new CuttleGame({ seed, variant: v });

    // Store game instance on engine for per-room isolation
    engine._cuttleGame = gameInstance;

    const numPlayers = gameInstance.numPlayers;

    // Create player slots based on variant
    const players = {};
    for (let i = 0; i < numPlayers; i++) {
      players[i] = null;
    }

    engine._gameState = {
      game: gameInstance.getState(),
      variant: v,
      numPlayers,
      players,
      spectators: [],
      disconnectedSlots: [], // Track slots where players disconnected mid-game
      gameStarted: false,
      history: [], // Track action history for chronicle sync
      readyForNextGame: {}, // Track which players are ready for next game
    };

    engine.emit("game:initialized", { variant: v, numPlayers });
  },

  /**
   * Register a player
   */
  "cuttle:register": (engine, { clientId } = {}) => {
    if (!clientId) {
      throw new Error("clientId required");
    }

    const state = engine._gameState;
    const numPlayers = state.numPlayers;

    // Check if already registered
    for (let i = 0; i < numPlayers; i++) {
      if (state.players[i] === clientId) {
        return; // Already registered
      }
    }

    // Find first available slot (in join order: 0, 1, 2)
    const slotOrder = numPlayers === 3 ? [0, 1, 2] : [0, 1];
    let assigned = false;

    for (const slot of slotOrder) {
      if (state.players[slot] === null) {
        state.players[slot] = clientId;
        engine.emit("player:registered", { playerIndex: slot, clientId });
        assigned = true;

        // Check if all players are registered
        const allFilled = Object.values(state.players).every((p) => p !== null);
        if (allFilled) {
          state.gameStarted = true;
          engine.emit("game:started", { numPlayers });
        }
        break;
      }
    }

    // If game is in progress, check for disconnected slots to take over
    if (!assigned && state.gameStarted && state.disconnectedSlots?.length > 0) {
      const slot = state.disconnectedSlots.shift();
      state.players[slot] = clientId;
      engine.emit("player:reconnected", { playerIndex: slot, clientId });
      assigned = true;
    }

    if (!assigned) {
      // Game full, add as spectator
      state.spectators.push(clientId);
      engine.emit("spectator:joined", { clientId });
    }
  },

  /**
   * Execute a game action
   */
  "cuttle:action": (engine, { action, clientId } = {}) => {
    const state = engine._gameState;
    const gameInstance = engine._cuttleGame;

    if (!gameInstance) {
      throw new Error("Game not initialized");
    }

    if (!state.gameStarted) {
      throw new Error("Game hasn't started yet - waiting for players");
    }

    // Find which player this client is
    let playerIndex = -1;
    for (let i = 0; i < state.numPlayers; i++) {
      if (state.players[i] === clientId) {
        playerIndex = i;
        break;
      }
    }

    if (playerIndex === -1) {
      throw new Error("You are not a registered player");
    }

    // Validate it's their turn or they can act
    const validActions = gameInstance.getValidActions(playerIndex);
    if (validActions.length === 0) {
      throw new Error("You have no valid actions right now");
    }

    if (!validActions.includes(action)) {
      throw new Error(`Invalid action: ${action}`);
    }

    // Execute the action
    const result = gameInstance.action(playerIndex, action);

    if (!result.success) {
      throw new Error(result.message);
    }

    // Update state
    state.game = gameInstance.getState();

    // Add to history for chronicle sync
    state.history.push({
      playerIndex,
      action,
      message: result.message,
      timestamp: Date.now(),
    });

    engine.emit("action:executed", {
      playerIndex,
      action,
      message: result.message,
    });

    // Check for game end
    if (state.game.winner !== null) {
      engine.emit("game:won", { winner: state.game.winner });
    } else if (state.game.isDraw) {
      engine.emit("game:draw", {});
    }
  },

  /**
   * Mark a player as ready for the next game
   * When all players are ready, the game resets and starts
   */
  "cuttle:ready": (engine, { clientId } = {}) => {
    if (!clientId) return;

    const state = engine._gameState;
    const gameInstance = engine._cuttleGame;

    if (!gameInstance) return;

    // Find which player this client is
    let playerIndex = -1;
    for (let i = 0; i < state.numPlayers; i++) {
      if (state.players[i] === clientId) {
        playerIndex = i;
        break;
      }
    }

    if (playerIndex === -1) return; // Not a player

    // Mark this player as ready
    state.readyForNextGame[playerIndex] = true;
    engine.emit("player:ready", { playerIndex, clientId });

    // Check if all players are ready
    const allReady = Object.values(state.players).every((pid, idx) => {
      return pid === null || state.readyForNextGame[idx];
    });

    if (allReady) {
      // Reset the game
      gameInstance.reset();
      state.game = gameInstance.getState();
      state.history = [];
      state.readyForNextGame = {}; // Clear ready state
      state.gameStarted = true;
      engine.emit("game:reset", {});
      engine.emit("game:started", { numPlayers: state.numPlayers });
    }
  },

  /**
   * Reset the game (internal use or admin)
   */
  "cuttle:reset": (engine, { seed } = {}) => {
    const gameInstance = engine._cuttleGame;
    if (!gameInstance) return;

    gameInstance.reset(seed);
    const state = engine._gameState;
    state.game = gameInstance.getState();
    state.history = []; // Clear history for new game
    state.readyForNextGame = {}; // Clear ready state
    // Check if all player slots are filled
    const allFilled = Object.values(state.players).every((p) => p !== null);
    state.gameStarted = allFilled;

    engine.emit("game:reset", {});
  },

  /**
   * Unregister a player (called on disconnect)
   * Only allows leaving before game has started or after game ends
   */
  "cuttle:unregister": (engine, { clientId } = {}) => {
    if (!clientId) return;

    const state = engine._gameState;
    const gameInstance = engine._cuttleGame;

    if (!state) return;

    // Remove from spectators
    const specIndex = state.spectators.indexOf(clientId);
    if (specIndex !== -1) {
      state.spectators.splice(specIndex, 1);
      engine.emit("spectator:left", { clientId });
      return;
    }

    // Check if this client is a registered player
    for (let i = 0; i < state.numPlayers; i++) {
      if (state.players[i] === clientId) {
        // Only allow leaving if game hasn't started or game is over
        const gameOver = state.game?.winner !== null || state.game?.isDraw;
        if (!state.gameStarted || gameOver) {
          state.players[i] = null;
          state.gameStarted = false;
          engine.emit("player:left", { playerIndex: i, clientId });

          // Reset the game if a player leaves before start
          if (!gameOver && gameInstance) {
            gameInstance.reset();
            state.game = gameInstance.getState();
          }
        } else {
          // Game in progress - mark slot as available for reconnection
          state.disconnectedSlots = state.disconnectedSlots || [];
          if (!state.disconnectedSlots.includes(i)) {
            state.disconnectedSlots.push(i);
          }
          engine.emit("player:disconnected", { playerIndex: i, clientId });
        }
        return;
      }
    }
  },

  /**
   * Get valid actions for a player
   */
  "cuttle:validActions": (engine, { clientId } = {}) => {
    const state = engine._gameState;
    const gameInstance = engine._cuttleGame;

    if (!gameInstance || !state) {
      return [];
    }

    let playerIndex = -1;
    for (let i = 0; i < state.numPlayers; i++) {
      if (state.players[i] === clientId) {
        playerIndex = i;
        break;
      }
    }

    if (playerIndex === -1) {
      return [];
    }

    return gameInstance.getValidActions(playerIndex);
  },
});

/**
 * Helper to get player observation
 */
export function getPlayerObservation(engine, clientId) {
  const state = engine._gameState;
  const gameInstance = engine._cuttleGame;

  if (!gameInstance) return null;

  let playerIndex = -1;
  for (let i = 0; i < state.numPlayers; i++) {
    if (state.players[i] === clientId) {
      playerIndex = i;
      break;
    }
  }

  if (playerIndex === -1) {
    // Spectator sees player 0's view
    return gameInstance.getObservation(0);
  }

  return gameInstance.getObservation(playerIndex);
}

/**
 * Format card for display
 */
export function cardToDisplay(card) {
  if (card.isJoker) return "🃏";
  const suitSymbols = { clubs: "♣", diamonds: "♦", hearts: "♥", spades: "♠" };
  return `${card.rank}${suitSymbols[card.suit]}`;
}

/**
 * Format game state for display
 */
export function formatGameState(state, playerIndex) {
  if (!state || !state.game) return "Game not initialized";

  const game = state.game;
  const lines = [];

  lines.push("─".repeat(50));
  lines.push(`Turn: ${game.turnNumber} | Phase: ${game.phase}`);
  lines.push(`Deck: ${game.deck.length} | Scrap: ${game.scrap.length}`);
  if (state.variant === "cutthroat") {
    lines.push(`Variant: Cutthroat (3 players)`);
  }
  lines.push("─".repeat(50));

  return lines.join("\n");
}
