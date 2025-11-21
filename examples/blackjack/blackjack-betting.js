/**
 * Blackjack Betting System
 * 
 * Adds comprehensive betting functionality to HyperToken Blackjack:
 * - Bankroll/chip tracking
 * - Bet placement and validation
 * - Payout calculations (3:2 for blackjack, 1:1 for wins, push returns bet)
 * - Bet sizing constraints
 * - Session statistics
 */

import { ActionRegistry } from '../../engine/actions.js';

/**
 * BettingManager - Handles all betting operations
 */
export class BettingManager {
  constructor(initialBankroll = 1000, options = {}) {
    this.initialBankroll = initialBankroll;
    this.bankroll = initialBankroll;
    this.currentBet = 0;
    this.minBet = options.minBet || 5;
    this.maxBet = options.maxBet || 500;
    
    // Session statistics
    this.stats = {
      handsPlayed: 0,
      handsWon: 0,
      handsLost: 0,
      handsPushed: 0,
      blackjacks: 0,
      totalWagered: 0,
      totalWon: 0,
      totalLost: 0,
      biggestWin: 0,
      biggestLoss: 0,
      maxBankroll: initialBankroll,
      minBankroll: initialBankroll
    };
  }
  
  /**
   * Place a bet for the current round
   * @param {number} amount - Bet amount
   * @returns {boolean} - Success status
   */
  placeBet(amount) {
    // Validate bet amount
    if (amount < this.minBet) {
      throw new Error(`Minimum bet is ${this.minBet}`);
    }
    if (amount > this.maxBet) {
      throw new Error(`Maximum bet is ${this.maxBet}`);
    }
    if (amount > this.bankroll) {
      throw new Error(`Insufficient funds. Bankroll: ${this.bankroll}`);
    }
    
    // Place the bet
    this.currentBet = amount;
    this.bankroll -= amount;
    this.stats.totalWagered += amount;
    
    return true;
  }
  
  /**
   * Calculate payout based on result
   * @param {string} result - Game result ("agent", "agent-blackjack", "dealer", "push")
   * @returns {number} - Payout amount (including original bet if won/push)
   */
  calculatePayout(result) {
    switch (result) {
      case "agent-blackjack":
        // Blackjack pays 3:2
        return this.currentBet + (this.currentBet * 1.5);
      
      case "agent":
        // Regular win pays 1:1
        return this.currentBet * 2;
      
      case "push":
        // Push returns original bet
        return this.currentBet;
      
      case "dealer":
      default:
        // Loss - no payout
        return 0;
    }
  }
  
  /**
   * Resolve the bet and update bankroll
   * @param {string} result - Game result
   * @returns {object} - Payout details
   */
  resolveBet(result) {
    const payout = this.calculatePayout(result);
    const netGain = payout - this.currentBet;
    
    // Update bankroll
    this.bankroll += payout;
    
    // Update statistics
    this.stats.handsPlayed++;
    
    if (result === "agent-blackjack") {
      this.stats.handsWon++;
      this.stats.blackjacks++;
      this.stats.totalWon += netGain;
      if (netGain > this.stats.biggestWin) {
        this.stats.biggestWin = netGain;
      }
    } else if (result === "agent") {
      this.stats.handsWon++;
      this.stats.totalWon += netGain;
      if (netGain > this.stats.biggestWin) {
        this.stats.biggestWin = netGain;
      }
    } else if (result === "push") {
      this.stats.handsPushed++;
    } else {
      this.stats.handsLost++;
      this.stats.totalLost += this.currentBet;
      if (this.currentBet > this.stats.biggestLoss) {
        this.stats.biggestLoss = this.currentBet;
      }
    }
    
    // Track bankroll extremes
    if (this.bankroll > this.stats.maxBankroll) {
      this.stats.maxBankroll = this.bankroll;
    }
    if (this.bankroll < this.stats.minBankroll) {
      this.stats.minBankroll = this.bankroll;
    }
    
    const payoutDetails = {
      result,
      bet: this.currentBet,
      payout,
      netGain,
      bankroll: this.bankroll
    };
    
    // Reset current bet
    this.currentBet = 0;
    
    return payoutDetails;
  }
  
  /**
   * Check if agent can afford a bet
   * @param {number} amount - Bet amount to check
   * @returns {boolean}
   */
  canAffordBet(amount) {
    return amount >= this.minBet && 
           amount <= this.maxBet && 
           amount <= this.bankroll;
  }
  
