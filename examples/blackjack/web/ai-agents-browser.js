/**
 * Browser-compatible AI Agents for Multiplayer Blackjack
 *
 * Provides basic strategy and various AI personality types.
 */

import { getBestHandValue, isSoftHand, canDoubleDown, canSplit } from './multiplayer-blackjack-game.js';

// ============================================================================
// Basic Strategy Agent
// ============================================================================

export class BasicStrategyAgent {
  constructor(name = "BasicBot", options = {}) {
    this.name = name;
    this.baseBet = options.baseBet || 10;
    this.bettingStyle = options.bettingStyle || 'flat'; // flat, conservative, aggressive, martingale
    this.lastResult = null;
    this.lastBet = this.baseBet;
    this.consecutiveLosses = 0;
  }

  /**
   * Decide action based on basic strategy
   * @param {Object} playerState - Player's current state
   * @param {Object} dealerUpCard - Dealer's visible card
   * @returns {string} - "hit", "stand", "double", "split", or "surrender"
   */
  decide(playerState, dealerUpCard, availableActions) {
    const hand = playerState.hand;
    const cards = hand.cards;
    const playerValue = hand.value;
    const isSoft = isSoftHand(cards);

    // Get dealer up card value
    const dealerValue = dealerUpCard?.meta?.value?.[0] || 10;
    const dealerIsAce = dealerUpCard?.meta?.rank === 'A';
    const dealerEffective = dealerIsAce ? 11 : dealerValue;

    // Check for surrender first (only on first two cards)
    if (availableActions.includes('surrender')) {
      const surrenderDecision = this.shouldSurrender(playerValue, isSoft, dealerEffective);
      if (surrenderDecision) return 'surrender';
    }

    // Check for split opportunity
    if (availableActions.includes('split') && canSplit(cards)) {
      const splitDecision = this.shouldSplit(cards, dealerEffective);
      if (splitDecision) return 'split';
    }

    // Check for double down opportunity
    if (availableActions.includes('double') && canDoubleDown(cards)) {
      const doubleDecision = this.shouldDouble(playerValue, isSoft, dealerEffective);
      if (doubleDecision) return 'double';
    }

    // Basic hit/stand strategy
    return this.hitOrStand(playerValue, isSoft, dealerEffective);
  }

  /**
   * Basic strategy surrender decisions.
   * Surrender is generally only recommended in specific situations.
   */
  shouldSurrender(playerValue, isSoft, dealerValue) {
    // Never surrender soft hands
    if (isSoft) return false;

    // Surrender 16 vs 9, 10, A (but not 8-8 which should be split)
    if (playerValue === 16) {
      return dealerValue >= 9 || dealerValue === 11;
    }

    // Surrender 15 vs 10
    if (playerValue === 15) {
      return dealerValue === 10;
    }

    return false;
  }

  shouldSplit(cards, dealerValue) {
    const rank = cards[0].meta?.rank;
    const value = cards[0].meta?.value?.[0] || 10;

    // Always split Aces and 8s
    if (rank === 'A' || rank === '8') return true;

    // Never split 10s, 5s, 4s
    if (value === 10 || rank === '5' || rank === '4') return false;

    // Split 9s vs 2-9 (except 7)
    if (rank === '9') {
      return dealerValue !== 7 && dealerValue <= 9;
    }

    // Split 7s vs 2-7
    if (rank === '7') return dealerValue <= 7;

    // Split 6s vs 2-6
    if (rank === '6') return dealerValue <= 6;

    // Split 3s and 2s vs 4-7
    if (rank === '3' || rank === '2') {
      return dealerValue >= 4 && dealerValue <= 7;
    }

    return false;
  }

