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
    this.insuranceBet = 0;
    this.splitBets = []; // Array of bets for split hands
    this.minBet = options.minBet || 5;
    this.maxBet = options.maxBet || 500;

    // Session statistics
    this.stats = {
      handsPlayed: 0,
      handsWon: 0,
      handsLost: 0,
      handsPushed: 0,
      blackjacks: 0,
      splits: 0,
      doubles: 0,
      insurances: 0,
      insuranceWins: 0,
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
    // Validate bet amount is a valid number
    if (!Number.isFinite(amount)) {
      throw new Error('Invalid bet amount');
    }
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
   * Place an insurance bet (up to half the original bet)
   * @param {number} amount - Insurance bet amount
   * @returns {boolean} - Success status
   */
  placeInsurance(amount = null) {
    // Default to half the current bet
    const insuranceAmount = amount !== null ? amount : this.currentBet / 2;

    // Validate insurance bet
    if (insuranceAmount > this.currentBet / 2) {
      throw new Error(`Insurance bet cannot exceed half of original bet ($${this.currentBet / 2})`);
    }
    if (insuranceAmount > this.bankroll) {
      throw new Error(`Insufficient funds for insurance. Bankroll: ${this.bankroll}`);
    }

    this.insuranceBet = insuranceAmount;
    this.bankroll -= insuranceAmount;
    this.stats.totalWagered += insuranceAmount;
    this.stats.insurances++;

    return true;
  }

  /**
   * Resolve insurance bet
   * @param {boolean} dealerHasBlackjack - Whether dealer has blackjack
   * @returns {number} - Payout amount
   */
  resolveInsurance(dealerHasBlackjack) {
    if (this.insuranceBet === 0) return 0;

    let payout = 0;
    if (dealerHasBlackjack) {
      // Insurance pays 2:1
      payout = this.insuranceBet * 3; // Original bet + 2:1 payout
      this.stats.insuranceWins++;
      this.stats.totalWon += this.insuranceBet * 2;
    }

    this.bankroll += payout;
    const insuranceBetAmount = this.insuranceBet;
    this.insuranceBet = 0;

    return dealerHasBlackjack ? insuranceBetAmount * 2 : -insuranceBetAmount;
  }

  /**
   * Double down - double the current bet
   * @returns {boolean} - Success status
   */
  doubleDown() {
    const doubleAmount = this.currentBet;

    if (doubleAmount > this.bankroll) {
      throw new Error(`Insufficient funds to double down. Bankroll: ${this.bankroll}`);
    }

    this.bankroll -= doubleAmount;
    this.currentBet *= 2;
    this.stats.totalWagered += doubleAmount;
    this.stats.doubles++;

    return true;
  }

  /**
   * Split hand - place additional bet equal to original
   * @returns {boolean} - Success status
   */
  split() {
    const splitAmount = this.currentBet;

    if (splitAmount > this.bankroll) {
      throw new Error(`Insufficient funds to split. Bankroll: ${this.bankroll}`);
    }

    this.bankroll -= splitAmount;
    this.splitBets.push(splitAmount);
    this.stats.totalWagered += splitAmount;
    this.stats.splits++;

    return true;
  }

  /**
   * Resolve bet for a split hand
   * @param {number} handIndex - Index of the split hand (0 = original, 1+ = split hands)
   * @param {string} result - Game result
   * @returns {object} - Payout details
   */
  resolveSplitHand(handIndex, result) {
    const bet = handIndex === 0 ? this.currentBet : this.splitBets[handIndex - 1];
    const payout = this.calculatePayoutForBet(result, bet);
    const netGain = payout - bet;

    this.bankroll += payout;

    // Update statistics (but don't count as separate hands)
    if (result === "agent-blackjack" || result === "agent") {
      this.stats.totalWon += netGain;
      if (netGain > this.stats.biggestWin) {
        this.stats.biggestWin = netGain;
      }
    } else if (result === "dealer") {
      this.stats.totalLost += bet;
      if (bet > this.stats.biggestLoss) {
        this.stats.biggestLoss = bet;
      }
    }

    if (this.bankroll > this.stats.maxBankroll) {
      this.stats.maxBankroll = this.bankroll;
    }
    if (this.bankroll < this.stats.minBankroll) {
      this.stats.minBankroll = this.bankroll;
    }

    return {
      handIndex,
      result,
      bet,
      payout,
      netGain
    };
  }

  /**
   * Calculate payout for a specific bet amount
   * @param {string} result - Game result
   * @param {number} betAmount - Bet amount
   * @returns {number} - Payout amount
   */
  calculatePayoutForBet(result, betAmount) {
    switch (result) {
      case "agent-blackjack":
        return betAmount + (betAmount * 1.5);
      case "agent":
        return betAmount * 2;
      case "push":
        return betAmount;
      case "dealer":
      default:
        return 0;
    }
  }

  /**
   * Clear split bets after round ends
   */
  clearSplitBets() {
    this.splitBets = [];
    this.currentBet = 0;
    this.insuranceBet = 0;
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
    this.insuranceBet = 0;
    this.splitBets = [];
    this.stats = {
      handsPlayed: 0,
      handsWon: 0,
      handsLost: 0,
      handsPushed: 0,
      blackjacks: 0,
      splits: 0,
      doubles: 0,
      insurances: 0,
      insuranceWins: 0,
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
  const insuranceWinRate = stats.insurances > 0
    ? ((stats.insuranceWins / stats.insurances) * 100).toFixed(1)
    : 0;

  return `
╔═══════════════════════════════════════════════════╗
║              SESSION STATISTICS                    ║
╚═══════════════════════════════════════════════════╝

🎲 Hands Played:     ${stats.handsPlayed}
✅ Hands Won:        ${stats.handsWon} (${stats.winRate}%)
❌ Hands Lost:       ${stats.handsLost}
🤝 Pushes:           ${stats.handsPushed}
🎰 Blackjacks:       ${stats.blackjacks}

🎯 Advanced Plays:
   💎 Doubles:       ${stats.doubles}
   ✂️  Splits:        ${stats.splits}
   🛡️  Insurances:    ${stats.insurances} (${insuranceWinRate}% won)

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

/**
 * Kelly Criterion Strategy - Optimal bet sizing based on edge
 *
 * The Kelly Criterion calculates the optimal fraction of bankroll to wager
 * based on the player's edge. Commonly used with card counting where the
 * true count indicates the player's advantage.
 *
 * Formula: f* = edge / variance
 * Where edge is player advantage (e.g., +1% = 0.01)
 */
export class KellyCriterionStrategy extends BettingStrategy {
  constructor(baseEdge = 0.005, countMultiplier = 0.005) {
    super("Kelly Criterion");
    this.baseEdge = baseEdge; // Base edge (small positive edge)
    this.countMultiplier = countMultiplier; // How much each +1 true count adds to edge
    this.variance = 1.33; // Blackjack variance (standard)
    this.fractionOfKelly = 0.5; // Use half-Kelly for safety (reduces risk)
  }

  getBetSize(gameState, bettingManager, lastResult = null, trueCount = 0) {
    // Calculate edge based on true count
    // True count of +1 ≈ +0.5% edge, +2 ≈ +1%, etc.
    const edge = this.baseEdge + (trueCount * this.countMultiplier);

    // If no edge, bet minimum
    if (edge <= 0) {
      return bettingManager.minBet;
    }

    // Kelly formula: optimal bet = (edge / variance) * bankroll
    const kellyFraction = edge / this.variance;
    const fullKellyBet = kellyFraction * bettingManager.bankroll;

    // Use fractional Kelly (safer)
    const safeBet = fullKellyBet * this.fractionOfKelly;

    // Clamp to table limits
    return Math.max(
      bettingManager.minBet,
      Math.min(
        Math.floor(safeBet),
        bettingManager.maxBet,
        bettingManager.bankroll
      )
    );
  }

  /**
   * Set the fraction of Kelly to use (0.5 = half-Kelly, 1.0 = full Kelly)
   * Half-Kelly is recommended for reduced variance
   */
  setKellyFraction(fraction) {
    this.fractionOfKelly = Math.max(0.1, Math.min(1.0, fraction));
  }
}

/**
 * Oscar's Grind Strategy - Progressive system with profit targets
 *
 * A low-risk progressive betting system designed to grind out small profits.
 * The goal is to win one unit profit per cycle. After each win that brings
 * session profit to target, reset to base bet. Increase bet by one unit after
 * wins (but never exceeding target profit), keep same bet after losses.
 *
 * Example cycle (base bet = $5):
 * - Bet $5, lose (-$5 session)
 * - Bet $5, lose (-$10 session)
 * - Bet $5, win (-$5 session)
 * - Bet $10, win (+$5 session) ← target reached, reset
 */
export class OscarsGrindStrategy extends BettingStrategy {
  constructor(baseBet = 5, targetProfit = null) {
    super("Oscar's Grind");
    this.baseBet = baseBet;
    this.targetProfit = targetProfit || baseBet; // Default target = 1 unit
    this.currentBet = baseBet;
    this.sessionProfit = 0;
    this.cycleCount = 0;
  }

  getBetSize(gameState, bettingManager, lastResult = null) {
    // Process last result
    if (lastResult) {
      this.sessionProfit += lastResult.netGain;

      // If we've reached or exceeded target profit, reset cycle
      if (this.sessionProfit >= this.targetProfit) {
        this.currentBet = this.baseBet;
        this.sessionProfit = 0;
        this.cycleCount++;
        return Math.min(this.currentBet, bettingManager.maxBet, bettingManager.bankroll);
      }

      // After a win (but not at target): increase bet by one unit
      if (lastResult.result === "agent" || lastResult.result === "agent-blackjack") {
        // Don't increase bet beyond what's needed to reach target
        const remainingToTarget = this.targetProfit - this.sessionProfit;
        const maxIncrease = Math.min(this.baseBet, remainingToTarget);

        this.currentBet = Math.min(
          this.currentBet + this.baseBet,
          this.baseBet + maxIncrease
        );
      }
      // After loss: keep same bet (grind it out)
      // After push: keep same bet
    }

    // Clamp to table limits
    return Math.max(
      bettingManager.minBet,
      Math.min(
        this.currentBet,
        bettingManager.maxBet,
        bettingManager.bankroll
      )
    );
  }

  /**
   * Get current cycle statistics
   */
  getStats() {
    return {
      cycleCount: this.cycleCount,
      currentProfit: this.sessionProfit,
      targetProfit: this.targetProfit,
      currentBet: this.currentBet
    };
  }

  /**
   * Reset the cycle (useful for testing or manual reset)
   */
  resetCycle() {
    this.currentBet = this.baseBet;
    this.sessionProfit = 0;
  }
}

/**
 * D'Alembert Strategy - Linear progression system
 *
 * A safer alternative to Martingale that uses linear instead of exponential
 * progression. After each loss, increase bet by one unit. After each win,
 * decrease bet by one unit (but never below base bet).
 *
 * The system is based on the gambler's fallacy that wins and losses will
 * eventually balance out. While mathematically flawed, it's much safer
 * than Martingale due to slower bet growth.
 *
 * Example (base bet = $10, unit = $10):
 * - Bet $10, lose → next bet $20
 * - Bet $20, lose → next bet $30
 * - Bet $30, win  → next bet $20
 * - Bet $20, win  → next bet $10
 */
export class DAlembertStrategy extends BettingStrategy {
  constructor(baseBet = 10, unit = null) {
    super("D'Alembert");
    this.baseBet = baseBet;
    this.unit = unit || baseBet; // Default unit equals base bet
    this.currentBet = baseBet;
  }

  getBetSize(gameState, bettingManager, lastResult = null) {
    if (lastResult === null) {
      // First bet of session
      this.currentBet = this.baseBet;
    } else if (lastResult.result === "dealer") {
      // Lost - increase bet by one unit
      this.currentBet += this.unit;
    } else if (lastResult.result === "agent" || lastResult.result === "agent-blackjack") {
      // Won - decrease bet by one unit (but not below base)
      this.currentBet = Math.max(this.baseBet, this.currentBet - this.unit);
    }
    // Push - keep same bet

    // Clamp to table limits and bankroll
    return Math.max(
      bettingManager.minBet,
      Math.min(
        this.currentBet,
        bettingManager.maxBet,
        bettingManager.bankroll
      )
    );
  }

  /**
   * Reset to base bet (useful for starting a new session)
   */
  reset() {
    this.currentBet = this.baseBet;
  }

  /**
   * Get current strategy state
   */
  getStats() {
    return {
      currentBet: this.currentBet,
      baseBet: this.baseBet,
      unit: this.unit,
      levelsAboveBase: Math.floor((this.currentBet - this.baseBet) / this.unit)
    };
  }
}

/**
 * Fibonacci Strategy - Fibonacci sequence progression
 *
 * Uses the Fibonacci sequence (1, 1, 2, 3, 5, 8, 13, 21, 34, ...) for bet
 * progression. After a loss, move one step forward in the sequence. After
 * a win, move two steps back (or to the beginning if less than 2 steps in).
 *
 * Less aggressive than Martingale but can still reach high bet amounts.
 * The sequence grows more slowly (exponential but with smaller base).
 *
 * Example (unit = $10):
 * - Position 0: Bet $10 (1×), lose → move to position 1
 * - Position 1: Bet $10 (1×), lose → move to position 2
 * - Position 2: Bet $20 (2×), lose → move to position 3
 * - Position 3: Bet $30 (3×), win  → move back to position 1
 * - Position 1: Bet $10 (1×), win  → stay at position 0
 */
export class FibonacciStrategy extends BettingStrategy {
  constructor(unitBet = 10) {
    super("Fibonacci");
    this.unitBet = unitBet;
    this.position = 0;
    // Pre-calculate Fibonacci sequence (enough for practical use)
    this.sequence = this._generateSequence(20);
  }

  /**
   * Generate Fibonacci sequence up to n terms
   */
  _generateSequence(n) {
    const seq = [1, 1];
    for (let i = 2; i < n; i++) {
      seq.push(seq[i - 1] + seq[i - 2]);
    }
    return seq;
  }

  getBetSize(gameState, bettingManager, lastResult = null) {
    if (lastResult === null) {
      // First bet of session - start at beginning
      this.position = 0;
    } else if (lastResult.result === "dealer") {
      // Lost - move one step forward in sequence
      this.position = Math.min(this.position + 1, this.sequence.length - 1);
    } else if (lastResult.result === "agent" || lastResult.result === "agent-blackjack") {
      // Won - move two steps back (or to beginning)
      this.position = Math.max(0, this.position - 2);
    }
    // Push - keep same position

    // Calculate bet amount
    const multiplier = this.sequence[this.position];
    const betAmount = this.unitBet * multiplier;

    // Clamp to table limits and bankroll
    return Math.max(
      bettingManager.minBet,
      Math.min(
        betAmount,
        bettingManager.maxBet,
        bettingManager.bankroll
      )
    );
  }

  /**
   * Reset to beginning of sequence
   */
  reset() {
    this.position = 0;
  }

  /**
   * Get current strategy state
   */
  getStats() {
    return {
      position: this.position,
      currentMultiplier: this.sequence[this.position],
      currentBetUnits: this.sequence[this.position],
      unitBet: this.unitBet,
      sequence: this.sequence.slice(0, 10) // First 10 for display
    };
  }
}

/**
 * Labouchere Strategy - Cancellation/Split Martingale system
 *
 * Also known as the "cancellation system" or "split Martingale". The player
 * starts with a sequence of numbers (default: 1-2-3-4). Each bet is the sum
 * of the first and last numbers. On a win, cross off both numbers. On a loss,
 * add the lost amount to the end of the sequence. The cycle completes when
 * all numbers are crossed off, resulting in a profit equal to the sum of
 * the original sequence.
 *
 * Example (unit = $5, sequence = [1, 2, 3, 4]):
 * - Bet $25 (1+4=5 units), lose → sequence becomes [1, 2, 3, 4, 5]
 * - Bet $30 (1+5=6 units), win  → sequence becomes [2, 3, 4]
 * - Bet $30 (2+4=6 units), win  → sequence becomes [3]
 * - Bet $15 (3 units), win      → sequence empty, cycle complete!
 * - Total profit = (1+2+3+4) × $5 = $50
 *
 * Risk: Losing streaks can make the sequence grow very long.
 */
export class LabouchereStrategy extends BettingStrategy {
  constructor(unitBet = 5, initialSequence = [1, 2, 3, 4]) {
    super("Labouchere");
    this.unitBet = unitBet;
    this.initialSequence = [...initialSequence];
    this.sequence = [...initialSequence];
    this.cycleCount = 0;
    this.lastBetUnits = 0;
  }

  getBetSize(gameState, bettingManager, lastResult = null) {
    // Process previous result
    if (lastResult !== null && lastResult.result !== "push") {
      if (lastResult.result === "agent" || lastResult.result === "agent-blackjack") {
        // Won - remove first and last numbers from sequence
        if (this.sequence.length > 1) {
          this.sequence.shift(); // Remove first
          this.sequence.pop();   // Remove last
        } else if (this.sequence.length === 1) {
          this.sequence.shift(); // Remove the only number
        }

        // Check if cycle is complete
        if (this.sequence.length === 0) {
          this.cycleCount++;
          this.sequence = [...this.initialSequence]; // Start new cycle
        }
      } else if (lastResult.result === "dealer") {
        // Lost - add the bet amount (in units) to end of sequence
        this.sequence.push(this.lastBetUnits);
      }
    }

    // Calculate bet: sum of first and last numbers (or just the number if only one)
    let betUnits;
    if (this.sequence.length === 0) {
      // Shouldn't happen, but handle gracefully
      this.sequence = [...this.initialSequence];
      betUnits = this.sequence[0] + this.sequence[this.sequence.length - 1];
    } else if (this.sequence.length === 1) {
      betUnits = this.sequence[0];
    } else {
      betUnits = this.sequence[0] + this.sequence[this.sequence.length - 1];
    }

    this.lastBetUnits = betUnits;
    const betAmount = betUnits * this.unitBet;

    // Clamp to table limits and bankroll
    return Math.max(
      bettingManager.minBet,
      Math.min(
        betAmount,
        bettingManager.maxBet,
        bettingManager.bankroll
      )
    );
  }

  /**
   * Reset to initial sequence
   */
  reset() {
    this.sequence = [...this.initialSequence];
    this.lastBetUnits = 0;
  }

  /**
   * Get current strategy state
   */
  getStats() {
    const targetProfit = this.initialSequence.reduce((a, b) => a + b, 0) * this.unitBet;
    return {
      sequence: [...this.sequence],
      sequenceLength: this.sequence.length,
      cycleCount: this.cycleCount,
      unitBet: this.unitBet,
      targetProfitPerCycle: targetProfit,
      nextBetUnits: this.sequence.length === 1
        ? this.sequence[0]
        : (this.sequence[0] + this.sequence[this.sequence.length - 1])
    };
  }

  /**
   * Set a custom sequence (for advanced users)
   */
  setSequence(newSequence) {
    if (!Array.isArray(newSequence) || newSequence.length === 0) {
      throw new Error("Sequence must be a non-empty array of positive numbers");
    }
    if (!newSequence.every(n => Number.isFinite(n) && n > 0)) {
      throw new Error("All sequence values must be positive numbers");
    }
    this.initialSequence = [...newSequence];
    this.sequence = [...newSequence];
  }
}
