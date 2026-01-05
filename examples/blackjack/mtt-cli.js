#!/usr/bin/env node
/**
 * Multi-Table Tournament (MTT) CLI
 *
 * Run large-scale blackjack tournaments with multiple tables.
 *
 * Usage:
 *   node mtt-cli.js [options]
 *
 * Options:
 *   -p, --players <n>      Number of players (default: 18)
 *   -t, --table-size <n>   Players per table (default: 6)
 *   -f, --final-table <n>  Final table size (default: 9)
 *   -b, --buy-in <n>       Buy-in amount (default: 100)
 *   -c, --chips <n>        Starting chips (default: 3000)
 *   --turbo               Faster blind levels
 *   -r, --max-rounds <n>   Maximum hands (default: 1000)
 *   -s, --seed <n>         Random seed
 *   -v, --verbose          Show detailed output
 *   -h, --help             Show help
 */

import { MultiTableTournament } from './multi-table-tournament.js';
import {
  BasicStrategyAgent,
  ConservativeAgent,
  AggressiveAgent
} from './agents/basic-strategy.js';

// MTT-specific agents that adjust for tournament dynamics
class MTTProAgent {
  constructor(name = "MTT Pro") {
    this.name = name;
  }

  decide(gameState) {
    const agentValue = gameState.agentHand.value;
    const isFinalTable = gameState.isFinalTable;
    const playersRemaining = gameState.playersRemaining || 18;

    // Tighter play at final table
    if (isFinalTable && agentValue >= 16) return "stand";

    if (agentValue >= 17) return "stand";

    const dealerCards = gameState.dealerHand.cards;
    const dealerUpCard = dealerCards.find(c => c.meta) || dealerCards[0];
    const dealerValue = dealerUpCard?.meta?.value?.[0] || 10;

    if (agentValue <= 11) return "hit";

    if (agentValue >= 13 && agentValue <= 16) {
      return dealerValue >= 7 ? "hit" : "stand";
    }

    if (agentValue === 12) {
      return dealerValue >= 4 && dealerValue <= 6 ? "stand" : "hit";
    }

    return "hit";
  }

  getBetSize({ bankroll, minBet, maxBet, bigBlind }) {
    const chipsToBB = bankroll / bigBlind;

    if (chipsToBB < 10) {
      return Math.min(bankroll, maxBet);
    } else if (chipsToBB < 20) {
      return Math.min(bigBlind * 2.5, maxBet, bankroll);
    }

    return Math.min(bigBlind * 2, maxBet, bankroll);
  }
}

class ChipAccumulatorAgent {
  constructor(name = "Chip Accumulator") {
    this.name = name;
  }

  decide(gameState) {
    const agentValue = gameState.agentHand.value;

    // Aggressive early, conservative late
    const playersRemaining = gameState.playersRemaining || 18;
    const earlyStage = playersRemaining > 12;

    if (agentValue >= 17) return "stand";

    // Double more in early stages
    if (earlyStage && gameState.canDouble && agentValue >= 9 && agentValue <= 11) {
      return "double";
    }

    if (agentValue <= 11) return "hit";

    if (agentValue >= 15) return "stand";

    return "hit";
  }

  getBetSize({ bankroll, minBet, maxBet, bigBlind }) {
    // Aggressive betting to accumulate chips
    return Math.min(bigBlind * 3, maxBet, bankroll);
  }
}

class SurvivalAgent {
  constructor(name = "Survival Mode") {
    this.name = name;
  }

  decide(gameState) {
    const agentValue = gameState.agentHand.value;

    // Very conservative - just survive
    if (agentValue >= 15) return "stand";
    if (agentValue <= 11) return "hit";

    return "stand"; // Default to safe play
  }

  getBetSize({ bankroll, minBet }) {
    // Minimum bets only
    return minBet;
  }
}

class BigStackBullyAgent {
  constructor(name = "Big Stack Bully") {
    this.name = name;
  }

  decide(gameState) {
    const agentValue = gameState.agentHand.value;
    const chipsToBB = gameState.bankroll / gameState.bigBlind;

    if (agentValue >= 17) return "stand";

    // Bully with double downs when deep stacked
    if (chipsToBB > 20 && gameState.canDouble && agentValue >= 10 && agentValue <= 11) {
      return "double";
    }

    if (agentValue <= 11) return "hit";
    if (agentValue >= 14) return "stand";

    return "hit";
  }

  getBetSize({ bankroll, minBet, maxBet, bigBlind }) {
    const chipsToBB = bankroll / bigBlind;

    if (chipsToBB > 30) {
      // Big stack: bet big
      return Math.min(bigBlind * 4, maxBet, bankroll);
    }

    return Math.min(bigBlind * 2, maxBet, bankroll);
  }
}

