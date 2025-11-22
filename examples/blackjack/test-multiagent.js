#!/usr/bin/env node
/**
 * Test multiagent game dealing
 */

import { Engine } from '../../engine/Engine.js';
import { MultiagentBlackjackGame } from './multiagent-game.js';
import { getBestHandValue } from './blackjack-utils.js';

const numAgents = 2;
const agentNames = ['Alice', 'Bob'];
const seed = 42;

// Initialize exactly like the CLI does
const engine = new Engine();
const game = new MultiagentBlackjackGame(engine, {
  isHost: true,
  numAgents,
  agentNames,
  initialBankroll: 1000,
  numStacks: 6,
  seed
});

console.log('\n=== After initialization ===');
engine._agents.forEach(a => {
  console.log(`${a.name}: handZone=${a.handZone}, bankroll=$${a.resources.bankroll}, bet=$${a.resources.currentBet}`);
});

// Place bets exactly like placeBets() does
console.log('\n=== Placing bets ===');
engine._agents[0].resources.currentBet = 40;
engine._agents[0].resources.bankroll -= 40;
console.log(`${engine._agents[0].name} bet $40`);

engine._agents[1].resources.currentBet = 30;
engine._agents[1].resources.bankroll -= 30;
console.log(`${engine._agents[1].name} bet $30`);

console.log('\n=== After betting ===');
engine._agents.forEach(a => {
  console.log(`${a.name}: bankroll=$${a.resources.bankroll}, bet=$${a.resources.currentBet}`);
});

// Deal exactly like playRound() does
console.log('\n=== Calling game.deal() ===');
game.deal();

console.log('\n=== After deal ===');
console.log(`Stack size: ${engine.stack.size}`);

// Check cards exactly like printGameState() does
engine._agents.forEach((agent, idx) => {
  const cards = engine.space.zone(agent.handZone);
  console.log(`\n${agent.name}:`);
  console.log(`  handZone: ${agent.handZone}`);
  console.log(`  cards in zone: ${cards.length}`);

  if (cards.length > 0) {
    const cardDisplay = cards.map(c => `[${c.tokenSnapshot.label}]`).join(' ');
    const tokens = cards.map(c => c.tokenSnapshot);
    const handValue = getBestHandValue(tokens);
    console.log(`  display: ${cardDisplay}`);
    console.log(`  value: ${handValue}`);
  } else {
    console.log(`  display: (waiting)`);
  }
});

const dealerCards = engine.space.zone('dealer-hand');
console.log(`\nDealer:`);
console.log(`  cards: ${dealerCards.length}`);
if (dealerCards.length > 0) {
  const dealerDisplay = dealerCards
    .map(c => c.faceUp ? `[${c.tokenSnapshot.label}]` : '[🂠]')
    .join(' ');
  console.log(`  display: ${dealerDisplay}`);
}
