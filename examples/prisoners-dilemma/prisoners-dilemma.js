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
 * Two agents simultaneously choose to cooperate or defect.
 * 
 * Payoff Matrix (standard):
 *                Agent 2
 *              C         D
 *         C  (3,3)     (0,5)
 * Agent 1
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
    this.agent1Moves = [];
    this.agent2Moves = [];
  }
  
  /**
   * Initialize game with two agents
   */
  async initialize(agent1, agent2) {
    await this.engine.dispatch('game:loopInit', { maxTurns: this.config.rounds });
    await this.engine.dispatch('game:start');

    await this.engine.dispatch('agent:create', { name: agent1.name || 'Agent 1' });
    await this.engine.dispatch('agent:create', { name: agent2.name || 'Agent 2' });

    // Store agent name references (reads from CRDT state)
    this.agent1Name = agent1.name || 'Agent 1';
    this.agent2Name = agent2.name || 'Agent 2';
    this.agent1Strategy = agent1.strategy;
    this.agent2Strategy = agent2.strategy;

    await this.engine.dispatch('game:loopStart');
    await this.engine.dispatch('game:mergeState', {
      state: { round: 0, moves: { [this.agent1Name]: [], [this.agent2Name]: [] } }
    });

    this.history = [];
    return this;
  }

  get agent1() { return this.engine._agents.find(p => p.name === this.agent1Name); }
  get agent2() { return this.engine._agents.find(p => p.name === this.agent2Name); }
  
  /**
   * Play a single round
   */
  async playRound() {
    const gstate = this.engine._gameState;
    const currentRound = (gstate.round ?? 0) + 1;
    const a1Moves = gstate.moves?.[this.agent1Name] ?? [];
    const a2Moves = gstate.moves?.[this.agent2Name] ?? [];

    // Get moves from both agents' strategies
    const p1Move = await this.getAgentMove(this.agent1Strategy, a1Moves, a2Moves, currentRound);
    const p2Move = await this.getAgentMove(this.agent2Strategy, a2Moves, a1Moves, currentRound);

    const outcome = this.calculatePayoffs(p1Move, p2Move);

    await this.engine.dispatch('agent:giveResource', { name: this.agent1Name, resource: 'score', amount: outcome.p1 });
    await this.engine.dispatch('agent:giveResource', { name: this.agent2Name, resource: 'score', amount: outcome.p2 });
    await this.engine.dispatch('game:nextTurn', { agentCount: 2 });
    await this.engine.dispatch('game:mergeState', {
      state: {
        round: currentRound,
        moves: {
          ...gstate.moves,
          [this.agent1Name]: [...a1Moves, p1Move],
          [this.agent2Name]: [...a2Moves, p2Move],
        },
      }
    });

    const round = {
      round: currentRound,
      p1Move,
      p2Move,
      p1Payoff: outcome.p1,
      p2Payoff: outcome.p2,
      p1Score: this.agent1?.resources?.score ?? 0,
      p2Score: this.agent2?.resources?.score ?? 0,
    };

    this.history.push(round);
    this.engine.emit('round:complete', { payload: round });
    return round;
  }
  
  /**
   * Get move from a agent's strategy
   */
  async getAgentMove(strategy, ownHistory, opponentHistory, round) {
    if (typeof strategy === 'function') {
      return await strategy(ownHistory, opponentHistory, round);
    } else if (strategy && typeof strategy.decide === 'function') {
      return await strategy.decide(ownHistory, opponentHistory, round);
    }
    return Math.random() < 0.5 ? COOPERATE : DEFECT;
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
    for (let i = 0; i < this.config.rounds; i++) {
      await this.playRound();
    }

    const winner = this.determineWinner();
    await this.engine.dispatch('game:end', {
      winner: winner?.name || null,
      reason: 'rounds_complete',
      finalScores: {
        [this.agent1Name]: this.agent1?.resources?.score ?? 0,
        [this.agent2Name]: this.agent2?.resources?.score ?? 0,
      }
    });

    return this.getResults();
  }
  
  /**
   * Determine winner
   */
  determineWinner() {
    const p1Score = this.agent1?.resources?.score ?? 0;
    const p2Score = this.agent2?.resources?.score ?? 0;
    if (p1Score > p2Score) return this.agent1;
    if (p2Score > p1Score) return this.agent2;
    return null;
  }

  getResults() {
    const gstate = this.engine._gameState;
    const currentRound = gstate.round ?? this.history.length;
    const p1Score = this.agent1?.resources?.score ?? 0;
    const p2Score = this.agent2?.resources?.score ?? 0;
    const a1Moves = gstate.moves?.[this.agent1Name] ?? [];
    const a2Moves = gstate.moves?.[this.agent2Name] ?? [];

    const p1Cooperations = a1Moves.filter(m => m === COOPERATE).length;
    const p2Cooperations = a2Moves.filter(m => m === COOPERATE).length;

    const p1CoopRate = currentRound > 0 ? p1Cooperations / currentRound : 0;
    const p2CoopRate = currentRound > 0 ? p2Cooperations / currentRound : 0;
    
    const mutualCooperation = this.history.filter(r =>
      r.p1Move === COOPERATE && r.p2Move === COOPERATE
    ).length;
    const mutualDefection = this.history.filter(r =>
      r.p1Move === DEFECT && r.p2Move === DEFECT
    ).length;
    const exploitation = this.history.filter(r => r.p1Move !== r.p2Move).length;
    const avgDivisor = currentRound > 0 ? currentRound : 1;

    return {
      rounds: currentRound,
      winner: this.determineWinner()?.name || 'Tie',
      scores: { [this.agent1Name]: p1Score, [this.agent2Name]: p2Score },
      avgScores: {
        [this.agent1Name]: (p1Score / avgDivisor).toFixed(2),
        [this.agent2Name]: (p2Score / avgDivisor).toFixed(2),
      },
      cooperationRates: {
        [this.agent1Name]: (p1CoopRate * 100).toFixed(1) + '%',
        [this.agent2Name]: (p2CoopRate * 100).toFixed(1) + '%',
      },
      outcomes: {
        mutualCooperation,
        mutualDefection,
        exploitation,
        cooperationRate: ((mutualCooperation / avgDivisor) * 100).toFixed(1) + '%',
      },
      history: this.history,
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
    for (const [name, score] of Object.entries(results.scores)) {
      lines.push(`  ${name}: ${score} (avg: ${results.avgScores[name]})`);
    }
    lines.push('');
    lines.push('Cooperation Rates:');
    for (const [name, rate] of Object.entries(results.cooperationRates)) {
      lines.push(`  ${name}: ${rate}`);
    }
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