class ShortStackNinjaAgent {
  constructor(name = "Short Stack Ninja") {
    this.name = name;
  }

  decide(gameState) {
    const agentValue = gameState.agentHand.value;
    const chipsToBB = gameState.bankroll / gameState.bigBlind;

    if (agentValue >= 17) return "stand";

    // When short, be aggressive with good hands
    if (chipsToBB < 10 && gameState.canDouble && agentValue === 11) {
      return "double";
    }

    if (agentValue <= 11) return "hit";
    if (agentValue >= 15) return "stand";

    return "hit";
  }

  getBetSize({ bankroll, minBet, maxBet, bigBlind }) {
    const chipsToBB = bankroll / bigBlind;

    if (chipsToBB < 10) {
      // Short stack: all-in or fold mentality
      return Math.min(bankroll, maxBet);
    }

    return Math.min(bigBlind * 2, maxBet, bankroll);
  }
}

class BubbleBoyAgent {
  constructor(name = "Bubble Boy") {
    this.name = name;
  }

  decide(gameState) {
    const agentValue = gameState.agentHand.value;

    // Ultra tight near the bubble
    if (agentValue >= 15) return "stand";
    if (agentValue <= 11) return "hit";

    return "stand";
  }

  getBetSize({ bankroll, minBet, playersRemaining }) {
    // Near bubble: min bet
    if (playersRemaining && playersRemaining <= 5) {
      return minBet;
    }
    return minBet;
  }
}

class LooseCannonAgent {
  constructor(name = "Loose Cannon") {
    this.name = name;
  }

  decide(gameState) {
    const agentValue = gameState.agentHand.value;

    if (agentValue >= 18) return "stand";

    // Double on many hands
    if (gameState.canDouble && agentValue >= 9 && agentValue <= 11) {
      return "double";
    }

    if (agentValue <= 11) return "hit";
    if (agentValue >= 17) return "stand";

    return "hit";
  }

  getBetSize({ bankroll, minBet, maxBet, bigBlind }) {
    // Aggressive betting
    return Math.min(bigBlind * 4, maxBet, bankroll);
  }
}

class ICMExpertAgent {
  constructor(name = "ICM Expert") {
    this.name = name;
  }

  decide(gameState) {
    const agentValue = gameState.agentHand.value;
    const playersRemaining = gameState.playersRemaining || 18;
    const isFinalTable = gameState.isFinalTable;

    // Standard strategy early
    if (!isFinalTable && playersRemaining > 10) {
      if (agentValue >= 17) return "stand";
      if (agentValue <= 11) return "hit";
      return agentValue >= 14 ? "stand" : "hit";
    }

    // ICM-aware: tighter near pay jumps
    if (agentValue >= 16) return "stand";
    if (agentValue <= 11) return "hit";

    return "stand";
  }

  getBetSize({ bankroll, minBet, maxBet, bigBlind, playersRemaining }) {
    const chipsToBB = bankroll / bigBlind;

    // Near bubble/pay jumps: conservative
    if (playersRemaining && playersRemaining <= 4) {
      return minBet;
    }

    return Math.min(bigBlind * 2, maxBet, bankroll);
  }
}

// Agent pool with variety of styles
const AGENT_POOL = [
  () => new BasicStrategyAgent("Basic Bob"),
  () => new MTTProAgent("MTT Pro Mike"),
  () => new ConservativeAgent("Conservative Carl"),
  () => new AggressiveAgent("Aggressive Alice"),
  () => new ChipAccumulatorAgent("Chip Ace Charlie"),
  () => new SurvivalAgent("Survival Sam"),
  () => new BigStackBullyAgent("Bully Bill"),
  () => new ShortStackNinjaAgent("Ninja Nancy"),
  () => new BubbleBoyAgent("Bubble Ben"),
  () => new LooseCannonAgent("Loose Cannon Lou"),
  () => new ICMExpertAgent("ICM Irene"),
  () => new MTTProAgent("Pro Paula"),
  () => new BasicStrategyAgent("Basic Betty"),
  () => new ChipAccumulatorAgent("Chip Chris"),
  () => new AggressiveAgent("Aggressive Andy"),
  () => new SurvivalAgent("Survival Sue"),
  () => new BigStackBullyAgent("Bully Brenda"),
  () => new ICMExpertAgent("ICM Ian"),
  () => new MTTProAgent("Pro Pete"),
  () => new LooseCannonAgent("Loose Larry")
];

