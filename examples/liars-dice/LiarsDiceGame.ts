/**
 * Liar's Dice - Bluffing Bidding Game
 *
 * Players hide dice under cups and make increasingly bold claims
 * about the total dice showing a face value across ALL players.
 * Challenge a bid you think is false - but if you're wrong, you lose!
 *
 * Rules:
 * - Each player starts with N dice (default 5)
 * - Players bid: "There are at least X dice showing Y"
 * - Bids must increase (higher quantity OR same quantity + higher face)
 * - Ones are wild (count as any face value)
 * - Call "Liar!" to challenge the previous bid
 * - Loser of challenge loses one die
 * - Last player with dice wins
 *
 * Engine integration:
 * - Players are CRDT-backed agents; dice count is an agent resource
 * - Per-player dice values (hidden from others) are stored in agent meta
 * - Turn / phase / bid state lives in doc.gameState via session.change()
 */

import { Engine } from "../../engine/Engine.js";

// ============================================================================
// Types
// ============================================================================

export interface Bid {
  quantity: number;
  face: number; // 2-6 (1s are wild)
}

export interface PlayerState {
  dice: number[]; // Values 1-6
  diceCount: number;
  alive: boolean;
}

export interface LiarsDiceGameState {
  players: PlayerState[];
  currentPlayer: number;
  currentBid: Bid | null;
  lastBidder: number | null;
  roundNumber: number;
  turnInRound: number;
  winner: number | null;
  lastAction: string | null;
  phase: "bid" | "complete";
}

export interface LiarsDiceConfig {
  numPlayers?: number;
  startingDice?: number;
  seed?: number | null;
}

// ============================================================================
// Constants
// ============================================================================

export const DEFAULT_STARTING_DICE = 5;
export const MIN_FACE = 2;
export const MAX_FACE = 6;
const WILD_FACE = 1;

// ============================================================================
// Seeded Random
// ============================================================================

class SeededRandom {
  private seed: number;

  constructor(seed?: number) {
    this.seed = seed ?? Date.now();
  }

  next(): number {
    this.seed = (this.seed * 1103515245 + 12345) & 0x7fffffff;
    return this.seed / 0x7fffffff;
  }

  rollDie(): number {
    return Math.floor(this.next() * 6) + 1;
  }

  rollDice(count: number): number[] {
    return Array.from({ length: count }, () => this.rollDie());
  }
}

// ============================================================================
// LiarsDiceGame Class
// ============================================================================

export class LiarsDiceGame {
  private config: Required<LiarsDiceConfig>;
  private rng: SeededRandom;
  readonly engine: Engine;

  constructor(engine: Engine, config: LiarsDiceConfig = {}) {
    const numPlayers = config.numPlayers ?? 2;
    if (numPlayers < 2 || numPlayers > 6) {
      throw new Error("Liar's Dice requires 2-6 players");
    }

    this.engine = engine;
    this.config = {
      numPlayers,
      startingDice: config.startingDice ?? DEFAULT_STARTING_DICE,
      seed: config.seed ?? null,
    };

    this.rng = new SeededRandom(this.config.seed ?? undefined);
    this._initState();
  }

  // ── CRDT state helpers ─────────────────────────────────────────────────────

  private get state(): LiarsDiceGameState {
    return (this.engine._gameState as any) as LiarsDiceGameState;
  }

  /** Atomically update multiple game-state fields in one CRDT change. */
  private mergeState(updates: Partial<LiarsDiceGameState>): void {
    this.engine.session.change("liars-dice:mergeState", (doc: any) => {
      if (!doc.gameState) doc.gameState = {};
      Object.assign(doc.gameState, updates);
    });
  }

  /** Update a single player's fields atomically. */
  private mergePlayer(playerIndex: number, updates: Partial<PlayerState>): void {
    this.engine.session.change("liars-dice:mergePlayer", (doc: any) => {
      if (!doc.gameState?.players?.[playerIndex]) return;
      Object.assign(doc.gameState.players[playerIndex], updates);
    });
  }

  // ── Initialization ─────────────────────────────────────────────────────────

  private _initState(): void {
    const players: PlayerState[] = [];
    for (let i = 0; i < this.config.numPlayers; i++) {
      players.push({
        dice: this.rng.rollDice(this.config.startingDice),
        diceCount: this.config.startingDice,
        alive: true,
      });
    }

    this.engine.session.change("liars-dice:init", (doc: any) => {
      doc.gameState = {
        players,
        currentPlayer: 0,
        currentBid: null,
        lastBidder: null,
        roundNumber: 1,
        turnInRound: 0,
        winner: null,
        lastAction: null,
        phase: "bid",
      };
    });

    // Create engine agents (one per player) — coins via resources, status via meta
    for (let i = 0; i < this.config.numPlayers; i++) {
      this.engine.dispatch("agent:create", { name: `player-${i}`, meta: { playerIndex: i } });
      this.engine.dispatch("agent:giveResource", {
        name: `player-${i}`,
        resource: "dice",
        amount: this.config.startingDice,
      });
    }

    this.engine.dispatch("game:loopInit", { maxTurns: 1000 });
    this.engine.dispatch("game:loopStart");
  }

