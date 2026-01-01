/**
 * Vectorized Poker Environment for Batch RL Training
 *
 * Runs N parallel poker environments for efficient batch training.
 * Compatible with standard vectorized environment interfaces (Gym VecEnv).
 *
 * Features:
 * - Batched reset/step operations
 * - Automatic environment reset on termination
 * - Support for both players in self-play
 * - Efficient memory layout for GPU training
 */

import { PokerAEC, PokerAECConfig } from "./PokerAEC.js";
import { RewardShapingConfig } from "./RewardShaping.js";

/**
 * Configuration for vectorized environment
 */
export interface VectorizedPokerConfig extends PokerAECConfig {
  /** Number of parallel environments (default: 8) */
  numEnvs?: number;
  /** Auto-reset environments when done (default: true) */
  autoReset?: boolean;
  /** Return observations for both players (default: false = current player only) */
  dualObservations?: boolean;
}

/**
 * Step result for a single environment
 */
export interface EnvStepResult {
  observation: number[];
  reward: number;
  terminated: boolean;
  truncated: boolean;
  info: Record<string, unknown>;
}

/**
 * Batched step result
 */
export interface BatchStepResult {
  /** Observations for all envs [numEnvs, obsSize] */
  observations: number[][];
  /** Rewards for all envs [numEnvs] */
  rewards: number[];
  /** Termination flags [numEnvs] */
  terminateds: boolean[];
  /** Truncation flags [numEnvs] */
  truncateds: boolean[];
  /** Info dicts for all envs */
  infos: Record<string, unknown>[];
  /** Current player indices for all envs [numEnvs] */
  currentPlayers: number[];
}

/**
 * Dual observation step result (for self-play training both sides)
 */
export interface DualBatchStepResult extends BatchStepResult {
  /** Observations for player 0 [numEnvs, obsSize] */
  observations0: number[][];
  /** Observations for player 1 [numEnvs, obsSize] */
  observations1: number[][];
  /** Rewards for player 0 [numEnvs] */
  rewards0: number[];
  /** Rewards for player 1 [numEnvs] */
  rewards1: number[];
}

/**
 * Vectorized Poker Environment
 *
 * Manages N parallel poker environments for efficient batch training.
 */
export class VectorizedPoker {
  private envs: PokerAEC[];
  private config: Required<VectorizedPokerConfig>;
  private _numEnvs: number;
  private _obsSize: number;
  private _actionSize: number;
  private _playerNames: string[];

  constructor(config: VectorizedPokerConfig = {}) {
    this._numEnvs = config.numEnvs ?? 8;

    this.config = {
      smallBlind: config.smallBlind ?? 1,
      bigBlind: config.bigBlind ?? 2,
      startingChips: config.startingChips ?? 100,
      playerNames: config.playerNames ?? ["player_0", "player_1"],
      seed: config.seed ?? null,
      richObservations: config.richObservations ?? false,
      extendedActions: config.extendedActions ?? false,
      rewardShaping: config.rewardShaping ?? false,
      numEnvs: this._numEnvs,
      autoReset: config.autoReset ?? true,
      dualObservations: config.dualObservations ?? false,
    };

    this._playerNames = this.config.playerNames;

    // Create environments with different seeds
    this.envs = [];
    const baseSeed = this.config.seed ?? Date.now();
    for (let i = 0; i < this._numEnvs; i++) {
      this.envs.push(
        new PokerAEC({
          ...this.config,
          seed: baseSeed + i * 1000,
        })
      );
    }

    // Get observation and action sizes from first env
    const sampleEnv = this.envs[0];
    const obsSpace = sampleEnv.observationSpace(this._playerNames[0]);
    const actionSpace = sampleEnv.actionSpace(this._playerNames[0]);

    this._obsSize = obsSpace.shape?.[0] ?? 20;
    this._actionSize = actionSpace.n ?? 6;
  }

  /**
   * Number of parallel environments
   */
  get numEnvs(): number {
    return this._numEnvs;
  }

  /**
   * Observation size for each environment
   */
  get observationSize(): number {
    return this._obsSize;
  }

  /**
   * Number of discrete actions
   */
  get actionSize(): number {
    return this._actionSize;
  }

  /**
   * Get action names
   */
  getActionNames(): string[] {
    return this.envs[0].getActionNames();
  }

  /**
   * Get feature names for observations
   */
  getFeatureNames(): string[] {
    return this.envs[0].getFeatureNames();
  }

  /**
   * Reset all environments
   * @returns Initial observations [numEnvs, obsSize]
   */
  async reset(): Promise<number[][]> {
    const observations: number[][] = [];

    await Promise.all(
      this.envs.map(async (env, i) => {
        await env.reset();
        const agent = env.agentSelection();
        observations[i] = env.observe(agent) as number[];
      })
    );

    return observations;
  }

  /**
   * Reset specific environments
   * @param indices Environment indices to reset
   * @returns Observations for reset environments
   */
  async resetEnvs(indices: number[]): Promise<Map<number, number[]>> {
    const results = new Map<number, number[]>();

    await Promise.all(
      indices.map(async (idx) => {
        if (idx >= 0 && idx < this._numEnvs) {
          await this.envs[idx].reset();
          const agent = this.envs[idx].agentSelection();
          results.set(idx, this.envs[idx].observe(agent) as number[]);
        }
      })
    );

    return results;
  }

