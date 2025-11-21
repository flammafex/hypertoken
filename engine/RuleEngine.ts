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
 *
 * RuleEngine
 * -----------
 * Provides a declarative layer for defining and executing conditional behavior
 * within the simulation. Rules bind logical predicates to sequences of actions,
 * scripts, or arbitrary functions, enabling autonomous world responses.
 *
 * The RuleEngine operates as an adjunct to the core Engine. It listens for
 * "engine:action" events and re-evaluates all active rules after each state
 * transition. This pattern supports reactive systems without embedding logic
 * directly into actions or policies.
 *
 * Each rule consists of:
 *   - name: unique identifier
 *   - condition(engine, lastAction): boolean predicate
 *   - sequence: executable payload (Script, Action, array, or function)
 *   - priority: evaluation ordering
 *   - once: optional flag to self-remove after firing
 *
 * Rules are evaluated in descending priority order to maintain deterministic
 * resolution when multiple conditions are true simultaneously.
 */

/*
 * engine/RuleEngine.ts
 */
// @ts-ignore - Script.js is likely still JS, which is fine for now
import { Script } from "./Script.js";
import { Action } from "./Action.js";
import { Engine } from "./Engine.js";

export type RuleCondition = (engine: Engine, lastAction?: Action | null) => boolean;
// Sequence can be a Script, Action array, single Action, or Function
export type RuleSequence = any; 

export interface Rule {
  name: string;
  condition: RuleCondition;
  sequence: RuleSequence;
  priority: number;
  once: boolean;
  fired: boolean;
}

export class RuleEngine {
  engine: Engine;
  rules: Rule[];
  debug: boolean;

  constructor(engine: Engine) {
    this.engine = engine;
    this.rules = [];
    this.debug = false;

    // Attach post-action evaluation hook
    // @ts-ignore - Engine event payload typing
    this.engine?.on("engine:action", (e: any) => this.evaluate(e?.payload?.payload || e?.payload));
  }

  addRule(name: string, condition: RuleCondition, sequence: RuleSequence, { priority = 0, once = false } = {}): this {
    this.rules.push({ name, condition, sequence, priority, once, fired: false });
    this.rules.sort((a, b) => b.priority - a.priority);
    if (this.debug) console.log(`📜 Rule added: ${name}`);
    return this;
  }

  removeRule(name: string): this {
    this.rules = this.rules.filter(r => r.name !== name);
    this.engine?.emit("rule:removed", { payload: { name } });
    return this;
  }

  clear(): this {
    this.rules = [];
    this.engine?.emit("rule:cleared");
    return this;
  }

  evaluate(lastAction: Action | null = null): void {
    for (const rule of this.rules) {
      if (rule.once && rule.fired) continue;

      let shouldFire = false;
      try {
        shouldFire = !!rule.condition(this.engine, lastAction);
      } catch (err) {
        this.engine.emit("rule:error", { payload: { name: rule.name, error: err } });
        continue;
      }

      if (shouldFire) {
        if (this.debug) console.log(`⚡ Rule triggered: ${rule.name}`);
        try {
          this._execute(rule.sequence);
          rule.fired = true;
          this.engine.emit("rule:triggered", { payload: { name: rule.name } });
        } catch (err) {
          this.engine.emit("rule:error", { payload: { name: rule.name, error: err } });
        }
      }
    }
  }

  async _execute(seq: RuleSequence): Promise<void> {
    if (!seq) return;

    if (seq instanceof Script) {
      await seq.run(this.engine);
    } else if (Array.isArray(seq)) {
      for (const step of seq) {
        const act = step instanceof Action ? step : new Action(step.type, step.payload);
        this.engine.dispatch(act.type, act.payload);
      }
    } else if (seq instanceof Action) {
      this.engine.dispatch(seq.type, seq.payload);
    } else if (typeof seq === "function") {
      await seq(this.engine);
    } else {
      console.warn("RuleEngine: unrecognized sequence type", seq);
    }
  }

  toJSON(): any {
    return this.rules.map(({ name, priority, once, fired }) => ({
      name, priority, once, fired
    }));
  }
}