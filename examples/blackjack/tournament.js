/**
 * Blackjack AI Tournament with Betting Strategies
 * Compare different playing strategies AND betting strategies
 */

import { BlackjackGame } from './game.js';
import { 
  BasicStrategyAgent, 
  ConservativeAgent, 
  AggressiveAgent,
  AlwaysHitAgent 
} from './agents/basic-strategy.js';
import {
  FlatBettingStrategy,
  MartingaleStrategy,
  PercentageBettingStrategy,
  ProgressiveBettingStrategy
} from './blackjack-betting.js';

class BettingTournament {
  constructor(agentBettingPairs, rounds = 1000, seed = null, initialBankroll = 1000) {
    this.agentBettingPairs = agentBettingPairs;
    this.rounds = rounds;
    this.seed = seed;
    this.initialBankroll = initialBankroll;
    this.results = new Map();
    
    for (const { agent, bettingStrategy } of agentBettingPairs) {
      const key = `${agent.name} + ${bettingStrategy.name}`;
      this.results.set(key, {
        agent: agent.name,
        bettingStrategy: bettingStrategy.name,
        handsPlayed: 0,
        handsWon: 0,
        handsLost: 0,
        pushes: 0,
        blackjacks: 0,
        busts: 0,
        totalWagered: 0,
        totalWon: 0,
        totalLost: 0,
        finalBankroll: 0,
        maxBankroll: initialBankroll,
        minBankroll: initialBankroll,
        bustedOut: false,
        bustedOutAfter: null
      });
    }
  }
  
  playAgentRound(game, agent, bettingStrategy, lastResult) {
    const state = game.getGameState();
    
    // Get bet size from strategy
    const betSize = bettingStrategy.getBetSize(state, game.bettingManager, lastResult);
    
    // Deal with bet
    let gameState = game.deal(betSize);
    
    if (gameState.gameOver) {
      return gameState;
    }
    
    // Play according to agent strategy
    while (!gameState.gameOver && (gameState.canHit || gameState.canStand)) {
      const decision = agent.decide(gameState);
      
      if (decision === "hit" && gameState.canHit) {
        gameState = game.hit();
      } else if (decision === "stand" && gameState.canStand) {
        gameState = game.stand();
        break;
      } else {
        if (gameState.canStand) {
          gameState = game.stand();
        }
        break;
      }
    }
    
    return gameState;
  }
  
  run() {
    console.log('🎰 Starting Blackjack Betting Strategy Tournament');
    console.log(`Rounds per combination: ${this.rounds}`);
    console.log(`Initial bankroll: $${this.initialBankroll}`);
    console.log(`Seed: ${this.seed || 'random'}\n`);
    
    for (const { agent, bettingStrategy } of this.agentBettingPairs) {
      const key = `${agent.name} + ${bettingStrategy.name}`;
      console.log(`\n▶️  Testing ${key}...`);
      
      const game = new BlackjackGame({ 
        numStacks: 6, 
        seed: this.seed,
        initialBankroll: this.initialBankroll,
        minBet: 5,
        maxBet: 500
      });
      
      const stats = this.results.get(key);
      let lastResult = null;
      
      for (let i = 0; i < this.rounds; i++) {
        // Check if busted out
        if (game.bettingManager.isBroke()) {
          stats.bustedOut = true;
          stats.bustedOutAfter = i;
          break;
        }
        
        const state = this.playAgentRound(game, agent, bettingStrategy, lastResult);
        
        stats.handsPlayed++;
        
        if (state.agentHand.blackjack) {
          stats.blackjacks++;
        }
        
        if (state.agentHand.busted) {
          stats.busts++;
        }
        
        const result = state.result;
        lastResult = state.payout;
        
        switch (result) {
          case "agent":
            stats.handsWon++;
            break;
          case "agent-blackjack":
            stats.handsWon++;
            break;
          case "dealer":
            stats.handsLost++;
            break;
          case "push":
            stats.pushes++;
            break;
        }
        
        if (i < this.rounds - 1) {
          game.newRound();
        }
        
        if ((i + 1) % 100 === 0) {
          process.stdout.write(`\r   Completed: ${i + 1}/${this.rounds} | Bankroll: $${game.bettingManager.bankroll.toFixed(2)}`);
        }
      }
      
      const finalStats = game.getStats();
      stats.totalWagered = finalStats.totalWagered;
      stats.totalWon = finalStats.totalWon;
      stats.totalLost = finalStats.totalLost;
      stats.finalBankroll = finalStats.currentBankroll;
      stats.maxBankroll = finalStats.maxBankroll;
      stats.minBankroll = finalStats.minBankroll;
      
      console.log('');
    }
    
    this.printResults();
  }
  
