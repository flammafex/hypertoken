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
import { shuffleArray } from "../core/random.js";
import type { IEngineAgent } from "./types.js";
import type {
  StackInsertAtPayload, StackSwapPayload, StackDiscardPayload,
  SpacePlacePayload, SpaceRemovePayload, SpaceMovePayload, SpaceFlipPayload,
  SpaceCreateZonePayload, SpaceDeleteZonePayload, SpaceClearZonePayload,
  SpaceLockZonePayload, SpaceShuffleZonePayload, SpaceFanZonePayload,
  SpaceSpreadZonePayload, SpaceStackZonePayload, SpaceTransferZonePayload,
  SourceShufflePayload, SourceAddStackPayload, SourceRemoveStackPayload,
  AgentCreatePayload, AgentRemovePayload, AgentSetActivePayload,
  AgentGiveResourcePayload, AgentTakeResourcePayload,
  AgentAddTokenPayload, AgentRemoveTokenPayload, AgentGetPayload,
  AgentTransferResourcePayload, AgentTransferTokenPayload,
  AgentStealResourcePayload, AgentStealTokenPayload,
  AgentTradePayload, AgentDrawCardsPayload, AgentDiscardCardsPayload, AgentSetMetaPayload,
  GameNextPhasePayload, GameSetPropertyPayload, GameMergeStatePayload, GameSetStatePayload,
  GameLoopInitPayload, GameLoopStopPayload, GameNextTurnPayload,
  GameSetPhasePayload, GameSetMaxTurnsPayload, GameSetActiveAgentPayload,
  RuleMarkFiredPayload,
  TokenTransformPayload, TokenAttachPayload, TokenDetachPayload,
  TokenMergePayload, TokenSplitPayload,
} from "./payloads.js";

export type ActionHandler = (engine: Engine, payload?: any) => unknown;

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
  "stack:insertAt": (engine, { position = 0, card } = {} as StackInsertAtPayload) => {
    if (!engine.stack) throw new Error("No stack attached to engine");
    if (!card) throw new Error("card required");
    engine.stack.insertAt(card, position);
  },
  "stack:removeAt": (engine, { position = 0 } = {}) => {
    if (!engine.stack) throw new Error("No stack attached to engine");
    return engine.stack.removeAt(position);
  },
  "stack:swap": (engine, { i, j } = {} as StackSwapPayload) => {
    if (!engine.stack) throw new Error("No stack attached to engine");
    engine.stack.swap(i, j);
  },
  "stack:reverse": (engine) => {
    if (!engine.stack) throw new Error("No stack attached to engine");
    engine.stack.reverseRange(0, engine.stack.size - 1);
  },
  "stack:discard": (engine, { card } = {} as StackDiscardPayload) => {
    if (!engine.stack) throw new Error("No stack attached to engine");
    if (!card) throw new Error("card required");
    return engine.stack.discard(card);
  },
};

/*━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  SPACE ACTIONS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━*/

