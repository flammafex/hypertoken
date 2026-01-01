/**
 * Reward Shaping for Poker RL Training
 *
 * Provides intermediate rewards to guide learning, addressing the sparse
 * reward problem in poker where agents only receive feedback at hand end.
 *
 * Shaping Options:
 * - foldSavings: Reward for folding losing hands (based on estimated equity)
 * - potEquity: Intermediate rewards based on hand equity changes
 * - actionQuality: Bonus for +EV decisions (pot odds vs equity)
 * - aggressionBonus: Small bonus for value betting with strong hands
 */

import { PokerGameState, PlayerState } from "./PokerGame.js";
import { evaluateHand, compareHands, Card, getRankValue } from "./HandEvaluator.js";

/**
 * Reward shaping configuration
 */
export interface RewardShapingConfig {
  /** Reward for folding when behind (default: true) */
  foldSavings?: boolean;
  /** Intermediate rewards based on equity (default: true) */
  potEquity?: boolean;
  /** Bonus for +EV decisions (default: true) */
  actionQuality?: boolean;
  /** Small bonus for value betting strong hands (default: false) */
  aggressionBonus?: boolean;
  /** Scale factor for shaped rewards (default: 0.1) */
  shapingScale?: number;
  /** Discount factor for potential-based shaping (default: 0.99) */
  gamma?: number;
}

/**
 * Shaped reward result
 */
export interface ShapedReward {
  /** Base reward (chip change at hand end) */
  baseReward: number;
  /** Total shaped reward */
  shapedReward: number;
  /** Breakdown of shaping components */
  components: {
    foldSavings: number;
    potEquity: number;
    actionQuality: number;
    aggressionBonus: number;
  };
}

/**
 * Context for computing shaped rewards
 */
export interface RewardContext {
  /** Previous game state */
  prevState: PokerGameState;
  /** Current game state */
  currState: PokerGameState;
  /** Action taken */
  action: number;
  /** Player name */
  playerName: string;
  /** Whether this player folded */
  folded: boolean;
}

/**
 * Reward Shaper for poker environments
 */
export class RewardShaper {
  private config: Required<RewardShapingConfig>;
  private potentialCache: Map<string, number> = new Map();

  constructor(config: RewardShapingConfig = {}) {
    this.config = {
      foldSavings: config.foldSavings ?? true,
      potEquity: config.potEquity ?? true,
      actionQuality: config.actionQuality ?? true,
      aggressionBonus: config.aggressionBonus ?? false,
      shapingScale: config.shapingScale ?? 0.1,
      gamma: config.gamma ?? 0.99,
    };
  }

  /**
   * Compute shaped reward for a transition
   */
  computeReward(context: RewardContext, baseReward: number): ShapedReward {
    const components = {
      foldSavings: 0,
      potEquity: 0,
      actionQuality: 0,
      aggressionBonus: 0,
    };

    const scale = this.config.shapingScale;

    // Fold savings: reward for folding when behind
    if (this.config.foldSavings && context.folded) {
      components.foldSavings = this.computeFoldSavings(context) * scale;
    }

    // Pot equity: potential-based shaping using equity as potential
    if (this.config.potEquity && !context.folded) {
      components.potEquity = this.computePotEquityShaping(context) * scale;
    }

    // Action quality: bonus for +EV decisions
    if (this.config.actionQuality && !context.folded) {
      components.actionQuality = this.computeActionQuality(context) * scale;
    }

    // Aggression bonus: reward for betting with strong hands
    if (this.config.aggressionBonus && !context.folded) {
      components.aggressionBonus = this.computeAggressionBonus(context) * scale;
    }

    const shapedReward =
      baseReward +
      components.foldSavings +
      components.potEquity +
      components.actionQuality +
      components.aggressionBonus;

    return {
      baseReward,
      shapedReward,
      components,
    };
  }

  /**
   * Compute fold savings reward
   * Rewards folding when equity is low (would have lost more by continuing)
   */
  private computeFoldSavings(context: RewardContext): number {
    const equity = this.estimateEquity(context.prevState, context.playerName);
    const potOdds = this.computePotOdds(context.prevState, context.playerName);

    // If equity < pot odds, folding was correct
    // Reward proportional to how much was "saved"
    if (equity < potOdds) {
      const toCall = this.getAmountToCall(context.prevState, context.playerName);
      const potSize = context.prevState.pot;
      // Saved = toCall * (1 - equity) - approximation of EV loss avoided
      const saved = toCall * (1 - equity);
      return Math.min(saved / potSize, 1.0); // Normalize to [0, 1]
    }

    // Folding with good equity is slightly penalized
    if (equity > 0.5) {
      return -0.1 * equity;
    }

    return 0;
  }

