/*
 * Copyright 2025 The Carpocratian Church of Commonality and Equality, Inc.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 *
 * Engine
 * -------
 * Core runtime responsible for coordinating stateful systems within the simulation.
 * The engine serves as the execution host for actions, policy evaluation, and
 * temporal control (undo/redo, history management, serialization).
 *
 * It extends the core Emitter to broadcast events to external observers and
 * integrates modular components such as Deck, Table, and Shoe.
 *
 * The design maintains a minimal surface area: it does not enforce domain
 * semantics, but delegates those responsibilities to action handlers and
 * registered policies. This allows domain logic to evolve independently of
 * runtime orchestration.
 */

// @ts-ignore
import { Emitter } from "../core/events.js";
import { Deck } from "../core/Deck.js";
import { Table } from "../core/Table.js";
import { Shoe } from "../core/Shoe.js";
import { Action } from "./Action.js";
// @ts-ignore
import { ActionRegistry } from "./actions.js";
import { IActionPayload } from "../core/types.js";

export interface GameState {
  started?: boolean;
  ended?: boolean;
  phase?: string;
  turn?: number;
  winner?: string;
  reason?: string;
  startTime?: number;
  [key: string]: any;
}

export class Engine extends Emitter {
  deck: Deck | null;
  table: Table | null;
  shoe: Shoe | null;

  history: Action[];
  future: Action[];
  _policies: Map<string, any>;
  
  // Dynamic state properties
  _players: any[];
  _gameState: GameState;
  _transactions: any[];
  debug: boolean;

  /**
   * Initializes an engine instance with optional shared state containers.
   * Deck, table, and shoe references may be null for domain configurations
   * that defer instantiation until runtime.
   *
   * The history and future arrays form a primitive timeline used for replay
   * and reversal. Policies are maintained in an ordered Map for deterministic
   * evaluation.
   */
  constructor({ deck = null, table = null, shoe = null }: { deck?: Deck | null; table?: Table | null; shoe?: Shoe | null } = {}) {
    super();
    this.deck = deck;
    this.table = table;
    this.shoe = shoe;

    this.history = [];
    this.future = [];
    this._policies = new Map();
    this.debug = false;

    // Initialize dynamic state containers
    this._players = [];
    this._gameState = {};
    this._transactions = [];
  }

  /*───────────────────────────────────────────────
    Policy registration and management
  ───────────────────────────────────────────────*/

  /**
   * Registers a named policy with the engine.
   * Policies are invoked after every dispatched action to perform
   * autonomous state checks, rule enforcement, or derived event emission.
   */
  registerPolicy(name: string, policy: any): this {
    this._policies.set(name, policy);
    this.emit("engine:policy", { payload: { name } });
    return this;
  }

  /** Removes a previously registered policy by name. */
  unregisterPolicy(name: string): this {
    this._policies.delete(name);
    this.emit("engine:policy:removed", { payload: { name } });
    return this;
  }

  /** Clears all registered policies in a single operation. */
  clearPolicies(): this {
    this._policies.clear();
    this.emit("engine:policy:cleared");
    return this;
  }

  /*───────────────────────────────────────────────
    Action dispatch and evaluation
  ───────────────────────────────────────────────*/

  /**
   * Dispatches a discrete action through the engine.
   * The action is instantiated, applied immediately via the ActionRegistry,
   * recorded in history, and then followed by a policy evaluation phase.
   *
   * This process represents one complete simulation tick.
   */
  dispatch(type: string, payload: IActionPayload = {}, opts: any = {}): any {
    const action = new Action(type, payload, opts);
    if (this.debug) console.log("🧩 dispatch:", type, payload);

    // Apply action synchronously; no deferred queueing.
    const result = this.apply(action);
    this.history.push(action);
    this.emit("engine:action", { payload: action });

    // Execute all registered policies post-application.
    for (const [, policy] of this._policies) {
      try {
        policy.evaluate(this);
      } catch (err) {
        this.emit("engine:error", { payload: { policy, err } });
      }
    }

    return result; // Return the result from the action handler
  }

