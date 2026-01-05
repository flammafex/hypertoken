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

/**
 * KO Count (Knock-Out) Card Counting Agent
 *
 * An UNBALANCED counting system - the running count itself is used
 * for betting decisions, eliminating the need for true count conversion.
 * This makes it easier to use in real casino conditions.
 *
 * Card Values:
 * - 2, 3, 4, 5, 6, 7: +1
 * - 8, 9: 0
 * - 10, J, Q, K, A: -1
 *
 * Key Concept: Uses "key count" and "pivot point" instead of true count.
 * For a 6-deck shoe, the Initial Running Count (IRC) starts at -20.
 * When RC >= 4 (the "pivot"), the player has an advantage.
 *
 * Advantages: No true count conversion needed, simpler to use
 * Disadvantages: Less precise than balanced counts for bet sizing
 */
export class KOCountAgent {
  constructor(name = "KO Count", baseBet = 10, spreadMultiplier = 8, numDecks = 6) {
    this.name = name;
    this.baseBet = baseBet;
    this.spreadMultiplier = spreadMultiplier;
    this.numDecks = numDecks;
    // KO starts with Initial Running Count (IRC) = -4 × (decks - 1)
    // For 6 decks: IRC = -4 × 5 = -20
    this.initialRunningCount = -4 * (numDecks - 1);
    this.runningCount = this.initialRunningCount;
    this.cardsDealt = 0;
    this.pivotPoint = 4; // When RC >= pivot, player has advantage
  }

  updateCount(card) {
    const rank = card.meta.rank;

    // KO Count: 2-7 = +1, 8-9 = 0, 10-A = -1
    if (['2', '3', '4', '5', '6', '7'].includes(rank)) {
      this.runningCount += 1;
    } else if (['10', 'J', 'Q', 'K', 'A'].includes(rank)) {
      this.runningCount -= 1;
    }
    // 8, 9 are neutral (0)

    this.cardsDealt++;
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
    // Reset after shuffle (approximated by cards dealt)
    if (this.cardsDealt > 280) {
      this.resetCount();
    }

    // KO betting ramp based on running count (no true count needed!)
    let betMultiplier = 1;

    // Pivot point is 4 for 6-deck. Above pivot = advantage
    if (this.runningCount >= this.pivotPoint + 8) betMultiplier = this.spreadMultiplier;
    else if (this.runningCount >= this.pivotPoint + 6) betMultiplier = 6;
    else if (this.runningCount >= this.pivotPoint + 4) betMultiplier = 4;
    else if (this.runningCount >= this.pivotPoint + 2) betMultiplier = 2;
    else if (this.runningCount >= this.pivotPoint) betMultiplier = 1.5;
    // Below pivot - minimum bet

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

    // KO deviation: Stand 16 vs 10 when RC >= pivot
    if (agentValue === 16 && dealerValue === 10) {
      return this.runningCount >= this.pivotPoint ? "stand" : "hit";
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
    this.runningCount = this.initialRunningCount;
    this.cardsDealt = 0;
  }

  getCountStats() {
    return {
      runningCount: this.runningCount,
      pivotPoint: this.pivotPoint,
      advantageStatus: this.runningCount >= this.pivotPoint ? "ADVANTAGE" : "no advantage",
      cardsDealt: this.cardsDealt,
      system: "KO Count (unbalanced)"
    };
  }
}

/**
 * Red Seven Card Counting Agent
 *
 * A variant of Hi-Lo that counts red 7s as +1 (like low cards) while
 * black 7s are neutral. This creates an unbalanced count that's
 * slightly more powerful than Hi-Lo while remaining easy to use.
 *
 * Card Values:
 * - 2, 3, 4, 5, 6: +1
 * - Red 7 (hearts, diamonds): +1
 * - Black 7 (spades, clubs): 0
 * - 8, 9: 0
 * - 10, J, Q, K, A: -1
 *
 * Like KO, this is unbalanced - uses running count with a pivot point.
 * For 6 decks, IRC = -12 (since there are 12 extra +1 cards from red 7s)
 *
 * Advantages: Simple like Hi-Lo but unbalanced (no true count needed)
 * Disadvantages: Requires noting card color for 7s
 */
export class RedSevenAgent {
  constructor(name = "Red Seven", baseBet = 10, spreadMultiplier = 8, numDecks = 6) {
    this.name = name;
    this.baseBet = baseBet;
    this.spreadMultiplier = spreadMultiplier;
    this.numDecks = numDecks;
    // IRC = -2 × number of decks (accounts for the extra +1 from red 7s)
    this.initialRunningCount = -2 * numDecks;
    this.runningCount = this.initialRunningCount;
    this.cardsDealt = 0;
    this.pivotPoint = 0; // Pivot is 0 for Red Seven
  }

