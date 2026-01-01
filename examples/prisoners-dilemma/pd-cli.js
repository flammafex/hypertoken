#!/usr/bin/env node
/*
 * Copyright 2025 The Carpocratian Church of Commonality and Equality, Inc.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *      http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

/**
 * Prisoner's Dilemma Tournament CLI
 *
 * Run classic game theory tournaments from the command line
 */

/**
 * Mock Engine for standalone use
 *
 * This example uses a lightweight MockEngine instead of the full HyperToken Engine
 * because the Prisoner's Dilemma game doesn't require the card/token manipulation
 * features (Stack, Space, Source) that HyperToken provides.
 *
 * The MockEngine implements only the minimal agent and game state management
 * actions needed for this game theory simulation, making the example:
 * - Easy to understand and modify
 * - Self-contained with minimal dependencies
 * - Fast to execute
 *
 * For examples that use the full HyperToken Engine with card games, see:
 * - examples/blackjack/
 * - examples/cuttle/
 */
class MockEngine {
  constructor() {
    this._agents = [];
    this._gameState = {};
    this.history = [];
    this.listeners = new Map();
  }

  dispatch(type, payload = {}) {
    const action = { type, payload };

    // Handle actions
    if (type === 'game:start') {
      this._gameState.started = true;
    } else if (type === 'agent:create') {
      const agent = {
        id: `p-${Date.now()}-${Math.random()}`,
        name: payload.name,
        agent: payload.agent,
        resources: {}
      };
      this._agents.push(agent);
      return agent;
    } else if (type === 'agent:giveResource') {
      const agent = this._agents.find(p => p.name === payload.name);
      if (agent) {
        agent.resources[payload.resource] =
          (agent.resources[payload.resource] || 0) + payload.amount;
      }
    } else if (type === 'game:end') {
      this._gameState.ended = true;
      this._gameState.winner = payload.winner;
      this.emit('game:end', { payload });
    }

    this.history.push(action);
    this.emit('engine:action', { payload: action });
    return action;
  }

  on(event, handler) {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, []);
    }
    this.listeners.get(event).push(handler);
  }

  emit(event, data) {
    const handlers = this.listeners.get(event) || [];
    handlers.forEach(h => h(data));
  }
}

// Import our modules
import { Tournament } from './tournament.js';
import { STRATEGIES } from './strategies.js';

/**
 * Print help message
 */
function printHelp() {
  console.log(`
PRISONER'S DILEMMA TOURNAMENT SYSTEM
A game theory experiment using HyperToken

USAGE:
  node pd-cli.js [OPTIONS]

OPTIONS:
  --help                Show this help message
  --rounds=N            Number of rounds per game (default: 100)
  --strategies=s1,s2    Comma-separated list of strategies to include
  --list-strategies     List all available strategies and exit
  --verbose             Show detailed strategy information before tournament
  --export              Export results to JSON file after tournament

EXAMPLES:
  node pd-cli.js
  node pd-cli.js --rounds=50
  node pd-cli.js --strategies=titForTat,alwaysCooperate,alwaysDefect
  node pd-cli.js --rounds=200 --verbose
  node pd-cli.js --list-strategies

AVAILABLE STRATEGIES (use with --strategies):
  titForTat, alwaysCooperate, alwaysDefect, grudger, pavlov,
  titForTwoTats, generousTitForTat, suspiciousTitForTat,
  adaptive, gradual, prober, softMajority, hardMajority, random
`);
}

/**
 * List all available strategies with descriptions
 */
function listStrategies() {
  console.log('\n' + '='.repeat(70));
  console.log('AVAILABLE STRATEGIES');
  console.log('='.repeat(70) + '\n');

  const allStrategies = [
    ['titForTat', STRATEGIES.titForTat],
    ['alwaysCooperate', STRATEGIES.alwaysCooperate],
    ['alwaysDefect', STRATEGIES.alwaysDefect],
    ['grudger', STRATEGIES.grudger],
    ['pavlov', STRATEGIES.pavlov],
    ['titForTwoTats', STRATEGIES.titForTwoTats],
    ['generousTitForTat', STRATEGIES.generousTitForTat],
    ['suspiciousTitForTat', STRATEGIES.suspiciousTitForTat],
    ['adaptive', STRATEGIES.adaptive],
    ['gradual', STRATEGIES.gradual],
    ['prober', STRATEGIES.prober],
    ['softMajority', STRATEGIES.softMajority],
    ['hardMajority', STRATEGIES.hardMajority],
    ['random', STRATEGIES.random]
  ];

  allStrategies.forEach(([key, strategy]) => {
    console.log(`${key.padEnd(25)} ${strategy.name}`);
    console.log(`${' '.repeat(25)} ${strategy.description}\n`);
  });

  console.log('='.repeat(70) + '\n');
}

