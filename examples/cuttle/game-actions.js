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
  "cuttle:init": async (engine, { seed, variant } = {}) => {
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

    // Write the room state into the CRDT doc under key "gameState". The
    // engine._gameState getter returns session.state.gameState, and every
    // other cuttle handler in this file reads engine._gameState, so this key
    // keeps the file self-consistent. (Previously this assigned
    // engine._gameState directly, which throws because _gameState is a
    // read-only getter.)
    await engine.dispatch("game:setState", {
      key: "gameState",
      value: {
        game: gameInstance.getState(),
        variant: v,
        numPlayers,
        players,
        spectators: [],
        disconnectedSlots: [], // Track slots where players disconnected mid-game
        gameStarted: false,
        history: [], // Track action history for chronicle sync
        readyForNextGame: {}, // Track which players are ready for next game
      },
      replace: true,
    });

    engine.emit("game:initialized", { variant: v, numPlayers });
  },

  /**
   * Register a player
   */
  "cuttle:register": async (engine, { clientId } = {}) => {
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
        // Clone before deriving (Automerge proxies don't support spread/derive).
        const players = JSON.parse(JSON.stringify(state.players));
        players[slot] = clientId;

        // Check if all players are registered
        const allFilled = Object.values(players).every((p) => p !== null);

        const patches = [{ path: ["players"], value: players }];
        if (allFilled) {
          patches.push({ path: ["gameStarted"], value: true });
        }

        await engine.dispatch("game:setState", { key: "gameState", patches });
        engine.emit("player:registered", { playerIndex: slot, clientId });
        assigned = true;

        if (allFilled) {
          engine.emit("game:started", { numPlayers });
        }
        break;
      }
    }

    // If game is in progress, check for disconnected slots to take over
    if (!assigned && state.gameStarted && state.disconnectedSlots?.length > 0) {
      const players = JSON.parse(JSON.stringify(state.players));
      const disconnectedSlots = JSON.parse(JSON.stringify(state.disconnectedSlots));
      const slot = disconnectedSlots.shift();
      players[slot] = clientId;

      await engine.dispatch("game:setState", {
        key: "gameState",
        patches: [
          { path: ["players"], value: players },
          { path: ["disconnectedSlots"], value: disconnectedSlots },
        ],
      });
      engine.emit("player:reconnected", { playerIndex: slot, clientId });
      assigned = true;
    }

    if (!assigned) {
      // Game full, add as spectator
      const spectators = JSON.parse(JSON.stringify(state.spectators || []));
      spectators.push(clientId);
      await engine.dispatch("game:setState", {
        key: "gameState",
        patches: [{ path: ["spectators"], value: spectators }],
      });
      engine.emit("spectator:joined", { clientId });
    }
  },

  /**
   * Execute a game action
   */
  "cuttle:action": async (engine, { action, clientId } = {}) => {
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

    // Commit updated game state + action history via dispatch
    // (single atomic patches write; gameInstance state advances in memory)
    const history = JSON.parse(JSON.stringify(state.history || []));
    history.push({
      playerIndex,
      action,
      message: result.message,
      timestamp: Date.now(),
    });

    await engine.dispatch("game:setState", {
      key: "gameState",
      patches: [
        { path: ["game"], value: gameInstance.getState() },
        { path: ["history"], value: history },
      ],
    });

    engine.emit("action:executed", {
      playerIndex,
      action,
      message: result.message,
    });

    // Check for game end
    const game = gameInstance.getState();
    if (game.winner !== null) {
      engine.emit("game:won", { winner: game.winner });
    } else if (game.isDraw) {
      engine.emit("game:draw", {});
    }
  },

  /**
   * Mark a player as ready for the next game
   * When all players are ready, the game resets and starts
   */
  "cuttle:ready": async (engine, { clientId } = {}) => {
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
    const readyForNextGame = JSON.parse(JSON.stringify(state.readyForNextGame || {}));
    readyForNextGame[playerIndex] = true;
    await engine.dispatch("game:setState", {
      key: "gameState",
      patches: [{ path: ["readyForNextGame"], value: readyForNextGame }],
    });
    engine.emit("player:ready", { playerIndex, clientId });

    // Check if all players are ready
    const allReady = Object.values(state.players).every((pid, idx) => {
      return pid === null || readyForNextGame[idx];
    });

    if (allReady) {
      // Reset the game
      gameInstance.reset();
      await engine.dispatch("game:setState", {
        key: "gameState",
        patches: [
          { path: ["game"], value: gameInstance.getState() },
          { path: ["history"], value: [] },
          { path: ["readyForNextGame"], value: {} },
          { path: ["gameStarted"], value: true },
        ],
      });
      engine.emit("game:reset", {});
      engine.emit("game:started", { numPlayers: state.numPlayers });
    }
  },

  /**
   * Reset the game (internal use or admin)
   */
  "cuttle:reset": async (engine, { seed } = {}) => {
    const gameInstance = engine._cuttleGame;
    if (!gameInstance) return;

    gameInstance.reset(seed);
    const state = engine._gameState;

    // Check if all player slots are filled
    const allFilled = Object.values(state.players).every((p) => p !== null);

    await engine.dispatch("game:setState", {
      key: "gameState",
      patches: [
        { path: ["game"], value: gameInstance.getState() },
        { path: ["history"], value: [] }, // Clear history for new game
        { path: ["readyForNextGame"], value: {} }, // Clear ready state
        { path: ["gameStarted"], value: allFilled },
      ],
    });

    engine.emit("game:reset", {});
  },

  /**
   * Unregister a player (called on disconnect)
   * Only allows leaving before game has started or after game ends
   */
  "cuttle:unregister": async (engine, { clientId } = {}) => {
    if (!clientId) return;

    const state = engine._gameState;
    const gameInstance = engine._cuttleGame;

    if (!state) return;

    // Remove from spectators
    const specIndex = state.spectators.indexOf(clientId);
    if (specIndex !== -1) {
      const spectators = JSON.parse(JSON.stringify(state.spectators));
      spectators.splice(specIndex, 1);
      await engine.dispatch("game:setState", {
        key: "gameState",
        patches: [{ path: ["spectators"], value: spectators }],
      });
      engine.emit("spectator:left", { clientId });
      return;
    }

    // Check if this client is a registered player
    for (let i = 0; i < state.numPlayers; i++) {
      if (state.players[i] === clientId) {
        // Only allow leaving if game hasn't started or game is over
        const gameOver = state.game?.winner !== null || state.game?.isDraw;
        if (!state.gameStarted || gameOver) {
          const players = JSON.parse(JSON.stringify(state.players));
          players[i] = null;
          const patches = [
            { path: ["players"], value: players },
            { path: ["gameStarted"], value: false },
          ];

          // Reset the game if a player leaves before start
          if (!gameOver && gameInstance) {
            gameInstance.reset();
            patches.push({ path: ["game"], value: gameInstance.getState() });
          }

          await engine.dispatch("game:setState", { key: "gameState", patches });
          engine.emit("player:left", { playerIndex: i, clientId });
        } else {
          // Game in progress - mark slot as available for reconnection
          const disconnectedSlots = JSON.parse(
            JSON.stringify(state.disconnectedSlots || [])
          );
          if (!disconnectedSlots.includes(i)) {
            disconnectedSlots.push(i);
          }
          await engine.dispatch("game:setState", {
            key: "gameState",
            patches: [{ path: ["disconnectedSlots"], value: disconnectedSlots }],
          });
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
