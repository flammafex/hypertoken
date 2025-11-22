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
 * engine/Recorder.ts
 * Lightweight action logger + replay utility
 */

import { Action } from "./Action.js";
import { Engine } from "./Engine.js";

/**
 * Options for replay functionality
 */
export interface ReplayOptions {
  delay?: number;
  stopOnError?: boolean;
}

/**
 * Recorder for capturing and replaying engine actions
 *
 * Useful for debugging, testing, and creating reproducible scenarios.
 * Actions are stored as plain JSON for portability.
 */
export class Recorder {
  engine: Engine;
  log: any[];
  enabled: boolean;
  private _onAction: (e: any) => void;

  constructor(engine: Engine) {
    this.engine = engine;
    this.log = [];
    this.enabled = false;
    this._onAction = (e: any) => {
      if (!this.enabled) return;
      // Extract the action from event payload (nested in e.payload.payload)
      const action = e?.payload?.payload;
      this.log.push(action?.toJSON ? action.toJSON() : action);
    };
  }

  /**
   * Start recording actions
   */
  start(): this {
    if (this.enabled) return this;
    this.enabled = true;
    this.engine?.on?.("engine:action", this._onAction);
    this.engine?.emit?.("recorder:start", { payload: { size: this.log.length } });
    return this;
  }

  /**
   * Stop recording actions
   */
  stop(): this {
    if (!this.enabled) return this;
    this.enabled = false;
    this.engine?.off?.("engine:action", this._onAction);
    this.engine?.emit?.("recorder:stop", { payload: { size: this.log.length } });
    return this;
  }

  /**
   * Clear the action log
   */
  clear(): this {
    this.log.length = 0;
    this.engine?.emit?.("recorder:clear");
    return this;
  }

  /**
   * Export the log as JSON string
   */
  exportJSON(): string {
    return JSON.stringify(this.log, null, 2);
  }

  /**
   * Import actions from JSON string or array
   */
  importJSON(json: string | any[]): boolean {
    try {
      const arr = typeof json === "string" ? JSON.parse(json) : json;
      if (!Array.isArray(arr)) throw new Error("Invalid log format");
      this.log = arr;
      this.engine?.emit?.("recorder:import", { payload: { size: this.log.length } });
      return true;
    } catch (err) {
      this.engine?.emit?.("recorder:error", { payload: { error: err } });
      return false;
    }
  }

  /**
   * Replays recorded actions into a target engine.
   *
   * @param targetEngine - The engine to replay actions into
   * @param options - Replay options
   * @param options.delay - Delay in ms between actions (default: 0)
   * @param options.stopOnError - Stop replay on first error (default: true)
   */
  async replay(targetEngine: Engine, { delay = 0, stopOnError = true }: ReplayOptions = {}): Promise<void> {
    if (!targetEngine) throw new Error("No target engine provided");
    targetEngine.emit?.("recorder:replay:start", { payload: { size: this.log.length } });

    for (let i = 0; i < this.log.length; i++) {
      const entry = this.log[i];
      try {
        const action = Action.fromJSON ? Action.fromJSON(entry) : entry;
        // Use apply() to avoid re-logging during replay; use dispatch if you *want* policies & logging
        targetEngine.apply(action);
        if (delay) await new Promise(r => setTimeout(r, delay));
      } catch (err) {
        targetEngine.emit?.("recorder:replay:error", { payload: { index: i, error: err } });
        if (stopOnError) break;
      }
    }

    targetEngine.emit?.("recorder:replay:complete", { payload: { size: this.log.length } });
  }
}
