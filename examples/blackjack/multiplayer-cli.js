#!/usr/bin/env node
/**
 * Multi-player Blackjack CLI
 * Play blackjack with multiple human players at one table
 */

import readline from 'readline/promises';
import { stdin as input, stdout as output } from 'process';
import { MultiplayerBlackjackGame } from './multiplayer-game.js';

const rl = readline.createInterface({ input, output });

function clearScreen() {
  console.log('\x1Bc');
}

function printBanner() {
  console.log('\n╔════════════════════════════════════════════════════╗');
  console.log('║     🎰 MULTIPLAYER HYPERTOKEN BLACKJACK 💰        ║');
  console.log('╚════════════════════════════════════════════════════╝\n');
}

function printTable(state) {
  console.log('\n' + '═'.repeat(60));
  console.log('🎴 DEALER: ' + state.dealer.display);
  if (state.dealer.value !== null) {
    console.log(`   Value: ${state.dealer.value}`);
  }
  console.log('═'.repeat(60));
  
  for (const player of state.players) {
    if (!player.isActive) continue;
    
    const marker = state.currentPlayerIndex === player.seat && !state.gameOver ? '👉 ' : '   ';
    const status = player.busted ? ' [BUST]' : 
                   player.blackjack ? ' [BLACKJACK]' : 
                   player.stood ? ' [STAND]' : '';
    
    console.log(`\n${marker}${player.name} (Seat ${player.seat + 1})${status}`);
    console.log(`   Cards: ${player.display}`);
    console.log(`   Value: ${player.value} | Bet: $${player.currentBet} | Bankroll: $${player.bankroll.toFixed(2)}`);
    
    if (player.result && state.gameOver) {
      const resultMsg = player.result === 'player-blackjack' ? '🎰 BLACKJACK!' :
                       player.result === 'player' ? '🎉 WIN!' :
                       player.result === 'push' ? '🤝 PUSH' :
                       '😞 LOSE';
      console.log(`   Result: ${resultMsg}`);
      if (player.payout) {
        console.log(`   Payout: $${player.payout.payout.toFixed(2)} (Net: ${player.payout.netGain >= 0 ? '+' : ''}$${player.payout.netGain.toFixed(2)})`);
      }
    }
  }
  console.log('\n' + '═'.repeat(60));
}

async function collectBets(game) {
  console.log('\n💰 PLACE YOUR BETS\n');
  const bets = [];
  
  for (let i = 0; i < game.numPlayers; i++) {
    const player = game.players[i];
    console.log(`${player.name} - Bankroll: $${player.bettingManager.bankroll.toFixed(2)}`);
    console.log(`Min: $${player.bettingManager.minBet} | Max: $${player.bettingManager.maxBet}`);
    
    while (true) {
      const answer = await rl.question(`  Bet amount: $`);
      const amount = parseFloat(answer.trim());
      
      if (isNaN(amount) || amount < player.bettingManager.minBet) {
        console.log(`  ❌ Minimum bet is $${player.bettingManager.minBet}`);
        continue;
      }
      
      if (amount > player.bettingManager.maxBet) {
        console.log(`  ❌ Maximum bet is $${player.bettingManager.maxBet}`);
        continue;
      }
      
      if (amount > player.bettingManager.bankroll) {
        console.log(`  ❌ Insufficient funds`);
        continue;
      }
      
      bets.push(amount);
      break;
    }
    console.log('');
  }
  
  game.collectBets(bets);
}

async function playRound(game) {
  // Collect bets
  await collectBets(game);
  console.log('DEBUG: Bets placed:', game.players.map(p => ({name: p.name, bet: p.currentBet})));
  // Deal
  let state = game.deal();
  
  clearScreen();
  printBanner();
  console.log('DEBUG: Bets placed:', game.players.map(p => ({name: p.name, bet: p.currentBet})));
  printTable(state);
  
  // Check for immediate blackjacks
  const allBlackjackOrStood = state.players
    .filter(p => p.isActive)
    .every(p => p.blackjack || p.stood);
  
  if (allBlackjackOrStood) {
    console.log('\n⚡ All players have blackjack or are done!');
    await rl.question('Press Enter to continue...');
    return;
  }
  
  // Each player's turn
  while (!state.gameOver && !state.allPlayersFinished) {
    const currentPlayer = game.getCurrentPlayer();
    
    if (currentPlayer.stood || currentPlayer.busted) {
      game.nextPlayer();
      state = game.getGameState();
      continue;
    }
    
    console.log(`\n🎯 ${currentPlayer.name}'s turn`);
    console.log('What would you like to do?');
    console.log('[H]it  [S]tand');
    
    const answer = await rl.question('\nYour choice: ');
    const choice = answer.trim().toLowerCase();
    
    if (choice === 'h' || choice === 'hit') {
      state = game.hit();
      clearScreen();
      printBanner();
      printTable(state);
      
      if (currentPlayer.busted) {
        console.log(`\n💥 ${currentPlayer.name} BUSTED!`);
        await rl.question('Press Enter to continue...');
      }
    } else if (choice === 's' || choice === 'stand') {
      state = game.stand();
      clearScreen();
      printBanner();
      printTable(state);
      console.log(`\n✋ ${currentPlayer.name} stands`);
      await rl.question('Press Enter to continue...');
    } else {
      console.log('Invalid choice. Please enter H or S.');
    }
  }
  
  // Show final results
  if (state.gameOver) {
    clearScreen();
    printBanner();
    console.log('\n🎊 ROUND COMPLETE! 🎊');
    printTable(state);
  }
}

