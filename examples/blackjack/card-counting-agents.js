/**
 * Hi-Lo Card Counting Agent
 */
export class HiLoCountingAgent {
  constructor(name = "Hi-Lo Counter", baseBet = 10, spreadMultiplier = 8) {
    this.name = name;
    this.baseBet = baseBet;
    this.spreadMultiplier = spreadMultiplier;
    this.runningCount = 0;
    this.cardsDealt = 0;
    this.stacksRemaining = 6;
    this.trueCount = 0;
  }
  
  updateCount(card) {
    const rank = card.meta.rank;
    if (['2', '3', '4', '5', '6'].includes(rank)) {
      this.runningCount += 1;
    } else if (['10', 'J', 'Q', 'K', 'A'].includes(rank)) {
      this.runningCount -= 1;
    }
    this.cardsDealt++;
    this.stacksRemaining = Math.max(1, (312 - this.cardsDealt) / 52);
    this.trueCount = Math.floor(this.runningCount / this.stacksRemaining);
  }
  
  updateFromGameState(gameState) {
    for (const card of gameState.agentHand.cards) {
      this.updateCount(card);
    }
    const dealerCards = gameState.dealerHand.cards;
    if (gameState.gameOver || gameState.dealerHand.value !== null) {
      for (const card of dealerCards) {
        this.updateCount(card);
      }
    } else if (dealerCards.length > 1) {
      this.updateCount(dealerCards[1]);
    }
  }
  
  getBetSize(gameState, bettingManager, lastResult) {
    if (this.cardsDealt > 280) {
      this.resetCount();
    }
    
    let betMultiplier = 1;
    if (this.trueCount >= 5) betMultiplier = this.spreadMultiplier;
    else if (this.trueCount >= 4) betMultiplier = 6;
    else if (this.trueCount >= 3) betMultiplier = 4;
    else if (this.trueCount >= 2) betMultiplier = 2;
    else if (this.trueCount >= 1) betMultiplier = 1.5;
    
    const betSize = this.baseBet * betMultiplier;
    return Math.min(Math.max(betSize, bettingManager.minBet), bettingManager.maxBet, bettingManager.bankroll);
  }
  
  decide(gameState) {
    const agentValue = gameState.agentHand.value;
    const dealerUpCard = gameState.dealerHand.cards[1];
    const dealerValue = this.getCardValue(dealerUpCard);
    
    this.updateFromGameState(gameState);
    
    if (agentValue >= 17) return "stand";
    if (agentValue <= 11) return "hit";
    
    if (agentValue === 16 && dealerValue === 10) {
      return this.trueCount >= 0 ? "stand" : "hit";
    }
    
    if (agentValue >= 13 && agentValue <= 16 && dealerValue >= 2 && dealerValue <= 6) {
      return "stand";
    }
    
    if (agentValue === 12 && dealerValue >= 4 && dealerValue <= 6) {
      return "stand";
    }
    
    return "hit";
  }
  
  getCardValue(card) {
    const rank = card.meta.rank;
    if (rank === 'A') return 11;
    if (['J', 'Q', 'K'].includes(rank)) return 10;
    return parseInt(rank);
  }
  
  resetCount() {
    this.runningCount = 0;
    this.cardsDealt = 0;
    this.stacksRemaining = 6;
    this.trueCount = 0;
  }
  
  getCountStats() {
    return {
      runningCount: this.runningCount,
      trueCount: this.trueCount,
      cardsDealt: this.cardsDealt,
      stacksRemaining: this.stacksRemaining.toFixed(1)
    };
  }
}

export class AggressiveCountingAgent extends HiLoCountingAgent {
  constructor(name = "Aggressive Counter", baseBet = 10) {
    super(name, baseBet, 12);
  }
  
  getBetSize(gameState, bettingManager, lastResult) {
    if (this.cardsDealt > 280) this.resetCount();
    
    let betMultiplier = 1;
    if (this.trueCount >= 5) betMultiplier = 12;
    else if (this.trueCount >= 4) betMultiplier = 8;
    else if (this.trueCount >= 3) betMultiplier = 5;
    else if (this.trueCount >= 2) betMultiplier = 3;
    else if (this.trueCount >= 1) betMultiplier = 2;
    else if (this.trueCount <= -2) return bettingManager.minBet;
    
    const betSize = this.baseBet * betMultiplier;
    return Math.min(Math.max(betSize, bettingManager.minBet), bettingManager.maxBet, bettingManager.bankroll);
  }
}

export class ConservativeCountingAgent extends HiLoCountingAgent {
  constructor(name = "Conservative Counter", baseBet = 10) {
    super(name, baseBet, 4);
  }

