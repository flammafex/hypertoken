/**
 * Watershed CRDT Actions
 *
 * Registers watershed:* actions with the ActionRegistry. Game-specific state
 * writes go through engine.dispatch("game:setState", ...) — whole-key
 * replacement for init, field-level patch batches for players/tokens/ops/
 * consumed. Each handler performs ONE dispatch per game action, so concurrent
 * writes to different tokens merge cleanly in the CRDT.
 *
 * No encryption, no host/client distinction — all peers are equal.
 * Any peer can place/merge/split, and the CRDT merges everything.
 *
 * Usage:
 *   import "./crdt-actions.js";  // Register actions
 *   const engine = new Engine({ disableWasm: true });
 *   await engine.dispatch("watershed:init", {});
 *   engine.connect("ws://localhost:3000");
 */

import { ActionRegistry } from "../../engine/actions.js";
import {
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
  computeEnergy,
  ENERGY_PRESETS,
  DURATION_PRESETS,
} from "./WatershedGame.js";

/**
 * Load Watershed state from Chronicle into a local cache.
 * Called when remote state arrives via CRDT sync.
 */
function loadFromChronicle(engine) {
  const watershedState = engine.session.state?.watershed;
  if (!watershedState) return;

  // State is read directly from Chronicle — no separate local copy needed.
  // The WatershedGame functions operate on the state object in-place.
  // We just need to make sure the engine knows the state exists.
  if (!engine._watershedReady) {
    engine._watershedReady = true;
    engine.emit("watershed:ready", {});
  }
}

/**
 * Set up the state sync listener for an engine.
 * When Chronicle receives remote state, emit watershed:updated.
 */
