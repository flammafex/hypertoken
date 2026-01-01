/**
 * Texas Hold'em Poker Game
 *
 * Core game logic for heads-up (2-player) no-limit Texas Hold'em.
 * Simplified for reinforcement learning with discretized bet sizes.
 *
 * Game Flow:
 *   1. Post blinds (small blind, big blind)
 *   2. Deal 2 hole cards to each player
 *   3. Preflop betting round
 *   4. Deal 3 community cards (flop)
 *   5. Flop betting round
 *   6. Deal 1 community card (turn)
 *   7. Turn betting round
 *   8. Deal 1 community card (river)
 *   9. River betting round
 *   10. Showdown (if needed)
 */

import { Card, evaluateHand, compareHands, tokenToCard, formatCards } from "./HandEvaluator.js";

export type PokerPhase = "preflop" | "flop" | "turn" | "river" | "showdown" | "complete";

export interface PlayerState {
  name: string;
  chips: number;
  holeCards: Card[];
  currentBet: number;
  totalBetThisRound: number;
  folded: boolean;
  allIn: boolean;
  isDealer: boolean;
}

export interface PokerGameState {
  players: PlayerState[];
  communityCards: Card[];
  pot: number;
  currentBet: number;
  phase: PokerPhase;
  currentPlayerIndex: number;
  dealerIndex: number;
  smallBlind: number;
  bigBlind: number;
  lastRaiseAmount: number;
  actionsThisRound: number;
  winner: string | null;
  winningHand: string | null;
}

export interface PokerConfig {
  smallBlind?: number;
  bigBlind?: number;
  startingChips?: number;
  playerNames?: string[];
  /** Use extended action space with 10 bet sizes (default: false = 6 actions) */
  extendedActions?: boolean;
}

/**
 * Action definitions for basic mode (6 actions)
 */
export const BASIC_ACTIONS = {
  FOLD: 0,
  CHECK: 1,
  CALL: 2,
  RAISE_HALF_POT: 3,
  RAISE_POT: 4,
  ALL_IN: 5,
} as const;

/**
 * Action definitions for extended mode (10 actions)
 *
 * More granular bet sizing for advanced RL training:
 * - Min raise (1/3 pot)
 * - Half pot, 2/3 pot, pot
 * - Overbet sizes (1.5x, 2x pot)
 */
export const EXTENDED_ACTIONS = {
  FOLD: 0,
  CHECK: 1,
  CALL: 2,
  RAISE_THIRD_POT: 3,   // ~33% pot (min raise)
  RAISE_HALF_POT: 4,    // 50% pot
  RAISE_TWO_THIRDS: 5,  // ~67% pot
  RAISE_POT: 6,         // 100% pot
  RAISE_1_5X_POT: 7,    // 150% pot
  RAISE_2X_POT: 8,      // 200% pot
  ALL_IN: 9,
} as const;

export const BASIC_ACTION_NAMES = ["Fold", "Check", "Call", "Raise ½", "Raise Pot", "All-In"];
export const EXTENDED_ACTION_NAMES = ["Fold", "Check", "Call", "Raise ⅓", "Raise ½", "Raise ⅔", "Raise Pot", "Raise 1.5x", "Raise 2x", "All-In"];

// Standard deck for internal use
const RANKS = ["2", "3", "4", "5", "6", "7", "8", "9", "10", "J", "Q", "K", "A"];
const SUITS = ["hearts", "diamonds", "clubs", "spades"];

/**
 * Generate a fresh shuffled deck
 */
function createDeck(seed?: number): Card[] {
  const deck: Card[] = [];
  for (const suit of SUITS) {
    for (const rank of RANKS) {
      deck.push({ rank, suit });
    }
  }
  // Fisher-Yates shuffle with optional seed
  const random = seed !== undefined ? seededRandom(seed) : Math.random;
  for (let i = deck.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [deck[i], deck[j]] = [deck[j], deck[i]];
  }
  return deck;
}

/**
 * Simple seeded random number generator
 */
function seededRandom(seed: number): () => number {
  return () => {
    seed = (seed * 1103515245 + 12345) & 0x7fffffff;
    return seed / 0x7fffffff;
  };
}

/**
 * Texas Hold'em Poker Game
 */
export class PokerGame {
  private deck: Card[] = [];
  private state: PokerGameState;
  private config: Required<PokerConfig>;

  constructor(config: PokerConfig = {}) {
    this.config = {
      smallBlind: config.smallBlind ?? 1,
      bigBlind: config.bigBlind ?? 2,
      startingChips: config.startingChips ?? 100,
      playerNames: config.playerNames ?? ["player_0", "player_1"],
      extendedActions: config.extendedActions ?? false,
    };

    this.state = this.createInitialState();
  }

