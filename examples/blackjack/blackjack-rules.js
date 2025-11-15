/**
 * Blackjack Rules for HyperToken RuleEngine
 */

import { isBusted, isBlackjack, getBestHandValue } from './blackjack-utils.js';

/**
 * Create blackjack rules for the engine
 * @param {RuleEngine} ruleEngine
 */
export function registerBlackjackRules(ruleEngine) {
  
  // Rule: Auto-check for player bust after hit
  ruleEngine.addRule(
    "player-bust-check",
    (engine, lastAction) => {
      if (!lastAction || lastAction.type !== "blackjack:hit") return false;
      const playerHand = engine.table.zone("player-hand");
      if (!playerHand || playerHand.length === 0) return false;
      const cards = playerHand.map(p => p.card);
      return isBusted(cards);
    },
    (engine) => {
      engine.dispatch("blackjack:player-busted", {});
    },
    { priority: 100, once: false }
  );
  
  // Rule: Auto-check for blackjack on deal
  ruleEngine.addRule(
    "blackjack-check",
    (engine, lastAction) => {
      if (!lastAction || lastAction.type !== "blackjack:deal") return false;
      const playerHand = engine.table.zone("player-hand");
      if (!playerHand || playerHand.length !== 2) return false;
      const cards = playerHand.map(p => p.card);
      return isBlackjack(cards);
    },
    (engine) => {
      engine.dispatch("blackjack:player-blackjack", {});
    },
    { priority: 90, once: false }
  );
  
  // Rule: Dealer must hit on 16 or less
  ruleEngine.addRule(
    "dealer-must-hit",
    (engine) => {
      const dealerHand = engine.table.zone("dealer-hand");
      if (!dealerHand || dealerHand.length === 0) return false;
      const cards = dealerHand.map(p => p.card);
      const value = getBestHandValue(cards);
      return value < 17 && engine._gameState?.dealerTurn === true;
    },
    (engine) => {
      engine.dispatch("blackjack:dealer-hit", {});
    },
    { priority: 80, once: false }
  );
  
  // Rule: Dealer must stand on 17 or more
  ruleEngine.addRule(
    "dealer-must-stand",
    (engine) => {
      const dealerHand = engine.table.zone("dealer-hand");
      if (!dealerHand || dealerHand.length === 0) return false;
      const cards = dealerHand.map(p => p.card);
      const value = getBestHandValue(cards);
      return value >= 17 && engine._gameState?.dealerTurn === true;
    },
    (engine) => {
      engine.dispatch("blackjack:dealer-stand", {});
    },
    { priority: 70, once: false }
  );
}

/**
 * Blackjack game state policies
 */
export class BlackjackPolicy {
  constructor(name, condition, effect, opts = {}) {
    this.name = name;
    this.condition = condition;
    this.effect = effect;
    this.priority = opts.priority || 0;
    this.once = opts.once || false;
    this.enabled = opts.enabled !== false;
    this._fired = false;
  }
  
  evaluate(engine) {
    if (!this.enabled || (this.once && this._fired)) return false;
    
    try {
      if (this.condition(engine)) {
        this.effect(engine);
        this._fired = true;
        return true;
      }
    } catch (err) {
      console.error(`Policy ${this.name} error:`, err);
    }
    return false;
  }
  
  reset() {
    this._fired = false;
    return this;
  }
}