/*
 * examples/blackjack/multiagent-game.js
 * Fixed: Removed manual event emissions to prevent double-firing
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
  determineWinner,
  canDoubleDown,
  canSplit,
  canTakeInsurance
} from './blackjack-utils.js';
import { registerBlackjackRules } from './blackjack-rules.js';
import { registerBettingActions } from './blackjack-betting.js';

// Get the directory of this file (works in both source and compiled contexts)
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

try { registerBettingActions(); } catch (e) {}

export class MultiagentBlackjackGame {
  constructor(engine, {
    isHost = false,
    numAgents = 2,
    numStacks = 6,
    seed = null,
    initialBankroll = 1000,
    agentNames = null,
    variant = 'american'
  } = {}) {
    this.engine = engine;
    this.numAgents = numAgents;
    this.isHost = isHost;
    this.variant = variant; // 'american' or 'european'
    
    if (!this.engine.stack) {
      let allTokens = [];
      if (isHost) {
        // Load standard deck - try multiple paths for source vs dist
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
            for (let i = 0; i < numStacks; i++) {
              const stackCopy = baseTokens.map(t => ({ ...t, id: `${t.id}-${i}` }));
              allTokens.push(...stackCopy);
            }
          } catch (e) {
            console.error("Failed to load deck file (Host):", e.message);
          }
        }
      }
      this.engine.stack = new Stack(this.engine.session, allTokens, { seed, autoInit: isHost });
      if (isHost) this.engine.stack.shuffle(seed);
    }

    ['dealer-hand', 'discard-pile'].forEach(z => {
      if (!this.engine.space.zones.includes(z)) this.engine.space.createZone(z);
    });

    for (let i = 0; i < numAgents; i++) {
      const name = agentNames && agentNames[i] ? agentNames[i] : `Agent ${i + 1}`;
      let agent = this.engine._agents.find(p => p.name === name);
      if (!agent) {
        agent = new Agent(name);
        agent.resources.bankroll = initialBankroll;
        agent.resources.currentBet = 0;
        agent.resources.stood = 0;
        agent.resources.busted = 0;
        agent.resources.insuranceBet = 0;
        agent.resources.hasSplit = 0;
        agent.resources.splitHandZone = null;
        agent.resources.splitHandBet = 0;
        agent.resources.playingSplitHand = 0;
        this.engine._agents.push(agent);
      }
      const handZone = `agent-${i}-hand`;
      if (!this.engine.space.zones.includes(handZone)) {
        this.engine.space.createZone(handZone);
      }
      agent.handZone = handZone;
    }

    this.ruleEngine = new RuleEngine(this.engine);
    this.engine.useRuleEngine(this.ruleEngine);
    registerBlackjackRules(this.ruleEngine);
  }

  deal() {
    if (!this.isHost) return;

    this.engine._agents.forEach(p => {
      p.resources.stood = 0;
      p.resources.busted = 0;
      p.resources.hasSplit = 0;
      p.resources.splitHandBet = 0;
      p.resources.playingSplitHand = 0;
    });

    this.engine.space.collectAllInto(this.engine.stack);

    // Deduct bets from bankroll before dealing
    this.engine._agents.forEach(agent => {
      if (agent.resources.currentBet > 0) {
        agent.resources.bankroll -= agent.resources.currentBet;
      }
    });

    // Deal to agents
    for (let i = 0; i < 2; i++) {
      this.engine._agents.forEach(agent => {
        if (agent.resources.currentBet > 0) {
          const card = this.engine.stack.draw();
          if (card) this.engine.space.place(agent.handZone, card, { faceUp: true });
        }
      });
    }

    // Deal to dealer based on variant
    if (this.variant === 'european') {
      // European: Only 1 card initially (face up)
      const dealerCard = this.engine.stack.draw();
      if (dealerCard) this.engine.space.place("dealer-hand", dealerCard, { faceUp: true });
    } else {
      // American: 2 cards (one face down, one face up)
      for (let i = 0; i < 2; i++) {
        const dealerCard = this.engine.stack.draw();
        const faceUp = i === 1;
        if (dealerCard) this.engine.space.place("dealer-hand", dealerCard, { faceUp });
      }
    }

    // Start Round via CRDT (GameLoop will reactively emit loop:start)
    this.engine.session.change("start round", (doc) => {
      if (!doc.gameLoop) doc.gameLoop = { turn: 0, running: true, activeAgentIndex: 0, phase: "play", maxTurns: Infinity };
      doc.gameLoop.running = true;
      doc.gameLoop.turn = 1;
      doc.gameLoop.activeAgentIndex = 0; 
      doc.gameLoop.phase = "play";
    });

    // REMOVED MANUAL EMIT
    this.checkTurnState();
  }

  nextAgent() {
    const currentIdx = this.engine.loop.activeAgentIndex;
    const agents = this.engine._agents;
    let nextIdx = currentIdx + 1;
    
    while (nextIdx < agents.length) {
      const p = agents[nextIdx];
      if (p.resources.currentBet > 0) {
        this.engine.session.change("next agent", (doc) => {
          doc.gameLoop.activeAgentIndex = nextIdx;
        });
        return;
      }
      nextIdx++;
    }

    this.endRound();
  }

  checkTurnState() {
    const agent = this.engine.loop.activeAgent;
    if (!agent || agent.resources.currentBet === 0) {
      this.nextAgent();
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

  /**
   * Get the current hand zone for an agent (handles split hands)
   */
  getCurrentHandZone(agent) {
    if (agent.resources.hasSplit && agent.resources.playingSplitHand) {
      return agent.resources.splitHandZone;
    }
    return agent.handZone;
  }

  hit() {
    const agent = this.engine.loop.activeAgent;
    if (!agent) return;

    const card = this.engine.stack.draw();
    if (!card) {
        console.error("Stack empty!");
        return;
    }

    const currentZone = this.getCurrentHandZone(agent);
    this.engine.space.place(currentZone, card, { faceUp: true });

    const cards = this.engine.space.zone(currentZone).map(p => p.tokenSnapshot);
    if (isBusted(cards)) {
      const handLabel = agent.resources.playingSplitHand ? " (Split Hand)" : "";
      console.log(`💥 ${agent.name}${handLabel} Busted!`);

      // If playing first split hand and busted, move to second hand
      if (agent.resources.hasSplit && !agent.resources.playingSplitHand) {
        agent.resources.playingSplitHand = 1;
        console.log(`${agent.name} now playing split hand...`);
      } else {
        agent.resources.busted = 1;
        this.nextAgent();
      }
    }
  }

  stand() {
    const agent = this.engine.loop.activeAgent;
    if (!agent) return;

    // If we have split and are still on first hand, move to second hand
    if (agent.resources.hasSplit && !agent.resources.playingSplitHand) {
      agent.resources.playingSplitHand = 1;
      console.log(`${agent.name} now playing split hand...`);
    } else {
      agent.resources.stood = 1;
      this.nextAgent();
    }
  }

  doubleDown() {
    const agent = this.engine.loop.activeAgent;
    if (!agent) return;

    const currentZone = this.getCurrentHandZone(agent);
    const cards = this.engine.space.zone(currentZone).map(p => p.tokenSnapshot);
    if (!canDoubleDown(cards)) {
      console.error("Cannot double down - must have exactly 2 cards");
      return;
    }

    // Determine which bet to double (main hand or split hand)
    const betToDouble = agent.resources.playingSplitHand
      ? agent.resources.splitHandBet
      : agent.resources.currentBet;

    // Check if agent can afford to double
    if (agent.resources.bankroll < betToDouble) {
      console.error("Insufficient funds to double down");
      return;
    }

    // Double the appropriate bet
    agent.resources.bankroll -= betToDouble;
    if (agent.resources.playingSplitHand) {
      agent.resources.splitHandBet *= 2;
    } else {
      agent.resources.currentBet *= 2;
    }

    // Take exactly one card
    const card = this.engine.stack.draw();
    if (!card) {
      console.error("Stack empty!");
      return;
    }

    this.engine.space.place(currentZone, card, { faceUp: true });

    // Check for bust
    const newCards = this.engine.space.zone(currentZone).map(p => p.tokenSnapshot);
    const handLabel = agent.resources.playingSplitHand ? " (Split Hand)" : "";
    if (isBusted(newCards)) {
      console.log(`💥 ${agent.name}${handLabel} Busted after doubling down!`);
    }

    // After doubling, move to next hand or next agent
    if (agent.resources.hasSplit && !agent.resources.playingSplitHand) {
      agent.resources.playingSplitHand = 1;
      console.log(`${agent.name} now playing split hand...`);
    } else {
      agent.resources.stood = 1;
      this.nextAgent();
    }
  }

  takeInsurance(amount = null) {
    const agent = this.engine.loop.activeAgent;
    if (!agent) return;

    // Insurance not available in European variant
    if (this.variant === 'european') {
      console.error("Insurance not available in European blackjack variant");
      return;
    }

    const dealerCards = this.engine.space.zone("dealer-hand").map(p => p.tokenSnapshot);
    if (!canTakeInsurance(dealerCards)) {
      console.error("Insurance not available - dealer must show an Ace");
      return;
    }

    const insuranceAmount = amount !== null ? amount : agent.resources.currentBet / 2;

    // Validate insurance bet
    if (insuranceAmount > agent.resources.currentBet / 2) {
      console.error(`Insurance bet cannot exceed half of original bet ($${agent.resources.currentBet / 2})`);
      return;
    }
    if (insuranceAmount > agent.resources.bankroll) {
      console.error(`Insufficient funds for insurance. Bankroll: ${agent.resources.bankroll}`);
      return;
    }

    // Place insurance bet
    agent.resources.bankroll -= insuranceAmount;
    agent.resources.insuranceBet = insuranceAmount;
    console.log(`${agent.name} took insurance for $${insuranceAmount}`);
  }

  /**
   * Check if dealer has blackjack (peek at hole card).
   * In American blackjack, this is done after insurance decisions.
   * If dealer has blackjack, round ends immediately.
   * @returns {boolean} true if dealer has blackjack and round ended
   */
  checkDealerBlackjack() {
    if (this.variant === 'european') {
      // European variant doesn't peek
      return false;
    }

    // Get all dealer cards (including face-down)
    const dealerCards = this.engine.space.zone("dealer-hand").map(p => p.tokenSnapshot);

    if (!isBlackjack(dealerCards)) {
      console.log("Dealer peeks... no blackjack. Play continues.");
      return false;
    }

    // Dealer has blackjack!
    console.log("🃏 Dealer has BLACKJACK!");

    // Reveal the hole card
    const dealerHand = this.engine.space.zone("dealer-hand");
    if (dealerHand[0] && !dealerHand[0].faceUp) {
      this.engine.space.flip("dealer-hand", dealerHand[0].id, true);
    }

    // Resolve all bets immediately
    this.engine._agents.forEach(agent => {
      if (agent.resources.currentBet === 0) return;

      // Resolve insurance first - pays 2:1
      if (agent.resources.insuranceBet > 0) {
        const insurancePayout = agent.resources.insuranceBet * 3; // Original + 2:1
        agent.resources.bankroll += insurancePayout;
        console.log(`${agent.name}: Insurance WINS! (+$${agent.resources.insuranceBet * 2})`);
        agent.resources.insuranceBet = 0;
      }

      // Check if player also has blackjack
      const agentCards = this.engine.space.zone(agent.handZone).map(p => p.tokenSnapshot);
      if (isBlackjack(agentCards)) {
        // Push - return the bet
        agent.resources.bankroll += agent.resources.currentBet;
        console.log(`${agent.name}: Also has blackjack - PUSH (bet returned)`);
      } else {
        // Player loses main bet (already deducted)
        console.log(`${agent.name}: Loses to dealer blackjack (-$${agent.resources.currentBet})`);
      }

      agent.resources.currentBet = 0;
    });

    // End the round
    this.engine.session.change("dealer blackjack", (doc) => {
      doc.gameLoop.running = false;
      doc.gameLoop.phase = "complete";
    });

    return true;
  }

  split() {
    const agent = this.engine.loop.activeAgent;
    if (!agent) return;

    const cards = this.engine.space.zone(agent.handZone).map(p => p.tokenSnapshot);
    if (!canSplit(cards)) {
      console.error("Cannot split - must have exactly 2 cards of the same rank");
      return;
    }

    // Check if agent can afford to split
    if (agent.resources.bankroll < agent.resources.currentBet) {
      console.error("Insufficient funds to split");
      return;
    }

    // Store the original bet for the split hand (before any doubling)
    agent.resources.splitHandBet = agent.resources.currentBet;

    // Deduct split bet from bankroll
    agent.resources.bankroll -= agent.resources.currentBet;

    // Create split hand zone for this agent
    const splitHandZone = `${agent.handZone}-split`;
    if (!this.engine.space.zones.includes(splitHandZone)) {
      this.engine.space.createZone(splitHandZone);
    }

    // Move second card to split hand
    const agentHandPlacements = this.engine.space.zone(agent.handZone);
    if (agentHandPlacements.length >= 2) {
      const secondCard = agentHandPlacements[1];
      this.engine.space.move(secondCard.id, agent.handZone, splitHandZone);
    }

    // Deal one card to each hand
    const card1 = this.engine.stack.draw();
    const card2 = this.engine.stack.draw();
    if (card1) this.engine.space.place(agent.handZone, card1, { faceUp: true });
    if (card2) this.engine.space.place(splitHandZone, card2, { faceUp: true });

    // Mark that this agent has split, starting with first hand
    agent.resources.hasSplit = 1;
    agent.resources.splitHandZone = splitHandZone;
    agent.resources.playingSplitHand = 0; // Start with first hand

    console.log(`${agent.name} split their hand! Playing first hand...`);
  }

  playDealer() {
    if (!this.isHost) return;

    console.log("🤖 Dealer playing...");

    // Variant-specific dealer card handling
    if (this.variant === 'european') {
      // European: Deal hole card now (after all players finish)
      const holeCard = this.engine.stack.draw();
      if (holeCard) this.engine.space.place("dealer-hand", holeCard, { faceUp: true });
    } else {
      // American: Reveal hidden card
      const dealerHand = this.engine.space.zone("dealer-hand");
      if (dealerHand[0]) {
        this.engine.space.flip("dealer-hand", dealerHand[0].id, true);
      }
    }

    let cards = this.engine.space.zone("dealer-hand").map(p => p.tokenSnapshot);
    let val = getBestHandValue(cards);
    
    while (val < 17) {
      const card = this.engine.stack.draw(); 
      if (!card) break;
      
      this.engine.space.place("dealer-hand", card, { faceUp: true });
      cards = this.engine.space.zone("dealer-hand").map(p => p.tokenSnapshot);
      val = getBestHandValue(cards);
    }

    this.resolveBets();
  }

  resolveBets() {
    const dealerCards = this.engine.space.zone("dealer-hand").map(p => p.tokenSnapshot);
    const dealerHasBlackjack = isBlackjack(dealerCards);

    this.engine._agents.forEach(agent => {
      if (agent.resources.currentBet === 0) return;

      // Resolve insurance bet first
      if (agent.resources.insuranceBet && agent.resources.insuranceBet > 0) {
        if (dealerHasBlackjack) {
          const insurancePayout = agent.resources.insuranceBet * 3; // 2:1 payout plus original bet
          agent.resources.bankroll += insurancePayout;
          console.log(`${agent.name}: Insurance wins! (+$${agent.resources.insuranceBet * 2})`);
        } else {
          console.log(`${agent.name}: Insurance loses (-$${agent.resources.insuranceBet})`);
        }
        agent.resources.insuranceBet = 0;
      }

      // Handle split hands
      if (agent.resources.hasSplit) {
        const hand1Cards = this.engine.space.zone(agent.handZone).map(p => p.tokenSnapshot);
        const hand2Cards = this.engine.space.zone(agent.resources.splitHandZone).map(p => p.tokenSnapshot);

        // Use tracked bets: currentBet for hand 1, splitHandBet for hand 2
        const hand1Bet = agent.resources.currentBet;
        const hand2Bet = agent.resources.splitHandBet;

        // Resolve first hand
        if (!isBusted(hand1Cards)) {
          const result1 = determineWinner(hand1Cards, dealerCards);
          const payout1 = this.calculatePayout(result1, hand1Bet);
          if (payout1 > 0) agent.resources.bankroll += payout1;
          console.log(`${agent.name} (Hand 1): ${result1} (+$${payout1})`);
        } else {
          console.log(`${agent.name} (Hand 1): BUST (-$${hand1Bet})`);
        }

        // Resolve second hand
        if (!isBusted(hand2Cards)) {
          const result2 = determineWinner(hand2Cards, dealerCards);
          const payout2 = this.calculatePayout(result2, hand2Bet);
          if (payout2 > 0) agent.resources.bankroll += payout2;
          console.log(`${agent.name} (Hand 2): ${result2} (+$${payout2})`);
        } else {
          console.log(`${agent.name} (Hand 2): BUST (-$${hand2Bet})`);
        }

        // Reset split state
        agent.resources.hasSplit = 0;
        agent.resources.splitHandBet = 0;
        agent.resources.playingSplitHand = 0;
      } else {
        // Regular single hand
        const agentCards = this.engine.space.zone(agent.handZone).map(p => p.tokenSnapshot);

        if (agent.resources.busted) {
          console.log(`${agent.name}: BUST (-$${agent.resources.currentBet})`);
          agent.resources.currentBet = 0;
          return;
        }

        const result = determineWinner(agentCards, dealerCards);
        const payout = this.calculatePayout(result, agent.resources.currentBet);

        if (payout > 0) {
          agent.resources.bankroll += payout;
        }

        console.log(`${agent.name}: ${result} (+$${payout})`);
      }

      agent.resources.currentBet = 0;
    });
  }

  calculatePayout(result, bet) {
    if (result === "agent-blackjack") return bet * 2.5;
    if (result === "agent") return bet * 2;
    if (result === "push") return bet;
    return 0;
  }
}