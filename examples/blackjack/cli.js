#!/usr/bin/env node
/**
 * CLI Blackjack Game
 * Play blackjack in your terminal using HyperToken
 *
 * Usage:
 *   node cli.js              - Play without betting
 *   node cli.js --betting    - Play with betting system
 */

import readline from 'readline/promises';
import { stdin as input, stdout as output } from 'process';
import { BlackjackGame } from './game.js';
import { BettingManager, getPayoutMessage, formatSessionStats } from './blackjack-betting.js';

const rl = readline.createInterface({ input, output });

// Check for betting mode
const useBetting = process.argv.includes('--betting') || process.argv.includes('-b');

function clearScreen() {
  console.log('\x1Bc');
}

function printBanner(bettingMode = false) {
  console.log('\n╔════════════════════════════════════════╗');
  console.log('║        🎰 HYPERTOKEN BLACKJACK 🎰      ║');
  if (bettingMode) {
    console.log('║           💰 BETTING MODE 💰           ║');
  }
  console.log('╚════════════════════════════════════════╝\n');
}

function printGameState(state, bettingManager = null) {
  console.log('\n' + '─'.repeat(50));

  if (bettingManager) {
    console.log(`\n${bettingManager.getStatus()}`);
  }

  console.log(`\n🎴 DEALER: ${state.dealerHand.display}`);
  console.log(`\n🎴 PLAYER: ${state.agentHand.display}`);
  console.log('\n' + '─'.repeat(50));
}

function printSplitGameState(splitState, bettingManager = null) {
  console.log('\n' + '─'.repeat(50));

  if (bettingManager) {
    console.log(`\n${bettingManager.getStatus()}`);
  }

  console.log(`\n🎴 DEALER: ${splitState.dealerHand.display}`);

  // Print all split hands
  splitState.splitHands.forEach((hand, index) => {
    const handLabel = index === 0 ? 'HAND 1' : `HAND ${index + 1}`;
    const activeMarker = hand.active ? ' 👉 [ACTIVE]' : '';
    const stoodMarker = hand.stood ? ' [STOOD]' : '';
    const bustedMarker = hand.busted ? ' 💥 [BUST]' : '';

    console.log(`\n🎴 ${handLabel}${activeMarker}${stoodMarker}${bustedMarker}: ${hand.display} (${hand.value})`);
  });

  console.log('\n' + '─'.repeat(50));
}