  /**
   * Take actions in all environments
   * @param actions Actions for each environment [numEnvs]
   * @returns Batched results
   */
  async step(actions: number[]): Promise<BatchStepResult> {
    if (actions.length !== this._numEnvs) {
      throw new Error(
        `Expected ${this._numEnvs} actions, got ${actions.length}`
      );
    }

    const observations: number[][] = [];
    const rewards: number[] = [];
    const terminateds: boolean[] = [];
    const truncateds: boolean[] = [];
    const infos: Record<string, unknown>[] = [];
    const currentPlayers: number[] = [];

    await Promise.all(
      this.envs.map(async (env, i) => {
        const agent = env.agentSelection();
        const action = actions[i];

        // Take step
        await env.step(action);

        // Get results
        const terminations = env.terminations();
        const truncations = env.truncations();
        const rewardsMap = env.rewards();
        const infosMap = env.infos();

        const terminated = terminations[agent];
        const truncated = truncations[agent];

        rewards[i] = rewardsMap[agent];
        terminateds[i] = terminated;
        truncateds[i] = truncated;
        infos[i] = infosMap[agent];

        // Auto-reset if done
        if ((terminated || truncated) && this.config.autoReset) {
          await env.reset();
        }

        // Get next observation and current player
        const nextAgent = env.agentSelection();
        observations[i] = env.observe(nextAgent) as number[];
        currentPlayers[i] = this._playerNames.indexOf(nextAgent);
      })
    );

    return {
      observations,
      rewards,
      terminateds,
      truncateds,
      infos,
      currentPlayers,
    };
  }

  /**
   * Take actions with dual observations (for self-play)
   * Returns observations and rewards for both players
   */
  async stepDual(actions: number[]): Promise<DualBatchStepResult> {
    const baseResult = await this.step(actions);

    const observations0: number[][] = [];
    const observations1: number[][] = [];
    const rewards0: number[] = [];
    const rewards1: number[] = [];

    for (let i = 0; i < this._numEnvs; i++) {
      const env = this.envs[i];
      const rewardsMap = env.rewards();

      observations0[i] = env.observe(this._playerNames[0]) as number[];
      observations1[i] = env.observe(this._playerNames[1]) as number[];
      rewards0[i] = rewardsMap[this._playerNames[0]];
      rewards1[i] = rewardsMap[this._playerNames[1]];
    }

    return {
      ...baseResult,
      observations0,
      observations1,
      rewards0,
      rewards1,
    };
  }

  /**
   * Get action masks for all environments
   * @returns Action masks [numEnvs, actionSize]
   */
  getActionMasks(): boolean[][] {
    return this.envs.map((env) => {
      const agent = env.agentSelection();
      return env.actionMask(agent);
    });
  }

  /**
   * Get current player indices for all environments
   * @returns Player indices [numEnvs] (0 or 1)
   */
  getCurrentPlayers(): number[] {
    return this.envs.map((env) => {
      const agent = env.agentSelection();
      return this._playerNames.indexOf(agent);
    });
  }

  /**
   * Get chip counts for all players in all environments
   * @returns Chip counts [numEnvs, 2]
   */
  getChips(): number[][] {
    return this.envs.map((env) => [
      env.getChips(this._playerNames[0]),
      env.getChips(this._playerNames[1]),
    ]);
  }

  /**
   * Get pot sizes for all environments
   * @returns Pot sizes [numEnvs]
   */
  getPots(): number[] {
    return this.envs.map((env) => env.getPotSize());
  }

  /**
   * Get game phases for all environments
   * @returns Phases [numEnvs]
   */
  getPhases(): string[] {
    return this.envs.map((env) => env.getPhase());
  }

  /**
   * Render a specific environment
   */
  render(envIdx: number = 0): void {
    if (envIdx >= 0 && envIdx < this._numEnvs) {
      this.envs[envIdx].render();
    }
  }

  /**
   * Close all environments
   */
  close(): void {
    this.envs.forEach((env) => env.close());
  }

  /**
   * Get a single environment (for debugging)
   */
  getEnv(idx: number): PokerAEC | null {
    return idx >= 0 && idx < this._numEnvs ? this.envs[idx] : null;
  }
}

/**
 * Create a vectorized environment with default settings
 */
export function makeVectorizedPoker(
  numEnvs: number,
  config?: Omit<VectorizedPokerConfig, "numEnvs">
): VectorizedPoker {
  return new VectorizedPoker({ ...config, numEnvs });
}

/**
 * Flatten batched observations to a single array
 * Useful for frameworks expecting flat arrays
 */
export function flattenObservations(observations: number[][]): number[] {
  return observations.flat();
}

/**
 * Reshape flat array back to batched observations
 */
export function reshapeObservations(
  flat: number[],
  numEnvs: number,
  obsSize: number
): number[][] {
  const result: number[][] = [];
  for (let i = 0; i < numEnvs; i++) {
    result.push(flat.slice(i * obsSize, (i + 1) * obsSize));
  }
  return result;
}

/**
 * Sample random valid actions for all environments
 */
export function sampleRandomActions(actionMasks: boolean[][]): number[] {
  return actionMasks.map((mask) => {
    const validActions = mask
      .map((valid, idx) => (valid ? idx : -1))
      .filter((idx) => idx >= 0);
    if (validActions.length === 0) return 0;
    return validActions[Math.floor(Math.random() * validActions.length)];
  });
}
