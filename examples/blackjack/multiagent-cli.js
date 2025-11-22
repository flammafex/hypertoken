#!/usr/bin/env node
/**
 * Multi-Agent CLI Blackjack Game
 * Play blackjack with multiple agents (2-6) at one table
 *
 * Usage:
 *   node multiagent-cli.js [numAgents]
 *   Example: node multiagent-cli.js 3
 */

import readline from 'readline/promises';
import { stdin as input, stdout as output } from 'process';
import { Engine } from '../../engine/Engine.js';
import { MultiagentBlackjackGame } from './multiagent-game.js';
import { getBestHandValue } from './blackjack-utils.js';

const rl = readline.createInterface({ input, output });

// Parse command line arguments
const numAgents = parseInt(process.argv[2]) || 2;

if (numAgents < 2 || numAgents > 6) {
  console.error('Error: Number of agents must be between 2 and 6');
  process.exit(1);
}

function clearScreen() {
  console.log('\x1Bc');
}

function printBanner() {
  console.log('\n╔════════════════════════════════════════════════╗');
  console.log('║     🎰 HYPERTOKEN MULTI-AGENT BLACKJACK 🎰     ║');
  console.log('╚════════════════════════════════════════════════╝\n');
}

function printGameState(engine, game) {
  console.log('\n' + '═'.repeat(60));

  // Show dealer hand
  const dealerCards = engine.space.zone('dealer-hand');
  const dealerDisplay = dealerCards
    .map(c => c.faceUp ? `[${c.tokenSnapshot.label}]` : '[🂠]')
    .join(' ');

  let dealerValue = '';
  if (engine.loop.phase === 'dealer' || !engine.loop.running) {
    const dealerTokens = dealerCards.map(c => c.tokenSnapshot);
    dealerValue = ` (${getBestHandValue(dealerTokens)})`;
  }

  console.log(`\n🤖 DEALER: ${dealerDisplay}${dealerValue}`);
  console.log('\n' + '─'.repeat(60));

  // Show each agent's hand
  engine._agents.forEach((agent, idx) => {
    const cards = engine.space.zone(agent.handZone);
    const cardDisplay = cards.map(c => `[${c.tokenSnapshot.label}]`).join(' ');
    const tokens = cards.map(c => c.tokenSnapshot);
    const handValue = tokens.length > 0 ? getBestHandValue(tokens) : 0;

    const isActive = engine.loop.activeAgent?.name === agent.name && engine.loop.running;
    const activeMarker = isActive ? ' 👈 YOUR TURN' : '';
    const bustedMarker = agent.resources.busted ? ' 💥 BUST' : '';
    const stoodMarker = agent.resources.stood ? ' ✋ STOOD' : '';

    console.log(`\n🎴 ${agent.name} | Bankroll: $${agent.resources.bankroll} | Bet: $${agent.resources.currentBet}${activeMarker}${bustedMarker}${stoodMarker}`);
    console.log(`   ${cardDisplay || '(waiting)'}${tokens.length > 0 ? ` (${handValue})` : ''}`);
  });

  console.log('\n' + '═'.repeat(60));
}

async function placeBets(engine) {
  console.log('\n💰 BETTING PHASE\n');

  for (const agent of engine._agents) {
    let validBet = false;

    while (!validBet) {
      const betInput = await rl.question(`${agent.name}, place your bet (min: $5, max: $${agent.resources.bankroll}): $`);
      const betAmount = parseFloat(betInput);

      if (isNaN(betAmount) || betAmount < 5) {
        console.log('❌ Minimum bet is $5');
      } else if (betAmount > agent.resources.bankroll) {
        console.log(`❌ Insufficient funds. You have $${agent.resources.bankroll}`);
      } else {
        agent.resources.currentBet = betAmount;
        agent.resources.bankroll -= betAmount;
        console.log(`✓ ${agent.name} bet $${betAmount}\n`);
        validBet = true;
      }
    }
  }
}

