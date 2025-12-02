/*
 * interface/Gym.ts
 * A standardized Reinforcement Learning interface for HyperToken
 * Compatible with OpenAI Gym / PettingZoo API paradigms.
 */
/**
 * Abstract base class for HyperToken RL Environments.
 * Wraps an Engine instance and converts semantic state -> numeric tensors.
 */
export class GymEnvironment {
    /**
     * Helper to normalize values to 0-1 range.
     */
    normalize(val, min, max) {
        return (val - min) / (max - min);
    }
}
