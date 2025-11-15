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
 * Prisoner's Dilemma Game
 * 
 * Classic game theory scenario implemented with HyperToken engine.
 * Two players simultaneously choose to cooperate or defect.
 * 
 * Payoff Matrix (standard):
 *                Player 2
 *              C         D
 *         C  (3,3)     (0,5)
 * Player 1
 *         D  (5,0)     (1,1)
 * 
 * Where:
 * - Both cooperate: 3 points each (Reward)
 * - Both defect: 1 point each (Punishment)
 * - One defects, other cooperates: 5 points (Temptation), 0 points (Sucker)
 */

/**
 * Action choices
 */
export const COOPERATE = 'C';
export const DEFECT = 'D';

/**
 * Standard payoff matrix
 */
export const PAYOFFS = {
  CC: { p1: 3, p2: 3 }, // Both cooperate (Reward)
  CD: { p1: 0, p2: 5 }, // P1 cooperates, P2 defects (Sucker/Temptation)
  DC: { p1: 5, p2: 0 }, // P1 defects, P2 cooperates (Temptation/Sucker)
  DD: { p1: 1, p2: 1 }  // Both defect (Punishment)
};

/**
 * Prisoner's Dilemma Game Class
 */
export class PrisonersDilemmaGame {
  constructor(engine, config = {}) {
    this.engine = engine;
    this.config = {
      payoffs: config.payoffs || PAYOFFS,
      rounds: config.rounds || 100,
      simultaneousPlay: config.simultaneousPlay !== false
    };
    
    this.history = [];
    this.currentRound = 0;
    this.player1Moves = [];
    this.player2Moves = [];
  }
  
  /**
   * Initialize game with two players
   */
  initialize(player1, player2) {
    this.engine.dispatch('game:start');
    
    // Create players
    const p1Result = this.engine.dispatch('player:create', {
      name: player1.name || 'Player 1',
      agent: player1.strategy
    });
    
    const p2Result = this.engine.dispatch('player:create', {
      name: player2.name || 'Player 2',
      agent: player2.strategy
    });
    
    // Store player references
    this.player1 = this.engine._players.find(p => p.name === (player1.name || 'Player 1'));
    this.player2 = this.engine._players.find(p => p.name === (player2.name || 'Player 2'));
    
    // Initialize scores
    this.engine.dispatch('player:giveResource', {
      name: this.player1.name,
      resource: 'score',
      amount: 0
    });
    
    this.engine.dispatch('player:giveResource', {
      name: this.player2.name,
      resource: 'score',
      amount: 0
    });
    
    this.currentRound = 0;
    this.history = [];
    
    return this;
  }
  
  /**
   * Play a single round
   */
  async playRound() {
    this.currentRound++;
    
    // Get moves from both players
    const p1Move = await this.getPlayerMove(this.player1, this.player1Moves, this.player2Moves);
    const p2Move = await this.getPlayerMove(this.player2, this.player2Moves, this.player1Moves);
    
    // Store moves
    this.player1Moves.push(p1Move);
    this.player2Moves.push(p2Move);
    
    // Calculate payoffs
    const outcome = this.calculatePayoffs(p1Move, p2Move);
    
    // Update scores
    this.engine.dispatch('player:giveResource', {
      name: this.player1.name,
      resource: 'score',
      amount: outcome.p1
    });
    
    this.engine.dispatch('player:giveResource', {
      name: this.player2.name,
      resource: 'score',
      amount: outcome.p2
    });
    
    // Record round
    const round = {
      round: this.currentRound,
      p1Move,
      p2Move,
      p1Payoff: outcome.p1,
      p2Payoff: outcome.p2,
      p1Score: this.player1.resources.score,
      p2Score: this.player2.resources.score
    };
    
    this.history.push(round);
    
    this.engine.emit('round:complete', { payload: round });
    
    return round;
  }
  
  /**
   * Get move from a player's strategy
   */
  async getPlayerMove(player, ownHistory, opponentHistory) {
    if (typeof player.agent === 'function') {
      // Strategy is a function
      return await player.agent(ownHistory, opponentHistory, this.currentRound);
    } else if (player.agent && typeof player.agent.decide === 'function') {
      // Strategy is an object with decide method
      return await player.agent.decide(ownHistory, opponentHistory, this.currentRound);
    } else {
      // Default to random
      return Math.random() < 0.5 ? COOPERATE : DEFECT;
    }
  }
  
