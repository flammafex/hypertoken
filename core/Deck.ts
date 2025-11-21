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
/*
 * core/Deck.ts
 */
import { Emitter } from "./events.js";
import { mulberry32, shuffleArray } from "./random.js";
import { Token } from "./Token.js";
import { IToken, ReversalPolicy } from "./types.js";

export interface DeckOptions {
  seed?: number | null;
}

export class Deck extends Emitter {
  _stack: Token[];
  _original: Token[];
  _drawn: Token[];
  _discards: Token[];
  _history: Token[];
  _seed: number | null;
  _rev: ReversalPolicy;

  constructor(tokens: IToken[], { seed }: DeckOptions = {}) {
    super();
    this._original = tokens.map(t => t instanceof Token ? t : new Token(t));
    this._stack = [...this._original];
    this._seed = seed ?? null;
    this._drawn = [];
    this._discards = [];
    this._history = [];
    this._rev = { enabled: false, chance: 0.18, jitter: 0.04 };
  }

  // Getters
  get size(): number { return this._stack.length; }
  get tokens(): Token[] { return this._stack; }
  get drawn(): Token[] { return [...this._drawn]; }
  get discards(): Token[] { return [...this._discards]; }
  
  // ---------------------------------------------------------------------------
  // DRAW LOGIC
  // ---------------------------------------------------------------------------

  /** Draw a single card (default) */
  draw(): Token | undefined;
  /** Draw N cards (returns an array) */
  draw(n: number): Token[];
  /** Implementation */
  draw(n?: number): Token | Token[] | undefined {
    // Case 1: Draw N cards
    if (typeof n === 'number') {
      const out: Token[] = [];
      for (let i = 0; i < n; i++) {
        const t = this._drawSingle();
        if (!t) break;
        out.push(t);
      }
      return out;
    }
    
    // Case 2: Draw 1 card
    return this._drawSingle();
  }

  /** Internal helper to handle state updates for a single draw */
  private _drawSingle(): Token | undefined {
    const token = this._stack.pop();
    if (token) {
      this._drawn.push(token);
      this._history.push(token);
      this.emit("draw", token);
    }
    return token;
  }

  // Backward compatibility (Optional: remove if you update actions.js)
  drawMany(n: number): Token[] { return this.draw(n); }

  // ---------------------------------------------------------------------------
  // CORE OPERATIONS
  // ---------------------------------------------------------------------------

  shuffle(newSeed?: number): this {
    if (newSeed !== undefined) this._seed = newSeed;
    
    shuffleArray(this._stack, this._seed);
    
    // Handle reversals
    const rp = this._rev;
    if (rp.enabled) {
      // @ts-ignore
      const rand = this._seed == null ? Math.random : mulberry32((this._seed + 1) >>> 0);
      const actual = Math.max(0, Math.min(1, rp.chance + rp.jitter * (rand() * 2 - 1)));
      
      for (const t of this._stack) {
        t._rev = rand() < actual;
      }
    } else {
      for (const t of this._stack) t._rev = false;
    }
    
    this.emit("shuffle", { seed: this._seed, reversals: rp });
    return this;
  }

  reset(): this {
    this._stack = [...this._original];
    this._drawn = [];
    this._discards = [];
    this.emit("reset");
    return this;
  }

  burn(n: number = 1): Token[] {
    const burned: Token[] = [];
    for (let i = 0; i < n && this._stack.length; i++) {
      const t = this._stack.pop();
      if (t) {
        this._discards.push(t);
        burned.push(t);
      }
    }
    if (burned.length) this.emit("burn", burned);
    return burned;
  }

  discard(token: Token): Token | null {
    if (!token) return null;
    this._discards.push(token);
    this.emit("discard", token);
    return token;
  }

  discardLast(): Token | undefined { 
    const t = this._drawn.pop(); 
    if (t) this._discards.push(t); 
    return t; 
  }

  // ---------------------------------------------------------------------------
  // MANIPULATION
  // ---------------------------------------------------------------------------

  cut(n: number = 0, { topToBottom = true }: { topToBottom?: boolean } = {}): this {
    if (!Number.isInteger(n) || n <= 0 || n >= this._stack.length) return this;
    const top = this._stack.slice(0, n);
    const bottom = this._stack.slice(n);

    this._stack = topToBottom ? [...bottom, ...top] : [...top, ...bottom];
    this.emit("deck:cut", { payload: { n, topToBottom } });
    return this;
  }