/**
 * Main CLI function
 */
async function main() {
  // Parse command line arguments
  const args = process.argv.slice(2);

  // Handle help flag
  if (args.includes('--help') || args.includes('-h')) {
    printHelp();
    process.exit(0);
  }

  // Handle list-strategies flag
  if (args.includes('--list-strategies')) {
    listStrategies();
    process.exit(0);
  }

  const roundsArg = args.find(a => a.startsWith('--rounds='));
  const rounds = roundsArg ? parseInt(roundsArg.split('=')[1]) : 100;
  const verbose = args.includes('--verbose');

  console.log('\n' + '='.repeat(60));
  console.log('  PRISONER\'S DILEMMA TOURNAMENT SYSTEM');
  console.log('  A game theory experiment using HyperToken');
  console.log('='.repeat(60) + '\n');

  const strategiesArg = args.find(a => a.startsWith('--strategies='));
  let strategyKeys;

  if (strategiesArg) {
    strategyKeys = strategiesArg.split('=')[1].split(',');
  } else {
    // Default: run tournament with all 14 strategies
    strategyKeys = [
      'titForTat',
      'alwaysCooperate',
      'alwaysDefect',
      'grudger',
      'pavlov',
      'titForTwoTats',
      'generousTitForTat',
      'suspiciousTitForTat',
      'adaptive',
      'gradual',
      'prober',
      'softMajority',
      'hardMajority',
      'random'
    ];
  }

  // Create engine
  const engine = new MockEngine();

  // Create tournament
  const tournament = new Tournament(engine, {
    rounds,
    verbose: !verbose  // Quiet mode unless --verbose
  });

  // Add strategies
  if (verbose) {
    console.log('Registered Strategies:\n');
  }

  const registeredStrategies = [];
  strategyKeys.forEach(key => {
    const strategy = STRATEGIES[key];
    if (strategy) {
      tournament.addStrategy(strategy.name, strategy.fn, strategy.description);
      registeredStrategies.push({ key, strategy });

      if (verbose) {
        console.log(`  * ${strategy.name}`);
        console.log(`    ${strategy.description}\n`);
      }
    } else {
      console.log(`  ERROR: Unknown strategy: ${key}\n`);
    }
  });

  if (!verbose) {
    console.log(`Running tournament with ${registeredStrategies.length} strategies...`);
    console.log(`Rounds per game: ${rounds}`);
    console.log(`Total games: ${registeredStrategies.length * (registeredStrategies.length - 1) / 2}\n`);
  }

  // Run tournament
  await tournament.run();

  // Print results
  tournament.printResults();

  // Show strategy details at the end if verbose
  if (verbose) {
    console.log('\n' + '='.repeat(80));
    console.log('STRATEGIES USED IN THIS TOURNAMENT');
    console.log('='.repeat(80) + '\n');

    registeredStrategies.forEach(({ key, strategy }) => {
      console.log(`${key.padEnd(25)} ${strategy.name}`);
      console.log(`${' '.repeat(25)} ${strategy.description}\n`);
    });
  }

  // Export option
  if (args.includes('--export')) {
    const fs = await import('fs');
    const filename = `tournament-results-${Date.now()}.json`;
    fs.writeFileSync(filename, tournament.exportResults());
    console.log(`Results exported to ${filename}\n`);
  }
}

/**
 * Quick demo function
 */
export async function runDemo() {
  console.log('\nRunning Prisoner\'s Dilemma Demo\n');

  const engine = new MockEngine();
  const tournament = new Tournament(engine, { rounds: 50, verbose: false });

  // Add a few classic strategies
  tournament.addStrategy('Tit for Tat', STRATEGIES.titForTat.fn);
  tournament.addStrategy('Always Cooperate', STRATEGIES.alwaysCooperate.fn);
  tournament.addStrategy('Always Defect', STRATEGIES.alwaysDefect.fn);
  tournament.addStrategy('Grudger', STRATEGIES.grudger.fn);

  await tournament.run();
  tournament.printResults();

  return tournament.getResults();
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(err => {
    console.error('Error:', err);
    process.exit(1);
  });
}

export default { main, runDemo };
