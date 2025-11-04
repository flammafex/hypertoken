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
 */
//./core/Deck.js
import { Emitter } from "./events.js";
import { mulberry32, shuffleArray } from "./random.js";

export class Deck extends Emitter {
  constructor(tokens, { seed } = {}) {
    super();
    this._original = tokens.slice();
    this._seed = seed ?? null;
    this._history = [];
    this._rev = { enabled: false, chance: 0.18, jitter: 0.04 };
    this.reset();
  }

  get size() { return this._stack.length; }
  get tokens() { return this._stack; }       // new neutral getter
  get cards()  { return this._stack; }       // backward compat
  get drawnTokens() { return this._drawn.slice(); }
  get drawn()       { return this._drawn.slice(); } // compat
  get discards()    { return this._discards.slice(); }
  get back()        { return String.fromCodePoint(0x1F0A0); }

  shuffle(newSeed = undefined) {
    if (newSeed !== undefined) this._seed = newSeed;
    shuffleArray(this._stack, this._seed);
    const rp = this._rev || { enabled: false };
    if (rp.enabled) {
      const rand = this._seed == null ? Math.random : mulberry32((this._seed + 1) >>> 0);
      const base = rp.chance ?? 0.18;
      const jitter = rp.jitter ?? 0.04;
      const actual = Math.max(0, Math.min(1, base + jitter * (rand() * 2 - 1)));
      for (const t of this._stack) t._rev = rand() < actual;
    } else {
      for (const t of this._stack) t._rev = false;
    }
    this.emit("shuffle", { seed: this._seed, reversals: rp });
    return this;
  }

  draw() {
    const token = this._stack.pop();
    if (token) {
      this._drawn.push(token);
      this._history.push(token);
      this.emit("draw", token);
    }
    return token;
  }
  drawMany(n = 1) { const out = []; for (let i = 0; i < n; i++) { const t = this.draw(); if (!t) break; out.push(t); } return out; }
reset() {
  this._stack = this._original.slice();
  this._drawn = [];
  this._discards = [];
  this.emit("reset");
  return this;
}
  burn(n = 1) {
    const burned = [];
    for (let i = 0; i < n && this._stack.length; i++) {
      const t = this._stack.pop();
      if (t) { this._discards.push(t); burned.push(t); }
    }
    if (burned.length) this.emit("burn", burned);
    return burned;
  }

