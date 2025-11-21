/*
 * examples/blackjack/multiplayer-game.js
 * Fixed: Removed manual event emissions to prevent double-firing
 */

import { parseTokenSetObject } from '../../core/loaders/tokenSetLoader.js';
import { Deck } from '../../core/Deck.js';
import { Table } from '../../core/Table.js';
import { Engine } from '../../engine/Engine.js';
import { RuleEngine } from '../../engine/RuleEngine.js';
import { Player } from '../../engine/Player.js';
import { readFileSync } from 'fs';
import { 
  getBestHandValue, 
  isBusted, 
  isBlackjack, 
  formatHand,
  determineWinner 
} from './blackjack-utils.js';
import { registerBlackjackRules } from './blackjack-rules.js';
import { registerBettingActions } from './blackjack-betting.js';

try { registerBettingActions(); } catch (e) {}

export class MultiplayerBlackjackGame {
  constructor(engine, { 
    isHost = false,
    numPlayers = 2, 
    numDecks = 6, 
    seed = null, 
    initialBankroll = 1000,
    playerNames = null
  } = {}) {
    this.engine = engine;
    this.numPlayers = numPlayers;
    this.isHost = isHost;
    
    if (!this.engine.deck) {
      let allTokens = [];
      if (isHost) {
        try {
          const deckData = JSON.parse(
            readFileSync('./examples/blackjack/token-sets/standard-deck.json', 'utf8')
          );
          const baseTokens = parseTokenSetObject(deckData).tokens;
          for (let i = 0; i < numDecks; i++) {
            const deckCopy = baseTokens.map(t => ({ ...t, id: `${t.id}-${i}` }));
            allTokens.push(...deckCopy);
          }
        } catch (e) {
          console.error("Failed to load deck file (Host):", e.message);
        }
      }
      this.engine.deck = new Deck(this.engine.session, allTokens, { seed, autoInit: isHost });
      if (isHost) this.engine.deck.shuffle(seed);
    }

    ['dealer-hand', 'discard-pile'].forEach(z => {
      if (!this.engine.table.zones.includes(z)) this.engine.table.createZone(z);
    });

    for (let i = 0; i < numPlayers; i++) {
      const name = playerNames && playerNames[i] ? playerNames[i] : `Player ${i + 1}`;
      let player = this.engine._players.find(p => p.name === name);
      if (!player) {
        player = new Player(name);
        player.resources.bankroll = initialBankroll;
        player.resources.currentBet = 0;
        player.resources.stood = 0; 
        player.resources.busted = 0;
        this.engine._players.push(player);
      }
      const handZone = `player-${i}-hand`;
      if (!this.engine.table.zones.includes(handZone)) {
        this.engine.table.createZone(handZone);
      }
      player.handZone = handZone;
    }

    this.ruleEngine = new RuleEngine(this.engine);
    this.engine.useRuleEngine(this.ruleEngine);
    registerBlackjackRules(this.ruleEngine);
  }

  deal() {
    if (!this.isHost) return;

    this.engine._players.forEach(p => {
      p.resources.stood = 0;
      p.resources.busted = 0;
    });

    this.engine.table.collectAllInto(this.engine.deck); 
    
    for (let i = 0; i < 2; i++) {
      this.engine._players.forEach(player => {
        if (player.resources.currentBet > 0) { 
          const card = this.engine.deck.draw();
          if (card) this.engine.table.place(player.handZone, card, { faceUp: true });
        }
      });
      
      const dealerCard = this.engine.deck.draw();
      const faceUp = i === 1; 
      if (dealerCard) this.engine.table.place("dealer-hand", dealerCard, { faceUp });
    }

    // Start Round via CRDT (GameLoop will reactively emit loop:start)
    this.engine.session.change("start round", (doc) => {
      if (!doc.gameLoop) doc.gameLoop = { turn: 0, running: true, activePlayerIndex: 0, phase: "play", maxTurns: Infinity };
      doc.gameLoop.running = true;
      doc.gameLoop.turn = 1;
      doc.gameLoop.activePlayerIndex = 0; 
      doc.gameLoop.phase = "play";
    });

    // REMOVED MANUAL EMIT
    this.checkTurnState();
  }

  nextPlayer() {
    const currentIdx = this.engine.loop.activePlayerIndex;
    const players = this.engine._players;
    let nextIdx = currentIdx + 1;
    
    while (nextIdx < players.length) {
      const p = players[nextIdx];
      if (p.resources.currentBet > 0) {
        this.engine.session.change("next player", (doc) => {
          doc.gameLoop.activePlayerIndex = nextIdx;
        });
        return;
      }
      nextIdx++;
    }

    this.endRound();
  }

  checkTurnState() {
    const player = this.engine.loop.activePlayer;
    if (!player || player.resources.currentBet === 0) {
      this.nextPlayer();
    }
  }

  endRound() {
    // End Round via CRDT (GameLoop will reactively emit loop:stop)
    this.engine.session.change("stop round", (doc) => {
      doc.gameLoop.running = false;
      doc.gameLoop.phase = "dealer";
    });
    // REMOVED MANUAL EMIT
  }

  hit() {
    const player = this.engine.loop.activePlayer;
    if (!player) return;

    const card = this.engine.deck.draw();
    if (!card) {
        console.error("Deck empty!");
        return;
    }

    this.engine.table.place(player.handZone, card, { faceUp: true });

    const cards = this.engine.table.zone(player.handZone).map(p => p.tokenSnapshot);
    if (isBusted(cards)) {
      console.log(`💥 ${player.name} Busted!`);
      player.resources.busted = 1;
      this.nextPlayer();
    }
  }

  stand() {
    const player = this.engine.loop.activePlayer;
    if (player) {
      player.resources.stood = 1;
      this.nextPlayer();
    }
  }

  playDealer() {
    if (!this.isHost) return;
    
    console.log("🤖 Dealer playing...");
    
    const dealerHand = this.engine.table.zone("dealer-hand");
    if (dealerHand[0]) {
      this.engine.table.flip("dealer-hand", dealerHand[0].id, true);
    }

    let cards = this.engine.table.zone("dealer-hand").map(p => p.tokenSnapshot);
    let val = getBestHandValue(cards);
    
    while (val < 17) {
      const card = this.engine.deck.draw(); 
      if (!card) break;
      
      this.engine.table.place("dealer-hand", card, { faceUp: true });
      cards = this.engine.table.zone("dealer-hand").map(p => p.tokenSnapshot);
      val = getBestHandValue(cards);
    }

    this.resolveBets();
  }

  resolveBets() {
    const dealerCards = this.engine.table.zone("dealer-hand").map(p => p.tokenSnapshot);
    
    this.engine._players.forEach(player => {
      if (player.resources.currentBet === 0) return;

      const playerCards = this.engine.table.zone(player.handZone).map(p => p.tokenSnapshot);
      
      if (player.resources.busted) {
         console.log(`${player.name}: BUST (-$${player.resources.currentBet})`);
         player.resources.currentBet = 0;
         return;
      }

      const result = determineWinner(playerCards, dealerCards);
      
      let payout = 0;
      const bet = player.resources.currentBet;

      if (result === "player-blackjack") payout = bet * 2.5;
      else if (result === "player") payout = bet * 2;
      else if (result === "push") payout = bet;
      
      if (payout > 0) {
        player.resources.bankroll += payout;
      }
      
      player.resources.currentBet = 0; 
      console.log(`${player.name}: ${result} (+$${payout})`);
    });
  }
}