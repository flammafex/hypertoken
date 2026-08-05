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
 * core/Source.ts
 */
import { Emitter } from "./events.js";
import { shuffleArray } from "./random.js";
import { Stack } from "./Stack.js";
import { Chronicle } from "./Chronicle.js";
import { IToken, ISourceState, ReshufflePolicy } from "./types.js";
import { sanitizeToken, clone } from "./serialize.js";

export interface SourceOptions {
  autoInit?: boolean;
}

/**
 * Source: CRDT-backed multi-stack randomness source
 * Combines multiple stacks into a unified draw source with reshuffle policies
 */
export class Source extends Emitter {
  public readonly session: Chronicle;
  private _stacks: Stack[];

  constructor(session: Chronicle, stacks: Stack[] = [], { autoInit = true }: SourceOptions = {}) {
    super();
    this.session = session;
    this._stacks = stacks;

    if (autoInit && !this.session.state.source) {
      const tokens = stacks.flatMap(d => d.tokens ?? []);
      this.session.change("initialize source", (doc) => {
        doc.source = {
          stackIds: stacks.map((_, i) => `stack-${i}`),
          tokens: tokens.map(t => sanitizeToken(t)),
          burned: [],
          seed: null,
          reshufflePolicy: { threshold: null, mode: "auto" }
        };
      });
    }
  }


  get tokens(): IToken[] { return this.session.state.source?.tokens ?? []; }
  get burned(): IToken[] { return this.session.state.source?.burned ?? []; }
  get seed(): number | null { return this.session.state.source?.seed ?? null; }
  get policy(): ReshufflePolicy {
    return this.session.state.source?.reshufflePolicy ?? { threshold: null, mode: "auto" };
  }

  /**
   * Add a stack to the source
   * @throws Error if stack is null/undefined
   */
  addStack(stack: Stack): this {
    return this.addStacks([stack]);
  }

  /**
   * Add multiple stacks to the source in a single transaction.
   *
   * All stackIds and tokens are written in ONE session.change() to avoid the
   * per-stack Automerge transaction overhead. Tokens are pushed granularly
   * (rather than assigned as a whole list) so concurrent edits merge correctly
   * under Automerge while still batching into a single commit.
   * @throws Error if any stack is null/undefined
   */
  addStacks(stacks: Stack[]): this {
    if (!stacks || stacks.length === 0) {
      return this;
    }
    for (const stack of stacks) {
      if (!stack) {
        throw new Error("Cannot add null/undefined stack to Source");
      }
    }

    const startIndex = this._stacks.length;
    this._stacks.push(...stacks);
    const allTokens = stacks.flatMap(d => d.tokens ?? []);

    this.session.change("add stacks to source", (doc) => {
      if (!doc.source) return;
      for (let i = 0; i < stacks.length; i++) {
        doc.source.stackIds.push(`stack-${startIndex + i}`);
      }
      // Push each token granularly (rather than replacing the whole tokens
      // list) so concurrent edits merge correctly under Automerge. A whole-list
      // assignment creates a new list object at the `tokens` key, which is
      // last-writer-wins and would silently drop a concurrent peer's draw or
      // another concurrent addStacks' tokens.
      for (const t of allTokens) {
        doc.source.tokens.push(sanitizeToken(t));
      }
    });

    for (let i = 0; i < stacks.length; i++) {
      this.emit("source:addStack", { payload: { stackId: `stack-${startIndex + i}` } });
    }
    return this;
  }

  /**
   * Remove a stack from the source
   * @throws Error if stack not found
   */
  removeStack(stack: Stack): this {
    const idx = this._stacks.indexOf(stack);
    if (idx < 0) {
      throw new Error("Stack not found in Source");
    }

    // Tokens are appended per-stack in order, so the removed stack's tokens
    // occupy a contiguous range in the concatenated source token list. Compute
    // that range so we can splice it out granularly (CRDT-safe) rather than
    // replacing the whole tokens list (which would be last-writer-wins).
    let tokenStart = 0;
    for (let i = 0; i < idx; i++) {
      tokenStart += (this._stacks[i].tokens ?? []).length;
    }
    const removedCount = (stack.tokens ?? []).length;

    this._stacks.splice(idx, 1);

    this.session.change("remove stack from source", (doc) => {
      if (!doc.source) return;
      doc.source.stackIds.splice(idx, 1);
      doc.source.tokens.splice(tokenStart, removedCount);
    });

    this.emit("source:removeStack", { payload: { stackId: `stack-${idx}` } });
    return this;
  }

