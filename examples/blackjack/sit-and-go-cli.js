#!/usr/bin/env node
/**
 * Sit-and-Go Tournament CLI
 *
 * Run blackjack Sit-and-Go tournaments with escalating blinds and prize pools.
 *
 * Usage:
 *   node sit-and-go-cli.js [options]
 *
 * Options:
 *   -p, --players <n>      Number of players (default: 6)
 *   -b, --buy-in <n>       Buy-in amount (default: 100)
 *   -c, --chips <n>        Starting chips (default: 1500)
 *   -l, --level-time <n>   Hands per blind level (default: 10)
 *   --turbo               Turbo structure (5 hands per level)
 *   --hyper               Hyper-turbo (3 hands per level)
 *   -r, --max-rounds <n>   Maximum hands (default: 500)
 *   -s, --seed <n>         Random seed for reproducibility
 *   -v, --verbose          Show detailed hand-by-hand output
 *   -h, --help             Show help
 */

import { SitAndGoTournament } from './sit-and-go-tournament.js';
import {
  BasicStrategyAgent,
  ConservativeAgent,
  AggressiveAgent,
  AlwaysHitAgent
} from './agents/basic-strategy.js';

// Tournament-aware agents that adjust to blind levels
class TournamentProAgent {
  constructor(name = "Tournament Pro") {
    this.name = name;
  }

  decide(gameState) {
    const agentValue = gameState.agentHand.value;
    const playersRemaining = gameState.playersRemaining || 6;

    // Tighten up as we get closer to the bubble
    const nearBubble = playersRemaining <= 4;

    if (agentValue >= 17) return "stand";

    // Get dealer up card
    const dealerCards = gameState.dealerHand.cards;
    const dealerUpCard = dealerCards.find(c => c.meta) || dealerCards[0];
    const dealerValue = dealerUpCard?.meta?.value?.[0] || 10;

    if (agentValue <= 11) return "hit";

    // Near bubble: play more conservatively
    if (nearBubble) {
      if (agentValue >= 14) return "stand";
    }

    if (agentValue >= 13 && agentValue <= 16) {
      return dealerValue >= 7 ? "hit" : "stand";
    }

    if (agentValue === 12) {
      return dealerValue >= 4 && dealerValue <= 6 ? "stand" : "hit";
    }

    return "hit";
  }

  getBetSize({ bankroll, minBet, maxBet, bigBlind }) {
    // Tournament strategy: bet 2-3x big blind
    const chipsToBB = bankroll / bigBlind;

    if (chipsToBB < 10) {
      // Short stack: push or fold mentality
      return Math.min(bankroll, maxBet);
    } else if (chipsToBB < 20) {
      // Medium stack: standard raise
      return Math.min(bigBlind * 2.5, maxBet, bankroll);
    } else {
      // Deep stack: can afford to play looser
      return Math.min(bigBlind * 3, maxBet, bankroll);
    }
  }
}

class ShortStackSpecialist {
  constructor(name = "Short Stack Sam") {
    this.name = name;
  }

  decide(gameState) {
    const agentValue = gameState.agentHand.value;

    // Simplified strategy - plays well with small stacks
    if (agentValue >= 17) return "stand";
    if (agentValue <= 11) return "hit";

    // Conservative on marginal hands when short
    if (agentValue >= 15) return "stand";

    return "hit";
  }

  getBetSize({ bankroll, minBet, bigBlind }) {
    // Always bet minimum to preserve chips
    return minBet;
  }
}

class LooseAggressiveAgent {
  constructor(name = "LAG Larry") {
    this.name = name;
  }

  decide(gameState) {
    const agentValue = gameState.agentHand.value;

    if (agentValue >= 18) return "stand";

    // Double often on good hands
    if (gameState.canDouble && agentValue >= 9 && agentValue <= 11) {
      return "double";
    }

    if (agentValue <= 11) return "hit";
    if (agentValue >= 17) return "stand";

    // Hit more than average
    return "hit";
  }

  getBetSize({ bankroll, minBet, maxBet, bigBlind }) {
    // Aggressive betting: 3-4x big blind
    const bet = Math.floor(bigBlind * 3.5);
    return Math.min(Math.max(bet, minBet), maxBet, bankroll);
  }
}

class TightAggressiveAgent {
  constructor(name = "TAG Terry") {
    this.name = name;
  }

  decide(gameState) {
    const agentValue = gameState.agentHand.value;
    const dealerCards = gameState.dealerHand.cards;
    const dealerUpCard = dealerCards.find(c => c.meta) || dealerCards[0];
    const dealerValue = dealerUpCard?.meta?.value?.[0] || 10;

    if (agentValue >= 17) return "stand";
    if (agentValue <= 11) return "hit";

    // Strict basic strategy
    if (agentValue >= 13 && agentValue <= 16) {
      if (dealerValue >= 2 && dealerValue <= 6) return "stand";
      return "hit";
    }

    if (agentValue === 12) {
      if (dealerValue >= 4 && dealerValue <= 6) return "stand";
      return "hit";
    }

    return "hit";
  }

  getBetSize({ bankroll, minBet, maxBet, bigBlind }) {
    // Tight: bet 2x big blind
    const bet = bigBlind * 2;
    return Math.min(Math.max(bet, minBet), maxBet, bankroll);
  }
}

class BubbleBoyAgent {
  constructor(name = "Bubble Boy Ben") {
    this.name = name;
  }

