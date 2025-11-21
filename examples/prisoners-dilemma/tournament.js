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
 * Prisoner's Dilemma Tournament System
 * 
 * Runs round-robin tournaments where each strategy plays against every other strategy
 */

import { createGame } from './prisoners-dilemma.js';

/**
 * Tournament Configuration
 */
export class Tournament {
  constructor(engine, config = {}) {
    this.engine = engine;
    this.config = {
      rounds: config.rounds || 100,
      verbose: config.verbose !== false
    };
    
    this.strategies = [];
    this.results = [];
    this.standings = [];
  }
  
  /**
   * Add a strategy to the tournament
   */
  addStrategy(name, strategyFn, description = '') {
    this.strategies.push({
      name,
      strategy: strategyFn,
      description,
      totalScore: 0,
      gamesPlayed: 0,
      wins: 0,
      losses: 0,
      ties: 0,
      cooperations: 0,
      defections: 0
    });
    
    return this;
  }
  
  /**
   * Run the tournament
   */
  async run() {
    const startTime = Date.now();
    
    if (this.config.verbose) {
      console.log('\n🏆 Starting Prisoner\'s Dilemma Tournament\n');
      console.log(`Strategies: ${this.strategies.length}`);
      console.log(`Rounds per game: ${this.config.rounds}`);
      console.log(`Total games: ${this.strategies.length * (this.strategies.length - 1) / 2}`);
      console.log('\n' + '═'.repeat(60) + '\n');
    }
    
    // Round-robin: each strategy plays each other strategy
    for (let i = 0; i < this.strategies.length; i++) {
      for (let j = i + 1; j < this.strategies.length; j++) {
        await this.playMatch(this.strategies[i], this.strategies[j]);
      }
    }
    
    // Calculate final standings
    this.calculateStandings();
    
    const duration = Date.now() - startTime;
    
    if (this.config.verbose) {
      console.log(`\n✓ Tournament complete in ${duration}ms\n`);
    }
    
    return this.getResults();
  }
  
  /**
   * Play a match between two strategies
   */
  async playMatch(strategy1, strategy2) {
    if (this.config.verbose) {
      console.log(`${strategy1.name} vs ${strategy2.name}`);
    }
    
    // Create a fresh game
    const game = createGame(this.engine, {
      rounds: this.config.rounds
    });
    
    // Initialize game
    game.initialize(
      { name: strategy1.name, strategy: strategy1.strategy },
      { name: strategy2.name, strategy: strategy2.strategy }
    );
    
    // Play the game
    await game.playGame();
    
    // Get results
    const results = game.getResults();
    
    // Update strategy stats
    const s1Score = results.scores[strategy1.name];
    const s2Score = results.scores[strategy2.name];
    
    strategy1.totalScore += s1Score;
    strategy1.gamesPlayed++;
    
    strategy2.totalScore += s2Score;
    strategy2.gamesPlayed++;
    
    // Track wins/losses/ties
    if (s1Score > s2Score) {
      strategy1.wins++;
      strategy2.losses++;
    } else if (s2Score > s1Score) {
      strategy2.wins++;
      strategy1.losses++;
    } else {
      strategy1.ties++;
      strategy2.ties++;
    }
    
    // Track cooperation/defection
    const coopRate1 = parseFloat(results.cooperationRates[strategy1.name]);
    const coopRate2 = parseFloat(results.cooperationRates[strategy2.name]);
    
    strategy1.cooperations += Math.round((coopRate1 / 100) * this.config.rounds);
    strategy1.defections += Math.round(((100 - coopRate1) / 100) * this.config.rounds);
    
    strategy2.cooperations += Math.round((coopRate2 / 100) * this.config.rounds);
    strategy2.defections += Math.round(((100 - coopRate2) / 100) * this.config.rounds);
    
    // Store match result
    this.results.push({
      agent1: strategy1.name,
      agent2: strategy2.name,
      score1: s1Score,
      score2: s2Score,
      winner: results.winner,
      cooperationRate: results.outcomes.cooperationRate
    });
    
    if (this.config.verbose) {
      console.log(`  ${strategy1.name}: ${s1Score} | ${strategy2.name}: ${s2Score} | Winner: ${results.winner}\n`);
    }
  }
  
