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
/*
 * core/Shoe.ts
 */
// @ts-ignore
import { Emitter } from "./events.js";
// @ts-ignore
import { mulberry32, shuffleArray } from "./random.js";
import { Deck } from "./Deck.js";
import { IToken } from "./types.js";

export interface ReshufflePolicy {
  threshold: number | null;
  mode: "auto" | "manual";
}

export class Shoe extends Emitter {
  _decks: Deck[];
  _stack: IToken[];
  _original: IToken[];
  _burned: IToken[];
  _reshufflePolicy: ReshufflePolicy;
  _seed: number | null = null;

  constructor(...decks: Deck[]) {
    super();
    this._decks = decks;
    this._stack = decks.flatMap(d => d.tokens ?? []);
    this._original = [...this._stack];
    this._burned = [];
    this._reshufflePolicy = { threshold: null, mode: "auto" };
  }

  addDeck(deck: Deck): this {
    if (!deck) return this;
    this._decks.push(deck);
    this._stack.push(...(deck.tokens ?? []));
    this._original = [...this._stack];
    // @ts-ignore - assuming Deck has name property (it might not in strict types yet)
    this.emit("shoe:addDeck", { payload: { name: (deck as any).name ?? "(unnamed)" } });
    return this;
  }

  removeDeck(deck: Deck): this {
    const idx = this._decks.indexOf(deck);
    if (idx < 0) return this;
    this._decks.splice(idx, 1);
    // Rebuild stack without this deck's tokens
    const tokens = this._decks.flatMap(d => d.tokens ?? []);
    this._stack = [...tokens];
    this._original = [...this._stack];
    this.emit("shoe:removeDeck", { payload: { name: (deck as any).name ?? "(unnamed)" } });
    return this;
  }

  burn(n: number = 1): IToken[] {
    const burned = this._stack.splice(-n, n);
    this._burned.push(...burned);
    this.emit("shoe:burn", { payload: { count: burned.length } });
    return burned;
  }

  shuffle(newSeed?: number): this {
    if (newSeed !== undefined) this._seed = newSeed;
    shuffleArray(this._stack, this._seed);
    this.emit("shuffle", { seed: this._seed });
    return this;
  }

  reshuffleWhen(threshold: number, { mode = "auto" }: { mode?: "auto"|"manual" } = {}): this {
    this._reshufflePolicy = { threshold, mode };
    this.emit("shoe:policy", { payload: { threshold, mode } });
    return this;
  }

  draw(n: number = 1): IToken | IToken[] {
    const drawn = this._stack.splice(-n, n);
    
    if (this._reshufflePolicy.threshold != null &&
        this._stack.length <= this._reshufflePolicy.threshold) {
      this.shuffle();
      this.emit("shoe:reshuffled", { payload: { reason: "threshold" } });
    }
    
    this.emit("shoe:draw", { payload: { count: drawn.length } });
    return n === 1 ? drawn[0] : drawn;
  }

  reset(): this {
    this._stack = [...this._original];
    this._burned = [];
    this.emit("shoe:reset", { payload: { size: this._stack.length } });
    return this;
  }

  inspect(): any {
    return {
      decks: this._decks?.length ?? 0,
      remaining: this._stack.length,
      burned: this._burned.length,
      seed: this._seed ?? null,
      policy: this._reshufflePolicy
    };
  }

  toJSON(): any {
    return {
      type: "Shoe",
      seed: this._seed ?? null,
      decks: this._decks.map(d => (d as any).name ?? "(unnamed)"),
      stackSize: this._stack.length,
      burned: this._burned.length,
      policy: this._reshufflePolicy
    };
  }

  static fromJSON(obj: any): Shoe {
    const s = new Shoe();
    s._seed = obj?.seed ?? null;
    s._stack = new Array(obj?.stackSize ?? 0);
    s._burned = new Array(obj?.burned ?? 0);
    s._reshufflePolicy = obj?.policy ?? { threshold: null, mode: "auto" };
    return s;
  }
}