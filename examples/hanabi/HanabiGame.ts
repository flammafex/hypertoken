/**
 * Hanabi - Cooperative Card Game
 *
 * A cooperative game where players can see everyone's cards except their own.
 * Players give hints to help others play cards in the correct order.
 *
 * Rules:
 * - 2-5 players
 * - 5 colors, cards numbered 1-5
 * - Goal: Build 5 stacks (one per color) from 1 to 5
 * - Max score: 25 (all stacks complete)
 * - 8 information tokens for giving hints
 * - 3 life tokens (lose one on wrong play)
 */

// ============================================================================
// Types
// ============================================================================

export const COLORS = ["red", "yellow", "green", "blue", "white"] as const;
export type Color = (typeof COLORS)[number];

export const NUMBERS = [1, 2, 3, 4, 5] as const;
export type CardNumber = (typeof NUMBERS)[number];

export interface HanabiCard {
  color: Color;
  number: CardNumber;
}

/** Knowledge about a card from hints */
export interface CardKnowledge {
  /** Known possible colors (null = unknown) */
  color: Color | null;
  /** Known possible numbers (null = unknown) */
  number: CardNumber | null;
  /** Colors that have been ruled out */
  notColors: Set<Color>;
  /** Numbers that have been ruled out */
  notNumbers: Set<CardNumber>;
}

export interface PlayerHand {
  cards: HanabiCard[];
  knowledge: CardKnowledge[];
}

export type HintType = "color" | "number";

export interface HintAction {
  type: "hint";
  targetPlayer: number;
  hintType: HintType;
  value: Color | CardNumber;
}

export interface PlayAction {
  type: "play";
  cardIndex: number;
}

export interface DiscardAction {
  type: "discard";
  cardIndex: number;
}

export type HanabiAction = HintAction | PlayAction | DiscardAction;

export interface HanabiGameState {
  /** Player hands (cards face-away from owner) */
  hands: PlayerHand[];
  /** Current firework stacks (top card number, 0 = empty) */
  fireworks: Record<Color, number>;
  /** Cards remaining in deck */
  deckSize: number;
  /** Information tokens remaining (max 8) */
  infoTokens: number;
  /** Life tokens remaining (max 3) */
  lifeTokens: number;
  /** Current player index */
  currentPlayer: number;
  /** Discard pile */
  discardPile: HanabiCard[];
  /** Is game over? */
  gameOver: boolean;
  /** Final score (0-25) */
  score: number;
  /** Turns remaining after deck empty (-1 = deck not empty) */
  finalTurns: number;
  /** Last action taken */
  lastAction: HanabiAction | null;
  /** Last action result */
  lastActionResult: string | null;
}

export interface HanabiConfig {
  /** Number of players (2-5, default: 2) */
  numPlayers?: number;
  /** Random seed */
  seed?: number | null;
  /** Include rainbow/multicolor suit (default: false) */
  rainbow?: boolean;
}

// ============================================================================
// Constants
// ============================================================================

/** Cards per number in a standard deck */
const CARD_COUNTS: Record<CardNumber, number> = {
  1: 3,
  2: 2,
  3: 2,
  4: 2,
  5: 1,
};

/** Hand size by player count */
const HAND_SIZES: Record<number, number> = {
  2: 5,
  3: 5,
  4: 4,
  5: 4,
};

const MAX_INFO_TOKENS = 8;
const MAX_LIFE_TOKENS = 3;
const MAX_SCORE = 25;

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
// HanabiGame Class
// ============================================================================

export class HanabiGame {
  private config: Required<HanabiConfig>;
  private rng: SeededRandom;
  private deck: HanabiCard[] = [];
  private state: HanabiGameState;

  constructor(config: HanabiConfig = {}) {
    const numPlayers = config.numPlayers ?? 2;
    if (numPlayers < 2 || numPlayers > 5) {
      throw new Error("Hanabi requires 2-5 players");
    }

    this.config = {
      numPlayers,
      seed: config.seed ?? null,
      rainbow: config.rainbow ?? false,
    };

    this.rng = new SeededRandom(this.config.seed ?? undefined);
    this.state = this.createInitialState();
  }