  /**
   * Check if agent is broke
   * @returns {boolean}
   */
  isBroke() {
    return this.bankroll < this.minBet;
  }
  
  /**
   * Get formatted betting status
   * @returns {string}
   */
  getStatus() {
    return `💰 Bankroll: $${this.bankroll.toFixed(2)} | Current Bet: $${this.currentBet.toFixed(2)}`;
  }
  
  /**
   * Get session statistics
   * @returns {object}
   */
  getStats() {
    const netProfit = this.bankroll - this.initialBankroll;
    const winRate = this.stats.handsPlayed > 0 
      ? (this.stats.handsWon / this.stats.handsPlayed * 100).toFixed(2)
      : 0;
    
    return {
      ...this.stats,
      netProfit,
      winRate: parseFloat(winRate),
      currentBankroll: this.bankroll
    };
  }
  
  /**
   * Reset for new session
   * @param {number} newBankroll - Optional new starting bankroll
   */
  reset(newBankroll = null) {
    this.bankroll = newBankroll !== null ? newBankroll : this.initialBankroll;
    this.currentBet = 0;
    this.stats = {
      handsPlayed: 0,
      handsWon: 0,
      handsLost: 0,
      handsPushed: 0,
      blackjacks: 0,
      totalWagered: 0,
      totalWon: 0,
      totalLost: 0,
      biggestWin: 0,
      biggestLoss: 0,
      maxBankroll: this.bankroll,
      minBankroll: this.bankroll
    };
  }
}

/**
 * Extend ActionRegistry with betting actions
 */
export function registerBettingActions() {
  Object.assign(ActionRegistry, {
    "blackjack:place-bet": (engine, payload) => {
      const { amount } = payload;
      if (!engine._bettingManager) {
        throw new Error("BettingManager not initialized");
      }
      
      engine._bettingManager.placeBet(amount);
      engine._gameState.currentBet = amount;
    },
    
    "blackjack:resolve-bet": (engine) => {
      if (!engine._bettingManager) {
        throw new Error("BettingManager not initialized");
      }
      
      const result = engine._gameState.result;
      if (!result) {
        throw new Error("Cannot resolve bet: no result yet");
      }
      
      const payoutDetails = engine._bettingManager.resolveBet(result);
      engine._gameState.payout = payoutDetails;
      
      return payoutDetails;
    },
    
    "blackjack:check-bankroll": (engine) => {
      if (!engine._bettingManager) {
        throw new Error("BettingManager not initialized");
      }
      
      return {
        bankroll: engine._bettingManager.bankroll,
        currentBet: engine._bettingManager.currentBet,
        canContinue: !engine._bettingManager.isBroke()
      };
    }
  });
}

/**
 * Get formatted payout message
 * @param {object} payoutDetails - Payout details from resolveBet
 * @returns {string}
 */
export function getPayoutMessage(payoutDetails) {
  const { result, bet, payout, netGain, bankroll } = payoutDetails;
  
  let message = '';
  
  switch (result) {
    case "agent-blackjack":
      message = `🎰 BLACKJACK! You bet $${bet.toFixed(2)} and won $${netGain.toFixed(2)} (3:2 payout)`;
      break;
    
    case "agent":
      message = `🎉 YOU WIN! You bet $${bet.toFixed(2)} and won $${netGain.toFixed(2)}`;
      break;
    
    case "push":
      message = `🤝 PUSH - Your bet of $${bet.toFixed(2)} is returned`;
      break;
    
    case "dealer":
      message = `😞 YOU LOSE - You lost your bet of $${bet.toFixed(2)}`;
      break;
  }
  
  message += `\n💰 New bankroll: $${bankroll.toFixed(2)}`;
  
  return message;
}

/**
 * Format session statistics for display
 * @param {object} stats - Statistics from BettingManager.getStats()
 * @returns {string}
 */
