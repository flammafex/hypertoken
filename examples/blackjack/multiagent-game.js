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

export class MultiagentBlackjackGame {
  constructor(engine, { 
    isHost = false,
    numAgents = 2, 
    numStacks = 6, 
    seed = null, 
    initialBankroll = 1000,
    agentNames = null
  } = {}) {
    this.engine = engine;
    this.numAgents = numAgents;
    this.isHost = isHost;
    
    if (!this.engine.stack) {
      let allTokens = [];
      if (isHost) {
        try {
          const stackData = JSON.parse(
            readFileSync('./examples/blackjack/token-sets/standard-stack.json', 'utf8')
          );
          const baseTokens = parseTokenSetObject(stackData).tokens;
          for (let i = 0; i < numStacks; i++) {
            const stackCopy = baseTokens.map(t => ({ ...t, id: `${t.id}-${i}` }));
            allTokens.push(...stackCopy);
          }
        } catch (e) {
          console.error("Failed to load stack file (Host):", e.message);
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
    });

    this.engine.space.collectAllInto(this.engine.stack); 
    
    for (let i = 0; i < 2; i++) {
      this.engine._agents.forEach(agent => {
        if (agent.resources.currentBet > 0) { 
          const card = this.engine.stack.draw();
          if (card) this.engine.space.place(agent.handZone, card, { faceUp: true });
        }
      });
      
      const dealerCard = this.engine.stack.draw();
      const faceUp = i === 1; 
      if (dealerCard) this.engine.space.place("dealer-hand", dealerCard, { faceUp });
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

  hit() {
    const agent = this.engine.loop.activeAgent;
    if (!agent) return;

    const card = this.engine.stack.draw();
    if (!card) {
        console.error("Stack empty!");
        return;
    }

    this.engine.space.place(agent.handZone, card, { faceUp: true });

    const cards = this.engine.space.zone(agent.handZone).map(p => p.tokenSnapshot);
    if (isBusted(cards)) {
      console.log(`💥 ${agent.name} Busted!`);
      agent.resources.busted = 1;
      this.nextAgent();
    }
  }

  stand() {
    const agent = this.engine.loop.activeAgent;
    if (agent) {
      agent.resources.stood = 1;
      this.nextAgent();
    }
  }

  playDealer() {
    if (!this.isHost) return;
    
    console.log("🤖 Dealer playing...");
    
    const dealerHand = this.engine.space.zone("dealer-hand");
    if (dealerHand[0]) {
      this.engine.space.flip("dealer-hand", dealerHand[0].id, true);
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
    
    this.engine._agents.forEach(agent => {
      if (agent.resources.currentBet === 0) return;

      const agentCards = this.engine.space.zone(agent.handZone).map(p => p.tokenSnapshot);
      
      if (agent.resources.busted) {
         console.log(`${agent.name}: BUST (-$${agent.resources.currentBet})`);
         agent.resources.currentBet = 0;
         return;
      }

      const result = determineWinner(agentCards, dealerCards);
      
      let payout = 0;
      const bet = agent.resources.currentBet;

      if (result === "agent-blackjack") payout = bet * 2.5;
      else if (result === "agent") payout = bet * 2;
      else if (result === "push") payout = bet;
      
      if (payout > 0) {
        agent.resources.bankroll += payout;
      }
      
      agent.resources.currentBet = 0; 
      console.log(`${agent.name}: ${result} (+$${payout})`);
    });
  }
}