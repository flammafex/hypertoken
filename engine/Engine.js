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

import { Emitter } from "../core/events.js";
import { Action } from "./Action.js";
import { ActionRegistry } from "./actions.js";

export class Engine extends Emitter {
  /**
   * Initializes an engine instance with optional shared state containers.
   * Deck, table, and shoe references may be null for domain configurations
   * that defer instantiation until runtime.
   *
   * The history and future arrays form a primitive timeline used for replay
   * and reversal. Policies are maintained in an ordered Map for deterministic
   * evaluation.
   */
  constructor({ deck = null, table = null, shoe = null } = {}) {
    super();
    this.deck = deck;
    this.table = table;
    this.shoe = shoe;

    this.history = [];
    this.future = [];
    this._policies = new Map();
    this.debug = false;
  }

  /*───────────────────────────────────────────────
    Policy registration and management
  ───────────────────────────────────────────────*/

  /**
   * Registers a named policy with the engine.
   * Policies are invoked after every dispatched action to perform
   * autonomous state checks, rule enforcement, or derived event emission.
   */
  registerPolicy(name, policy) {
    this._policies.set(name, policy);
    this.emit("engine:policy", { payload: { name } });
    return this;
  }

  /** Removes a previously registered policy by name. */
  unregisterPolicy(name) {
    this._policies.delete(name);
    this.emit("engine:policy:removed", { payload: { name } });
    return this;
  }

  /** Clears all registered policies in a single operation. */
  clearPolicies() {
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
  dispatch(type, payload = {}, opts = {}) {
    const action = new Action(type, payload, opts);
    if (this.debug) console.log("🧭 dispatch:", type, payload);

    // Apply action synchronously; no deferred queueing.
    this.apply(action);
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

    return action;
  }

  /**
   * Applies an existing Action object to the current engine state.
   * Resolution is delegated to the ActionRegistry entry corresponding
   * to the action type. Exceptions are isolated and reported via events.
   */
  apply(action) {
    const fn = ActionRegistry[action.type];
    if (fn) {
      try {
        fn(this, action.payload);
      } catch (err) {
        this.emit("engine:error", { payload: { action, err } });
      }
    } else {
      this.emit("engine:error", { payload: { action, msg: "Unknown action" } });
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
  undo() {
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
  redo() {
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
  snapshot() {
    return {
      deck: this.deck?.toJSON?.() ?? null,
      table: this.table?.toJSON?.() ?? null,
      shoe: this.shoe?.toJSON?.() ?? null,
      history: this.history.map(a => a.toJSON()),
      policies: Array.from(this._policies.keys())
    };
  }

  /** Alias for snapshot(), allowing transparent JSON serialization. */
  toJSON() { return this.snapshot(); }

  /**
   * Restores the engine’s structural state from a prior snapshot.
   * Each container is rehydrated if its fromJSON method exists.
   * Policies are re-created as name stubs and must be reattached
   * with concrete logic by the caller after restoration.
   */
  restore(snapshot) {
    if (!snapshot) return this;
    if (snapshot.deck && this.deck?.fromJSON)
      this.deck = this.deck.fromJSON(snapshot.deck);
    if (snapshot.table && this.table?.fromJSON)
      this.table = this.table.fromJSON(snapshot.table);
    if (snapshot.shoe && this.shoe?.fromJSON)
      this.shoe = this.shoe.fromJSON(snapshot.shoe);

    this.history = snapshot.history ?? [];
    this._policies = new Map(snapshot.policies?.map(n => [n, null]) ?? []);
    this.emit("engine:restored", { payload: { history: this.history.length } });
    return this;
  }

  /*───────────────────────────────────────────────
    Introspection utilities (AI / debugging)
  ───────────────────────────────────────────────*/

  /**
   * Returns a descriptive summary of the engine’s state for inspection or AI reasoning.
   * The summary is structural by default and may include detailed sub-states when
   * invoked with { detail: true }.
   */
  describe({ detail = false } = {}) {
    const { deck, table, shoe } = this.state;
    const players = this.state.players?.map(p => ({
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
        ? { remaining: deck.size, drawn: deck.drawnTokens?.length ?? 0 }
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
      deckState: deck?.snapshot?.() ?? null,
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
  availableActions() {
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
