/**
 * HyperToken Bridge Protocol
 *
 * Type definitions for the WebSocket message protocol between
 * Python clients and the Node.js environment server.
 */

import type { Space, Observation, ActionID } from "../interface/Gym.js";

// ============================================================================
// Command Types - Client -> Server
// ============================================================================

export interface ResetCommand {
  cmd: "reset";
  seed?: number;
}

export interface StepCommand {
  cmd: "step";
  action: ActionID;
}

export interface ObserveCommand {
  cmd: "observe";
  agent: string;
}

export interface LastCommand {
  cmd: "last";
}

export interface AgentsCommand {
  cmd: "agents";
}

export interface PossibleAgentsCommand {
  cmd: "possible_agents";
}

export interface AgentSelectionCommand {
  cmd: "agent_selection";
}

export interface ObservationSpaceCommand {
  cmd: "observation_space";
  agent: string;
}

export interface ActionSpaceCommand {
  cmd: "action_space";
  agent: string;
}

export interface RewardsCommand {
  cmd: "rewards";
}

export interface TerminationsCommand {
  cmd: "terminations";
}

export interface TruncationsCommand {
  cmd: "truncations";
}

export interface InfosCommand {
  cmd: "infos";
}

export interface ActionMaskCommand {
  cmd: "action_mask";
  agent: string;
}

export interface RenderCommand {
  cmd: "render";
}

export interface CloseCommand {
  cmd: "close";
}

export interface PingCommand {
  cmd: "ping";
}

export interface EnvInfoCommand {
  cmd: "env_info";
}

export type Command =
  | ResetCommand
  | StepCommand
  | ObserveCommand
  | LastCommand
  | AgentsCommand
  | PossibleAgentsCommand
  | AgentSelectionCommand
  | ObservationSpaceCommand
  | ActionSpaceCommand
  | RewardsCommand
  | TerminationsCommand
  | TruncationsCommand
  | InfosCommand
  | ActionMaskCommand
  | RenderCommand
  | CloseCommand
  | PingCommand
  | EnvInfoCommand;

// ============================================================================
// Response Types - Server -> Client
// ============================================================================

export interface OkResponse {
  ok: true;
}

export interface ErrorResponse {
  error: string;
}

export interface ObservationResponse {
  observation: Observation;
}

export interface LastResponse {
  observation: Observation;
  reward: number;
  terminated: boolean;
  truncated: boolean;
  info: Record<string, unknown>;
}

export interface AgentsResponse {
  agents: string[];
}

export interface PossibleAgentsResponse {
  possible_agents: string[];
}

export interface AgentSelectionResponse {
  agent: string;
}

export interface SpaceResponse {
  space: Space;
}

export interface RewardsResponse {
  rewards: Record<string, number>;
}

export interface TerminationsResponse {
  terminations: Record<string, boolean>;
}

export interface TruncationsResponse {
  truncations: Record<string, boolean>;
}

export interface InfosResponse {
  infos: Record<string, Record<string, unknown>>;
}

export interface ActionMaskResponse {
  mask: boolean[] | null;
}

export interface PongResponse {
  pong: number;
}

export interface EnvInfoResponse {
  env_type: string;
  env_options: Record<string, unknown>;
  possible_agents: string[];
  observation_spaces: Record<string, Space>;
  action_spaces: Record<string, Space>;
}

export type Response =
  | OkResponse
  | ErrorResponse
  | ObservationResponse
  | LastResponse
  | AgentsResponse
  | PossibleAgentsResponse
  | AgentSelectionResponse
  | SpaceResponse
  | RewardsResponse
  | TerminationsResponse
  | TruncationsResponse
  | InfosResponse
  | ActionMaskResponse
  | PongResponse
  | EnvInfoResponse;

// ============================================================================
// Helper type guard
// ============================================================================

export function isErrorResponse(response: Response): response is ErrorResponse {
  return "error" in response;
}
