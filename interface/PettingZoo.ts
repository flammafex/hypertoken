/*
 * interface/PettingZoo.ts
 * PettingZoo AEC (Agent Environment Cycle) Interface for HyperToken
 *
 * Implements the standard multi-agent RL API for turn-based games.
 * https://pettingzoo.farama.org/api/aec/
 */

import { Observation, ActionID, Space } from "./Gym.js";

/**
 * Result of the last step for an agent
 */
export interface AECStepResult {
  observation: Observation;
  reward: number;
  terminated: boolean;
  truncated: boolean;
  info: Record<string, any>;
}

/**
 * Abstract base class for PettingZoo AEC (Agent Environment Cycle) environments.
 *
 * AEC is the turn-based paradigm where agents act sequentially.
 * This maps naturally to HyperToken's GameLoop with activeAgentIndex.
 *
 * Usage pattern:
 * ```typescript
 * await env.reset();
 *
 * for (const agent of env.agentIteration()) {
 *   const observation = env.observe(agent);
 *   const action = policy(observation);
 *   await env.step(action);
 * }
 * ```
 */
export abstract class AECEnvironment {
  // === Internal State ===
  protected _agents: string[] = [];
  protected _possibleAgents: string[] = [];
  protected _rewards: Record<string, number> = {};
  protected _cumulativeRewards: Record<string, number> = {};
  protected _terminations: Record<string, boolean> = {};
  protected _truncations: Record<string, boolean> = {};
  protected _infos: Record<string, Record<string, any>> = {};
  protected _currentAgent: string = "";

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

  // === Turn Management ===

  /**
   * Returns the name of the agent whose turn it currently is.
   * This should match engine.loop.activeAgent.name in HyperToken.
   */
  agentSelection(): string {
    return this._currentAgent;
  }

  /**
   * Returns the turn order of agents.
   * Typically matches the order in possibleAgents.
   */
  get agentOrder(): string[] {
    return [...this._possibleAgents];
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
   * Returns a boolean mask of valid actions for the current agent.
   * true = action is valid, false = action is invalid.
   * Returns undefined if action masking is not supported.
   */
  actionMask(agent: string): boolean[] | undefined {
    return undefined;
  }

  // === Core Loop ===

  /**
   * Resets the environment to an initial state.
   * Initializes all agents and clears state.
   *
   * @param seed - Optional random seed for reproducibility
   */
  abstract reset(seed?: number): Promise<void>;

  /**
   * Returns the observation for a specific agent.
   * Can be called for any agent, not just the current one.
   *
   * @param agent - The agent name to observe for
   */
  abstract observe(agent: string): Observation;

  /**
   * Executes the action for the current agent.
   * After stepping, agentSelection() will return the next agent.
   *
   * @param action - The discrete action ID chosen by the current agent
   */
  abstract step(action: ActionID): Promise<void>;

  /**
   * Returns the result of the last step for the current agent.
   * Includes observation, reward, termination status, and info.
   *
   * Note: This also resets the cumulative reward for the agent.
   */
  last(): AECStepResult {
    const agent = this._currentAgent;
    const result: AECStepResult = {
      observation: this.observe(agent),
      reward: this._cumulativeRewards[agent] ?? 0,
      terminated: this._terminations[agent] ?? false,
      truncated: this._truncations[agent] ?? false,
      info: this._infos[agent] ?? {},
    };

    // Reset cumulative reward after reading
    this._cumulativeRewards[agent] = 0;

    return result;
  }

  // === State Queries ===

  /**
   * Returns the rewards for all agents from the last step.
   */
  rewards(): Record<string, number> {
    return { ...this._rewards };
  }

  /**
   * Returns the cumulative rewards for all agents.
   * Rewards accumulate until last() is called.
   */
  cumulativeRewards(): Record<string, number> {
    return { ...this._cumulativeRewards };
  }

  /**
   * Returns the termination status for all agents.
   * true = agent has been eliminated (lost/won).
   */
  terminations(): Record<string, boolean> {
    return { ...this._terminations };
  }

  /**
   * Returns the truncation status for all agents.
   * true = agent's episode was cut short (time limit, etc).
   */
  truncations(): Record<string, boolean> {
    return { ...this._truncations };
  }

  /**
   * Returns the info dictionaries for all agents.
   */
  infos(): Record<string, Record<string, any>> {
    const result: Record<string, Record<string, any>> = {};
    for (const agent of this._possibleAgents) {
      result[agent] = { ...this._infos[agent] };
    }
    return result;
  }

  // === Iteration Helpers ===

  /**
   * Generator that yields each agent in turn order.
   * Continues until all agents are terminated or truncated.
   *
   * Usage:
   * ```typescript
   * for (const agent of env.agentIteration()) {
   *   const obs = env.observe(agent);
   *   await env.step(action);
   * }
   * ```
   */
  *agentIteration(): Generator<string, void, unknown> {
    while (this.agents.length > 0) {
      const agent = this.agentSelection();
      if (this._terminations[agent] || this._truncations[agent]) {
        break;
      }
      yield agent;
    }
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
   * Helper to add reward for an agent.
   * Accumulates in _cumulativeRewards until last() is called.
   */
  protected addReward(agent: string, reward: number): void {
    this._rewards[agent] = reward;
    this._cumulativeRewards[agent] = (this._cumulativeRewards[agent] ?? 0) + reward;
  }

  /**
   * Helper to advance to the next active agent.
   * Skips terminated/truncated agents.
   */
  protected advanceAgent(): void {
    const currentIndex = this._possibleAgents.indexOf(this._currentAgent);
    let nextIndex = (currentIndex + 1) % this._possibleAgents.length;
    let checked = 0;

    while (checked < this._possibleAgents.length) {
      const nextAgent = this._possibleAgents[nextIndex];
      if (!this._terminations[nextAgent] && !this._truncations[nextAgent]) {
        this._currentAgent = nextAgent;
        return;
      }
      nextIndex = (nextIndex + 1) % this._possibleAgents.length;
      checked++;
    }

    // All agents terminated/truncated
    this._currentAgent = "";
  }

  /**
   * Helper to reset all internal state tracking.
   */
  protected resetState(agents: string[]): void {
    this._possibleAgents = [...agents];
    this._agents = [...agents];
    this._rewards = {};
    this._cumulativeRewards = {};
    this._terminations = {};
    this._truncations = {};
    this._infos = {};

    for (const agent of agents) {
      this._rewards[agent] = 0;
      this._cumulativeRewards[agent] = 0;
      this._terminations[agent] = false;
      this._truncations[agent] = false;
      this._infos[agent] = {};
    }

    if (agents.length > 0) {
      this._currentAgent = agents[0];
    }
  }
}
