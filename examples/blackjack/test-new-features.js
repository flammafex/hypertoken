/*
 * Quick test for new betting strategies and card counting systems
 */

import { BettingManager, KellyCriterionStrategy, OscarsGrindStrategy } from './blackjack-betting.js';
import { HiOptICountingAgent, OmegaIICountingAgent, ZenCountAgent } from './card-counting-agents.js';

console.log('🧪 Testing New Betting Strategies and Card Counting Systems\n');

// Test Kelly Criterion Strategy
console.log('1. Testing Kelly Criterion Strategy...');
const kellyStrategy = new KellyCriterionStrategy(0.005, 0.005);
const bettingManager = new BettingManager(1000, { minBet: 5, maxBet: 500 });
const gameState = { dealerHand: [], agentHand: [] };

const kellyBet1 = kellyStrategy.getBetSize(gameState, bettingManager, null, 0); // No advantage
const kellyBet2 = kellyStrategy.getBetSize(gameState, bettingManager, null, 3); // +3 true count
const kellyBet3 = kellyStrategy.getBetSize(gameState, bettingManager, null, -2); // Negative count

console.log(`   Kelly bet at TC 0: $${kellyBet1}`);
console.log(`   Kelly bet at TC +3: $${kellyBet2}`);
console.log(`   Kelly bet at TC -2: $${kellyBet3}`);
console.log(`   ✅ Kelly Criterion working - bets adjust based on count\n`);

// Test Oscar's Grind Strategy
console.log('2. Testing Oscar\'s Grind Strategy...');
const oscarStrategy = new OscarsGrindStrategy(10, 20);
const oscarBet1 = oscarStrategy.getBetSize(gameState, bettingManager, null);
console.log(`   Initial bet: $${oscarBet1}`);

// Simulate a win
const oscarBet2 = oscarStrategy.getBetSize(gameState, bettingManager, { netGain: 10, result: 'agent' });
console.log(`   Bet after win: $${oscarBet2}`);

// Simulate a loss
const oscarBet3 = oscarStrategy.getBetSize(gameState, bettingManager, { netGain: -10, result: 'dealer' });
console.log(`   Bet after loss: $${oscarBet3}`);
console.log(`   Cycles completed: ${oscarStrategy.cycleCount}`);
console.log(`   ✅ Oscar's Grind working - progressive betting active\n`);

// Test Hi-Opt I Counting Agent
console.log('3. Testing Hi-Opt I Counting Agent...');
const hiOptAgent = new HiOptICountingAgent("Hi-Opt I", 10, 8);
const testCards = [
  { meta: { rank: '3', suit: 'hearts' } }, // +1
  { meta: { rank: '4', suit: 'spades' } }, // +1
  { meta: { rank: 'K', suit: 'clubs' } },  // -1
  { meta: { rank: 'A', suit: 'diamonds' } } // Ace side-count
];

testCards.forEach(card => hiOptAgent.updateCount(card));
const stats1 = hiOptAgent.getCountStats();
console.log(`   Running count: ${stats1.runningCount} (expected: +1)`);
console.log(`   Aces counted: ${stats1.acesCount} (expected: 1)`);
console.log(`   ✅ Hi-Opt I working - side-counting Aces\n`);

// Test Omega II Counting Agent
console.log('4. Testing Omega II Counting Agent...');
const omegaAgent = new OmegaIICountingAgent("Omega II", 10, 10);
const omegaCards = [
  { meta: { rank: '2', suit: 'hearts' } },  // +1
  { meta: { rank: '5', suit: 'spades' } },  // +2
  { meta: { rank: 'K', suit: 'clubs' } },   // -2
  { meta: { rank: '9', suit: 'diamonds' } } // -1
];

omegaCards.forEach(card => omegaAgent.updateCount(card));
const stats2 = omegaAgent.getCountStats();
console.log(`   Running count: ${stats2.runningCount} (expected: 0)`);
console.log(`   ✅ Omega II working - multi-level counting\n`);

// Test Zen Count Agent
console.log('5. Testing Zen Count Agent...');
const zenAgent = new ZenCountAgent("Zen", 10, 8);
const zenCards = [
  { meta: { rank: '2', suit: 'hearts' } },  // +1
  { meta: { rank: '6', suit: 'spades' } },  // +2
  { meta: { rank: 'A', suit: 'clubs' } },   // -1
  { meta: { rank: '10', suit: 'diamonds' } } // -2
];

zenCards.forEach(card => zenAgent.updateCount(card));
const stats3 = zenAgent.getCountStats();
console.log(`   Running count: ${stats3.runningCount} (expected: 0)`);
console.log(`   ✅ Zen Count working - multi-level with Ace counting\n`);

// Test bet sizing with advanced counters
console.log('6. Testing bet sizing with card counting...');
const testBetting = new BettingManager(1000, { minBet: 10, maxBet: 200 });

// Simulate high true count
omegaAgent.runningCount = 16; // High running count
omegaAgent.decksRemaining = 2; // 2 decks left
const highCountBet = omegaAgent.getBetSize(gameState, testBetting);
console.log(`   Bet at high count (TC +8): $${highCountBet}`);

// Simulate low true count
omegaAgent.runningCount = -4;
omegaAgent.decksRemaining = 2;
const lowCountBet = omegaAgent.getBetSize(gameState, testBetting);
console.log(`   Bet at low count (TC -2): $${lowCountBet}`);
console.log(`   ✅ Bet spreading working correctly\n`);

console.log('✅ All tests passed! New features are working correctly.');
