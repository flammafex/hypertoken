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
// ./interface/Narrator.js
// Converts engine events into readable commentary or logs.

import { Emitter } from "../core/events.js";

export class Narrator extends Emitter {
  /**
   * @param {Engine} engine
   * @param {object} [opts]
   * @param {boolean} [opts.verbose=false]
   * @param {(msg:string)=>void} [opts.output=console.log]
   */
  constructor(engine, { verbose = false, output = console.log } = {}) {
    super();
    this.engine = engine;
    this.verbose = verbose;
    this.output = output;

    // Subscribe to all events (engine-level)
    engine.on("*", e => this._describe(e));
  }

  _describe(e) {
    const type = e?.type ?? "unknown";
    const msg = this._formatEvent(type, e?.payload ?? {});
    if (msg) this.output(msg);
    this.emit("narration", { payload: { type, msg } });
  }

  _formatEvent(type, payload) {
    switch (type) {
      case "stack:draw":
        return `🎴 ${payload.agent ?? "A agent"} drew ${payload.count ?? 1} card(s).`;
      case "stack:shuffle":
        return `🔀 Stack shuffled${payload.seed ? ` (seed=${payload.seed})` : ""}.`;
      case "space:place":
        return `🧩 Card placed on zone "${payload.zone ?? "unknown"}".`;
      case "loop:turn:start":
        return `▶️ Turn start → ${payload.agent ?? "Unknown agent"}`;
      case "loop:turn:end":
        return `⏹️ Turn end → ${payload.agent ?? "Unknown agent"}`;
      case "loop:end":
        return `🏁 Game over after ${payload.totalTurns ?? "?"} turns.`;
      default:
        if (this.verbose) return `🪶 ${type} ${JSON.stringify(payload)}`;
        return null;
    }
  }
}
