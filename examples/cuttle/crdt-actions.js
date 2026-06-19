/**
 * CRDT Cuttle Game Actions
 *
 * CRDT-aware version of game-actions.js. Instead of storing game state on
 * engine._gameState (mutable JS object), writes sanitized snapshots to Chronicle
 * via session.change() after each action. ConsensusCore then syncs state to peers.
 *
 * On receiving remote state (via CRDT sync), loads the snapshot into the local
 * CuttleGame instance.
 *
 * Usage:
 *   import "./crdt-actions.js";  // Register CRDT-aware actions
 *   const engine = new Engine({ disableWasm: true });
 *   await engine.dispatch("cuttle:init", { seed: 12345 });
 *   engine.connect("ws://localhost:9091");
 */

import { ActionRegistry } from "../../engine/actions.js";
import { CuttleGame } from "./CuttleGame.js";
import { sanitizeForSync, loadFromSync } from "./crypto.js";

/**
 * Get or create the CuttleGame instance for an engine.
 * Stored on engine._cuttleGame (same as game-actions.js).
 */
function getOrCreateGame(engine, config) {
  if (!engine._cuttleGame) {
    engine._cuttleGame = new CuttleGame(config || {});
  }
  return engine._cuttleGame;
}

/**
 * Get the game instance for an engine (or null).
 */
export function getGameInstance(engine) {
  return engine?._cuttleGame || null;
}

/**
 * Write the current game state to Chronicle.
 * If encryption is enabled (engine._e2e and engine._peerIds set),
 * encrypts hands before writing so opponents can't read them.
 * This is what triggers CRDT sync to peers.
 */
async function syncToChronicle(engine, message) {
  const game = engine._cuttleGame;
  if (!game) return;

  const snapshot = game.getState();

  // If encryption is set up, sanitize hands before syncing
  let stateToSync = snapshot;
  if (engine._e2e && engine._peerIds) {
    stateToSync = await sanitizeForSync(snapshot, engine._e2e, engine._peerIds);
  }

  // Deep clone to strip undefined values (Automerge rejects undefined)
  const cleanState = JSON.parse(JSON.stringify(stateToSync));

  engine.session.change(message, (doc) => {
    doc.cuttle = cleanState;
  });
}

/**
 * Load game state from Chronicle into the local CuttleGame instance.
 * Called when remote state arrives via CRDT sync.
 * If encryption is enabled, decrypts the local player's hand.
 * The host loads from Chronicle but preserves its own hand (which it has
 * in full, while the synced state only has a count for the host's hand).
 */
async function loadFromChronicle(engine) {
  const cuttleState = engine.session.state?.cuttle;
  if (!cuttleState) return;

  const game = getOrCreateGame(engine);

  // If encryption is set up and state has encrypted hands, decrypt own hand
  if (engine._e2e && engine._myPlayerIndex !== undefined && engine._hostPeerId) {
    if (engine._isHost) {
      // Host with encryption: preserve BOTH hands from local state.
      // The host has the full state (both hands). The synced state may have
      // encrypted/count-only hands. Preserving both hands prevents losing
      // hand data. (Without encryption, this branch is not reached.)
      const currentState = game.getState();
      const remoteState = JSON.parse(JSON.stringify(cuttleState));

      if (remoteState.players) {
        for (let i = 0; i < remoteState.players.length; i++) {
          if (currentState.players[i] && currentState.players[i].hand) {
            remoteState.players[i].hand = JSON.parse(JSON.stringify(currentState.players[i].hand));
            delete remoteState.players[i].handCount;
            delete remoteState.players[i].handEncrypted;
          }
        }
      }

      game.loadState(remoteState);
    } else {
      // Client: decrypt own hand, opponent's hand stays as count
      const decryptedState = await loadFromSync(
        cuttleState,
        engine._e2e,
        engine._myPlayerIndex,
        engine._hostPeerId
      );
      game.loadState(decryptedState);
    }
  } else {
    // No encryption — load state as-is (Phase 2 behavior)
    game.loadState(cuttleState);
  }
}

/**
 * Set up the state sync listener for an engine.
 * When Chronicle receives remote state (source="sync" or "merge"),
 * load it into the local CuttleGame.
 *
 * This should be called once per engine, after creation.
 */