async function playSplitHands(game, splitState, bettingManager = null) {
  // Play each split hand sequentially
  while (!splitState.gameOver) {
    clearScreen();
    printBanner(bettingManager !== null);
    printSplitGameState(splitState, bettingManager);

    // Find the active hand
    const currentHandIndex = splitState.currentHand;
    const currentHand = splitState.splitHands[currentHandIndex];

    if (!currentHand) {
      // No more hands to play (shouldn't happen)
      break;
    }

    console.log(`\n💭 Playing Hand ${currentHandIndex + 1}...`);

    // Build available actions
    const choices = [];
    if (!currentHand.busted && !currentHand.stood) {
      choices.push('[H]it');
      choices.push('[S]tand');

      if (currentHand.cards.length === 2) {
        choices.push('[D]ouble');
      }

      if (currentHand.canReSplit) {
        choices.push('Sp[L]it again');
      }
    }

    if (choices.length === 0) {
      // Hand is done, move to next
      break;
    }

    console.log(choices.join('  '));

    const answer = await rl.question('\nYour choice: ');
    const choice = answer.trim().toLowerCase();

    try {
      if (choice === 'h' || choice === 'hit') {
        splitState = game.hitSplitHand();

        // Check if busted
        const updatedHand = splitState.splitHands[currentHandIndex];
        if (updatedHand.busted) {
          clearScreen();
          printBanner(bettingManager !== null);
          printSplitGameState(splitState, bettingManager);
          console.log(`\n💥 BUST on Hand ${currentHandIndex + 1}!`);
          await new Promise(resolve => setTimeout(resolve, 1500));
        }
      } else if (choice === 's' || choice === 'stand') {
        splitState = game.standSplitHand();
      } else if ((choice === 'd' || choice === 'double') && currentHand.cards.length === 2) {
        console.log('\n💎 Doubling down on this hand!');

        // Update betting manager for this split hand
        if (bettingManager) {
          try {
            bettingManager.doubleDown();
          } catch (err) {
            console.log(`❌ ${err.message}`);
            continue;
          }
        }

        splitState = game.doubleDownSplitHand();
      } else if ((choice === 'l' || choice === 'split') && currentHand.canReSplit) {
        console.log('\n✂️  Re-splitting this hand!');

        // Place additional bet for re-split
        if (bettingManager) {
          try {
            bettingManager.split();
          } catch (err) {
            console.log(`❌ ${err.message}`);
            continue;
          }
        }

        splitState = game.reSplit(currentHandIndex);
      } else {
        console.log('❌ Invalid choice or action not available.');
      }
    } catch (err) {
      console.log(`❌ ${err.message}`);
    }
  }

  // All hands complete - show final results
  clearScreen();
  printBanner(bettingManager !== null);
  printSplitGameState(splitState, bettingManager);

  console.log('\n' + '═'.repeat(50));
  console.log('FINAL RESULTS');
  console.log('═'.repeat(50));

  // Show results for each hand
  let totalPayout = 0;
  splitState.results.forEach((result, index) => {
    const handLabel = `Hand ${index + 1}`;
    let resultText = '';
    let payout = 0;

    if (bettingManager) {
      const payoutDetails = bettingManager.resolveSplitHand(index, result.result);
      payout = payoutDetails.netGain;
      totalPayout += payout;

      if (result.result === 'agent-blackjack') {
        resultText = `🎰 BLACKJACK! +$${payout}`;
      } else if (result.result === 'agent') {
        resultText = `✅ WIN! +$${payout}`;
      } else if (result.result === 'push') {
        resultText = `🤝 PUSH (tie)`;
      } else {
        resultText = `❌ LOSE -$${Math.abs(payout)}`;
      }
    } else {
      resultText = result.result === 'agent-blackjack' ? 'BLACKJACK!' :
                   result.result === 'agent' ? 'WIN!' :
                   result.result === 'push' ? 'PUSH' : 'LOSE';
    }

    console.log(`\n${handLabel}: ${result.display} (${result.value}) - ${resultText}`);
  });

  if (bettingManager) {
    console.log('\n' + '─'.repeat(50));
    const totalSign = totalPayout >= 0 ? '+' : '';
    console.log(`\n💰 Total for this round: ${totalSign}$${totalPayout.toFixed(2)}`);
    console.log(`💵 New Bankroll: $${bettingManager.bankroll.toFixed(2)}`);

    // Clear split bets for next round
    bettingManager.clearSplitBets();
  }

  return true;
}

