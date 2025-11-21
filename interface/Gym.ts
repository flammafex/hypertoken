/*
 * interface/Gym.ts
 * A standardized Reinforcement Learning interface for HyperToken
 * Compatible with OpenAI Gym / PettingZoo API paradigms.
 */

export type Observation = number[];
export type ActionID = number;

export interface StepResult {
  observation: Observation;
  reward: number;
  terminated: boolean; // Game over (Win/Loss)
  truncated: boolean;  // Max turns reached
  info: Record<string, any>;
}

export interface Space {
  shape: number[];
  low?: number[];
  high?: number[];
  n?: number; // For discrete spaces
}

/**
 * Abstract base class for HyperToken RL Environments.
 * Wraps an Engine instance and converts semantic state -> numeric tensors.
 */
export abstract class GymEnvironment {
  abstract get observationSpace(): Space;
  abstract get actionSpace(): Space;

  /**
   * Resets the engine to an initial state.
   * @returns The initial observation.
   */
  abstract reset(seed?: number): Promise<Observation>;

  /**
   * Executes one time-step within the environment.
   * @param action - The discrete action ID chosen by the agent.
   */
  abstract step(action: ActionID): Promise<StepResult>;

  /**
   * Renders the current state (CLI or other).
   */
  abstract render(): void;
  
  /**
   * Helper to normalize values to 0-1 range.
   */
  protected normalize(val: number, min: number, max: number): number {
    return (val - min) / (max - min);
  }
}