  getBetSize(gameState, bettingManager, lastResult) {
    if (this.cardsDealt > 280) this.resetCount();

    let betMultiplier = 1;
    if (this.trueCount >= 4) betMultiplier = 4;
    else if (this.trueCount >= 3) betMultiplier = 3;
    else if (this.trueCount >= 2) betMultiplier = 2;

    const betSize = this.baseBet * betMultiplier;
    return Math.min(Math.max(betSize, bettingManager.minBet), bettingManager.maxBet, bettingManager.bankroll);
  }
}

/**
 * Hi-Opt I Card Counting Agent
 *
 * More accurate than Hi-Lo but slightly more complex.
 * Aces are counted separately (side count) for increased accuracy.
 *
 * Card Values:
 * - 2: 0
 * - 3-6: +1
 * - 7-9: 0
 * - 10, J, Q, K: -1
 * - A: 0 (tracked separately)
 *
 * Advantages: More accurate for strategy decisions
 * Disadvantages: Slightly harder to maintain count
 */
export class HiOptICountingAgent {
  constructor(name = "Hi-Opt I Counter", baseBet = 10, spreadMultiplier = 8) {
    this.name = name;
    this.baseBet = baseBet;
    this.spreadMultiplier = spreadMultiplier;
    this.runningCount = 0;
    this.acesCount = 0; // Side count for Aces
    this.cardsDealt = 0;
    this.stacksRemaining = 6;
    this.trueCount = 0;
  }

  updateCount(card) {
    const rank = card.meta.rank;

    // Hi-Opt I card values
    if (['3', '4', '5', '6'].includes(rank)) {
      this.runningCount += 1;
    } else if (['10', 'J', 'Q', 'K'].includes(rank)) {
      this.runningCount -= 1;
    } else if (rank === 'A') {
      this.acesCount++; // Side count Aces
    }
    // 2, 7, 8, 9 are neutral (0)

    this.cardsDealt++;
    this.stacksRemaining = Math.max(1, (312 - this.cardsDealt) / 52);
    this.trueCount = Math.floor(this.runningCount / this.stacksRemaining);
  }

  updateFromGameState(gameState) {
    for (const card of gameState.agentHand.cards) {
      this.updateCount(card);
    }
    const dealerCards = gameState.dealerHand.cards;
    if (gameState.gameOver || gameState.dealerHand.value !== null) {
      for (const card of dealerCards) {
        this.updateCount(card);
      }
    } else if (dealerCards.length > 1) {
      this.updateCount(dealerCards[1]);
    }
  }

  getBetSize(gameState, bettingManager, lastResult) {
    if (this.cardsDealt > 280) {
      this.resetCount();
    }

    // Adjust true count based on Aces remaining
    const expectedAces = (this.stacksRemaining * 4);
    const acesRemaining = expectedAces - this.acesCount;
    const acesAdjustment = acesRemaining > expectedAces * 0.5 ? 1 : 0;

    let adjustedCount = this.trueCount + acesAdjustment;
    let betMultiplier = 1;

    if (adjustedCount >= 5) betMultiplier = this.spreadMultiplier;
    else if (adjustedCount >= 4) betMultiplier = 6;
    else if (adjustedCount >= 3) betMultiplier = 4;
    else if (adjustedCount >= 2) betMultiplier = 2;
    else if (adjustedCount >= 1) betMultiplier = 1.5;

    const betSize = this.baseBet * betMultiplier;
    return Math.min(Math.max(betSize, bettingManager.minBet), bettingManager.maxBet, bettingManager.bankroll);
  }

  decide(gameState) {
    // Basic strategy with Hi-Opt I deviations
    const agentValue = gameState.agentHand.value;
    const dealerUpCard = gameState.dealerHand.cards[1];
    const dealerValue = this.getCardValue(dealerUpCard);

    this.updateFromGameState(gameState);

    if (agentValue >= 17) return "stand";
    if (agentValue <= 11) return "hit";

    // Hi-Opt I specific deviation: Stand 16 vs 10 at TC +1 (more conservative than Hi-Lo)
    if (agentValue === 16 && dealerValue === 10) {
      return this.trueCount >= 1 ? "stand" : "hit";
    }

    if (agentValue >= 13 && agentValue <= 16 && dealerValue >= 2 && dealerValue <= 6) {
      return "stand";
    }

    if (agentValue === 12 && dealerValue >= 4 && dealerValue <= 6) {
      return "stand";
    }

    return "hit";
  }

