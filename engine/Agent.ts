/*
 * engine/Agent.ts
 */
import { Emitter } from "../core/events.js";
import { Stack } from "../core/Stack.js";
import { Space } from "../core/Space.js";
import { Source } from "../core/Source.js";
import { Engine } from "./Engine.js";
import { IToken } from "../core/types.js";
import { Chronicle } from "../core/Chronicle.js";
import { generateId } from "../core/crypto.js";

export interface IAgent {
  think: (engine: Engine, agent: Agent) => Promise<any>;
}

export interface AgentOptions {
  stack?: Stack | IToken[] | null;
  space?: Space | null;
  source?: Source | null;
  meta?: any;
  agent?: IAgent | null;
}

export class Agent extends Emitter {
  name: string;
  id: string;
  meta: any;
  stack: Stack | null;
  space: Space;
  source: Source | null;
  
  inventory: IToken[];
  discard: IToken[];
  agent: IAgent | null;
  
  active: boolean;
  turns: number;
  resources: Record<string, number> = {};

  // FIX: Added optional property for game-specific zone tracking
  handZone?: string;

  constructor(name: string, { stack = null, space = null, source = null, meta = {}, agent = null }: AgentOptions = {}) {
    super();

    this.name = name;
    this.id = generateId();
    this.meta = meta;

    // 1. Resolve Session and Space first
    let session: Chronicle;

    if (space) {
      this.space = space;
      // Reuse the space's session if available
      session = space.session;
    } else {
      session = new Chronicle();
      this.space = new Space(session, `${name}-space`);
    }

    // 2. Initialize Stack using the resolved Chronicle
    if (Array.isArray(stack)) {
      this.stack = new Stack(session, stack);
    } else {
      this.stack = stack;
    }
    
    this.source = source;
    this.inventory = [];
    this.discard = [];
    this.agent = agent;
    this.active = true;
    this.turns = 0;
  }

  // ... rest of methods unchanged
  beginTurn(engine: Engine): void {
    this.turns++;
    this.emit("agent:beginTurn", { payload: { name: this.name, turn: this.turns } });
    engine?.emit("loop:turn:start", { payload: { agent: this.name, turn: this.turns } });
  }

  endTurn(engine: Engine): void {
    this.emit("agent:endTurn", { payload: { name: this.name, turn: this.turns } });
    engine?.emit("loop:turn:end", { payload: { agent: this.name, turn: this.turns } });
  }

  reset(): void {
    this.inventory.length = 0;
    this.discard.length = 0;
    this.turns = 0;
    this.active = true;
    this.emit("agent:reset", { payload: { name: this.name } });
  }

  draw(n: number = 1): IToken[] {
    if (!this.stack) return [];
    const cards = this.stack.draw(n); 
    const cardArray = Array.isArray(cards) ? cards : (cards ? [cards] : []);
    this.inventory.push(...cardArray);
    this.emit("agent:draw", { payload: { name: this.name, count: cardArray.length, cards: cardArray } });
    return cardArray;
  }

  discardFromHand(predicate: (t: IToken) => boolean = () => true): IToken[] {
    const kept: IToken[] = [];
    const discarded: IToken[] = [];
    for (const card of this.inventory) {
      if (predicate(card)) discarded.push(card);
      else kept.push(card);
    }
    this.inventory = kept;
    this.discard.push(...discarded);
    this.emit("agent:discard", { payload: { name: this.name, count: discarded.length } });
    return discarded;
  }

  playCard(card: IToken, zoneName: string = "space"): IToken | null {
    if (!this.space) return null;
    const idx = this.inventory.indexOf(card);
    if (idx === -1) return null;
    this.inventory.splice(idx, 1);
    this.space.place(zoneName, card, { faceUp: true, label: `${this.name}:${zoneName}` });
    this.emit("agent:playCard", { payload: { name: this.name, card, zone: zoneName } });
    return card;
  }

  shuffleStack(seed: number | null = null): this {
    if (!this.stack) return this;
    this.stack.shuffle(seed ?? undefined);
    this.emit("agent:shuffle", { payload: { name: this.name, seed } });
    return this;
  }

  async think(engine: Engine): Promise<void> {
    if (!this.agent || typeof this.agent.think !== "function") return;
    try {
      const decision = await this.agent.think(engine, this);
      if (decision) {
        if (decision.type) await engine.dispatch(decision.type, decision.payload);
        else if (typeof decision.run === "function") await decision.run(engine);
      }
      this.emit("agent:decision", { payload: { name: this.name, decision } });
    } catch (err) {
      this.emit("agent:error", { payload: { name: this.name, error: err } });
    }
  }

  snapshot(): any {
    return {
      id: this.id,
      name: this.name,
      inventory: this.inventory.slice(),
      discard: this.discard.slice(),
      turns: this.turns,
      active: this.active,
      meta: this.meta
    };
  }

  toJSON(): any { return this.snapshot(); }

  static fromJSON(obj: any): Agent {
    const p = new Agent(obj?.name ?? "Agent");
    p.id = obj?.id ?? p.id;
    p.inventory = obj?.inventory ?? [];
    p.discard = obj?.discard ?? [];
    p.turns = obj?.turns ?? 0;
    p.active = obj?.active ?? true;
    p.meta = obj?.meta ?? {};
    return p;
  }
}