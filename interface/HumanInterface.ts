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
// ./interface/HumanInterface.ts
// Handles local human input → dispatches deterministic actions to the Engine.

import { Emitter } from "../core/events.js";
import type { IEvent } from "../core/events.js";
import type { Engine } from "../engine/Engine.js";

export interface HumanInterfaceAdapter {
  cleanup?: () => void;
}

export interface HumanInterfaceOptions {
  adapter?: HumanInterfaceAdapter | null;
  onUpdate?: ((state: unknown) => void) | null;
  verbose?: boolean;
}

/**
 * HumanInterface
 * - Listens for UI or input events.
 * - Dispatches valid actions to the Engine.
 * - Updates subscribed UIs when state changes.
 */
export class HumanInterface extends Emitter {
  engine: Engine;
  adapter: HumanInterfaceAdapter | null;
  onUpdate: ((state: unknown) => void) | null;
  verbose: boolean;

  constructor(engine: Engine, { adapter = null, onUpdate = null, verbose = false }: HumanInterfaceOptions = {}) {
    super();
    this.engine = engine;
    this.adapter = adapter;
    this.onUpdate = onUpdate;
    this.verbose = verbose;

    engine.on("stateChange", (e) => this._update(e));
    engine.on("engine:action", (e) => this._logAction(e));
  }

  /*───────────────────────────────────────────────
    Core interaction methods
  ───────────────────────────────────────────────*/
  handleAction(type: string, payload: Record<string, unknown> = {}): void {
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
  draw(count = 1): void { this.handleAction("stack:draw", { count }); }
  shuffle(seed: string | number | null = null): void { this.handleAction("stack:shuffle", { seed: seed ?? undefined }); }
  resetStack(): void { this.handleAction("stack:reset"); }
  place(zone = "space"): void { this.handleAction("space:place", { zone }); }
  clearSpace(): void { this.handleAction("space:clear"); }

  /*───────────────────────────────────────────────
    Engine state updates
  ───────────────────────────────────────────────*/
  private _update(_e: IEvent): void {
    const state = this.engine.describe();
    if (this.onUpdate) this.onUpdate(state);
    this.emit("ui:update", { payload: { state } });
  }

  private _logAction(e: IEvent): void {
    if (this.verbose) {
      console.log(`🧩 Action: ${(e?.payload as any)?.type ?? "(unknown)"}`);
    }
  }

  /*───────────────────────────────────────────────
    Lifecycle helpers
  ───────────────────────────────────────────────*/
  refresh(): void {
    const state = this.engine.describe();
    this.emit("ui:refresh", { payload: { state } });
    this.onUpdate?.(state);
  }

  detach(): void {
    this.emit("ui:detach");
    this.adapter?.cleanup?.();
  }
}
