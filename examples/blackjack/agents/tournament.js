#!/usr/bin/env node
/**
 * Blackjack AI Tournament
 * Pit different AI strategies against each other
 */

import { BlackjackGame } from '../game.js';
import { 
  BasicStrategyAgent, 
  ConservativeAgent, 
  AggressiveAgent,
  AlwaysHitAgent 
} from './basic-strategy.js';

class Tournament {
  constructor(agents, rounds = 1000, seed = null) {
    this.agents = agents;
    this.rounds = rounds;
    this.seed = seed;
    this.results = new Map();
    
    // Initialize results
    for (const agent of agents) {
      this.results.set(agent.name, {
        wins: 0,
        losses: 0,
        pushes: 0,
        blackjacks: 0,
        busts: 0,
        totalWinnings: 0
      });
    }
  }
  
  playAgentRound(game, agent) {
    let state = game.deal();
    
    // Handle immediate blackjack
    if (state.gameOver) {
      return state;
    }
    
    // Play according to agent strategy
    while (!state.gameOver && (state.canHit || state.canStand)) {
      const decision = agent.decide(state);
      
      if (decision === "hit" && state.canHit) {
        state = game.hit();
      } else if (decision === "stand" && state.canStand) {
        state = game.stand();
        break;
      } else {
        // If agent gives invalid decision, stand
        if (state.canStand) {
          state = game.stand();
        }
        break;
      }
    }
    
    return state;
  }
  
  run() {
    console.log('🎰 Starting Blackjack AI Tournament');
    console.log(`Rounds per agent: ${this.rounds}`);
    console.log(`Seed: ${this.seed || 'random'}\n`);
    
    for (const agent of this.agents) {
      console.log(`\n▶️  Testing ${agent.name}...`);
      
      const game = new BlackjackGame({ 
        numStacks: 6, 
        seed: this.seed 
      });
      
      const stats = this.results.get(agent.name);
      
      for (let i = 0; i < this.rounds; i++) {
        const state = this.playAgentRound(game, agent);
        
        // Record results
        const result = state.result;
        
        if (state.agentHand.blackjack) {
          stats.blackjacks++;
        }
        
        if (state.agentHand.busted) {
          stats.busts++;
        }
        
        switch (result) {
          case "agent":
            stats.wins++;
            stats.totalWinnings += 1;
            break;
          case "agent-blackjack":
            stats.wins++;
            stats.totalWinnings += 1.5; // 3:2 payout
            break;
          case "dealer":
            stats.losses++;
            stats.totalWinnings -= 1;
            break;
          case "push":
            stats.pushes++;
            break;
        }
        
        // Start new round
        if (i < this.rounds - 1) {
          game.newRound();
        }
        
        // Progress indicator
        if ((i + 1) % 100 === 0) {
          process.stdout.write(`\r   Completed: ${i + 1}/${this.rounds}`);
        }
      }
      
      console.log(''); // New line after progress
    }
    
    this.printResults();
  }
  
  printResults() {
    console.log('\n╔════════════════════════════════════════════════════════╗');
    console.log('║                  TOURNAMENT RESULTS                    ║');
    console.log('╚════════════════════════════════════════════════════════╝\n');
    
    // Sort by win rate
    const sorted = Array.from(this.results.entries())
      .sort((a, b) => {
        const aWinRate = a[1].wins / this.rounds;
        const bWinRate = b[1].wins / this.rounds;
        return bWinRate - aWinRate;
      });
    
    for (const [name, stats] of sorted) {
      const winRate = ((stats.wins / this.rounds) * 100).toFixed(2);
      const lossRate = ((stats.losses / this.rounds) * 100).toFixed(2);
      const pushRate = ((stats.pushes / this.rounds) * 100).toFixed(2);
      const bustRate = ((stats.busts / this.rounds) * 100).toFixed(2);
      const bjRate = ((stats.blackjacks / this.rounds) * 100).toFixed(2);
      const avgWinnings = (stats.totalWinnings / this.rounds).toFixed(3);
      
      console.log(`🤖 ${name}`);
      console.log(`   Wins:       ${stats.wins.toString().padEnd(4)} (${winRate}%)`);
      console.log(`   Losses:     ${stats.losses.toString().padEnd(4)} (${lossRate}%)`);
      console.log(`   Pushes:     ${stats.pushes.toString().padEnd(4)} (${pushRate}%)`);
      console.log(`   Blackjacks: ${stats.blackjacks.toString().padEnd(4)} (${bjRate}%)`);
      console.log(`   Busts:      ${stats.busts.toString().padEnd(4)} (${bustRate}%)`);
      console.log(`   Avg Win:    ${avgWinnings} units per round`);
      console.log(`   Total:      ${stats.totalWinnings > 0 ? '+' : ''}${stats.totalWinnings.toFixed(2)} units`);
      console.log('');
    }
  }
}

// Run tournament
const agents = [
  new BasicStrategyAgent("Basic Strategy"),
  new ConservativeAgent("Conservative (17+)"),
  new AggressiveAgent("Aggressive (19+)"),
  new AlwaysHitAgent("Always Hit")
];

const rounds = parseInt(process.argv[2]) || 1000;
const seed = process.argv[3] ? parseInt(process.argv[3]) : null;

const tournament = new Tournament(agents, rounds, seed);
tournament.run();