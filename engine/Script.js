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
// ./engine/Script.js
// Deterministic macro-actions runner (UI-agnostic)

export class Script {
  /**
   * @param {string} name - script identifier
   * @param {Array<{type:string, payload?:object, delay?:number, reversible?:boolean}>} steps
   */
  constructor(name, steps = []) {
    this.name = name;
    this.steps = Array.isArray(steps) ? steps.slice() : [];
    this.running = false;
    this.index = 0;
  }

  add(step) {
    this.steps.push(step);
    return this;
  }

  clear() {
    this.steps.length = 0;
    this.index = 0;
    return this;
  }

  toJSON() {
    return { name: this.name, steps: this.steps.slice() };
  }

  static fromJSON(obj) {
    return new Script(obj?.name ?? "script", obj?.steps ?? []);
  }

  async run(engine, { signal } = {}) {
    if (this.running) return;
    this.running = true;
    engine?.emit?.("script:start", { payload: { name: this.name, steps: this.steps.length } });

    try {
      for (this.index = 0; this.index < this.steps.length; this.index++) {
        if (signal?.aborted) break;
        const { type, payload = {}, delay = 0, reversible = true } = this.steps[this.index];

        // Dispatch the action through the engine
        engine.dispatch(type, payload, { reversible });

        // Optional deterministic delay (consumer-controlled)
        if (delay && !signal?.aborted) {
          await new Promise(r => setTimeout(r, delay));
        }
      }
    } finally {
      const completed = this.index >= this.steps.length;
      this.running = false;
      engine?.emit?.("script:complete", { payload: { name: this.name, completed } });
    }
  }

  stop(engine) {
    // Caller should pass an AbortController.signal into run() for cooperative stop.
    // Provided as a semantic helper for external controllers.
    engine?.emit?.("script:stop", { payload: { name: this.name, at: this.index } });
  }
}
