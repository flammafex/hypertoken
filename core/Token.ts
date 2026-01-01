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
 * core/Token.ts
 */
import { IToken, TokenMeta } from "./types.js";

/**
 * Token: Universal entity representation
 *
 * Tokens are immutable data structures representing game entities (cards, items, agents, etc.)
 * They can be placed in Stacks, Spaces, and Sources, and support:
 * - Metadata and grouping
 * - Reversals (tarot-style)
 * - Tags and attachments
 * - Merge/split tracking for composite entities
 */
export class Token implements IToken {
  id: string;
  group: string | null;
  label: string | null;
  text: string;
  meta: TokenMeta;
  char: string;
  kind: string;
  index: number;

  // Runtime properties
  _rev?: boolean;
  _tags?: Set<string>;
  _attachments?: unknown[];
  _attachedTo?: string;
  _attachmentType?: string;

  // Merge/split bookkeeping
  _merged?: boolean;
  _mergedInto?: string;
  _mergedFrom?: string[];
  _mergedAt?: number;
  _split?: boolean;
  _splitInto?: string[];
  _splitFrom?: string;
  _splitIndex?: number;
  _splitAt?: number;

  /**
   * Create a new Token
   * @param props - Token properties (all optional, will use defaults)
   */
  constructor({
    id,
    group = null,
    label = null,
    text = "",
    meta = {},
    char = "□",
    kind = "default",
    index = 0
  }: Partial<IToken> = {}) {
    this.id = id ?? `token-${index}`;
    this.group = group;
    this.label = label;
    this.text = text;
    this.meta = meta;
    this.char = char;
    this.kind = kind;
    this.index = index;
  }
}