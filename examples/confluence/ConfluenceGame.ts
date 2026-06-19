/**
 * ConfluenceGame.ts
 *
 * Pure game rules + CRDT data model for Confluence — a real-time territory game
 * that showcases HyperToken's CRDT thesis: concurrent writes, token provenance,
 * forkable worlds. No hidden information, no encryption, no turns.
 *
 * State model: tokens are unique records keyed by ID. The board is DERIVED from
 * the token map — not stored as canonical state. This means concurrent writes
 * to the same cell preserve both tokens (contested cell), never last-write-wins.
 *
 * Standalone — no Engine/Chronicle imports. Testable in isolation.
 */

// ============================================================================
// Types
// ============================================================================

export type Phase = "playing" | "ended";

export interface ConfluenceConfig {
  width: number;
  height: number;
  durationMs: number;
}

export const DEFAULT_CONFIG: ConfluenceConfig = {
  width: 10,
  height: 10,
  durationMs: 30000, // 30s for demo
};

export interface ConfluenceToken {
  id: string;
  playerId: string; // peerId
  strength: 1 | 2 | 3;
  x: number;
  y: number;
  createdByOp: string;
  _mergedFrom: string[] | null; // [parentTokenId, parentTokenId]
  _splitFrom: string | null; // parentTokenId
  placedAt: number; // timestamp
}

export interface ConfluenceOp {
  type: "place" | "merge" | "split" | "end";
  actor: string; // peerId
  seq: number; // per-actor sequence number
  timestamp: number;
}

export interface ConfluencePlayer {
  peerId: string;
  name: string;
  color: string;
  joinedAt: number;
}

export interface ConfluenceState {
  config: ConfluenceConfig;
  players: Record<string, ConfluencePlayer>;
  tokens: Record<string, ConfluenceToken>;
  consumed: Record<string, Record<string, boolean>>; // tokenId -> { opId: true }
  ops: Record<string, ConfluenceOp>;
  phase: Phase;
  startTime: number;
  winner: string | null;
}

// ============================================================================
// Derived types (computed from state, not stored)
// ============================================================================

export interface Cell {
  x: number;
  y: number;
  tokens: ConfluenceToken[]; // active tokens on this cell
  contested: boolean; // multiple players have tokens here
  controller: string | null; // playerId who controls this cell, or null
}

export interface Board {
  width: number;
  height: number;
  cells: Cell[][]; // cells[y][x]
}

export interface PlayerScore {
  playerId: string;
  name: string;
  color: string;
  tokenCount: number;
  controlledCells: number;
  contestedCells: number;
}

export interface GameResult {
  scores: PlayerScore[];
  winner: string | null;
  totalCells: number;
  contestedCells: number;
}

// ============================================================================
// Colors
// ============================================================================

export const PLAYER_COLORS = ["#e94560", "#00d4ff", "#4ade80", "#fbbf24"];

// ============================================================================
// State creation
// ============================================================================

export function createInitialState(config: Partial<ConfluenceConfig> = {}): ConfluenceState {
  return {
    config: { ...DEFAULT_CONFIG, ...config },
    players: {},
    tokens: {},
    consumed: {},
    ops: {},
    phase: "playing",
    startTime: Date.now(),
    winner: null,
  };
}

// ============================================================================
// Player management
// ============================================================================

export function registerPlayer(
  state: ConfluenceState,
  peerId: string,
  name: string,
): ConfluencePlayer {
  if (state.players[peerId]) {
    return state.players[peerId];
  }

  const colorIndex = Object.keys(state.players).length % PLAYER_COLORS.length;
  const player: ConfluencePlayer = {
    peerId,
    name,
    color: PLAYER_COLORS[colorIndex],
    joinedAt: Date.now(),
  };
  state.players[peerId] = player;
  return player;
}

// ============================================================================
// Token helpers
// ============================================================================

export function isTokenConsumed(state: ConfluenceState, tokenId: string): boolean {
  const consumed = state.consumed[tokenId];
  return consumed !== undefined && Object.keys(consumed).length > 0;
}

export function getActiveTokens(state: ConfluenceState): ConfluenceToken[] {
  return Object.values(state.tokens).filter((t) => !isTokenConsumed(state, t.id));
}

export function getTokensAt(
  state: ConfluenceState,
  x: number,
  y: number,
): ConfluenceToken[] {
  return getActiveTokens(state).filter((t) => t.x === x && t.y === y);
}