  shouldDouble(playerValue, isSoft, dealerValue) {
    if (isSoft) {
      // Soft doubling
      if (playerValue === 13 || playerValue === 14) {
        return dealerValue >= 5 && dealerValue <= 6;
      }
      if (playerValue === 15 || playerValue === 16) {
        return dealerValue >= 4 && dealerValue <= 6;
      }
      if (playerValue === 17) {
        return dealerValue >= 3 && dealerValue <= 6;
      }
      if (playerValue === 18) {
        return dealerValue >= 3 && dealerValue <= 6;
      }
      return false;
    } else {
      // Hard doubling
      if (playerValue === 11) return true;
      if (playerValue === 10) return dealerValue <= 9;
      if (playerValue === 9) return dealerValue >= 3 && dealerValue <= 6;
      return false;
    }
  }

  hitOrStand(playerValue, isSoft, dealerValue) {
    // Always stand on 17 or higher
    if (playerValue >= 17) return 'stand';

    // Soft hands
    if (isSoft) {
      if (playerValue === 18) {
        return dealerValue >= 9 ? 'hit' : 'stand';
      }
      if (playerValue >= 19) return 'stand';
      return 'hit';
    }

    // Hard hands
    if (playerValue <= 11) return 'hit';

    if (playerValue === 12) {
      return (dealerValue <= 3 || dealerValue >= 7) ? 'hit' : 'stand';
    }

    if (playerValue >= 13 && playerValue <= 16) {
      return dealerValue >= 7 ? 'hit' : 'stand';
    }

    return 'stand';
  }

  /**
   * Determine bet amount based on betting style
   */
  getBetAmount(bankroll, minBet, maxBet) {
    let bet = this.baseBet;

    switch (this.bettingStyle) {
      case 'conservative':
        bet = Math.min(this.baseBet, bankroll * 0.02);
        break;

      case 'aggressive':
        bet = Math.min(this.baseBet * 2, bankroll * 0.1);
        break;

      case 'martingale':
        if (this.lastResult === 'dealer' || this.lastResult === 'busted') {
          this.consecutiveLosses++;
          bet = this.baseBet * Math.pow(2, Math.min(this.consecutiveLosses, 4));
        } else {
          this.consecutiveLosses = 0;
          bet = this.baseBet;
        }
        break;

      case 'flat':
      default:
        bet = this.baseBet;
        break;
    }

    // Ensure within limits
    bet = Math.max(minBet, Math.min(bet, maxBet, bankroll));
    this.lastBet = bet;
    return Math.floor(bet);
  }

  /**
   * Update agent with result of last hand
   */
  updateResult(result) {
    this.lastResult = result;
  }
}

// ============================================================================
// AI Personalities
// ============================================================================

export const AI_PERSONALITIES = [
  {
    name: "Alice",
    avatar: "A",
    strategy: "basic",
    style: "conservative",
    color: "#e91e63"  // Pink
  },
  {
    name: "Bob",
    avatar: "B",
    strategy: "basic",
    style: "aggressive",
    color: "#2196f3"  // Blue
  },
  {
    name: "Charlie",
    avatar: "C",
    strategy: "basic",
    style: "flat",
    color: "#4caf50"  // Green
  },
  {
    name: "Diana",
    avatar: "D",
    strategy: "basic",
    style: "martingale",
    color: "#ff9800"  // Orange
  },
  {
    name: "Eve",
    avatar: "E",
    strategy: "basic",
    style: "conservative",
    color: "#9c27b0"  // Purple
  }
];

/**
 * Create an AI agent with a random personality
 * @param {number} index - Index for personality selection
 * @returns {BasicStrategyAgent} Configured AI agent
 */
export function createAIAgent(index) {
  const personality = AI_PERSONALITIES[index % AI_PERSONALITIES.length];
  return new BasicStrategyAgent(personality.name, {
    baseBet: 10,
    bettingStyle: personality.style
  });
}

/**
 * Get personality info for display
 * @param {number} index - Personality index
 * @returns {Object} Personality details
 */
export function getPersonality(index) {
  return AI_PERSONALITIES[index % AI_PERSONALITIES.length];
}

// Browser global export
if (typeof window !== 'undefined') {
  window.BasicStrategyAgent = BasicStrategyAgent;
  window.AI_PERSONALITIES = AI_PERSONALITIES;
  window.createAIAgent = createAIAgent;
}
