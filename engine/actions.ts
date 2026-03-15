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
import { IToken } from "../core/types.js";

export type ActionHandler = (engine: Engine, payload: any) => any;

export interface ActionRegistryType {
  [key: string]: ActionHandler;
}

/*━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  BASE ACTIONS (Original 5)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━*/

/*━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  STACK ACTIONS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━*/

const StackActions: ActionRegistryType = {
  "stack:draw": (engine, { count = 1 } = {}) => {
    if (!engine.stack) throw new Error("No stack attached to engine");
    return engine.stack.draw(count);
  },
  "stack:peek": (engine, { count = 1 } = {}) => {
    if (!engine.stack) throw new Error("No stack attached to engine");
    return engine.stack.tokens.slice(-count).reverse();
  },
  "stack:shuffle": (engine, { seed = null } = {}) => {
    if (!engine.stack) throw new Error("No stack attached to engine");
    engine.stack.shuffle(seed ?? undefined);
  },
  "stack:burn": (engine, { count = 1 } = {}) => {
    if (!engine.stack) throw new Error("No stack attached to engine");
    return engine.stack.burn(count);
  },
  "stack:reset": (engine) => {
    if (!engine.stack) throw new Error("No stack attached to engine");
    engine.stack.reset();
  },
  "stack:cut": (engine, { position = 0 } = {}) => {
    if (!engine.stack) throw new Error("No stack attached to engine");
    engine.stack.cut(position);
  },
  "stack:insertAt": (engine, { position = 0, card } = {} as any) => {
    if (!engine.stack) throw new Error("No stack attached to engine");
    if (!card) throw new Error("card required");
    engine.stack.insertAt(card, position);
  },
  "stack:removeAt": (engine, { position = 0 } = {}) => {
    if (!engine.stack) throw new Error("No stack attached to engine");
    return engine.stack.removeAt(position);
  },
  "stack:swap": (engine, { i, j } = {} as any) => {
    if (!engine.stack) throw new Error("No stack attached to engine");
    engine.stack.swap(i, j);
  },
  "stack:reverse": (engine) => {
    if (!engine.stack) throw new Error("No stack attached to engine");
    engine.stack.reverseRange(0, engine.stack.size - 1);
  },
  "stack:discard": (engine, { card } = {} as any) => {
    if (!engine.stack) throw new Error("No stack attached to engine");
    if (!card) throw new Error("card required");
    return engine.stack.discard(card);
  },
};

/*━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  SPACE ACTIONS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━*/

const SpaceActions: ActionRegistryType = {
  "space:place": (engine, { zone, card, opts = {} } = {} as any) => {
    if (!engine.space) throw new Error("No space attached to engine");
    if (!zone) throw new Error("zone required");
    if (!card) throw new Error("card required");
    return engine.space.place(zone, card, opts);
  },
  "space:remove": (engine, { zone, placementId } = {} as any) => {
    if (!engine.space) throw new Error("No space attached to engine");
    engine.space.remove(zone, placementId);
  },
  "space:move": (engine, { fromZone, toZone, placementId, x, y } = {} as any) => {
    if (!engine.space) throw new Error("No space attached to engine");
    engine.space.move(fromZone, toZone, placementId, { x, y });
  },
  "space:flip": (engine, { zone, placementId, faceUp } = {} as any) => {
    if (!engine.space) throw new Error("No space attached to engine");
    engine.space.flip(zone, placementId, faceUp);
  },
  "space:createZone": (engine, { name, label, x, y } = {} as any) => {
    if (!engine.space) throw new Error("No space attached to engine");
    engine.space.createZone(name, { label, x, y });
  },
  "space:deleteZone": (engine, { name } = {} as any) => {
    if (!engine.space) throw new Error("No space attached to engine");
    engine.space.deleteZone(name);
  },
  "space:clearZone": (engine, { zone } = {} as any) => {
    if (!engine.space) throw new Error("No space attached to engine");
    engine.space.clearZone(zone);
  },
  "space:lockZone": (engine, { zone, locked = true } = {} as any) => {
    if (!engine.space) throw new Error("No space attached to engine");
    engine.space.lockZone(zone, locked);
  },
  "space:shuffleZone": (engine, { zone, seed } = {} as any) => {
    if (!engine.space) throw new Error("No space attached to engine");
    engine.space.shuffleZone(zone, seed);
  },
  "space:fanZone": (engine, { zone, ...opts } = {} as any) => {
    if (!engine.space) throw new Error("No space attached to engine");
    engine.space.fan(zone, opts);
  },
  "space:spreadZone": (engine, { zone, pattern, angleStep, radius } = {} as any) => {
    if (!engine.space) throw new Error("No space attached to engine");
    engine.space.spreadZone(zone, { pattern, angleStep, radius });
  },
  "space:stackZone": (engine, { zone } = {} as any) => {
    if (!engine.space) throw new Error("No space attached to engine");
    engine.space.stackZone(zone);
  },
  "space:transferZone": (engine, { fromZone, toZone } = {} as any) => {
    if (!engine.space) throw new Error("No space attached to engine");
    return engine.space.transferZone(fromZone, toZone);
  },
  "space:clear": (engine) => {
    if (!engine.space) throw new Error("No space attached to engine");
    engine.space.clear();
  },
};