export function setupWatershedSync(engine) {
  engine.on("state:updated", (e) => {
    const source = e?.source || e?.payload?.source;
    if (source !== "local" && source !== undefined) {
      loadFromChronicle(engine);
    }
    // Always emit update (local or remote) so UI re-renders
    if (engine.session.state?.watershed) {
      engine.emit("watershed:updated", {
        state: engine.session.state.watershed,
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

/**
 * Get the next sequence number for a peer.
 * Uses a local in-memory counter to avoid the race condition where two
 * actions dispatched before the first's CRDT write is visible would
 * compute the same seq → same opId → silent token loss (last-write-wins).
 *
 * The counter is per-engine, per-peer. It initializes from the existing
 * ops count on first use (for reconnect/resume scenarios) then increments
 * monotonically.
 */
function nextSeq(engine, peerId) {
  if (!engine._watershedSeq) engine._watershedSeq = {};
  if (engine._watershedSeq[peerId] === undefined) {
    // Initialize from existing ops count (handles reconnect/resume)
    const state = engine.session.state?.watershed;
    if (state?.ops) {
      engine._watershedSeq[peerId] = Object.keys(state.ops).filter(
        (id) => state.ops[id].actor === peerId
      ).length;
    } else {
      engine._watershedSeq[peerId] = 0;
    }
  }
  return engine._watershedSeq[peerId]++;
}

// Register Watershed actions
Object.assign(ActionRegistry, {
  /**
   * Initialize a new Watershed game.
   */
  "watershed:init": async (engine, { width, height, durationMs, energyConfig } = {}) => {
    const config = {
      width: width ?? 10,
      height: height ?? 10,
      durationMs: durationMs ?? DURATION_PRESETS.sprint,
    };
    const energy = energyConfig || ENERGY_PRESETS.standard;
    await engine.dispatch("game:setState", {
      key: "watershed",
      value: {
        config: {
          width: config.width,
          height: config.height,
          durationMs: config.durationMs,
          energy,
        },
        players: {},
        tokens: {},
        consumed: {},
        ops: {},
        phase: "playing",
        startTime: Date.now(),
        winner: null,
      },
      replace: true,
    });

    if (!engine._watershedSyncSetup) {
      setupWatershedSync(engine);
      engine._watershedSyncSetup = true;
    }

    engine.emit("watershed:ready", {});
  },

  /**
   * Register a player.
   */
  "watershed:register": async (engine, { peerId, name } = {}) => {
    if (!peerId) throw new Error("peerId required");

    // Read current state, modify, write back
    const state = engine.session.state?.watershed;
    if (!state) throw new Error("Game not initialized");

    // Check if already registered
    if (state.players[peerId]) return;

    const colors = ["#e94560", "#00d4ff", "#4ade80", "#fbbf24"];
    const colorIndex = Object.keys(state.players).length % colors.length;
    const energyMax = state.config?.energy?.max ?? 15;

    await engine.dispatch("game:setState", {
      key: "watershed",
      patches: [
        {
          path: ["players", peerId],
          value: {
            peerId,
            name: name || `Player ${Object.keys(state.players).length + 1}`,
            color: colors[colorIndex],
            joinedAt: Date.now(),
            energy: energyMax, // start with full energy
            lastEnergyTime: Date.now(),
          },
        },
      ],
    });

    engine.emit("watershed:playerJoined", { peerId });
  },

  /**
   * Place a token on the board.
   * Uses field-level write: only adds to doc.watershed.tokens[tokenId]
   * and doc.watershed.ops[opId]. Does NOT replace the entire state.
   */
  "watershed:place": async (engine, { x, y, peerId } = {}) => {
    if (x === undefined || y === undefined) throw new Error("x and y required");
    if (!peerId) throw new Error("peerId required");

    const state = engine.session.state?.watershed;
    if (!state) throw new Error("Game not initialized");
    if (state.phase !== "playing") throw new Error("Game not in progress");
    if (!state.players[peerId]) throw new Error(`Player ${peerId} not registered`);
    if (x < 0 || x >= state.config.width) throw new Error(`x out of bounds: ${x}`);
    if (y < 0 || y >= state.config.height) throw new Error(`y out of bounds: ${y}`);

    // Energy check: placement costs energy. Merge/split are free, so this
    // makes them strategically valuable vs. spam-clicking placements.
    const player = state.players[peerId];
    const energyConfig = state.config?.energy || ENERGY_PRESETS.standard;
    const currentEnergy = computeEnergy(player, energyConfig);
    if (currentEnergy < energyConfig.placeCost) {
      engine.emit("watershed:rejected", { reason: "insufficient_energy", peerId, x, y });
      return;
    }

    // Fortification check: cannot place on a cell containing another player's
    // strength-3 (fortified) token. Such cells are locked to their owner.
    const existingTokens = Object.values(state.tokens || {}).filter((t) => {
      if (t.x !== x || t.y !== y) return false;
      const consumed = state.consumed[t.id];
      return !(consumed && Object.keys(consumed).length > 0);
    });
    for (const t of existingTokens) {
      if (t.playerId !== peerId && t.strength >= 3) {
        engine.emit("watershed:rejected", { reason: "fortified", peerId, x, y });
        return;
      }
    }

    // Generate unique IDs (local monotonic counter — avoids race condition)
    const seq = nextSeq(engine, peerId);
    const opId = generateOpId(peerId, seq);
    const tokenId = `tok-${opId}`;

    // Field-level writes: all four fields land in ONE atomic game:setState
    // dispatch (energy, lastEnergyTime, token, op).
    await engine.dispatch("game:setState", {
      key: "watershed",
      patches: [
        {
          path: ["players", peerId, "energy"],
          value: currentEnergy - energyConfig.placeCost,
        },
        {
          path: ["players", peerId, "lastEnergyTime"],
          value: Date.now(),
        },
        {
          path: ["tokens", tokenId],
          value: {
            id: tokenId,
            playerId: peerId,
            strength: 1,
            x,
            y,
            createdByOp: opId,
            _mergedFrom: null,
            _splitFrom: null,
            placedAt: Date.now(),
          },
        },
        {
          path: ["ops", opId],
          value: {
            type: "place",
            actor: peerId,
            seq,
            timestamp: Date.now(),
          },
        },
      ],
    });

    engine.emit("watershed:placed", { tokenId, x, y, peerId });
  },

  /**
   * Merge two adjacent same-player tokens into a stronger one.
   * Marks parents as consumed, creates new token with _mergedFrom.
   */
  "watershed:merge": async (engine, { tokenIdA, tokenIdB, peerId } = {}) => {
    if (!tokenIdA || !tokenIdB) throw new Error("tokenIdA and tokenIdB required");
    if (!peerId) throw new Error("peerId required");

    const state = engine.session.state?.watershed;
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

    const seq = nextSeq(engine, peerId);
    const opId = generateOpId(peerId, seq);
    const newTokenId = `tok-${opId}`;
    const newStrength = Math.min(3, tokenA.strength + tokenB.strength);

    // Field-level writes: consumed entries are created by the path-walk in
    // game:setState. All four patches land in ONE atomic dispatch.
    await engine.dispatch("game:setState", {
      key: "watershed",
      patches: [
        { path: ["consumed", tokenIdA, opId], value: true },
        { path: ["consumed", tokenIdB, opId], value: true },
        {
          path: ["tokens", newTokenId],
          value: {
            id: newTokenId,
            playerId: peerId,
            strength: newStrength,
            x: tokenA.x,
            y: tokenA.y,
            createdByOp: opId,
            _mergedFrom: [tokenIdA, tokenIdB],
            _splitFrom: null,
            placedAt: Date.now(),
          },
        },
        {
          path: ["ops", opId],
          value: {
            type: "merge",
            actor: peerId,
            seq,
            timestamp: Date.now(),
          },
        },
      ],
    });

    engine.emit("watershed:merged", { newTokenId, tokenIdA, tokenIdB, peerId });
  },

  /**
   * Split a strength-2+ token into two strength-1 tokens.
   * Marks parent as consumed, creates two new tokens with _splitFrom.
   */
  "watershed:split": async (engine, { tokenId, targetX, targetY, peerId } = {}) => {
    if (!tokenId) throw new Error("tokenId required");
    if (targetX === undefined || targetY === undefined) throw new Error("targetX and targetY required");
    if (!peerId) throw new Error("peerId required");

    const state = engine.session.state?.watershed;
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

    const seq = nextSeq(engine, peerId);
    const opId = generateOpId(peerId, seq);
    const newTokenId1 = `tok-${opId}-a`;
    const newTokenId2 = `tok-${opId}-b`;

    // Field-level writes: consumed entry created by the path-walk in
    // game:setState. All four patches land in ONE atomic dispatch.
    await engine.dispatch("game:setState", {
      key: "watershed",
      patches: [
        { path: ["consumed", tokenId, opId], value: true },
        {
          path: ["tokens", newTokenId1],
          value: {
            id: newTokenId1,
            playerId: peerId,
            strength: 1,
            x: token.x,
            y: token.y,
            createdByOp: opId,
            _mergedFrom: null,
            _splitFrom: tokenId,
            placedAt: Date.now(),
          },
        },
        {
          path: ["tokens", newTokenId2],
          value: {
            id: newTokenId2,
            playerId: peerId,
            strength: 1,
            x: targetX,
            y: targetY,
            createdByOp: opId,
            _mergedFrom: null,
            _splitFrom: tokenId,
            placedAt: Date.now(),
          },
        },
        {
          path: ["ops", opId],
          value: {
            type: "split",
            actor: peerId,
            seq,
            timestamp: Date.now(),
          },
        },
      ],
    });

    engine.emit("watershed:split", { newTokenId1, newTokenId2, tokenId, peerId });
  },

  /**
   * Start the game (syncs to all peers via CRDT).
   * Sets startTime and phase to "playing" so the timer begins for everyone.
   */
  "watershed:start": async (engine, { peerId } = {}) => {
    const state = engine.session.state?.watershed;
    if (!state) throw new Error("Game not initialized");

    await engine.dispatch("game:setState", {
      key: "watershed",
      patches: [
        { path: ["startTime"], value: Date.now() },
        { path: ["phase"], value: "playing" },
      ],
    });

    engine.emit("watershed:started", {});
  },

  /**
   * End the game and compute final scores.
   */
  "watershed:end": async (engine, { peerId } = {}) => {
    const state = engine.session.state?.watershed;
    if (!state) throw new Error("Game not initialized");
    if (state.phase === "ended") throw new Error("Game already ended");

    // Compute result BEFORE writing to Chronicle — Automerge proxies
    // don't work with Object.values() in deriveResult/deriveScores
    const plainState = JSON.parse(JSON.stringify(state));
    plainState.phase = "ended"; // deriveResult only computes winner when phase === "ended"
    const result = deriveResult(plainState);

    await engine.dispatch("game:setState", {
      key: "watershed",
      patches: [
        { path: ["phase"], value: "ended" },
        { path: ["winner"], value: result.winner },
      ],
    });

    engine.emit("watershed:ended", { winner: result.winner });
  },
});

/**
 * Helper: get the current board (derived from tokens).
 */
export function getBoard(engine) {
  const state = engine.session.state?.watershed;
  if (!state) return null;
  // Deep clone to convert Automerge proxy to plain object
  const plainState = JSON.parse(JSON.stringify(state));
  return deriveBoard(plainState);
}

/**
 * Helper: get current scores (derived from tokens).
 */
export function getScores(engine) {
  const state = engine.session.state?.watershed;
  if (!state) return [];
  const plainState = JSON.parse(JSON.stringify(state));
  return deriveScores(plainState);
}

/**
 * Helper: get time remaining in seconds.
 */
export function getTimeRemainingSec(engine) {
  const state = engine.session.state?.watershed;
  if (!state) return 0;
  return Math.ceil(getTimeRemaining(state) / 1000);
}

/**
 * Helper: check if game is over.
 */
export function isGameOver(engine) {
  const state = engine.session.state?.watershed;
  if (!state) return false;
  return state.phase === "ended" || isTimeUp(state);
}