  /**
   * Potential-based shaping using equity as potential function
   * F(s,s') = gamma * Phi(s') - Phi(s)
   * This is guaranteed not to change optimal policy
   */
  private computePotEquityShaping(context: RewardContext): number {
    const prevPotential = this.computePotential(
      context.prevState,
      context.playerName
    );
    const currPotential = this.computePotential(
      context.currState,
      context.playerName
    );

    return this.config.gamma * currPotential - prevPotential;
  }

  /**
   * Compute potential function based on equity and pot share
   */
  private computePotential(state: PokerGameState, playerName: string): number {
    if (state.phase === "complete") {
      return 0; // Terminal state has 0 potential
    }

    const equity = this.estimateEquity(state, playerName);
    const potSize = state.pot;
    const player = state.players.find((p) => p.name === playerName);

    if (!player) return 0;

    // Potential = expected value = equity * pot
    // Normalized by starting stack for stability
    const startingStack = 100; // Assume standard starting stack
    return (equity * potSize) / startingStack;
  }

  /**
   * Compute action quality reward
   * Rewards decisions that have positive expected value
   */
  private computeActionQuality(context: RewardContext): number {
    const equity = this.estimateEquity(context.prevState, context.playerName);
    const potOdds = this.computePotOdds(context.prevState, context.playerName);
    const action = context.action;

    // Action 0 = Fold, 1 = Check, 2 = Call, 3+ = Raise
    if (action === 0) {
      // Folding - handled by foldSavings
      return 0;
    }

    if (action === 1) {
      // Check - always neutral (free to see more cards)
      return 0;
    }

    if (action === 2) {
      // Call - reward if equity > pot odds
      const evDiff = equity - potOdds;
      return evDiff > 0 ? evDiff : evDiff * 0.5; // Smaller penalty for marginal calls
    }

    // Raise actions (3+)
    // Reward raising with strong hands (value betting)
    if (equity > 0.6) {
      return 0.2 * (equity - 0.5); // Bonus for value raising
    }

    // Penalize raising with weak hands (unless it's a good bluff spot)
    if (equity < 0.3) {
      // Check if it's a good bluff spot (opponent likely to fold)
      const foldEquity = this.estimateFoldEquity(context.prevState);
      if (foldEquity > 0.5) {
        return 0.1; // Small bonus for semi-bluffs
      }
      return -0.1 * (0.3 - equity); // Penalty for bad bluffs
    }

    return 0;
  }

  /**
   * Compute aggression bonus for value betting
   */
  private computeAggressionBonus(context: RewardContext): number {
    const action = context.action;
    if (action < 3) return 0; // Not a raise

    const equity = this.estimateEquity(context.prevState, context.playerName);

    // Bonus for raising with strong hands
    if (equity > 0.7) {
      return 0.1;
    }

    return 0;
  }

  /**
   * Estimate hand equity using Monte Carlo simulation (simplified)
   * In production, this would use a proper equity calculator
   */
  private estimateEquity(state: PokerGameState, playerName: string): number {
    const player = state.players.find((p) => p.name === playerName);
    const opponent = state.players.find((p) => p.name !== playerName);

    if (!player || !opponent) return 0.5;

    // If we can see opponent's cards (at showdown), compute exact equity
    if (state.phase === "complete" && opponent.holeCards.length > 0) {
      return this.computeExactEquity(
        player.holeCards,
        opponent.holeCards,
        state.communityCards
      );
    }

    // Use simplified equity estimation based on hand strength
    return this.estimatePreShowdownEquity(player.holeCards, state.communityCards);
  }

  /**
   * Compute exact equity when opponent cards are known
   */
  private computeExactEquity(
    heroCards: Card[],
    villainCards: Card[],
    communityCards: Card[]
  ): number {
    const heroHand = [...heroCards, ...communityCards];
    const villainHand = [...villainCards, ...communityCards];

    const heroRank = evaluateHand(heroHand);
    const villainRank = evaluateHand(villainHand);

    const comparison = compareHands(heroRank, villainRank);
    if (comparison > 0) return 1;
    if (comparison < 0) return 0;
    return 0.5; // Tie
  }

  /**
   * Estimate equity before showdown using hand strength heuristics
   */
  private estimatePreShowdownEquity(
    holeCards: Card[],
    communityCards: Card[]
  ): number {
    if (holeCards.length < 2) return 0.5;

    const allCards = [...holeCards, ...communityCards];

    if (allCards.length >= 5) {
      // We have enough cards to evaluate hand strength
      const handRank = evaluateHand(allCards);
      return this.handRankToEquity(handRank.rank);
    }

    // Preflop equity estimation based on hole cards
    return this.estimatePreflopEquity(holeCards);
  }

