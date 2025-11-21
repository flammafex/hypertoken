/*
 * core/stack.ts
 */
import { Emitter } from "./events.js";
import { mulberry32, shuffleArray } from "./random.js";
import { Token } from "./Token.js";
import { IToken, ReversalPolicy } from "./types.js";
import { Chronicle } from "./Chronicle.js";

export interface StackOptions {
  seed?: number | null;
  autoInit?: boolean; // NEW: Control initialization behavior
}

export class Stack extends Emitter {
  public readonly session: Chronicle;
  private _seed: number | null;
  private _rev: ReversalPolicy;
  private _original: IToken[];

  constructor(session: Chronicle, tokens: IToken[] = [], { seed, autoInit = true }: StackOptions = {}) {
    super();
    this.session = session;
    this._original = tokens.map(t => t instanceof Token ? { ...t } : t);
    this._seed = seed ?? null;
    this._rev = { enabled: false, chance: 0.18, jitter: 0.04 };

    // FIX: Only initialize CRDT state if autoInit is true (Default)
    // Clients should set this to false to avoid overwriting Host state
    if (autoInit && !this.session.state.stack) {
      this.session.change("initialize stack", (doc) => {
        const cleanStack = this._original.map(t => this._sanitize(t));
        doc.stack = {
          stack: cleanStack,
          drawn: [],
          discards: []
        };
      });
    }
  }

  private _sanitize(token: IToken): IToken {
    const plain = { ...token };
    if (plain._tags instanceof Set) {
      // @ts-ignore
      plain._tags = Array.from(plain._tags);
    }
    return JSON.parse(JSON.stringify(plain));
  }

  // Helper to deep clone a proxy object to a plain JS object
  private _clone<T>(proxy: T): T {
    return JSON.parse(JSON.stringify(proxy));
  }

  // Read directly from CRDT
  get size(): number { return this.session.state.stack?.stack.length ?? 0; }
  get tokens(): IToken[] { return this.session.state.stack?.stack ?? []; }
  get drawn(): IToken[] { return this.session.state.stack?.drawn ?? []; }
  get discards(): IToken[] { return this.session.state.stack?.discards ?? []; }

  /** Atomic Draw Operation */
  draw(n?: number): IToken | IToken[] | undefined {
    if (typeof n === 'number') return this._drawMany(n);
    return this._drawSingle();
  }

  private _drawSingle(): IToken | undefined {
    let drawnCard: IToken | undefined;
    this.session.change("draw card", (doc) => {
      if (!doc.stack || doc.stack.stack.length === 0) return;
      
      const cardProxy = doc.stack.stack.pop();
      
      if (cardProxy) {
        const card = this._clone(cardProxy);
        doc.stack.drawn.push(card);
        drawnCard = card;
      }
    });
    if (drawnCard) this.emit("draw", drawnCard);
    return drawnCard;
  }

  private _drawMany(n: number): IToken[] {
    let drawnCards: IToken[] = [];
    this.session.change(`draw ${n} cards`, (doc) => {
      if (!doc.stack) return;
      const count = Math.min(n, doc.stack.stack.length);
      const startIdx = doc.stack.stack.length - count;
      
      const cardsProxy = doc.stack.stack.splice(startIdx, count);
      const cards = this._clone(cardsProxy);
      
      doc.stack.drawn.push(...cards);
      
      drawnCards = cards;
      drawnCards.reverse(); 
    });
    if (drawnCards.length > 0) this.emit("draw", drawnCards);
    return drawnCards;
  }

  drawMany(n: number): IToken[] { return this._drawMany(n); }

  shuffle(newSeed?: number): this {
    if (newSeed !== undefined) this._seed = newSeed;
    this.session.change("shuffle stack", (doc) => {
      if (!doc.stack) return;
      const stack = this._clone(doc.stack.stack);
      // @ts-ignore
      shuffleArray(stack, this._seed);
      doc.stack.stack = stack;
    });
    this.emit("shuffle", { seed: this._seed });
    return this;
  }

