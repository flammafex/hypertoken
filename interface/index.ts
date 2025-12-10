/*
 * interface/index.ts
 * Barrel exports for HyperToken RL interfaces
 */

// OpenAI Gym interface (single-agent)
export {
  GymEnvironment,
  Observation,
  ActionID,
  StepResult,
  Space,
} from "./Gym.js";

// PettingZoo AEC interface (multi-agent, turn-based)
export { AECEnvironment, AECStepResult } from "./PettingZoo.js";

// PettingZoo Parallel interface (multi-agent, simultaneous)
export {
  ParallelEnvironment,
  ParallelStepResult,
} from "./PettingZooParallel.js";

// ONNX inference agent (browser/Node.js)
export {
  ONNXAgent,
  ONNXAgentOptions,
  ONNXMetadata,
} from "./ONNXAgent.js";
