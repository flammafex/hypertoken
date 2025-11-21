/**
 * Blackjack Game Implementation using HyperToken Engine
 */

import { parseTokenSetObject } from '../../core/loaders/tokenSetLoader.js';
import { Stack } from '../../core/Stack.js';
import { Space } from '../../core/Space.js';
import { Source } from '../../core/Source.js';
import { Engine } from '../../engine/Engine.js';
import { RuleEngine } from '../../engine/RuleEngine.js';
import { ActionRegistry } from '../../engine/actions.js';
import { readFileSync } from 'fs';
import { 
  getBestHandValue, 
  isBusted, 
  isBlackjack, 
  formatHand,
  determineWinner 
} from './blackjack-utils.js';
import { registerBlackjackRules } from './blackjack-rules.js';

/**
 * Extend ActionRegistry with blackjack-specific actions
 */
Object.assign(ActionRegistry, {
  "blackjack:deal": (engine) => {
    // Clear existing hands
    engine.space.clearZone("agent-hand");
    engine.space.clearZone("dealer-hand");
    
    // Deal 2 cards to agent
    const p1 = engine.source.draw();
    const p2 = engine.source.draw();
    engine.space.place("agent-hand", p1, { faceUp: true });
    engine.space.place("agent-hand", p2, { faceUp: true });
    
    // Deal 2 cards to dealer (one face down)
    const d1 = engine.source.draw();
    const d2 = engine.source.draw();
    engine.space.place("dealer-hand", d1, { faceUp: false });
    engine.space.place("dealer-hand", d2, { faceUp: true });
    
    engine._gameState = { 
      dealerTurn: false, 
      gameOver: false,
      agentStood: false
    };
  },
  
  "blackjack:hit": (engine) => {
    const card = engine.source.draw();
    engine.space.place("agent-hand", card, { faceUp: true });
  },
  
  "blackjack:stand": (engine) => {
    engine._gameState.agentStood = true;
    engine._gameState.dealerTurn = true;
    
    // Reveal dealer's hidden card
    const dealerHand = engine.space.zone("dealer-hand");
    if (dealerHand.length > 0) {
      dealerHand[0].faceUp = true;
    }
  },
  
  "blackjack:dealer-hit": (engine) => {
    const card = engine.source.draw();
    engine.space.place("dealer-hand", card, { faceUp: true });
  },
  
  "blackjack:dealer-stand": (engine) => {
    engine._gameState.dealerTurn = false;
    engine._gameState.gameOver = true;
  },
  
  "blackjack:agent-busted": (engine) => {
    engine._gameState.gameOver = true;
    engine._gameState.result = "dealer";
  },
  
  "blackjack:agent-blackjack": (engine) => {
    // Check dealer for blackjack
    const dealerHand = engine.space.zone("dealer-hand");
    const dealerCards = dealerHand.map(p => p.card);
    if (isBlackjack(dealerCards)) {
      engine._gameState.result = "push";
    } else {
      engine._gameState.result = "agent-blackjack";
    }
    engine._gameState.gameOver = true;
  },
  
  "blackjack:new-round": (engine) => {
    engine.space.collectAllInto(engine.stack);
    engine.source.reset();
    engine.source.shuffle();
  }
});

/**
 * BlackjackGame class - manages game flow
 */
export class BlackjackGame {
  constructor({ numStacks = 6, seed = null } = {}) {
    // Load standard stack
    const stackData = JSON.parse(
      readFileSync('./token-sets/standard-stack.json', 'utf8')
    );
    const tokenSet = parseTokenSetObject(stackData);
    
    // Create stacks for the source
    const stacks = [];
    for (let i = 0; i < numStacks; i++) {
      stacks.push(new Stack(tokenSet.tokens, { seed: seed ? seed + i : null }));
    }
    
    // Setup game components
    this.source = new Source(...stacks);
    this.source.shuffle(seed);
    
    this.space = new Space("blackjack");
    this.space.createZone("agent-hand");
    this.space.createZone("dealer-hand");
    
    this.stack = stacks[0]; // Reference for collecting cards
    
    this.engine = new Engine({
      stack: this.stack,
      space: this.space,
      source: this.source
    });
    
    // Add game state tracking
    this.engine._gameState = {
      dealerTurn: false,
      gameOver: false,
      agentStood: false,
      result: null
    };
    
    // Setup rules
    this.ruleEngine = new RuleEngine(this.engine);
    registerBlackjackRules(this.ruleEngine);
    
    // Event logging
    this.engine.on("*", (e) => {
      if (this.debug) {
        console.log(`[${e.type}]`, e.payload || '');
      }
    });
    
    this.debug = false;
  }
  
  /**
   * Start a new round
   */
  deal() {
    this.engine.dispatch("blackjack:deal");
    return this.getGameState();
  }
  
  /**
   * Agent hits (takes another card)
   */
  hit() {
    if (this.engine._gameState.gameOver) {
      throw new Error("Game is over. Start a new round.");
    }
    if (this.engine._gameState.agentStood) {
      throw new Error("Agent has already stood.");
    }
    
    this.engine.dispatch("blackjack:hit");
    return this.getGameState();
  }
  
  /**
   * Agent stands (ends their turn)
   */
  stand() {
    if (this.engine._gameState.gameOver) {
      throw new Error("Game is over. Start a new round.");
    }
    if (this.engine._gameState.agentStood) {
      throw new Error("Agent has already stood.");
    }
    
    this.engine.dispatch("blackjack:stand");
    
    // Play out dealer's hand
    this.playDealerHand();
    
    return this.getGameState();
  }
  
  /**
   * Play out dealer's hand automatically
   */
  playDealerHand() {
    const maxIterations = 10;
    let iterations = 0;
    
    while (this.engine._gameState.dealerTurn && iterations < maxIterations) {
      this.ruleEngine.evaluate();
      iterations++;
    }
    
    // Determine final result
    if (!this.engine._gameState.result) {
      const agentHand = this.space.zone("agent-hand").map(p => p.card);
      const dealerHand = this.space.zone("dealer-hand").map(p => p.card);
      this.engine._gameState.result = determineWinner(agentHand, dealerHand);
    }
  }
  
  /**
   * Get current game state
   */
  getGameState() {
    const agentHand = this.space.zone("agent-hand").map(p => p.card);
    const dealerHand = this.space.zone("dealer-hand").map(p => p.card);
    const dealerPlacements = this.space.zone("dealer-hand");
    
    const agentValue = getBestHandValue(agentHand);
    const agentBusted = isBusted(agentHand);
    const agentBlackjack = isBlackjack(agentHand);
    
    // Only show dealer's up card if game is not over
    const showFullDealer = this.engine._gameState.gameOver || 
                          this.engine._gameState.dealerTurn;
    
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
      gameOver: this.engine._gameState.gameOver,
      result: this.engine._gameState.result,
      canHit: !this.engine._gameState.gameOver && 
              !this.engine._gameState.agentStood &&
              !agentBusted &&
              !agentBlackjack,
      canStand: !this.engine._gameState.gameOver && 
                !this.engine._gameState.agentStood &&
                !agentBusted &&
                !agentBlackjack
    };
  }
  
  /**
   * Start a fresh round (collect and reshuffle)
   */
  newRound() {
    this.engine.dispatch("blackjack:new-round");
    return this.deal();
  }
  
  /**
   * Get formatted result message
   */
  getResultMessage() {
    const result = this.engine._gameState.result;
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
}