  getCardValue(card) {
    const rank = card.meta.rank;
    if (rank === 'A') return 11;
    if (['J', 'Q', 'K'].includes(rank)) return 10;
    return parseInt(rank);
  }

  resetCount() {
    this.runningCount = 0;
    this.acesCount = 0;
    this.cardsDealt = 0;
    this.stacksRemaining = 6;
    this.trueCount = 0;
  }

  getCountStats() {
    return {
      runningCount: this.runningCount,
      trueCount: this.trueCount,
      acesCount: this.acesCount,
      cardsDealt: this.cardsDealt,
      stacksRemaining: this.stacksRemaining.toFixed(1)
    };
  }
}

/**
 * Omega II Card Counting Agent
 *
 * Multi-level count system (uses -2, -1, 0, +1, +2).
 * More powerful but more difficult to use.
 * Balanced count (sum of all cards = 0).
 *
 * Card Values:
 * - 2, 3, 7: +1
 * - 4, 5, 6: +2
 * - 8, A: 0
 * - 9: -1
 * - 10, J, Q, K: -2
 *
 * Advantages: More accurate edge estimation
 * Disadvantages: Harder to maintain (multi-level)
 */
export class OmegaIICountingAgent {
  constructor(name = "Omega II Counter", baseBet = 10, spreadMultiplier = 8) {
    this.name = name;
    this.baseBet = baseBet;
    this.spreadMultiplier = spreadMultiplier;
    this.runningCount = 0;
    this.cardsDealt = 0;
    this.stacksRemaining = 6;
    this.trueCount = 0;
  }

  updateCount(card) {
    const rank = card.meta.rank;

    // Omega II card values (multi-level)
    if (['2', '3', '7'].includes(rank)) {
      this.runningCount += 1;
    } else if (['4', '5', '6'].includes(rank)) {
      this.runningCount += 2;  // Multi-level: +2
    } else if (rank === '9') {
      this.runningCount -= 1;
    } else if (['10', 'J', 'Q', 'K'].includes(rank)) {
      this.runningCount -= 2;  // Multi-level: -2
    }
    // 8 and A are neutral (0)

    this.cardsDealt++;
    this.stacksRemaining = Math.max(1, (312 - this.cardsDealt) / 52);
    this.trueCount = Math.floor(this.runningCount / this.stacksRemaining);
  }

  updateFromGameState(gameState) {
    for (const card of gameState.agentHand.cards) {
      this.updateCount(card);
    }
    const dealerCards = gameState.dealerHand.cards;
    if (gameState.gameOver || gameState.dealerHand.value !== null) {
      for (const card of dealerCards) {
        this.updateCount(card);
      }
    } else if (dealerCards.length > 1) {
      this.updateCount(dealerCards[1]);
    }
  }

  getBetSize(gameState, bettingManager, lastResult) {
    if (this.cardsDealt > 280) {
      this.resetCount();
    }

    // Omega II uses higher true counts due to multi-level nature
    let betMultiplier = 1;

    if (this.trueCount >= 8) betMultiplier = this.spreadMultiplier;
    else if (this.trueCount >= 6) betMultiplier = 6;
    else if (this.trueCount >= 4) betMultiplier = 4;
    else if (this.trueCount >= 2) betMultiplier = 2;
    else if (this.trueCount >= 1) betMultiplier = 1.5;

    const betSize = this.baseBet * betMultiplier;
    return Math.min(Math.max(betSize, bettingManager.minBet), bettingManager.maxBet, bettingManager.bankroll);
  }

  decide(gameState) {
    const agentValue = gameState.agentHand.value;
    const dealerUpCard = gameState.dealerHand.cards[1];
    const dealerValue = this.getCardValue(dealerUpCard);

    this.updateFromGameState(gameState);

    if (agentValue >= 17) return "stand";
    if (agentValue <= 11) return "hit";

    // Omega II deviation thresholds are higher due to multi-level
    if (agentValue === 16 && dealerValue === 10) {
      return this.trueCount >= 2 ? "stand" : "hit";
    }

    if (agentValue >= 13 && agentValue <= 16 && dealerValue >= 2 && dealerValue <= 6) {
      return "stand";
    }

    if (agentValue === 12 && dealerValue >= 4 && dealerValue <= 6) {
      return "stand";
    }

    return "hit";
  }

  getCardValue(card) {
    const rank = card.meta.rank;
    if (rank === 'A') return 11;
    if (['J', 'Q', 'K'].includes(rank)) return 10;
    return parseInt(rank);
  }

  resetCount() {
    this.runningCount = 0;
    this.cardsDealt = 0;
    this.stacksRemaining = 6;
    this.trueCount = 0;
  }

