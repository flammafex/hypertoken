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

    // Initialize CRDT state if missing
    if (!this.engine.session.state.rules) {
      this.engine.session.change("init rule state", (doc) => {
        doc.rules = { fired: {} };
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
          this.engine.session.change(`rule fired: ${rule.name}`, (doc) => {
            if (doc.rules) doc.rules.fired[rule.name] = Date.now();
          });
        }

        try {
          this._execute(rule.sequence);
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
    return {
      rules: this.rules.map(({ name, priority, once }) => ({ name, priority, once })),
      fired: this.engine.session.state.rules?.fired || {}
    };
  }
}