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
/*
 * engine/types.ts
 * Type definitions for engine-level structures
 */

import { IToken } from "../core/types.js";

/**
 * Agent/Player representation in the engine
 * This is a simplified agent used by the engine's action system
 */
export interface IEngineAgent {
  id: string;
  name: string;
  controllerLogic?: any;
  meta?: Record<string, any>;
  active: boolean;
  resources: Record<string, number>;
  inventory: IToken[];
  zones?: Map<string, any>;
  [key: string]: any; // Allow additional properties for extensibility
}

/**
 * Game state managed by the engine
 */
export interface IGameState {
  started?: boolean;
  startTime?: number;
  ended?: boolean;
  endTime?: number;
  paused?: boolean;
  pauseTime?: number;
  resumeTime?: number;
  totalPauseDuration?: number;
  phase?: string;
  turn?: number;
  winner?: string;
  reason?: string;
  [key: string]: any; // Allow additional game-specific properties
}

/**
 * Transaction record for agent interactions
 */
export interface ITransaction {
  type: 'token_transfer' | 'resource_transfer' | 'trade' | 'steal_token' | 'steal_resource' | string;
  from: string;
  to: string;
  timestamp: number;

  // For token transfers
  token?: string;

  // For resource transfers
  resource?: string;
  amount?: number;

  // For trades
  agent1?: string;
  agent2?: string;
  offer1?: {
    token?: { id: string };
    resource?: string;
    amount?: number;
  };
  offer2?: {
    token?: { id: string };
    resource?: string;
    amount?: number;
  };
}

/**
 * Engine snapshot for serialization
 */
export interface IEngineSnapshot {
  stack: any | null;
  space: any;
  source: any | null;
  history: any[];
  policies: string[];
  crdt: string;
}

/**
 * Engine state descriptor
 */
export interface IEngineState {
  version: string;
  turn: number | null;
  agents: IEngineAgent[];
  stack: any | null;
  space: any;
  source: any | null;
}