export function getPlayerTokens(state: ConfluenceState, playerId: string): ConfluenceToken[] {
  return getActiveTokens(state).filter((t) => t.playerId === playerId);
}

// ============================================================================
// Board derivation (the core CRDT showcase)
// ============================================================================

export function deriveBoard(state: ConfluenceState): Board {
  const { width, height } = state.config;
  const activeTokens = getActiveTokens(state);

  // Group tokens by cell
  const cellMap: Record<string, ConfluenceToken[]> = {};
  for (const token of activeTokens) {
    const key = `${token.x},${token.y}`;
    if (!cellMap[key]) cellMap[key] = [];
    cellMap[key].push(token);
  }

  // Build cell grid
  const cells: Cell[][] = [];
  for (let y = 0; y < height; y++) {
    cells[y] = [];
    for (let x = 0; x < width; x++) {
      const key = `${x},${y}`;
      const tokens = cellMap[key] || [];
      const playerIds = new Set(tokens.map((t) => t.playerId));
      const contested = playerIds.size > 1;
      const controller = contested ? null : (tokens[0]?.playerId ?? null);

      cells[y][x] = { x, y, tokens, contested, controller };
    }
  }

  return { width, height, cells };
}

// ============================================================================
// Scoring (derived from board)
// ============================================================================

export function deriveScores(state: ConfluenceState): PlayerScore[] {
  const board = deriveBoard(state);
  const playerMap = state.players;
  const scores: Record<string, PlayerScore> = {};

  // Initialize scores for all players
  for (const [peerId, player] of Object.entries(playerMap)) {
    scores[peerId] = {
      playerId: peerId,
      name: player.name,
      color: player.color,
      tokenCount: 0,
      controlledCells: 0,
      contestedCells: 0,
    };
  }

  // Count tokens
  for (const token of getActiveTokens(state)) {
    if (scores[token.playerId]) {
      scores[token.playerId].tokenCount++;
    }
  }

  // Score occupied cells
  for (let y = 0; y < board.height; y++) {
    for (let x = 0; x < board.width; x++) {
      const cell = board.cells[y][x];
      if (cell.tokens.length === 0) continue;

      if (cell.contested) {
        // Contested cell — no one scores, but track for each player involved
        for (const token of cell.tokens) {
          if (scores[token.playerId]) {
            scores[token.playerId].contestedCells++;
          }
        }
      } else if (cell.controller && scores[cell.controller]) {
        scores[cell.controller].controlledCells++;
      }
    }
  }

  // Score empty adjacent cells (influence)
  for (let y = 0; y < board.height; y++) {
    for (let x = 0; x < board.width; x++) {
      const cell = board.cells[y][x];
      if (cell.tokens.length > 0) continue; // skip occupied cells

      // Check which players have tokens adjacent to this empty cell
      const adjacentPlayers = new Set<string>();
      const neighbors = getNeighbors(x, y, board.width, board.height);
      for (const [nx, ny] of neighbors) {
        const ncell = board.cells[ny][nx];
        if (ncell.tokens.length > 0 && !ncell.contested) {
          adjacentPlayers.add(ncell.controller!);
        }
      }

      // If only one player's tokens are adjacent, they control this empty cell
      if (adjacentPlayers.size === 1) {
        const controller = adjacentPlayers.values().next().value;
        if (controller && scores[controller]) {
          scores[controller].controlledCells++;
        }
      }
    }
  }

  return Object.values(scores);
}

export function deriveResult(state: ConfluenceState): GameResult {
  const scores = deriveScores(state);
  const board = deriveBoard(state);

  let contestedCount = 0;
  for (let y = 0; y < board.height; y++) {
    for (let x = 0; x < board.width; x++) {
      if (board.cells[y][x].contested) contestedCount++;
    }
  }

  let winner: string | null = null;
  if (state.phase === "ended") {
    let maxScore = -1;
    for (const score of scores) {
      if (score.controlledCells > maxScore) {
        maxScore = score.controlledCells;
        winner = score.playerId;
      } else if (score.controlledCells === maxScore && maxScore > 0) {
        winner = null; // tie
      }
    }
  }

  return {
    scores,
    winner,
    totalCells: board.width * board.height,
    contestedCells: contestedCount,
  };
}

// ============================================================================
// Validation
// ============================================================================

