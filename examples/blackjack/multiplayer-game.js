/**
 * Multi-player Blackjack Game
 * Supports 2-6 players at a single table with sequential turns
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
import { BettingManager, registerBettingActions } from './blackjack-betting.js';

registerBettingActions();

/**
 * Player state tracker
 */
class Player {
  constructor(name, seat, initialBankroll = 1000, options = {}) {
    this.name = name;
    this.seat = seat;
    this.bettingManager = new BettingManager(initialBankroll, options);
    this.handZone = `player-${seat}-hand`;
    this.currentBet = 0;
    this.isActive = true;
    this.stood = false;
    this.busted = false;
    this.blackjack = false;
    this.result = null;
    this.payout = null;
  }
  
  reset() {
    this.stood = false;
    this.busted = false;
    this.blackjack = false;
    this.result = null;
    this.payout = null;
  }
  
  placeBet(amount) {
    this.bettingManager.placeBet(amount);
    this.currentBet = amount;
  }
  
  resolveBet(result) {
    this.result = result;
    this.payout = this.bettingManager.resolveBet(result);
    return this.payout;
  }
}

/**
 * Multi-player Blackjack Game
 */
export class MultiplayerBlackjackGame {
  constructor({ 
    numPlayers = 2, 
    numDecks = 6, 
    seed = null, 
    initialBankroll = 1000,
    minBet = 5,
    maxBet = 500,
    playerNames = null
  } = {}) {
    if (numPlayers < 2 || numPlayers > 6) {
      throw new Error("Number of players must be between 2 and 6");
    }
    
    this.numPlayers = numPlayers;
    
    // Load deck
    const deckData = JSON.parse(
      readFileSync('./token-sets/standard-deck.json', 'utf8')
    );
    const tokenSet = parseTokenSetObject(deckData);
    
    // Setup shoe
    const decks = [];
    for (let i = 0; i < numDecks; i++) {
      decks.push(new Deck(tokenSet.tokens, { seed: seed ? seed + i : null }));
    }
    
    this.shoe = new Shoe(...decks);
    this.shoe.shuffle(seed);
    this.deck = decks[0];
    
    // Setup table
    this.table = new Table("multiplayer-blackjack");
    this.table.createZone("dealer-hand");
    
    // Create players
    this.players = [];
    for (let i = 0; i < numPlayers; i++) {
      const name = playerNames && playerNames[i] ? playerNames[i] : `Player ${i + 1}`;
      const player = new Player(name, i, initialBankroll, { minBet, maxBet });
      this.players.push(player);
      this.table.createZone(player.handZone);
    }
    
    // Setup engine
    this.engine = new Engine({
      deck: this.deck,
      table: this.table,
      shoe: this.shoe
    });
    
    this.engine._gameState = {
      dealerTurn: false,
      gameOver: false,
      currentPlayerIndex: 0,
      allPlayersFinished: false
    };
    
    this.ruleEngine = new RuleEngine(this.engine);
    registerBlackjackRules(this.ruleEngine);
    
    this.debug = false;
  }
  
  /**
   * Collect bets from all active players
   */
  collectBets(bets) {
    if (bets.length !== this.numPlayers) {
      throw new Error(`Expected ${this.numPlayers} bets, got ${bets.length}`);
    }
    
    for (let i = 0; i < this.numPlayers; i++) {
      const player = this.players[i];
      if (player.isActive && bets[i] > 0) {
        player.placeBet(bets[i]);
      }
    }
  }
  
  /**
   * Deal initial cards to all players and dealer
   */
  deal() {
    // Reset all players
    this.players.forEach(p => p.reset());
    
    // Clear all zones
    this.table.clearZone("dealer-hand");
    this.players.forEach(p => this.table.clearZone(p.handZone));
    
    // Deal first card to each player
    for (const player of this.players) {
      if (player.isActive && player.currentBet > 0) {
        const card = this.shoe.draw();
        this.table.place(player.handZone, card, { faceUp: true });
      }
    }
    
    // Deal first card to dealer (face down)
    const dealerCard1 = this.shoe.draw();
    this.table.place("dealer-hand", dealerCard1, { faceUp: false });
    
    // Deal second card to each player
    for (const player of this.players) {
      if (player.isActive && player.currentBet > 0) {
        const card = this.shoe.draw();
        this.table.place(player.handZone, card, { faceUp: true });
      }
    }
    
    // Deal second card to dealer (face up)
    const dealerCard2 = this.shoe.draw();
    this.table.place("dealer-hand", dealerCard2, { faceUp: true });
    
    // Check for blackjacks
    for (const player of this.players) {
      if (player.currentBet > 0) {
        const cards = this.getPlayerCards(player);
        if (isBlackjack(cards)) {
          player.blackjack = true;
          player.stood = true;
        }
      }
    }
    
    this.engine._gameState.currentPlayerIndex = 0;
    this.engine._gameState.allPlayersFinished = false;
    this.engine._gameState.dealerTurn = false;
    this.engine._gameState.gameOver = false;
    
    return this.getGameState();
  }
  
