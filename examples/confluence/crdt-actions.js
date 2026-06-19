/**
 * Confluence CRDT Actions
 *
 * Registers confluence:* actions with the ActionRegistry. Uses field-level
 * Chronicle writes (not full-state replacement) so concurrent writes to
 * different tokens merge cleanly in the CRDT.
 *
 * No encryption, no host/client distinction — all peers are equal.
 * Any peer can place/merge/split, and the CRDT merges everything.
 *
 * Usage:
 *   import "./crdt-actions.js";  // Register actions
 *   const engine = new Engine({ disableWasm: true });
 *   await engine.dispatch("confluence:init", {});
 *   engine.connect("ws://localhost:3000");
 */

import { ActionRegistry } from "../../engine/actions.js";
import {
  createInitialState,
  registerPlayer,
  placeToken,
  mergeTokens,
  splitToken,
  endGame,
  deriveBoard,
  deriveScores,
  deriveResult,
  getTimeRemaining,
  isTimeUp,
} from "./ConfluenceGame.js";

/**
 * Get or create the Confluence state from Chronicle.
 * The state lives in doc.confluence — if it doesn't exist, create it.
 */
function getOrCreateState(engine) {
  if (!engine.session.state?.confluence) {
    const initialState = createInitialState();
    engine.session.change("confluence:init", (doc) => {
      doc.confluence = initialState;
    });
  }
  return engine.session.state.confluence;
}

/**
 * Load Confluence state from Chronicle into a local cache.
 * Called when remote state arrives via CRDT sync.
 */
function loadFromChronicle(engine) {
  const confluenceState = engine.session.state?.confluence;
  if (!confluenceState) return;

  // State is read directly from Chronicle — no separate local copy needed.
  // The ConfluenceGame functions operate on the state object in-place.
  // We just need to make sure the engine knows the state exists.
  if (!engine._confluenceReady) {
    engine._confluenceReady = true;
    engine.emit("confluence:ready", {});
  }
}

/**
 * Set up the state sync listener for an engine.
 * When Chronicle receives remote state, emit confluence:updated.
 */
export function setupConfluenceSync(engine) {
  engine.on("state:updated", (e) => {
    const source = e?.source || e?.payload?.source;
    if (source !== "local" && source !== undefined) {
      loadFromChronicle(engine);
    }
    // Always emit update (local or remote) so UI re-renders
    if (engine.session.state?.confluence) {
      engine.emit("confluence:updated", {
        state: engine.session.state.confluence,
        source,
      });
    }
  });
}

/**
 * Generate a unique op ID for an action.
 */
function generateOpId(peerId, seq) {
  return `${peerId}-${seq}`;
}

