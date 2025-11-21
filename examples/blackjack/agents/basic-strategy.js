/**
 * Basic Blackjack Strategy Agent
 * Implements simplified basic strategy for blackjack
 */

import { getBestHandValue, isSoftHand } from '../blackjack-utils.js';

export class BasicStrategyAgent {
  constructor(name = "BasicBot") {
    this.name = name;
  }
  
  /**
   * Decide whether to hit or stand based on basic strategy
   * @param {Object} gameState - Current game state
   * @returns {string} - "hit" or "stand"
   */
  decide(gameState) {
    const agentValue = gameState.agentHand.value;
    const agentCards = gameState.agentHand.cards;
    const isSoft = isSoftHand(agentCards);
    
    // Get dealer's up card value
    const dealerUpCard = gameState.dealerHand.cards[1]; // Second card is face up
    const dealerUpValue = dealerUpCard.meta?.value?.[0] || 10;
    
    // Simplified basic strategy
    
    // Always stand on 17 or higher
    if (agentValue >= 17) return "stand";
    
    // Soft hands (hands with Ace counted as 11)
    if (isSoft) {
      // Soft 18: stand vs 2-8, hit vs 9-A
      if (agentValue === 18) {
        return dealerUpValue >= 9 ? "hit" : "stand";
      }
      // Soft 19+: always stand
      if (agentValue >= 19) return "stand";
      // Soft 17 or less: always hit
      return "hit";
    }
    
    // Hard hands
    if (agentValue <= 11) {
      // Always hit on 11 or less (can't bust)
      return "hit";
    }
    
    if (agentValue === 12) {
      // Hit vs 2-3, stand vs 4-6, hit vs 7+
      if (dealerUpValue <= 3 || dealerUpValue >= 7) return "hit";
      return "stand";
    }
    
    if (agentValue >= 13 && agentValue <= 16) {
      // Stand vs 2-6, hit vs 7+
      if (dealerUpValue >= 7) return "hit";
      return "stand";
    }
    
    // Default: stand
    return "stand";
  }
}

/**
 * Always Hit Agent (for testing)
 */
export class AlwaysHitAgent {
  constructor(name = "HitBot") {
    this.name = name;
  }
  
  decide(gameState) {
    return gameState.canHit ? "hit" : "stand";
  }
}

/**
 * Conservative Agent - stands on 17+
 */
export class ConservativeAgent {
  constructor(name = "ConservativeBot") {
    this.name = name;
  }
  
  decide(gameState) {
    return gameState.agentHand.value >= 17 ? "stand" : "hit";
  }
}

/**
 * Aggressive Agent - stands on 19+
 */
export class AggressiveAgent {
  constructor(name = "AggressiveBot") {
    this.name = name;
  }
  
  decide(gameState) {
    return gameState.agentHand.value >= 19 ? "stand" : "hit";
  }
}