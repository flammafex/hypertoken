/*
 * examples/prisoners-dilemma/PrisonersDilemmaParallel.ts
 * PettingZoo Parallel wrapper for Prisoner's Dilemma
 *
 * Implements the Parallel interface for simultaneous-action games.
 * Both agents submit their actions at the same time without knowing
 * what the other agent will do.
 *
 * Actions:
 *   0: Cooperate
 *   1: Defect
 *
 * Payoff Matrix (standard):
 *                  Agent 2
 *                C         D
 *           C  (3,3)     (0,5)
 * Agent 1
 *           D  (5,0)     (1,1)
 */

import {
  ParallelEnvironment,
  ParallelStepResult,
} from "../../interface/PettingZooParallel.js";
import { Observation, ActionID, Space } from "../../interface/Gym.js";

// Action constants
export const ACTION_COOPERATE = 0;
export const ACTION_DEFECT = 1;

// Standard payoff matrix
export const PAYOFFS = {
  CC: { p1: 3, p2: 3 }, // Both cooperate (Reward)
  CD: { p1: 0, p2: 5 }, // P1 cooperates, P2 defects (Sucker/Temptation)
  DC: { p1: 5, p2: 0 }, // P1 defects, P2 cooperates (Temptation/Sucker)
  DD: { p1: 1, p2: 1 }, // Both defect (Punishment)
} as const;

export interface PDConfig {
  maxRounds?: number;
  agentNames?: [string, string];
  payoffs?: typeof PAYOFFS;
  seed?: number;
}

/**
 * PettingZoo Parallel Environment for Prisoner's Dilemma
 *
 * A classic game theory scenario where two agents simultaneously choose
 * to cooperate or defect. The payoff depends on both agents' choices.
 */
export class PrisonersDilemmaParallel extends ParallelEnvironment {
  private config: Required<PDConfig>;
  private _history: Array<{ round: number; actions: Record<string, number>; rewards: Record<string, number> }> = [];
  private _currentRound: number = 0;
  private _scores: Record<string, number> = {};
  private _rng: () => number;

  constructor(config: PDConfig = {}) {
    super();

    this.config = {
      maxRounds: config.maxRounds ?? 100,
      agentNames: config.agentNames ?? ["player_0", "player_1"],
      payoffs: config.payoffs ?? PAYOFFS,
      seed: config.seed ?? Date.now(),
    };

    // Simple seeded RNG (for reproducibility)
    this._rng = this.createRNG(this.config.seed);
  }

  // === Spaces ===

  observationSpace(_agent: string): Space {
    // Observation: [myLastAction, opponentLastAction, myScore, opponentScore, roundRatio]
    // All normalized to 0-1 range
    return {
      shape: [5],
      low: [0, 0, 0, 0, 0],
      high: [1, 1, 1, 1, 1],
    };
  }

  actionSpace(_agent: string): Space {
    // 2 discrete actions: Cooperate (0), Defect (1)
    return { n: 2, shape: [] };
  }

  // === Core Loop ===

  async reset(seed?: number): Promise<Record<string, Observation>> {
    if (seed !== undefined) {
      this._rng = this.createRNG(seed);
    }

    this.resetState(this.config.agentNames);
    this._history = [];
    this._currentRound = 0;
    this._scores = {};

    for (const agent of this.config.agentNames) {
      this._scores[agent] = 0;
    }

    return this.state();
  }

  async step(actions: Record<string, ActionID>): Promise<ParallelStepResult> {
    this._currentRound++;

    const [agent1, agent2] = this.config.agentNames;
    const action1 = actions[agent1] ?? ACTION_COOPERATE;
    const action2 = actions[agent2] ?? ACTION_COOPERATE;

    // Convert actions to C/D keys
    const key = `${action1 === ACTION_COOPERATE ? "C" : "D"}${action2 === ACTION_COOPERATE ? "C" : "D"}` as keyof typeof PAYOFFS;
    const payoff = this.config.payoffs[key];

    // Update scores
    this._scores[agent1] += payoff.p1;
    this._scores[agent2] += payoff.p2;

    // Record history
    this._history.push({
      round: this._currentRound,
      actions: { [agent1]: action1, [agent2]: action2 },
      rewards: { [agent1]: payoff.p1, [agent2]: payoff.p2 },
    });

    // Check if game is over
    const isOver = this._currentRound >= this.config.maxRounds;
    if (isOver) {
      this._terminations[agent1] = true;
      this._terminations[agent2] = true;
    }

    const rewards = {
      [agent1]: payoff.p1,
      [agent2]: payoff.p2,
    };

    const observations = this.state();

    const infos = {
      [agent1]: {
        round: this._currentRound,
        myAction: action1,
        opponentAction: action2,
        totalScore: this._scores[agent1],
      },
      [agent2]: {
        round: this._currentRound,
        myAction: action2,
        opponentAction: action1,
        totalScore: this._scores[agent2],
      },
    };

    return {
      observations,
      rewards,
      terminations: this.terminations(),
      truncations: this.truncations(),
      infos,
    };
  }