const SpaceActions: ActionRegistryType = {
  "space:place": (engine, { zone, card, opts = {} } = {} as SpacePlacePayload) => {
    if (!engine.space) throw new Error("No space attached to engine");
    if (!zone) throw new Error("zone required");
    if (!card) throw new Error("card required");
    return engine.space.place(zone, card, opts);
  },
  "space:remove": (engine, { zone, placementId } = {} as SpaceRemovePayload) => {
    if (!engine.space) throw new Error("No space attached to engine");
    engine.space.remove(zone, placementId);
  },
  "space:move": (engine, { fromZone, toZone, placementId, x, y } = {} as SpaceMovePayload) => {
    if (!engine.space) throw new Error("No space attached to engine");
    engine.space.move(fromZone, toZone, placementId, { x, y });
  },
  "space:flip": (engine, { zone, placementId, faceUp } = {} as SpaceFlipPayload) => {
    if (!engine.space) throw new Error("No space attached to engine");
    engine.space.flip(zone, placementId, faceUp);
  },
  "space:createZone": (engine, { name, label, x, y } = {} as SpaceCreateZonePayload) => {
    if (!engine.space) throw new Error("No space attached to engine");
    engine.space.createZone(name, { label, x, y });
  },
  "space:deleteZone": (engine, { name } = {} as SpaceDeleteZonePayload) => {
    if (!engine.space) throw new Error("No space attached to engine");
    engine.space.deleteZone(name);
  },
  "space:clearZone": (engine, { zone } = {} as SpaceClearZonePayload) => {
    if (!engine.space) throw new Error("No space attached to engine");
    engine.space.clearZone(zone);
  },
  "space:lockZone": (engine, { zone, locked = true } = {} as SpaceLockZonePayload) => {
    if (!engine.space) throw new Error("No space attached to engine");
    engine.space.lockZone(zone, locked);
  },
  "space:shuffleZone": (engine, { zone, seed } = {} as SpaceShuffleZonePayload) => {
    if (!engine.space) throw new Error("No space attached to engine");
    engine.space.shuffleZone(zone, seed);
  },
  "space:fanZone": (engine, { zone, ...opts } = {} as SpaceFanZonePayload) => {
    if (!engine.space) throw new Error("No space attached to engine");
    engine.space.fan(zone, opts);
  },
  "space:spreadZone": (engine, { zone, pattern, angleStep, radius } = {} as SpaceSpreadZonePayload) => {
    if (!engine.space) throw new Error("No space attached to engine");
    engine.space.spreadZone(zone, { pattern, angleStep, radius });
  },
  "space:stackZone": (engine, { zone } = {} as SpaceStackZonePayload) => {
    if (!engine.space) throw new Error("No space attached to engine");
    engine.space.stackZone(zone);
  },
  "space:transferZone": (engine, { fromZone, toZone } = {} as SpaceTransferZonePayload) => {
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
  "source:shuffle": (engine, { seed } = {} as SourceShufflePayload) => {
    if (!engine.source) throw new Error("No source attached to engine");
    engine.source.shuffle(seed);
  },
  "source:burn": (engine, { count = 1 } = {}) => {
    if (!engine.source) throw new Error("No source attached to engine");
    return engine.source.burn(count);
  },
  "source:addStack": (engine, { stack } = {} as SourceAddStackPayload) => {
    if (!engine.source) throw new Error("No source attached to engine");
    if (!stack) throw new Error("stack required");
    engine.source.addStack(stack);
  },
  "source:removeStack": (engine, { stack } = {} as SourceRemoveStackPayload) => {
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

function getAgentMap(engine: Engine): Record<string, IEngineAgent> {
  return (engine.session.state as any).agents ?? {};
}

function findAgent(engine: Engine, name: string): IEngineAgent {
  const agent = getAgentMap(engine)[name];
  if (!agent) throw new Error(`Agent "${name}" not found`);
  return agent;
}

const AgentActions: ActionRegistryType = {
  "agent:create": (engine, { id, name, meta } = {} as AgentCreatePayload) => {
    if (!name) throw new Error("name required");
    if (getAgentMap(engine)[name]) throw new Error(`Agent "${name}" already exists`);
    const agent: IEngineAgent = {
      id: id ?? `agent-${Date.now()}-${Math.random().toString(36).slice(2)}`,
      name,
      meta: meta ?? {},
      active: true,
      resources: {},
      inventory: [],
    };
    engine.session.change("agent:create", (doc: any) => {
      if (!doc.agents) doc.agents = {};
      doc.agents[name] = agent;
    });
    return agent;
  },
  "agent:remove": (engine, { name } = {} as AgentRemovePayload) => {
    if (!getAgentMap(engine)[name]) throw new Error(`Agent "${name}" not found`);
    engine.session.change("agent:remove", (doc: any) => {
      if (doc.agents) delete doc.agents[name];
    });
  },
  "agent:setActive": (engine, { name, active = true } = {} as AgentSetActivePayload) => {
    findAgent(engine, name); // validate existence
    engine.session.change("agent:setActive", (doc: any) => {
      if (doc.agents?.[name]) doc.agents[name].active = active;
    });
  },
  "agent:giveResource": (engine, { name, resource, amount = 1 } = {} as AgentGiveResourcePayload) => {
    findAgent(engine, name); // validate existence
    engine.session.change("agent:giveResource", (doc: any) => {
      if (!doc.agents?.[name]) return;
      if (!doc.agents[name].resources) doc.agents[name].resources = {};
      doc.agents[name].resources[resource] = (doc.agents[name].resources[resource] ?? 0) + amount;
    });
  },
  "agent:takeResource": (engine, { name, resource, amount = 1 } = {} as AgentTakeResourcePayload) => {
    findAgent(engine, name); // validate existence
    engine.session.change("agent:takeResource", (doc: any) => {
      if (!doc.agents?.[name]) return;
      if (!doc.agents[name].resources) doc.agents[name].resources = {};
      doc.agents[name].resources[resource] = (doc.agents[name].resources[resource] ?? 0) - amount;
    });
  },
  "agent:addToken": (engine, { name, token } = {} as AgentAddTokenPayload) => {
    findAgent(engine, name); // validate existence
    engine.session.change("agent:addToken", (doc: any) => {
      if (!doc.agents?.[name]) return;
      if (!doc.agents[name].inventory) doc.agents[name].inventory = [];
      doc.agents[name].inventory.push(token);
    });
  },
  "agent:removeToken": (engine, { name, tokenId } = {} as AgentRemoveTokenPayload) => {
    const agent = findAgent(engine, name);
    const idx = (agent.inventory ?? []).findIndex((t: IToken) => t.id === tokenId);
    if (idx === -1) throw new Error(`Token "${tokenId}" not found in agent "${name}"`);
    const removed = agent.inventory[idx];
    engine.session.change("agent:removeToken", (doc: any) => {
      if (!doc.agents?.[name]?.inventory) return;
      const i = doc.agents[name].inventory.findIndex((t: IToken) => t.id === tokenId);
      if (i !== -1) doc.agents[name].inventory.splice(i, 1);
    });
    return removed;
  },
  "agent:get": (engine, { name } = {} as AgentGetPayload) => {
    return findAgent(engine, name);
  },
  "agent:getAll": (engine) => {
    return engine._agents;
  },
  "agent:transferResource": (engine, { from, to, resource, amount = 1 } = {} as AgentTransferResourcePayload) => {
    findAgent(engine, from);
    findAgent(engine, to);
    engine.session.change("agent:transferResource", (doc: any) => {
      if (!doc.agents) return;
      if (!doc.agents[from].resources) doc.agents[from].resources = {};
      if (!doc.agents[to].resources) doc.agents[to].resources = {};
      doc.agents[from].resources[resource] = (doc.agents[from].resources[resource] ?? 0) - amount;
      doc.agents[to].resources[resource] = (doc.agents[to].resources[resource] ?? 0) + amount;
      if (!doc.transactions) doc.transactions = [];
      doc.transactions.push({ type: "resource_transfer", from, to, resource, amount, timestamp: Date.now() });
    });
    const state = (engine.session.state as any);
    return {
      from: state.agents?.[from]?.resources?.[resource] ?? 0,
      to: state.agents?.[to]?.resources?.[resource] ?? 0,
    };
  },
  "agent:transferToken": (engine, { from, to, tokenId } = {} as AgentTransferTokenPayload) => {
    const src = findAgent(engine, from);
    findAgent(engine, to);
    const idx = (src.inventory ?? []).findIndex((t: IToken) => t.id === tokenId);
    if (idx === -1) throw new Error(`Token "${tokenId}" not found in agent "${from}"`);
    const token = src.inventory[idx];
    engine.session.change("agent:transferToken", (doc: any) => {
      if (!doc.agents) return;
      const i = doc.agents[from].inventory.findIndex((t: IToken) => t.id === tokenId);
      if (i !== -1) {
        const [moved] = doc.agents[from].inventory.splice(i, 1);
        if (!doc.agents[to].inventory) doc.agents[to].inventory = [];
        doc.agents[to].inventory.push(moved);
      }
      if (!doc.transactions) doc.transactions = [];
      doc.transactions.push({ type: "token_transfer", from, to, token: tokenId, timestamp: Date.now() });
    });
    return token;
  },
  "agent:stealResource": (engine, { from, to, resource, amount = 1 } = {} as AgentStealResourcePayload) => {
    const src = findAgent(engine, from);
    findAgent(engine, to);
    const available = src.resources?.[resource] ?? 0;
    const stolen = Math.min(amount, available);
    engine.session.change("agent:stealResource", (doc: any) => {
      if (!doc.agents) return;
      if (!doc.agents[from].resources) doc.agents[from].resources = {};
      if (!doc.agents[to].resources) doc.agents[to].resources = {};
      doc.agents[from].resources[resource] = available - stolen;
      doc.agents[to].resources[resource] = (doc.agents[to].resources[resource] ?? 0) + stolen;
      if (!doc.transactions) doc.transactions = [];
      doc.transactions.push({ type: "steal_resource", from, to, resource, amount: stolen, timestamp: Date.now() });
    });
    const state = (engine.session.state as any);
    return {
      stolen,
      from: state.agents?.[from]?.resources?.[resource] ?? 0,
      to: state.agents?.[to]?.resources?.[resource] ?? 0,
    };
  },
  "agent:stealToken": (engine, { from, to, tokenId } = {} as AgentStealTokenPayload) => {
    const src = findAgent(engine, from);
    findAgent(engine, to);
    const idx = (src.inventory ?? []).findIndex((t: IToken) => t.id === tokenId);
    if (idx === -1) throw new Error(`Token "${tokenId}" not found in agent "${from}"`);
    const token = src.inventory[idx];
    engine.session.change("agent:stealToken", (doc: any) => {
      if (!doc.agents) return;
      const i = doc.agents[from].inventory.findIndex((t: IToken) => t.id === tokenId);
      if (i !== -1) {
        const [moved] = doc.agents[from].inventory.splice(i, 1);
        if (!doc.agents[to].inventory) doc.agents[to].inventory = [];
        doc.agents[to].inventory.push(moved);
      }
      if (!doc.transactions) doc.transactions = [];
      doc.transactions.push({ type: "steal_token", from, to, token: tokenId, timestamp: Date.now() });
    });
    return token;
  },
  "agent:trade": (engine, { agent1, agent2, offer1, offer2 } = {} as AgentTradePayload) => {
    findAgent(engine, agent1);
    findAgent(engine, agent2);
    engine.session.change("agent:trade", (doc: any) => {
      if (!doc.agents) return;
      const a1 = doc.agents[agent1];
      const a2 = doc.agents[agent2];
      if (!a1.inventory) a1.inventory = [];
      if (!a2.inventory) a2.inventory = [];
      if (!a1.resources) a1.resources = {};
      if (!a2.resources) a2.resources = {};
      // Execute offer1: agent1 gives to agent2
      if (offer1?.token) {
        const idx = a1.inventory.findIndex((t: IToken) => t.id === offer1.token.id);
        if (idx !== -1) a2.inventory.push(...a1.inventory.splice(idx, 1));
      }
      if (offer1?.resource && offer1?.amount) {
        a1.resources[offer1.resource] = (a1.resources[offer1.resource] ?? 0) - offer1.amount;
        a2.resources[offer1.resource] = (a2.resources[offer1.resource] ?? 0) + offer1.amount;
      }
      // Execute offer2: agent2 gives to agent1
      if (offer2?.token) {
        const idx = a2.inventory.findIndex((t: IToken) => t.id === offer2.token.id);
        if (idx !== -1) a1.inventory.push(...a2.inventory.splice(idx, 1));
      }
      if (offer2?.resource && offer2?.amount) {
        a2.resources[offer2.resource] = (a2.resources[offer2.resource] ?? 0) - offer2.amount;
        a1.resources[offer2.resource] = (a1.resources[offer2.resource] ?? 0) + offer2.amount;
      }
      if (!doc.transactions) doc.transactions = [];
      doc.transactions.push({ type: "trade", from: agent1, to: agent2, agent1, agent2, offer1, offer2, timestamp: Date.now() });
    });
  },
  "agent:drawCards": (engine, { name, count = 1 } = {} as AgentDrawCardsPayload) => {
    if (!engine.stack) throw new Error("No stack attached to engine");
    findAgent(engine, name); // validate existence
    const drawn = engine.stack.draw(count);
    const cards = Array.isArray(drawn) ? drawn : drawn ? [drawn] : [];
    engine.session.change("agent:drawCards", (doc: any) => {
      if (!doc.agents?.[name]) return;
      if (!doc.agents[name].inventory) doc.agents[name].inventory = [];
      doc.agents[name].inventory.push(...cards);
    });
    return cards;
  },
  "agent:setMeta": (engine, { name, key, value } = {} as AgentSetMetaPayload) => {
    if (!key) throw new Error("key required");
    findAgent(engine, name); // validate existence
    engine.session.change("agent:setMeta", (doc: any) => {
      if (!doc.agents?.[name]) return;
      if (!doc.agents[name].meta) doc.agents[name].meta = {};
      doc.agents[name].meta[key] = value;
    });
  },
  "agent:discardCards": (engine, { name, tokenIds } = {} as AgentDiscardCardsPayload) => {
    if (!engine.stack) throw new Error("No stack attached to engine");
    const agent = findAgent(engine, name);
    const discarded: IToken[] = [];
    for (const tokenId of (tokenIds || [])) {
      const idx = (agent.inventory ?? []).findIndex((t: IToken) => t.id === tokenId);
      if (idx !== -1) discarded.push(agent.inventory[idx]);
    }
    if (discarded.length > 0) {
      const discardedIds = new Set(discarded.map((t: IToken) => t.id));
      engine.session.change("agent:discardCards", (doc: any) => {
        if (!doc.agents?.[name]?.inventory) return;
        doc.agents[name].inventory = doc.agents[name].inventory.filter((t: IToken) => !discardedIds.has(t.id));
      });
      for (const card of discarded) engine.stack.discard(card);
    }
    return discarded;
  },
};

/*━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  GAME STATE ACTIONS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━*/

const GameActions: ActionRegistryType = {
  "game:start": (engine) => {
    engine.session.change("game:start", (doc: any) => {
      if (!doc.gameState) doc.gameState = {};
      doc.gameState.started = true;
      doc.gameState.startTime = Date.now();
      doc.gameState.ended = false;
      doc.gameState.paused = false;
      doc.gameState.totalPauseDuration = 0;
    });
    engine.emit("game:started", { payload: engine._gameState });
    return engine._gameState;
  },
  "game:end": (engine, { winner, reason } = {}) => {
    engine.session.change("game:end", (doc: any) => {
      if (!doc.gameState) doc.gameState = {};
      doc.gameState.ended = true;
      doc.gameState.endTime = Date.now();
      if (winner) doc.gameState.winner = winner;
      if (reason) doc.gameState.reason = reason;
    });
    engine.emit("game:ended", { payload: engine._gameState });
    return engine._gameState;
  },
  "game:pause": (engine) => {
    engine.session.change("game:pause", (doc: any) => {
      if (!doc.gameState) doc.gameState = {};
      doc.gameState.paused = true;
      doc.gameState.pauseTime = Date.now();
    });
    engine.emit("game:paused", { payload: engine._gameState });
    return engine._gameState;
  },
  "game:resume": (engine) => {
    engine.session.change("game:resume", (doc: any) => {
      if (!doc.gameState) doc.gameState = {};
      if (doc.gameState.pauseTime) {
        doc.gameState.totalPauseDuration = (doc.gameState.totalPauseDuration ?? 0) + (Date.now() - doc.gameState.pauseTime);
      }
      doc.gameState.paused = false;
      doc.gameState.resumeTime = Date.now();
    });
    engine.emit("game:resumed", { payload: engine._gameState });
    return engine._gameState;
  },
  "game:nextPhase": (engine, { phase } = {} as GameNextPhasePayload) => {
    engine.session.change("game:nextPhase", (doc: any) => {
      if (!doc.gameState) doc.gameState = {};
      doc.gameState.phase = phase;
      doc.gameState.turn = (doc.gameState.turn ?? 0) + 1;
    });
    engine.emit("game:phaseChanged", { payload: { phase, turn: engine._gameState.turn } });
    return engine._gameState;
  },
  "game:setProperty": (engine, { key, value } = {} as GameSetPropertyPayload) => {
    if (!key) throw new Error("key required");
    engine.session.change("game:setProperty", (doc: any) => {
      if (!doc.gameState) doc.gameState = {};
      doc.gameState[key] = value;
    });
    return engine._gameState;
  },
  "game:mergeState": (engine, { state } = {} as GameMergeStatePayload) => {
    if (!state || typeof state !== "object") throw new Error("state object required");
    engine.session.change("game:mergeState", (doc: any) => {
      if (!doc.gameState) doc.gameState = {};
      Object.assign(doc.gameState, state);
    });
    return engine._gameState;
  },
  /**
   * game:setState — generic game-state writer. Lets game code write game-specific
   * top-level state keys (e.g. doc.watershed, doc.cuttle) and nested field-level
   * writes through engine.dispatch() instead of raw session.change(). TS-only:
   * no WASM counterpart; routes through the ActionRegistry fallback.
   */
  "game:setState": (engine, { key, value, replace, patches } = {} as GameSetStatePayload) => {
    if (typeof key !== "string" || !key) throw new Error("key required");
    if (value === undefined && !patches) throw new Error("value or patches required");
    if (value !== undefined && patches) throw new Error("use either value or patches, not both");
    if (replace && patches) throw new Error("replace is only valid with value");
    if (patches && (!Array.isArray(patches) || patches.length === 0)) throw new Error("patches must be a non-empty array");
    if (patches) {
      for (const p of patches) {
        if (!Array.isArray(p.path) || p.path.length === 0 || !p.path.every((seg: string) => typeof seg === "string")) {
          throw new Error("each patch needs a non-empty string path");
        }
        if (p.value === undefined) throw new Error("patch value required");
      }
    }
    // JSON.sanitize centrally: strips undefined members Automerge rejects.
    const sanitize = (v: any): any => {
      if (JSON.stringify(v) === undefined) throw new Error("value must be JSON-serializable");
      return JSON.parse(JSON.stringify(v));
    };
    const sValue = value !== undefined ? sanitize(value) : undefined;
    const sPatches = patches ? patches.map((p: { path: string[]; value: any }) => ({ path: p.path, value: sanitize(p.value) })) : undefined;
    engine.session.change("game:setState", (doc: any) => {
      if (sPatches) {
        if (!doc[key]) doc[key] = {};
        const root = doc[key];
        for (const p of sPatches) {
          let cur = root;
          for (const seg of p.path.slice(0, -1)) {
            if (!cur[seg]) cur[seg] = {};
            cur = cur[seg];
          }
          cur[p.path[p.path.length - 1]] = p.value;
        }
      } else if (replace || !doc[key]) {
        doc[key] = sValue;
      } else {
        Object.assign(doc[key], sValue);
      }
    });
    return (engine.session.state as any)?.[key];
  },
  "game:getState": (engine) => {
    return engine._gameState;
  },
};

/*━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  GAME LOOP ACTIONS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━*/

const GameLoopActions: ActionRegistryType = {
  "game:loopInit": (engine, { maxTurns = 100 } = {} as GameLoopInitPayload) => {
    engine.session.change("init loop", (doc: any) => {
      doc.gameLoop = {
        turn: 0, running: false, activeAgentIndex: -1,
        phase: "setup", maxTurns,
      };
    });
  },
  "game:loopStart": (engine) => {
    engine.session.change("start loop", (doc: any) => {
      if (doc.gameLoop) {
        doc.gameLoop.running = true;
        doc.gameLoop.turn = 0;
        doc.gameLoop.phase = "play";
        doc.gameLoop.activeAgentIndex = 0;
      }
    });
  },
  "game:loopStop": (engine, { phase = "stopped" } = {} as GameLoopStopPayload) => {
    engine.session.change("stop loop", (doc: any) => {
      if (doc.gameLoop) {
        doc.gameLoop.running = false;
        doc.gameLoop.phase = phase;
      }
    });
  },
  "game:nextTurn": (engine, { agentCount = 0 } = {} as GameNextTurnPayload) => {
    engine.session.change("next turn", (doc: any) => {
      if (!doc.gameLoop) return;
      doc.gameLoop.turn++;
      doc.gameLoop.activeAgentIndex = agentCount > 0
        ? (doc.gameLoop.activeAgentIndex + 1) % agentCount
        : 0;
    });
  },
  "game:setPhase": (engine, { phase } = {} as GameSetPhasePayload) => {
    engine.session.change("set phase", (doc: any) => {
      if (doc.gameLoop) doc.gameLoop.phase = phase;
    });
  },
  "game:setMaxTurns": (engine, { maxTurns } = {} as GameSetMaxTurnsPayload) => {
    engine.session.change("set maxTurns", (doc: any) => {
      if (doc.gameLoop) doc.gameLoop.maxTurns = maxTurns;
    });
  },
  "game:setActiveAgent": (engine, { index } = {} as GameSetActiveAgentPayload) => {
    engine.session.change("set active agent", (doc: any) => {
      if (doc.gameLoop) doc.gameLoop.activeAgentIndex = index;
    });
  },
};

/*━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  RULE ACTIONS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━*/

const RuleActions: ActionRegistryType = {
  "rule:markFired": (engine, { name, timestamp } = {} as RuleMarkFiredPayload) => {
    engine.session.change("mark fired", (doc: any) => {
      if (doc.rules) doc.rules.fired[name] = timestamp ?? Date.now();
    });
  },
  "rule:initRules": (engine) => {
    engine.session.change("init rules", (doc: any) => {
      doc.rules = { fired: {} };
    });
  },
};

/*━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  TOKEN OPERATIONS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━*/

const TokenActions: ActionRegistryType = {
  "token:transform": (engine, { token, properties = {} } = {} as TokenTransformPayload) => {
    if (!token) throw new Error("token required");
    return { ...token, ...properties, _transformedFrom: token.id };
  },
  "token:attach": (engine, { host, attachment, attachmentType = "default" } = {} as TokenAttachPayload) => {
    if (!host || !attachment) throw new Error("host and attachment required");
    const attachments = [...(host._attachments || []), { ...attachment, _attachmentType: attachmentType }];
    return { ...host, _attachments: attachments };
  },
  "token:detach": (engine, { host, attachmentId } = {} as TokenDetachPayload) => {
    if (!host) throw new Error("host required");
    const attachments = (host._attachments || []).filter((a: any) => a.id !== attachmentId);
    return { ...host, _attachments: attachments };
  },
  "token:merge": (engine, { tokens, properties, keepOriginals = false } = {} as TokenMergePayload) => {
    if (!tokens || tokens.length < 2) throw new Error("At least 2 tokens required to merge");
    const merged = {
      id: `merged-${Date.now()}-${Math.random().toString(36).slice(2)}`,
      ...Object.assign({}, ...tokens),
      ...(properties || {}),
      _mergedFrom: tokens.map((t: IToken) => t.id),
    };
    return { merged, originals: keepOriginals ? tokens : undefined };
  },
  "token:split": (engine, { token, count = 2, propertiesArray } = {} as TokenSplitPayload) => {
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
  BATCH ACTIONS (tokens:*)
  Stateless/pure or read-only — these never call session.change.
  TS parity for the WASM-only batch ops (see WasmManager dispatch table).
  Field names (rev/merged/split/kind/group) match the Rust Token serde schema.
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━*/

type BatchPredicate = (token: any) => boolean;

/** Predicates accepted by parallel_filter (flag-only; kind:/group: are find/count-only). */
const BATCH_FLAG_PREDICATES = new Set(["reversed", "normal", "merged", "split"]);

/** Resolve a string predicate; returns null for unknown predicates. */
function batchPredicate(predicate: string): BatchPredicate | null {
  switch (predicate) {
    case "reversed": return (t: any) => !!t.rev;
    case "normal": return (t: any) => !t.rev;
    case "merged": return (t: any) => !!t.merged;
    case "split": return (t: any) => !!t.split;
  }
  if (predicate.startsWith("kind:")) {
    const k = predicate.slice(5);
    return (t: any) => t.kind === k;
  }
  if (predicate.startsWith("group:")) {
    const g = predicate.slice(6);
    return (t: any) => t.group === g;
  }
  return null;
}

/** Resolve a string operation; throws for unknown operations. */
function batchOperation(operation: string): (token: any) => any {
  switch (operation) {
    case "flip": return (t: any) => ({ ...t, rev: !t.rev });
    case "merge": return (t: any) => ({ ...t, merged: true });
    case "unmerge": return (t: any) => ({ ...t, merged: false });
    default: throw new Error(`Unknown operation: ${operation}`);
  }
}

/** Deterministic numeric hash for per-deck shuffle seeds ("{seed}-{idx}"). */
function batchSeed(str: string): number {
  let h = 0;
  for (let i = 0; i < str.length; i++) {
    h = (h << 5) - h + str.charCodeAt(i);
    h |= 0;
  }
  return h >>> 0;
}

const BatchActions: ActionRegistryType = {
  "tokens:shuffle": (engine, { decks, seed } = {}) => {
    if (!Array.isArray(decks)) throw new Error("decks required");
    return decks.map((deck, idx) => {
      const copy = [...deck];
      shuffleArray(copy, seed != null ? batchSeed(`${seed}-${idx}`) : null);
      return copy;
    });
  },
  "tokens:draw": (engine, { decks, counts } = {}) => {
    if (!Array.isArray(decks) || !Array.isArray(counts)) throw new Error("decks and counts required");
    if (decks.length !== counts.length) throw new Error("Deck and count arrays must match");
    const drawn: any[][] = [];
    const remaining: any[][] = [];
    for (let i = 0; i < decks.length; i++) {
      const deck = decks[i];
      const toDraw = Math.min(counts[i], deck.length);
      drawn.push(deck.slice(deck.length - toDraw).reverse());
      remaining.push(deck.slice(0, deck.length - toDraw));
    }
    return { drawn, decks: remaining };
  },
  "tokens:filter": (engine, { tokens, predicate = "reversed" } = {}) => {
    if (!Array.isArray(tokens)) throw new Error("tokens required");
    // Rust parallel_filter only accepts the four flag predicates and errors
    // on anything else (kind:/group: are find/count-only) — keep that parity.
    if (!BATCH_FLAG_PREDICATES.has(predicate)) throw new Error(`Unknown predicate: ${predicate}`);
    return tokens.filter(batchPredicate(predicate)!);
  },
  "tokens:map": (engine, { tokens, operation = "flip" } = {}) => {
    if (!Array.isArray(tokens)) throw new Error("tokens required");
    const op = batchOperation(operation);
    return tokens.map(op);
  },
  "tokens:find": (engine, { tokens, predicate = "reversed" } = {}) => {
    if (!Array.isArray(tokens)) throw new Error("tokens required");
    const match = batchPredicate(predicate);
    if (!match) return null;
    return tokens.find(match) ?? null;
  },
  "tokens:count": (engine, { tokens, predicate = "reversed" } = {}) => {
    if (!Array.isArray(tokens)) throw new Error("tokens required");
    const match = batchPredicate(predicate);
    if (!match) return 0;
    return tokens.filter(match).length;
  },
  "tokens:forEach": (engine, { tokens, operation = "flip" } = {}) => {
    if (!Array.isArray(tokens)) throw new Error("tokens required");
    const op = batchOperation(operation);
    return tokens.map(op);
  },
  "tokens:collect": (engine, { sources } = {}) => {
    if (!Array.isArray(sources)) throw new Error("sources required");
    // Read once off the Automerge proxy (never Object.values on it).
    const state = JSON.parse(JSON.stringify(engine.session.state)) as any;
    const collected: any[] = [];
    for (const source of sources) {
      switch (source) {
        case "stack":
          if (state.stack?.stack) collected.push(...state.stack.stack);
          break;
        case "discard":
        case "discards":
          if (state.stack?.discards) collected.push(...state.stack.discards);
          break;
        case "drawn":
          if (state.stack?.drawn) collected.push(...state.stack.drawn);
          break;
        case "source":
          if (state.source?.tokens) collected.push(...state.source.tokens);
          break;
        default: {
          const zone = state.zones?.[source];
          if (Array.isArray(zone)) {
            for (const placement of zone) {
              if (placement?.tokenSnapshot) collected.push(placement.tokenSnapshot);
            }
          }
          break;
        }
      }
    }
    return collected;
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
  ...GameLoopActions,
  ...RuleActions,
  ...TokenActions,
  ...BatchActions,
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