  reset(seed?: number): void {
    if (seed !== undefined) {
      this.rng = new SeededRandom(seed);
    } else if (this.config.seed !== null) {
      this.rng = new SeededRandom(this.config.seed!);
    } else {
      this.rng = new SeededRandom();
    }

    // Remove existing agents before re-creating
    for (let i = 0; i < this.config.numPlayers; i++) {
      try { this.engine.dispatch("agent:remove", { name: `player-${i}` }); } catch {}
    }

    this._initState();
  }

  // ── Public API ─────────────────────────────────────────────────────────────

  getState(): LiarsDiceGameState {
    return JSON.parse(JSON.stringify(this.state));
  }

  /**
   * Get observation for a player — can only see own dice, not others'.
   */
  getObservation(playerIndex: number) {
    const s = this.state;
    const player = s.players[playerIndex];

    return {
      myDice: [...player.dice],
      myDiceCount: player.diceCount,
      otherPlayers: s.players
        .map((p, i) => ({ playerIndex: i, diceCount: p.diceCount, alive: p.alive }))
        .filter((_, i) => i !== playerIndex),
      totalDiceInPlay: this.getTotalDice(),
      currentBid: s.currentBid,
      lastBidder: s.lastBidder,
      currentPlayer: s.currentPlayer,
      roundNumber: s.roundNumber,
      winner: s.winner,
      lastAction: s.lastAction,
    };
  }

  private getTotalDice(): number {
    return this.state.players.reduce((sum, p) => sum + p.diceCount, 0);
  }

  get numPlayers(): number {
    return this.config.numPlayers;
  }

  get startingDice(): number {
    return this.config.startingDice;
  }

  /**
   * Get valid actions for a player.
   */
  getValidActions(playerIndex: number): string[] {
    const s = this.state;
    if (playerIndex !== s.currentPlayer) return [];
    if (!s.players[playerIndex].alive) return [];
    if (s.winner !== null) return [];

    const actions: string[] = [];
    const totalDice = this.getTotalDice();

    if (s.currentBid) {
      actions.push("liar");
    }

    const minQuantity = s.currentBid ? s.currentBid.quantity : 1;

    for (let qty = minQuantity; qty <= totalDice; qty++) {
      for (let face = MIN_FACE; face <= MAX_FACE; face++) {
        if (this.isValidBid(qty, face)) {
          actions.push(`bid:${qty}:${face}`);
        }
      }
    }

    return actions;
  }

  private isValidBid(quantity: number, face: number): boolean {
    const bid = this.state.currentBid;
    if (quantity < 1 || face < MIN_FACE || face > MAX_FACE) return false;
    if (!bid) return true;
    if (quantity > bid.quantity) return true;
    if (quantity === bid.quantity && face > bid.face) return true;
    return false;
  }

  /**
   * Execute an action string ("liar" or "bid:qty:face").
   */
  action(actionStr: string): { success: boolean; message: string } {
    const playerIndex = this.state.currentPlayer;
    const valid = this.getValidActions(playerIndex);

    if (!valid.includes(actionStr)) {
      return { success: false, message: `Invalid action: ${actionStr}` };
    }

    if (actionStr === "liar") {
      return this.handleChallenge(playerIndex);
    }

    const [, qtyStr, faceStr] = actionStr.split(":");
    return this.handleBid(playerIndex, parseInt(qtyStr), parseInt(faceStr));
  }

  private handleBid(player: number, quantity: number, face: number): { success: boolean; message: string } {
    const message = `Player ${player} bids: ${quantity}x ${face}s`;
    this.mergeState({
      currentBid: { quantity, face },
      lastBidder: player,
      turnInRound: this.state.turnInRound + 1,
      lastAction: message,
    });
    this.advancePlayer();
    this.engine.dispatch("game:nextTurn", { agentCount: this.config.numPlayers });
    return { success: true, message };
  }