  /**
   * Convert hand rank to approximate equity
   */
  private handRankToEquity(rank: number): number {
    // Hand ranks: 0=high card, 1=pair, 2=two pair, 3=trips, 4=straight,
    // 5=flush, 6=full house, 7=quads, 8=straight flush
    const equityMap: Record<number, number> = {
      0: 0.35, // High card - often loses
      1: 0.5, // Pair - coin flip
      2: 0.65, // Two pair - usually good
      3: 0.75, // Trips - strong
      4: 0.8, // Straight - very strong
      5: 0.85, // Flush - very strong
      6: 0.92, // Full house - premium
      7: 0.97, // Quads - near nuts
      8: 0.99, // Straight flush - nuts
    };
    return equityMap[rank] ?? 0.5;
  }

  /**
   * Estimate preflop equity based on hole cards
   */
  private estimatePreflopEquity(holeCards: Card[]): number {
    if (holeCards.length < 2) return 0.5;

    const [c1, c2] = holeCards;
    const rank1 = getRankValue(c1.rank);
    const rank2 = getRankValue(c2.rank);
    const isPair = c1.rank === c2.rank;
    const isSuited = c1.suit === c2.suit;
    const highRank = Math.max(rank1, rank2);
    const lowRank = Math.min(rank1, rank2);
    const gap = highRank - lowRank;

    // Premium pairs
    if (isPair && highRank >= 10) return 0.8; // TT+
    if (isPair && highRank >= 7) return 0.6; // 77-99
    if (isPair) return 0.5; // 22-66

    // High cards
    if (highRank === 14) {
      // Ace high
      if (lowRank >= 10) return isSuited ? 0.65 : 0.6; // AK-AT
      if (lowRank >= 7) return isSuited ? 0.55 : 0.5; // A9-A7
      return isSuited ? 0.5 : 0.45;
    }

    // Broadway cards
    if (highRank >= 10 && lowRank >= 10) {
      return isSuited ? 0.55 : 0.5;
    }

    // Suited connectors
    if (isSuited && gap <= 2 && highRank >= 6) {
      return 0.45;
    }

    // Default
    return isSuited ? 0.4 : 0.35;
  }

  /**
   * Compute pot odds for calling
   */
  private computePotOdds(state: PokerGameState, playerName: string): number {
    const toCall = this.getAmountToCall(state, playerName);
    if (toCall === 0) return 0;

    const potSize = state.pot;
    return toCall / (potSize + toCall);
  }

  /**
   * Get amount to call for a player
   */
  private getAmountToCall(state: PokerGameState, playerName: string): number {
    const player = state.players.find((p) => p.name === playerName);
    if (!player) return 0;

    const maxBet = Math.max(...state.players.map((p) => p.currentBet));
    return maxBet - player.currentBet;
  }

  /**
   * Estimate fold equity (probability opponent folds to aggression)
   */
  private estimateFoldEquity(state: PokerGameState): number {
    // Simplified heuristic based on pot size and phase
    const pot = state.pot;
    const phase = state.phase;

    // Larger pots = opponent more likely to call (pot committed)
    // Later streets = more information, harder to bluff

    let baseFoldEquity = 0.3;

    if (phase === "preflop") baseFoldEquity = 0.4;
    else if (phase === "flop") baseFoldEquity = 0.35;
    else if (phase === "turn") baseFoldEquity = 0.25;
    else if (phase === "river") baseFoldEquity = 0.2;

    // Adjust for pot size (pot committed effect)
    const avgStack = state.players.reduce((sum, p) => sum + p.chips, 0) / 2;
    const spr = avgStack / pot; // Stack-to-pot ratio

    if (spr < 2) baseFoldEquity *= 0.5; // Very pot committed
    else if (spr < 5) baseFoldEquity *= 0.8;

    return baseFoldEquity;
  }

  /**
   * Reset caches (call between hands)
   */
  reset(): void {
    this.potentialCache.clear();
  }
}

/**
 * Create a reward shaper with default settings
 */
export function createRewardShaper(
  config?: RewardShapingConfig
): RewardShaper {
  return new RewardShaper(config);
}

/**
 * Simple reward normalization
 */
export function normalizeReward(
  reward: number,
  minReward: number,
  maxReward: number
): number {
  if (maxReward === minReward) return 0;
  return (2 * (reward - minReward)) / (maxReward - minReward) - 1;
}
