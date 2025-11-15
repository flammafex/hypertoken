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

import { Script } from "./Script.js";
import { Action } from "./Action.js";

export class RuleEngine {
  /**
   * Associates a RuleEngine instance with a specific Engine context.
   * On initialization, the engine is observed for every "engine:action"
   * emission, triggering automatic rule evaluation.
   */
  constructor(engine) {
    this.engine = engine;
    this.rules = [];
    this.debug = false;

    // Attach post-action evaluation hook.
    this.engine?.on?.("engine:action", e => this.evaluate(e?.payload?.payload || e?.payload));
  }

  /*───────────────────────────────────────────────
    Rule definition and registration
  ───────────────────────────────────────────────*/

  /**
   * Registers a new rule definition.
   * Rules are stored with execution metadata and immediately sorted
   * by descending priority. The structure is minimal and fully serializable.
   */
  addRule(name, condition, sequence, { priority = 0, once = false } = {}) {
    this.rules.push({ name, condition, sequence, priority, once, fired: false });
    this.rules.sort((a, b) => b.priority - a.priority);
    if (this.debug) console.log(`📜 Rule added: ${name}`);
    return this;
  }

  /**
   * Removes a rule by name and notifies observers.
   * This is a non-destructive operation on unrelated rules.
   */
  removeRule(name) {
    this.rules = this.rules.filter(r => r.name !== name);
    this.engine?.emit?.("rule:removed", { payload: { name } });
    return this;
  }

  /**
   * Clears all rules and emits a global notification.
   * Typically used when resetting simulation state.
   */
  clear() {
    this.rules = [];
    this.engine?.emit?.("rule:cleared");
    return this;
  }

  /*───────────────────────────────────────────────
    Evaluation cycle
  ───────────────────────────────────────────────*/

  /**
   * Evaluates all active rules against the current engine state.
   * Automatically invoked after each engine action or manually by controllers.
   *
   * Conditions are sandboxed to prevent systemic failure from individual errors.
   * Firing order follows descending priority; "once" rules deactivate after
   * first successful execution.
   */
  evaluate(lastAction = null) {
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

  /*───────────────────────────────────────────────
    Execution layer
  ───────────────────────────────────────────────*/

  /**
   * Resolves and executes a rule's sequence payload.
   * Supports multiple sequence representations:
   *   - Script: high-level procedural block
   *   - Array<Action>: ordered multi-step behavior
   *   - Action: single discrete event
   *   - Function(engine): arbitrary callback
   *
   * Execution occurs synchronously or asynchronously as required.
   */
  async _execute(seq) {
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

  /*───────────────────────────────────────────────
    Serialization
  ───────────────────────────────────────────────*/

  /**
   * Serializes rule metadata for persistence or inspection.
   * Execution details such as conditions and sequences are excluded,
   * as they are generally non-transferable across runtime contexts.
   */
  toJSON() {
    return this.rules.map(({ name, priority, once, fired }) => ({
      name, priority, once, fired
    }));
  }
}
