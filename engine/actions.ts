/*
 * Copyright 2025 The Carpocratian Church of Commonality and Equality, Inc.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

/**
 * ActionRegistry - Complete set of game actions
 */

import { Engine } from "./Engine.js";
// @ts-ignore
import { ExtendedActions } from "./actions-extended.js";
import { IToken } from "../core/types.js";

export type ActionHandler = (engine: Engine, payload: any) => any;

export interface ActionRegistryType {
  [key: string]: ActionHandler;
}

/*━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  BASE ACTIONS (Original 5)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━*/

const BaseActions: ActionRegistryType = {
  /**
   * Shuffle the deck
   */
  "deck:shuffle": (engine: Engine, { seed = null }: { seed?: number | null } = {}) => {
    if (!engine.deck) throw new Error("No deck attached to engine");
    engine.deck.shuffle(seed ?? undefined);
  },
  
  /**
   * Draw N cards from deck
   */
  "deck:draw": (engine: Engine, { count = 1 }: { count?: number } = {}) => {
    if (!engine.deck) throw new Error("No deck attached to engine");
    // Using the overloaded draw method from Deck.ts
    return engine.deck.draw(count);
  },
  
  /**
   * Place a card on the table in a specific zone
   */
  "table:place": (engine: Engine, { zone, card, opts = {} }: { zone: string; card: IToken; opts?: any } = {} as any) => {
    if (!engine.table) throw new Error("No table attached to engine");
    if (!zone) throw new Error("zone required");
    if (!card) throw new Error("card required");
    return engine.table.place(zone, card, opts);
  },
  
  /**
   * Clear all cards from the table
   */
  "table:clear": (engine: Engine) => {
    if (!engine.table) throw new Error("No table attached to engine");
    engine.table.clear();
  },
  
  /**
   * Draw N cards from shoe
   */
  "shoe:draw": (engine: Engine, { count = 1 }: { count?: number } = {}) => {
    if (!engine.shoe) throw new Error("No shoe attached to engine");
    return engine.shoe.draw(count);
  }
};

/*━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  COMPLETE ACTION REGISTRY
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━*/

export const ActionRegistry: ActionRegistryType = {
  ...BaseActions,
  ...(ExtendedActions as any)
};

/*━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  UTILITY FUNCTIONS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━*/

/**
 * List all available action types
 */
export function listActions(): string[] {
  return Object.keys(ActionRegistry).sort();
}

/**
 * List actions by category
 */
export function listActionsByCategory(): Record<string, string[]> {
  const categories: Record<string, string[]> = {
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
 */
export function hasAction(type: string): boolean {
  return type in ActionRegistry;
}

/**
 * Get action handler function
 */
export function getAction(type: string): ActionHandler | null {
  return ActionRegistry[type] || null;
}

/**
 * Register a new custom action
 */
export function registerAction(type: string, handler: ActionHandler): void {
  if (type in ActionRegistry) {
    console.warn(`Action ${type} already exists, overwriting`);
  }
  ActionRegistry[type] = handler;
}

/**
 * Unregister an action
 */
export function unregisterAction(type: string): void {
  delete ActionRegistry[type];
}