  state(): Record<string, Observation> {
    const [agent1, agent2] = this.config.agentNames;
    const lastRound = this._history[this._history.length - 1];

    const obs: Record<string, Observation> = {};

    for (const agent of this.config.agentNames) {
      const opponent = agent === agent1 ? agent2 : agent1;

      // Get last actions (default to 0.5 for first round - neutral)
      const myLastAction = lastRound
        ? this.normalize(lastRound.actions[agent], 0, 1)
        : 0.5;
      const opponentLastAction = lastRound
        ? this.normalize(lastRound.actions[opponent], 0, 1)
        : 0.5;

      // Normalize scores (assuming max possible score is maxRounds * 5)
      const maxScore = this.config.maxRounds * 5;
      const myScore = this.normalize(this._scores[agent] ?? 0, 0, maxScore);
      const opponentScore = this.normalize(this._scores[opponent] ?? 0, 0, maxScore);

      // Round progress
      const roundRatio = this.normalize(this._currentRound, 0, this.config.maxRounds);

      obs[agent] = [myLastAction, opponentLastAction, myScore, opponentScore, roundRatio];
    }

    return obs;
  }

  // === Rendering ===

  render(): void {
    const [agent1, agent2] = this.config.agentNames;
    const lastRound = this._history[this._history.length - 1];

    console.log("\n=== Prisoner's Dilemma ===");
    console.log(`Round: ${this._currentRound} / ${this.config.maxRounds}`);

    if (lastRound) {
      const a1 = lastRound.actions[agent1] === ACTION_COOPERATE ? "C" : "D";
      const a2 = lastRound.actions[agent2] === ACTION_COOPERATE ? "C" : "D";
      console.log(`Last Round: ${agent1}=${a1}, ${agent2}=${a2}`);
      console.log(`Rewards: ${agent1}=${lastRound.rewards[agent1]}, ${agent2}=${lastRound.rewards[agent2]}`);
    }

    console.log(`Scores: ${agent1}=${this._scores[agent1]}, ${agent2}=${this._scores[agent2]}`);
    console.log("==========================\n");
  }

  close(): void {
    // Cleanup if needed
  }

  // === Game Statistics ===

  /**
   * Returns detailed game statistics
   */
  getStatistics(): {
    rounds: number;
    scores: Record<string, number>;
    cooperationRates: Record<string, number>;
    mutualCooperation: number;
    mutualDefection: number;
    exploitation: number;
    winner: string | null;
  } {
    const [agent1, agent2] = this.config.agentNames;

    const agent1Coops = this._history.filter((r) => r.actions[agent1] === ACTION_COOPERATE).length;
    const agent2Coops = this._history.filter((r) => r.actions[agent2] === ACTION_COOPERATE).length;

    const mutualCoop = this._history.filter(
      (r) => r.actions[agent1] === ACTION_COOPERATE && r.actions[agent2] === ACTION_COOPERATE
    ).length;
    const mutualDefect = this._history.filter(
      (r) => r.actions[agent1] === ACTION_DEFECT && r.actions[agent2] === ACTION_DEFECT
    ).length;
    const exploitation = this._history.filter(
      (r) => r.actions[agent1] !== r.actions[agent2]
    ).length;

    let winner: string | null = null;
    if (this._scores[agent1] > this._scores[agent2]) winner = agent1;
    else if (this._scores[agent2] > this._scores[agent1]) winner = agent2;

    return {
      rounds: this._currentRound,
      scores: { ...this._scores },
      cooperationRates: {
        [agent1]: this._currentRound > 0 ? agent1Coops / this._currentRound : 0,
        [agent2]: this._currentRound > 0 ? agent2Coops / this._currentRound : 0,
      },
      mutualCooperation: mutualCoop,
      mutualDefection: mutualDefect,
      exploitation,
      winner,
    };
  }

  /**
   * Returns the game history
   */
  getHistory(): typeof this._history {
    return [...this._history];
  }

  // === Private Helpers ===

  private createRNG(seed: number): () => number {
    // Simple linear congruential generator
    let state = seed;
    return () => {
      state = (state * 1664525 + 1013904223) % 4294967296;
      return state / 4294967296;
    };
  }
}