  /**
   * Burn cards from the top of the source
   * @throws Error if n is invalid
   */
  burn(n: number = 1): IToken[] {
    if (n < 1 || !Number.isInteger(n)) {
      throw new Error(`Invalid burn count: ${n}. Must be a positive integer.`);
    }

    // Throws when count > remaining tokens instead of clamping. Validated
    // before the change so overdraw leaves state untouched.
    const available = this.tokens.length;
    if (n > available) {
      throw new Error(`Invalid operation: Cannot burn ${n} from source of ${available}`);
    }

    let burned: IToken[] = [];
    this.session.change(`burn ${n} cards from source`, (doc) => {
      if (!doc.source) return;
      const startIdx = doc.source.tokens.length - n;
      const burnedProxy = doc.source.tokens.splice(startIdx, n);
      burned = clone(burnedProxy);
      doc.source.burned.push(...burned);
    });

    if (burned.length > 0) {
      this.emit("source:burn", { payload: { count: burned.length } });
    }
    return burned;
  }

  /**
   * Shuffle the source with optional seed
   */
  shuffle(newSeed?: number): this {
    this.session.change("shuffle source", (doc) => {
      if (!doc.source) return;
      if (newSeed !== undefined) {
        doc.source.seed = newSeed;
      }
      const tokens = clone(doc.source.tokens);
      shuffleArray(tokens, doc.source.seed);
      doc.source.tokens = tokens;
    });

    this.emit("shuffle", { seed: this.seed });
    return this;
  }

  /**
   * Set reshuffle policy
   * @throws Error if threshold is negative
   */
  reshuffleWhen(threshold: number, { mode = "auto" }: { mode?: "auto" | "manual" } = {}): this {
    if (threshold < 0) {
      throw new Error(`Invalid reshuffle threshold: ${threshold}. Must be non-negative.`);
    }

    this.session.change("set reshuffle policy", (doc) => {
      if (!doc.source) return;
      doc.source.reshufflePolicy = { threshold, mode };
    });

    this.emit("source:policy", { payload: { threshold, mode } });
    return this;
  }

  /**
   * Draw cards from the source
   * @throws Error if n is invalid
   * @returns Single token if n=1, array otherwise
   */
  draw(n: number = 1): IToken | IToken[] | undefined {
    if (n < 1 || !Number.isInteger(n)) {
      throw new Error(`Invalid draw count: ${n}. Must be a positive integer.`);
    }

    // Validation ORDER: the overdraw check happens BEFORE any draw and BEFORE
    // the reshuffle-policy check. Overdraw throws even when auto-reshuffle is
    // configured; it never clamps.
    const available = this.tokens.length;
    if (n > available) {
      throw new Error(`Invalid operation: Cannot draw ${n} from source of ${available}`);
    }

    let drawn: IToken[] = [];
    let reshuffled = false;
    this.session.change(`draw ${n} from source`, (doc) => {
      if (!doc.source) return;
      const startIdx = doc.source.tokens.length - n;
      const drawnProxy = doc.source.tokens.splice(startIdx, n);
      drawn = clone(drawnProxy);
      // Return cards in top-first order (first element is the top card),
      // consistent with Stack._drawMany and tokens:draw.
      drawn.reverse();

      // Check reshuffle policy
      if (doc.source.reshufflePolicy.threshold !== null &&
          doc.source.tokens.length <= doc.source.reshufflePolicy.threshold &&
          doc.source.reshufflePolicy.mode === "auto") {
        const tokens = clone(doc.source.tokens);
        shuffleArray(tokens, doc.source.seed);
        doc.source.tokens = tokens;
        reshuffled = true;
      }
    });

    // Emit events after change() completes so listeners see consistent state
    if (reshuffled) {
      this.emit("source:reshuffled", { payload: { reason: "threshold" } });
    }
    if (drawn.length > 0) {
      this.emit("source:draw", { payload: { count: drawn.length } });
    }

    return n === 1 ? drawn[0] : drawn;
  }

  /**
   * Reset source to initial state
   */
  reset(): this {
    const tokens = this._stacks.flatMap(d => d.tokens ?? []);

    this.session.change("reset source", (doc) => {
      if (!doc.source) return;
      doc.source.tokens = tokens.map(t => sanitizeToken(t));
      doc.source.burned = [];
    });

    this.emit("source:reset", { payload: { size: this.tokens.length } });
    return this;
  }

  /**
   * Inspect current source state
   */
  inspect(): ISourceState & { stacks: number } {
    const state = this.session.state.source;
    return {
      stacks: this._stacks.length,
      stackIds: state?.stackIds ?? [],
      tokens: state?.tokens ?? [],
      burned: state?.burned ?? [],
      seed: state?.seed ?? null,
      reshufflePolicy: state?.reshufflePolicy ?? { threshold: null, mode: "auto" }
    };
  }

  toJSON(): ISourceState & { type: string; stacks: number } {
    const state = this.session.state.source;
    return {
      type: "Source",
      stacks: this._stacks.length,
      stackIds: state?.stackIds ?? [],
      tokens: state?.tokens ?? [],
      burned: state?.burned ?? [],
      seed: state?.seed ?? null,
      reshufflePolicy: state?.reshufflePolicy ?? { threshold: null, mode: "auto" }
    };
  }
}