async function main() {
  clearScreen();
  printBanner();
  
  console.log('Welcome to Multiplayer HyperToken Blackjack!\n');
  console.log('Rules:');
  console.log('- 2-6 players at one table');
  console.log('- Dealer hits on 16, stands on 17');
  console.log('- Blackjack pays 3:2\n');
  
  // Get number of players
  const numPlayersAnswer = await rl.question('How many players? (2-6): ');
  const numPlayers = parseInt(numPlayersAnswer.trim());
  
  if (isNaN(numPlayers) || numPlayers < 2 || numPlayers > 6) {
    console.log('Invalid number. Must be 2-6 players.');
    rl.close();
    return;
  }
  
  // Get player names
  const playerNames = [];
  for (let i = 0; i < numPlayers; i++) {
    const nameAnswer = await rl.question(`Player ${i + 1} name (or press Enter for default): `);
    playerNames.push(nameAnswer.trim() || `Player ${i + 1}`);
  }
  
  // Get initial bankroll
  const bankrollAnswer = await rl.question('\nStarting bankroll per player (default $1000): $');
  const initialBankroll = bankrollAnswer.trim() ? parseFloat(bankrollAnswer) : 1000;
  
  // Optional seed
  const seedAnswer = await rl.question('Seed for deterministic play (or press Enter for random): ');
  const seed = seedAnswer.trim() ? parseInt(seedAnswer) : null;
  
  // Create game
  const game = new MultiplayerBlackjackGame({
    numPlayers,
    numDecks: 6,
    seed,
    initialBankroll,
    minBet: 5,
    maxBet: 500,
    playerNames
  });
  
  let playing = true;
  
  while (playing) {
    // Check if any player can still play
    const canContinue = game.players.some(p => !p.bettingManager.isBroke());
    
    if (!canContinue) {
      console.log('\n💔 All players are broke! Game over.\n');
      break;
    }
    
    await playRound(game);
    
    console.log('\n' + '─'.repeat(60));
    const again = await rl.question('\nPlay another round? (y/n/stats): ');
    const choice = again.trim().toLowerCase();
    
    if (choice === 'stats') {
      console.log('\n╔════════════════════════════════════════════════════╗');
      console.log('║              PLAYER STATISTICS                     ║');
      console.log('╚════════════════════════════════════════════════════╝\n');
      
      const allStats = game.getAllStats();
      for (const { name, stats } of allStats) {
        console.log(`${name}:`);
        console.log(`  Hands: ${stats.handsPlayed} | Win Rate: ${stats.winRate}%`);
        console.log(`  Bankroll: $${stats.currentBankroll.toFixed(2)} | Net: ${stats.netProfit >= 0 ? '+' : ''}$${stats.netProfit.toFixed(2)}\n`);
      }
      
      const continueAnswer = await rl.question('Continue playing? (y/n): ');
      if (continueAnswer.trim().toLowerCase() !== 'y') {
        playing = false;
      } else {
        game.newRound();
      }
    } else if (choice !== 'y') {
      playing = false;
    } else {
      game.newRound();
    }
  }
  
  console.log('\n╔════════════════════════════════════════════════════╗');
  console.log('║            FINAL STATISTICS                        ║');
  console.log('╚════════════════════════════════════════════════════╝\n');
  
  const allStats = game.getAllStats();
  for (const { name, stats } of allStats) {
    const profitSign = stats.netProfit >= 0 ? '+' : '';
    console.log(`🎲 ${name}`);
    console.log(`   Hands Played: ${stats.handsPlayed}`);
    console.log(`   Win Rate: ${stats.winRate}%`);
    console.log(`   Final Bankroll: $${stats.currentBankroll.toFixed(2)}`);
    console.log(`   Net Profit: ${profitSign}$${stats.netProfit.toFixed(2)}\n`);
  }
  
  console.log('\n👋 Thanks for playing Multiplayer HyperToken Blackjack!\n');
  rl.close();
}

main().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});