  /**
   * Reset the game to initial state
   */
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

  /**
   * Create initial game state
   */
  private createInitialState(): HanabiGameState {
    // Create and shuffle deck
    this.deck = this.createDeck();
    this.deck = this.rng.shuffle(this.deck);

    // Initialize fireworks
    const fireworks: Record<Color, number> = {
      red: 0,
      yellow: 0,
      green: 0,
      blue: 0,
      white: 0,
    };

    // Deal hands
    const handSize = HAND_SIZES[this.config.numPlayers];
    const hands: PlayerHand[] = [];

    for (let p = 0; p < this.config.numPlayers; p++) {
      const cards: HanabiCard[] = [];
      const knowledge: CardKnowledge[] = [];

      for (let i = 0; i < handSize; i++) {
        cards.push(this.deck.pop()!);
        knowledge.push(this.createEmptyKnowledge());
      }

      hands.push({ cards, knowledge });
    }

    return {
      hands,
      fireworks,
      deckSize: this.deck.length,
      infoTokens: MAX_INFO_TOKENS,
      lifeTokens: MAX_LIFE_TOKENS,
      currentPlayer: 0,
      discardPile: [],
      gameOver: false,
      score: 0,
      finalTurns: -1,
      lastAction: null,
      lastActionResult: null,
    };
  }

  /**
   * Create a standard Hanabi deck
   */
  private createDeck(): HanabiCard[] {
    const deck: HanabiCard[] = [];

    for (const color of COLORS) {
      for (const num of NUMBERS) {
        const count = CARD_COUNTS[num];
        for (let i = 0; i < count; i++) {
          deck.push({ color, number: num });
        }
      }
    }

    return deck;
  }

  /**
   * Create empty card knowledge
   */
  private createEmptyKnowledge(): CardKnowledge {
    return {
      color: null,
      number: null,
      notColors: new Set(),
      notNumbers: new Set(),
    };
  }

  /**
   * Get current game state
   */
  getState(): HanabiGameState {
    return { ...this.state };
  }

  /**
   * Get observation for a player (can't see own cards)
   */
  getObservation(playerIndex: number): {
    myKnowledge: CardKnowledge[];
    otherHands: { cards: HanabiCard[]; playerIndex: number }[];
    fireworks: Record<Color, number>;
    deckSize: number;
    infoTokens: number;
    lifeTokens: number;
    discardPile: HanabiCard[];
    currentPlayer: number;
    lastAction: HanabiAction | null;
    lastActionResult: string | null;
    score: number;
    gameOver: boolean;
  } {
    const otherHands: { cards: HanabiCard[]; playerIndex: number }[] = [];

    for (let i = 0; i < this.config.numPlayers; i++) {
      if (i !== playerIndex) {
        otherHands.push({
          cards: [...this.state.hands[i].cards],
          playerIndex: i,
        });
      }
    }

    return {
      myKnowledge: this.state.hands[playerIndex].knowledge.map((k) => ({
        ...k,
        notColors: new Set(k.notColors),
        notNumbers: new Set(k.notNumbers),
      })),
      otherHands,
      fireworks: { ...this.state.fireworks },
      deckSize: this.state.deckSize,
      infoTokens: this.state.infoTokens,
      discardPile: [...this.state.discardPile],
      lifeTokens: this.state.lifeTokens,
      currentPlayer: this.state.currentPlayer,
      lastAction: this.state.lastAction,
      lastActionResult: this.state.lastActionResult,
      score: this.state.score,
      gameOver: this.state.gameOver,
    };
  }