export function isValidPlacement(
  state: ConfluenceState,
  x: number,
  y: number,
  playerId: string,
): boolean {
  if (state.phase !== "playing") return false;
  if (x < 0 || x >= state.config.width) return false;
  if (y < 0 || y >= state.config.height) return false;
  if (!state.players[playerId]) return false;
  return true;
}

export function isValidMerge(
  state: ConfluenceState,
  tokenIdA: string,
  tokenIdB: string,
  playerId: string,
): boolean {
  if (state.phase !== "playing") return false;
  if (!state.players[playerId]) return false;
  if (tokenIdA === tokenIdB) return false;

  const tokenA = state.tokens[tokenIdA];
  const tokenB = state.tokens[tokenIdB];
  if (!tokenA || !tokenB) return false;
  if (isTokenConsumed(state, tokenIdA) || isTokenConsumed(state, tokenIdB)) return false;
  if (tokenA.playerId !== playerId || tokenB.playerId !== playerId) return false;
  if (tokenA.strength >= 3 || tokenB.strength >= 3) return false; // max strength is 3

  // Must be adjacent
  const dx = Math.abs(tokenA.x - tokenB.x);
  const dy = Math.abs(tokenA.y - tokenB.y);
  return (dx <= 1 && dy <= 1) && (dx + dy > 0);
}

export function isValidSplit(
  state: ConfluenceState,
  tokenId: string,
  playerId: string,
): boolean {
  if (state.phase !== "playing") return false;
  if (!state.players[playerId]) return false;

  const token = state.tokens[tokenId];
  if (!token) return false;
  if (isTokenConsumed(state, tokenId)) return false;
  if (token.playerId !== playerId) return false;
  return token.strength >= 2; // only strength 2+ can split
}

// ============================================================================
// Actions (pure — return new state, don't mutate)
// ============================================================================

export function placeToken(
  state: ConfluenceState,
  x: number,
  y: number,
  playerId: string,
  opId: string,
  seq: number,
): ConfluenceState {
  if (!isValidPlacement(state, x, y, playerId)) {
    throw new Error(`Invalid placement at (${x},${y}) by ${playerId}`);
  }

  const newState = cloneState(state);
  const tokenId = `tok-${opId}`;

  newState.tokens[tokenId] = {
    id: tokenId,
    playerId,
    strength: 1,
    x,
    y,
    createdByOp: opId,
    _mergedFrom: null,
    _splitFrom: null,
    placedAt: Date.now(),
  };

  newState.ops[opId] = {
    type: "place",
    actor: playerId,
    seq,
    timestamp: Date.now(),
  };

  return newState;
}

export function mergeTokens(
  state: ConfluenceState,
  tokenIdA: string,
  tokenIdB: string,
  playerId: string,
  opId: string,
  seq: number,
): ConfluenceState {
  if (!isValidMerge(state, tokenIdA, tokenIdB, playerId)) {
    throw new Error(`Invalid merge: ${tokenIdA} + ${tokenIdB} by ${playerId}`);
  }

  const newState = cloneState(state);
  const tokenA = newState.tokens[tokenIdA];
  const tokenB = newState.tokens[tokenIdB];

  // Mark parents as consumed
  if (!newState.consumed[tokenIdA]) newState.consumed[tokenIdA] = {};
  newState.consumed[tokenIdA][opId] = true;
  if (!newState.consumed[tokenIdB]) newState.consumed[tokenIdB] = {};
  newState.consumed[tokenIdB][opId] = true;

  // Create merged token at tokenA's position
  const newTokenId = `tok-${opId}`;
  const newStrength = Math.min(3, tokenA.strength + tokenB.strength) as 1 | 2 | 3;

  newState.tokens[newTokenId] = {
    id: newTokenId,
    playerId,
    strength: newStrength,
    x: tokenA.x,
    y: tokenA.y,
    createdByOp: opId,
    _mergedFrom: [tokenIdA, tokenIdB],
    _splitFrom: null,
    placedAt: Date.now(),
  };

  newState.ops[opId] = {
    type: "merge",
    actor: playerId,
    seq,
    timestamp: Date.now(),
  };

  return newState;
}

