/**
 * Blackjack Game Implementation using HyperToken Engine
 */

import { parseTokenSetObject } from '../../core/loaders/tokenSetLoader.js';
import { Deck } from '../../core/Deck.js';
import { Table } from '../../core/Table.js';
import { Shoe } from '../../core/Shoe.js';
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
    engine.table.clearZone("player-hand");
    engine.table.clearZone("dealer-hand");
    
    // Deal 2 cards to player
    const p1 = engine.shoe.draw();
    const p2 = engine.shoe.draw();
    engine.table.place("player-hand", p1, { faceUp: true });
    engine.table.place("player-hand", p2, { faceUp: true });
    
    // Deal 2 cards to dealer (one face down)
    const d1 = engine.shoe.draw();
    const d2 = engine.shoe.draw();
    engine.table.place("dealer-hand", d1, { faceUp: false });
    engine.table.place("dealer-hand", d2, { faceUp: true });
    
    engine._gameState = { 
      dealerTurn: false, 
      gameOver: false,
      playerStood: false
    };
  },
  
  "blackjack:hit": (engine) => {
    const card = engine.shoe.draw();
    engine.table.place("player-hand", card, { faceUp: true });
  },
  
  "blackjack:stand": (engine) => {
    engine._gameState.playerStood = true;
    engine._gameState.dealerTurn = true;
    
    // Reveal dealer's hidden card
    const dealerHand = engine.table.zone("dealer-hand");
    if (dealerHand.length > 0) {
      dealerHand[0].faceUp = true;
    }
  },
  
  "blackjack:dealer-hit": (engine) => {
    const card = engine.shoe.draw();
    engine.table.place("dealer-hand", card, { faceUp: true });
  },
  
  "blackjack:dealer-stand": (engine) => {
    engine._gameState.dealerTurn = false;
    engine._gameState.gameOver = true;
  },
  
  "blackjack:player-busted": (engine) => {
    engine._gameState.gameOver = true;
    engine._gameState.result = "dealer";
  },
  
  "blackjack:player-blackjack": (engine) => {
    // Check dealer for blackjack
    const dealerHand = engine.table.zone("dealer-hand");
    const dealerCards = dealerHand.map(p => p.card);
    if (isBlackjack(dealerCards)) {
      engine._gameState.result = "push";
    } else {
      engine._gameState.result = "player-blackjack";
    }
    engine._gameState.gameOver = true;
  },
  
  "blackjack:new-round": (engine) => {
    engine.table.collectAllInto(engine.deck);
    engine.shoe.reset();
    engine.shoe.shuffle();
  }
});

/**
 * BlackjackGame class - manages game flow
 */
export class BlackjackGame {
  constructor({ numDecks = 6, seed = null } = {}) {
    // Load standard deck
    const deckData = JSON.parse(
      readFileSync('./token-sets/standard-deck.json', 'utf8')
    );
    const tokenSet = parseTokenSetObject(deckData);
    
    // Create decks for the shoe
    const decks = [];
    for (let i = 0; i < numDecks; i++) {
      decks.push(new Deck(tokenSet.tokens, { seed: seed ? seed + i : null }));
    }
    
    // Setup game components
    this.shoe = new Shoe(...decks);
    this.shoe.shuffle(seed);
    
    this.table = new Table("blackjack");
    this.table.createZone("player-hand");
    this.table.createZone("dealer-hand");
    
    this.deck = decks[0]; // Reference for collecting cards
    
    this.engine = new Engine({
      deck: this.deck,
      table: this.table,
      shoe: this.shoe
    });
    
    // Add game state tracking
    this.engine._gameState = {
      dealerTurn: false,
      gameOver: false,
      playerStood: false,
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
   * Player hits (takes another card)
   */
  hit() {
    if (this.engine._gameState.gameOver) {
      throw new Error("Game is over. Start a new round.");
    }
    if (this.engine._gameState.playerStood) {
      throw new Error("Player has already stood.");
    }
    
    this.engine.dispatch("blackjack:hit");
    return this.getGameState();
  }
  
  /**
   * Player stands (ends their turn)
   */
  stand() {
    if (this.engine._gameState.gameOver) {
      throw new Error("Game is over. Start a new round.");
    }
    if (this.engine._gameState.playerStood) {
      throw new Error("Player has already stood.");
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
      const playerHand = this.table.zone("player-hand").map(p => p.card);
      const dealerHand = this.table.zone("dealer-hand").map(p => p.card);
      this.engine._gameState.result = determineWinner(playerHand, dealerHand);
    }
  }
  
  /**
   * Get current game state
   */
  getGameState() {
    const playerHand = this.table.zone("player-hand").map(p => p.card);
    const dealerHand = this.table.zone("dealer-hand").map(p => p.card);
    const dealerPlacements = this.table.zone("dealer-hand");
    
    const playerValue = getBestHandValue(playerHand);
    const playerBusted = isBusted(playerHand);
    const playerBlackjack = isBlackjack(playerHand);
    
    // Only show dealer's up card if game is not over
    const showFullDealer = this.engine._gameState.gameOver || 
                          this.engine._gameState.dealerTurn;
    
    return {
      playerHand: {
        cards: playerHand,
        value: playerValue,
        busted: playerBusted,
        blackjack: playerBlackjack,
        display: formatHand(playerHand)
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
              !this.engine._gameState.playerStood &&
              !playerBusted &&
              !playerBlackjack,
      canStand: !this.engine._gameState.gameOver && 
                !this.engine._gameState.playerStood &&
                !playerBusted &&
                !playerBlackjack
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
      case "player-blackjack":
        return "🎉 BLACKJACK! You win 3:2!";
      case "player":
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