  private handleChallenge(challenger: number): { success: boolean; message: string } {
    const s = this.state;
    const bid = s.currentBid!;
    const bidder = s.lastBidder!;

    // Count dice matching the bid (including wilds)
    let actualCount = 0;
    for (const p of s.players) {
      if (p.alive) {
        for (const die of p.dice) {
          if (die === bid.face || die === WILD_FACE) actualCount++;
        }
      }
    }

    const bidWasValid = actualCount >= bid.quantity;
    const loser = bidWasValid ? challenger : bidder;

    let message = bidWasValid
      ? `Player ${challenger} calls LIAR! But there were ${actualCount}x ${bid.face}s (needed ${bid.quantity}). Challenger loses!`
      : `Player ${challenger} calls LIAR! Only ${actualCount}x ${bid.face}s (claimed ${bid.quantity}). Bidder loses!`;

    const newDiceCount = s.players[loser].diceCount - 1;
    const loserEliminated = newDiceCount <= 0;

    this.mergePlayer(loser, {
      diceCount: newDiceCount,
      alive: !loserEliminated,
      dice: loserEliminated ? [] : s.players[loser].dice,
    });

    // Sync agent resource
    this.engine.dispatch("agent:takeResource", { name: `player-${loser}`, resource: "dice", amount: 1 });
    if (loserEliminated) {
      this.engine.dispatch("agent:setMeta", { name: `player-${loser}`, key: "status", value: "eliminated" });
      this.engine.dispatch("agent:setActive", { name: `player-${loser}`, active: false });
    }

    // Re-read state after mergePlayer to get fresh players list
    const alivePlayers = this.state.players.filter(p => p.alive);

    if (alivePlayers.length === 1) {
      const winnerIndex = this.state.players.findIndex(p => p.alive);
      message += ` Player ${winnerIndex} wins!`;
      this.mergeState({ winner: winnerIndex, phase: "complete", lastAction: message });
      this.engine.dispatch("game:end", { winner: `player-${winnerIndex}`, reason: "last_standing" });
      this.engine.dispatch("game:loopStop", { phase: "complete" });
    } else {
      this.startNewRound(loser);
      this.mergeState({ lastAction: message });
    }

    return { success: true, message };
  }

  private startNewRound(loserStartsNext: number): void {
    const s = this.state;
    const freshPlayers: PlayerState[] = s.players.map(p => ({
      ...p,
      dice: p.alive ? this.rng.rollDice(p.diceCount) : [],
    }));

    const nextPlayer = freshPlayers[loserStartsNext].alive
      ? loserStartsNext
      : this.findNextAlivePlayer(loserStartsNext, freshPlayers);

    this.engine.session.change("liars-dice:newRound", (doc: any) => {
      if (!doc.gameState) return;
      doc.gameState.players = freshPlayers;
      doc.gameState.currentBid = null;
      doc.gameState.lastBidder = null;
      doc.gameState.roundNumber = (doc.gameState.roundNumber ?? 1) + 1;
      doc.gameState.turnInRound = 0;
      doc.gameState.currentPlayer = nextPlayer;
    });
  }

  private advancePlayer(): void {
    const next = this.findNextAlivePlayer(this.state.currentPlayer, this.state.players);
    this.mergeState({ currentPlayer: next });
  }

  private findNextAlivePlayer(from: number, players: PlayerState[] = this.state.players): number {
    let next = (from + 1) % this.config.numPlayers;
    while (!players[next].alive && next !== from) {
      next = (next + 1) % this.config.numPlayers;
    }
    return next;
  }

  render(): void {
    const s = this.state;
    console.log("\n" + "=".repeat(50));
    console.log("LIAR'S DICE");
    console.log("=".repeat(50));
    console.log(`Round: ${s.roundNumber} | Turn: ${s.turnInRound}`);
    console.log(`Total dice in play: ${this.getTotalDice()}`);

    if (s.currentBid) {
      console.log(`Current bid: ${s.currentBid.quantity}x ${s.currentBid.face}s (by Player ${s.lastBidder})`);
    } else {
      console.log("No bid yet");
    }

    console.log("\nPlayers:");
    for (let i = 0; i < this.config.numPlayers; i++) {
      const p = s.players[i];
      const marker = i === s.currentPlayer ? "→ " : "  ";
      const status = p.alive ? "" : " [OUT]";
      const dice = p.dice.map(d => `[${d}]`).join(" ");
      console.log(`${marker}Player ${i}: ${p.diceCount} dice ${dice}${status}`);
    }

    if (s.lastAction) console.log(`\nLast: ${s.lastAction}`);
    if (s.winner !== null) console.log(`\n*** PLAYER ${s.winner} WINS ***`);
  }
}

// ============================================================================
// Action Encoding (unchanged — used by LiarsDiceAEC)
// ============================================================================

export function getActionSpaceSize(maxDice: number): number {
  // "liar" = 1, bids: quantity (1 to maxDice) × face (2-6) = maxDice * 5
  return 1 + maxDice * 5;
}

export function encodeBid(quantity: number, face: number, _maxDice: number): number {
  return 1 + (quantity - 1) * 5 + (face - 2);
}

export function decodeBid(action: number, _maxDice: number): { type: "liar" } | { type: "bid"; quantity: number; face: number } {
  if (action === 0) return { type: "liar" };
  const bidIndex = action - 1;
  const quantity = Math.floor(bidIndex / 5) + 1;
  const face = (bidIndex % 5) + 2;
  return { type: "bid", quantity, face };
}