  updateCount(card) {
    const rank = card.meta.rank;
    const suit = card.meta.suit;

    // Red Seven Count
    if (['2', '3', '4', '5', '6'].includes(rank)) {
      this.runningCount += 1;
    } else if (rank === '7') {
      // Red 7s count +1, black 7s count 0
      if (suit === 'hearts' || suit === 'diamonds') {
        this.runningCount += 1;
      }
      // Black 7s (spades, clubs) are neutral
    } else if (['10', 'J', 'Q', 'K', 'A'].includes(rank)) {
      this.runningCount -= 1;
    }
    // 8, 9, black 7s are neutral (0)

    this.cardsDealt++;
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

    // Red Seven betting ramp based on running count
    let betMultiplier = 1;

    if (this.runningCount >= this.pivotPoint + 10) betMultiplier = this.spreadMultiplier;
    else if (this.runningCount >= this.pivotPoint + 7) betMultiplier = 6;
    else if (this.runningCount >= this.pivotPoint + 5) betMultiplier = 4;
    else if (this.runningCount >= this.pivotPoint + 3) betMultiplier = 2;
    else if (this.runningCount >= this.pivotPoint + 1) betMultiplier = 1.5;

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

    // Red Seven deviation: Stand 16 vs 10 when RC >= pivot + 2
    if (agentValue === 16 && dealerValue === 10) {
      return this.runningCount >= this.pivotPoint + 2 ? "stand" : "hit";
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
    this.runningCount = this.initialRunningCount;
    this.cardsDealt = 0;
  }

  getCountStats() {
    return {
      runningCount: this.runningCount,
      pivotPoint: this.pivotPoint,
      advantageStatus: this.runningCount >= this.pivotPoint ? "ADVANTAGE" : "no advantage",
      cardsDealt: this.cardsDealt,
      system: "Red Seven (unbalanced)"
    };
  }
}

/**
 * Wong Halves Card Counting Agent
 *
 * One of the most accurate counting systems, using half-point values
 * for maximum precision. Balanced count requiring true count conversion.
 *
 * Card Values:
 * - 2: +0.5
 * - 3, 4, 6: +1
 * - 5: +1.5
 * - 7: +0.5
 * - 8: 0
 * - 9: -0.5
 * - 10, J, Q, K, A: -1
 *
 * Implementation: Internally uses doubled values to avoid floating point:
 * 2=+1, 3=+2, 4=+2, 5=+3, 6=+2, 7=+1, 8=0, 9=-1, 10-A=-2
 * Then divides by 2 when calculating true count.
 *
 * Advantages: Highest accuracy of single-level counts
 * Disadvantages: Half values are harder to track mentally
 */
export class WongHalvesAgent {
  constructor(name = "Wong Halves", baseBet = 10, spreadMultiplier = 8) {
    this.name = name;
    this.baseBet = baseBet;
    this.spreadMultiplier = spreadMultiplier;
    // Use doubled values internally to avoid floating point
    this.runningCountDoubled = 0;
    this.cardsDealt = 0;
    this.stacksRemaining = 6;
    this.trueCount = 0;
  }

  updateCount(card) {
    const rank = card.meta.rank;

    // Wong Halves (doubled to avoid fractions)
    // Actual: 2=+0.5, 3=+1, 4=+1, 5=+1.5, 6=+1, 7=+0.5, 8=0, 9=-0.5, 10-A=-1
    // Doubled: 2=+1, 3=+2, 4=+2, 5=+3, 6=+2, 7=+1, 8=0, 9=-1, 10-A=-2
    switch (rank) {
      case '2':
        this.runningCountDoubled += 1;  // +0.5 doubled
        break;
      case '3':
      case '4':
      case '6':
        this.runningCountDoubled += 2;  // +1 doubled
        break;
      case '5':
        this.runningCountDoubled += 3;  // +1.5 doubled
        break;
      case '7':
        this.runningCountDoubled += 1;  // +0.5 doubled
        break;
      case '9':
        this.runningCountDoubled -= 1;  // -0.5 doubled
        break;
      case '10':
      case 'J':
      case 'Q':
      case 'K':
      case 'A':
        this.runningCountDoubled -= 2;  // -1 doubled
        break;
      // 8 is neutral (0)
    }

    this.cardsDealt++;
    this.stacksRemaining = Math.max(1, (312 - this.cardsDealt) / 52);
    // Divide by 2 to get actual running count, then by decks for true count
    const actualRunningCount = this.runningCountDoubled / 2;
    this.trueCount = Math.floor(actualRunningCount / this.stacksRemaining);
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

    // Wong Halves betting ramp
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

    // Wong Halves deviation: Stand 16 vs 10 at TC >= 0 (more sensitive due to precision)
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
    this.runningCountDoubled = 0;
    this.cardsDealt = 0;
    this.stacksRemaining = 6;
    this.trueCount = 0;
  }

  getCountStats() {
    return {
      runningCount: (this.runningCountDoubled / 2).toFixed(1),
      trueCount: this.trueCount,
      cardsDealt: this.cardsDealt,
      stacksRemaining: this.stacksRemaining.toFixed(1),
      system: "Wong Halves (half-point precision)"
    };
  }
}
