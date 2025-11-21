/*
 * core/Deck.ts
 */
import { Emitter } from "./events.js";
import { mulberry32, shuffleArray } from "./random.js";
import { Token } from "./Token.js";
import { IToken, ReversalPolicy } from "./types.js";
import { SessionManager } from "./SessionManager.js";

export interface DeckOptions {
  seed?: number | null;
  autoInit?: boolean; // NEW: Control initialization behavior
}

export class Deck extends Emitter {
  public readonly session: SessionManager;
  private _seed: number | null;
  private _rev: ReversalPolicy;
  private _original: IToken[];

  constructor(session: SessionManager, tokens: IToken[] = [], { seed, autoInit = true }: DeckOptions = {}) {
    super();
    this.session = session;
    this._original = tokens.map(t => t instanceof Token ? { ...t } : t);
    this._seed = seed ?? null;
    this._rev = { enabled: false, chance: 0.18, jitter: 0.04 };

    // FIX: Only initialize CRDT state if autoInit is true (Default)
    // Clients should set this to false to avoid overwriting Host state
    if (autoInit && !this.session.state.deck) {
      this.session.change("initialize deck", (doc) => {
        const cleanStack = this._original.map(t => this._sanitize(t));
        doc.deck = {
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
  get size(): number { return this.session.state.deck?.stack.length ?? 0; }
  get tokens(): IToken[] { return this.session.state.deck?.stack ?? []; }
  get drawn(): IToken[] { return this.session.state.deck?.drawn ?? []; }
  get discards(): IToken[] { return this.session.state.deck?.discards ?? []; }

  /** Atomic Draw Operation */
  draw(n?: number): IToken | IToken[] | undefined {
    if (typeof n === 'number') return this._drawMany(n);
    return this._drawSingle();
  }

  private _drawSingle(): IToken | undefined {
    let drawnCard: IToken | undefined;
    this.session.change("draw card", (doc) => {
      if (!doc.deck || doc.deck.stack.length === 0) return;
      
      const cardProxy = doc.deck.stack.pop();
      
      if (cardProxy) {
        const card = this._clone(cardProxy);
        doc.deck.drawn.push(card);
        drawnCard = card;
      }
    });
    if (drawnCard) this.emit("draw", drawnCard);
    return drawnCard;
  }

  private _drawMany(n: number): IToken[] {
    let drawnCards: IToken[] = [];
    this.session.change(`draw ${n} cards`, (doc) => {
      if (!doc.deck) return;
      const count = Math.min(n, doc.deck.stack.length);
      const startIdx = doc.deck.stack.length - count;
      
      const cardsProxy = doc.deck.stack.splice(startIdx, count);
      const cards = this._clone(cardsProxy);
      
      doc.deck.drawn.push(...cards);
      
      drawnCards = cards;
      drawnCards.reverse(); 
    });
    if (drawnCards.length > 0) this.emit("draw", drawnCards);
    return drawnCards;
  }

  drawMany(n: number): IToken[] { return this._drawMany(n); }

  shuffle(newSeed?: number): this {
    if (newSeed !== undefined) this._seed = newSeed;
    this.session.change("shuffle deck", (doc) => {
      if (!doc.deck) return;
      const stack = this._clone(doc.deck.stack);
      // @ts-ignore
      shuffleArray(stack, this._seed);
      doc.deck.stack = stack;
    });
    this.emit("shuffle", { seed: this._seed });
    return this;
  }

  reset(): this {
    this.session.change("reset deck", (doc) => {
      if (!doc.deck) return;
      doc.deck.stack = this._original.map(t => this._sanitize(t));
      doc.deck.drawn = [];
      doc.deck.discards = [];
    });
    this.emit("reset");
    return this;
  }

  burn(n: number = 1): IToken[] {
    let burned: IToken[] = [];
    this.session.change(`burn ${n} cards`, (doc) => {
      if (!doc.deck) return;
      const count = Math.min(n, doc.deck.stack.length);
      const startIdx = doc.deck.stack.length - count;
      const cardsProxy = doc.deck.stack.splice(startIdx, count);
      const cards = this._clone(cardsProxy);
      doc.deck.discards.push(...cards);
      burned = cards;
    });
    if (burned.length) this.emit("burn", burned);
    return burned;
  }

  discard(token: IToken): IToken | null {
    if (!token) return null;
    this.session.change("discard card", (doc) => {
      if (!doc.deck) return;
      doc.deck.discards.push(this._sanitize(token));
    });
    this.emit("discard", token);
    return token;
  }

  cut(n: number = 0, { topToBottom = true }: { topToBottom?: boolean } = {}): this {
    this.session.change("cut deck", (doc) => {
      if (!doc.deck) return;
      const len = doc.deck.stack.length;
      if (!Number.isInteger(n) || n <= 0 || n >= len) return;
      
      let stack = this._clone(doc.deck.stack);
      const cutPoint = n; 
      const top = stack.splice(cutPoint, len - cutPoint);
      const bottom = stack.splice(0, cutPoint);
      
      if (topToBottom) stack = [...top, ...bottom];
      else stack = [...bottom, ...top];
      
      doc.deck.stack = stack;
    });
    this.emit("deck:cut", { payload: { n, topToBottom } });
    return this;
  }

  insertAt(card: IToken, index: number): this {
    this.session.change("insert card", (doc) => {
      if (!doc.deck) return;
      let idx = index;
      if (idx < 0) idx = 0;
      if (idx > doc.deck.stack.length) idx = doc.deck.stack.length;
      doc.deck.stack.splice(idx, 0, this._sanitize(card));
    });
    this.emit("deck:insert", { payload: { card, index } });
    return this;
  }

  removeAt(index: number): IToken | null {
    let removed: IToken | null = null;
    this.session.change("remove card at", (doc) => {
      if (!doc.deck) return;
      if (index < 0 || index >= doc.deck.stack.length) return;
      const [itemProxy] = doc.deck.stack.splice(index, 1);
      removed = this._clone(itemProxy);
    });
    if (removed) this.emit("deck:remove", { payload: { card: removed, index } });
    return removed;
  }

  swap(i: number, j: number): this {
    this.session.change("swap cards", (doc) => {
      if (!doc.deck) return;
      const stack = this._clone(doc.deck.stack);
      if (i < 0 || j < 0 || i >= stack.length || j >= stack.length) return;
      const temp = stack[i];
      stack[i] = stack[j];
      stack[j] = temp;
      doc.deck.stack = stack;
    });
    this.emit("deck:swap", { payload: { i, j } });
    return this;
  }

  reverseRange(i: number, j: number): this {
    this.session.change("reverse range", (doc) => {
      if (!doc.deck) return;
      const stack = this._clone(doc.deck.stack);
      const len = stack.length;
      if (i < 0 || j < 0 || i >= len || j >= len || i === j) return;
      const [a, b] = i < j ? [i, j] : [j, i];
      const segment = stack.splice(a, b - a + 1);
      segment.reverse();
      stack.splice(a, 0, ...segment);
      doc.deck.stack = stack;
    });
    this.emit("deck:reverseRange", { payload: { i, j } });
    return this;
  }

  toJSON(): any {
    return this.session.state.deck;
  }
}