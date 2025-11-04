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
 * Player
 * -------
 * Represents an autonomous or interactive participant within a simulation.
 * Each player maintains personal state containers (deck, table, shoe)
 * and participates in the turn loop coordinated by the engine.
 *
 * The implementation extends the core Emitter to broadcast player-specific
 * lifecycle and action events independently of global engine events.
 *
 * The class is agnostic to control type; it can represent a human,
 * a rule-based bot, or an AI agent. Controller logic is externalized
 * through the `agent` interface, which exposes an asynchronous think() method.
 *
 * Player instances are responsible for local card management—drawing,
 * discarding, shuffling, and playing tokens to zones—while the engine
 * enforces sequencing and overall game flow.
 */

import { Emitter } from "../core/events.js";
import { Deck } from "../core/Deck.js";
import { Table } from "../core/Table.js";
import { Shoe } from "../core/Shoe.js";

export class Player extends Emitter {
  /**
   * Constructs a player instance and initializes its private resources.
   * Identity and metadata are assigned immediately; state containers are
   * provided or lazily instantiated.
   */
  constructor(name, { deck = null, table = null, shoe = null, meta = {}, agent = null } = {}) {
    super();

    // Identity and descriptive metadata.
    this.name = name;
    this.id = crypto?.randomUUID?.() || `${Date.now()}-${Math.random()}`;
    this.meta = meta;

    // Core state containers.
    // A player’s deck may originate from an array of tokens or a Deck instance.
    this.deck = Array.isArray(deck) ? new Deck(deck) : deck;
    this.table = table ?? new Table(`${name}-table`);
    this.shoe = shoe;

    // Transient state: cards currently in hand and optional discard pile.
    this.hand = [];
    this.discard = [];

    // Controller reference: defines autonomous or interactive behavior.
    // Expected to implement think(engine, player) → decision.
    this.agent = agent;

    // Activity flags and counters.
    this.active = true;
    this.turns = 0;
  }

  /*───────────────────────────────────────────────
    Turn lifecycle
  ───────────────────────────────────────────────*/

  /**
   * Marks the beginning of a player’s turn.
   * Emits both player-local and engine-level notifications.
   */
  beginTurn(engine) {
    this.turns++;
    this.emit("player:beginTurn", { payload: { name: this.name, turn: this.turns } });
    engine?.emit("loop:turn:start", { payload: { player: this.name, turn: this.turns } });
  }

  /**
   * Marks the end of a player’s turn.
   * Emissions mirror beginTurn for symmetry and external synchronization.
   */
  endTurn(engine) {
    this.emit("player:endTurn", { payload: { name: this.name, turn: this.turns } });
    engine?.emit("loop:turn:end", { payload: { player: this.name, turn: this.turns } });
  }

  /**
   * Resets transient state between sessions or after elimination.
   * Retains identity and metadata while clearing dynamic piles.
   */
  reset() {
    this.hand.length = 0;
    this.discard.length = 0;
    this.turns = 0;
    this.active = true;
    this.emit("player:reset", { payload: { name: this.name } });
  }

  /*───────────────────────────────────────────────
    Deck and table operations
  ───────────────────────────────────────────────*/

  /**
   * Draws one or more tokens from the player’s deck into hand.
   * Supports both Deck and array-backed implementations.
   * Emits player:draw with summary payload.
   */
  draw(n = 1) {
    if (!this.deck) return [];
    const cards = this.deck.drawMany ? this.deck.drawMany(n) : [this.deck.draw()];
    this.hand.push(...cards);
    this.emit("player:draw", { payload: { name: this.name, count: cards.length, cards } });
    return cards;
  }

  /**
   * Moves selected cards from hand to the discard pile.
   * The predicate determines which cards are removed.
   * Emits player:discard summarizing the number discarded.
   */
  discardFromHand(predicate = () => true) {
    const kept = [];
    const discarded = [];
    for (const card of this.hand) {
      if (predicate(card)) discarded.push(card);
      else kept.push(card);
    }
    this.hand = kept;
    this.discard.push(...discarded);
    this.emit("player:discard", { payload: { name: this.name, count: discarded.length } });
    return discarded;
  }

  /**
   * Places a card from hand onto a named zone of the player’s table.
   * Zones represent contextual groupings such as stacks or fields.
   * Returns the played card or null if the operation fails.
   */
  playCard(card, zoneName = "table") {
    if (!this.table) return null;
    const idx = this.hand.indexOf(card);
    if (idx === -1) return null;
    this.hand.splice(idx, 1);
    this.table.place(zoneName, card, { faceUp: true, label: `${this.name}:${zoneName}` });
    this.emit("player:playCard", { payload: { name: this.name, card, zone: zoneName } });
    return card;
  }

  /**
   * Randomizes the order of the player’s deck.
   * Seeded shuffling is supported for reproducible simulations.
   */
  shuffleDeck(seed = null) {
    if (!this.deck) return this;
    this.deck.shuffle(seed);
    this.emit("player:shuffle", { payload: { name: this.name, seed } });
    return this;
  }

  /*───────────────────────────────────────────────
    Agent and AI integration
  ───────────────────────────────────────────────*/

  /**
   * Delegates decision-making to the assigned agent.
   * The agent receives the engine and player context and may return
   * either a structured action {type, payload} or a function with run(engine).
   * All exceptions are contained locally to avoid halting the simulation.
   */
  async think(engine) {
    if (!this.agent || typeof this.agent.think !== "function") return;
    try {
      const decision = await this.agent.think(engine, this);
      if (decision) {
        if (decision.type) engine.dispatch(decision.type, decision.payload);
        else if (typeof decision.run === "function") await decision.run(engine);
      }
      this.emit("player:decision", { payload: { name: this.name, decision } });
    } catch (err) {
      this.emit("player:error", { payload: { name: this.name, error: err } });
    }
  }

  /*───────────────────────────────────────────────
    State persistence and serialization
  ───────────────────────────────────────────────*/

  /**
   * Produces a snapshot of the player’s current observable state.
   * Only transient game properties are included; references are excluded
   * to ensure portability across sessions or storage formats.
   */
  snapshot() {
    return {
      id: this.id,
      name: this.name,
      hand: this.hand.slice(),
      discard: this.discard.slice(),
      turns: this.turns,
      active: this.active,
      meta: this.meta
    };
  }

  /** Alias for snapshot() to support JSON.stringify compatibility. */
  toJSON() { return this.snapshot(); }

  /**
   * Reconstructs a Player instance from serialized data.
   * Structural containers (deck, table, shoe) are not rehydrated here;
   * they are expected to be reassigned externally after deserialization.
   */
  static fromJSON(obj) {
    const p = new Player(obj?.name ?? "Player");
    p.id = obj?.id ?? p.id;
    p.hand = obj?.hand ?? [];
    p.discard = obj?.discard ?? [];
    p.turns = obj?.turns ?? 0;
    p.active = obj?.active ?? true;
    p.meta = obj?.meta ?? {};
    return p;
  }
}