// Register Confluence actions
Object.assign(ActionRegistry, {
  /**
   * Initialize a new Confluence game.
   */
  "confluence:init": (engine, { width, height, durationMs } = {}) => {
    const config = { width: width ?? 10, height: height ?? 10, durationMs: durationMs ?? 30000 };
    engine.session.change("confluence:init", (doc) => {
      doc.confluence = {
        config: { width: config.width, height: config.height, durationMs: config.durationMs },
        players: {},
        tokens: {},
        consumed: {},
        ops: {},
        phase: "playing",
        startTime: Date.now(),
        winner: null,
      };
    });

    if (!engine._confluenceSyncSetup) {
      setupConfluenceSync(engine);
      engine._confluenceSyncSetup = true;
    }

    engine.emit("confluence:ready", {});
  },

  /**
   * Register a player.
   */
  "confluence:register": (engine, { peerId, name } = {}) => {
    if (!peerId) throw new Error("peerId required");

    // Read current state, modify, write back
    const state = engine.session.state?.confluence;
    if (!state) throw new Error("Game not initialized");

    // Check if already registered
    if (state.players[peerId]) return;

    const colors = ["#e94560", "#00d4ff", "#4ade80", "#fbbf24"];
    const colorIndex = Object.keys(state.players).length % colors.length;

    engine.session.change("confluence:register", (doc) => {
      doc.confluence.players[peerId] = {
        peerId,
        name: name || `Player ${Object.keys(doc.confluence.players).length + 1}`,
        color: colors[colorIndex],
        joinedAt: Date.now(),
      };
    });

    engine.emit("confluence:playerJoined", { peerId });
  },

  /**
   * Place a token on the board.
   * Uses field-level write: only adds to doc.confluence.tokens[tokenId]
   * and doc.confluence.ops[opId]. Does NOT replace the entire state.
   */
  "confluence:place": (engine, { x, y, peerId } = {}) => {
    if (x === undefined || y === undefined) throw new Error("x and y required");
    if (!peerId) throw new Error("peerId required");

    const state = engine.session.state?.confluence;
    if (!state) throw new Error("Game not initialized");
    if (state.phase !== "playing") throw new Error("Game not in progress");
    if (!state.players[peerId]) throw new Error(`Player ${peerId} not registered`);
    if (x < 0 || x >= state.config.width) throw new Error(`x out of bounds: ${x}`);
    if (y < 0 || y >= state.config.height) throw new Error(`y out of bounds: ${y}`);

    // Generate unique IDs
    const seq = Object.keys(state.ops).filter((id) => state.ops[id].actor === peerId).length;
    const opId = generateOpId(peerId, seq);
    const tokenId = `tok-${opId}`;

    // Field-level write: only add the new token and op
    engine.session.change(`confluence:place ${peerId} (${x},${y})`, (doc) => {
      doc.confluence.tokens[tokenId] = {
        id: tokenId,
        playerId: peerId,
        strength: 1,
        x,
        y,
        createdByOp: opId,
        _mergedFrom: null,
        _splitFrom: null,
        placedAt: Date.now(),
      };
      doc.confluence.ops[opId] = {
        type: "place",
        actor: peerId,
        seq,
        timestamp: Date.now(),
      };
    });

    engine.emit("confluence:placed", { tokenId, x, y, peerId });
  },

  /**
   * Merge two adjacent same-player tokens into a stronger one.
   * Marks parents as consumed, creates new token with _mergedFrom.
   */
  "confluence:merge": (engine, { tokenIdA, tokenIdB, peerId } = {}) => {
    if (!tokenIdA || !tokenIdB) throw new Error("tokenIdA and tokenIdB required");
    if (!peerId) throw new Error("peerId required");

    const state = engine.session.state?.confluence;
    if (!state) throw new Error("Game not initialized");
    if (state.phase !== "playing") throw new Error("Game not in progress");

    const tokenA = state.tokens[tokenIdA];
    const tokenB = state.tokens[tokenIdB];
    if (!tokenA || !tokenB) throw new Error("Token(s) not found");
    if (tokenA.playerId !== peerId || tokenB.playerId !== peerId) throw new Error("Not your tokens");

    // Check consumption
    const consumedA = state.consumed[tokenIdA];
    const consumedB = state.consumed[tokenIdB];
    if (consumedA && Object.keys(consumedA).length > 0) throw new Error(`${tokenIdA} already consumed`);
    if (consumedB && Object.keys(consumedB).length > 0) throw new Error(`${tokenIdB} already consumed`);

    // Check strength
    if (tokenA.strength >= 3 || tokenB.strength >= 3) throw new Error("Tokens already at max strength");

    // Check adjacency
    const dx = Math.abs(tokenA.x - tokenB.x);
    const dy = Math.abs(tokenA.y - tokenB.y);
    if (dx > 1 || dy > 1 || (dx === 0 && dy === 0)) throw new Error("Tokens not adjacent");

    const seq = Object.keys(state.ops).filter((id) => state.ops[id].actor === peerId).length;
    const opId = generateOpId(peerId, seq);
    const newTokenId = `tok-${opId}`;
    const newStrength = Math.min(3, tokenA.strength + tokenB.strength);

    // Field-level writes
    engine.session.change(`confluence:merge ${peerId}`, (doc) => {
      // Mark parents as consumed
      if (!doc.confluence.consumed[tokenIdA]) doc.confluence.consumed[tokenIdA] = {};
      doc.confluence.consumed[tokenIdA][opId] = true;
      if (!doc.confluence.consumed[tokenIdB]) doc.confluence.consumed[tokenIdB] = {};
      doc.confluence.consumed[tokenIdB][opId] = true;

      // Create merged token
      doc.confluence.tokens[newTokenId] = {
        id: newTokenId,
        playerId: peerId,
        strength: newStrength,
        x: tokenA.x,
        y: tokenA.y,
        createdByOp: opId,
        _mergedFrom: [tokenIdA, tokenIdB],
        _splitFrom: null,
        placedAt: Date.now(),
      };

      doc.confluence.ops[opId] = {
        type: "merge",
        actor: peerId,
        seq,
        timestamp: Date.now(),
      };
    });

    engine.emit("confluence:merged", { newTokenId, tokenIdA, tokenIdB, peerId });
  },

  /**
   * Split a strength-2+ token into two strength-1 tokens.
   * Marks parent as consumed, creates two new tokens with _splitFrom.
   */
  "confluence:split": (engine, { tokenId, targetX, targetY, peerId } = {}) => {
    if (!tokenId) throw new Error("tokenId required");
    if (targetX === undefined || targetY === undefined) throw new Error("targetX and targetY required");
    if (!peerId) throw new Error("peerId required");

    const state = engine.session.state?.confluence;
    if (!state) throw new Error("Game not initialized");
    if (state.phase !== "playing") throw new Error("Game not in progress");

    const token = state.tokens[tokenId];
    if (!token) throw new Error("Token not found");
    if (token.playerId !== peerId) throw new Error("Not your token");

    const consumed = state.consumed[tokenId];
    if (consumed && Object.keys(consumed).length > 0) throw new Error("Token already consumed");
    if (token.strength < 2) throw new Error("Token must be strength 2+ to split");

    // Check target adjacency
    const dx = Math.abs(token.x - targetX);
    const dy = Math.abs(token.y - targetY);
    if (dx > 1 || dy > 1) throw new Error("Target not adjacent");
    if (targetX < 0 || targetX >= state.config.width) throw new Error("targetX out of bounds");
    if (targetY < 0 || targetY >= state.config.height) throw new Error("targetY out of bounds");

    const seq = Object.keys(state.ops).filter((id) => state.ops[id].actor === peerId).length;
    const opId = generateOpId(peerId, seq);
    const newTokenId1 = `tok-${opId}-a`;
    const newTokenId2 = `tok-${opId}-b`;

    // Field-level writes
    engine.session.change(`confluence:split ${peerId}`, (doc) => {
      // Mark parent as consumed
      if (!doc.confluence.consumed[tokenId]) doc.confluence.consumed[tokenId] = {};
      doc.confluence.consumed[tokenId][opId] = true;

      // Create two new tokens
      doc.confluence.tokens[newTokenId1] = {
        id: newTokenId1,
        playerId: peerId,
        strength: 1,
        x: token.x,
        y: token.y,
        createdByOp: opId,
        _mergedFrom: null,
        _splitFrom: tokenId,
        placedAt: Date.now(),
      };

      doc.confluence.tokens[newTokenId2] = {
        id: newTokenId2,
        playerId: peerId,
        strength: 1,
        x: targetX,
        y: targetY,
        createdByOp: opId,
        _mergedFrom: null,
        _splitFrom: tokenId,
        placedAt: Date.now(),
      };

      doc.confluence.ops[opId] = {
        type: "split",
        actor: peerId,
        seq,
        timestamp: Date.now(),
      };
    });

    engine.emit("confluence:split", { newTokenId1, newTokenId2, tokenId, peerId });
  },

  /**
   * End the game and compute final scores.
   */
  "confluence:end": (engine, { peerId } = {}) => {
    const state = engine.session.state?.confluence;
    if (!state) throw new Error("Game not initialized");
    if (state.phase === "ended") throw new Error("Game already ended");

    // Compute result BEFORE writing to Chronicle — Automerge proxies
    // don't work with Object.values() in deriveResult/deriveScores
    const plainState = JSON.parse(JSON.stringify(state));
    const result = deriveResult(plainState);

    engine.session.change("confluence:end", (doc) => {
      doc.confluence.phase = "ended";
      doc.confluence.winner = result.winner;
    });

    engine.emit("confluence:ended", { winner: result.winner });
  },
});

/**
 * Helper: get the current board (derived from tokens).
 */
export function getBoard(engine) {
  const state = engine.session.state?.confluence;
  if (!state) return null;
  // Deep clone to convert Automerge proxy to plain object
  const plainState = JSON.parse(JSON.stringify(state));
  return deriveBoard(plainState);
}

/**
 * Helper: get current scores (derived from tokens).
 */
export function getScores(engine) {
  const state = engine.session.state?.confluence;
  if (!state) return [];
  const plainState = JSON.parse(JSON.stringify(state));
  return deriveScores(plainState);
}

/**
 * Helper: get time remaining in seconds.
 */
export function getTimeRemainingSec(engine) {
  const state = engine.session.state?.confluence;
  if (!state) return 0;
  return Math.ceil(getTimeRemaining(state) / 1000);
}

/**
 * Helper: check if game is over.
 */
export function isGameOver(engine) {
  const state = engine.session.state?.confluence;
  if (!state) return false;
  return state.phase === "ended" || isTimeUp(state);
}
