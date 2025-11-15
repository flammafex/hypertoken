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
 * ActionRegistry - Complete set of game actions
 * 
 * This module provides 45 actions covering all common game operations:
 * 
 * DECK (10 actions):
 *   deck:shuffle, deck:draw, deck:reset, deck:burn, deck:peek, 
 *   deck:cut, deck:insertAt, deck:removeAt, deck:swap, deck:reverse
 * 
 * TABLE (14 actions):
 *   table:place, table:clear, table:move, table:flip, table:remove,
 *   table:createZone, table:deleteZone, table:clearZone, table:shuffleZone,
 *   table:transferZone, table:fanZone, table:stackZone, table:spreadZone,
 *   table:lockZone
 * 
 * SHOE (7 actions):
 *   shoe:draw, shoe:shuffle, shoe:burn, shoe:reset, shoe:addDeck,
 *   shoe:removeDeck, shoe:inspect
 * 
 * PLAYER (8 actions):
 *   player:create, player:remove, player:setActive, player:giveResource,
 *   player:takeResource, player:drawCards, player:discardCards, player:get
 * 
 * GAME (6 actions):
 *   game:start, game:end, game:pause, game:resume, game:nextPhase,
 *   game:setProperty
 */

import { ExtendedActions } from './actions-extended.js';

/*━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  BASE ACTIONS (Original 5)
  These are the minimal actions that were originally in HyperToken
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━*/

const BaseActions = {
  /**
   * Shuffle the deck
   * Usage: engine.dispatch("deck:shuffle", { seed: 42 })
   */
  "deck:shuffle": (engine, { seed = null } = {}) => {
    if (!engine.deck) throw new Error("No deck attached to engine");
    engine.deck.shuffle(seed);
  },
  
  /**
   * Draw N cards from deck
   * Usage: engine.dispatch("deck:draw", { count: 5 })
   */
  "deck:draw": (engine, { count = 1 } = {}) => {
    if (!engine.deck) throw new Error("No deck attached to engine");
    return engine.deck.drawMany ? engine.deck.drawMany(count) : [engine.deck.draw()];
  },
  
  /**
   * Place a card on the table in a specific zone
   * Usage: engine.dispatch("table:place", { 
   *   zone: "field", 
   *   card: myCard, 
   *   opts: { faceUp: true, x: 100, y: 200 } 
   * })
   */
  "table:place": (engine, { zone, card, opts = {} } = {}) => {
    if (!engine.table) throw new Error("No table attached to engine");
    if (!zone) throw new Error("zone required");
    if (!card) throw new Error("card required");
    return engine.table.place(zone, card, opts);
  },
  
  /**
   * Clear all cards from the table
   * Usage: engine.dispatch("table:clear")
   */
  "table:clear": (engine) => {
    if (!engine.table) throw new Error("No table attached to engine");
    engine.table.clear();
  },
  
  /**
   * Draw N cards from shoe
   * Usage: engine.dispatch("shoe:draw", { count: 1 })
   */
  "shoe:draw": (engine, { count = 1 } = {}) => {
    if (!engine.shoe) throw new Error("No shoe attached to engine");
    return engine.shoe.draw(count);
  }
};

/*━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  COMPLETE ACTION REGISTRY
  Base actions + Extended actions = 45 total actions
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━*/

export const ActionRegistry = {
  ...BaseActions,
  ...ExtendedActions
};

/*━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  UTILITY FUNCTIONS
  Helpers for working with actions
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━*/

/**
 * List all available action types
 * @returns {Array<string>} Array of action type strings
 */
export function listActions() {
  return Object.keys(ActionRegistry).sort();
}

/**
 * List actions by category
 * @returns {Object} Actions grouped by category (deck, table, shoe, player, game)
 */
export function listActionsByCategory() {
  const categories = {
    deck: [],
    table: [],
    shoe: [],
    player: [],
    game: [],
    other: []
  };
  
  for (const key of Object.keys(ActionRegistry)) {
    const [category] = key.split(':');
    if (categories[category]) {
      categories[category].push(key);
    } else {
      categories.other.push(key);
    }
  }
  
  return categories;
}

/**
 * Check if an action exists
 * @param {string} type - Action type to check
 * @returns {boolean}
 */
export function hasAction(type) {
  return type in ActionRegistry;
}

/**
 * Get action handler function
 * @param {string} type - Action type
 * @returns {Function|null} Handler function or null if not found
 */
export function getAction(type) {
  return ActionRegistry[type] || null;
}

/**
 * Register a new custom action
 * @param {string} type - Action type (e.g. "mygame:custom")
 * @param {Function} handler - Action handler function(engine, payload)
 */
export function registerAction(type, handler) {
  if (type in ActionRegistry) {
    console.warn(`Action ${type} already exists, overwriting`);
  }
  ActionRegistry[type] = handler;
}

/**
 * Unregister an action
 * @param {string} type - Action type to remove
 */
export function unregisterAction(type) {
  delete ActionRegistry[type];
}