/*━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  SOURCE ACTIONS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━*/

const SourceActions: ActionRegistryType = {
  "source:draw": (engine, { count = 1 } = {}) => {
    if (!engine.source) throw new Error("No source attached to engine");
    return engine.source.draw(count);
  },
  "source:shuffle": (engine, { seed } = {} as any) => {
    if (!engine.source) throw new Error("No source attached to engine");
    engine.source.shuffle(seed);
  },
  "source:burn": (engine, { count = 1 } = {}) => {
    if (!engine.source) throw new Error("No source attached to engine");
    return engine.source.burn(count);
  },
  "source:addStack": (engine, { stack } = {} as any) => {
    if (!engine.source) throw new Error("No source attached to engine");
    if (!stack) throw new Error("stack required");
    engine.source.addStack(stack);
  },
  "source:removeStack": (engine, { stack } = {} as any) => {
    if (!engine.source) throw new Error("No source attached to engine");
    if (!stack) throw new Error("stack required");
    engine.source.removeStack(stack);
  },
  "source:reset": (engine) => {
    if (!engine.source) throw new Error("No source attached to engine");
    engine.source.reset();
  },
  "source:inspect": (engine) => {
    if (!engine.source) throw new Error("No source attached to engine");
    return engine.source.inspect();
  },
};

/*━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  AGENT ACTIONS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━*/

function findAgent(engine: Engine, name: string) {
  const agent = engine._agents.find(a => a.name === name);
  if (!agent) throw new Error(`Agent "${name}" not found`);
  return agent;
}