async function playRound(game, bettingManager = null) {
  let betAmount = 0;

  // Betting phase
  if (bettingManager) {
    if (bettingManager.isBroke()) {
      console.log('\n💔 You\'re broke! Game over.');
      return false;
    }

    console.log(`\n${bettingManager.getStatus()}`);
    console.log(`Min bet: $${bettingManager.minBet} | Max bet: $${bettingManager.maxBet}`);

    let validBet = false;
    while (!validBet) {
      const betInput = await rl.question('\nPlace your bet: $');
      betAmount = parseFloat(betInput);

      try {
        bettingManager.placeBet(betAmount);
        validBet = true;
      } catch (err) {
        console.log(`❌ ${err.message}`);
      }
    }
  }

  // Deal initial cards
  let state = game.deal();

  clearScreen();
  printBanner(bettingManager !== null);
  printGameState(state, bettingManager);

  // Check for immediate blackjack
  if (state.agentHand.blackjack) {
    console.log('\n' + game.getResultMessage());

    if (bettingManager) {
      const payoutDetails = bettingManager.resolveBet(state.result);
      console.log('\n' + getPayoutMessage(payoutDetails));
    }
    return true;
  }

  // Check for insurance opportunity
  if (state.canInsurance) {
    const insuranceAnswer = await rl.question('\n🛡️  Dealer shows an Ace. Take insurance? (y/n): ');
    if (insuranceAnswer.trim().toLowerCase() === 'y') {
      try {
        game.takeInsurance();
        console.log('✅ Insurance placed!');
      } catch (err) {
        console.log(`❌ ${err.message}`);
      }
    }
  }

  // Agent's turn
  while (state.canHit || state.canStand) {
    console.log('\n💭 What would you like to do?');

    const choices = [];
    if (state.canHit) choices.push('[H]it');
    if (state.canStand) choices.push('[S]tand');
    if (state.canDouble) choices.push('[D]ouble');
    if (state.canSplit) choices.push('Sp[L]it');

    console.log(choices.join('  '));

    const answer = await rl.question('\nYour choice: ');
    const choice = answer.trim().toLowerCase();

    if (choice === 'h' || choice === 'hit') {
      state = game.hit();
      clearScreen();
      printBanner(bettingManager !== null);
      printGameState(state, bettingManager);

      if (state.agentHand.busted) {
        console.log('\n💥 BUST! You went over 21.');
        console.log(game.getResultMessage());

        if (bettingManager) {
          const payoutDetails = bettingManager.resolveBet(state.result);
          console.log('\n' + getPayoutMessage(payoutDetails));
        }
        return true;
      }
    } else if (choice === 's' || choice === 'stand') {
      state = game.stand();
      clearScreen();
      printBanner(bettingManager !== null);
      printGameState(state, bettingManager);
      console.log('\n' + game.getResultMessage());

      if (bettingManager) {
        const payoutDetails = bettingManager.resolveBet(state.result);
        console.log('\n' + getPayoutMessage(payoutDetails));
      }
      return true;
    } else if ((choice === 'd' || choice === 'double') && state.canDouble) {
      console.log('\n💎 Doubling down!');

      // Update betting manager to reflect the doubled bet
      if (bettingManager) {
        try {
          bettingManager.doubleDown();
        } catch (err) {
          console.log(`❌ ${err.message}`);
          continue;
        }
      }

      state = game.doubleDown();
      clearScreen();
      printBanner(bettingManager !== null);
      printGameState(state, bettingManager);
      console.log('\n' + game.getResultMessage());

      if (bettingManager) {
        const payoutDetails = bettingManager.resolveBet(state.result);
        console.log('\n' + getPayoutMessage(payoutDetails));
      }
      return true;
    } else if ((choice === 'l' || choice === 'split') && state.canSplit) {
      console.log('\n✂️  Splitting hand!');

      // Place split bet in betting manager
      if (bettingManager) {
        try {
          bettingManager.split();
        } catch (err) {
          console.log(`❌ ${err.message}`);
          continue;
        }
      }

      // Split the hand
      let splitState = game.split();

      // Play each split hand
      const continueGame = await playSplitHands(game, splitState, bettingManager);

      return continueGame;
    } else {
      console.log('❌ Invalid choice or action not available.');
    }
  }

  // Show final result
  if (state.gameOver) {
    console.log('\n' + game.getResultMessage());

    if (bettingManager) {
      const payoutDetails = bettingManager.resolveBet(state.result);
      console.log('\n' + getPayoutMessage(payoutDetails));
    }
  }

  return true;
}

async function main() {
  clearScreen();
  printBanner(useBetting);

  console.log('Welcome to HyperToken Blackjack!');
  console.log('Standard rules: Dealer hits on 16, stands on 17.');
  console.log('🎰 Full casino experience with Double Down, Split, and Insurance!\n');

  // Setup betting manager if in betting mode
  let bettingManager = null;
  if (useBetting) {
    const bankrollInput = await rl.question('Enter your starting bankroll (default: $1000): $');
    const initialBankroll = parseFloat(bankrollInput) || 1000;
    bettingManager = new BettingManager(initialBankroll, { minBet: 5, maxBet: 500 });
    console.log(`\n💰 Starting with $${initialBankroll.toFixed(2)}\n`);
  }

  // Ask for seed (optional)
  const seedAnswer = await rl.question('Enter a seed for deterministic play (or press Enter for random): ');
  const seed = seedAnswer.trim() ? parseInt(seedAnswer) : null;

  const game = new BlackjackGame({ numStacks: 6, seed });

  let playing = true;

  while (playing) {
    const continueGame = await playRound(game, bettingManager);

    if (!continueGame) {
      playing = false;
      break;
    }

    console.log('\n' + '─'.repeat(50));
    const again = await rl.question('\nPlay another round? (y/n): ');

    if (again.trim().toLowerCase() !== 'y') {
      playing = false;
    } else {
      game.newRound();
    }
  }

  // Show final stats if using betting
  if (bettingManager) {
    console.log(formatSessionStats(bettingManager.getStats()));
  }

  console.log('\n👋 Thanks for playing HyperToken Blackjack!\n');
  rl.close();
}

main().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});