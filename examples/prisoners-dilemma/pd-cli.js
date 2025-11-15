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

// Mock Engine for standalone use
class MockEngine {
  constructor() {
    this._players = [];
    this._gameState = {};
    this.history = [];
    this.listeners = new Map();
  }
  
  dispatch(type, payload = {}) {
    const action = { type, payload };
    
    // Handle actions
    if (type === 'game:start') {
      this._gameState.started = true;
    } else if (type === 'player:create') {
      const player = {
        id: `p-${Date.now()}-${Math.random()}`,
        name: payload.name,
        agent: payload.agent,
        resources: {}
      };
      this._players.push(player);
      return player;
    } else if (type === 'player:giveResource') {
      const player = this._players.find(p => p.name === payload.name);
      if (player) {
        player.resources[payload.resource] = 
          (player.resources[payload.resource] || 0) + payload.amount;
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
 * Main CLI function
 */
async function main() {
  console.log('\nâ•”â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•—');
  console.log('â•‘  PRISONER\'S DILEMMA TOURNAMENT SYSTEM     â•‘');
  console.log('â•šâ•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•\n');
  
  console.log('A game theory experiment using HyperToken\n');
  
  // Parse command line arguments
  const args = process.argv.slice(2);
  const roundsArg = args.find(a => a.startsWith('--rounds='));
  const rounds = roundsArg ? parseInt(roundsArg.split('=')[1]) : 100;
  
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
    verbose: true
  });
  
  // Add strategies
  console.log('Registered Strategies:\n');
  strategyKeys.forEach(key => {
    const strategy = STRATEGIES[key];
    if (strategy) {
      tournament.addStrategy(strategy.name, strategy.fn, strategy.description);
      console.log(`  âœ“ ${strategy.name}`);
      console.log(`    ${strategy.description}\n`);
    } else {
      console.log(`  âœ— Unknown strategy: ${key}\n`);
    }
  });
  
  // Run tournament
  console.log('Press Enter to start tournament...');
  
  // Wait for user input (in real CLI, would use readline)
  await new Promise(resolve => setTimeout(resolve, 1000));
  
  await tournament.run();
  
  // Print results
  tournament.printResults();
  
  // Export option
  if (args.includes('--export')) {
    const fs = await import('fs');
    const filename = `tournament-results-${Date.now()}.json`;
    fs.writeFileSync(filename, tournament.exportResults());
    console.log(`\nâœ“ Results exported to ${filename}\n`);
  }
}

/**
 * Quick demo function
 */
export async function runDemo() {
  console.log('\nðŸŽ® Running Prisoner\'s Dilemma Demo\n');
  
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