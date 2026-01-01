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
 * engine/Script.ts
 * Deterministic macro-actions runner (UI-agnostic)
 */

import { Engine } from "./Engine.js";

/**
 * Individual step in a script sequence
 */
export interface ScriptStep {
  type: string;
  payload?: any;
  delay?: number;
  reversible?: boolean;
}

/**
 * Options for script execution
 */
export interface RunOptions {
  signal?: AbortSignal;
}

/**
 * Serialized script format
 */
export interface ScriptJSON {
  name: string;
  steps: ScriptStep[];
}

/**
 * Represents an ordered sequence of engine actions executed with optional delays.
 * Scripts are higher-level orchestration units used by RuleEngine or external
 * controllers to express procedures as data.
 *
 * A script is defined by:
 *  - name: identifier for diagnostics and event emission
 *  - steps: array of { type, payload?, delay?, reversible? }
 *
 * Execution is linear and cooperative: the run() loop observes an AbortSignal
 * for cancellation and emits lifecycle events without coupling to any UI.
 */
export class Script {
  name: string;
  steps: ScriptStep[];

  // Runtime state; separated from definition for reentrancy and introspection.
  running: boolean;
  index: number;

  constructor(name: string, steps: ScriptStep[] = []) {
    // Static metadata and immutable definition of intended procedure.
    this.name = name;
    this.steps = Array.isArray(steps) ? steps.slice() : [];

    this.running = false;
    this.index = 0;
  }

  /**
   * Appends a single step to the procedure. Mutates the definition in-place.
   * Steps are executed in insertion order unless the consumer rebuilds the array.
   */
  add(step: ScriptStep): this {
    this.steps.push(step);
    return this;
  }

  /**
   * Removes all steps and repositions the instruction pointer.
   * Used when recycling a Script instance across scenarios.
   */
  clear(): this {
    this.steps.length = 0;
    this.index = 0;
    return this;
  }

  /**
   * Serializes the script definition (excluding runtime state).
   * Suitable for persistence or transmission across processes.
   */
  toJSON(): ScriptJSON {
    return { name: this.name, steps: this.steps.slice() };
  }

  /**
   * Recreates a Script from serialized definition. Runtime fields are reset.
   */
  static fromJSON(obj: any): Script {
    return new Script(obj?.name ?? "script", obj?.steps ?? []);
  }

  /**
   * Executes the script against the provided engine. Each step dispatches
   * an engine action with optional delay. The loop is cooperative: callers
   * can provide an AbortSignal to terminate early without exception flow.
   *
   * Events:
   *  - script:start   { name, steps }
   *  - script:complete{ name, completed }
   *
   * The reversible flag is forwarded to the engine to inform timeline controls.
   */
  async run(engine: Engine, { signal }: RunOptions = {}): Promise<void> {
    if (this.running) return;
    this.running = true;
    engine?.emit?.("script:start", { payload: { name: this.name, steps: this.steps.length } });

    try {
      for (this.index = 0; this.index < this.steps.length; this.index++) {
        if (signal?.aborted) break;

        const { type, payload = {}, delay = 0, reversible = true } = this.steps[this.index];

        // Dispatch is synchronous from the script's perspective; action handlers
        // may perform asynchronous work internally as dictated by the engine domain.
        engine.dispatch(type, payload, { reversible });

        // Delay is consumer-controlled pacing; preserves deterministic ordering.
        if (delay && !signal?.aborted) {
          await new Promise(r => setTimeout(r, delay));
        }

        // Check abort again after delay in case signal was aborted during delay
        if (signal?.aborted) break;
      }
    } finally {
      const completed = this.index >= this.steps.length;
      this.running = false;
      engine?.emit?.("script:complete", { payload: { name: this.name, completed } });
    }
  }

  /**
   * Emits a semantic stop event. Cooperative cancellation is performed by
   * providing an AbortSignal to run(); this method does not force termination.
   * It exists to standardize external controller intent and telemetry.
   */
  stop(engine: Engine): void {
    engine?.emit?.("script:stop", { payload: { name: this.name, at: this.index } });
  }
}