  /**
   * Get valid actions for current player
   */
  getValidActions(): HanabiAction[] {
    if (this.state.gameOver) return [];

    const actions: HanabiAction[] = [];
    const currentPlayer = this.state.currentPlayer;
    const hand = this.state.hands[currentPlayer];

    // Play actions (always valid for each card)
    for (let i = 0; i < hand.cards.length; i++) {
      actions.push({ type: "play", cardIndex: i });
    }

    // Discard actions (only if not at max info tokens)
    if (this.state.infoTokens < MAX_INFO_TOKENS) {
      for (let i = 0; i < hand.cards.length; i++) {
        actions.push({ type: "discard", cardIndex: i });
      }
    }

    // Hint actions (only if info tokens available)
    if (this.state.infoTokens > 0) {
      for (let target = 0; target < this.config.numPlayers; target++) {
        if (target === currentPlayer) continue;

        const targetHand = this.state.hands[target];

        // Color hints (only for colors in target's hand)
        const colorsInHand = new Set(targetHand.cards.map((c) => c.color));
        for (const color of colorsInHand) {
          actions.push({
            type: "hint",
            targetPlayer: target,
            hintType: "color",
            value: color,
          });
        }

        // Number hints (only for numbers in target's hand)
        const numbersInHand = new Set(targetHand.cards.map((c) => c.number));
        for (const num of numbersInHand) {
          actions.push({
            type: "hint",
            targetPlayer: target,
            hintType: "number",
            value: num,
          });
        }
      }
    }

    return actions;
  }

  /**
   * Take an action
   */
  action(action: HanabiAction): { success: boolean; message: string } {
    if (this.state.gameOver) {
      return { success: false, message: "Game is over" };
    }

    let result: { success: boolean; message: string };

    switch (action.type) {
      case "play":
        result = this.playCard(action.cardIndex);
        break;
      case "discard":
        result = this.discardCard(action.cardIndex);
        break;
      case "hint":
        result = this.giveHint(action.targetPlayer, action.hintType, action.value);
        break;
      default:
        result = { success: false, message: "Invalid action type" };
    }

    if (result.success) {
      this.state.lastAction = action;
      this.state.lastActionResult = result.message;
      this.advanceTurn();
    }

    return result;
  }

  /**
   * Play a card from hand
   */
  private playCard(cardIndex: number): { success: boolean; message: string } {
    const hand = this.state.hands[this.state.currentPlayer];

    if (cardIndex < 0 || cardIndex >= hand.cards.length) {
      return { success: false, message: "Invalid card index" };
    }

    const card = hand.cards[cardIndex];
    const requiredNumber = this.state.fireworks[card.color] + 1;

    if (card.number === requiredNumber) {
      // Successful play
      this.state.fireworks[card.color] = card.number;
      this.state.score++;

      // Bonus info token for completing a stack
      if (card.number === 5 && this.state.infoTokens < MAX_INFO_TOKENS) {
        this.state.infoTokens++;
      }

      this.removeCardAndDraw(cardIndex);
      return { success: true, message: `Played ${card.color} ${card.number}` };
    } else {
      // Failed play - lose a life
      this.state.lifeTokens--;
      this.state.discardPile.push(card);
      this.removeCardAndDraw(cardIndex);

      if (this.state.lifeTokens === 0) {
        this.endGame("Lost all lives");
      }

      return {
        success: true,
        message: `Misplayed ${card.color} ${card.number} (needed ${requiredNumber})`,
      };
    }
  }

  /**
   * Discard a card
   */
  private discardCard(cardIndex: number): { success: boolean; message: string } {
    if (this.state.infoTokens >= MAX_INFO_TOKENS) {
      return { success: false, message: "Cannot discard at max info tokens" };
    }

    const hand = this.state.hands[this.state.currentPlayer];

    if (cardIndex < 0 || cardIndex >= hand.cards.length) {
      return { success: false, message: "Invalid card index" };
    }

    const card = hand.cards[cardIndex];
    this.state.discardPile.push(card);
    this.state.infoTokens++;
    this.removeCardAndDraw(cardIndex);

    return { success: true, message: `Discarded ${card.color} ${card.number}` };
  }