  /**
   * Get the number of actions in the action space
   */
  getNumActions(): number {
    return this.config.extendedActions ? 10 : 6;
  }

  /**
   * Get action names
   */
  getActionNames(): string[] {
    return this.config.extendedActions ? EXTENDED_ACTION_NAMES : BASIC_ACTION_NAMES;
  }

  private createInitialState(): PokerGameState {
    const players: PlayerState[] = this.config.playerNames.map((name, i) => ({
      name,
      chips: this.config.startingChips,
      holeCards: [],
      currentBet: 0,
      totalBetThisRound: 0,
      folded: false,
      allIn: false,
      isDealer: i === 0,
    }));

    return {
      players,
      communityCards: [],
      pot: 0,
      currentBet: 0,
      phase: "preflop",
      currentPlayerIndex: 0,
      dealerIndex: 0,
      smallBlind: this.config.smallBlind,
      bigBlind: this.config.bigBlind,
      lastRaiseAmount: this.config.bigBlind,
      actionsThisRound: 0,
      winner: null,
      winningHand: null,
    };
  }

  /**
   * Reset and start a new hand
   */
  reset(seed?: number): void {
    // Create fresh shuffled deck
    this.deck = createDeck(seed);

    // Rotate dealer
    const prevDealerIndex = this.state.dealerIndex;
    const newDealerIndex = (prevDealerIndex + 1) % this.state.players.length;

    // Reset player states
    for (let i = 0; i < this.state.players.length; i++) {
      const player = this.state.players[i];
      // Keep chips from previous round (or reset if busted)
      if (player.chips <= 0) {
        player.chips = this.config.startingChips;
      }
      player.holeCards = [];
      player.currentBet = 0;
      player.totalBetThisRound = 0;
      player.folded = false;
      player.allIn = false;
      player.isDealer = i === newDealerIndex;
    }

    // Reset game state
    this.state.communityCards = [];
    this.state.pot = 0;
    this.state.currentBet = 0;
    this.state.phase = "preflop";
    this.state.dealerIndex = newDealerIndex;
    this.state.lastRaiseAmount = this.config.bigBlind;
    this.state.actionsThisRound = 0;
    this.state.winner = null;
    this.state.winningHand = null;

    // Post blinds (heads-up: dealer posts SB, other posts BB)
    const sbIndex = this.state.dealerIndex;
    const bbIndex = (this.state.dealerIndex + 1) % 2;

    this.postBlind(sbIndex, this.config.smallBlind);
    this.postBlind(bbIndex, this.config.bigBlind);
    this.state.currentBet = this.config.bigBlind;

    // Deal hole cards
    for (let i = 0; i < 2; i++) {
      for (const player of this.state.players) {
        player.holeCards.push(this.deck.pop()!);
      }
    }

    // In heads-up, dealer (SB) acts first preflop
    this.state.currentPlayerIndex = sbIndex;
  }

  /**
   * Post a blind bet
   */
  private postBlind(playerIndex: number, amount: number): void {
    const player = this.state.players[playerIndex];
    const actualAmount = Math.min(amount, player.chips);
    player.chips -= actualAmount;
    player.currentBet = actualAmount;
    player.totalBetThisRound = actualAmount;
    this.state.pot += actualAmount;
    if (player.chips === 0) {
      player.allIn = true;
    }
  }

  /**
   * Get the current game state
   */
  getState(): PokerGameState {
    return { ...this.state };
  }

  /**
   * Get the current player
   */
  getCurrentPlayer(): PlayerState {
    return this.state.players[this.state.currentPlayerIndex];
  }

  /**
   * Get player by name
   */
  getPlayer(name: string): PlayerState | undefined {
    return this.state.players.find(p => p.name === name);
  }

  /**
   * Check if the hand is complete
   */
  isComplete(): boolean {
    return this.state.phase === "complete";
  }

