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
//.engine/Action.js
export class Action {
  constructor(type, payload = {}, { seed = null, reversible = true } = {}) {
    this.id = crypto?.randomUUID?.() || `${Date.now()}-${Math.random()}`;
    this.type = type;          // e.g. "deck:draw", "table:place"
    this.payload = payload;    // event-like data
    this.seed = seed;          // for determinism
    this.reversible = reversible;
    this.timestamp = Date.now();
  }

  static fromJSON(data) {
  const a = new Action(data.type, data.payload, {
    seed: data.seed,
    reversible: data.reversible
  });
  a.timestamp = data.timestamp ?? Date.now();
  return a;
}

  toJSON() {
    return {
      type: this.type,
      payload: this.payload,
      seed: this.seed,
      reversible: this.reversible,
      timestamp: this.timestamp
    };
  }
}