  /**
   * Calculate payoffs for a round
   */
  calculatePayoffs(p1Move, p2Move) {
    const key = p1Move + p2Move;
    return this.config.payoffs[key] || { p1: 0, p2: 0 };
  }
  
  /**
   * Play multiple rounds
   */
  async playGame() {
    const rounds = this.config.rounds;
    
    for (let i = 0; i < rounds; i++) {
      await this.playRound();
    }
    
    // End game
    const winner = this.determineWinner();
    
    this.engine.dispatch('game:end', {
      winner: winner?.name || null,
      reason: 'rounds_complete',
      finalScores: {
        [this.player1.name]: this.player1.resources.score,
        [this.player2.name]: this.player2.resources.score
      }
    });
    
    return this.getResults();
  }
  
  /**
   * Determine winner
   */
  determineWinner() {
    const p1Score = this.player1.resources.score;
    const p2Score = this.player2.resources.score;
    
    if (p1Score > p2Score) return this.player1;
    if (p2Score > p1Score) return this.player2;
    return null; // Tie
  }
  
  /**
   * Get game results and statistics
   */
  getResults() {
    const p1Score = this.player1.resources.score;
    const p2Score = this.player2.resources.score;
    
    // Calculate cooperation rates
    const p1Cooperations = this.player1Moves.filter(m => m === COOPERATE).length;
    const p2Cooperations = this.player2Moves.filter(m => m === COOPERATE).length;
    
    const p1CoopRate = p1Cooperations / this.currentRound;
    const p2CoopRate = p2Cooperations / this.currentRound;
    
    // Calculate mutual cooperation/defection
    const mutualCooperation = this.history.filter(r => 
      r.p1Move === COOPERATE && r.p2Move === COOPERATE
    ).length;
    
    const mutualDefection = this.history.filter(r => 
      r.p1Move === DEFECT && r.p2Move === DEFECT
    ).length;
    
    const exploitation = this.history.filter(r => 
      r.p1Move !== r.p2Move
    ).length;
    
    return {
      rounds: this.currentRound,
      winner: this.determineWinner()?.name || 'Tie',
      scores: {
        [this.player1.name]: p1Score,
        [this.player2.name]: p2Score
      },
      avgScores: {
        [this.player1.name]: (p1Score / this.currentRound).toFixed(2),
        [this.player2.name]: (p2Score / this.currentRound).toFixed(2)
      },
      cooperationRates: {
        [this.player1.name]: (p1CoopRate * 100).toFixed(1) + '%',
        [this.player2.name]: (p2CoopRate * 100).toFixed(1) + '%'
      },
      outcomes: {
        mutualCooperation,
        mutualDefection,
        exploitation,
        cooperationRate: ((mutualCooperation / this.currentRound) * 100).toFixed(1) + '%'
      },
      history: this.history
    };
  }
  
  /**
   * Get human-readable summary
   */
  getSummary() {
    const results = this.getResults();
    
    const lines = [];
    lines.push('═══ Prisoner\'s Dilemma Results ═══');
    lines.push('');
    lines.push(`Rounds Played: ${results.rounds}`);
    lines.push(`Winner: ${results.winner}`);
    lines.push('');
    lines.push('Final Scores:');
    Object.entries(results.scores).forEach(([name, score]) => {
      lines.push(`  ${name}: ${score} (avg: ${results.avgScores[name]})`);
    });
    lines.push('');
    lines.push('Cooperation Rates:');
    Object.entries(results.cooperationRates).forEach(([name, rate]) => {
      lines.push(`  ${name}: ${rate}`);
    });
    lines.push('');
    lines.push('Round Outcomes:');
    lines.push(`  Mutual Cooperation: ${results.outcomes.mutualCooperation} (${results.outcomes.cooperationRate})`);
    lines.push(`  Mutual Defection: ${results.outcomes.mutualDefection}`);
    lines.push(`  Exploitation: ${results.outcomes.exploitation}`);
    lines.push('');
    lines.push('═══════════════════════════════════');
    
    return lines.join('\n');
  }
}

/**
 * Create a new Prisoner's Dilemma game
 */
export function createGame(engine, config = {}) {
  return new PrisonersDilemmaGame(engine, config);
}

export default {
  COOPERATE,
  DEFECT,
  PAYOFFS,
  PrisonersDilemmaGame,
  createGame
};