  reset(): this {
    this.session.change("reset stack", (doc) => {
      if (!doc.stack) return;
      doc.stack.stack = this._original.map(t => this._sanitize(t));
      doc.stack.drawn = [];
      doc.stack.discards = [];
    });
    this.emit("reset");
    return this;
  }

  burn(n: number = 1): IToken[] {
    let burned: IToken[] = [];
    this.session.change(`burn ${n} cards`, (doc) => {
      if (!doc.stack) return;
      const count = Math.min(n, doc.stack.stack.length);
      const startIdx = doc.stack.stack.length - count;
      const cardsProxy = doc.stack.stack.splice(startIdx, count);
      const cards = this._clone(cardsProxy);
      doc.stack.discards.push(...cards);
      burned = cards;
    });
    if (burned.length) this.emit("burn", burned);
    return burned;
  }

  discard(token: IToken): IToken | null {
    if (!token) return null;
    this.session.change("discard card", (doc) => {
      if (!doc.stack) return;
      doc.stack.discards.push(this._sanitize(token));
    });
    this.emit("discard", token);
    return token;
  }

  cut(n: number = 0, { topToBottom = true }: { topToBottom?: boolean } = {}): this {
    this.session.change("cut stack", (doc) => {
      if (!doc.stack) return;
      const len = doc.stack.stack.length;
      if (!Number.isInteger(n) || n <= 0 || n >= len) return;
      
      let stack = this._clone(doc.stack.stack);
      const cutPoint = n; 
      const top = stack.splice(cutPoint, len - cutPoint);
      const bottom = stack.splice(0, cutPoint);
      
      if (topToBottom) stack = [...top, ...bottom];
      else stack = [...bottom, ...top];
      
      doc.stack.stack = stack;
    });
    this.emit("stack:cut", { payload: { n, topToBottom } });
    return this;
  }

  insertAt(card: IToken, index: number): this {
    this.session.change("insert card", (doc) => {
      if (!doc.stack) return;
      let idx = index;
      if (idx < 0) idx = 0;
      if (idx > doc.stack.stack.length) idx = doc.stack.stack.length;
      doc.stack.stack.splice(idx, 0, this._sanitize(card));
    });
    this.emit("stack:insert", { payload: { card, index } });
    return this;
  }

  removeAt(index: number): IToken | null {
    let removed: IToken | null = null;
    this.session.change("remove card at", (doc) => {
      if (!doc.stack) return;
      if (index < 0 || index >= doc.stack.stack.length) return;
      const [itemProxy] = doc.stack.stack.splice(index, 1);
      removed = this._clone(itemProxy);
    });
    if (removed) this.emit("stack:remove", { payload: { card: removed, index } });
    return removed;
  }

  swap(i: number, j: number): this {
    this.session.change("swap cards", (doc) => {
      if (!doc.stack) return;
      const stack = this._clone(doc.stack.stack);
      if (i < 0 || j < 0 || i >= stack.length || j >= stack.length) return;
      const temp = stack[i];
      stack[i] = stack[j];
      stack[j] = temp;
      doc.stack.stack = stack;
    });
    this.emit("stack:swap", { payload: { i, j } });
    return this;
  }

  reverseRange(i: number, j: number): this {
    this.session.change("reverse range", (doc) => {
      if (!doc.stack) return;
      const stack = this._clone(doc.stack.stack);
      const len = stack.length;
      if (i < 0 || j < 0 || i >= len || j >= len || i === j) return;
      const [a, b] = i < j ? [i, j] : [j, i];
      const segment = stack.splice(a, b - a + 1);
      segment.reverse();
      stack.splice(a, 0, ...segment);
      doc.stack.stack = stack;
    });
    this.emit("stack:reverseRange", { payload: { i, j } });
    return this;
  }

  toJSON(): any {
    return this.session.state.stack;
  }
}