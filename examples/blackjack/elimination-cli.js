#!/usr/bin/env node
/**
 * Elimination Tournament CLI
 *
 * Run blackjack elimination tournaments with various AI agents.
 *
 * Usage:
 *   node elimination-cli.js [options]
 *
 * Options:
 *   -p, --players <n>      Number of players (default: 6)
 *   -b, --bankroll <n>     Starting bankroll (default: 1000)
 *   -m, --min-bet <n>      Minimum bet (default: 10)
 *   -r, --max-rounds <n>   Maximum rounds (default: 500)
 *   -s, --seed <n>         Random seed for reproducibility
 *   -v, --verbose          Show detailed hand-by-hand output
 *   -h, --help             Show help
 */

import { EliminationTournament } from './elimination-tournament.js';
import {
  BasicStrategyAgent,
  ConservativeAgent,
  AggressiveAgent,
  AlwaysHitAgent
} from './agents/basic-strategy.js';

// Extended agents with more variety
class CardCounterAgent {
  constructor(name = "Card Counter") {
    this.name = name;
    this.count = 0;
  }

  decide(gameState) {
    const agentValue = gameState.agentHand.value;

    // Simplified card counting influence
    // With high count (favorable), be more aggressive
    // With low count (unfavorable), be more conservative

    if (agentValue >= 17) return "stand";

    // Get dealer up card
    const dealerCards = gameState.dealerHand.cards;
    const dealerUpCard = dealerCards.find(c => c.meta) || dealerCards[0];
    const dealerValue = dealerUpCard?.meta?.value?.[0] || 10;

    if (agentValue <= 11) return "hit";

    if (agentValue >= 13 && agentValue <= 16) {
      // Stand vs low cards, hit vs high cards
      return dealerValue >= 7 ? "hit" : "stand";
    }

    if (agentValue === 12) {
      return dealerValue >= 4 && dealerValue <= 6 ? "stand" : "hit";
    }

    return "hit";
  }

  getBetSize({ bankroll, minBet, maxBet }) {
    // Vary bet based on "count" - simulate counting
    // In reality would track actual count, here we just vary bets
    const baseBet = Math.max(minBet, Math.floor(bankroll * 0.05));
    return Math.min(baseBet, maxBet, bankroll);
  }
}

class RiskyAgent {
  constructor(name = "Risky Rick") {
    this.name = name;
  }

  decide(gameState) {
    const agentValue = gameState.agentHand.value;

    // Very aggressive - only stand on 18+
    if (agentValue >= 18) return "stand";

    // Double on 9, 10, 11 if possible
    if (gameState.canDouble && agentValue >= 9 && agentValue <= 11) {
      return "double";
    }

    return "hit";
  }

  getBetSize({ bankroll, minBet, maxBet }) {
    // Bet big - 15% of bankroll
    const bet = Math.floor(bankroll * 0.15);
    return Math.min(Math.max(bet, minBet), maxBet, bankroll);
  }
}

class CautiousAgent {
  constructor(name = "Cautious Carl") {
    this.name = name;
  }

  decide(gameState) {
    const agentValue = gameState.agentHand.value;

    // Very conservative - stand on 15+
    if (agentValue >= 15) return "stand";
    return "hit";
  }

  getBetSize({ bankroll, minBet }) {
    // Always bet minimum
    return minBet;
  }
}

class RandomAgent {
  constructor(name = "Random Randy") {
    this.name = name;
  }

  decide(gameState) {
    if (gameState.agentHand.value >= 17) return "stand";
    if (gameState.agentHand.value <= 11) return "hit";

    // Random choice for middle values
    return Math.random() > 0.5 ? "hit" : "stand";
  }
}

// Predefined agent pools
const AGENT_POOL = [
  () => new BasicStrategyAgent("Basic Bob"),
  () => new BasicStrategyAgent("Strategy Steve"),
  () => new ConservativeAgent("Conservative Carl"),
  () => new AggressiveAgent("Aggressive Alice"),
  () => new CardCounterAgent("Counter Chris"),
  () => new RiskyAgent("Risky Rick"),
  () => new CautiousAgent("Cautious Cathy"),
  () => new RandomAgent("Random Randy"),
  () => new BasicStrategyAgent("Basic Betty"),
  () => new AggressiveAgent("Aggressive Andy")
];

function createAgents(count) {
  const agents = [];
  for (let i = 0; i < count; i++) {
    const agentFactory = AGENT_POOL[i % AGENT_POOL.length];
    const agent = agentFactory();
    // Ensure unique names
    if (agents.some(a => a.name === agent.name)) {
      agent.name = `${agent.name} ${i + 1}`;
    }
    agents.push(agent);
  }
  return agents;
}

function printHelp() {
  console.log(`
Blackjack Elimination Tournament

Usage: node elimination-cli.js [options]

Options:
  -p, --players <n>      Number of players (default: 6, max: 10)
  -b, --bankroll <n>     Starting bankroll (default: 1000)
  -m, --min-bet <n>      Minimum bet (default: 10)
  -r, --max-rounds <n>   Maximum rounds before forced end (default: 500)
  -s, --seed <n>         Random seed for reproducibility
  -v, --verbose          Show detailed hand-by-hand output
  -h, --help             Show this help

Examples:
  node elimination-cli.js
  node elimination-cli.js -p 8 -b 500 -v
  node elimination-cli.js --players 4 --seed 12345
  node elimination-cli.js -p 6 -r 200 --verbose
`);
}

// Parse arguments
const args = process.argv.slice(2);
let players = 6;
let bankroll = 1000;
let minBet = 10;
let maxRounds = 500;
let seed = null;
let verbose = false;

for (let i = 0; i < args.length; i++) {
  const arg = args[i];

  if (arg === '-h' || arg === '--help') {
    printHelp();
    process.exit(0);
  } else if (arg === '-p' || arg === '--players') {
    players = Math.min(10, Math.max(2, parseInt(args[++i]) || 6));
  } else if (arg === '-b' || arg === '--bankroll') {
    bankroll = parseInt(args[++i]) || 1000;
  } else if (arg === '-m' || arg === '--min-bet') {
    minBet = parseInt(args[++i]) || 10;
  } else if (arg === '-r' || arg === '--max-rounds') {
    maxRounds = parseInt(args[++i]) || 500;
  } else if (arg === '-s' || arg === '--seed') {
    seed = parseInt(args[++i]);
  } else if (arg === '-v' || arg === '--verbose') {
    verbose = true;
  }
}

// Create agents and run tournament
const agents = createAgents(players);

const tournament = new EliminationTournament(agents, {
  initialBankroll: bankroll,
  minBet,
  maxBet: Math.min(500, bankroll),
  numDecks: 6,
  seed,
  maxRounds,
  verbose
});

tournament.run().catch(err => {
  console.error("Tournament error:", err);
  process.exit(1);
});