  /**
   * Get valid actions for the current player
   * Basic mode: [fold, check, call, raise_half, raise_pot, all_in]
   * Extended mode: [fold, check, call, raise_1/3, raise_1/2, raise_2/3, raise_pot, raise_1.5x, raise_2x, all_in]
   */
  getValidActions(): boolean[] {
    const numActions = this.getNumActions();

    if (this.state.phase === "complete" || this.state.phase === "showdown") {
      return new Array(numActions).fill(false);
    }

    const player = this.getCurrentPlayer();
    if (player.folded || player.allIn) {
      return new Array(numActions).fill(false);
    }

    const toCall = this.state.currentBet - player.currentBet;
    const canCheck = toCall === 0;
    const canCall = toCall > 0 && player.chips >= toCall;
    const canAllIn = player.chips > 0;
    const minRaiseAmount = this.state.lastRaiseAmount;

    /**
     * Check if a raise of given amount is valid
     */
    const canRaise = (raiseAmount: number): boolean => {
      return player.chips > toCall + raiseAmount && raiseAmount >= minRaiseAmount;
    };

    if (this.config.extendedActions) {
      // Extended mode: 10 actions
      const thirdPot = Math.floor(this.state.pot / 3);
      const halfPot = Math.floor(this.state.pot / 2);
      const twoThirdsPot = Math.floor((this.state.pot * 2) / 3);
      const potRaise = this.state.pot;
      const oneAndHalfPot = Math.floor((this.state.pot * 3) / 2);
      const twoPot = this.state.pot * 2;

      return [
        true,                    // 0: fold
        canCheck,                // 1: check
        canCall,                 // 2: call
        canRaise(thirdPot),      // 3: raise 1/3 pot
        canRaise(halfPot),       // 4: raise 1/2 pot
        canRaise(twoThirdsPot),  // 5: raise 2/3 pot
        canRaise(potRaise),      // 6: raise pot
        canRaise(oneAndHalfPot), // 7: raise 1.5x pot
        canRaise(twoPot),        // 8: raise 2x pot
        canAllIn,                // 9: all-in
      ];
    } else {
      // Basic mode: 6 actions
      const halfPot = Math.floor(this.state.pot / 2);
      const potRaise = this.state.pot;

      return [
        true,               // 0: fold
        canCheck,           // 1: check
        canCall,            // 2: call
        canRaise(halfPot),  // 3: raise half pot
        canRaise(potRaise), // 4: raise pot
        canAllIn,           // 5: all-in
      ];
    }
  }

  /**
   * Execute an action
   * Basic: 0=fold, 1=check, 2=call, 3=raise_half_pot, 4=raise_pot, 5=all_in
   * Extended: 0=fold, 1=check, 2=call, 3=raise_1/3, 4=raise_1/2, 5=raise_2/3, 6=raise_pot, 7=raise_1.5x, 8=raise_2x, 9=all_in
   */
  action(actionId: number): void {
    if (this.state.phase === "complete") return;

    const player = this.getCurrentPlayer();
    if (player.folded || player.allIn) {
      this.advanceToNextPlayer();
      return;
    }

    const validActions = this.getValidActions();
    if (!validActions[actionId]) {
      // Invalid action - default to check/fold
      if (validActions[1]) {
        actionId = 1; // check
      } else {
        actionId = 0; // fold
      }
    }

    if (this.config.extendedActions) {
      // Extended action space (10 actions)
      switch (actionId) {
        case 0: this.doFold(player); break;
        case 1: this.doCheck(player); break;
        case 2: this.doCall(player); break;
        case 3: this.doRaise(player, Math.floor(this.state.pot / 3)); break;        // 1/3 pot
        case 4: this.doRaise(player, Math.floor(this.state.pot / 2)); break;        // 1/2 pot
        case 5: this.doRaise(player, Math.floor((this.state.pot * 2) / 3)); break;  // 2/3 pot
        case 6: this.doRaise(player, this.state.pot); break;                         // pot
        case 7: this.doRaise(player, Math.floor((this.state.pot * 3) / 2)); break;  // 1.5x pot
        case 8: this.doRaise(player, this.state.pot * 2); break;                     // 2x pot
        case 9: this.doAllIn(player); break;
      }
    } else {
      // Basic action space (6 actions)
      switch (actionId) {
        case 0: this.doFold(player); break;
        case 1: this.doCheck(player); break;
        case 2: this.doCall(player); break;
        case 3: this.doRaise(player, Math.floor(this.state.pot / 2)); break;  // 1/2 pot
        case 4: this.doRaise(player, this.state.pot); break;                   // pot
        case 5: this.doAllIn(player); break;
      }
    }

    this.state.actionsThisRound++;
    this.advanceToNextPlayer();
  }

  private doFold(player: PlayerState): void {
    player.folded = true;
    // Check if only one player remains
    const activePlayers = this.state.players.filter(p => !p.folded);
    if (activePlayers.length === 1) {
      this.endHand(activePlayers[0].name, "fold");
    }
  }

  private doCheck(_player: PlayerState): void {
    // Nothing to do
  }

  private doCall(player: PlayerState): void {
    const toCall = this.state.currentBet - player.currentBet;
    const actualAmount = Math.min(toCall, player.chips);
    player.chips -= actualAmount;
    player.currentBet += actualAmount;
    player.totalBetThisRound += actualAmount;
    this.state.pot += actualAmount;
    if (player.chips === 0) {
      player.allIn = true;
    }
  }