  printResults() {
    console.log('\n╔═══════════════════════════════════════════════════════════╗');
    console.log('║            BETTING STRATEGY TOURNAMENT RESULTS            ║');
    console.log('╚═══════════════════════════════════════════════════════════╝\n');
    
    const sorted = Array.from(this.results.entries())
      .sort((a, b) => {
        return b[1].finalBankroll - a[1].finalBankroll;
      });
    
    for (const [key, stats] of sorted) {
      const netProfit = stats.finalBankroll - this.initialBankroll;
      const roi = ((netProfit / this.initialBankroll) * 100).toFixed(2);
      const winRate = stats.handsPlayed > 0 
        ? ((stats.handsWon / stats.handsPlayed) * 100).toFixed(2)
        : 0;
      
      console.log(`🎲 ${key}`);
      console.log(`   ═══════════════════════════════════════════════════`);
      
      if (stats.bustedOut) {
        console.log(`   💔 BUSTED OUT after ${stats.bustedOutAfter} hands`);
      }
      
      console.log(`   Hands:      ${stats.handsPlayed}${stats.bustedOut ? ` (incomplete)` : ''}`);
      console.log(`   Win Rate:   ${winRate}%`);
      console.log(`   Wins:       ${stats.handsWon}`);
      console.log(`   Losses:     ${stats.handsLost}`);
      console.log(`   Pushes:     ${stats.pushes}`);
      console.log(`   Blackjacks: ${stats.blackjacks}`);
      console.log(`   Busts:      ${stats.busts}`);
      console.log(`   ───────────────────────────────────────────────────`);
      console.log(`   Wagered:    $${stats.totalWagered.toFixed(2)}`);
      console.log(`   Won:        $${stats.totalWon.toFixed(2)}`);
      console.log(`   Lost:       $${stats.totalLost.toFixed(2)}`);
      console.log(`   ───────────────────────────────────────────────────`);
      console.log(`   Start:      $${this.initialBankroll.toFixed(2)}`);
      console.log(`   Final:      $${stats.finalBankroll.toFixed(2)}`);
      console.log(`   Net:        ${netProfit >= 0 ? '+' : ''}$${netProfit.toFixed(2)}`);
      console.log(`   ROI:        ${roi}%`);
      console.log(`   Peak:       $${stats.maxBankroll.toFixed(2)}`);
      console.log(`   Low:        $${stats.minBankroll.toFixed(2)}`);
      console.log('');
    }
    
    console.log('╔═══════════════════════════════════════════════════════════╗');
    console.log('║                        RANKINGS                           ║');
    console.log('╚═══════════════════════════════════════════════════════════╝\n');
    
    sorted.forEach(([key, stats], index) => {
      const netProfit = stats.finalBankroll - this.initialBankroll;
      const medal = index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : `${index + 1}.`;
      console.log(`${medal} ${key.padEnd(50)} $${stats.finalBankroll.toFixed(2).padStart(10)} (${netProfit >= 0 ? '+' : ''}$${netProfit.toFixed(2)})`);
    });
    console.log('');
  }
}

// Setup agent and betting strategy combinations
const agentBettingPairs = [
  // Basic Strategy with different betting approaches
  { agent: new BasicStrategyAgent("Basic Strategy"), bettingStrategy: new FlatBettingStrategy(10) },
  { agent: new BasicStrategyAgent("Basic Strategy"), bettingStrategy: new MartingaleStrategy(5) },
  { agent: new BasicStrategyAgent("Basic Strategy"), bettingStrategy: new PercentageBettingStrategy(0.02) },
  { agent: new BasicStrategyAgent("Basic Strategy"), bettingStrategy: new ProgressiveBettingStrategy(10, 5, 50) },
  
  // Conservative play with different betting
  { agent: new ConservativeAgent("Conservative"), bettingStrategy: new FlatBettingStrategy(10) },
  { agent: new ConservativeAgent("Conservative"), bettingStrategy: new MartingaleStrategy(5) },
  
  // Aggressive play with different betting
  { agent: new AggressiveAgent("Aggressive"), bettingStrategy: new FlatBettingStrategy(10) },
  { agent: new AggressiveAgent("Aggressive"), bettingStrategy: new PercentageBettingStrategy(0.02) },
];

const rounds = parseInt(process.argv[2]) || 1000;
const seed = process.argv[3] ? parseInt(process.argv[3]) : null;
const initialBankroll = parseInt(process.argv[4]) || 1000;

const tournament = new BettingTournament(agentBettingPairs, rounds, seed, initialBankroll);
tournament.run();