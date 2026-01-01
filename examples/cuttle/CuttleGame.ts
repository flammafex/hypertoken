/**
 * Cuttle - Combat Card Game
 *
 * A card game played with a standard 52-card deck (or 54 for 3+ players).
 * Players race to accumulate 21+ points in point cards while disrupting
 * opponents using one-off effects, permanents, and scuttling.
 *
 * Card abilities:
 * - A-10: Can be played as point cards (worth their rank, A=1)
 * - A: One-off - Move all point cards to scrap
 * - 2: One-off - Destroy a permanent OR counter a one-off
 * - 3: One-off - Retrieve a card from scrap pile
 * - 4: One-off - Opponent discards 2 cards (target one opponent in 3+ players)
 * - 5: One-off - Draw 2 cards (or discard 1 draw 3 in standard)
 * - 6: One-off - Move all permanents to scrap
 * - 7: One-off - Draw and immediately play a card
 * - 8: Permanent - Opponent's hand is revealed ("glasses")
 *      (In Cutthroat: reveals ALL opponents' hands)
 * - 9: One-off - Return a card to its controller's hand
 *      (In Cutthroat: target also skips their next turn)
 * - 10: Point card only (no special effect)
 * - J: Permanent - Take control of target point card
 * - Q: Permanent - Protect your other cards from targeting
 * - K: Permanent - Reduce point goal (21 -> 14 -> 10 -> 7 -> 5)
 * - Joker (Cutthroat only): Permanent - Steal a royal (8, Q, K, J)
 *
 * Variants:
 * - classic: Original 2-player rules
 * - standard: cuttle.cards 2-player rules (5 draws 3, 9 freezes, 4K wins)
 * - cutthroat: 3-player free-for-all with Jokers
 * - team: 2v2 team play (0&2 vs 1&3), Jokers steal Royals, Jacks transfer to any player
 *
 * Win: First to reach point goal wins. Draw if 3 consecutive passes.
 */

// ============================================================================
// Types
// ============================================================================

export const SUITS = ["clubs", "diamonds", "hearts", "spades"] as const;
export type Suit = (typeof SUITS)[number];

export const RANKS = ["A", "2", "3", "4", "5", "6", "7", "8", "9", "10", "J", "Q", "K"] as const;
export type Rank = (typeof RANKS)[number];

export interface Card {
  rank: Rank;
  suit: Suit;
  id: number; // Unique identifier for the card
  isJoker?: boolean; // True for Joker cards (Cutthroat mode)
}

export interface PointCard {
  card: Card;
  attachedJacks: Card[]; // Jacks attached to this point card
  controller: number; // Current controller (may differ from original player)
}

export interface Permanent {
  card: Card;
  type: "eight" | "queen" | "king" | "joker";
  stolenFromPlayer?: number; // For Jokers: which player the royal was stolen from
}

export interface PlayerState {
  hand: Card[];
  pointCards: PointCard[]; // Point cards this player originally played
  permanents: Permanent[]; // 8s, Qs, Ks on this player's side
}

export type GamePhase =
  | "play" // Current player takes an action
  | "counter" // Opponent can counter with a 2
  | "resolve_three" // Choose a card from scrap for 3
  | "resolve_four" // Opponent choosing cards to discard
  | "resolve_five_discard" // Discard a card before drawing (standard)
  | "resolve_seven" // Must play the drawn card (classic)
  | "resolve_seven_choose" // Choose one of two revealed cards (standard)
  | "resolve_nine" // Choose target for 9
  | "royal_response" // Team variant: opponents can respond to Royal with Nine
  | "complete";

export interface PendingOneOff {
  card: Card;
  player: number;
  target?: { cardId: number; type: "permanent" | "pointCard" };
  targetPlayer?: number; // Target player for 4 one-off in 3+ player games
  counterChain: Card[]; // Stack of 2s trying to counter
}

// Team variant: tracks a Royal being played that can be responded to with Nine
export interface PendingRoyal {
  card: Card;
  player: number;
  type: "eight" | "queen" | "king";
  respondersRemaining: number[]; // Players who can still respond (opponents with Nines)
}

export interface CuttleGameState {
  players: PlayerState[];
  deck: Card[];
  scrap: Card[];
  currentPlayer: number;
  phase: GamePhase;
  pendingOneOff: PendingOneOff | null;
  pendingRoyal: PendingRoyal | null; // Team variant: Royal waiting for Nine response
  sevenDrawnCard: Card | null; // Card drawn by 7 that must be played (classic)
  sevenRevealedCards: Card[] | null; // Two cards revealed by 7 (standard)
  fiveDiscardPending: boolean; // Whether player needs to discard for 5 (standard)
  frozenCardIds: number[]; // Cards that can't be played this turn (standard 9)
  discardCount: number; // Cards opponent still needs to discard for 4
  discardingPlayer: number | null; // Which player is discarding for 4 (3+ players)
  skipTurnPlayers: number[]; // Players who skip their next turn (Cutthroat 9)
  consecutivePasses: number;
  winner: number | null;
  isDraw: boolean;
  lastAction: string | null;
  turnNumber: number;
}

export type CuttleVariant = "classic" | "standard" | "cutthroat" | "team";

export interface CuttleConfig {
  seed?: number | null;
  handLimit?: number;
  variant?: CuttleVariant;
}

// ============================================================================
// Constants
// ============================================================================

const HAND_LIMIT_2PLAYER = 8;
const HAND_LIMIT_CUTTHROAT = 7;
const HAND_LIMIT_TEAM = 7;
const BASE_GOAL = 21;
const BASE_GOAL_CUTTHROAT = 14;
const BASE_GOAL_TEAM = 21;
const KING_GOALS_CLASSIC = [14, 10, 7, 5]; // 1K, 2K, 3K, 4K
const KING_GOALS_STANDARD = [14, 10, 5, 0]; // 1K, 2K, 3K, 4K (4K = instant win)
const KING_GOALS_CUTTHROAT = [9, 5, 0]; // 1K, 2K, 3K (3K = instant win)
const KING_GOALS_TEAM = [14, 10, 5, 0]; // 1K, 2K, 3K, 4K (4K = instant win) - same as standard

// ============================================================================
// Utility Functions
// ============================================================================

function getRankValue(rank: Rank): number {
  if (rank === "A") return 1;
  if (rank === "J") return 11;
  if (rank === "Q") return 12;
  if (rank === "K") return 13;
  return parseInt(rank);
}

function getPointValue(rank: Rank): number {
  const value = getRankValue(rank);
  return value <= 10 ? value : 0;
}

function getSuitValue(suit: Suit): number {
  return SUITS.indexOf(suit);
}

function canScuttle(attacker: Card, target: Card): boolean {
  const attackerValue = getRankValue(attacker.rank);
  const targetValue = getRankValue(target.rank);

  if (attackerValue > targetValue) return true;
  if (attackerValue === targetValue) {
    return getSuitValue(attacker.suit) > getSuitValue(target.suit);
  }
  return false;
}

function isPointRank(rank: Rank): boolean {
  const value = getRankValue(rank);
  return value >= 1 && value <= 10;
}

function cardToString(card: Card): string {
  return `${card.rank}${card.suit[0].toUpperCase()}`;
}

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

  shuffle<T>(array: T[]): T[] {
    const result = [...array];
    for (let i = result.length - 1; i > 0; i--) {
      const j = Math.floor(this.next() * (i + 1));
      [result[i], result[j]] = [result[j], result[i]];
    }
    return result;
  }
}

// ============================================================================
// CuttleGame Class
// ============================================================================

export class CuttleGame {
  private config: Required<CuttleConfig>;
  private rng: SeededRandom;
  private state: CuttleGameState;

  constructor(config: CuttleConfig = {}) {
    const variant = config.variant ?? "classic";
    const defaultHandLimit =
      variant === "cutthroat" ? HAND_LIMIT_CUTTHROAT :
      variant === "team" ? HAND_LIMIT_TEAM :
      HAND_LIMIT_2PLAYER;

    this.config = {
      seed: config.seed ?? null,
      handLimit: config.handLimit ?? defaultHandLimit,
      variant,
    };

    this.rng = new SeededRandom(this.config.seed ?? undefined);
    this.state = this.createInitialState();
  }

