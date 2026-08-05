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
 * engine/RuleEngine.ts
 */
// @ts-ignore
import { Script } from "./Script.js";
import { Action } from "./Action.js";
import { Engine } from "./Engine.js";

export type RuleCondition = (engine: Engine, lastAction?: Action | null) => boolean;
export type RuleSequence = any; 

export interface Rule {
  name: string;
  condition: RuleCondition;
  sequence: RuleSequence;
  priority: number;
  once: boolean;
  // 'fired' is now tracked in CRDT, not locally
}

export class RuleEngine {
  engine: Engine;
  rules: Rule[];
  debug: boolean;

  constructor(engine: Engine) {
    this.engine = engine;
    this.rules = [];
    this.debug = false;

    // Initialize CRDT state if missing.
    // On the TS path a failure here indicates a real bug and must not be
    // silently swallowed — surface it via the rule:error event.
    if (!this.engine.session.state.rules) {
      this.engine.dispatch("rule:initRules", {}).catch((e) => {
        this.engine.emit("rule:error", { payload: { name: "rule:initRules", error: e } });
      });
    }

    // Attach post-action evaluation hook
    // @ts-ignore
    this.engine?.on("engine:action", (e: any) => this.evaluate(e?.payload?.payload || e?.payload));
  }

  addRule(name: string, condition: RuleCondition, sequence: RuleSequence, { priority = 0, once = false } = {}): this {
    this.rules.push({ name, condition, sequence, priority, once });
    this.rules.sort((a, b) => b.priority - a.priority);
    if (this.debug) console.log(`📜 Rule added: ${name}`);
    return this;
  }

  clear(): this {
    this.rules = [];
    this.engine?.emit("rule:cleared");
    return this;
  }

  private _evaluateDepth = 0;
  private static readonly MAX_EVALUATE_DEPTH = 10;

  async evaluate(lastAction: Action | null = null): Promise<void> {
    // Re-entry guard: rule sequences dispatch actions, which emit
    // `engine:action`, which re-enters this method. A rule whose condition
    // stays true would otherwise recurse forever. Stop re-evaluating beyond
    // the depth limit instead of spinning indefinitely.
    if (this._evaluateDepth >= RuleEngine.MAX_EVALUATE_DEPTH) {
      if (this.debug) {
        console.warn(`RuleEngine: max evaluate depth (${RuleEngine.MAX_EVALUATE_DEPTH}) reached; skipping re-evaluation`);
      }
      return;
    }
    this._evaluateDepth++;

    try {
      // Get fired state from CRDT
      const firedRules = this.engine.session.state.rules?.fired || {};

      for (const rule of this.rules) {
        // Check CRDT state for 'once' rules
        if (rule.once && firedRules[rule.name]) continue;

        let shouldFire = false;
        try {
          shouldFire = !!rule.condition(this.engine, lastAction);
        } catch (err) {
          this.engine.emit("rule:error", { payload: { name: rule.name, error: err } });
          continue;
        }

        if (shouldFire) {
          if (this.debug) console.log(`⚡ Rule triggered: ${rule.name}`);

          // Mark as fired in CRDT immediately (prevents double-fire in async scenarios)
          if (rule.once) {
            await this.engine.dispatch("rule:markFired", { name: rule.name, timestamp: Date.now() });
          }

          try {
            await this._execute(rule.sequence);
            this.engine.emit("rule:triggered", { payload: { name: rule.name } });
          } catch (err) {
            this.engine.emit("rule:error", { payload: { name: rule.name, error: err } });
          }
        }
      }
    } finally {
      this._evaluateDepth--;
    }
  }

  async _execute(seq: RuleSequence): Promise<void> {
    if (!seq) return;

    if (seq instanceof Script) {
      await seq.run(this.engine);
    } else if (Array.isArray(seq)) {
      for (const step of seq) {
        const act = step instanceof Action ? step : new Action(step.type, step.payload);
        await this.engine.dispatch(act.type, act.payload);
      }
    } else if (seq instanceof Action) {
      await this.engine.dispatch(seq.type, seq.payload);
    } else if (typeof seq === "function") {
      await seq(this.engine);
    } else {
      console.warn("RuleEngine: unrecognized sequence type", seq);
    }
  }

  toJSON(): any {
    return {
      rules: this.rules.map(({ name, priority, once }) => ({ name, priority, once })),
      fired: this.engine.session.state.rules?.fired || {}
    };
  }
}