  /**
   * Calculate final standings
   */
  calculateStandings() {
    this.standings = this.strategies
      .map(s => ({
        rank: 0,
        name: s.name,
        description: s.description,
        totalScore: s.totalScore,
        avgScore: (s.totalScore / (s.gamesPlayed * this.config.rounds)).toFixed(3),
        gamesPlayed: s.gamesPlayed,
        wins: s.wins,
        losses: s.losses,
        ties: s.ties,
        winRate: ((s.wins / s.gamesPlayed) * 100).toFixed(1) + '%',
        cooperationRate: ((s.cooperations / (s.cooperations + s.defections)) * 100).toFixed(1) + '%'
      }))
      .sort((a, b) => b.totalScore - a.totalScore)
      .map((s, i) => ({ ...s, rank: i + 1 }));
  }
  
  /**
   * Get tournament results
   */
  getResults() {
    return {
      strategies: this.strategies.length,
      totalGames: this.results.length,
      roundsPerGame: this.config.rounds,
      standings: this.standings,
      matches: this.results
    };
  }
  
  /**
   * Print formatted results
   */
  printResults() {
    console.log('\n' + '═'.repeat(80));
    console.log('TOURNAMENT RESULTS');
    console.log('═'.repeat(80) + '\n');
    
    console.log('FINAL STANDINGS:\n');
    console.log(
      'Rank'.padEnd(6) +
      'Strategy'.padEnd(25) +
      'Score'.padEnd(10) +
      'Avg'.padEnd(8) +
      'W-L-T'.padEnd(12) +
      'Win%'.padEnd(8) +
      'Coop%'
    );
    console.log('─'.repeat(80));
    
    this.standings.forEach(s => {
      console.log(
        `${s.rank}`.padEnd(6) +
        s.name.padEnd(25) +
        `${s.totalScore}`.padEnd(10) +
        s.avgScore.padEnd(8) +
        `${s.wins}-${s.losses}-${s.ties}`.padEnd(12) +
        s.winRate.padEnd(8) +
        s.cooperationRate
      );
    });
    
    console.log('\n' + '═'.repeat(80));
    
    // Analysis
    console.log('\nKEY INSIGHTS:\n');
    
    const winner = this.standings[0];
    console.log(`🏆 Winner: ${winner.name}`);
    console.log(`   Total Score: ${winner.totalScore}`);
    console.log(`   Average Score: ${winner.avgScore} per round`);
    console.log(`   Win Rate: ${winner.winRate}`);
    console.log(`   Cooperation Rate: ${winner.cooperationRate}`);
    
    // Most cooperative
    const mostCooperative = [...this.standings]
      .sort((a, b) => parseFloat(b.cooperationRate) - parseFloat(a.cooperationRate))[0];
    console.log(`\n🤝 Most Cooperative: ${mostCooperative.name} (${mostCooperative.cooperationRate})`);
    
    // Most competitive
    const mostCompetitive = [...this.standings]
      .sort((a, b) => parseFloat(a.cooperationRate) - parseFloat(b.cooperationRate))[0];
    console.log(`⚔️  Most Competitive: ${mostCompetitive.name} (${mostCompetitive.cooperationRate})`);
    
    // Average cooperation rate
    const avgCoopRate = this.standings.reduce((sum, s) => 
      sum + parseFloat(s.cooperationRate), 0) / this.standings.length;
    console.log(`\n📊 Average Cooperation Rate: ${avgCoopRate.toFixed(1)}%`);
    
    console.log('\n' + '═'.repeat(80) + '\n');
  }
  
  /**
   * Export results to JSON
   */
  exportResults() {
    return JSON.stringify(this.getResults(), null, 2);
  }
}

/**
 * Create and run a quick tournament
 */
export async function quickTournament(engine, strategies, rounds = 100) {
  const tournament = new Tournament(engine, { rounds, verbose: true });
  
  strategies.forEach(({ name, strategy, description }) => {
    tournament.addStrategy(name, strategy, description);
  });
  
  await tournament.run();
  tournament.printResults();
  
  return tournament.getResults();
}

export default {
  Tournament,
  quickTournament
};