  private doRaise(player: PlayerState, raiseAmount: number): void {
    const toCall = this.state.currentBet - player.currentBet;
    const totalNeeded = toCall + raiseAmount;
    const actualAmount = Math.min(totalNeeded, player.chips);

    player.chips -= actualAmount;
    player.currentBet += actualAmount;
    player.totalBetThisRound += actualAmount;
    this.state.pot += actualAmount;

    if (player.currentBet > this.state.currentBet) {
      this.state.lastRaiseAmount = player.currentBet - this.state.currentBet;
      this.state.currentBet = player.currentBet;
    }

    if (player.chips === 0) {
      player.allIn = true;
    }
  }

  private doAllIn(player: PlayerState): void {
    const allInAmount = player.chips;
    player.currentBet += allInAmount;
    player.totalBetThisRound += allInAmount;
    this.state.pot += allInAmount;
    player.chips = 0;
    player.allIn = true;

    if (player.currentBet > this.state.currentBet) {
      this.state.lastRaiseAmount = player.currentBet - this.state.currentBet;
      this.state.currentBet = player.currentBet;
    }
  }

  private advanceToNextPlayer(): void {
    const activePlayers = this.state.players.filter(p => !p.folded && !p.allIn);

    // Check if betting is complete
    if (this.isBettingComplete()) {
      this.advancePhase();
      return;
    }

    // Find next active player
    let nextIndex = (this.state.currentPlayerIndex + 1) % this.state.players.length;
    let attempts = 0;
    while (attempts < this.state.players.length) {
      const nextPlayer = this.state.players[nextIndex];
      if (!nextPlayer.folded && !nextPlayer.allIn) {
        break;
      }
      nextIndex = (nextIndex + 1) % this.state.players.length;
      attempts++;
    }

    this.state.currentPlayerIndex = nextIndex;
  }

  private isBettingComplete(): boolean {
    const activePlayers = this.state.players.filter(p => !p.folded && !p.allIn);

    // If only one player left (others folded or all-in), betting is complete
    if (activePlayers.length <= 1) return true;

    // All active players must have matched the current bet and acted at least once
    const allMatched = activePlayers.every(p => p.currentBet === this.state.currentBet);

    // Need at least 2 actions per player (in heads-up preflop BB gets option)
    const minActions = this.state.phase === "preflop" ? 2 : 2;

    return allMatched && this.state.actionsThisRound >= minActions;
  }

  private advancePhase(): void {
    // Reset betting for new round
    for (const player of this.state.players) {
      player.currentBet = 0;
    }
    this.state.currentBet = 0;
    this.state.lastRaiseAmount = this.config.bigBlind;
    this.state.actionsThisRound = 0;

    // Post-flop: non-dealer acts first (in heads-up, that's BB)
    const nonDealerIndex = (this.state.dealerIndex + 1) % 2;
    this.state.currentPlayerIndex = nonDealerIndex;

    // Find first active player
    let idx = this.state.currentPlayerIndex;
    for (let i = 0; i < this.state.players.length; i++) {
      const player = this.state.players[idx];
      if (!player.folded && !player.allIn) break;
      idx = (idx + 1) % this.state.players.length;
    }
    this.state.currentPlayerIndex = idx;

    switch (this.state.phase) {
      case "preflop":
        this.state.phase = "flop";
        // Deal flop (3 cards)
        this.state.communityCards.push(this.deck.pop()!);
        this.state.communityCards.push(this.deck.pop()!);
        this.state.communityCards.push(this.deck.pop()!);
        break;

      case "flop":
        this.state.phase = "turn";
        // Deal turn (1 card)
        this.state.communityCards.push(this.deck.pop()!);
        break;

      case "turn":
        this.state.phase = "river";
        // Deal river (1 card)
        this.state.communityCards.push(this.deck.pop()!);
        break;

      case "river":
        this.state.phase = "showdown";
        this.resolveShowdown();
        break;
    }

    // Check if we should skip to showdown (all but one player all-in or folded)
    const canAct = this.state.players.filter(p => !p.folded && !p.allIn);
    if (canAct.length <= 1 && this.state.phase !== "showdown" && this.state.phase !== "complete") {
      // Run out remaining cards
      while (this.state.communityCards.length < 5) {
        this.state.communityCards.push(this.deck.pop()!);
      }
      this.state.phase = "showdown";
      this.resolveShowdown();
    }
  }