function createAgents(count) {
  const agents = [];
  const usedNames = new Set();

  for (let i = 0; i < count; i++) {
    const agentFactory = AGENT_POOL[i % AGENT_POOL.length];
    const agent = agentFactory();

    // Ensure unique names
    let name = agent.name;
    let suffix = 2;
    while (usedNames.has(name)) {
      name = `${agent.name} ${suffix++}`;
    }
    agent.name = name;
    usedNames.add(name);

    agents.push(agent);
  }

  return agents;
}

// Turbo blind structure
function getTurboBlindLevels(startingChips) {
  const base = Math.floor(startingChips / 150);
  return [
    { small: base, big: base * 2, ante: 0, duration: 8 },
    { small: base * 1.5, big: base * 3, ante: 0, duration: 8 },
    { small: base * 2.5, big: base * 5, ante: 0, duration: 8 },
    { small: base * 5, big: base * 10, ante: base, duration: 8 },
    { small: base * 7.5, big: base * 15, ante: base * 1.5, duration: 8 },
    { small: base * 10, big: base * 20, ante: base * 2, duration: 8 },
    { small: base * 15, big: base * 30, ante: base * 3, duration: 8 },
    { small: base * 20, big: base * 40, ante: base * 4, duration: 8 },
    { small: base * 30, big: base * 60, ante: base * 6, duration: 8 },
    { small: base * 50, big: base * 100, ante: base * 10, duration: 8 }
  ];
}

function printHelp() {
  console.log(`
Multi-Table Tournament (MTT)

Usage: node mtt-cli.js [options]

Options:
  -p, --players <n>      Number of players (default: 18, min: 10)
  -t, --table-size <n>   Players per table (default: 6)
  -f, --final-table <n>  Final table size (default: 9)
  -b, --buy-in <n>       Buy-in amount in dollars (default: 100)
  -c, --chips <n>        Starting chip count (default: 3000)
  --turbo               Faster blind structure
  -r, --max-rounds <n>   Maximum hands (default: 1000)
  -s, --seed <n>         Random seed for reproducibility
  -v, --verbose          Show detailed hand-by-hand output
  -h, --help             Show this help

Examples:
  node mtt-cli.js                           # 18-player MTT (3 tables)
  node mtt-cli.js -p 36 -t 6                # 36 players, 6 tables
  node mtt-cli.js -p 20 --turbo             # 20-player turbo MTT
  node mtt-cli.js -p 27 -b 50 -c 5000       # Custom buy-in and chips
  node mtt-cli.js -p 45 -f 9 -v             # Large MTT with verbose output
`);
}

// Parse arguments
const args = process.argv.slice(2);
let players = 18;
let tableSize = 6;
let finalTableSize = 9;
let buyIn = 100;
let startingChips = 3000;
let turbo = false;
let maxRounds = 1000;
let seed = null;
let verbose = false;

for (let i = 0; i < args.length; i++) {
  const arg = args[i];

  if (arg === '-h' || arg === '--help') {
    printHelp();
    process.exit(0);
  } else if (arg === '-p' || arg === '--players') {
    players = Math.max(10, parseInt(args[++i]) || 18);
  } else if (arg === '-t' || arg === '--table-size') {
    tableSize = Math.min(10, Math.max(2, parseInt(args[++i]) || 6));
  } else if (arg === '-f' || arg === '--final-table') {
    finalTableSize = Math.min(10, Math.max(2, parseInt(args[++i]) || 9));
  } else if (arg === '-b' || arg === '--buy-in') {
    buyIn = parseInt(args[++i]) || 100;
  } else if (arg === '-c' || arg === '--chips') {
    startingChips = parseInt(args[++i]) || 3000;
  } else if (arg === '--turbo') {
    turbo = true;
  } else if (arg === '-r' || arg === '--max-rounds') {
    maxRounds = parseInt(args[++i]) || 1000;
  } else if (arg === '-s' || arg === '--seed') {
    seed = parseInt(args[++i]);
  } else if (arg === '-v' || arg === '--verbose') {
    verbose = true;
  }
}

// Create agents and run tournament
const agents = createAgents(players);
const blindLevels = turbo ? getTurboBlindLevels(startingChips) : undefined;

const tournament = new MultiTableTournament(agents, {
  buyIn,
  startingChips,
  playersPerTable: tableSize,
  finalTableSize,
  blindLevels,
  numDecks: 6,
  seed,
  maxRounds,
  verbose,
  showTableUpdates: true,
  showBalancing: true
});

tournament.run().catch(err => {
  console.error("Tournament error:", err);
  process.exit(1);
});
