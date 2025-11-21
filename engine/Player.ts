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

/*
 * engine/Player.ts
 */
// @ts-ignore
import { Emitter } from "../core/events.js";
import { Deck } from "../core/Deck.js";
import { Table } from "../core/Table.js";
import { Shoe } from "../core/Shoe.js";
import { Engine } from "./Engine.js";
import { IToken } from "../core/types.js";
import { SessionManager } from "../core/SessionManager.js";
export interface IAgent {
  think: (engine: Engine, player: Player) => Promise<any>;
}

export interface PlayerOptions {
  deck?: Deck | IToken[] | null;
  table?: Table | null;
  shoe?: Shoe | null;
  meta?: any;
  agent?: IAgent | null;
}

export class Player extends Emitter {
  name: string;
  id: string;
  meta: any;
  deck: Deck | null;
  table: Table;
  shoe: Shoe | null;
  
  hand: IToken[];
  discard: IToken[];
  agent: IAgent | null;
  
  active: boolean;
  turns: number;
  resources: Record<string, number> = {}; // Added this based on your action usage

constructor(name: string, { deck = null, table = null, shoe = null, meta = {}, agent = null }: PlayerOptions = {}) {
    super();

    this.name = name;
    this.id = crypto?.randomUUID?.() || `${Date.now()}-${Math.random()}`;
    this.meta = meta;

    // Handle array vs Deck instance
    if (Array.isArray(deck)) {
      this.deck = new Deck(deck);
    } else {
      this.deck = deck;
    }

    // Fix: Instantiate a local SessionManager for the player's private table
    if (table) {
      this.table = table;
    } else {
      // We need to import SessionManager here or pass it in options.
      // Assuming we imported it at top of file: import { SessionManager } from "../core/SessionManager.js";
      const session = new SessionManager();
      this.table = new Table(session, `${name}-table`);
    }
    
    this.shoe = shoe;
    this.shoe = shoe;

    this.hand = [];
    this.discard = [];
    this.agent = agent;

    this.active = true;
    this.turns = 0;
  }

  beginTurn(engine: Engine): void {
    this.turns++;
    this.emit("player:beginTurn", { payload: { name: this.name, turn: this.turns } });
    engine?.emit("loop:turn:start", { payload: { player: this.name, turn: this.turns } });
  }

  endTurn(engine: Engine): void {
    this.emit("player:endTurn", { payload: { name: this.name, turn: this.turns } });
    engine?.emit("loop:turn:end", { payload: { player: this.name, turn: this.turns } });
  }

  reset(): void {
    this.hand.length = 0;
    this.discard.length = 0;
    this.turns = 0;
    this.active = true;
    this.emit("player:reset", { payload: { name: this.name } });
  }

  draw(n: number = 1): IToken[] {
    if (!this.deck) return [];
    const cards = this.deck.draw(n); // Use the overloaded draw method
    const cardArray = Array.isArray(cards) ? cards : (cards ? [cards] : []);
    this.hand.push(...cardArray);
    this.emit("player:draw", { payload: { name: this.name, count: cardArray.length, cards: cardArray } });
    return cardArray;
  }

  discardFromHand(predicate: (t: IToken) => boolean = () => true): IToken[] {
    const kept: IToken[] = [];
    const discarded: IToken[] = [];
    for (const card of this.hand) {
      if (predicate(card)) discarded.push(card);
      else kept.push(card);
    }
    this.hand = kept;
    this.discard.push(...discarded);
    this.emit("player:discard", { payload: { name: this.name, count: discarded.length } });
    return discarded;
  }

  playCard(card: IToken, zoneName: string = "table"): IToken | null {
    if (!this.table) return null;
    const idx = this.hand.indexOf(card);
    if (idx === -1) return null;
    this.hand.splice(idx, 1);
    this.table.place(zoneName, card, { faceUp: true, label: `${this.name}:${zoneName}` });
    this.emit("player:playCard", { payload: { name: this.name, card, zone: zoneName } });
    return card;
  }

  shuffleDeck(seed: number | null = null): this {
    if (!this.deck) return this;
    this.deck.shuffle(seed ?? undefined);
    this.emit("player:shuffle", { payload: { name: this.name, seed } });
    return this;
  }

  async think(engine: Engine): Promise<void> {
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

  snapshot(): any {
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

  toJSON(): any { return this.snapshot(); }

  static fromJSON(obj: any): Player {
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