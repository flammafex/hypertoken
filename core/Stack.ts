/*
 * core/Stack.ts
 */
import { Emitter } from "./events.js";
import { shuffleArray } from "./random.js";
import { Token } from "./Token.js";
import { IToken, ReversalPolicy } from "./types.js";
import { Chronicle } from "./Chronicle.js";

export interface StackOptions {
  seed?: number | null;
  autoInit?: boolean;
}

/**
 * Stack: CRDT-backed ordered collection of tokens
 * Provides atomic operations for card games (draw, shuffle, burn, etc.)
 */
export class Stack extends Emitter {
  public readonly session: Chronicle;
  private _seed: number | null;
  private _rev: ReversalPolicy;
  private _original: IToken[];

  /**
   * Create a new Stack
   * @param session - Chronicle instance for CRDT state management
   * @param tokens - Initial tokens in the stack
   * @param options - Configuration options
   * @throws Error if session is null/undefined
   */
  constructor(session: Chronicle, tokens: IToken[] = [], { seed, autoInit = true }: StackOptions = {}) {
    super();

    if (!session) {
      throw new Error("Stack requires a valid Chronicle session");
    }

    this.session = session;
    this._original = tokens.map(t => t instanceof Token ? { ...t } : t);
    this._seed = seed ?? null;
    this._rev = { enabled: false, chance: 0.18, jitter: 0.04 };

    // Only initialize CRDT state if autoInit is true (Default)
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

  /**
   * Draw cards from the stack
   * @param n - Number of cards to draw (optional, draws 1 if not specified)
   * @returns Single token if n=1 or undefined, array if n>1
   * @throws Error if n is invalid (negative or not an integer)
   * @emits draw - Emitted with drawn card(s) if successful
   * @emits stack:empty - Emitted if stack is empty when drawing
   */
  draw(n?: number): IToken | IToken[] | undefined {
    if (typeof n === 'number') {
      if (n < 1 || !Number.isInteger(n)) {
        throw new Error(`Invalid draw count: ${n}. Must be a positive integer.`);
      }
      return this._drawMany(n);
    }
    return this._drawSingle();
  }

  private _drawSingle(): IToken | undefined {
    if (this.size === 0) {
      this.emit("stack:empty", { operation: "draw" });
      return undefined;
    }

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
    if (this.size === 0) {
      this.emit("stack:empty", { operation: "draw", requested: n });
      return [];
    }

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

    if (drawnCards.length > 0) {
      this.emit("draw", drawnCards);
      if (drawnCards.length < n) {
        this.emit("stack:insufficient", { requested: n, drawn: drawnCards.length });
      }
    }
    return drawnCards;
  }

  /**
   * Draw multiple cards from the stack
   * @param n - Number of cards to draw
   * @returns Array of drawn tokens
   * @throws Error if n is invalid
   */
  drawMany(n: number): IToken[] {
    if (n < 1 || !Number.isInteger(n)) {
      throw new Error(`Invalid draw count: ${n}. Must be a positive integer.`);
    }
    return this._drawMany(n);
  }

  /**
   * Shuffle the stack
   * @param newSeed - Optional seed for deterministic shuffle
   * @returns this for chaining
   */
  shuffle(newSeed?: number): this {
    if (newSeed !== undefined) this._seed = newSeed;
    this.session.change("shuffle stack", (doc) => {
      if (!doc.stack) return;
      const stack = this._clone(doc.stack.stack);
      shuffleArray(stack, this._seed ?? undefined);
      doc.stack.stack = stack;
    });
    this.emit("shuffle", { seed: this._seed });
    return this;
  }

  /**
   * Reset stack to original state
   * @returns this for chaining
   */
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

  /**
   * Burn cards from the top of the stack (move to discard without drawing)
   * @param n - Number of cards to burn
   * @returns Array of burned tokens
   * @throws Error if n is invalid
   */
  burn(n: number = 1): IToken[] {
    if (n < 1 || !Number.isInteger(n)) {
      throw new Error(`Invalid burn count: ${n}. Must be a positive integer.`);
    }

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

  /**
   * Discard a token
   * @param token - Token to discard
   * @returns The discarded token or null
   * @throws Error if token is null/undefined
   */
  discard(token: IToken): IToken | null {
    if (!token) {
      throw new Error("Cannot discard null/undefined token");
    }
    this.session.change("discard card", (doc) => {
      if (!doc.stack) return;
      doc.stack.discards.push(this._sanitize(token));
    });
    this.emit("discard", token);
    return token;
  }

  /**
   * Cut the stack at position n
   * @param n - Position to cut at
   * @param options - Cut options (topToBottom direction)
   * @returns this for chaining
   * @throws Error if n is invalid
   */
  cut(n: number = 0, { topToBottom = true }: { topToBottom?: boolean } = {}): this {
    const len = this.size;
    if (!Number.isInteger(n) || n <= 0 || n >= len) {
      throw new Error(`Invalid cut position: ${n}. Must be between 1 and ${len - 1}.`);
    }

    this.session.change("cut stack", (doc) => {
      if (!doc.stack) return;

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

  /**
   * Insert a card at a specific index
   * @param card - Card to insert
   * @param index - Position to insert at (clamped to valid range)
   * @returns this for chaining
   * @throws Error if card is null/undefined
   */
  insertAt(card: IToken, index: number): this {
    if (!card) {
      throw new Error("Cannot insert null/undefined card");
    }

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

  /**
   * Remove a card at a specific index
   * @param index - Index of card to remove
   * @returns Removed token or null if index invalid
   * @emits stack:invalidIndex if index is out of bounds
   */
  removeAt(index: number): IToken | null {
    if (index < 0 || index >= this.size) {
      this.emit("stack:invalidIndex", { operation: "removeAt", index, size: this.size });
      return null;
    }

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

  /**
   * Swap two cards at indices i and j
   * @param i - First index
   * @param j - Second index
   * @returns this for chaining
   * @throws Error if indices are invalid
   */
  swap(i: number, j: number): this {
    const len = this.size;
    if (i < 0 || j < 0 || i >= len || j >= len) {
      throw new Error(`Invalid swap indices: i=${i}, j=${j}. Valid range: 0 to ${len - 1}.`);
    }

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

  /**
   * Reverse a range of cards in the stack
   * @param i - Start index
   * @param j - End index
   * @returns this for chaining
   * @throws Error if indices are invalid
   */
  reverseRange(i: number, j: number): this {
    const len = this.size;
    if (i < 0 || j < 0 || i >= len || j >= len) {
      throw new Error(`Invalid reverse range: i=${i}, j=${j}. Valid range: 0 to ${len - 1}.`);
    }
    if (i === j) {
      // Reversing a single element is a no-op
      return this;
    }

    this.session.change("reverse range", (doc) => {
      if (!doc.stack) return;
      const stack = this._clone(doc.stack.stack);
      const [a, b] = i < j ? [i, j] : [j, i];
      const segment = stack.splice(a, b - a + 1);
      segment.reverse();
      stack.splice(a, 0, ...segment);
      doc.stack.stack = stack;
    });
    this.emit("stack:reverseRange", { payload: { i, j } });
    return this;
  }

  /**
   * Serialize stack to JSON
   * @returns CRDT stack state
   */
  toJSON(): unknown {
    return this.session.state.stack;
  }
}