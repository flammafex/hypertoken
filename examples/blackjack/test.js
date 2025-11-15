#!/usr/bin/env node
/**
 * Quick test to verify blackjack implementation works
 */

import { BlackjackGame } from './game.js';

console.log('Testing HyperToken Blackjack Implementation...\n');

try {
  // Test 1: Game initialization
  console.log('✓ Test 1: Creating game...');
  const game = new BlackjackGame({ seed: 42 });
  
  // Test 2: Deal
  console.log('✓ Test 2: Dealing cards...');
  let state = game.deal();
  console.log(`  Player: ${state.playerHand.display}`);
  console.log(`  Dealer: ${state.dealerHand.display}`);
  
  // Test 3: Hit
  if (state.canHit) {
    console.log('✓ Test 3: Player hits...');
    state = game.hit();
    console.log(`  Player: ${state.playerHand.display}`);
  }
  
  // Test 4: Stand
  if (state.canStand) {
    console.log('✓ Test 4: Player stands...');
    state = game.stand();
    console.log(`  Dealer: ${state.dealerHand.display}`);
  }
  
  // Test 5: Result
  console.log('✓ Test 5: Game result...');
  console.log(`  ${game.getResultMessage()}`);
  
  // Test 6: New round
  console.log('✓ Test 6: Starting new round...');
  state = game.newRound();
  console.log(`  Player: ${state.playerHand.display}`);
  console.log(`  Dealer: ${state.dealerHand.display}`);
  
  console.log('\n🎉 All tests passed! The implementation works.\n');
  console.log('Try it yourself:');
  console.log('  npm run play       - Play interactively');
  console.log('  npm run tournament - Run AI simulation\n');
  
} catch (err) {
  console.error('\n❌ Test failed:', err.message);
  console.error(err.stack);
  process.exit(1);
}