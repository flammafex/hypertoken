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
// ./interface/HumanInterface.js
// Handles local human input → dispatches deterministic actions to the Engine.

import { Emitter } from "../core/events.js";

/**
 * HumanInterface
 * - Listens for UI or input events.
 * - Dispatches valid actions to the Engine.
 * - Updates subscribed UIs when state changes.
 */
export class HumanInterface extends Emitter {
  /**
   * @param {Engine} engine - the running engine instance
   * @param {object} [options]
   * @param {HTMLElement|Document} [options.dom] - optional root DOM for UI binding
   * @param {(state:object)=>void} [options.onUpdate] - callback for UI updates
   * @param {boolean} [options.verbose=false]
   */
constructor(engine, { adapter = null, onUpdate = null, verbose = false } = {}) {
  super();
  this.engine = engine;
  this.adapter = adapter; // could be a DOM adapter, CLI adapter, etc.
  this.onUpdate = onUpdate;
  this.verbose = verbose;

  engine.on("stateChange", e => this._update(e));
  engine.on("engine:action", e => this._logAction(e));
}

  /*───────────────────────────────────────────────
    Core interaction methods
  ───────────────────────────────────────────────*/
  handleAction(type, payload = {}) {
    try {
      if (this.verbose) console.log("🎮 dispatch", type, payload);
      this.engine.dispatch(type, payload);
      this.emit("input:action", { payload: { type, payload } });
    } catch (err) {
      console.error("HumanInterface dispatch error:", err);
      this.emit("input:error", { payload: { error: err } });
    }
  }

  /** Shortcut helpers for common verbs **/
  draw(count = 1) { this.handleAction("stack:draw", { count }); }
  shuffle(seed = null) { this.handleAction("stack:shuffle", { seed }); }
  resetStack() { this.handleAction("stack:reset"); }
  place(zone = "space") { this.handleAction("space:place", { zone }); }
  clearSpace() { this.handleAction("space:clear"); }

  /*───────────────────────────────────────────────
    Engine state updates
  ───────────────────────────────────────────────*/
  _update(e) {
    const state = this.engine.describe();
    if (this.onUpdate) this.onUpdate(state);
    this.emit("ui:update", { payload: { state } });
  }

  _logAction(e) {
    if (this.verbose) {
      console.log(`🧩 Action: ${e?.payload?.type ?? "(unknown)"}`);
    }
  }

  /*───────────────────────────────────────────────
    Lifecycle helpers
  ───────────────────────────────────────────────*/
  refresh() {
    const state = this.engine.describe();
    this.emit("ui:refresh", { payload: { state } });
    this.onUpdate?.(state);
  }

  detach() {
    this.emit("ui:detach");
    this.adapter?.cleanup?.();
  }
}
