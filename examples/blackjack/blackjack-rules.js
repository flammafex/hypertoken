/**
 * Blackjack Rules for HyperToken RuleEngine
 */

import { isBusted, isBlackjack, getBestHandValue } from './blackjack-utils.js';

/**
 * Create blackjack rules for the engine
 * @param {RuleEngine} ruleEngine
 */
export function registerBlackjackRules(ruleEngine) {
  
  // Rule: Auto-check for agent bust after hit
  ruleEngine.addRule(
    "agent-bust-check",
    (engine, lastAction) => {
      if (!lastAction || lastAction.type !== "blackjack:hit") return false;
      const agentHand = engine.space.zone("agent-hand");
      if (!agentHand || agentHand.length === 0) return false;
      const cards = agentHand.map(p => p.card);
      return isBusted(cards);
    },
    async (engine) => {
      await engine.dispatch("blackjack:agent-busted", {});
    },
    { priority: 100, once: false }
  );
  
  // Rule: Auto-check for blackjack on deal
  ruleEngine.addRule(
    "blackjack-check",
    (engine, lastAction) => {
      if (!lastAction || lastAction.type !== "blackjack:deal") return false;
      const agentHand = engine.space.zone("agent-hand");
      if (!agentHand || agentHand.length !== 2) return false;
      const cards = agentHand.map(p => p.card);
      return isBlackjack(cards);
    },
    async (engine) => {
      await engine.dispatch("blackjack:agent-blackjack", {});
    },
    { priority: 90, once: false }
  );
  
  // Rule: Dealer must hit on 16 or less
  ruleEngine.addRule(
    "dealer-must-hit",
    (engine) => {
      const dealerHand = engine.space.zone("dealer-hand");
      if (!dealerHand || dealerHand.length === 0) return false;
      const cards = dealerHand.map(p => p.card);
      const value = getBestHandValue(cards);
      return value < 17 && engine._gameState?.dealerTurn === true;
    },
    async (engine) => {
      await engine.dispatch("blackjack:dealer-hit", {});
    },
    { priority: 80, once: false }
  );
  
  // Rule: Dealer must stand on 17 or more
  ruleEngine.addRule(
    "dealer-must-stand",
    (engine) => {
      const dealerHand = engine.space.zone("dealer-hand");
      if (!dealerHand || dealerHand.length === 0) return false;
      const cards = dealerHand.map(p => p.card);
      const value = getBestHandValue(cards);
      return value >= 17 && engine._gameState?.dealerTurn === true;
    },
    async (engine) => {
      await engine.dispatch("blackjack:dealer-stand", {});
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
  
  async evaluate(engine) {
    if (!this.enabled || (this.once && this._fired)) return false;

    try {
      if (this.condition(engine)) {
        await this.effect(engine);
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