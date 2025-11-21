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
/*
 * engine/Engine.ts
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
import { SessionManager } from "../core/SessionManager.js";
// @ts-ignore
import { NetworkInterface } from "../interface/NetworkInterface.js";
// @ts-ignore
import { SyncManager } from "../core/SyncManager.js";

export interface EngineOptions {
  deck?: Deck | null;
  table?: Table | null;
  shoe?: Shoe | null;
  autoConnect?: string; // URL to auto-connect
}

export class Engine extends Emitter {
  deck: Deck | null;
  table: Table; // Table is guaranteed now
  shoe: Shoe | null;
  
  session: SessionManager;
  network?: NetworkInterface;
  sync?: SyncManager;

  history: Action[];
  future: Action[];
  _policies: Map<string, any>;
  
  // Dynamic state properties
  _players: any[];
  _gameState: any;
  _transactions: any[];
  debug: boolean;

  constructor({ deck = null, table = null, shoe = null, autoConnect }: EngineOptions = {}) {
    super();
    
    // 1. Initialize State Kernel (CRDT)
    this.session = new SessionManager();

    // 2. Initialize View (Table)
    // If a table was passed in, we assume it's already wired, otherwise create new
    this.table = table ?? new Table(this.session, "main-table");
    
    this.deck = deck;
    this.shoe = shoe;

    this.history = [];
    this.future = [];
    this._policies = new Map();
    this.debug = false;

    this._players = [];
    this._gameState = {};
    this._transactions = [];

    // Forward state changes to the outside world (UI updates)
    this.session.on("state:changed", (e) => this.emit("state:updated", e));

    // Auto-connect if requested
    if (autoConnect) {
      this.connect(autoConnect);
    }
  }

  /**
   * Connect to a multiplayer relay server.
   * Enables real-time synchronization of the Table state.
   */
  connect(url: string): void {
    if (this.network) return;

    console.log(`[Engine] Connecting to ${url}...`);
    
    // 1. Create Network Layer
    this.network = new NetworkInterface(url, this);
    
    // 2. Create Sync Layer (wires Network <-> Session)
    this.sync = new SyncManager(this.session, this.network);

    // 3. Start Connection
    this.network.connect();

    // Forward network events for debugging/UI
    this.network.on("net:ready", (e) => this.emit("net:ready", e));
    this.network.on("net:peer:connected", (e) => this.emit("net:peer:connected", e));
  }

  disconnect(): void {
    this.network?.disconnect();
    this.network = undefined;
    this.sync = undefined;
  }

  // ... (Rest of the class remains the same: registerPolicy, dispatch, apply, etc.)
  
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
      deck: this.deck?.toJSON?.() ?? null,
      table: this.table.snapshot(),
      shoe: this.shoe?.toJSON?.() ?? null,
      history: this.history.map(a => a.toJSON()),
      policies: Array.from(this._policies.keys()),
      crdt: this.session.saveToBase64() // Include CRDT binary in snapshots
    };
  }

  toJSON(): any { return this.snapshot(); }

  restore(snapshot: any): this {
    if (!snapshot) return this;
    
    // Restore CRDT state first if available
    if (snapshot.crdt) {
      this.session.loadFromBase64(snapshot.crdt);
    }

    if (snapshot.deck && (this.deck as any)?.fromJSON)
      this.deck = (this.deck as any).fromJSON(snapshot.deck);
    if (snapshot.shoe && (this.shoe as any)?.fromJSON)
      this.shoe = (this.shoe as any).fromJSON(snapshot.shoe);

    this.history = snapshot.history ?? [];
    this._policies = new Map(snapshot.policies?.map((n: string) => [n, null]) ?? []);
    this.emit("engine:restored", { payload: { history: this.history.length } });
    return this;
  }

  get state() {
    return {
      version: "2.0.0-crdt",
      turn: this._gameState.turn,
      players: this._players,
      deck: this.deck,
      table: this.table,
      shoe: this.shoe
    };
  }

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
            zones: table.zones, // Uses new getter
            totalPlacements: table.cards().length
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