  getCountStats() {
    return {
      runningCount: this.runningCount,
      trueCount: this.trueCount,
      cardsDealt: this.cardsDealt,
      stacksRemaining: this.stacksRemaining.toFixed(1),
      system: "Omega II (multi-level)"
    };
  }
}

/**
 * Zen Count Card Counting Agent
 *
 * Balanced multi-level count system.
 * Good balance between power and practicality.
 *
 * Card Values:
 * - 2, 3, 7: +1
 * - 4, 5, 6: +2
 * - 8, 9: 0
 * - 10, J, Q, K: -2
 * - A: -1
 *
 * Advantages: Powerful and more practical than Omega II
 * Disadvantages: Still multi-level (harder than Hi-Lo)
 */
export class ZenCountAgent {
  constructor(name = "Zen Count", baseBet = 10, spreadMultiplier = 8) {
    this.name = name;
    this.baseBet = baseBet;
    this.spreadMultiplier = spreadMultiplier;
    this.runningCount = 0;
    this.cardsDealt = 0;
    this.stacksRemaining = 6;
    this.trueCount = 0;
  }

  updateCount(card) {
    const rank = card.meta.rank;

    // Zen Count card values (multi-level)
    if (['2', '3', '7'].includes(rank)) {
      this.runningCount += 1;
    } else if (['4', '5', '6'].includes(rank)) {
      this.runningCount += 2;  // Multi-level: +2
    } else if (rank === 'A') {
      this.runningCount -= 1;
    } else if (['10', 'J', 'Q', 'K'].includes(rank)) {
      this.runningCount -= 2;  // Multi-level: -2
    }
    // 8 and 9 are neutral (0)

    this.cardsDealt++;
    this.stacksRemaining = Math.max(1, (312 - this.cardsDealt) / 52);
    this.trueCount = Math.floor(this.runningCount / this.stacksRemaining);
  }

  updateFromGameState(gameState) {
    for (const card of gameState.agentHand.cards) {
      this.updateCount(card);
    }
    const dealerCards = gameState.dealerHand.cards;
    if (gameState.gameOver || gameState.dealerHand.value !== null) {
      for (const card of dealerCards) {
        this.updateCount(card);
      }
    } else if (dealerCards.length > 1) {
      this.updateCount(dealerCards[1]);
    }
  }

  getBetSize(gameState, bettingManager, lastResult) {
    if (this.cardsDealt > 280) {
      this.resetCount();
    }

    // Zen Count betting ramp (adjusted for multi-level)
    let betMultiplier = 1;

    if (this.trueCount >= 7) betMultiplier = this.spreadMultiplier;
    else if (this.trueCount >= 5) betMultiplier = 6;
    else if (this.trueCount >= 3) betMultiplier = 4;
    else if (this.trueCount >= 2) betMultiplier = 2;
    else if (this.trueCount >= 1) betMultiplier = 1.5;

    const betSize = this.baseBet * betMultiplier;
    return Math.min(Math.max(betSize, bettingManager.minBet), bettingManager.maxBet, bettingManager.bankroll);
  }

  decide(gameState) {
    const agentValue = gameState.agentHand.value;
    const dealerUpCard = gameState.dealerHand.cards[1];
    const dealerValue = this.getCardValue(dealerUpCard);

    this.updateFromGameState(gameState);

    if (agentValue >= 17) return "stand";
    if (agentValue <= 11) return "hit";

    // Zen Count deviation: Stand 16 vs 10 at TC +2
    if (agentValue === 16 && dealerValue === 10) {
      return this.trueCount >= 2 ? "stand" : "hit";
    }

    if (agentValue >= 13 && agentValue <= 16 && dealerValue >= 2 && dealerValue <= 6) {
      return "stand";
    }

    if (agentValue === 12 && dealerValue >= 4 && dealerValue <= 6) {
      return "stand";
    }

    return "hit";
  }

  getCardValue(card) {
    const rank = card.meta.rank;
    if (rank === 'A') return 11;
    if (['J', 'Q', 'K'].includes(rank)) return 10;
    return parseInt(rank);
  }

  resetCount() {
    this.runningCount = 0;
    this.cardsDealt = 0;
    this.stacksRemaining = 6;
    this.trueCount = 0;
  }

  getCountStats() {
    return {
      runningCount: this.runningCount,
      trueCount: this.trueCount,
      cardsDealt: this.cardsDealt,
      stacksRemaining: this.stacksRemaining.toFixed(1),
      system: "Zen Count (multi-level)"
    };
  }
}