  private resolveShowdown(): void {
    const activePlayers = this.state.players.filter(p => !p.folded);

    if (activePlayers.length === 1) {
      this.endHand(activePlayers[0].name, "last player");
      return;
    }

    // Evaluate hands
    let bestPlayer: PlayerState | null = null;
    let bestHand: ReturnType<typeof evaluateHand> | null = null;

    for (const player of activePlayers) {
      const allCards = [...player.holeCards, ...this.state.communityCards];
      const hand = evaluateHand(allCards);

      if (!bestHand || compareHands(hand, bestHand) > 0) {
        bestHand = hand;
        bestPlayer = player;
      }
    }

    if (bestPlayer && bestHand) {
      this.endHand(bestPlayer.name, bestHand.name);
    }
  }

  private endHand(winnerName: string, reason: string): void {
    this.state.winner = winnerName;
    this.state.winningHand = reason;
    this.state.phase = "complete";

    // Award pot to winner
    const winner = this.state.players.find(p => p.name === winnerName);
    if (winner) {
      winner.chips += this.state.pot;
    }
  }

  /**
   * Get observation for a specific player
   * Returns normalized values for RL
   */
  getObservation(playerName: string): number[] {
    const player = this.getPlayer(playerName);
    const opponent = this.state.players.find(p => p.name !== playerName);

    if (!player || !opponent) {
      return new Array(20).fill(0);
    }

    // Encode hole cards (4 values: rank and suit for each card)
    const holeCard1 = player.holeCards[0];
    const holeCard2 = player.holeCards[1];

    const card1Rank = holeCard1 ? this.normalizeRank(holeCard1.rank) : 0;
    const card1Suit = holeCard1 ? this.normalizeSuit(holeCard1.suit) : 0;
    const card2Rank = holeCard2 ? this.normalizeRank(holeCard2.rank) : 0;
    const card2Suit = holeCard2 ? this.normalizeSuit(holeCard2.suit) : 0;

    // Encode community cards (10 values: rank and suit for 5 cards)
    const commCards: number[] = [];
    for (let i = 0; i < 5; i++) {
      const card = this.state.communityCards[i];
      commCards.push(card ? this.normalizeRank(card.rank) : 0);
      commCards.push(card ? this.normalizeSuit(card.suit) : 0);
    }

    // Game state values
    const potNorm = Math.min(this.state.pot / (this.config.startingChips * 2), 1);
    const myChipsNorm = player.chips / this.config.startingChips;
    const oppChipsNorm = opponent.chips / this.config.startingChips;
    const toCallNorm = Math.min((this.state.currentBet - player.currentBet) / this.config.startingChips, 1);
    const phaseNorm = this.normalizePhase(this.state.phase);
    const positionNorm = player.isDealer ? 1 : 0;

    return [
      card1Rank, card1Suit, card2Rank, card2Suit,
      ...commCards,
      potNorm, myChipsNorm, oppChipsNorm, toCallNorm, phaseNorm, positionNorm
    ];
  }

  private normalizeRank(rank: string): number {
    const ranks = ["2", "3", "4", "5", "6", "7", "8", "9", "10", "J", "Q", "K", "A"];
    return (ranks.indexOf(rank) + 1) / 13;
  }

  private normalizeSuit(suit: string): number {
    const suits = ["hearts", "diamonds", "clubs", "spades"];
    return (suits.indexOf(suit) + 1) / 4;
  }

  private normalizePhase(phase: PokerPhase): number {
    const phases: PokerPhase[] = ["preflop", "flop", "turn", "river", "showdown", "complete"];
    return phases.indexOf(phase) / 5;
  }

  /**
   * Render the current game state to console
   */
  render(): void {
    console.log("\n=== Texas Hold'em ===");
    console.log(`Phase: ${this.state.phase.toUpperCase()}`);
    console.log(`Pot: ${this.state.pot}`);

    if (this.state.communityCards.length > 0) {
      console.log(`Community: ${formatCards(this.state.communityCards)}`);
    }

    console.log("");
    for (const player of this.state.players) {
      const isActive = this.state.currentPlayerIndex === this.state.players.indexOf(player);
      const marker = isActive ? " <--" : "";
      const position = player.isDealer ? "(D)" : "(BB)";
      const status = player.folded ? " [FOLD]" : player.allIn ? " [ALL-IN]" : "";

      console.log(`${player.name} ${position}: ${formatCards(player.holeCards)}${status}${marker}`);
      console.log(`  Chips: ${player.chips} | Bet: ${player.currentBet}`);
    }

    if (this.state.winner) {
      console.log(`\nWinner: ${this.state.winner} (${this.state.winningHand})`);
    }

    console.log("=====================\n");
  }
}
