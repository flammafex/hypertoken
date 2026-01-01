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
 * engine/Policy.ts
 */
import { Engine } from "./Engine.js";

export type PolicyCondition = (engine: Engine) => boolean;
export type PolicyEffect = (engine: Engine) => void;

export interface PolicyOptions {
  priority?: number;
  once?: boolean;
  enabled?: boolean;
}

export class Policy {
  name: string;
  condition: PolicyCondition;
  effect: PolicyEffect;
  priority: number;
  once: boolean;
  enabled: boolean;
  _fired: boolean;
  _hits: number;

  constructor(
    name: string, 
    condition: PolicyCondition, 
    effect: PolicyEffect, 
    { priority = 0, once = false, enabled = true }: PolicyOptions = {}
  ) {
    this.name = name;
    this.condition = condition;
    this.effect = effect;
    this.priority = priority;
    this.once = once;
    this.enabled = enabled;
    this._fired = false;
    this._hits = 0;
  }

  evaluate(engine: Engine): boolean {
    if (!this.enabled) return false;
    if (this.once && this._fired) return false;

    let shouldFire = false;
    try {
      shouldFire = !!this.condition(engine);
    } catch (err) {
      engine.emit("policy:error", { payload: { name: this.name, error: err } });
      return false;
    }

    if (shouldFire) {
      try {
        this.effect(engine);
        this._hits++;
        if (this.once) this._fired = true;
        engine.emit("policy:triggered", { payload: { name: this.name, hits: this._hits } });
      } catch (err) {
        engine.emit("policy:error", { payload: { name: this.name, error: err } });
      }
      return true;
    }

    return false;
  }

  reset(): this {
    this._fired = false;
    this._hits = 0;
    return this;
  }

  disable(): this { this.enabled = false; return this; }
  enable(): this { this.enabled = true; return this; }

  toJSON(): any {
    return {
      name: this.name,
      priority: this.priority,
      once: this.once,
      enabled: this.enabled,
      hits: this._hits,
      fired: this._fired
    };
  }
}