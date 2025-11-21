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