const AgentActions: ActionRegistryType = {
  "agent:create": (engine, { id, name, meta } = {} as any) => {
    if (!name) throw new Error("name required");
    if (engine._agents.find(a => a.name === name)) throw new Error(`Agent "${name}" already exists`);
    const agent = {
      id: id ?? `agent-${Date.now()}-${Math.random().toString(36).slice(2)}`,
      name,
      meta: meta ?? {},
      active: true,
      resources: {},
      inventory: [],
    };
    engine._agents.push(agent);
    return agent;
  },
  "agent:remove": (engine, { name } = {} as any) => {
    const idx = engine._agents.findIndex(a => a.name === name);
    if (idx === -1) throw new Error(`Agent "${name}" not found`);
    engine._agents.splice(idx, 1);
  },
  "agent:setActive": (engine, { name, active = true } = {} as any) => {
    const agent = findAgent(engine, name);
    agent.active = active;
  },
  "agent:giveResource": (engine, { name, resource, amount = 1 } = {} as any) => {
    const agent = findAgent(engine, name);
    agent.resources[resource] = (agent.resources[resource] || 0) + amount;
  },
  "agent:takeResource": (engine, { name, resource, amount = 1 } = {} as any) => {
    const agent = findAgent(engine, name);
    agent.resources[resource] = (agent.resources[resource] || 0) - amount;
  },
  "agent:addToken": (engine, { name, token } = {} as any) => {
    const agent = findAgent(engine, name);
    agent.inventory.push(token);
  },
  "agent:removeToken": (engine, { name, tokenId } = {} as any) => {
    const agent = findAgent(engine, name);
    const idx = agent.inventory.findIndex((t: IToken) => t.id === tokenId);
    if (idx === -1) throw new Error(`Token "${tokenId}" not found in agent "${name}"`);
    return agent.inventory.splice(idx, 1)[0];
  },
  "agent:get": (engine, { name } = {} as any) => {
    return findAgent(engine, name);
  },
  "agent:getAll": (engine) => {
    return engine._agents;
  },
  "agent:transferResource": (engine, { from, to, resource, amount = 1 } = {} as any) => {
    const src = findAgent(engine, from);
    const dst = findAgent(engine, to);
    src.resources[resource] = (src.resources[resource] || 0) - amount;
    dst.resources[resource] = (dst.resources[resource] || 0) + amount;
    engine._transactions.push({ type: "resource_transfer", from, to, resource, amount, timestamp: Date.now() });
    return { from: src.resources[resource], to: dst.resources[resource] };
  },
  "agent:transferToken": (engine, { from, to, tokenId } = {} as any) => {
    const src = findAgent(engine, from);
    const dst = findAgent(engine, to);
    const idx = src.inventory.findIndex((t: IToken) => t.id === tokenId);
    if (idx === -1) throw new Error(`Token "${tokenId}" not found in agent "${from}"`);
    const [token] = src.inventory.splice(idx, 1);
    dst.inventory.push(token);
    engine._transactions.push({ type: "token_transfer", from, to, token: tokenId, timestamp: Date.now() });
    return token;
  },
  "agent:stealResource": (engine, { from, to, resource, amount = 1 } = {} as any) => {
    const src = findAgent(engine, from);
    const dst = findAgent(engine, to);
    const available = src.resources[resource] || 0;
    const stolen = Math.min(amount, available);
    src.resources[resource] = available - stolen;
    dst.resources[resource] = (dst.resources[resource] || 0) + stolen;
    engine._transactions.push({ type: "steal_resource", from, to, resource, amount: stolen, timestamp: Date.now() });
    return { stolen, from: src.resources[resource], to: dst.resources[resource] };
  },
  "agent:stealToken": (engine, { from, to, tokenId } = {} as any) => {
    const src = findAgent(engine, from);
    const dst = findAgent(engine, to);
    const idx = src.inventory.findIndex((t: IToken) => t.id === tokenId);
    if (idx === -1) throw new Error(`Token "${tokenId}" not found in agent "${from}"`);
    const [token] = src.inventory.splice(idx, 1);
    dst.inventory.push(token);
    engine._transactions.push({ type: "steal_token", from, to, token: tokenId, timestamp: Date.now() });
    return token;
  },
  "agent:trade": (engine, { agent1, agent2, offer1, offer2 } = {} as any) => {
    const a1 = findAgent(engine, agent1);
    const a2 = findAgent(engine, agent2);
    // Execute offer1: agent1 gives to agent2
    if (offer1?.token) {
      const idx = a1.inventory.findIndex((t: IToken) => t.id === offer1.token.id);
      if (idx !== -1) a2.inventory.push(...a1.inventory.splice(idx, 1));
    }
    if (offer1?.resource && offer1?.amount) {
      a1.resources[offer1.resource] = (a1.resources[offer1.resource] || 0) - offer1.amount;
      a2.resources[offer1.resource] = (a2.resources[offer1.resource] || 0) + offer1.amount;
    }
    // Execute offer2: agent2 gives to agent1
    if (offer2?.token) {
      const idx = a2.inventory.findIndex((t: IToken) => t.id === offer2.token.id);
      if (idx !== -1) a1.inventory.push(...a2.inventory.splice(idx, 1));
    }
    if (offer2?.resource && offer2?.amount) {
      a2.resources[offer2.resource] = (a2.resources[offer2.resource] || 0) - offer2.amount;
      a1.resources[offer2.resource] = (a1.resources[offer2.resource] || 0) + offer2.amount;
    }
    engine._transactions.push({ type: "trade", from: agent1, to: agent2, agent1, agent2, offer1, offer2, timestamp: Date.now() });
  },
  "agent:drawCards": (engine, { name, count = 1 } = {} as any) => {
    if (!engine.stack) throw new Error("No stack attached to engine");
    const agent = findAgent(engine, name);
    const drawn = engine.stack.draw(count);
    const cards = Array.isArray(drawn) ? drawn : drawn ? [drawn] : [];
    agent.inventory.push(...cards);
    return cards;
  },
  "agent:discardCards": (engine, { name, tokenIds } = {} as any) => {
    if (!engine.stack) throw new Error("No stack attached to engine");
    const agent = findAgent(engine, name);
    const discarded: IToken[] = [];
    for (const tokenId of (tokenIds || [])) {
      const idx = agent.inventory.findIndex((t: IToken) => t.id === tokenId);
      if (idx !== -1) {
        const [card] = agent.inventory.splice(idx, 1);
        engine.stack.discard(card);
        discarded.push(card);
      }
    }
    return discarded;
  },
};

