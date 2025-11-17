#!/usr/bin/env node
/**
 * CLI Blackjack Game
 * Play blackjack in your terminal using HyperToken
 */ 

import readline from 'readline/promises';
import { stdin as input, stdout as output } from 'process';
import { BlackjackGame } from './game.js';

const rl = readline.createInterface({ input, output });

function clearScreen() {
  console.log('\x1Bc');
}

function printBanner() {
  console.log('\n╔════════════════════════════════════════╗');
  console.log('║        🎰 HYPERTOKEN BLACKJACK 🎰      ║');
  console.log('╚════════════════════════════════════════╝\n');
}

function printGameState(state) {
  console.log('\n' + '─'.repeat(50));
  console.log(`\n🎴 DEALER: ${state.dealerHand.display}`);
  console.log(`\n🎴 PLAYER: ${state.playerHand.display}`);
  console.log('\n' + '─'.repeat(50));
}

async function playRound(game) {
  // Deal initial cards
  let state = game.deal();
  
  clearScreen();
  printBanner();
  printGameState(state);
  
  // Check for immediate blackjack
  if (state.playerHand.blackjack) {
    console.log('\n' + game.getResultMessage());
    return;
  }
  
  // Player's turn
  while (state.canHit || state.canStand) {
    console.log('\nWhat would you like to do?');
    
    const choices = [];
    if (state.canHit) choices.push('[H]it');
    if (state.canStand) choices.push('[S]tand');
    
    console.log(choices.join('  '));
    
    const answer = await rl.question('\nYour choice: ');
    const choice = answer.trim().toLowerCase();
    
    if (choice === 'h' || choice === 'hit') {
      state = game.hit();
      clearScreen();
      printBanner();
      printGameState(state);
      
      if (state.playerHand.busted) {
        console.log('\n💥 BUST! You went over 21.');
        console.log(game.getResultMessage());
        return;
      }
    } else if (choice === 's' || choice === 'stand') {
      state = game.stand();
      clearScreen();
      printBanner();
      printGameState(state);
      console.log('\n' + game.getResultMessage());
      return;
    } else {
      console.log('Invalid choice. Please enter H or S.');
    }
  }
  
  // Show final result
  if (state.gameOver) {
    console.log('\n' + game.getResultMessage());
  }
}

async function main() {
  clearScreen();
  printBanner();
  
  console.log('Welcome to HyperToken Blackjack!');
  console.log('Standard rules: Dealer hits on 16, stands on 17.\n');
  
  // Ask for seed (optional)
  const seedAnswer = await rl.question('Enter a seed for deterministic play (or press Enter for random): ');
  const seed = seedAnswer.trim() ? parseInt(seedAnswer) : null;
  
  const game = new BlackjackGame({ numDecks: 6, seed });
  
  let playing = true;
  
  while (playing) {
    await playRound(game);
    
    console.log('\n' + '─'.repeat(50));
    const again = await rl.question('\nPlay another round? (y/n): ');
    
    if (again.trim().toLowerCase() !== 'y') {
      playing = false;
    } else {
      game.newRound();
    }
  }
  
  console.log('\n👋 Thanks for playing HyperToken Blackjack!\n');
  rl.close();
}

main().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});