async function playRound(engine, game) {
  clearScreen();
  printBanner();

  // Betting phase
  await placeBets(engine);

  // Deal cards
  game.deal();

  clearScreen();
  printBanner();
  printGameState(engine, game);

  // Agent turns
  while (engine.loop.running) {
    const activeAgent = engine.loop.activeAgent;

    if (!activeAgent) {
      break;
    }

    console.log(`\n${activeAgent.name}, what would you like to do?`);
    console.log('[H]it  [S]tand');

    const answer = await rl.question('\nYour choice: ');
    const choice = answer.trim().toLowerCase();

    if (choice === 'h' || choice === 'hit') {
      game.hit();
    } else if (choice === 's' || choice === 'stand') {
      game.stand();
    } else {
      console.log('Invalid choice. Standing by default.');
      game.stand();
    }

    clearScreen();
    printBanner();
    printGameState(engine, game);
  }

  // Dealer plays
  console.log('\n🤖 Dealer is playing...');
  await new Promise(resolve => setTimeout(resolve, 1500));

  game.playDealer();

  clearScreen();
  printBanner();
  printGameState(engine, game);

  // Show results
  console.log('\n🏁 ROUND RESULTS:\n');

  engine._agents.forEach(agent => {
    const profit = agent.resources.bankroll - 1000; // Assuming 1000 starting bankroll
    const profitStr = profit >= 0 ? `+$${profit}` : `-$${Math.abs(profit)}`;
    console.log(`${agent.name}: $${agent.resources.bankroll} (${profitStr})`);
  });
}

async function main() {
  clearScreen();
  printBanner();

  console.log(`Welcome to Multi-Agent Blackjack!`);
  console.log(`Playing with ${numAgents} agents.\n`);

  // Get agent names
  const agentNames = [];
  for (let i = 0; i < numAgents; i++) {
    const name = await rl.question(`Enter name for Agent ${i + 1} (or press Enter for default): `);
    agentNames.push(name.trim() || `Agent ${i + 1}`);
  }

  // Ask for seed (optional)
  const seedAnswer = await rl.question('\nEnter a seed for deterministic play (or press Enter for random): ');
  const seed = seedAnswer.trim() ? parseInt(seedAnswer) : null;

  // Initialize game
  const engine = new Engine();
  const game = new MultiagentBlackjackGame(engine, {
    isHost: true,
    numAgents,
    agentNames,
    initialBankroll: 1000,
    numStacks: 6,
    seed
  });

  let playing = true;

  while (playing) {
    // Check if any agent is broke
    const brokePlayers = engine._agents.filter(p => p.resources.bankroll < 5);
    if (brokePlayers.length === numAgents) {
      console.log('\n💔 All players are broke! Game over.');
      break;
    }

    await playRound(engine, game);

    console.log('\n' + '═'.repeat(60));
    const again = await rl.question('\nPlay another round? (y/n): ');

    if (again.trim().toLowerCase() !== 'y') {
      playing = false;
    }
  }

  // Final stats
  console.log('\n╔════════════════════════════════════════════════╗');
  console.log('║                FINAL STANDINGS                 ║');
  console.log('╚════════════════════════════════════════════════╝\n');

  const sorted = [...engine._agents].sort((a, b) => b.resources.bankroll - a.resources.bankroll);

  sorted.forEach((agent, idx) => {
    const profit = agent.resources.bankroll - 1000;
    const profitStr = profit >= 0 ? `+$${profit}` : `-$${Math.abs(profit)}`;
    const medal = idx === 0 ? '🥇' : idx === 1 ? '🥈' : idx === 2 ? '🥉' : `${idx + 1}.`;
    console.log(`${medal} ${agent.name.padEnd(20)} $${agent.resources.bankroll.toFixed(2).padStart(10)} (${profitStr})`);
  });

  console.log('\n👋 Thanks for playing HyperToken Multi-Agent Blackjack!\n');
  rl.close();
}

main().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