  discard(token) { if (!token) return null; this._discards.push(token); this.emit("discard", token); return token; }
  discardLast()  { const t = this._drawn.pop(); if (t) this._discards.push(t); return t; }
cut(n = 0, { topToBottom = true } = {}) {
  if (!Number.isInteger(n) || n <= 0 || n >= this._stack.length) return this;
  const top = this._stack.slice(0, n);
  const bottom = this._stack.slice(n);

  this._stack = topToBottom ? [...bottom, ...top] : [...top, ...bottom];

  this.emit("deck:cut", { payload: { n, topToBottom } });
  return this;
}
riffle({ iterations = 1, seed = null } = {}) {
  if (this._stack.length < 2) return this;

  const rand = seed != null ? mulberry32(seed) : Math.random;

  for (let k = 0; k < iterations; k++) {
    const mid = Math.floor(this._stack.length / 2);
    const left = this._stack.slice(0, mid);
    const right = this._stack.slice(mid);
    const merged = [];

    while (left.length || right.length) {
      if (!left.length) merged.push(right.shift());
      else if (!right.length) merged.push(left.shift());
      else merged.push((rand() < 0.5 ? left : right).shift());
    }

    this._stack = merged;
  }

  this.emit("deck:riffle", { payload: { iterations, seed } });
  return this;
}
mulligan(predicate, { max = 1 } = {}) {
  if (typeof predicate !== "function" || !this._drawn.length) return [];

  const returned = [];
  const kept = [];

  for (const card of this._drawn) {
    if (returned.length < max && predicate(card)) {
      this._stack.unshift(card); // return to top
      returned.push(card);
    } else kept.push(card);
  }

  this._drawn = kept;

  if (returned.length) this.shuffle(); // optional: freshen order

  this.emit("deck:mulligan", {
    payload: { returned: returned.length, max }
  });

  return returned;
}
  rebuild({ includeDrawn = false, includeDiscards = false } = {}) {
    const newStack = this._stack.slice();
    if (includeDrawn) newStack.push(...this._drawn);
    if (includeDiscards) newStack.push(...this._discards);
    this._stack = newStack;
    this._drawn = [];
    this._discards = [];
    this.emit("rebuild", { includeDrawn, includeDiscards });
    return this;
  }
  setReversals({ enabled = true, chance = 0.18, jitter = 0.04 } = {}) {
  this._rev = { enabled, chance, jitter };
  return this;
}

insertAt(card, index) {
  if (index < 0) index = 0;
  if (index > this._stack.length) index = this._stack.length;
  this._stack.splice(index, 0, card);
  this.emit("deck:insert", { payload: { card, index } });
  return this;
}
removeAt(index) {
  if (index < 0 || index >= this._stack.length) return null;
  const [removed] = this._stack.splice(index, 1);
  this.emit("deck:remove", { payload: { card: removed, index } });
  return removed ?? null;
}
swap(i, j) {
  const len = this._stack.length;
  if (i < 0 || j < 0 || i >= len || j >= len) return this;
  [this._stack[i], this._stack[j]] = [this._stack[j], this._stack[i]];
  this.emit("deck:swap", { payload: { i, j } });
  return this;
}
reverseRange(i, j) {
  const len = this._stack.length;
  if (i < 0 || j < 0 || i >= len || j >= len || i === j) return this;
  const [a, b] = i < j ? [i, j] : [j, i];
  const segment = this._stack.slice(a, b + 1).reverse();
  this._stack.splice(a, segment.length, ...segment);
  this.emit("deck:reverseRange", { payload: { i: a, j: b } });
  return this;
}
sample(n = 1, { withoutReplacement = true, seed = null } = {}) {
  if (n <= 0 || !this._stack.length) return [];
  const rand = seed != null ? mulberry32(seed) : Math.random;
  const copy = this._stack.slice();
  const result = [];

  for (let k = 0; k < n && copy.length; k++) {
    const idx = Math.floor(rand() * copy.length);
    result.push(copy[idx]);
    if (withoutReplacement) copy.splice(idx, 1);
  }

  this.emit("deck:sample", {
    payload: { n, withoutReplacement, seed }
  });
  return result;
}
tag(card, tags) {
  if (!card) return this;
  const arr = Array.isArray(tags) ? tags : [tags];
  if (!card._tags) card._tags = new Set();
  arr.forEach(t => card._tags.add(t));
  this.emit("deck:tag", { payload: { card, tags: arr } });
  return this;
}

findByTag(tag) {
  const results = this._stack.filter(c => c._tags?.has(tag));
  this.emit("deck:findByTag", { payload: { tag, count: results.length } });
  return results;
}
  remaining() { return this._stack.slice(); }
  history() { return this._history.slice(); }

  // compatibility aliases
  drawCard() { return this.draw(); }
  drawCards(n=1){ return this.drawMany(n); }
  remainingCards(){ return this.remaining(); }
    // ─── Safe stack mutators for external helpers ───────────────────────────────
  pushTop(cards) {
    const arr = Array.isArray(cards) ? cards : [cards];
    this._stack.push(...arr);
    return this;
  }

  pushBottom(cards) {
    const arr = Array.isArray(cards) ? cards : [cards];
    this._stack.unshift(...arr);
    return this;
  }

  removeFromDrawn(cards) {
    const arr = Array.isArray(cards) ? cards : [cards];
    this._drawn = this._drawn.filter(c => !arr.includes(c));
    return this;
  }

  removeFromDiscards(cards) {
    const arr = Array.isArray(cards) ? cards : [cards];
    this._discards = this._discards.filter(c => !arr.includes(c));
    return this;
  }

  toJSON() {
    return {
      type: "TokenSet",
      seed: this._seed,
      stack: this._stack,
      drawn: this._drawn,
      discards: this._discards,
      original: this._original,
    };
  }
  static fromJSON(obj) {
    const d = new Deck(obj.original || [], { seed: obj.seed });
    d._stack = obj.stack || [];
    d._drawn = obj.drawn || [];
    d._discards = obj.discards || [];
    return d;
  }
}