  decide(gameState) {
    const agentValue = gameState.agentHand.value;
    const playersRemaining = gameState.playersRemaining || 6;

    // Ultra tight near the bubble
    const nearBubble = playersRemaining <= 4;

    if (agentValue >= 17) return "stand";
    if (agentValue <= 11) return "hit";

    if (nearBubble) {
      // Super conservative near bubble
      if (agentValue >= 13) return "stand";
    }

    if (agentValue >= 15) return "stand";
    return "hit";
  }

  getBetSize({ bankroll, minBet, bigBlind, playersRemaining }) {
    // Near bubble: bet minimum
    if (playersRemaining && playersRemaining <= 4) {
      return minBet;
    }
    // Otherwise bet 2x BB
    return Math.min(bigBlind * 2, bankroll);
  }
}

class AllInAlwaysAgent {
  constructor(name = "All-In Andy") {
    this.name = name;
  }

  decide(gameState) {
    const agentValue = gameState.agentHand.value;

    if (agentValue >= 17) return "stand";
    if (agentValue <= 11) return "hit";

    // Risky play
    return "hit";
  }

  getBetSize({ bankroll }) {
    // Goes all-in frequently
    return bankroll;
  }
}

// Predefined agent pool for Sit-and-Go
const AGENT_POOL = [
  () => new BasicStrategyAgent("Basic Bob"),
  () => new TournamentProAgent("Pro Pete"),
  () => new ConservativeAgent("Conservative Carl"),
  () => new AggressiveAgent("Aggressive Alice"),
  () => new TournamentProAgent("Pro Paula"),
  () => new LooseAggressiveAgent("LAG Larry"),
  () => new TightAggressiveAgent("TAG Terry"),
  () => new ShortStackSpecialist("Short Stack Sam"),
  () => new BubbleBoyAgent("Bubble Boy Ben"),
  () => new AllInAlwaysAgent("All-In Andy")
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

// Blind level presets
function getBlindLevels(handsPerLevel, startingChips) {
  const baseSmall = Math.floor(startingChips / 150); // Start at ~1% of stack

  return [
    { small: baseSmall, big: baseSmall * 2, ante: 0, duration: handsPerLevel },
    { small: Math.floor(baseSmall * 1.5), big: baseSmall * 3, ante: 0, duration: handsPerLevel },
    { small: baseSmall * 2.5, big: baseSmall * 5, ante: 0, duration: handsPerLevel },
    { small: baseSmall * 5, big: baseSmall * 10, ante: 0, duration: handsPerLevel },
    { small: baseSmall * 7.5, big: baseSmall * 15, ante: 0, duration: handsPerLevel },
    { small: baseSmall * 10, big: baseSmall * 20, ante: Math.floor(baseSmall * 2.5), duration: handsPerLevel },
    { small: baseSmall * 15, big: baseSmall * 30, ante: Math.floor(baseSmall * 2.5), duration: handsPerLevel },
    { small: baseSmall * 20, big: baseSmall * 40, ante: Math.floor(baseSmall * 5), duration: handsPerLevel },
    { small: baseSmall * 30, big: baseSmall * 60, ante: Math.floor(baseSmall * 5), duration: handsPerLevel },
    { small: baseSmall * 40, big: baseSmall * 80, ante: Math.floor(baseSmall * 10), duration: handsPerLevel },
    { small: baseSmall * 50, big: baseSmall * 100, ante: Math.floor(baseSmall * 10), duration: handsPerLevel },
    { small: baseSmall * 75, big: baseSmall * 150, ante: Math.floor(baseSmall * 15), duration: handsPerLevel },
    { small: baseSmall * 100, big: baseSmall * 200, ante: Math.floor(baseSmall * 20), duration: handsPerLevel }
  ];
}

function printHelp() {
  console.log(`
Blackjack Sit-and-Go Tournament

Usage: node sit-and-go-cli.js [options]

Options:
  -p, --players <n>      Number of players (default: 6, max: 10)
  -b, --buy-in <n>       Buy-in amount in dollars (default: 100)
  -c, --chips <n>        Starting chip count (default: 1500)
  -l, --level-time <n>   Hands per blind level (default: 10)
  --turbo               Turbo structure (5 hands per level)
  --hyper               Hyper-turbo structure (3 hands per level)
  -r, --max-rounds <n>   Maximum hands before forced end (default: 500)
  -s, --seed <n>         Random seed for reproducibility
  -v, --verbose          Show detailed hand-by-hand output
  -h, --help             Show this help

Examples:
  node sit-and-go-cli.js
  node sit-and-go-cli.js -p 6 -b 50 -c 1000
  node sit-and-go-cli.js --turbo -p 4
  node sit-and-go-cli.js --hyper -v
  node sit-and-go-cli.js -p 9 -b 200 --seed 12345
`);
}

// Parse arguments
const args = process.argv.slice(2);
let players = 6;
let buyIn = 100;
let startingChips = 1500;
let handsPerLevel = 10;
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
  } else if (arg === '-b' || arg === '--buy-in') {
    buyIn = parseInt(args[++i]) || 100;
  } else if (arg === '-c' || arg === '--chips') {
    startingChips = parseInt(args[++i]) || 1500;
  } else if (arg === '-l' || arg === '--level-time') {
    handsPerLevel = parseInt(args[++i]) || 10;
  } else if (arg === '--turbo') {
    handsPerLevel = 5;
  } else if (arg === '--hyper') {
    handsPerLevel = 3;
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
const blindLevels = getBlindLevels(handsPerLevel, startingChips);

const tournament = new SitAndGoTournament(agents, {
  buyIn,
  startingChips,
  blindLevels,
  numDecks: 6,
  seed,
  maxRounds,
  verbose,
  showBlindChanges: true
});

tournament.run().catch(err => {
  console.error("Tournament error:", err);
  process.exit(1);
});
