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
import { generateId } from "../core/crypto.js";
/*━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  DECK OPERATIONS (8 actions)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━*/
export const StackActions = {
    "stack:reset": (engine) => {
        if (!engine.stack)
            throw new Error("No stack attached to engine");
        engine.stack.reset();
    },
    "stack:burn": (engine, { count = 1 } = {}) => {
        if (!engine.stack)
            throw new Error("No stack attached to engine");
        engine.stack.burn(count);
    },
    "stack:peek": (engine, { count = 1 } = {}) => {
        if (!engine.stack)
            throw new Error("No stack attached to engine");
        // Use StackWasm's peek() method for direct WASM access (no Chronicle sync)
        return engine.stack.peek(count);
    },
    "stack:cut": (engine, { position = null, topToBottom = true } = {}) => {
        if (!engine.stack)
            throw new Error("No stack attached to engine");
        const n = position ?? Math.floor((engine.stack.size || 0) / 2);
        engine.stack.cut(n, { topToBottom });
    },
    "stack:insertAt": (engine, { card, position = 0 } = {}) => {
        if (!engine.stack)
            throw new Error("No stack attached to engine");
        // @ts-ignore - We assume the payload card is compatible with the Stack's Token type
        if (!card)
            throw new Error("No card provided to insert");
        engine.stack.insertAt(card, position);
    },
    "stack:removeAt": (engine, { position = 0 } = {}) => {
        if (!engine.stack)
            throw new Error("No stack attached to engine");
        return engine.stack.removeAt(position);
    },
    "stack:swap": (engine, { i, j } = {}) => {
        if (!engine.stack)
            throw new Error("No stack attached to engine");
        if (i === undefined || j === undefined) {
            throw new Error("Both i and j positions required for swap");
        }
        engine.stack.swap(i, j);
    },
    "stack:reverse": (engine, { start = 0, end = null } = {}) => {
        if (!engine.stack)
            throw new Error("No stack attached to engine");
        const e = end ?? (engine.stack.size || 0) - 1;
        engine.stack.reverseRange(start, e);
    }
};
/*━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  TABLE OPERATIONS (12 actions)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━*/
export const SpaceActions = {
    "space:move": (engine, { fromZone, toZone, placementId } = {}) => {
        if (!engine.space)
            throw new Error("No space attached to engine");
        if (!fromZone || !toZone)
            throw new Error("Both fromZone and toZone required");
        if (!placementId)
            throw new Error("placementId required");
        const placement = engine.space.findCard(placementId);
        if (!placement)
            throw new Error(`Placement ${placementId} not found`);
        engine.space.move(fromZone, toZone, placement.id);
    },
    "space:flip": (engine, { zone, placementId, faceUp = null } = {}) => {
        if (!engine.space)
            throw new Error("No space attached to engine");
        if (!zone)
            throw new Error("zone required");
        if (!placementId)
            throw new Error("placementId required");
        const placement = engine.space.findCard(placementId);
        if (!placement)
            throw new Error(`Placement ${placementId} not found`);
        // @ts-ignore - flip accepts boolean | undefined
        engine.space.flip(zone, placement, faceUp === null ? undefined : faceUp);
    },
    "space:remove": (engine, { zone, placementId } = {}) => {
        if (!engine.space)
            throw new Error("No space attached to engine");
        if (!zone)
            throw new Error("zone required");
        if (!placementId)
            throw new Error("placementId required");
        const placement = engine.space.findCard(placementId);
        if (!placement)
            throw new Error(`Placement ${placementId} not found`);
        engine.space.remove(zone, placement.id);
    },
    "space:createZone": (engine, { id, label, x = 0, y = 0 } = {}) => {
        if (!engine.space)
            throw new Error("No space attached to engine");
        if (!id)
            throw new Error("Zone id required");
        engine.space.createZone(id, { label: label || id, x: x, y: y });
    },
    "space:deleteZone": (engine, { id } = {}) => {
        if (!engine.space)
            throw new Error("No space attached to engine");
        if (!id)
            throw new Error("Zone id required");
        engine.space.deleteZone(id);
    },
    "space:clearZone": (engine, { zone } = {}) => {
        if (!engine.space)
            throw new Error("No space attached to engine");
        if (!zone)
            throw new Error("zone required");
        engine.space.clearZone(zone);
    },
    "space:shuffleZone": (engine, { zone, seed = null } = {}) => {
        if (!engine.space)
            throw new Error("No space attached to engine");
        if (!zone)
            throw new Error("zone required");
        engine.space.shuffleZone(zone, seed);
    },
    "space:transferZone": (engine, { fromZone, toZone } = {}) => {
        if (!engine.space)
            throw new Error("No space attached to engine");
        if (!fromZone || !toZone)
            throw new Error("Both fromZone and toZone required");
        engine.space.transferZone(fromZone, toZone);
    },
    "space:fanZone": (engine, { zone, radius = 100, angleStep = 15, startAngle = 0 } = {}) => {
        if (!engine.space)
            throw new Error("No space attached to engine");
        if (!zone)
            throw new Error("zone required");
        engine.space.fan(zone, { radius, angleStep, startAngle });
    },
    "space:stackZone": (engine, { zone } = {}) => {
        if (!engine.space)
            throw new Error("No space attached to engine");
        if (!zone)
            throw new Error("zone required");
        engine.space.stackZone(zone);
    },
    "space:spreadZone": (engine, { zone, pattern = "linear", angleStep = 15, radius = 100 } = {}) => {
        if (!engine.space)
            throw new Error("No space attached to engine");
        if (!zone)
            throw new Error("zone required");
        engine.space.spreadZone(zone, { pattern, angleStep, radius });
    },
    "space:lockZone": (engine, { zone, locked = true } = {}) => {
        if (!engine.space)
            throw new Error("No space attached to engine");
        if (!zone)
            throw new Error("zone required");
        engine.space.lockZone(zone, locked);
    }
};
/*━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  SOURCE OPERATIONS (6 actions)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━*/
export const SourceActions = {
    "source:shuffle": (engine, { seed = null } = {}) => {
        if (!engine.source)
            throw new Error("No source attached to engine");
        engine.source.shuffle(seed ?? undefined);
    },
    "source:burn": (engine, { count = 1 } = {}) => {
        if (!engine.source)
            throw new Error("No source attached to engine");
        engine.source.burn(count);
    },
    "source:reset": (engine) => {
        if (!engine.source)
            throw new Error("No source attached to engine");
        engine.source.reset();
    },
    "source:addStack": (engine, { stack } = {}) => {
        if (!engine.source)
            throw new Error("No source attached to engine");
        if (!stack)
            throw new Error("stack required");
        engine.source.addStack(stack);
    },
    "source:removeStack": (engine, { stack } = {}) => {
        if (!engine.source)
            throw new Error("No source attached to engine");
        if (!stack)
            throw new Error("stack required");
        engine.source.removeStack(stack);
    },
    "source:inspect": (engine) => {
        if (!engine.source)
            throw new Error("No source attached to engine");
        return engine.source.inspect();
    }
};
/*━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  AGENT OPERATIONS (8 actions)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━*/
export const AgentActions = {
    // Normalize how we access token inventories across agents
    _getInventory(agent, createIfMissing = false) {
        if (!agent)
            return null;
        if (agent.inventory)
            return agent.inventory;
        if (agent.hand)
            return agent.hand;
        if (createIfMissing) {
            agent.inventory = [];
            return agent.inventory;
        }
        return null;
    },
    "agent:create": (engine, { name, controllerLogic = null, meta = {} } = {}) => {
        if (!name)
            throw new Error("Agent name required");
        if (!engine._agents)
            engine._agents = [];
        if (engine._agents.find((p) => p.name === name)) {
            throw new Error(`Agent ${name} already exists`);
        }
        const agent = {
            id: generateId(),
            name,
            controllerLogic,
            meta,
            active: true,
            resources: {},
            inventory: [],
            zones: new Map()
        };
        engine._agents.push(agent);
        return agent;
    },
    "agent:remove": (engine, { name } = {}) => {
        if (!name)
            throw new Error("Agent name required");
        if (!engine._agents)
            return;
        const index = engine._agents.findIndex((p) => p.name === name);
        if (index === -1)
            throw new Error(`Agent ${name} not found`);
        engine._agents.splice(index, 1);
    },
    "agent:setActive": (engine, { name, active = true } = {}) => {
        if (!name)
            throw new Error("Agent name required");
        const agent = engine._agents?.find((p) => p.name === name);
        if (!agent)
            throw new Error(`Agent ${name} not found`);
        agent.active = active;
    },
    "agent:giveResource": (engine, { name, resource, amount = 1 } = {}) => {
        if (!name)
            throw new Error("Agent name required");
        if (!resource)
            throw new Error("Resource type required");
        const agent = engine._agents?.find((p) => p.name === name);
        if (!agent)
            throw new Error(`Agent ${name} not found`);
        if (!agent.resources)
            agent.resources = {};
        agent.resources[resource] = (agent.resources[resource] || 0) + amount;
    },
    "agent:takeResource": (engine, { name, resource, amount = 1 } = {}) => {
        if (!name)
            throw new Error("Agent name required");
        if (!resource)
            throw new Error("Resource type required");
        const agent = engine._agents?.find((p) => p.name === name);
        if (!agent)
            throw new Error(`Agent ${name} not found`);
        if (!agent.resources)
            agent.resources = {};
        agent.resources[resource] = Math.max(0, (agent.resources[resource] || 0) - amount);
    },
    "agent:drawCards": (engine, { name, count = 1, source = "stack" } = {}) => {
        if (!name)
            throw new Error("Agent name required");
        const agent = engine._agents?.find((p) => p.name === name);
        if (!agent)
            throw new Error(`Agent ${name} not found`);
        if (!agent.inventory)
            agent.inventory = [];
        // @ts-ignore - source vs stack access
        const drawSource = source === "source" ? engine.source : engine.stack;
        if (!drawSource)
            throw new Error(`No ${source} attached to engine`);
        for (let i = 0; i < (count); i++) {
            const card = drawSource.draw ? drawSource.draw() : null;
            if (card) {
                // Handle both single token and array of tokens
                if (Array.isArray(card)) {
                    agent.inventory.push(...card);
                }
                else {
                    agent.inventory.push(card);
                }
            }
        }
    },
    "agent:discardCards": (engine, { name, cards } = {}) => {
        if (!name)
            throw new Error("Agent name required");
        if (!cards)
            throw new Error("Cards required");
        const agent = engine._agents?.find((p) => p.name === name);
        if (!agent)
            throw new Error(`Agent ${name} not found`);
        if (!agent.inventory)
            agent.inventory = [];
        const cardArray = Array.isArray(cards) ? cards : [cards];
        // @ts-ignore
        agent.inventory = agent.inventory.filter(c => !cardArray.includes(c));
        if (engine.stack) {
            // @ts-ignore
            cardArray.forEach(c => engine.stack.discard(c));
        }
    },
    "agent:get": (engine, { name } = {}) => {
        if (!name)
            throw new Error("Agent name required");
        const agent = engine._agents?.find((p) => p.name === name);
        if (!agent)
            throw new Error(`Agent ${name} not found`);
        return agent;
    },
    "agent:transfer": (engine, { from, to, resource, amount = 1, token = null } = {}) => {
        if (!from)
            throw new Error("Source agent (from) required");
        if (!to)
            throw new Error("Target agent (to) required");
        if (!resource && !token)
            throw new Error("Resource type or token required");
        const sourceAgent = engine._agents?.find((p) => p.name === from);
        const targetAgent = engine._agents?.find((p) => p.name === to);
        if (!sourceAgent)
            throw new Error(`Agent ${from} not found`);
        if (!targetAgent)
            throw new Error(`Agent ${to} not found`);
        if (token) {
            const sourceTokens = AgentActions._getInventory(sourceAgent);
            const targetTokens = AgentActions._getInventory(targetAgent, true);
            if (!sourceTokens || !sourceTokens.includes(token)) {
                throw new Error(`Agent ${from} does not have this token`);
            }
            const tokenIndex = sourceTokens.indexOf(token);
            if (tokenIndex === -1) {
                throw new Error(`Agent ${from} does not have this token`);
            }
            sourceTokens.splice(tokenIndex, 1);
            targetTokens.push(token);
            if (!engine._transactions)
                engine._transactions = [];
            engine._transactions.push({
                type: 'token_transfer',
                from,
                to,
                token: token.id,
                timestamp: Date.now()
            });
            engine.emit("agent:transfer", { from, to, token: token.id, type: 'token' });
            return { success: true, token };
        }
        if (!sourceAgent.resources)
            sourceAgent.resources = {};
        if (!targetAgent.resources)
            targetAgent.resources = {};
        const available = sourceAgent.resources[resource] || 0;
        if (available < amount) {
            throw new Error(`Agent ${from} only has ${available} ${resource}, cannot transfer ${amount}`);
        }
        sourceAgent.resources[resource] = available - amount;
        targetAgent.resources[resource] = (targetAgent.resources[resource] || 0) + amount;
        if (!engine._transactions)
            engine._transactions = [];
        engine._transactions.push({
            type: 'resource_transfer',
            from,
            to,
            resource,
            amount,
            timestamp: Date.now()
        });
        engine.emit("agent:transfer", { from, to, resource, amount, type: 'resource' });
        return {
            success: true,
            from: { agent: from, remaining: sourceAgent.resources[resource] },
            to: { agent: to, total: targetAgent.resources[resource] }
        };
    },
    "agent:trade": (engine, { agent1, agent2 } = {}) => {
        if (!agent1 || !agent2)
            throw new Error("Both agent1 and agent2 required");
        if (!agent1.name || !agent2.name)
            throw new Error("Agent names required");
        if (!agent1.offer || !agent2.offer)
            throw new Error("Both agents must provide offers");
        const p1 = engine._agents?.find((p) => p.name === agent1.name);
        const p2 = engine._agents?.find((p) => p.name === agent2.name);
        if (!p1)
            throw new Error(`Agent ${agent1.name} not found`);
        if (!p2)
            throw new Error(`Agent ${agent2.name} not found`);
        const offer1 = agent1.offer;
        const offer2 = agent2.offer;
        // Check agent1's offer
        const p1Inventory = AgentActions._getInventory(p1);
        const p2Inventory = AgentActions._getInventory(p2);
        if (offer1.token) {
            if (!p1Inventory || !p1Inventory.includes(offer1.token)) {
                throw new Error(`${agent1.name} does not have offered token`);
            }
        }
        else if (offer1.resource) {
            if (!p1.resources)
                p1.resources = {};
            const available = p1.resources[offer1.resource] || 0;
            if (available < offer1.amount) {
                throw new Error(`${agent1.name} only has ${available} ${offer1.resource}`);
            }
        }
        // Check agent2's offer
        if (offer2.token) {
            if (!p2Inventory || !p2Inventory.includes(offer2.token)) {
                throw new Error(`${agent2.name} does not have offered token`);
            }
        }
        else if (offer2.resource) {
            if (!p2.resources)
                p2.resources = {};
            const available = p2.resources[offer2.resource] || 0;
            if (available < offer2.amount) {
                throw new Error(`${agent2.name} only has ${available} ${offer2.resource}`);
            }
        }
        // Execution
        if (offer1.token) {
            const idx = p1Inventory.indexOf(offer1.token);
            p1Inventory.splice(idx, 1);
            const targetInventory = AgentActions._getInventory(p2, true);
            targetInventory.push(offer1.token);
        }
        else if (offer1.resource) {
            p1.resources[offer1.resource] -= offer1.amount;
            p2.resources[offer1.resource] = (p2.resources[offer1.resource] || 0) + offer1.amount;
        }
        if (offer2.token) {
            const idx = p2Inventory.indexOf(offer2.token);
            p2Inventory.splice(idx, 1);
            const targetInventory = AgentActions._getInventory(p1, true);
            targetInventory.push(offer2.token);
        }
        else if (offer2.resource) {
            p2.resources[offer2.resource] -= offer2.amount;
            p1.resources[offer2.resource] = (p1.resources[offer2.resource] || 0) + offer2.amount;
        }
        if (!engine._transactions)
            engine._transactions = [];
        engine._transactions.push({
            type: 'trade',
            from: agent1.name,
            to: agent2.name,
            agent1: agent1.name,
            agent2: agent2.name,
            offer1: offer1.token ? { token: offer1.token.id } : { resource: offer1.resource, amount: offer1.amount },
            offer2: offer2.token ? { token: offer2.token.id } : { resource: offer2.resource, amount: offer2.amount },
            timestamp: Date.now()
        });
        engine.emit("agent:trade", { agent1: agent1.name, agent2: agent2.name, offer1, offer2 });
        return { success: true, transaction: engine._transactions[engine._transactions.length - 1] };
    },
    "agent:steal": (engine, { from, to, resource, amount = 1, token = null, validate } = {}) => {
        if (!from)
            throw new Error("Victim agent (from) required");
        if (!to)
            throw new Error("Thief agent (to) required");
        if (!resource && !token)
            throw new Error("Resource type or token required");
        const victimAgent = engine._agents?.find((p) => p.name === from);
        const thiefAgent = engine._agents?.find((p) => p.name === to);
        if (!victimAgent)
            throw new Error(`Agent ${from} not found`);
        if (!thiefAgent)
            throw new Error(`Agent ${to} not found`);
        if (validate) {
            const isValid = validate(thiefAgent, victimAgent, engine);
            if (!isValid) {
                throw new Error(`Steal validation failed: ${to} cannot steal from ${from}`);
            }
        }
        if (token) {
            const victimInventory = AgentActions._getInventory(victimAgent);
            const thiefInventory = AgentActions._getInventory(thiefAgent, true);
            if (!victimInventory)
                throw new Error(`Agent ${from} does not have this token`);
            const tokenIndex = victimInventory.indexOf(token);
            if (tokenIndex === -1)
                throw new Error(`Agent ${from} does not have this token`);
            victimInventory.splice(tokenIndex, 1);
            thiefInventory.push(token);
            if (!engine._transactions)
                engine._transactions = [];
            engine._transactions.push({ type: 'steal_token', from, to, token: token.id, timestamp: Date.now() });
            engine.emit("agent:steal", { from, to, token: token.id, type: 'token' });
            return { success: true, token };
        }
        if (!victimAgent.resources)
            victimAgent.resources = {};
        if (!thiefAgent.resources)
            thiefAgent.resources = {};
        const available = victimAgent.resources[resource] || 0;
        const stolen = Math.min(available, amount);
        if (stolen === 0)
            throw new Error(`Agent ${from} has no ${resource} to steal`);
        victimAgent.resources[resource] = available - stolen;
        thiefAgent.resources[resource] = (thiefAgent.resources[resource] || 0) + stolen;
        if (!engine._transactions)
            engine._transactions = [];
        engine._transactions.push({ type: 'steal_resource', from, to, resource, amount: stolen, timestamp: Date.now() });
        engine.emit("agent:steal", { from, to, resource, amount: stolen, type: 'resource' });
        return { success: true, stolen, from: { agent: from, remaining: victimAgent.resources[resource] }, to: { agent: to, total: thiefAgent.resources[resource] } };
    }
};
/*━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  GAME STATE OPERATIONS (6 actions)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━*/
export const GameStateActions = {
    "game:start": (engine) => {
        if (!engine._gameState)
            engine._gameState = {};
        engine._gameState = { ...engine._gameState, started: true, startTime: Date.now(), phase: "setup", turn: 0, ended: false };
    },
    "game:end": (engine, { winner = null, reason = null } = {}) => {
        if (!engine._gameState)
            engine._gameState = {};
        engine._gameState = { ...engine._gameState, ended: true, endTime: Date.now(), winner: winner || undefined, reason: reason || undefined };
    },
    "game:pause": (engine) => {
        if (!engine._gameState)
            engine._gameState = {};
        engine._gameState = { ...engine._gameState, paused: true, pauseTime: Date.now() };
    },
    "game:resume": (engine) => {
        if (!engine._gameState)
            engine._gameState = {};
        const pauseTime = engine._gameState.pauseTime || Date.now();
        const pauseDuration = Date.now() - pauseTime;
        engine._gameState = { ...engine._gameState, paused: false, resumeTime: Date.now(), totalPauseDuration: (engine._gameState.totalPauseDuration || 0) + pauseDuration };
    },
    "game:nextPhase": (engine, { phase = null } = {}) => {
        if (!engine._gameState)
            engine._gameState = {};
        if (phase) {
            engine._gameState.phase = phase;
        }
        else {
            const phases = ["setup", "play", "scoring", "end"];
            const currentIndex = phases.indexOf(engine._gameState.phase || "setup");
            const nextIndex = Math.min(currentIndex + 1, phases.length - 1);
            engine._gameState.phase = phases[nextIndex];
        }
    },
    "game:setProperty": (engine, { key, value } = {}) => {
        if (!key)
            throw new Error("Property key required");
        if (!engine._gameState)
            engine._gameState = {};
        engine._gameState[key] = value;
    }
};
/*━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  TOKEN TRANSFORMATION/MUTATION (5 actions)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━*/
export const TokenActions = {
    "token:transform": (engine, { token, properties = {} } = {}) => {
        if (!token)
            throw new Error("No token provided to transform");
        const { meta, ...otherProperties } = properties;
        Object.assign(token, otherProperties);
        if (meta && typeof meta === 'object') {
            token.meta = { ...token.meta, ...meta };
        }
        engine.emit("token:transformed", { token, properties });
        return token;
    },
    "token:attach": (engine, { host, attachment, attachmentType = "default" } = {}) => {
        if (!host)
            throw new Error("No host token provided");
        if (!attachment)
            throw new Error("No attachment token provided");
        if (!host._attachments)
            host._attachments = [];
        const attachmentRecord = { token: attachment, type: attachmentType, attachedAt: Date.now(), id: attachment.id };
        host._attachments.push(attachmentRecord);
        attachment._attachedTo = host.id;
        attachment._attachmentType = attachmentType;
        engine.emit("token:attached", { host, attachment, attachmentType });
        return host;
    },
    "token:detach": (engine, { host, attachmentId = null, attachment = null } = {}) => {
        if (!host)
            throw new Error("No host token provided");
        if (!host._attachments || host._attachments.length === 0)
            return null;
        const targetId = attachmentId || attachment?.id;
        const index = host._attachments.findIndex((a) => a.id === targetId || a.token === attachment);
        if (index === -1)
            return null;
        const [detached] = host._attachments.splice(index, 1);
        const detachedToken = detached.token;
        delete detachedToken._attachedTo;
        delete detachedToken._attachmentType;
        engine.emit("token:detached", { host, detachedToken, type: detached.type });
        return detachedToken;
    },
    "token:merge": (engine, { tokens = [], resultProperties = {}, keepOriginals = false } = {}) => {
        if (!tokens || tokens.length < 2)
            throw new Error("At least 2 tokens required to merge");
        const baseToken = tokens[0];
        const mergedToken = { ...baseToken, ...resultProperties, _mergedFrom: tokens.map(t => t.id), _mergedAt: Date.now() };
        if (!resultProperties.meta) {
            mergedToken.meta = tokens.reduce((acc, token) => ({ ...acc, ...token.meta }), {});
        }
        if (!keepOriginals) {
            tokens.forEach(token => {
                token._merged = true;
                token._mergedInto = mergedToken.id;
            });
        }
        engine.emit("token:merged", { tokens, mergedToken, keepOriginals });
        return mergedToken;
    },
    "token:split": (engine, { token, count = 2, properties = [] } = {}) => {
        if (!token)
            throw new Error("No token provided to split");
        if (count < 2)
            throw new Error("Split count must be at least 2");
        const splitTokens = [];
        // @ts-ignore properties array handling
        for (let i = 0; i < count; i++) {
            const customProps = properties[i] || {};
            const { meta: customMeta, ...otherCustomProps } = customProps;
            const splitToken = {
                ...token,
                id: `${token.id}-split-${i}`,
                ...otherCustomProps,
                meta: { ...token.meta, ...(customMeta || {}) },
                _splitFrom: token.id,
                _splitIndex: i,
                _splitAt: Date.now()
            };
            splitTokens.push(splitToken);
        }
        token._split = true;
        token._splitInto = splitTokens.map(t => t.id);
        engine.emit("token:split", { originalToken: token, splitTokens, count });
        return splitTokens;
    }
};
/*━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  BATCH/QUERY OPERATIONS (5 actions)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━*/
const extractTokens = (placements = []) => {
    return placements
        .map((p) => p?.tokenSnapshot || p?.token || p?.card || p)
        .filter(Boolean);
};
export const BatchActions = {
    "tokens:filter": (engine, { tokens = [], predicate, source = null } = {}) => {
        if (!predicate || typeof predicate !== 'function')
            throw new Error("Predicate function required");
        let tokensToFilter = tokens;
        if (source === 'stack' && engine.stack) {
            tokensToFilter = engine.stack.tokens || [];
        }
        else if (source === 'space' && engine.space) {
            // @ts-ignore - Engine.space is typed but methods might not be fully typed yet
            tokensToFilter = extractTokens(engine.space.cards());
        }
        else if (source && engine.space) {
            // @ts-ignore
            tokensToFilter = extractTokens(engine.space.zone(source));
        }
        const filtered = tokensToFilter.filter(predicate);
        engine.emit("tokens:filtered", { source: source || 'provided', count: filtered.length, total: tokensToFilter.length });
        return filtered;
    },
    "tokens:forEach": (engine, { tokens = [], operation, source = null } = {}) => {
        if (!operation || typeof operation !== 'function')
            throw new Error("Operation function required");
        let tokensToProcess = tokens;
        if (source === 'stack' && engine.stack) {
            tokensToProcess = engine.stack.tokens || [];
        }
        else if (source === 'space' && engine.space) {
            // @ts-ignore
            tokensToProcess = extractTokens(engine.space.cards());
        }
        else if (source && engine.space) {
            // @ts-ignore
            tokensToProcess = extractTokens(engine.space.zone(source));
        }
        const results = [];
        tokensToProcess.forEach((token, index) => {
            try {
                const result = operation(token, index);
                results.push(result);
            }
            catch (error) {
                engine.emit("tokens:forEach:error", { token, error });
            }
        });
        engine.emit("tokens:forEach:complete", { count: tokensToProcess.length });
        return results;
    },
    "tokens:collect": (engine, { sources = [], includeAttachments = false } = {}) => {
        if (!Array.isArray(sources) || sources.length === 0)
            throw new Error("Sources array required");
        const collected = [];
        sources.forEach(source => {
            let tokensFromSource = [];
            if (source === 'stack' && engine.stack) {
                tokensFromSource = engine.stack.tokens || [];
            }
            else if (source === 'space' && engine.space) {
                // @ts-ignore
                tokensFromSource = extractTokens(engine.space.cards());
            }
            else if (source === 'discard' && engine.stack) {
                tokensFromSource = engine.stack.discards || [];
            }
            else if (source === 'source' && engine.source) {
                tokensFromSource = engine.source.tokens || [];
            }
            else if (engine.space) {
                // @ts-ignore
                const zone = engine.space.zone(source);
                tokensFromSource = extractTokens(zone);
            }
            collected.push(...tokensFromSource);
            if (includeAttachments) {
                tokensFromSource.forEach(token => {
                    if (token && token._attachments) {
                        token._attachments.forEach((att) => collected.push(att.token));
                    }
                });
            }
        });
        engine.emit("tokens:collected", { sources, count: collected.length });
        return collected;
    },
    "tokens:count": (engine, { tokens = [], predicate, source = null } = {}) => {
        let tokensToCount = tokens;
        if (source === 'stack' && engine.stack) {
            tokensToCount = engine.stack.tokens || [];
        }
        else if (source === 'space' && engine.space) {
            // @ts-ignore
            tokensToCount = extractTokens(engine.space.cards());
        }
        else if (source && engine.space) {
            // @ts-ignore
            tokensToCount = extractTokens(engine.space.zone(source));
        }
        if (!predicate)
            return tokensToCount.length;
        const count = tokensToCount.filter(predicate).length;
        engine.emit("tokens:counted", { source: source || 'provided', count, total: tokensToCount.length });
        return count;
    },
    "tokens:find": (engine, { tokens = [], predicate, source = null } = {}) => {
        if (!predicate || typeof predicate !== 'function')
            throw new Error("Predicate function required");
        let tokensToSearch = tokens;
        if (source === 'stack' && engine.stack) {
            tokensToSearch = engine.stack.tokens || [];
        }
        else if (source === 'space' && engine.space) {
            // @ts-ignore
            tokensToSearch = extractTokens(engine.space.cards());
        }
        else if (source && engine.space) {
            // @ts-ignore
            tokensToSearch = extractTokens(engine.space.zone(source));
        }
        const found = tokensToSearch.find(predicate);
        engine.emit("tokens:found", { source: source || 'provided', found: !!found });
        return found || null;
    }
};
export const ExtendedActions = {
    ...StackActions,
    ...SpaceActions,
    ...SourceActions,
    ...AgentActions,
    ...GameStateActions,
    ...TokenActions,
    ...BatchActions
};
// Total: 58 actions
// - stack: 8
// - Space: 12
// - Source: 6
// - Agent: 12 (9 base + 3 transfer)
// - GameState: 6
// - Token: 5
// - Batch: 5