/*━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  GAME STATE ACTIONS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━*/

const GameActions: ActionRegistryType = {
  "game:start": (engine) => {
    engine._gameState.started = true;
    engine._gameState.startTime = Date.now();
    engine._gameState.ended = false;
    engine._gameState.paused = false;
    engine._gameState.totalPauseDuration = 0;
    engine.emit("game:started", { payload: engine._gameState });
    return engine._gameState;
  },
  "game:end": (engine, { winner, reason } = {}) => {
    engine._gameState.ended = true;
    engine._gameState.endTime = Date.now();
    if (winner) engine._gameState.winner = winner;
    if (reason) engine._gameState.reason = reason;
    engine.emit("game:ended", { payload: engine._gameState });
    return engine._gameState;
  },
  "game:pause": (engine) => {
    engine._gameState.paused = true;
    engine._gameState.pauseTime = Date.now();
    engine.emit("game:paused", { payload: engine._gameState });
    return engine._gameState;
  },
  "game:resume": (engine) => {
    if (engine._gameState.pauseTime) {
      engine._gameState.totalPauseDuration = (engine._gameState.totalPauseDuration || 0) + (Date.now() - engine._gameState.pauseTime);
    }
    engine._gameState.paused = false;
    engine._gameState.resumeTime = Date.now();
    engine.emit("game:resumed", { payload: engine._gameState });
    return engine._gameState;
  },
  "game:nextPhase": (engine, { phase } = {} as any) => {
    engine._gameState.phase = phase;
    engine._gameState.turn = (engine._gameState.turn || 0) + 1;
    engine.emit("game:phaseChanged", { payload: { phase, turn: engine._gameState.turn } });
    return engine._gameState;
  },
  "game:setProperty": (engine, { key, value } = {} as any) => {
    if (!key) throw new Error("key required");
    engine._gameState[key] = value;
    return engine._gameState;
  },
  "game:getState": (engine) => {
    return engine._gameState;
  },
};

/*━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  TOKEN OPERATIONS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━*/

const TokenActions: ActionRegistryType = {
  "token:transform": (engine, { token, properties = {} } = {} as any) => {
    if (!token) throw new Error("token required");
    return { ...token, ...properties, _transformedFrom: token.id };
  },
  "token:attach": (engine, { host, attachment, attachmentType = "default" } = {} as any) => {
    if (!host || !attachment) throw new Error("host and attachment required");
    const attachments = [...(host._attachments || []), { ...attachment, _attachmentType: attachmentType }];
    return { ...host, _attachments: attachments };
  },
  "token:detach": (engine, { host, attachmentId } = {} as any) => {
    if (!host) throw new Error("host required");
    const attachments = (host._attachments || []).filter((a: any) => a.id !== attachmentId);
    return { ...host, _attachments: attachments };
  },
  "token:merge": (engine, { tokens, properties, keepOriginals = false } = {} as any) => {
    if (!tokens || tokens.length < 2) throw new Error("At least 2 tokens required to merge");
    const merged = {
      id: `merged-${Date.now()}-${Math.random().toString(36).slice(2)}`,
      ...Object.assign({}, ...tokens),
      ...(properties || {}),
      _mergedFrom: tokens.map((t: IToken) => t.id),
    };
    return { merged, originals: keepOriginals ? tokens : undefined };
  },
  "token:split": (engine, { token, count = 2, propertiesArray } = {} as any) => {
    if (!token) throw new Error("token required");
    const parts: any[] = [];
    for (let i = 0; i < count; i++) {
      parts.push({
        ...token,
        id: `split-${Date.now()}-${i}-${Math.random().toString(36).slice(2)}`,
        ...(propertiesArray?.[i] || {}),
        _splitFrom: token.id,
      });
    }
    return parts;
  },
};

/*━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  DEBUG
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━*/

const DebugActions: ActionRegistryType = {
  "debug:log": (engine, payload) => {
    if (engine.debug) console.log("[debug:log]", payload);
    return payload;
  },
};

/*━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  COMPLETE ACTION REGISTRY
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━*/

export const ActionRegistry: ActionRegistryType = {
  ...StackActions,
  ...SpaceActions,
  ...SourceActions,
  ...AgentActions,
  ...GameActions,
  ...TokenActions,
  ...DebugActions,
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