  /**
   * Give a hint to another player
   */
  private giveHint(
    targetPlayer: number,
    hintType: HintType,
    value: Color | CardNumber
  ): { success: boolean; message: string } {
    if (this.state.infoTokens <= 0) {
      return { success: false, message: "No info tokens available" };
    }

    if (targetPlayer === this.state.currentPlayer) {
      return { success: false, message: "Cannot hint yourself" };
    }

    if (targetPlayer < 0 || targetPlayer >= this.config.numPlayers) {
      return { success: false, message: "Invalid target player" };
    }

    const targetHand = this.state.hands[targetPlayer];
    const matchingIndices: number[] = [];

    for (let i = 0; i < targetHand.cards.length; i++) {
      const card = targetHand.cards[i];
      if (hintType === "color" && card.color === value) {
        matchingIndices.push(i);
        targetHand.knowledge[i].color = value as Color;
      } else if (hintType === "number" && card.number === value) {
        matchingIndices.push(i);
        targetHand.knowledge[i].number = value as CardNumber;
      }
    }

    // Update negative knowledge for non-matching cards
    for (let i = 0; i < targetHand.cards.length; i++) {
      if (!matchingIndices.includes(i)) {
        if (hintType === "color") {
          targetHand.knowledge[i].notColors.add(value as Color);
        } else {
          targetHand.knowledge[i].notNumbers.add(value as CardNumber);
        }
      }
    }

    if (matchingIndices.length === 0) {
      return { success: false, message: "Hint must match at least one card" };
    }

    this.state.infoTokens--;

    const positions = matchingIndices.map((i) => i + 1).join(", ");
    return {
      success: true,
      message: `Hinted player ${targetPlayer}: ${value} at position(s) ${positions}`,
    };
  }

  /**
   * Remove a card from hand and draw a new one
   */
  private removeCardAndDraw(cardIndex: number): void {
    const hand = this.state.hands[this.state.currentPlayer];
    hand.cards.splice(cardIndex, 1);
    hand.knowledge.splice(cardIndex, 1);

    if (this.deck.length > 0) {
      hand.cards.push(this.deck.pop()!);
      hand.knowledge.push(this.createEmptyKnowledge());
      this.state.deckSize = this.deck.length;
    }

    // Check if deck just ran out
    if (this.deck.length === 0 && this.state.finalTurns < 0) {
      this.state.finalTurns = this.config.numPlayers;
    }
  }

  /**
   * Advance to next turn
   */
  private advanceTurn(): void {
    // Check for perfect score
    if (this.state.score === MAX_SCORE) {
      this.endGame("Perfect score!");
      return;
    }

    // Decrement final turns if applicable
    if (this.state.finalTurns > 0) {
      this.state.finalTurns--;
      if (this.state.finalTurns === 0) {
        this.endGame("Deck exhausted");
        return;
      }
    }

    // Next player
    this.state.currentPlayer =
      (this.state.currentPlayer + 1) % this.config.numPlayers;
  }

  /**
   * End the game
   */
  private endGame(reason: string): void {
    this.state.gameOver = true;
    this.state.lastActionResult = `Game over: ${reason}. Final score: ${this.state.score}`;
  }

  /**
   * Get number of players
   */
  get numPlayers(): number {
    return this.config.numPlayers;
  }

  /**
   * Get hand size
   */
  get handSize(): number {
    return HAND_SIZES[this.config.numPlayers];
  }

  /**
   * Render game state to console
   */
  render(): void {
    console.log("\n" + "=".repeat(50));
    console.log("HANABI");
    console.log("=".repeat(50));

    // Fireworks
    console.log("\nFireworks:");
    for (const color of COLORS) {
      const stack = this.state.fireworks[color];
      const display = stack > 0 ? `[${stack}]` : "[ ]";
      console.log(`  ${color.padEnd(8)} ${display}`);
    }

    // Tokens
    console.log(`\nInfo tokens: ${"●".repeat(this.state.infoTokens)}${"○".repeat(MAX_INFO_TOKENS - this.state.infoTokens)} (${this.state.infoTokens}/${MAX_INFO_TOKENS})`);
    console.log(`Life tokens: ${"♥".repeat(this.state.lifeTokens)}${"♡".repeat(MAX_LIFE_TOKENS - this.state.lifeTokens)} (${this.state.lifeTokens}/${MAX_LIFE_TOKENS})`);
    console.log(`Deck: ${this.state.deckSize} cards`);
    console.log(`Score: ${this.state.score}/${MAX_SCORE}`);

    // Hands
    console.log("\nHands:");
    for (let p = 0; p < this.config.numPlayers; p++) {
      const marker = p === this.state.currentPlayer ? "→ " : "  ";
      const hand = this.state.hands[p];
      const cards = hand.cards
        .map((c) => `${c.color[0].toUpperCase()}${c.number}`)
        .join(" ");
      console.log(`${marker}Player ${p}: ${cards}`);
    }

    // Discard pile summary
    if (this.state.discardPile.length > 0) {
      console.log(`\nDiscard pile: ${this.state.discardPile.length} cards`);
    }

    // Last action
    if (this.state.lastActionResult) {
      console.log(`\nLast: ${this.state.lastActionResult}`);
    }

    if (this.state.gameOver) {
      console.log(`\n*** GAME OVER - Score: ${this.state.score} ***`);
    }

    console.log("");
  }
}

