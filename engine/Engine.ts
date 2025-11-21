/*
 * engine/Engine.ts
 */
// @ts-ignore
import { Emitter } from "../core/events.js";
import { Stack } from "../core/Stack.js";
import { Space } from "../core/Space.js";
import { Source } from "../core/Source.js";
import { Action } from "./Action.js";
// @ts-ignore
import { ActionRegistry } from "./actions.js";
import { IActionPayload } from "../core/types.js";
import { Chronicle } from "../core/Chronicle.js";
// @ts-ignore
import { NetworkInterface } from "../interface/NetworkInterface.js";
// @ts-ignore
import { ConsensusCore } from "../core/ConsensusCore.js";
import { GameLoop } from "./GameLoop.js";
import { RuleEngine } from "./RuleEngine.js"; // Added RuleEngine
import { EventBus } from "../core/EventBus.js";

export interface EngineOptions {
  stack?: Stack | null;
  space?: Space | null;
  source?: Source | null;
  autoConnect?: string; 
}

export class Engine extends Emitter {
  stack: Stack | null;
  space: Space;
  source: Source | null;
  
  session: Chronicle;
  network?: NetworkInterface;
  sync?: ConsensusCore;
  loop: GameLoop;

  // Local event dispatcher for tests and plugins
  eventBus: EventBus;
  
  // Exposed RuleEngine
  ruleEngine?: RuleEngine; 

  history: Action[];
  future: Action[];
  _policies: Map<string, any>;
  
  _agents: any[];
  _gameState: any;
  _transactions: any[];
  debug: boolean;

  constructor({ stack = null, space = null, source = null, autoConnect }: EngineOptions = {}) {
    super();
    
    this.session = new Chronicle();
    this.space = space ?? new Space(this.session, "main-space");
    this.stack = stack;
    this.source = source;
    this.loop = new GameLoop(this);
    this.eventBus = new EventBus();

    this.history = [];
    this.future = [];
    this._policies = new Map();
    this.debug = false;

    this._agents = [];
    this._gameState = {};
    this._transactions = [];

    this.session.on("state:changed", (e) => this.emit("state:updated", e));

    if (autoConnect) {
      this.connect(autoConnect);
    }
  }

  // Add helper to attach a RuleEngine
  useRuleEngine(ruleEngine: RuleEngine) {
    this.ruleEngine = ruleEngine;
  }

  connect(url: string): void {
    if (this.network) return;
    console.log(`[Engine] Connecting to ${url}...`);
    this.network = new NetworkInterface(url, this);
    this.sync = new ConsensusCore(this.session, this.network);
    this.network.connect();
    this.network.on("net:ready", (e) => this.emit("net:ready", e));
    this.network.on("net:peer:connected", (e) => this.emit("net:peer:connected", e));
  }

  disconnect(): void {
    this.network?.disconnect();
    this.network = undefined;
    this.sync = undefined;
  }

  registerPolicy(name: string, policy: any): this {
    this._policies.set(name, policy);
    this.emit("engine:policy", { payload: { name } });
    return this;
  }

  unregisterPolicy(name: string): this {
    this._policies.delete(name);
    this.emit("engine:policy:removed", { payload: { name } });
    return this;
  }

  clearPolicies(): this {
    this._policies.clear();
    this.emit("engine:policy:cleared");
    return this;
  }

  dispatch(type: string, payload: IActionPayload = {}, opts: any = {}): any {
    const action = new Action(type, payload, opts);
    if (this.debug) console.log("🧩 dispatch:", type, payload);

    const result = this.apply(action);
    this.history.push(action);
    this.emit("engine:action", { payload: action });

    for (const [, policy] of this._policies) {
      try {
        policy.evaluate(this);
      } catch (err) {
        this.emit("engine:error", { payload: { policy, err } });
      }
    }

    return result;
  }

  apply(action: Action): any {
    const fn = ActionRegistry[action.type];
    if (fn) {
      try {
        const result = fn(this, action.payload);
        action.result = result;
        return result;
      } catch (err) {
        this.emit("engine:error", { payload: { action, err } });
        return undefined;
      }
    } else {
      this.emit("engine:error", { payload: { action, msg: "Unknown action" } });
      return undefined;
    }
  }

  undo(): Action | null {
    const last = this.history.pop();
    if (!last || !last.reversible) return null;
    this.future.push(last);
    this.emit("engine:undo", { payload: last });
    return last;
  }

  redo(): Action | null {
    const next = this.future.pop();
    if (!next) return null;
    this.apply(next);
    this.history.push(next);
    this.emit("engine:redo", { payload: next });
    return next;
  }

  snapshot(): any {
    return {
      stack: this.stack?.toJSON?.() ?? null,
      space: this.space.snapshot(),
      source: this.source?.toJSON?.() ?? null,
      history: this.history.map(a => a.toJSON()),
      policies: Array.from(this._policies.keys()),
      crdt: this.session.saveToBase64()
    };
  }

  toJSON(): any { return this.snapshot(); }

  restore(snapshot: any): this {
    if (!snapshot) return this;
    if (snapshot.crdt) {
      this.session.loadFromBase64(snapshot.crdt);
    }
    // Local history isn't synced via CRDT, so we trust the snapshot
    this.history = snapshot.history ?? [];
    // Policies are code, not state, so we just list them. 
    // Logic must be re-registered by the application layer.
    this.emit("engine:restored", { payload: { history: this.history.length } });
    return this;
  }

  get state() {
    return {
      version: "2.0.0-crdt",
      turn: this._gameState.turn,
      agents: this._agents,
      stack: this.stack,
      space: this.space,
      source: this.source
    };
  }

  describe({ detail = false } = {}): any {
    const { stack, space, source } = this;
    const agents = this.state.agents?.map((p: any) => ({
      name: p.name,
      handCount: p.hand?.length ?? 0,
      discardCount: p.discard?.length ?? 0,
      turns: p.turns ?? 0,
      active: p.active ?? false
    })) ?? [];

    const summary = {
      version: this.state.version,
      turn: this.state.turn ?? null,
      agents,
      stack: stack
        ? { remaining: stack.size, drawn: stack.drawn?.length ?? 0 }
        : null,
      space: space
        ? {
            zones: space.zones, 
            totalPlacements: space.cards().length
          }
        : null,
      source: source
        ? {
            remaining: source._stack?.length ?? 0,
            burned: source._burned?.length ?? 0,
            policy: source._reshufflePolicy ?? null
          }
        : null
    };

    if (!detail) return summary;

    return {
      ...summary,
      stackState: stack?.toJSON?.() ?? null,
      spaceState: space?.snapshot?.() ?? null,
      sourceState: {
        stacks: source?._stacks?.length ?? 0,
        cards: source?._stack ?? []
      }
    };
  }

  availableActions(): any[] {
    const actions = [];
    if (this.state.stack) {
      actions.push(
        { type: "stack:draw", payload: { count: 1 } },
        { type: "stack:shuffle", payload: {} },
        { type: "stack:reset", payload: {} }
      );
    }
    if (this.state.space) {
      actions.push(
        { type: "space:place", payload: { zone: "altar" } },
        { type: "space:clear", payload: {} }
      );
    }
    if (this.state.source) {
      actions.push(
        { type: "source:draw", payload: { count: 1 } },
        { type: "source:shuffle", payload: {} }
      );
    }
    actions.push(
      { type: "loop:start", payload: {} },
      { type: "loop:stop", payload: {} }
    );
    return actions;
  }
}