  riffle({ iterations = 1, seed = null }: { iterations?: number; seed?: number | null } = {}): this {
    if (this._stack.length < 2) return this;

    // @ts-ignore
    const rand = seed != null ? mulberry32(seed) : Math.random;

    for (let k = 0; k < iterations; k++) {
      const mid = Math.floor(this._stack.length / 2);
      const left = this._stack.slice(0, mid);
      const right = this._stack.slice(mid);
      const merged: Token[] = [];

      while (left.length || right.length) {
        if (!left.length) merged.push(right.shift()!);
        else if (!right.length) merged.push(left.shift()!);
        else merged.push((rand() < 0.5 ? left : right).shift()!);
      }
      this._stack = merged;
    }
    this.emit("deck:riffle", { payload: { iterations, seed } });
    return this;
  }

  insertAt(card: Token, index: number): this {
    if (index < 0) index = 0;
    if (index > this._stack.length) index = this._stack.length;
    this._stack.splice(index, 0, card);
    this.emit("deck:insert", { payload: { card, index } });
    return this;
  }

  removeAt(index: number): Token | null {
    if (index < 0 || index >= this._stack.length) return null;
    const [removed] = this._stack.splice(index, 1);
    this.emit("deck:remove", { payload: { card: removed, index } });
    return removed ?? null;
  }

  swap(i: number, j: number): this {
    const len = this._stack.length;
    if (i < 0 || j < 0 || i >= len || j >= len) return this;
    [this._stack[i], this._stack[j]] = [this._stack[j], this._stack[i]];
    this.emit("deck:swap", { payload: { i, j } });
    return this;
  }

  reverseRange(i: number, j: number): this {
    const len = this._stack.length;
    if (i < 0 || j < 0 || i >= len || j >= len || i === j) return this;
    const [a, b] = i < j ? [i, j] : [j, i];
    const segment = this._stack.slice(a, b + 1).reverse();
    this._stack.splice(a, segment.length, ...segment);
    this.emit("deck:reverseRange", { payload: { i: a, j: b } });
    return this;
  }

  // ---------------------------------------------------------------------------
  // UTILITIES
  // ---------------------------------------------------------------------------

  mulligan(predicate: (t: Token) => boolean, { max = 1 }: { max?: number } = {}): Token[] {
    if (typeof predicate !== "function" || !this._drawn.length) return [];

    const returned: Token[] = [];
    const kept: Token[] = [];

    for (const card of this._drawn) {
      if (returned.length < max && predicate(card)) {
        this._stack.unshift(card);
        returned.push(card);
      } else kept.push(card);
    }

    this._drawn = kept;
    if (returned.length) this.shuffle();

    this.emit("deck:mulligan", {
      payload: { returned: returned.length, max }
    });
    return returned;
  }

  sample(n: number = 1, { withoutReplacement = true, seed = null }: { withoutReplacement?: boolean; seed?: number | null } = {}): Token[] {
    if (n <= 0 || !this._stack.length) return [];
    
    // @ts-ignore
    const rand = seed != null ? mulberry32(seed) : Math.random;
    const copy = this._stack.slice();
    const result: Token[] = [];

    for (let k = 0; k < n && copy.length; k++) {
      const idx = Math.floor(rand() * copy.length);
      result.push(copy[idx]);
      if (withoutReplacement) copy.splice(idx, 1);
    }

    this.emit("deck:sample", { payload: { n, withoutReplacement, seed } });
    return result;
  }

  toJSON(): any {
    return {
      type: "TokenSet",
      seed: this._seed,
      stack: this._stack,
      drawn: this._drawn,
      discards: this._discards,
      original: this._original,
    };
  }

  static fromJSON(obj: any): Deck {
    const d = new Deck(obj.original || [], { seed: obj.seed });
    if (obj.stack) d._stack = obj.stack.map((t: any) => new Token(t));
    if (obj.drawn) d._drawn = obj.drawn.map((t: any) => new Token(t));
    if (obj.discards) d._discards = obj.discards.map((t: any) => new Token(t));
    return d;
  }
}