export function setupCuttleSync(engine) {
  engine.on("state:updated", async (e) => {
    const source = e?.source || e?.payload?.source;
    // Load from any non-local update (sync, merge, peerId, etc.)
    if (source !== "local" && source !== undefined) {
      await loadFromChronicle(engine);
    }
  });
}

/**
 * Configure encryption for an engine.
 * Must be called after key exchange is complete.
 *
 * @param engine - The engine instance
 * @param e2e - E2EEncryption instance with established sessions
 * @param config - { myPlayerIndex, hostPeerId, peerIds, isHost }
 */
export function configureEncryption(engine, e2e, config) {
  engine._e2e = e2e;
  engine._myPlayerIndex = config.myPlayerIndex;
  engine._hostPeerId = config.hostPeerId;
  engine._peerIds = config.peerIds; // Array indexed by player index
  engine._isHost = config.isHost || false;
}

// Register CRDT-aware Cuttle actions.
// These overwrite the ones from game-actions.js if both are loaded.
Object.assign(ActionRegistry, {
  /**
   * Initialize a new Cuttle game.
   * Creates the CuttleGame instance and writes initial state to Chronicle.
   */
  "cuttle:init": async (engine, { seed, variant } = {}) => {
    const game = getOrCreateGame(engine, { seed, variant: variant || "classic" });

    // Write initial state to Chronicle
    await syncToChronicle(engine, "cuttle:init");

    // Set up sync listener (only once)
    if (!engine._cuttleSyncSetup) {
      setupCuttleSync(engine);
      engine._cuttleSyncSetup = true;
    }

    engine.emit("game:initialized", { variant: variant || "classic", numPlayers: 2 });
  },

  /**
   * Execute a game action.
   * Processes the action in CuttleGame, then writes the new state to Chronicle.
   * Includes expectedTurnNumber guard to reject stale actions.
   */
  "cuttle:action": async (engine, { action, playerIndex, expectedTurnNumber } = {}) => {
    const game = engine._cuttleGame;
    if (!game) {
      throw new Error("Game not initialized");
    }

    // Stale action guard
    if (expectedTurnNumber !== undefined) {
      const currentState = game.getState();
      if (currentState.turnNumber !== expectedTurnNumber) {
        throw new Error(
          `Stale action: expected turn ${expectedTurnNumber}, but current is ${currentState.turnNumber}`
        );
      }
    }

    // Validate the action
    const validActions = game.getValidActions(playerIndex);
    if (validActions.length === 0) {
      throw new Error("No valid actions right now");
    }
    if (!validActions.includes(action)) {
      throw new Error(`Invalid action: ${action}`);
    }

    // Execute the action
    const result = game.action(playerIndex, action);
    if (!result.success) {
      throw new Error(result.message);
    }

    // Write new state to Chronicle (triggers CRDT sync)
    await syncToChronicle(engine, `cuttle:action:${action}`);

    engine.emit("action:executed", {
      playerIndex,
      action,
      message: result.message,
    });

    // Check for game end
    const state = game.getState();
    if (state.winner !== null) {
      engine.emit("game:won", { winner: state.winner });
    } else if (state.isDraw) {
      engine.emit("game:draw", {});
    }
  },

  /**
   * Reset the game.
   */
  "cuttle:reset": async (engine, { seed } = {}) => {
    const game = engine._cuttleGame;
    if (!game) return;

    game.reset(seed);
    await syncToChronicle(engine, "cuttle:reset");

    engine.emit("game:reset", {});
  },

  /**
   * Get valid actions for a player.
   * This is a read-only query — doesn't modify Chronicle.
   */
  "cuttle:validActions": (engine, { playerIndex } = {}) => {
    const game = engine._cuttleGame;
    if (!game) return [];

    // If we don't have a game state yet, try loading from Chronicle
    if (game.getState().turnNumber === 0 && !engine.session.state?.cuttle) {
      return [];
    }

    return game.getValidActions(playerIndex);
  },
});

/**
 * Helper to get player observation.
 * If the game doesn't exist yet, tries to load from Chronicle first.
 */
export function getPlayerObservation(engine, playerIndex) {
  let game = engine._cuttleGame;

  // If no game instance yet, try loading from Chronicle
  if (!game) {
    const cuttleState = engine.session.state?.cuttle;
    if (cuttleState) {
      game = getOrCreateGame(engine);
      game.loadState(cuttleState);
    } else {
      return null;
    }
  }

  return game.getObservation(playerIndex);
}