  get variant(): CuttleVariant {
    return this.config.variant;
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

  private createInitialState(): CuttleGameState {
    // Create and shuffle deck
    const deck: Card[] = [];
    let id = 0;
    for (const suit of SUITS) {
      for (const rank of RANKS) {
        deck.push({ rank, suit, id: id++ });
      }
    }

    // Add Jokers for Cutthroat and Team variants (54-card deck)
    if (this.config.variant === "cutthroat" || this.config.variant === "team") {
      // Use hearts suit for Jokers (arbitrary, they work on any royal)
      deck.push({ rank: "A", suit: "hearts", id: id++, isJoker: true });
      deck.push({ rank: "A", suit: "spades", id: id++, isJoker: true });
    }

    const shuffledDeck = this.rng.shuffle(deck);

    // Setup players based on variant
    const numPlayers =
      this.config.variant === "cutthroat" ? 3 :
      this.config.variant === "team" ? 4 :
      2;
    const players: PlayerState[] = [];
    for (let i = 0; i < numPlayers; i++) {
      players.push({ hand: [], pointCards: [], permanents: [] });
    }

    if (this.config.variant === "team") {
      // Team: 4 players, each gets 5 cards
      // Player 0 is dealer, Player 1 goes first (left of dealer), clockwise
      // Teams: Players 0 & 2 vs Players 1 & 3 (sitting across from each other)
      for (let i = 0; i < 5; i++) {
        for (let p = 0; p < 4; p++) {
          players[p].hand.push(shuffledDeck.pop()!);
        }
      }
    } else if (this.config.variant === "cutthroat") {
      // Cutthroat: Each player gets 5 cards, player left of dealer goes first
      // Player 0 is dealer, Player 1 goes first
      for (let i = 0; i < 5; i++) {
        for (let p = 0; p < 3; p++) {
          players[p].hand.push(shuffledDeck.pop()!);
        }
      }
    } else {
      // 2-player: dealer (player 0) gets 6, opponent (player 1) gets 5
      // Deal 5 to player 1 (opponent, goes first)
      for (let i = 0; i < 5; i++) {
        players[1].hand.push(shuffledDeck.pop()!);
      }
      // Deal 6 to player 0 (dealer)
      for (let i = 0; i < 6; i++) {
        players[0].hand.push(shuffledDeck.pop()!);
      }
    }

    return {
      players,
      deck: shuffledDeck,
      scrap: [],
      currentPlayer: 1, // Non-dealer goes first (Player left of dealer in Cutthroat)
      phase: "play",
      pendingOneOff: null,
      pendingRoyal: null,
      sevenDrawnCard: null,
      sevenRevealedCards: null,
      fiveDiscardPending: false,
      frozenCardIds: [],
      discardCount: 0,
      discardingPlayer: null,
      skipTurnPlayers: [],
      consecutivePasses: 0,
      winner: null,
      isDraw: false,
      lastAction: null,
      turnNumber: 0,
    };
  }

  getState(): CuttleGameState {
    return JSON.parse(JSON.stringify(this.state));
  }

  /**
   * Get the point goal for a player (affected by Kings)
   */
  getPointGoal(playerIndex: number): number {
    const kingCount = this.state.players[playerIndex].permanents.filter(
      (p) => p.type === "king"
    ).length;
    const baseGoal =
      this.config.variant === "cutthroat" ? BASE_GOAL_CUTTHROAT :
      this.config.variant === "team" ? BASE_GOAL_TEAM :
      BASE_GOAL;
    if (kingCount === 0) return baseGoal;

    let kingGoals: number[];
    if (this.config.variant === "cutthroat") {
      kingGoals = KING_GOALS_CUTTHROAT;
    } else if (this.config.variant === "standard" || this.config.variant === "team") {
      kingGoals = KING_GOALS_TEAM;
    } else {
      kingGoals = KING_GOALS_CLASSIC;
    }
    return kingGoals[Math.min(kingCount - 1, kingGoals.length - 1)];
  }

  /**
   * Get total points for a player
   */
  getPoints(playerIndex: number): number {
    let points = 0;

    // Count all point cards this player controls
    for (const player of this.state.players) {
      for (const pc of player.pointCards) {
        if (pc.controller === playerIndex) {
          points += getPointValue(pc.card.rank);
        }
      }
    }

    return points;
  }

  /**
   * Check if a player's cards are protected by a Queen
   */
  private isProtected(playerIndex: number, cardId: number): boolean {
    const player = this.state.players[playerIndex];
    const queens = player.permanents.filter((p) => p.type === "queen");

    if (queens.length === 0) return false;

    // Queens protect everything except themselves (but 2+ queens protect each other)
    const isQueen = queens.some((q) => q.card.id === cardId);
    if (isQueen && queens.length === 1) return false;

    return true;
  }

  /**
   * Get observation for a player
   */
  getObservation(playerIndex: number) {
    const player = this.state.players[playerIndex];
    const numPlayers = this.state.players.length;

    // Check if we have glasses 8 - we see opponents' hands
    // In Cutthroat: 8 reveals ALL opponents' hands
    const weHaveGlasses = player.permanents.some((p) => p.type === "eight");

    // Build opponent info for each opponent
    const opponents: Array<{
      playerIndex: number;
      handSize: number;
      hand: Card[] | null;
      pointCards: PointCard[];
      permanents: Permanent[];
      points: number;
      goal: number;
    }> = [];

    for (let i = 0; i < numPlayers; i++) {
      if (i === playerIndex) continue;
      const opp = this.state.players[i];
      opponents.push({
        playerIndex: i,
        handSize: opp.hand.length,
        hand: weHaveGlasses ? opp.hand : null,
        pointCards: opp.pointCards,
        permanents: opp.permanents,
        points: this.getPoints(i),
        goal: this.getPointGoal(i),
      });
    }

    // For backwards compatibility with 2-player, also include direct opponent fields
    const mainOpponentIndex = numPlayers === 2 ? 1 - playerIndex : (playerIndex + 1) % numPlayers;
    const mainOpponent = this.state.players[mainOpponentIndex];

    return {
      myHand: player.hand,
      myPointCards: player.pointCards,
      myPermanents: player.permanents,
      myPoints: this.getPoints(playerIndex),
      myGoal: this.getPointGoal(playerIndex),

      // Array of all opponents (for 3+ player games)
      opponents,

      // Legacy 2-player fields (main opponent for backwards compatibility)
      opponentHandSize: mainOpponent.hand.length,
      opponentHand: weHaveGlasses ? mainOpponent.hand : null,
      opponentPointCards: mainOpponent.pointCards,
      opponentPermanents: mainOpponent.permanents,
      opponentPoints: this.getPoints(mainOpponentIndex),
      opponentGoal: this.getPointGoal(mainOpponentIndex),

      deckSize: this.state.deck.length,
      scrap: this.state.scrap,
      currentPlayer: this.state.currentPlayer,
      phase: this.state.phase,
      pendingOneOff: this.state.pendingOneOff,
      pendingRoyal: this.state.pendingRoyal,
      sevenDrawnCard:
        this.state.phase === "resolve_seven" && this.state.currentPlayer === playerIndex
          ? this.state.sevenDrawnCard
          : null,
      sevenRevealedCards:
        this.state.phase === "resolve_seven_choose" && this.state.currentPlayer === playerIndex
          ? this.state.sevenRevealedCards
          : null,
      fiveDiscardPending: this.state.fiveDiscardPending,
      frozenCardIds: this.state.frozenCardIds,
      discardCount: this.state.discardCount,
      discardingPlayer: this.state.discardingPlayer,
      skipTurnPlayers: this.state.skipTurnPlayers,
      consecutivePasses: this.state.consecutivePasses,
      winner: this.state.winner,
      isDraw: this.state.isDraw,
      lastAction: this.state.lastAction,
      variant: this.config.variant,
      numPlayers,

      // Team variant fields
      myTeam: this.config.variant === "team" ? this.getTeam(playerIndex) : null,
      teammateIndex: this.config.variant === "team" ? this.getTeammate(playerIndex) : null,
      winningTeam: this.config.variant === "team" && this.state.winner !== null
        ? this.getTeam(this.state.winner)
        : null,
    };
  }

  get numPlayers(): number {
    return this.config.variant === "cutthroat" ? 3 :
           this.config.variant === "team" ? 4 :
           2;
  }

  /**
   * Get the teammate's player index (Team variant only)
   * Teams: 0 & 2 vs 1 & 3 (players sitting across from each other)
   */
  getTeammate(playerIndex: number): number {
    return (playerIndex + 2) % 4;
  }

  /**
   * Get the team number for a player (0 or 1)
   * Team 0: Players 0 & 2
   * Team 1: Players 1 & 3
   */
  getTeam(playerIndex: number): number {
    return playerIndex % 2;
  }

  /**
   * Check if a card is frozen (can't be played this turn) - standard/cutthroat only
   */
  private isCardFrozen(cardId: number): boolean {
    if (this.config.variant === "classic") return false;
    return this.state.frozenCardIds.includes(cardId);
  }

  /**
   * Get adjacent players for a given player
   * In Cutthroat (3-player): all other players are adjacent
   * In Team (4-player): all other players are adjacent (Jacks can target anyone)
   */
  private getAdjacentPlayers(playerIndex: number): number[] {
    const numPlayers = this.state.players.length;
    if (numPlayers === 2) return [1 - playerIndex];
    // For 3+ players, all other players are considered adjacent
    return Array.from({ length: numPlayers }, (_, i) => i).filter((i) => i !== playerIndex);
  }

  /**
   * Get opponent players (not on the same team) for Team variant
   */
  private getOpponents(playerIndex: number): number[] {
    const numPlayers = this.state.players.length;
    if (this.config.variant !== "team") {
      return Array.from({ length: numPlayers }, (_, i) => i).filter((i) => i !== playerIndex);
    }
    // Team variant: opponents are players on the other team
    const myTeam = this.getTeam(playerIndex);
    return Array.from({ length: numPlayers }, (_, i) => i).filter(
      (i) => this.getTeam(i) !== myTeam
    );
  }

  /**
   * Check if a card is a Joker
   */
  private isJoker(card: Card): boolean {
    return card.isJoker === true;
  }

  /**
   * Get all targetable royals for Joker (8, Q, K, or attached Jacks from opponents)
   */
  private getJokerTargets(playerIndex: number): Array<{ card: Card; owner: number; type: "permanent" | "jack" }> {
    const targets: Array<{ card: Card; owner: number; type: "permanent" | "jack" }> = [];

    for (let i = 0; i < this.state.players.length; i++) {
      if (i === playerIndex) continue; // Can't steal from self

      const player = this.state.players[i];

      // Target Q, K permanents (royals only - 8 is not a royal)
      for (const perm of player.permanents) {
        if (perm.type === "queen" || perm.type === "king") {
          if (!this.isProtected(i, perm.card.id)) {
            targets.push({ card: perm.card, owner: i, type: "permanent" });
          }
        }
      }

    }

    // Target attached Jacks from ALL players' pointCards
    // (Jacks that stole from you are attached to cards in your pointCards array)
    for (const player of this.state.players) {
      for (const pc of player.pointCards) {
        for (const jack of pc.attachedJacks) {
          const jackController = this.getJackController(pc, jack);
          if (jackController !== playerIndex && !this.isProtected(jackController, jack.id)) {
            targets.push({ card: jack, owner: jackController, type: "jack" });
          }
        }
      }
    }

    return targets;
  }

  /**
   * Get all point cards that can be targeted (not protected by queen)
   */
  private getTargetablePointCards(targetPlayer: number): PointCard[] {
    const result: PointCard[] = [];
    for (const player of this.state.players) {
      for (const pc of player.pointCards) {
        if (pc.controller === targetPlayer) {
          if (!this.isProtected(targetPlayer, pc.card.id)) {
            result.push(pc);
          }
        }
      }
    }
    return result;
  }

  /**
   * Get all permanents that can be targeted (not protected by queen)
   */
  private getTargetablePermanents(targetPlayer: number): Permanent[] {
    return this.state.players[targetPlayer].permanents.filter(
      (p) => !this.isProtected(targetPlayer, p.card.id)
    );
  }

  /**
   * Get valid actions for a player in current state
   */
  getValidActions(playerIndex: number): string[] {
    const actions: string[] = [];
    const player = this.state.players[playerIndex];
    const numPlayers = this.state.players.length;

    if (this.state.winner !== null || this.state.isDraw) {
      return [];
    }

    switch (this.state.phase) {
      case "play":
        if (playerIndex !== this.state.currentPlayer) return [];

        // Draw (if deck not empty and under hand limit)
        if (this.state.deck.length > 0 && player.hand.length < this.config.handLimit) {
          actions.push("draw");
        }

        // Pass (only if deck is empty)
        if (this.state.deck.length === 0) {
          actions.push("pass");
        }

        // Play cards from hand (excluding frozen cards)
        for (const card of player.hand) {
          // Skip frozen cards
          if (this.isCardFrozen(card.id)) continue;

          // Handle Joker cards (Cutthroat and Team variants)
          if (this.isJoker(card)) {
            // Joker can steal royals (Q, K) or Jacks
            const jokerTargets = this.getJokerTargets(playerIndex);

            if (this.config.variant === "team") {
              // Team variant: can transfer Royal to ANY player
              // Format: joker:jokerId:targetId:destinationPlayerId
              for (const target of jokerTargets) {
                for (let destPlayer = 0; destPlayer < numPlayers; destPlayer++) {
                  // Can transfer to any player including self (unlike Cutthroat)
                  // But not to current owner (that would be pointless)
                  if (destPlayer !== target.owner) {
                    actions.push(`joker:${card.id}:${target.card.id}:${destPlayer}`);
                  }
                }
              }
            } else {
              // Cutthroat: steal to self
              for (const target of jokerTargets) {
                actions.push(`joker:${card.id}:${target.card.id}`);
              }
            }
            continue; // Jokers can only be used this way
          }

          // Point card (A-10)
          if (isPointRank(card.rank)) {
            actions.push(`point:${card.id}`);
          }

          // One-off effects
          switch (card.rank) {
            case "A":
              // Move all point cards to scrap - only useful if there are point cards
              if (this.getAllPointCardsInPlay().length > 0) {
                actions.push(`oneoff:${card.id}`);
              }
              break;
            case "2":
              // Target a permanent
              for (const p of this.state.players) {
                for (const perm of p.permanents) {
                  if (!this.isProtected(this.state.players.indexOf(p), perm.card.id)) {
                    actions.push(`oneoff:${card.id}:permanent:${perm.card.id}`);
                  }
                }
              }
              // Also target Jacks on point cards
              for (const p of this.state.players) {
                for (const pc of p.pointCards) {
                  for (const jack of pc.attachedJacks) {
                    const jackController = this.getJackController(pc, jack);
                    if (!this.isProtected(jackController, jack.id)) {
                      actions.push(`oneoff:${card.id}:permanent:${jack.id}`);
                    }
                  }
                }
              }
              break;
            case "3":
              // Retrieve from scrap (only if scrap not empty)
              if (this.state.scrap.length > 0) {
                actions.push(`oneoff:${card.id}`);
              }
              break;
            case "4":
              // Opponent discards 2 - in 3+ players, must target specific opponent
              if (numPlayers === 2) {
                const opponent = this.state.players[1 - playerIndex];
                if (opponent.hand.length > 0) {
                  actions.push(`oneoff:${card.id}`);
                }
              } else {
                // Target each opponent who has cards
                for (let i = 0; i < numPlayers; i++) {
                  if (i !== playerIndex && this.state.players[i].hand.length > 0) {
                    actions.push(`oneoff:${card.id}:target:${i}`);
                  }
                }
              }
              break;
            case "5":
              // Draw 2 (only if deck has cards)
              if (this.state.deck.length > 0) {
                actions.push(`oneoff:${card.id}`);
              }
              break;
            case "6":
              // Move all permanents to scrap
              if (this.getAllPermanentsInPlay().length > 0) {
                actions.push(`oneoff:${card.id}`);
              }
              break;
            case "7":
              // Draw and play (only if deck not empty)
              if (this.state.deck.length > 0) {
                actions.push(`oneoff:${card.id}`);
              }
              break;
            case "9":
              // Return a card to controller's hand
              // In cutthroat: target also skips their next turn
              // In standard variant: only targets permanents (8, Q, K, J)
              // In classic variant: can target any card on the board
              for (const p of this.state.players) {
                const pIdx = this.state.players.indexOf(p);
                for (const perm of p.permanents) {
                  if (!this.isProtected(pIdx, perm.card.id)) {
                    actions.push(`oneoff:${card.id}:card:${perm.card.id}`);
                  }
                }
                // Jacks (always targetable as they're permanents)
                for (const pc of p.pointCards) {
                  for (const jack of pc.attachedJacks) {
                    const jackController = this.getJackController(pc, jack);
                    if (!this.isProtected(jackController, jack.id)) {
                      actions.push(`oneoff:${card.id}:card:${jack.id}`);
                    }
                  }
                  // Point cards only targetable in classic variant (not standard or cutthroat)
                  if (this.config.variant === "classic") {
                    if (!this.isProtected(pc.controller, pc.card.id)) {
                      actions.push(`oneoff:${card.id}:card:${pc.card.id}`);
                    }
                  }
                }
              }
              break;
          }

          // Permanent effects
          switch (card.rank) {
            case "8":
              actions.push(`permanent:${card.id}`);
              break;
            case "J":
              // Target point cards - behavior varies by variant
              if (this.config.variant === "team") {
                // Team variant: Can target ANY player's point cards and transfer to ANY other player
                // Format: permanent:jackId:targetCardId:destinationPlayerId
                for (let targetPlayer = 0; targetPlayer < numPlayers; targetPlayer++) {
                  for (const pc of this.getTargetablePointCards(targetPlayer)) {
                    // Can transfer to any player OTHER than current controller
                    for (let destPlayer = 0; destPlayer < numPlayers; destPlayer++) {
                      if (destPlayer !== pc.controller) {
                        actions.push(`permanent:${card.id}:${pc.card.id}:${destPlayer}`);
                      }
                    }
                  }
                }
                // Also include own point cards controlled by others
                for (const pc of player.pointCards) {
                  if (pc.controller !== playerIndex && !this.isProtected(pc.controller, pc.card.id)) {
                    for (let destPlayer = 0; destPlayer < numPlayers; destPlayer++) {
                      if (destPlayer !== pc.controller) {
                        actions.push(`permanent:${card.id}:${pc.card.id}:${destPlayer}`);
                      }
                    }
                  }
                }
              } else if (this.config.variant === "cutthroat") {
                const adjacentPlayers = this.getAdjacentPlayers(playerIndex);
                for (const adjPlayer of adjacentPlayers) {
                  for (const pc of this.getTargetablePointCards(adjPlayer)) {
                    actions.push(`permanent:${card.id}:${pc.card.id}`);
                  }
                }
                // Can also target your own point cards controlled by adjacent opponent
                for (const pc of player.pointCards) {
                  if (pc.controller !== playerIndex && adjacentPlayers.includes(pc.controller)) {
                    if (!this.isProtected(pc.controller, pc.card.id)) {
                      actions.push(`permanent:${card.id}:${pc.card.id}`);
                    }
                  }
                }
              } else {
                // 2-player: target opponent's point cards
                for (const pc of this.getTargetablePointCards(1 - playerIndex)) {
                  actions.push(`permanent:${card.id}:${pc.card.id}`);
                }
                // Can also target your own point cards controlled by opponent
                for (const pc of player.pointCards) {
                  if (pc.controller !== playerIndex && !this.isProtected(pc.controller, pc.card.id)) {
                    actions.push(`permanent:${card.id}:${pc.card.id}`);
                  }
                }
              }
              break;
            case "Q":
            case "K":
              actions.push(`permanent:${card.id}`);
              break;
          }

          // Scuttle (point cards A-10 can scuttle opponents' lower point cards)
          if (isPointRank(card.rank)) {
            // Check all opponents' point cards
            for (let oppIdx = 0; oppIdx < numPlayers; oppIdx++) {
              if (oppIdx === playerIndex) continue;
              const oppPlayer = this.state.players[oppIdx];
              for (const pc of oppPlayer.pointCards) {
                if (pc.controller === oppIdx && canScuttle(card, pc.card)) {
                  actions.push(`scuttle:${card.id}:${pc.card.id}`);
                }
              }
            }
            // Also check point cards we played that any opponent controls
            for (const pc of player.pointCards) {
              if (pc.controller !== playerIndex && canScuttle(card, pc.card)) {
                actions.push(`scuttle:${card.id}:${pc.card.id}`);
              }
            }
          }
        }
        break;

      case "counter":
        if (!this.state.pendingOneOff) return [];

        // Determine who can counter based on chain length
        // Even chain length: target's turn to counter
        // Odd chain length: original player can counter the counter
        const oneOffPlayer = this.state.pendingOneOff.player;
        let counteringPlayer: number;

        if (this.state.pendingOneOff.counterChain.length % 2 === 0) {
          // Determine who should counter first based on one-off type
          if (this.state.pendingOneOff.targetPlayer !== undefined) {
            // Player-targeted one-off (4): targeted player counters
            counteringPlayer = this.state.pendingOneOff.targetPlayer;
          } else if (this.state.pendingOneOff.target) {
            // Card-targeted one-off (2, 9): find owner of targeted card
            counteringPlayer = this.findCardOwner(this.state.pendingOneOff.target.cardId);
            if (counteringPlayer === -1) {
              // Fallback to next player if card not found
              counteringPlayer = (oneOffPlayer + 1) % numPlayers;
            }
          } else {
            // Untargeted one-off (A, 3, 5, 6, 7): next player in rotation
            if (numPlayers === 2) {
              counteringPlayer = 1 - oneOffPlayer;
            } else {
              counteringPlayer = (oneOffPlayer + 1) % numPlayers;
            }
          }
        } else {
          // Odd chain: original player can counter the counter
          counteringPlayer = oneOffPlayer;
        }

        if (playerIndex !== counteringPlayer) return [];

        // Can counter with a 2
        for (const card of player.hand) {
          if (card.rank === "2") {
            actions.push(`counter:${card.id}`);
          }
        }
        // Can pass (allow the effect)
        actions.push("pass");
        break;

      case "resolve_three":
        if (playerIndex !== this.state.currentPlayer) return [];
        // Choose a card from scrap
        for (const card of this.state.scrap) {
          actions.push(`choose:${card.id}`);
        }
        break;

      case "resolve_four":
        // Opponent must discard - use discardingPlayer for 3+ player games
        const discardingPlayer = this.state.discardingPlayer ?? (1 - this.state.currentPlayer);
        if (playerIndex !== discardingPlayer) return [];
        for (const card of player.hand) {
          actions.push(`discard:${card.id}`);
        }
        break;

      case "resolve_five_discard":
        // Standard variant: must discard a card before drawing 3
        if (playerIndex !== this.state.currentPlayer) return [];
        for (const card of player.hand) {
          actions.push(`five_discard:${card.id}`);
        }
        break;

      case "resolve_seven":
        // Classic variant: must play the single drawn card
        if (playerIndex !== this.state.currentPlayer) return [];
        if (!this.state.sevenDrawnCard) return [];

        const drawnCard = this.state.sevenDrawnCard;
        const sevenActions = this.getSevenPlayActions(playerIndex, drawnCard);

        if (sevenActions.length === 0) {
          // Can't play - must scrap
          actions.push("scrap_seven");
        } else {
          actions.push(...sevenActions);
        }
        break;

      case "resolve_seven_choose":
        // Standard variant: choose one of two revealed cards
        if (playerIndex !== this.state.currentPlayer) return [];
        if (!this.state.sevenRevealedCards || this.state.sevenRevealedCards.length === 0) return [];

        for (const card of this.state.sevenRevealedCards) {
          const cardActions = this.getSevenPlayActions(playerIndex, card);
          if (cardActions.length > 0) {
            actions.push(...cardActions);
          }
        }
        // If no valid plays for either card, can scrap one
        if (actions.length === 0 && this.state.sevenRevealedCards.length > 0) {
          for (const card of this.state.sevenRevealedCards) {
            actions.push(`scrap_seven:${card.id}`);
          }
        }
        break;

      case "resolve_nine":
        // This should be handled during the one-off, not as a separate phase
        break;

      case "royal_response":
        // Team variant: opponents can respond to Royal with Nine
        if (!this.state.pendingRoyal) return [];

        // Only players in respondersRemaining can act
        if (!this.state.pendingRoyal.respondersRemaining.includes(playerIndex)) return [];

        // Can respond with a Nine (instant bounce, doesn't take turn)
        for (const card of player.hand) {
          if (card.rank === "9") {
            actions.push(`nine_response:${card.id}`);
          }
        }
        // Can always pass (decline to respond)
        actions.push("pass");
        break;
    }

    return actions;
  }

  /**
   * Get valid actions for playing the 7's drawn card
   */
  private getSevenPlayActions(playerIndex: number, card: Card): string[] {
    const actions: string[] = [];
    const opponent = this.state.players[1 - playerIndex];

    // Jokers can only steal royals
    if (this.isJoker(card)) {
      const jokerTargets = this.getJokerTargets(playerIndex);

      if (this.config.variant === "team") {
        // Team variant: can transfer to any player
        const numPlayers = this.state.players.length;
        for (const target of jokerTargets) {
          for (let destPlayer = 0; destPlayer < numPlayers; destPlayer++) {
            if (destPlayer !== target.owner) {
              actions.push(`seven_joker:${card.id}:${target.card.id}:${destPlayer}`);
            }
          }
        }
      } else {
        // Cutthroat: steal to self
        for (const target of jokerTargets) {
          actions.push(`seven_joker:${card.id}:${target.card.id}`);
        }
      }
      return actions; // Jokers can only be used this way
    }

    // Point card
    if (isPointRank(card.rank)) {
      actions.push(`seven_point:${card.id}`);
    }

    // One-off effects
    switch (card.rank) {
      case "A":
        if (this.getAllPointCardsInPlay().length > 0) {
          actions.push(`seven_oneoff:${card.id}`);
        }
        break;
      case "2":
        for (const p of this.state.players) {
          for (const perm of p.permanents) {
            if (!this.isProtected(this.state.players.indexOf(p), perm.card.id)) {
              actions.push(`seven_oneoff:${card.id}:permanent:${perm.card.id}`);
            }
          }
        }
        for (const p of this.state.players) {
          for (const pc of p.pointCards) {
            for (const jack of pc.attachedJacks) {
              const jackController = this.getJackController(pc, jack);
              if (!this.isProtected(jackController, jack.id)) {
                actions.push(`seven_oneoff:${card.id}:permanent:${jack.id}`);
              }
            }
          }
        }
        break;
      case "3":
        if (this.state.scrap.length > 0) {
          actions.push(`seven_oneoff:${card.id}`);
        }
        break;
      case "4":
        if (opponent.hand.length > 0) {
          actions.push(`seven_oneoff:${card.id}`);
        }
        break;
      case "5":
        if (this.state.deck.length > 0) {
          actions.push(`seven_oneoff:${card.id}`);
        }
        break;
      case "6":
        if (this.getAllPermanentsInPlay().length > 0) {
          actions.push(`seven_oneoff:${card.id}`);
        }
        break;
      case "7":
        if (this.state.deck.length > 0) {
          actions.push(`seven_oneoff:${card.id}`);
        }
        break;
      case "9":
        // In standard variant: only targets permanents
        // In classic variant: can target any card on the board
        for (const p of this.state.players) {
          const pIdx = this.state.players.indexOf(p);
          for (const perm of p.permanents) {
            if (!this.isProtected(pIdx, perm.card.id)) {
              actions.push(`seven_oneoff:${card.id}:card:${perm.card.id}`);
            }
          }
          for (const pc of p.pointCards) {
            // Jacks are always targetable as permanents
            for (const jack of pc.attachedJacks) {
              const jackController = this.getJackController(pc, jack);
              if (!this.isProtected(jackController, jack.id)) {
                actions.push(`seven_oneoff:${card.id}:card:${jack.id}`);
              }
            }
            // Point cards only targetable in classic variant
            if (this.config.variant !== "standard") {
              if (!this.isProtected(pc.controller, pc.card.id)) {
                actions.push(`seven_oneoff:${card.id}:card:${pc.card.id}`);
              }
            }
          }
        }
        break;
    }

    // Permanents
    switch (card.rank) {
      case "8":
      case "Q":
      case "K":
        actions.push(`seven_permanent:${card.id}`);
        break;
      case "J":
        // Must target a point card
        if (this.config.variant === "team") {
          // Team variant: can transfer to any player
          const numPlayers = this.state.players.length;
          for (const p of this.state.players) {
            for (const pc of p.pointCards) {
              if (!this.isProtected(pc.controller, pc.card.id)) {
                for (let destPlayer = 0; destPlayer < numPlayers; destPlayer++) {
                  if (destPlayer !== pc.controller) {
                    actions.push(`seven_permanent:${card.id}:${pc.card.id}:${destPlayer}`);
                  }
                }
              }
            }
          }
        } else {
          // Other variants: target any point card, control goes to player
          for (const p of this.state.players) {
            for (const pc of p.pointCards) {
              if (!this.isProtected(pc.controller, pc.card.id)) {
                actions.push(`seven_permanent:${card.id}:${pc.card.id}`);
              }
            }
          }
        }
        break;
    }

    // Scuttle
    if (isPointRank(card.rank)) {
      for (const p of this.state.players) {
        for (const pc of p.pointCards) {
          if (pc.controller !== playerIndex && canScuttle(card, pc.card)) {
            actions.push(`seven_scuttle:${card.id}:${pc.card.id}`);
          }
        }
      }
    }

    return actions;
  }

  private getAllPointCardsInPlay(): PointCard[] {
    const result: PointCard[] = [];
    for (const player of this.state.players) {
      result.push(...player.pointCards);
    }
    return result;
  }

  private getAllPermanentsInPlay(): Permanent[] {
    const result: Permanent[] = [];
    for (const player of this.state.players) {
      result.push(...player.permanents);
    }
    // Also include Jacks attached to point cards (they count as permanents for 6)
    for (const player of this.state.players) {
      for (const pc of player.pointCards) {
        for (const jack of pc.attachedJacks) {
          result.push({ card: jack, type: "joker" }); // Type doesn't matter, just need to count it
        }
      }
    }
    return result;
  }

  private getJackController(pointCard: PointCard, jack: Card): number {
    // Find which player originally played this jack
    const jackIndex = pointCard.attachedJacks.indexOf(jack);
    // Control alternates with each jack
    const originalOwner = this.findCardOriginalOwner(pointCard.card.id);
    return (originalOwner + jackIndex + 1) % 2;
  }

  private findCardOriginalOwner(cardId: number): number {
    for (let i = 0; i < this.state.players.length; i++) {
      if (this.state.players[i].pointCards.some((pc) => pc.card.id === cardId)) {
        return i;
      }
    }
    return 0;
  }

  /**
   * Execute an action
   */
  action(playerIndex: number, actionStr: string): { success: boolean; message: string } {
    const valid = this.getValidActions(playerIndex);
    if (!valid.includes(actionStr)) {
      return { success: false, message: `Invalid action: ${actionStr}` };
    }

    const parts = actionStr.split(":");
    const actionType = parts[0];
    let message = "";

    this.state.consecutivePasses = actionType === "pass" ? this.state.consecutivePasses + 1 : 0;

    switch (this.state.phase) {
      case "play":
        message = this.handlePlayPhase(playerIndex, actionType, parts);
        break;
      case "counter":
        message = this.handleCounterPhase(playerIndex, actionType, parts);
        break;
      case "resolve_three":
        message = this.handleResolveThree(playerIndex, parts);
        break;
      case "resolve_four":
        message = this.handleResolveFour(playerIndex, parts);
        break;
      case "resolve_five_discard":
        message = this.handleResolveFiveDiscard(playerIndex, parts);
        break;
      case "resolve_seven":
        message = this.handleResolveSeven(playerIndex, actionType, parts);
        break;
      case "resolve_seven_choose":
        message = this.handleResolveSevenChoose(playerIndex, actionType, parts);
        break;
      case "royal_response":
        message = this.handleRoyalResponse(playerIndex, actionType, parts);
        break;
    }

    this.state.lastAction = message;
    this.checkGameEnd();
    return { success: true, message };
  }

  private handlePlayPhase(player: number, action: string, parts: string[]): string {
    switch (action) {
      case "draw":
        const drawnCard = this.state.deck.pop()!;
        this.state.players[player].hand.push(drawnCard);
        this.advanceTurn();
        return `Player ${player} draws a card`;

      case "pass":
        if (this.state.consecutivePasses >= 3) {
          this.state.isDraw = true;
          this.state.phase = "complete";
          return "Game ends in a draw (3 consecutive passes)";
        }
        this.advanceTurn();
        return `Player ${player} passes`;

      case "point": {
        const cardId = parseInt(parts[1]);
        const card = this.removeCardFromHand(player, cardId)!;
        this.state.players[player].pointCards.push({
          card,
          attachedJacks: [],
          controller: player,
        });
        this.advanceTurn();
        return `Player ${player} plays ${cardToString(card)} for ${getPointValue(card.rank)} points`;
      }

      case "oneoff": {
        const cardId = parseInt(parts[1]);
        const card = this.removeCardFromHand(player, cardId)!;

        // Parse target for cards like 2 (permanent) or 9 (card)
        let target: { cardId: number; type: "permanent" | "pointCard" } | undefined;
        let targetPlayer: number | undefined;

        if (parts.length > 3 && parts[2] !== "target") {
          target = { cardId: parseInt(parts[3]), type: parts[2] as "permanent" | "pointCard" };
        }

        // Parse target player for 4 one-off in 3+ player games
        if (parts.length > 2 && parts[2] === "target") {
          targetPlayer = parseInt(parts[3]);
        }

        this.state.pendingOneOff = {
          card,
          player,
          target,
          targetPlayer,
          counterChain: [],
        };
        this.state.phase = "counter";
        return `Player ${player} plays ${cardToString(card)} as one-off`;
      }

      case "permanent": {
        const cardId = parseInt(parts[1]);
        const card = this.removeCardFromHand(player, cardId)!;

        if (card.rank === "J") {
          // Jack targets a point card
          const targetId = parseInt(parts[2]);
          const targetPc = this.findPointCard(targetId);
          if (targetPc) {
            targetPc.attachedJacks.push(card);
            // In team variant, destination player can be specified (parts[3])
            // Otherwise, control goes to the Jack player
            if (this.config.variant === "team" && parts.length > 3) {
              const destinationPlayer = parseInt(parts[3]);
              targetPc.controller = destinationPlayer;
              this.advanceTurn();
              return `Player ${player} plays ${cardToString(card)} to transfer point card to Player ${destinationPlayer}`;
            } else {
              targetPc.controller = player;
              this.advanceTurn();
              return `Player ${player} plays ${cardToString(card)} on point card`;
            }
          }
          this.advanceTurn();
          return `Player ${player} plays ${cardToString(card)} on point card`;
        } else {
          const type = card.rank === "8" ? "eight" : card.rank === "Q" ? "queen" : "king";

          // Team variant: check if opponents can respond with Nine
          if (this.config.variant === "team") {
            const opponents = this.getOpponents(player);
            const respondersWithNine = opponents.filter((oppIdx) =>
              this.state.players[oppIdx].hand.some((c) => c.rank === "9")
            );

            if (respondersWithNine.length > 0) {
              // Enter royal_response phase
              this.state.pendingRoyal = {
                card,
                player,
                type,
                respondersRemaining: respondersWithNine,
              };
              this.state.phase = "royal_response";
              return `Player ${player} plays ${cardToString(card)} as Royal - opponents may respond`;
            }
          }

          // No Nine response possible, resolve immediately
          this.state.players[player].permanents.push({ card, type });
          this.advanceTurn();
          return `Player ${player} plays ${cardToString(card)} as permanent`;
        }
      }

      case "scuttle": {
        const attackerId = parseInt(parts[1]);
        const targetId = parseInt(parts[2]);
        const attackerCard = this.removeCardFromHand(player, attackerId)!;
        const targetPc = this.findPointCard(targetId);

        if (targetPc) {
          // Remove point card and any attached jacks
          this.removePointCard(targetId);
          this.state.scrap.push(attackerCard, targetPc.card, ...targetPc.attachedJacks);
        }
        this.advanceTurn();
        return `Player ${player} scuttles with ${cardToString(attackerCard)}`;
      }

      case "joker": {
        // Joker steals a royal (Q, K) or Jack from an opponent
        // Team variant: can transfer to any player (parts[3])
        // Cutthroat: always steals to self
        const jokerId = parseInt(parts[1]);
        const targetCardId = parseInt(parts[2]);
        const destinationPlayer = this.config.variant === "team" && parts.length > 3
          ? parseInt(parts[3])
          : player;
        const jokerCard = this.removeCardFromHand(player, jokerId)!;

        // Find and transfer the target royal/jack
        for (let i = 0; i < this.state.players.length; i++) {
          // Check permanents (Q, K)
          const permIndex = this.state.players[i].permanents.findIndex(
            (p) => p.card.id === targetCardId
          );
          if (permIndex >= 0) {
            const stolenPerm = this.state.players[i].permanents.splice(permIndex, 1)[0];
            // Add to destination player's permanents
            this.state.players[destinationPlayer].permanents.push({
              card: stolenPerm.card,
              type: stolenPerm.type,
              stolenFromPlayer: i,
            });
            // Joker goes to scrap after use
            this.state.scrap.push(jokerCard);
            this.advanceTurn();
            if (destinationPlayer === player) {
              return `Player ${player} uses Joker to steal ${cardToString(stolenPerm.card)} from Player ${i}`;
            } else {
              return `Player ${player} uses Joker to transfer ${cardToString(stolenPerm.card)} from Player ${i} to Player ${destinationPlayer}`;
            }
          }

          // Check Jacks on point cards
          for (const pc of this.state.players[i].pointCards) {
            const jackIndex = pc.attachedJacks.findIndex((j) => j.id === targetCardId);
            if (jackIndex >= 0) {
              const stolenJack = pc.attachedJacks.splice(jackIndex, 1)[0];
              // Add the jack to destination player's hand (they can replay it)
              this.state.players[destinationPlayer].hand.push(stolenJack);
              // Update point card controller based on remaining jacks
              const originalOwner = this.findCardOriginalOwner(pc.card.id);
              pc.controller = pc.attachedJacks.length % 2 === 0
                ? originalOwner
                : (originalOwner + 1) % this.state.players.length;
              // Joker goes to scrap after use
              this.state.scrap.push(jokerCard);
              this.advanceTurn();
              if (destinationPlayer === player) {
                return `Player ${player} uses Joker to steal ${cardToString(stolenJack)} from Player ${i}`;
              } else {
                return `Player ${player} uses Joker to transfer ${cardToString(stolenJack)} from Player ${i} to Player ${destinationPlayer}`;
              }
            }
          }
        }
        this.advanceTurn();
        return `Player ${player} plays Joker (no valid target found)`;
      }

      default:
        return "Unknown action";
    }
  }

  private handleCounterPhase(player: number, action: string, parts: string[]): string {
    if (!this.state.pendingOneOff) return "No pending one-off";

    if (action === "pass") {
      // Effect resolves (or counter succeeds)
      if (this.state.pendingOneOff.counterChain.length % 2 === 0) {
        // Original effect resolves
        return this.resolveOneOff();
      } else {
        // Counter succeeds, original effect is cancelled
        this.state.scrap.push(
          this.state.pendingOneOff.card,
          ...this.state.pendingOneOff.counterChain
        );
        this.state.pendingOneOff = null;
        this.state.phase = "play";
        this.advanceTurn();
        return "One-off was countered";
      }
    }

    if (action === "counter") {
      const cardId = parseInt(parts[1]);
      const card = this.removeCardFromHand(player, cardId)!;
      this.state.pendingOneOff.counterChain.push(card);
      // Stay in counter phase, other player can counter the counter
      return `Player ${player} counters with ${cardToString(card)}`;
    }

    return "Unknown counter action";
  }

  private resolveOneOff(): string {
    const pending = this.state.pendingOneOff!;
    const player = pending.player;
    const card = pending.card;

    // Move all cards to scrap
    this.state.scrap.push(card, ...pending.counterChain);

    let message = "";

    switch (card.rank) {
      case "A":
        // Move all point cards to scrap
        for (const p of this.state.players) {
          for (const pc of p.pointCards) {
            this.state.scrap.push(pc.card, ...pc.attachedJacks);
          }
          p.pointCards = [];
        }
        message = "All point cards moved to scrap";
        this.state.phase = "play";
        this.advanceTurn();
        break;

      case "2":
        // Destroy target permanent
        if (pending.target) {
          this.removePermanent(pending.target.cardId);
        }
        message = "Permanent destroyed";
        this.state.phase = "play";
        this.advanceTurn();
        break;

      case "3":
        // Enter resolve_three phase to choose card from scrap
        this.state.phase = "resolve_three";
        message = "Choose a card from scrap";
        break;

      case "4": {
        // Opponent must discard 2 cards
        // In 3+ player games, use targetPlayer from pending one-off
        const targetOpponentIndex =
          pending.targetPlayer !== undefined ? pending.targetPlayer : 1 - player;
        const targetOpponent = this.state.players[targetOpponentIndex];
        this.state.discardCount = Math.min(2, targetOpponent.hand.length);
        this.state.discardingPlayer = targetOpponentIndex;
        if (this.state.discardCount > 0) {
          this.state.phase = "resolve_four";
          message = `Player ${targetOpponentIndex} must discard ${this.state.discardCount} cards`;
        } else {
          this.state.phase = "play";
          this.state.discardingPlayer = null;
          this.advanceTurn();
          message = `Player ${targetOpponentIndex} has no cards to discard`;
        }
        break;
      }

      case "5":
        if (this.config.variant !== "classic") {
          // Standard/Cutthroat: Discard 1, then draw 3 (skip discard if hand empty after playing 5)
          const playerHand = this.state.players[player].hand;
          if (playerHand.length === 0) {
            // No cards to discard, just draw 3
            const toDraw = Math.min(3, this.state.deck.length);
            for (let i = 0; i < toDraw; i++) {
              this.state.players[player].hand.push(this.state.deck.pop()!);
            }
            message = `Player ${player} draws ${toDraw} cards`;
            this.state.phase = "play";
            this.advanceTurn();
          } else {
            // Must discard first
            this.state.fiveDiscardPending = true;
            this.state.phase = "resolve_five_discard";
            message = `Player ${player} must discard a card, then draws 3`;
          }
        } else {
          // Classic: Draw 2 cards
          const toDraw = Math.min(2, this.state.deck.length);
          for (let i = 0; i < toDraw; i++) {
            this.state.players[player].hand.push(this.state.deck.pop()!);
          }
          message = `Player ${player} draws ${toDraw} cards`;
          this.state.phase = "play";
          this.advanceTurn();
        }
        break;

      case "6":
        // Move all permanents to scrap
        for (const p of this.state.players) {
          for (const perm of p.permanents) {
            this.state.scrap.push(perm.card);
          }
          p.permanents = [];
          // Also remove jacks from point cards
          for (const pc of p.pointCards) {
            this.state.scrap.push(...pc.attachedJacks);
            pc.attachedJacks = [];
            // Reset controller to original owner
            pc.controller = this.state.players.indexOf(p);
          }
        }
        message = "All permanents moved to scrap";
        this.state.phase = "play";
        this.advanceTurn();
        break;

      case "7":
        if (this.config.variant !== "classic") {
          // Standard/Cutthroat: Reveal top 2 cards, choose 1 to play, put other back
          if (this.state.deck.length >= 2) {
            const card1 = this.state.deck.pop()!;
            const card2 = this.state.deck.pop()!;
            this.state.sevenRevealedCards = [card1, card2];
            this.state.phase = "resolve_seven_choose";
            // Set currentPlayer to the player who played the 7 (they must choose)
            this.state.currentPlayer = player;
            message = `Player ${player} reveals ${cardToString(card1)} and ${cardToString(card2)} - choose one to play`;
          } else if (this.state.deck.length === 1) {
            // Only 1 card - must play it (like classic)
            const drawnCard = this.state.deck.pop()!;
            this.state.sevenDrawnCard = drawnCard;
            this.state.phase = "resolve_seven";
            // Set currentPlayer to the player who played the 7
            this.state.currentPlayer = player;
            message = `Player ${player} draws ${cardToString(drawnCard)} and must play it`;
          } else {
            this.state.phase = "play";
            this.advanceTurn();
            message = "Deck is empty";
          }
        } else {
          // Classic: Draw a card and must play it
          if (this.state.deck.length > 0) {
            const drawnCard = this.state.deck.pop()!;
            this.state.sevenDrawnCard = drawnCard;
            this.state.phase = "resolve_seven";
            // Set currentPlayer to the player who played the 7
            this.state.currentPlayer = player;
            message = `Player ${player} draws ${cardToString(drawnCard)} and must play it`;
          } else {
            this.state.phase = "play";
            this.advanceTurn();
            message = "Deck is empty";
          }
        }
        break;

      case "9": {
        // Return target card to controller's hand
        if (pending.target) {
          const targetCardId = pending.target.cardId;

          // Find the owner of the targeted card before returning it
          let targetOwner: number | null = null;
          for (let i = 0; i < this.state.players.length; i++) {
            const p = this.state.players[i];
            // Check permanents
            if (p.permanents.some((perm) => perm.card.id === targetCardId)) {
              targetOwner = i;
              break;
            }
            // Check jacks and point cards
            for (const pc of p.pointCards) {
              if (pc.card.id === targetCardId || pc.attachedJacks.some((j) => j.id === targetCardId)) {
                targetOwner = i;
                break;
              }
            }
            if (targetOwner !== null) break;
          }

          this.returnCardToHand(targetCardId);

          // Standard/cutthroat: card can't be played next turn
          if (this.config.variant !== "classic") {
            this.state.frozenCardIds.push(targetCardId);
          }

          // Cutthroat: target owner skips their next turn
          if (this.config.variant === "cutthroat" && targetOwner !== null && targetOwner !== player) {
            if (!this.state.skipTurnPlayers.includes(targetOwner)) {
              this.state.skipTurnPlayers.push(targetOwner);
            }
          }
        }

        if (this.config.variant === "cutthroat") {
          message = "Permanent returned to hand (frozen + owner skips next turn)";
        } else if (this.config.variant === "standard") {
          message = "Permanent returned to hand (frozen until next turn)";
        } else {
          message = "Card returned to hand";
        }
        this.state.phase = "play";
        this.advanceTurn();
        break;
      }
    }

    this.state.pendingOneOff = null;
    return message;
  }

  private handleResolveThree(player: number, parts: string[]): string {
    const cardId = parseInt(parts[1]);
    const cardIndex = this.state.scrap.findIndex((c) => c.id === cardId);
    if (cardIndex >= 0) {
      const card = this.state.scrap.splice(cardIndex, 1)[0];
      this.state.players[player].hand.push(card);
    }
    this.state.phase = "play";
    this.advanceTurn();
    return `Player ${player} retrieves card from scrap`;
  }

  private handleResolveFour(player: number, parts: string[]): string {
    const cardId = parseInt(parts[1]);
    const card = this.removeCardFromHand(player, cardId)!;
    this.state.scrap.push(card);
    this.state.discardCount--;

    if (this.state.discardCount === 0 || this.state.players[player].hand.length === 0) {
      this.state.phase = "play";
      this.state.discardingPlayer = null;
      this.advanceTurn();
      return `Player ${player} finishes discarding`;
    }
    return `Player ${player} discards ${cardToString(card)}`;
  }

  private handleResolveFiveDiscard(player: number, parts: string[]): string {
    // Standard variant: discard a card, then draw 3
    const cardId = parseInt(parts[1]);
    const card = this.removeCardFromHand(player, cardId)!;
    this.state.scrap.push(card);

    // Draw 3 cards (respecting hand limit in standard)
    let drawn = 0;
    const maxDraw = Math.min(3, this.state.deck.length);
    for (let i = 0; i < maxDraw; i++) {
      if (this.state.players[player].hand.length < this.config.handLimit) {
        this.state.players[player].hand.push(this.state.deck.pop()!);
        drawn++;
      }
    }

    this.state.fiveDiscardPending = false;
    this.state.phase = "play";
    this.advanceTurn();
    return `Player ${player} discards ${cardToString(card)}, draws ${drawn} cards`;
  }

  private handleResolveSeven(player: number, action: string, parts: string[]): string {
    const card = this.state.sevenDrawnCard!;
    this.state.sevenDrawnCard = null;

    if (action === "scrap_seven") {
      this.state.scrap.push(card);
      this.state.phase = "play";
      this.advanceTurn();
      return `Card scrapped (could not be played)`;
    }

    // Parse the action similar to normal play
    const playType = action.replace("seven_", "");

    switch (playType) {
      case "point":
        this.state.players[player].pointCards.push({
          card,
          attachedJacks: [],
          controller: player,
        });
        break;

      case "oneoff": {
        const target =
          parts.length > 3
            ? { cardId: parseInt(parts[3]), type: parts[2] as "permanent" | "pointCard" }
            : undefined;
        this.state.pendingOneOff = {
          card,
          player,
          target,
          counterChain: [],
        };
        this.state.phase = "counter";
        return `Player ${player} plays ${cardToString(card)} as one-off from 7`;
      }

      case "permanent": {
        if (card.rank === "J") {
          const targetId = parseInt(parts[2]);
          const targetPc = this.findPointCard(targetId);
          if (targetPc) {
            targetPc.attachedJacks.push(card);
            // Team variant: destination player can be specified (parts[3])
            if (this.config.variant === "team" && parts.length > 3) {
              targetPc.controller = parseInt(parts[3]);
            } else {
              targetPc.controller = player;
            }
          }
        } else {
          const type = card.rank === "8" ? "eight" : card.rank === "Q" ? "queen" : "king";
          this.state.players[player].permanents.push({ card, type });
        }
        break;
      }

      case "scuttle": {
        const targetId = parseInt(parts[2]);
        const targetPc = this.findPointCard(targetId);
        if (targetPc) {
          this.removePointCard(targetId);
          this.state.scrap.push(card, targetPc.card, ...targetPc.attachedJacks);
        }
        break;
      }

      case "joker": {
        // Joker steals a royal from an opponent
        // Team variant: can transfer to any player (parts[3])
        const targetCardId = parseInt(parts[2]);
        const destinationPlayer = this.config.variant === "team" && parts.length > 3
          ? parseInt(parts[3])
          : player;

        for (let i = 0; i < this.state.players.length; i++) {
          // Check permanents (Q, K)
          const permIndex = this.state.players[i].permanents.findIndex(
            (p) => p.card.id === targetCardId
          );
          if (permIndex >= 0) {
            const stolenPerm = this.state.players[i].permanents.splice(permIndex, 1)[0];
            this.state.players[destinationPlayer].permanents.push({
              card: stolenPerm.card,
              type: stolenPerm.type,
              stolenFromPlayer: i,
            });
            this.state.scrap.push(card); // Joker goes to scrap
            this.state.phase = "play";
            this.advanceTurn();
            if (destinationPlayer === player) {
              return `Player ${player} uses Joker from 7 to steal ${cardToString(stolenPerm.card)} from Player ${i}`;
            } else {
              return `Player ${player} uses Joker from 7 to transfer ${cardToString(stolenPerm.card)} from Player ${i} to Player ${destinationPlayer}`;
            }
          }
          // Check Jacks on point cards
          for (const pc of this.state.players[i].pointCards) {
            const jackIndex = pc.attachedJacks.findIndex((j) => j.id === targetCardId);
            if (jackIndex >= 0) {
              const stolenJack = pc.attachedJacks.splice(jackIndex, 1)[0];
              this.state.players[destinationPlayer].hand.push(stolenJack);
              const originalOwner = this.findCardOriginalOwner(pc.card.id);
              pc.controller = pc.attachedJacks.length % 2 === 0
                ? originalOwner
                : (originalOwner + 1) % this.state.players.length;
              this.state.scrap.push(card); // Joker goes to scrap
              this.state.phase = "play";
              this.advanceTurn();
              if (destinationPlayer === player) {
                return `Player ${player} uses Joker from 7 to steal ${cardToString(stolenJack)} from Player ${i}`;
              } else {
                return `Player ${player} uses Joker from 7 to transfer ${cardToString(stolenJack)} from Player ${i} to Player ${destinationPlayer}`;
              }
            }
          }
        }
        // No valid target found, scrap the joker
        this.state.scrap.push(card);
        break;
      }
    }

    this.state.phase = "play";
    this.advanceTurn();
    return `Player ${player} plays ${cardToString(card)} from 7`;
  }

  private handleResolveSevenChoose(player: number, action: string, parts: string[]): string {
    // Standard variant: choose one of two revealed cards to play
    if (!this.state.sevenRevealedCards || this.state.sevenRevealedCards.length === 0) {
      return "No cards to choose from";
    }

    // Handle scrap_seven with card ID
    if (action === "scrap_seven") {
      const cardId = parseInt(parts[1]);
      const cardIndex = this.state.sevenRevealedCards.findIndex((c) => c.id === cardId);
      if (cardIndex >= 0) {
        const scrappedCard = this.state.sevenRevealedCards.splice(cardIndex, 1)[0];
        this.state.scrap.push(scrappedCard);
        // Put the other card back on top of deck
        if (this.state.sevenRevealedCards.length > 0) {
          this.state.deck.push(this.state.sevenRevealedCards[0]);
        }
      }
      this.state.sevenRevealedCards = null;
      this.state.phase = "play";
      this.advanceTurn();
      return "Card scrapped (could not be played)";
    }

    // Parse the action to find which card is being played
    const playType = action.replace("seven_", "");
    const cardId = parseInt(parts[1]);

    // Find the chosen card
    const chosenIndex = this.state.sevenRevealedCards.findIndex((c) => c.id === cardId);
    if (chosenIndex < 0) {
      return "Invalid card choice";
    }

    const chosenCard = this.state.sevenRevealedCards[chosenIndex];
    const otherCard = this.state.sevenRevealedCards[1 - chosenIndex];

    // Put the other card back on top of deck
    if (otherCard) {
      this.state.deck.push(otherCard);
    }
    this.state.sevenRevealedCards = null;

    // Now play the chosen card (same logic as handleResolveSeven)
    switch (playType) {
      case "point":
        this.state.players[player].pointCards.push({
          card: chosenCard,
          attachedJacks: [],
          controller: player,
        });
        break;

      case "oneoff": {
        const target =
          parts.length > 3
            ? { cardId: parseInt(parts[3]), type: parts[2] as "permanent" | "pointCard" }
            : undefined;
        this.state.pendingOneOff = {
          card: chosenCard,
          player,
          target,
          counterChain: [],
        };
        this.state.phase = "counter";
        return `Player ${player} plays ${cardToString(chosenCard)} as one-off from 7`;
      }

      case "permanent": {
        if (chosenCard.rank === "J") {
          const targetId = parseInt(parts[2]);
          const targetPc = this.findPointCard(targetId);
          if (targetPc) {
            targetPc.attachedJacks.push(chosenCard);
            // Team variant: destination player can be specified (parts[3])
            if (this.config.variant === "team" && parts.length > 3) {
              targetPc.controller = parseInt(parts[3]);
            } else {
              targetPc.controller = player;
            }
          }
        } else {
          const type = chosenCard.rank === "8" ? "eight" : chosenCard.rank === "Q" ? "queen" : "king";
          this.state.players[player].permanents.push({ card: chosenCard, type });
        }
        break;
      }

      case "scuttle": {
        const targetId = parseInt(parts[2]);
        const targetPc = this.findPointCard(targetId);
        if (targetPc) {
          this.removePointCard(targetId);
          this.state.scrap.push(chosenCard, targetPc.card, ...targetPc.attachedJacks);
        }
        break;
      }

      case "joker": {
        // Joker steals a royal from an opponent
        // Team variant: can transfer to any player (parts[3])
        const targetCardId = parseInt(parts[2]);
        const destinationPlayer = this.config.variant === "team" && parts.length > 3
          ? parseInt(parts[3])
          : player;

        for (let i = 0; i < this.state.players.length; i++) {
          const permIndex = this.state.players[i].permanents.findIndex(
            (p) => p.card.id === targetCardId
          );
          if (permIndex >= 0) {
            const stolenPerm = this.state.players[i].permanents.splice(permIndex, 1)[0];
            this.state.players[destinationPlayer].permanents.push({
              card: stolenPerm.card,
              type: stolenPerm.type,
              stolenFromPlayer: i,
            });
            this.state.scrap.push(chosenCard);
            this.state.phase = "play";
            this.advanceTurn();
            if (destinationPlayer === player) {
              return `Player ${player} uses Joker from 7 to steal ${cardToString(stolenPerm.card)} from Player ${i}`;
            } else {
              return `Player ${player} uses Joker from 7 to transfer ${cardToString(stolenPerm.card)} from Player ${i} to Player ${destinationPlayer}`;
            }
          }
          for (const pc of this.state.players[i].pointCards) {
            const jackIndex = pc.attachedJacks.findIndex((j) => j.id === targetCardId);
            if (jackIndex >= 0) {
              const stolenJack = pc.attachedJacks.splice(jackIndex, 1)[0];
              this.state.players[destinationPlayer].hand.push(stolenJack);
              const originalOwner = this.findCardOriginalOwner(pc.card.id);
              pc.controller = pc.attachedJacks.length % 2 === 0
                ? originalOwner
                : (originalOwner + 1) % this.state.players.length;
              this.state.scrap.push(chosenCard);
              this.state.phase = "play";
              this.advanceTurn();
              if (destinationPlayer === player) {
                return `Player ${player} uses Joker from 7 to steal ${cardToString(stolenJack)} from Player ${i}`;
              } else {
                return `Player ${player} uses Joker from 7 to transfer ${cardToString(stolenJack)} from Player ${i} to Player ${destinationPlayer}`;
              }
            }
          }
        }
        this.state.scrap.push(chosenCard);
        break;
      }
    }

    this.state.phase = "play";
    this.advanceTurn();
    return `Player ${player} plays ${cardToString(chosenCard)} from 7`;
  }

  /**
   * Handle Nine response to Royal in Team variant
   * Players can play Nine to bounce the Royal back to owner's hand (not frozen)
   * Or pass to decline responding
   */
  private handleRoyalResponse(player: number, action: string, parts: string[]): string {
    if (!this.state.pendingRoyal) return "No pending Royal";

    const pending = this.state.pendingRoyal;

    if (action === "nine_response") {
      // Player responds with Nine - bounce the Royal back
      const nineId = parseInt(parts[1]);
      const nineCard = this.removeCardFromHand(player, nineId)!;

      // Nine goes to scrap
      this.state.scrap.push(nineCard);

      // Royal goes back to owner's hand (NOT frozen - can be replayed)
      this.state.players[pending.player].hand.push(pending.card);

      // Clear pending and return to play phase
      this.state.pendingRoyal = null;
      this.state.phase = "play";

      // Important: Nine response does NOT consume the responder's turn
      // The original player's turn continues (they already used their action)
      this.advanceTurn();

      return `Player ${player} responds with ${cardToString(nineCard)} - Royal returned to Player ${pending.player}'s hand`;
    }

    if (action === "pass") {
      // Remove this player from responders
      this.state.pendingRoyal.respondersRemaining = pending.respondersRemaining.filter(
        (p) => p !== player
      );

      if (this.state.pendingRoyal.respondersRemaining.length === 0) {
        // No more responders - Royal takes effect
        this.state.players[pending.player].permanents.push({
          card: pending.card,
          type: pending.type,
        });
        this.state.pendingRoyal = null;
        this.state.phase = "play";
        this.advanceTurn();
        return `No response - ${cardToString(pending.card)} takes effect`;
      }

      return `Player ${player} passes on responding to Royal`;
    }

    return "Unknown royal response action";
  }

  private removeCardFromHand(player: number, cardId: number): Card | undefined {
    const hand = this.state.players[player].hand;
    const index = hand.findIndex((c) => c.id === cardId);
    if (index >= 0) {
      return hand.splice(index, 1)[0];
    }
    return undefined;
  }

  private findPointCard(cardId: number): PointCard | undefined {
    for (const player of this.state.players) {
      for (const pc of player.pointCards) {
        if (pc.card.id === cardId) return pc;
      }
    }
    return undefined;
  }

  /**
   * Find the owner of a card (permanent, point card, or attached jack)
   * Returns player index or -1 if not found
   */
  private findCardOwner(cardId: number): number {
    for (let i = 0; i < this.state.players.length; i++) {
      const player = this.state.players[i];
      // Check permanents
      for (const perm of player.permanents) {
        if (perm.card.id === cardId) return i;
      }
      // Check point cards
      for (const pc of player.pointCards) {
        if (pc.card.id === cardId) return i;
        // Check attached jacks
        for (const jack of pc.attachedJacks) {
          if (jack.id === cardId) {
            // Jack owner is the controller of the point card
            return pc.controller;
          }
        }
      }
    }
    return -1;
  }

  private removePointCard(cardId: number): void {
    for (const player of this.state.players) {
      const index = player.pointCards.findIndex((pc) => pc.card.id === cardId);
      if (index >= 0) {
        player.pointCards.splice(index, 1);
        return;
      }
    }
  }

  private removePermanent(cardId: number): void {
    // Check regular permanents
    for (const player of this.state.players) {
      const index = player.permanents.findIndex((p) => p.card.id === cardId);
      if (index >= 0) {
        const perm = player.permanents.splice(index, 1)[0];
        this.state.scrap.push(perm.card);
        return;
      }
    }

    // Check jacks
    for (const player of this.state.players) {
      for (const pc of player.pointCards) {
        const jackIndex = pc.attachedJacks.findIndex((j) => j.id === cardId);
        if (jackIndex >= 0) {
          const jack = pc.attachedJacks.splice(jackIndex, 1)[0];
          this.state.scrap.push(jack);
          // Update controller based on remaining jacks
          const originalOwner = this.state.players.indexOf(player);
          pc.controller = pc.attachedJacks.length % 2 === 0 ? originalOwner : 1 - originalOwner;
          return;
        }
      }
    }
  }

  private returnCardToHand(cardId: number): void {
    // Check permanents
    for (let i = 0; i < this.state.players.length; i++) {
      const player = this.state.players[i];
      const permIndex = player.permanents.findIndex((p) => p.card.id === cardId);
      if (permIndex >= 0) {
        const perm = player.permanents.splice(permIndex, 1)[0];
        player.hand.push(perm.card);
        return;
      }
    }

    // Check point cards
    for (let i = 0; i < this.state.players.length; i++) {
      const player = this.state.players[i];
      const pcIndex = player.pointCards.findIndex((pc) => pc.card.id === cardId);
      if (pcIndex >= 0) {
        const pc = player.pointCards.splice(pcIndex, 1)[0];
        // Return to original owner (who played the point card)
        player.hand.push(pc.card);
        // Jacks go to scrap
        this.state.scrap.push(...pc.attachedJacks);
        return;
      }
    }

    // Check jacks
    for (const player of this.state.players) {
      for (const pc of player.pointCards) {
        const jackIndex = pc.attachedJacks.findIndex((j) => j.id === cardId);
        if (jackIndex >= 0) {
          const jack = pc.attachedJacks.splice(jackIndex, 1)[0];
          // Return jack to its controller
          const jackController = (this.state.players.indexOf(player) + jackIndex + 1) % 2;
          this.state.players[jackController].hand.push(jack);
          // Update point card controller
          const originalOwner = this.state.players.indexOf(player);
          pc.controller = pc.attachedJacks.length % 2 === 0 ? originalOwner : 1 - originalOwner;
          return;
        }
      }
    }
  }

  private advanceTurn(): void {
    this.state.turnNumber++;
    const numPlayers = this.state.players.length;

    // Advance to next player (cycling for 3+ players)
    let nextPlayer = (this.state.currentPlayer + 1) % numPlayers;

    // Handle skip turns (Cutthroat 9 effect)
    let skipsChecked = 0;
    while (this.state.skipTurnPlayers.includes(nextPlayer) && skipsChecked < numPlayers) {
      // Remove this player from skip list (they're skipping now)
      this.state.skipTurnPlayers = this.state.skipTurnPlayers.filter((p) => p !== nextPlayer);
      nextPlayer = (nextPlayer + 1) % numPlayers;
      skipsChecked++;
    }

    this.state.currentPlayer = nextPlayer;

    // Reset discardingPlayer when turn advances
    this.state.discardingPlayer = null;

    // In standard/cutthroat variant, frozen cards thaw after the opponent's turn ends
    // (i.e., when it becomes the owner's turn again, they can play the card)
    // Clear frozen cards that belong to the new current player
    if (this.config.variant !== "classic" && this.state.frozenCardIds.length > 0) {
      const currentPlayer = this.state.currentPlayer;
      const currentPlayerHand = this.state.players[currentPlayer].hand;
      const currentPlayerCardIds = new Set(currentPlayerHand.map((c) => c.id));

      // Only unfreeze cards that are in the current player's hand
      this.state.frozenCardIds = this.state.frozenCardIds.filter(
        (id) => !currentPlayerCardIds.has(id)
      );
    }
  }

  private checkGameEnd(): void {
    if (this.state.phase === "complete") return;

    const numPlayers = this.state.players.length;

    // Check for consecutive passes (3 for 2-player, numPlayers for 3+)
    const passesNeeded = numPlayers === 2 ? 3 : numPlayers;
    if (this.state.consecutivePasses >= passesNeeded) {
      this.state.isDraw = true;
      this.state.phase = "complete";
      return;
    }

    // Check if any player has reached their goal
    // In Team variant: if either teammate reaches their goal, that team wins
    for (let i = 0; i < numPlayers; i++) {
      const points = this.getPoints(i);
      const goal = this.getPointGoal(i);

      // In standard/cutthroat/team variant, 4 kings = goal of 0 = instant win
      if (goal === 0) {
        this.state.winner = i;
        this.state.phase = "complete";
        return;
      }

      if (points >= goal) {
        this.state.winner = i;
        this.state.phase = "complete";
        return;
      }
    }
  }

  /**
   * Get the winning team (0 or 1) if the game is over, or null if not a team game
   */
  getWinningTeam(): number | null {
    if (this.config.variant !== "team") return null;
    if (this.state.winner === null) return null;
    return this.getTeam(this.state.winner);
  }

  render(): void {
    console.log("\n" + "=".repeat(60));
    console.log(`CUTTLE (${this.config.variant})`);
    console.log("=".repeat(60));
    console.log(`Turn: ${this.state.turnNumber} | Phase: ${this.state.phase}`);
    console.log(`Current player: ${this.state.currentPlayer}`);
    console.log(`Deck: ${this.state.deck.length} cards | Scrap: ${this.state.scrap.length} cards`);

    for (let i = 0; i < this.state.players.length; i++) {
      const p = this.state.players[i];
      const marker = i === this.state.currentPlayer ? "-> " : "   ";
      const points = this.getPoints(i);
      const goal = this.getPointGoal(i);
      const skipMarker = this.state.skipTurnPlayers.includes(i) ? " [SKIP]" : "";

      console.log(`\n${marker}Player ${i}: ${points}/${goal} points${skipMarker}`);
      console.log(`   Hand (${p.hand.length}): ${p.hand.map((c) => c.isJoker ? "🃏" : cardToString(c)).join(" ")}`);
      console.log(
        `   Points: ${p.pointCards
          .filter((pc) => pc.controller === i)
          .map((pc) => cardToString(pc.card) + (pc.attachedJacks.length > 0 ? `(J×${pc.attachedJacks.length})` : ""))
          .join(" ")}`
      );
      console.log(`   Permanents: ${p.permanents.map((pm) => pm.card.isJoker ? "🃏" : cardToString(pm.card)).join(" ")}`);
    }

    if (this.state.lastAction) {
      console.log(`\nLast: ${this.state.lastAction}`);
    }
    if (this.state.winner !== null) {
      console.log(`\n*** PLAYER ${this.state.winner} WINS ***`);
    }
    if (this.state.isDraw) {
      console.log(`\n*** GAME IS A DRAW ***`);
    }
  }
}

// ============================================================================
// Action Encoding Helpers
// ============================================================================

export function getMaxActionSpaceSize(): number {
  // Rough upper bound for action space:
  // draw, pass = 2
  // point per card = 52
  // oneoff variations = 52 * 52 (card + target combinations)
  // permanent = 52 + (52 * 52 for jacks)
  // scuttle = 52 * 52
  // counter = 52
  // choose (for 3) = 52
  // discard = 52
  // seven variations = similar to normal play
  // Simplified to a reasonable upper bound
  return 500;
}