export function splitToken(
  state: ConfluenceState,
  tokenId: string,
  playerId: string,
  targetX: number,
  targetY: number,
  opId: string,
  seq: number,
): ConfluenceState {
  if (!isValidSplit(state, tokenId, playerId)) {
    throw new Error(`Invalid split: ${tokenId} by ${playerId}`);
  }

  // Target must be adjacent and empty (or same cell)
  const token = state.tokens[tokenId];
  const dx = Math.abs(token.x - targetX);
  const dy = Math.abs(token.y - targetY);
  if (dx > 1 || dy > 1) {
    throw new Error(`Split target (${targetX},${targetY}) not adjacent to token at (${token.x},${token.y})`);
  }
  if (targetX < 0 || targetX >= state.config.width || targetY < 0 || targetY >= state.config.height) {
    throw new Error(`Split target (${targetX},${targetY}) out of bounds`);
  }

  const newState = cloneState(state);

  // Mark parent as consumed
  if (!newState.consumed[tokenId]) newState.consumed[tokenId] = {};
  newState.consumed[tokenId][opId] = true;

  // Create two new strength-1 tokens
  const newTokenId1 = `tok-${opId}-a`;
  const newTokenId2 = `tok-${opId}-b`;

  newState.tokens[newTokenId1] = {
    id: newTokenId1,
    playerId,
    strength: 1,
    x: token.x,
    y: token.y,
    createdByOp: opId,
    _mergedFrom: null,
    _splitFrom: tokenId,
    placedAt: Date.now(),
  };

  newState.tokens[newTokenId2] = {
    id: newTokenId2,
    playerId,
    strength: 1,
    x: targetX,
    y: targetY,
    createdByOp: opId,
    _mergedFrom: null,
    _splitFrom: tokenId,
    placedAt: Date.now(),
  };

  newState.ops[opId] = {
    type: "split",
    actor: playerId,
    seq,
    timestamp: Date.now(),
  };

  return newState;
}

export function endGame(state: ConfluenceState, opId: string, seq: number): ConfluenceState {
  const newState = cloneState(state);
  newState.phase = "ended";
  newState.ops[opId] = {
    type: "end",
    actor: "system",
    seq,
    timestamp: Date.now(),
  };
  const result = deriveResult(newState);
  newState.winner = result.winner;
  return newState;
}

// ============================================================================
// Provenance (the unique HyperToken feature)
// ============================================================================

export interface ProvenanceNode {
  token: ConfluenceToken;
  parents: ProvenanceNode[];
  children: ProvenanceNode[];
}

export function getProvenanceTree(
  state: ConfluenceState,
  tokenId: string,
  visited: Set<string> = new Set(),
): ProvenanceNode | null {
  if (visited.has(tokenId)) return null;
  visited.add(tokenId);

  const token = state.tokens[tokenId];
  if (!token) return null;

  const parents: ProvenanceNode[] = [];
  if (token._mergedFrom) {
    for (const parentId of token._mergedFrom) {
      const parent = getProvenanceTree(state, parentId, visited);
      if (parent) parents.push(parent);
    }
  }
  if (token._splitFrom) {
    const parent = getProvenanceTree(state, token._splitFrom, visited);
    if (parent) parents.push(parent);
  }

  // Find children (tokens that have this token as a parent)
  const children: ProvenanceNode[] = [];
  for (const [childId, childToken] of Object.entries(state.tokens)) {
    if (
      (childToken._mergedFrom && childToken._mergedFrom.includes(tokenId)) ||
      childToken._splitFrom === tokenId
    ) {
      const child = getProvenanceTree(state, childId, visited);
      if (child) children.push(child);
    }
  }

  return { token, parents, children };
}

// ============================================================================
// Utilities
// ============================================================================

function getNeighbors(x: number, y: number, width: number, height: number): [number, number][] {
  const neighbors: [number, number][] = [];
  for (let dy = -1; dy <= 1; dy++) {
    for (let dx = -1; dx <= 1; dx++) {
      if (dx === 0 && dy === 0) continue;
      const nx = x + dx;
      const ny = y + dy;
      if (nx >= 0 && nx < width && ny >= 0 && ny < height) {
        neighbors.push([nx, ny]);
      }
    }
  }
  return neighbors;
}

function cloneState(state: ConfluenceState): ConfluenceState {
  return JSON.parse(JSON.stringify(state));
}

export function isTimeUp(state: ConfluenceState): boolean {
  if (state.phase === "ended") return true;
  return Date.now() - state.startTime >= state.config.durationMs;
}

export function getTimeRemaining(state: ConfluenceState): number {
  if (state.phase === "ended") return 0;
  return Math.max(0, state.config.durationMs - (Date.now() - state.startTime));
}
