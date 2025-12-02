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
// @ts-ignore
import { ExtendedActions } from "./actions-extended.js";
/*━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  BASE ACTIONS (Original 5)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━*/
const BaseActions = {
    /**
     * Shuffle the stack
     */
    "stack:shuffle": (engine, { seed = null } = {}) => {
        if (!engine.stack)
            throw new Error("No stack attached to engine");
        engine.stack.shuffle(seed ?? undefined);
    },
    /**
     * Draw N cards from stack
     */
    "stack:draw": (engine, { count = 1 } = {}) => {
        if (!engine.stack)
            throw new Error("No stack attached to engine");
        // Using the overloaded draw method from stack.ts
        return engine.stack.draw(count);
    },
    /**
     * Place a card on the space in a specific zone
     */
    "space:place": (engine, { zone, card, opts = {} } = {}) => {
        if (!engine.space)
            throw new Error("No space attached to engine");
        if (!zone)
            throw new Error("zone required");
        if (!card)
            throw new Error("card required");
        return engine.space.place(zone, card, opts);
    },
    /**
     * Clear all cards from the space
     */
    "space:clear": (engine) => {
        if (!engine.space)
            throw new Error("No space attached to engine");
        engine.space.clear();
    },
    /**
     * Draw N cards from source
     */
    "source:draw": (engine, { count = 1 } = {}) => {
        if (!engine.source)
            throw new Error("No source attached to engine");
        return engine.source.draw(count);
    }
};
/*━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  COMPLETE ACTION REGISTRY
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━*/
export const ActionRegistry = {
    ...BaseActions,
    ...ExtendedActions
};
/*━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  UTILITY FUNCTIONS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━*/
/**
 * List all available action types
 */
export function listActions() {
    return Object.keys(ActionRegistry).sort();
}
/**
 * List actions by category
 */
export function listActionsByCategory() {
    const categories = {
        stack: [],
        space: [],
        source: [],
        agent: [],
        game: [],
        other: []
    };
    for (const key of Object.keys(ActionRegistry)) {
        const [category] = key.split(':');
        if (categories[category]) {
            categories[category].push(key);
        }
        else {
            categories.other.push(key);
        }
    }
    return categories;
}
/**
 * Check if an action exists
 */
export function hasAction(type) {
    return type in ActionRegistry;
}
/**
 * Get action handler function
 */
export function getAction(type) {
    return ActionRegistry[type] || null;
}
/**
 * Register a new custom action
 */
export function registerAction(type, handler) {
    if (type in ActionRegistry) {
        console.warn(`Action ${type} already exists, overwriting`);
    }
    ActionRegistry[type] = handler;
}
/**
 * Unregister an action
 */
export function unregisterAction(type) {
    delete ActionRegistry[type];
}
