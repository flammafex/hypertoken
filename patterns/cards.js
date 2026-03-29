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

/**
 * Card & Token Factory Patterns
 *
 * Utilities for creating decks and token sets as IToken-compatible objects
 * for use with the HyperToken Stack and Space primitives.
 *
 * Each token has:
 *   id      — unique identifier, e.g. "card-hearts-A"
 *   kind    — category/suit, e.g. "hearts"
 *   label   — short display label, e.g. "A" or "K"
 *   text    — full display string, e.g. "A♥"
 *   char    — single display character/glyph
 *   group   — grouping key (typically equals kind for cards)
 *   index   — numeric ordering value (rank value for cards)
 *   meta    — game-specific data: { suit, rank, value, ... }
 *   _tags   — searchable tag array
 */

export const STANDARD_SUITS = ['clubs', 'diamonds', 'hearts', 'spades'];
export const STANDARD_RANKS = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];

const SUIT_CHARS = { clubs: '♣', diamonds: '♦', hearts: '♥', spades: '♠' };

const RANK_VALUES = {
  'A': 1, '2': 2, '3': 3, '4': 4, '5': 5, '6': 6, '7': 7,
  '8': 8, '9': 9, '10': 10, 'J': 11, 'Q': 12, 'K': 13,
};

/**
 * Create a custom deck of tokens.
 *
 * @param {string[]} suits   Suit names, used as token `kind` and `group`.
 * @param {string[]} ranks   Rank labels, used as token `label`.
 * @param {Object}  [opts]
 * @param {Object}  [opts.suitChars]   Map of suit → display char (e.g. { hearts: '♥' }).
 * @param {Object}  [opts.rankValues]  Map of rank → numeric value stored as token `index`.
 * @param {Object}  [opts.meta]        Extra metadata merged into every token's `meta`.
 * @param {string}  [opts.idPrefix]    Prefix for token IDs (default: "card").
 * @returns {Array<Object>} Array of IToken-compatible plain objects.
 */
export function createDeck(suits, ranks, opts = {}) {
  const { suitChars = {}, rankValues = {}, meta = {}, idPrefix = 'card' } = opts;
  const tokens = [];
  let fallbackIndex = 0;

  for (const suit of suits) {
    const suitChar = suitChars[suit] ?? suit[0].toUpperCase();
    for (const rank of ranks) {
      const value = rankValues[rank] ?? fallbackIndex;
      tokens.push({
        id: `${idPrefix}-${suit}-${rank}`,
        kind: suit,
        label: rank,
        text: `${rank}${suitChar}`,
        char: suitChar,
        group: suit,
        index: value,
        meta: { suit, rank, value, ...meta },
        _tags: [],
      });
      fallbackIndex++;
    }
  }

  return tokens;
}

/**
 * Create a standard 52-card French deck.
 *
 * Each card token has:
 *   id     "card-{suit}-{rank}"   e.g. "card-hearts-A"
 *   kind   suit name              e.g. "hearts"
 *   label  rank string            e.g. "A", "10", "K"
 *   text   display string         e.g. "A♥"
 *   index  rank value 1–13
 *   meta   { suit, rank, value }
 *
 * @param {Object}  [opts]
 * @param {boolean} [opts.jokers=false]  Include 2 joker cards (red and black).
 * @param {Object}  [opts.meta]          Extra metadata merged into every token.
 * @returns {Array<Object>} 52 (or 54) IToken-compatible plain objects.
 */
export function createStandardDeck(opts = {}) {
  const { jokers = false, meta = {} } = opts;

  const deck = createDeck(STANDARD_SUITS, STANDARD_RANKS, {
    suitChars: SUIT_CHARS,
    rankValues: RANK_VALUES,
    meta,
  });

  if (jokers) {
    for (const color of ['red', 'black']) {
      deck.push({
        id: `card-joker-${color}`,
        kind: 'joker',
        label: 'Joker',
        text: '🃏',
        char: '🃏',
        group: 'joker',
        index: 0,
        meta: { suit: 'joker', rank: 'Joker', value: 0, color, ...meta },
        _tags: ['joker'],
      });
    }
  }

  return deck;
}

/**
 * Create a set of N dice as tokens.
 *
 * Each die token represents one physical die (not a face).
 * The current face value is stored in `meta.value` and `index`.
 * Roll by updating `meta.value = Math.ceil(Math.random() * sides)`.
 *
 * Useful for Liar's Dice, Yahtzee, etc.
 *
 * @param {number} count         Number of dice.
 * @param {number} [sides=6]     Sides per die.
 * @param {string} [owner='']    Owner prefix for stable IDs (e.g. "alice").
 * @returns {Array<Object>} Array of IToken-compatible plain objects.
 */
export function createDiceSet(count, sides = 6, owner = '') {
  const prefix = owner ? `${owner}-die` : 'die';
  const dice = [];
  for (let i = 0; i < count; i++) {
    dice.push({
      id: `${prefix}-${i}`,
      kind: 'die',
      label: '?',
      text: '?',
      char: '⚄',
      group: owner ? `${owner}-dice` : 'dice',
      index: 1,
      meta: { sides, owner: owner || null, value: 1, rolled: false },
      _tags: ['die'],
    });
  }
  return dice;
}

/**
 * Create role/character cards for games like Coup or Secret Hitler.
 *
 * @param {Object} roles  Map of role name → count. E.g. { Duke: 3, Assassin: 3 }.
 * @param {Object} [opts]
 * @param {Object} [opts.meta]      Extra metadata merged into every token.
 * @param {string} [opts.idPrefix]  Prefix for token IDs (default: "role").
 * @returns {Array<Object>} Array of IToken-compatible plain objects.
 */
export function createRoleDeck(roles, opts = {}) {
  const { meta = {}, idPrefix = 'role' } = opts;
  const tokens = [];
  let idx = 0;
  for (const [role, count] of Object.entries(roles)) {
    for (let i = 0; i < count; i++) {
      tokens.push({
        id: `${idPrefix}-${role}-${i}`,
        kind: role,
        label: role,
        text: role,
        char: role[0].toUpperCase(),
        group: 'roles',
        index: idx,
        meta: { role, copy: i, ...meta },
        _tags: [role.toLowerCase()],
      });
      idx++;
    }
  }
  return tokens;
}