// ============================================================================
// Action encoding helpers
// ============================================================================

/**
 * Encode action to integer for RL
 * Layout: [play0-4] [discard0-4] [hint_color_p0-4 * 5colors] [hint_num_p0-4 * 5nums]
 */
export function encodeAction(
  action: HanabiAction,
  numPlayers: number,
  handSize: number,
  currentPlayer: number
): number {
  if (action.type === "play") {
    return action.cardIndex;
  }

  if (action.type === "discard") {
    return handSize + action.cardIndex;
  }

  if (action.type === "hint") {
    const baseOffset = handSize * 2;

    // Adjust target player index (skip current player)
    let adjustedTarget = action.targetPlayer;
    if (action.targetPlayer > currentPlayer) {
      adjustedTarget--;
    }

    if (action.hintType === "color") {
      const colorIndex = COLORS.indexOf(action.value as Color);
      return baseOffset + adjustedTarget * COLORS.length + colorIndex;
    } else {
      const numIndex = NUMBERS.indexOf(action.value as CardNumber);
      const colorHintsCount = (numPlayers - 1) * COLORS.length;
      return baseOffset + colorHintsCount + adjustedTarget * NUMBERS.length + numIndex;
    }
  }

  return -1;
}

/**
 * Decode integer action to HanabiAction
 */
export function decodeAction(
  encoded: number,
  numPlayers: number,
  handSize: number,
  currentPlayer: number
): HanabiAction | null {
  if (encoded < handSize) {
    return { type: "play", cardIndex: encoded };
  }

  if (encoded < handSize * 2) {
    return { type: "discard", cardIndex: encoded - handSize };
  }

  const hintOffset = handSize * 2;
  const hintIndex = encoded - hintOffset;
  const colorHintsCount = (numPlayers - 1) * COLORS.length;

  if (hintIndex < colorHintsCount) {
    // Color hint
    const adjustedTarget = Math.floor(hintIndex / COLORS.length);
    const colorIndex = hintIndex % COLORS.length;

    // Convert adjusted target back to real player index
    let targetPlayer = adjustedTarget;
    if (adjustedTarget >= currentPlayer) {
      targetPlayer++;
    }

    return {
      type: "hint",
      targetPlayer,
      hintType: "color",
      value: COLORS[colorIndex],
    };
  }

  const numHintIndex = hintIndex - colorHintsCount;
  if (numHintIndex < (numPlayers - 1) * NUMBERS.length) {
    // Number hint
    const adjustedTarget = Math.floor(numHintIndex / NUMBERS.length);
    const numIndex = numHintIndex % NUMBERS.length;

    let targetPlayer = adjustedTarget;
    if (adjustedTarget >= currentPlayer) {
      targetPlayer++;
    }

    return {
      type: "hint",
      targetPlayer,
      hintType: "number",
      value: NUMBERS[numIndex],
    };
  }

  return null;
}

/**
 * Get total action space size
 */
export function getActionSpaceSize(numPlayers: number, handSize: number): number {
  const playActions = handSize;
  const discardActions = handSize;
  const colorHints = (numPlayers - 1) * COLORS.length;
  const numberHints = (numPlayers - 1) * NUMBERS.length;
  return playActions + discardActions + colorHints + numberHints;
}