export function formatSessionStats(stats) {
  const profitSign = stats.netProfit >= 0 ? '+' : '';
  const profitColor = stats.netProfit >= 0 ? '💚' : '💔';
  
  return `
╔═══════════════════════════════════════════════════╗
║              SESSION STATISTICS                    ║
╚═══════════════════════════════════════════════════╝

🎲 Hands Played:     ${stats.handsPlayed}
✅ Hands Won:        ${stats.handsWon} (${stats.winRate}%)
❌ Hands Lost:       ${stats.handsLost}
🤝 Pushes:           ${stats.handsPushed}
🎰 Blackjacks:       ${stats.blackjacks}

💵 Total Wagered:    $${stats.totalWagered.toFixed(2)}
📈 Total Won:        $${stats.totalWon.toFixed(2)}
📉 Total Lost:       $${stats.totalLost.toFixed(2)}

🏆 Biggest Win:      $${stats.biggestWin.toFixed(2)}
💸 Biggest Loss:     $${stats.biggestLoss.toFixed(2)}

💰 Current Bankroll: $${stats.currentBankroll.toFixed(2)}
${profitColor} Net Profit:      ${profitSign}$${stats.netProfit.toFixed(2)}

📊 Peak Bankroll:    $${stats.maxBankroll.toFixed(2)}
📉 Lowest Bankroll:  $${stats.minBankroll.toFixed(2)}
`;
}

/**
 * Betting Strategy Interface
 * Base class for implementing betting strategies
 */
export class BettingStrategy {
  constructor(name) {
    this.name = name;
  }
  
  /**
   * Determine bet size for next round
   * @param {object} gameState - Current game state
   * @param {BettingManager} bettingManager - Betting manager instance
   * @param {object} lastResult - Previous round result (optional)
   * @returns {number} - Bet amount
   */
  getBetSize(gameState, bettingManager, lastResult = null) {
    // Default: minimum bet
    return bettingManager.minBet;
  }
}

/**
 * Flat Betting Strategy - Always bet the same amount
 */
export class FlatBettingStrategy extends BettingStrategy {
  constructor(betAmount) {
    super("Flat Betting");
    this.betAmount = betAmount;
  }
  
  getBetSize(gameState, bettingManager) {
    return Math.min(this.betAmount, bettingManager.maxBet, bettingManager.bankroll);
  }
}

/**
 * Martingale Strategy - Double bet after loss
 */
export class MartingaleStrategy extends BettingStrategy {
  constructor(baseBet = 5) {
    super("Martingale");
    this.baseBet = baseBet;
    this.currentBet = baseBet;
  }
  
  getBetSize(gameState, bettingManager, lastResult) {
    if (lastResult === null) {
      this.currentBet = this.baseBet;
    } else if (lastResult.result === "dealer") {
      // Lost - double the bet
      this.currentBet = Math.min(
        this.currentBet * 2,
        bettingManager.maxBet,
        bettingManager.bankroll
      );
    } else if (lastResult.result === "agent" || lastResult.result === "agent-blackjack") {
      // Won - reset to base bet
      this.currentBet = this.baseBet;
    }
    // Push - keep same bet
    
    return this.currentBet;
  }
}

/**
 * Percentage Betting Strategy - Bet a percentage of bankroll
 */
export class PercentageBettingStrategy extends BettingStrategy {
  constructor(percentage = 0.02) {
    super(`${(percentage * 100).toFixed(0)}% Bankroll`);
    this.percentage = percentage;
  }
  
  getBetSize(gameState, bettingManager) {
    const betAmount = Math.floor(bettingManager.bankroll * this.percentage);
    return Math.max(
      bettingManager.minBet,
      Math.min(betAmount, bettingManager.maxBet)
    );
  }
}

/**
 * Progressive Betting Strategy - Increase bet after wins
 */
export class ProgressiveBettingStrategy extends BettingStrategy {
  constructor(baseBet = 5, increaseAmount = 5, maxProgression = 50) {
    super("Progressive");
    this.baseBet = baseBet;
    this.increaseAmount = increaseAmount;
    this.maxProgression = maxProgression;
    this.currentBet = baseBet;
  }
  
  getBetSize(gameState, bettingManager, lastResult) {
    if (lastResult === null) {
      this.currentBet = this.baseBet;
    } else if (lastResult.result === "agent" || lastResult.result === "agent-blackjack") {
      // Won - increase bet
      this.currentBet = Math.min(
        this.currentBet + this.increaseAmount,
        this.maxProgression,
        bettingManager.maxBet,
        bettingManager.bankroll
      );
    } else if (lastResult.result === "dealer") {
      // Lost - reset to base bet
      this.currentBet = this.baseBet;
    }
    // Push - keep same bet
    
    return this.currentBet;
  }
}
