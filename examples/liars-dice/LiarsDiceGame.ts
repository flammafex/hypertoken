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
 */

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

const DEFAULT_STARTING_DICE = 5;
const MIN_FACE = 2;
const MAX_FACE = 6;
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
  private state: LiarsDiceGameState;

  constructor(config: LiarsDiceConfig = {}) {
    const numPlayers = config.numPlayers ?? 2;
    if (numPlayers < 2 || numPlayers > 6) {
      throw new Error("Liar's Dice requires 2-6 players");
    }

    this.config = {
      numPlayers,
      startingDice: config.startingDice ?? DEFAULT_STARTING_DICE,
      seed: config.seed ?? null,
    };

    this.rng = new SeededRandom(this.config.seed ?? undefined);
    this.state = this.createInitialState();
  }

  reset(seed?: number): void {
    if (seed !== undefined) {
      this.rng = new SeededRandom(seed);
    } else if (this.config.seed !== null) {
      this.rng = new SeededRandom(this.config.seed);
    } else {
      this.rng = new SeededRandom();
    }
    this.state = this.createInitialState();
  }

  private createInitialState(): LiarsDiceGameState {
    const players: PlayerState[] = [];

    for (let i = 0; i < this.config.numPlayers; i++) {
      players.push({
        dice: this.rng.rollDice(this.config.startingDice),
        diceCount: this.config.startingDice,
        alive: true,
      });
    }

    return {
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
  }

  getState(): LiarsDiceGameState {
    return JSON.parse(JSON.stringify(this.state));
  }

  /**
   * Get observation for a player (can only see own dice)
   */
  getObservation(playerIndex: number) {
    const player = this.state.players[playerIndex];

    return {
      myDice: [...player.dice],
      myDiceCount: player.diceCount,
      otherPlayers: this.state.players.map((p, i) => ({
        playerIndex: i,
        diceCount: p.diceCount,
        alive: p.alive,
      })).filter((_, i) => i !== playerIndex),
      totalDiceInPlay: this.getTotalDice(),
      currentBid: this.state.currentBid,
      lastBidder: this.state.lastBidder,
      currentPlayer: this.state.currentPlayer,
      roundNumber: this.state.roundNumber,
      winner: this.state.winner,
      lastAction: this.state.lastAction,
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
   * Get valid actions for current player
   */
  getValidActions(playerIndex: number): string[] {
    if (playerIndex !== this.state.currentPlayer) return [];
    if (!this.state.players[playerIndex].alive) return [];
    if (this.state.winner !== null) return [];

    const actions: string[] = [];
    const totalDice = this.getTotalDice();

    // Can always call liar if there's a bid
    if (this.state.currentBid) {
      actions.push("liar");
    }

    // Generate valid bids
    const minQuantity = this.state.currentBid ? this.state.currentBid.quantity : 1;
    const minFace = this.state.currentBid ? this.state.currentBid.face : MIN_FACE;

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
    if (quantity < 1 || face < MIN_FACE || face > MAX_FACE) {
      return false;
    }

    if (!this.state.currentBid) {
      return true;
    }

    // Must increase: higher quantity, OR same quantity with higher face
    if (quantity > this.state.currentBid.quantity) {
      return true;
    }
    if (quantity === this.state.currentBid.quantity && face > this.state.currentBid.face) {
      return true;
    }

    return false;
  }

  /**
   * Execute an action
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

    const [_, qtyStr, faceStr] = actionStr.split(":");
    const quantity = parseInt(qtyStr);
    const face = parseInt(faceStr);

    return this.handleBid(playerIndex, quantity, face);
  }

  private handleBid(player: number, quantity: number, face: number): { success: boolean; message: string } {
    this.state.currentBid = { quantity, face };
    this.state.lastBidder = player;
    this.state.turnInRound++;

    this.advancePlayer();

    const message = `Player ${player} bids: ${quantity}x ${face}s`;
    this.state.lastAction = message;
    return { success: true, message };
  }

  private handleChallenge(challenger: number): { success: boolean; message: string } {
    const bid = this.state.currentBid!;
    const bidder = this.state.lastBidder!;

    // Count actual dice matching the bid (including wilds)
    let actualCount = 0;
    for (const player of this.state.players) {
      if (player.alive) {
        for (const die of player.dice) {
          if (die === bid.face || die === WILD_FACE) {
            actualCount++;
          }
        }
      }
    }

    let loser: number;
    let message: string;

    if (actualCount >= bid.quantity) {
      // Bid was valid - challenger loses
      loser = challenger;
      message = `Player ${challenger} calls LIAR! But there were ${actualCount}x ${bid.face}s (needed ${bid.quantity}). Challenger loses!`;
    } else {
      // Bid was a lie - bidder loses
      loser = bidder;
      message = `Player ${challenger} calls LIAR! Only ${actualCount}x ${bid.face}s (claimed ${bid.quantity}). Bidder loses!`;
    }

    // Loser loses a die
    this.state.players[loser].diceCount--;
    if (this.state.players[loser].diceCount <= 0) {
      this.state.players[loser].alive = false;
      this.state.players[loser].dice = [];
    }

    // Check for winner
    const alivePlayers = this.state.players.filter(p => p.alive);
    if (alivePlayers.length === 1) {
      const winnerIndex = this.state.players.findIndex(p => p.alive);
      this.state.winner = winnerIndex;
      this.state.phase = "complete";
      message += ` Player ${winnerIndex} wins!`;
    } else {
      // Start new round
      this.startNewRound(loser);
    }

    this.state.lastAction = message;
    return { success: true, message };
  }

  private startNewRound(loserStartsNext: number): void {
    // Reroll all dice
    for (const player of this.state.players) {
      if (player.alive) {
        player.dice = this.rng.rollDice(player.diceCount);
      }
    }

    this.state.currentBid = null;
    this.state.lastBidder = null;
    this.state.roundNumber++;
    this.state.turnInRound = 0;

    // Loser starts next round (if still alive)
    if (this.state.players[loserStartsNext].alive) {
      this.state.currentPlayer = loserStartsNext;
    } else {
      this.state.currentPlayer = this.findNextAlivePlayer(loserStartsNext);
    }
  }

  private advancePlayer(): void {
    this.state.currentPlayer = this.findNextAlivePlayer(this.state.currentPlayer);
  }

  private findNextAlivePlayer(from: number): number {
    let next = (from + 1) % this.config.numPlayers;
    while (!this.state.players[next].alive && next !== from) {
      next = (next + 1) % this.config.numPlayers;
    }
    return next;
  }

  render(): void {
    console.log("\n" + "=".repeat(50));
    console.log("LIAR'S DICE");
    console.log("=".repeat(50));
    console.log(`Round: ${this.state.roundNumber} | Turn: ${this.state.turnInRound}`);
    console.log(`Total dice in play: ${this.getTotalDice()}`);

    if (this.state.currentBid) {
      console.log(`Current bid: ${this.state.currentBid.quantity}x ${this.state.currentBid.face}s (by Player ${this.state.lastBidder})`);
    } else {
      console.log("No bid yet");
    }

    console.log("\nPlayers:");
    for (let i = 0; i < this.config.numPlayers; i++) {
      const p = this.state.players[i];
      const marker = i === this.state.currentPlayer ? "→ " : "  ";
      const status = p.alive ? "" : " [OUT]";
      const dice = p.dice.map(d => `[${d}]`).join(" ");
      console.log(`${marker}Player ${i}: ${p.diceCount} dice ${dice}${status}`);
    }

    if (this.state.lastAction) {
      console.log(`\nLast: ${this.state.lastAction}`);
    }
    if (this.state.winner !== null) {
      console.log(`\n*** PLAYER ${this.state.winner} WINS ***`);
    }
  }
}

// ============================================================================
// Action Encoding
// ============================================================================

export function getActionSpaceSize(maxDice: number): number {
  // "liar" = 1
  // bids: quantity (1 to maxDice) × face (2-6) = maxDice * 5
  return 1 + maxDice * 5;
}

export function encodeBid(quantity: number, face: number, maxDice: number): number {
  // 0 = liar
  // 1+ = bids
  return 1 + (quantity - 1) * 5 + (face - 2);
}

export function decodeBid(action: number, maxDice: number): { type: "liar" } | { type: "bid"; quantity: number; face: number } {
  if (action === 0) {
    return { type: "liar" };
  }
  const bidIndex = action - 1;
  const quantity = Math.floor(bidIndex / 5) + 1;
  const face = (bidIndex % 5) + 2;
  return { type: "bid", quantity, face };
}