  /**
   * Get current active player
   */
  getCurrentPlayer() {
    return this.players[this.engine._gameState.currentPlayerIndex];
  }
  
  /**
   * Hit for current player
   */
  hit() {
    const player = this.getCurrentPlayer();
    
    if (player.stood || player.busted) {
      throw new Error(`${player.name} cannot hit`);
    }
    
    const card = this.shoe.draw();
    this.table.place(player.handZone, card, { faceUp: true });
    
    // Check for bust
    const cards = this.getPlayerCards(player);
    if (isBusted(cards)) {
      player.busted = true;
      player.stood = true;
      this.nextPlayer();
    }
    
    return this.getGameState();
  }
  
  /**
   * Stand for current player
   */
  stand() {
    const player = this.getCurrentPlayer();
    player.stood = true;
    this.nextPlayer();
    return this.getGameState();
  }
  
  /**
   * Move to next player
   */
  nextPlayer() {
    let nextIndex = this.engine._gameState.currentPlayerIndex + 1;
    
    // Find next active player who hasn't finished
    while (nextIndex < this.numPlayers) {
      const player = this.players[nextIndex];
      if (player.currentBet > 0 && !player.stood) {
        this.engine._gameState.currentPlayerIndex = nextIndex;
        return;
      }
      nextIndex++;
    }
    
    // All players finished
    this.engine._gameState.allPlayersFinished = true;
    this.playDealerHand();
  }
  
  /**
   * Play dealer's hand
   */
  playDealerHand() {
    this.engine._gameState.dealerTurn = true;
    
    // Reveal dealer's hole card
    const dealerHand = this.table.zone("dealer-hand");
    if (dealerHand.length > 0) {
      dealerHand[0].faceUp = true;
    }
    
    // Dealer draws according to rules
    let dealerCards = this.getDealerCards();
    let dealerValue = getBestHandValue(dealerCards);
    
    while (dealerValue < 17) {
      const card = this.shoe.draw();
      this.table.place("dealer-hand", card, { faceUp: true });
      dealerCards = this.getDealerCards();
      dealerValue = getBestHandValue(dealerCards);
    }
    
    this.engine._gameState.dealerTurn = false;
    this.engine._gameState.gameOver = true;
    
    // Resolve all bets
    this.resolveBets();
  }
  
  /**
   * Resolve all player bets
   */
  resolveBets() {
    const dealerCards = this.getDealerCards();
    
    for (const player of this.players) {
      if (player.currentBet > 0) {
        const playerCards = this.getPlayerCards(player);
        const result = determineWinner(playerCards, dealerCards);
        player.resolveBet(result);
      }
    }
  }
  
  /**
   * Get cards for a player
   */
  getPlayerCards(player) {
    return this.table.zone(player.handZone).map(p => p.card);
  }
  
  /**
   * Get dealer cards
   */
  getDealerCards() {
    return this.table.zone("dealer-hand").map(p => p.card);
  }
  
  /**
   * Get complete game state
   */
  getGameState() {
    const dealerCards = this.getDealerCards();
    const showFullDealer = this.engine._gameState.gameOver || this.engine._gameState.dealerTurn;
    
    const playerStates = this.players.map(player => {
      const cards = this.getPlayerCards(player);
      const value = cards.length > 0 ? getBestHandValue(cards) : 0;
      
      return {
        name: player.name,
        seat: player.seat,
        cards: cards,
        value: value,
        busted: player.busted,
        blackjack: player.blackjack,
        stood: player.stood,
        currentBet: player.currentBet,
        bankroll: player.bettingManager.bankroll,
        result: player.result,
        payout: player.payout,
        display: cards.length > 0 ? formatHand(cards) : "No cards",
        isActive: player.currentBet > 0
      };
    });
    
    return {
      players: playerStates,
      dealer: {
        cards: dealerCards,
        value: showFullDealer ? getBestHandValue(dealerCards) : null,
        busted: showFullDealer ? isBusted(dealerCards) : null,
        display: formatHand(dealerCards, !showFullDealer)
      },
      currentPlayerIndex: this.engine._gameState.currentPlayerIndex,
      currentPlayer: this.getCurrentPlayer().name,
      gameOver: this.engine._gameState.gameOver,
      dealerTurn: this.engine._gameState.dealerTurn,
      allPlayersFinished: this.engine._gameState.allPlayersFinished
    };
  }
  
  /**
   * Start new round
   */
  newRound() {
    this.table.collectAllInto(this.deck);
    this.shoe.reset();
    this.shoe.shuffle();
    return this.getGameState();
  }
  
  /**
   * Get statistics for all players
   */
  getAllStats() {
    return this.players.map(p => ({
      name: p.name,
      stats: p.bettingManager.getStats()
    }));
  }
}