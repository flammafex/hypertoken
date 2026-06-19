/*
 * interface/PettingZooParallel.ts
 * PettingZoo Parallel Interface for HyperToken
 *
 * Implements the standard multi-agent RL API for simultaneous-action games.
 * https://pettingzoo.farama.org/api/parallel/
 */

import { Observation, ActionID, Space } from "./Gym.js";

/**
 * Result of a parallel step containing observations, rewards, etc. for all agents.
 */
export interface ParallelStepResult {
  observations: Record<string, Observation>;
  rewards: Record<string, number>;
  terminations: Record<string, boolean>;
  truncations: Record<string, boolean>;
  infos: Record<string, Record<string, any>>;
}

/**
 * Abstract base class for PettingZoo Parallel environments.
 *
 * In Parallel environments, all agents act simultaneously in each step.
 * This is suitable for games like Prisoner's Dilemma, Rock-Paper-Scissors,
 * or any game where agents submit actions at the same time.
 *
 * Usage pattern:
 * ```typescript
 * let observations = await env.reset();
 *
 * while (env.agents.length > 0) {
 *   const actions: Record<string, ActionID> = {};
 *   for (const agent of env.agents) {
 *     actions[agent] = policy(observations[agent]);
 *   }
 *   const result = await env.step(actions);
 *   observations = result.observations;
 * }
 * ```
 */
export abstract class ParallelEnvironment {
  // === Internal State ===
  protected _agents: string[] = [];
  protected _possibleAgents: string[] = [];
  protected _terminations: Record<string, boolean> = {};
  protected _truncations: Record<string, boolean> = {};

  // === Agent Management ===

  /**
   * Returns the list of currently active (non-terminated) agents.
   * This list shrinks as agents are eliminated.
   */
  get agents(): string[] {
    return this._agents.filter(
      (agent) => !this._terminations[agent] && !this._truncations[agent]
    );
  }

  /**
   * Returns the list of all possible agents that could participate.
   * This list remains constant throughout the episode.
   */
  get possibleAgents(): string[] {
    return [...this._possibleAgents];
  }

  /**
   * Returns the number of currently active agents.
   */
  get numAgents(): number {
    return this.agents.length;
  }

  // === Spaces (per-agent) ===

  /**
   * Returns the observation space for a given agent.
   * Different agents may have different observation spaces.
   */
  abstract observationSpace(agent: string): Space;

  /**
   * Returns the action space for a given agent.
   * Different agents may have different action spaces.
   */
  abstract actionSpace(agent: string): Space;

  /**
   * Returns a boolean mask of valid actions for an agent.
   * true = action is valid, false = action is invalid.
   * Returns undefined if action masking is not supported.
   */
  actionMask(agent: string): boolean[] | undefined {
    return undefined;
  }

  // === Core Loop ===

  /**
   * Resets the environment to an initial state.
   * Returns the initial observations for all agents.
   *
   * @param seed - Optional random seed for reproducibility
   * @returns Observations for all agents
   */
  abstract reset(seed?: number): Promise<Record<string, Observation>>;

  /**
   * Executes actions for all agents simultaneously.
   * Returns observations, rewards, and status for all agents.
   *
   * @param actions - Dictionary mapping agent names to their chosen actions
   * @returns Step result containing observations, rewards, terminations, truncations, infos
   */
  abstract step(actions: Record<string, ActionID>): Promise<ParallelStepResult>;

  // === State Queries ===

  /**
   * Returns current observations for all active agents.
   */
  abstract state(): Record<string, Observation>;

  /**
   * Returns the termination status for all agents.
   */
  terminations(): Record<string, boolean> {
    return { ...this._terminations };
  }

  /**
   * Returns the truncation status for all agents.
   */
  truncations(): Record<string, boolean> {
    return { ...this._truncations };
  }

  // === Rendering ===

  /**
   * Renders the current state of the environment.
   */
  abstract render(): void;

  /**
   * Cleans up any resources used by the environment.
   */
  abstract close(): void;

  // === Protected Helpers ===

  /**
   * Helper to normalize values to 0-1 range.
   */
  protected normalize(val: number, min: number, max: number): number {
    if (max === min) return 0;
    return (val - min) / (max - min);
  }

  /**
   * Helper to reset all internal state tracking.
   */
  protected resetState(agents: string[]): void {
    this._possibleAgents = [...agents];
    this._agents = [...agents];
    this._terminations = {};
    this._truncations = {};

    for (const agent of agents) {
      this._terminations[agent] = false;
      this._truncations[agent] = false;
    }
  }
}
