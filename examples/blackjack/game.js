/**
 * Blackjack Game Implementation using HyperToken Engine
 *
 * This is a simplified single-player blackjack implementation.
 * For multi-agent games with networking support, use MultiagentBlackjackGame.
 *
 * Features:
 * - Single player vs dealer
 * - Standard blackjack rules
 * - Optional betting system integration
 * - Deterministic replay with seeds
 * - Rule-based automatic dealer play
 *
 * @see multiagent-game.js for advanced multi-player support
 */

import { parseTokenSetObject } from '../../core/loaders/tokenSetLoader.js';
import { Stack } from '../../core/Stack.js';
import { Space } from '../../core/Space.js';
import { Engine } from '../../engine/Engine.js';
import { RuleEngine } from '../../engine/RuleEngine.js';
import { Agent } from '../../engine/Agent.js';
import { readFileSync, existsSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import {
  getBestHandValue,
  isBusted,
  isBlackjack,
  formatHand,
  determineWinner
} from './blackjack-utils.js';
import { registerBlackjackRules } from './blackjack-rules.js';

// Get the directory of this file (works in both source and compiled contexts)
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// No ActionRegistry extensions needed - using direct method calls

/**
 * BlackjackGame class - manages game flow for single-player blackjack
 */
export class BlackjackGame {
  constructor({ numStacks = 6, seed = null, initialBankroll = null, minBet = 5, maxBet = 500 } = {}) {
    // Initialize engine with Chronicle session
    this.engine = new Engine();

    // Load standard deck - try multiple paths for source vs dist
    let allTokens = [];
    const possiblePaths = [
      join(__dirname, 'token-sets', 'standard-deck.json'),  // When running from source
      join(__dirname, '..', '..', 'examples', 'blackjack', 'token-sets', 'standard-deck.json')  // When running from dist
    ];

    let deckPath = possiblePaths.find(p => existsSync(p));

    if (!deckPath) {
      console.error("Failed to load deck file: Could not find standard-deck.json in any expected location");
      console.error("Tried paths:", possiblePaths);
    } else {
      try {
        const stackData = JSON.parse(readFileSync(deckPath, 'utf8'));
        const baseTokens = parseTokenSetObject(stackData).tokens;

        // Create multiple decks
        for (let i = 0; i < numStacks; i++) {
          const deckCopy = baseTokens.map(t => ({ ...t, id: `${t.id}-${i}` }));
          allTokens.push(...deckCopy);
        }
      } catch (e) {
        console.error("Failed to load deck file:", e.message);
      }
    }

    // Create stack with new API (requires Chronicle session)
    this.engine.stack = new Stack(this.engine.session, allTokens, { seed, autoInit: true });
    if (seed !== null) {
      this.engine.stack.shuffle(seed);
    }

    // Create zones
    ['agent-hand', 'dealer-hand'].forEach(zone => {
      if (!this.engine.space.zones.includes(zone)) {
        this.engine.space.createZone(zone);
      }
    });

    // Create a simple agent for single-player
    const agent = new Agent("Player");
    agent.resources.bankroll = initialBankroll || 1000;
    agent.resources.currentBet = 0;
    agent.handZone = "agent-hand";
    this.engine._agents.push(agent);

    // Add game state tracking
    this.gameState = {
      dealerTurn: false,
      gameOver: false,
      agentStood: false,
      result: null
    };

    // Betting configuration (if provided)
    this.hasBetting = initialBankroll !== null;
    this.minBet = minBet;
    this.maxBet = maxBet;

    // Setup rules
    this.ruleEngine = new RuleEngine(this.engine);
    this.engine.useRuleEngine(this.ruleEngine);
    registerBlackjackRules(this.ruleEngine);

    this.debug = false;
  }
  
  /**
   * Start a new round
   */
  deal() {
    // Clear existing hands
    this.engine.space.collectAllInto(this.engine.stack);

    // Reset game state
    this.gameState = {
      dealerTurn: false,
      gameOver: false,
      agentStood: false,
      result: null
    };

    // Deal 2 cards to agent
    for (let i = 0; i < 2; i++) {
      const card = this.engine.stack.draw();
      if (card) this.engine.space.place("agent-hand", card, { faceUp: true });
    }

    // Deal 2 cards to dealer (one face down)
    const d1 = this.engine.stack.draw();
    const d2 = this.engine.stack.draw();
    if (d1) this.engine.space.place("dealer-hand", d1, { faceUp: false });
    if (d2) this.engine.space.place("dealer-hand", d2, { faceUp: true });

    return this.getGameState();
  }

  /**
   * Agent hits (takes another card)
   */
  hit() {
    if (this.gameState.gameOver) {
      throw new Error("Game is over. Start a new round.");
    }
    if (this.gameState.agentStood) {
      throw new Error("Agent has already stood.");
    }

    const card = this.engine.stack.draw();
    if (card) {
      this.engine.space.place("agent-hand", card, { faceUp: true });
    }

    // Check for bust
    const agentHand = this.engine.space.zone("agent-hand").map(p => p.tokenSnapshot);
    if (isBusted(agentHand)) {
      this.gameState.gameOver = true;
      this.gameState.result = "dealer";
    }

    return this.getGameState();
  }

  /**
   * Agent stands (ends their turn)
   */
  stand() {
    if (this.gameState.gameOver) {
      throw new Error("Game is over. Start a new round.");
    }
    if (this.gameState.agentStood) {
      throw new Error("Agent has already stood.");
    }

    this.gameState.agentStood = true;
    this.gameState.dealerTurn = true;

    // Reveal dealer's hidden card
    const dealerHand = this.engine.space.zone("dealer-hand");
    if (dealerHand.length > 0 && dealerHand[0]) {
      this.engine.space.flip("dealer-hand", dealerHand[0].id, true);
    }

    // Play out dealer's hand
    this.playDealerHand();

    return this.getGameState();
  }

  /**
   * Play out dealer's hand automatically
   */
  playDealerHand() {
    let dealerCards = this.engine.space.zone("dealer-hand").map(p => p.tokenSnapshot);
    let dealerValue = getBestHandValue(dealerCards);

    // Dealer hits on 16 or less, stands on 17+
    while (dealerValue < 17) {
      const card = this.engine.stack.draw();
      if (!card) break;

      this.engine.space.place("dealer-hand", card, { faceUp: true });
      dealerCards = this.engine.space.zone("dealer-hand").map(p => p.tokenSnapshot);
      dealerValue = getBestHandValue(dealerCards);
    }

    this.gameState.dealerTurn = false;
    this.gameState.gameOver = true;

    // Determine final result
    const agentHand = this.engine.space.zone("agent-hand").map(p => p.tokenSnapshot);
    this.gameState.result = determineWinner(agentHand, dealerCards);
  }
  
  /**
   * Get current game state
   */
  getGameState() {
    const agentHand = this.engine.space.zone("agent-hand").map(p => p.tokenSnapshot);
    const dealerHand = this.engine.space.zone("dealer-hand").map(p => p.tokenSnapshot);

    const agentValue = getBestHandValue(agentHand);
    const agentBusted = isBusted(agentHand);
    const agentBlackjack = isBlackjack(agentHand);

    // Only show dealer's up card if game is not over
    const showFullDealer = this.gameState.gameOver || this.gameState.dealerTurn;

    return {
      agentHand: {
        cards: agentHand,
        value: agentValue,
        busted: agentBusted,
        blackjack: agentBlackjack,
        display: formatHand(agentHand)
      },
      dealerHand: {
        cards: dealerHand,
        value: showFullDealer ? getBestHandValue(dealerHand) : null,
        busted: showFullDealer ? isBusted(dealerHand) : null,
        blackjack: showFullDealer ? isBlackjack(dealerHand) : null,
        display: formatHand(dealerHand, !showFullDealer)
      },
      gameOver: this.gameState.gameOver,
      result: this.gameState.result,
      canHit: !this.gameState.gameOver &&
              !this.gameState.agentStood &&
              !agentBusted &&
              !agentBlackjack,
      canStand: !this.gameState.gameOver &&
                !this.gameState.agentStood &&
                !agentBusted &&
                !agentBlackjack
    };
  }

  /**
   * Start a fresh round (collect and reshuffle)
   */
  newRound() {
    this.engine.space.collectAllInto(this.engine.stack);
    if (this.engine.stack.size < 52) {
      this.engine.stack.shuffle();
    }
    return this.deal();
  }
  
  /**
   * Get formatted result message
   */
  getResultMessage() {
    const result = this.gameState.result;
    if (!result) return null;

    switch (result) {
      case "agent-blackjack":
        return "🎉 BLACKJACK! You win 3:2!";
      case "agent":
        return "🎉 You win!";
      case "dealer":
        return "😞 Dealer wins.";
      case "push":
        return "🤝 Push - tie game.";
      default:
        return null;
    }
  }

  /**
   * Get betting statistics (if betting is enabled)
   */
  getStats() {
    if (!this.hasBetting) {
      return null;
    }

    const agent = this.engine._agents[0];
    const netProfit = agent.resources.bankroll - (this.hasBetting ? agent.resources.bankroll : 1000);

    return {
      handsPlayed: 0, // Would need to track this
      currentBankroll: agent.resources.bankroll,
      netProfit,
      winRate: 0
    };
  }

  /**
   * Check if player can afford to continue (betting mode only)
   */
  isBroke() {
    if (!this.hasBetting) return false;
    const agent = this.engine._agents[0];
    return agent.resources.bankroll < this.minBet;
  }
}