  /**
   * Applies an existing Action object to the current engine state.
   * Resolution is delegated to the ActionRegistry entry corresponding
   * to the action type. Exceptions are isolated and reported via events.
   */
  apply(action: Action): any {
    const fn = ActionRegistry[action.type];
    if (fn) {
      try {
        const result = fn(this, action.payload);
        action.result = result; // Store result in action for later retrieval
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

  /*───────────────────────────────────────────────
    Timeline control (undo / redo)
  ───────────────────────────────────────────────*/

  /**
   * Performs a single-step reversal of the most recent reversible action.
   * The reverted action is moved from history to the future stack.
   * Non-reversible actions are ignored.
   */
  undo(): Action | null {
    const last = this.history.pop();
    if (!last || !last.reversible) return null;
    this.future.push(last);
    this.emit("engine:undo", { payload: last });
    return last;
  }

  /**
   * Reapplies the next action from the future stack.
   * Used to restore forward progression after an undo.
   */
  redo(): Action | null {
    const next = this.future.pop();
    if (!next) return null;
    this.apply(next);
    this.history.push(next);
    this.emit("engine:redo", { payload: next });
    return next;
  }

  /*───────────────────────────────────────────────
    Snapshotting and serialization
  ───────────────────────────────────────────────*/

  /**
   * Captures a serialized snapshot of the current engine state.
   * This includes deck, table, and shoe data, as well as action history
   * and the set of registered policy names. Policies themselves are not
   * serialized—only their identifiers are preserved.
   */
  snapshot(): any {
    return {
      deck: this.deck?.toJSON?.() ?? null,
      table: this.table?.toJSON?.() ?? null,
      shoe: this.shoe?.toJSON?.() ?? null,
      history: this.history.map(a => a.toJSON()),
      policies: Array.from(this._policies.keys())
    };
  }

  /** Alias for snapshot(), allowing transparent JSON serialization. */
  toJSON(): any { return this.snapshot(); }

  /**
   * Restores the engine’s structural state from a prior snapshot.
   * Each container is rehydrated if its fromJSON method exists.
   * Policies are re-created as name stubs and must be reattached
   * with concrete logic by the caller after restoration.
   */
  restore(snapshot: any): this {
    if (!snapshot) return this;
    // Note: Using casting to allow for potential static/instance method discrepancies in usage
    if (snapshot.deck && (this.deck as any)?.fromJSON)
      this.deck = (this.deck as any).fromJSON(snapshot.deck);
    if (snapshot.table && (this.table as any)?.fromJSON)
      this.table = (this.table as any).fromJSON(snapshot.table);
    if (snapshot.shoe && (this.shoe as any)?.fromJSON)
      this.shoe = (this.shoe as any).fromJSON(snapshot.shoe);

    this.history = snapshot.history ?? [];
    this._policies = new Map(snapshot.policies?.map((n: string) => [n, null]) ?? []);
    this.emit("engine:restored", { payload: { history: this.history.length } });
    return this;
  }

  /*───────────────────────────────────────────────
    Introspection utilities (AI / debugging)
  ───────────────────────────────────────────────*/

  // Helper to provide a read-only view of the state for describe()
  get state() {
    return {
      version: "1.0.0",
      turn: this._gameState.turn,
      players: this._players,
      deck: this.deck,
      table: this.table,
      shoe: this.shoe
    };
  }

  /**
   * Returns a descriptive summary of the engine’s state for inspection or AI reasoning.
   * The summary is structural by default and may include detailed sub-states when
   * invoked with { detail: true }.
   */
  describe({ detail = false } = {}): any {
    const { deck, table, shoe } = this;
    const players = this.state.players?.map((p: any) => ({
      name: p.name,
      handCount: p.hand?.length ?? 0,
      discardCount: p.discard?.length ?? 0,
      turns: p.turns ?? 0,
      active: p.active ?? false
    })) ?? [];

    const summary = {
      version: this.state.version,
      turn: this.state.turn ?? null,
      players,
      deck: deck
        ? { remaining: deck.size, drawn: deck.drawn?.length ?? 0 }
        : null,
      table: table
        ? {
            zones: Array.from(table.zones.keys()),
            totalPlacements: Array.from(table.zones.values()).reduce(
              (acc, z) => acc + z.length,
              0
            )
          }
        : null,
      shoe: shoe
        ? {
            remaining: shoe._stack?.length ?? 0,
            burned: shoe._burned?.length ?? 0,
            policy: shoe._reshufflePolicy ?? null
          }
        : null
    };

    if (!detail) return summary;

    return {
      ...summary,
      deckState: deck?.toJSON?.() ?? null,
      tableState: table?.snapshot?.() ?? null,
      shoeState: {
        decks: shoe?._decks?.length ?? 0,
        cards: shoe?._stack ?? []
      }
    };
  }

  /**
   * Enumerates potential actions available in the current engine context.
   * This utility is primarily used for AI policy generation or user interface
   * affordances. The list is derived from the presence of active subsystems.
   */
  availableActions(): any[] {
    const actions = [];

    if (this.state.deck) {
      actions.push(
        { type: "deck:draw", payload: { count: 1 } },
        { type: "deck:shuffle", payload: {} },
        { type: "deck:reset", payload: {} }
      );
    }

    if (this.state.table) {
      actions.push(
        { type: "table:place", payload: { zone: "altar" } },
        { type: "table:clear", payload: {} }
      );
    }

    if (this.state.shoe) {
      actions.push(
        { type: "shoe:draw", payload: { count: 1 } },
        { type: "shoe:shuffle", payload: {} }
      );
    }

    actions.push({ type: "loop:stop", payload: {} });

    return actions;
  }
}