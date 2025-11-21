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
 * Extended ActionRegistry - Comprehensive game actions
 */

import { Engine } from "./Engine.js";
import { IToken } from "../core/types.js";
import { Deck } from "../core/Deck.js";
// @ts-ignore - Player class might still be JS or we use 'any' for players for now
import { Player } from "./Player.js";

// Helper types for payloads
interface DeckPayload { count?: number; seed?: number | null; position?: number | null; topToBottom?: boolean; card?: IToken; start?: number; end?: number | null; i?: number; j?: number; }
interface TablePayload { fromZone?: string; toZone?: string; placementId?: string; zone?: string; faceUp?: boolean | null; id?: string; label?: string; x?: number; y?: number; seed?: number | null; radius?: number; angleStep?: number; startAngle?: number; pattern?: string; locked?: boolean; }
interface ShoePayload { seed?: number | null; count?: number; deck?: Deck; }
interface PlayerPayload { name?: string; agent?: any; meta?: any; active?: boolean; resource?: string; amount?: number; source?: string; count?: number; cards?: IToken | IToken[]; from?: string; to?: string; token?: IToken | null; player1?: any; player2?: any; validate?: (thief: any, victim: any, engine: Engine) => boolean; }
interface GameStatePayload { winner?: string | null; reason?: string | null; phase?: string | null; key?: string; value?: any; }
interface TokenPayload { token?: IToken; properties?: any; host?: IToken; attachment?: IToken | null; attachmentType?: string; attachmentId?: string | null; tokens?: IToken[]; resultProperties?: any; keepOriginals?: boolean; count?: number; }
interface BatchPayload { tokens?: IToken[]; predicate?: (t: IToken) => boolean; source?: string | null; operation?: (t: IToken, i: number) => any; sources?: string[]; includeAttachments?: boolean; }

/*━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  DECK OPERATIONS (8 actions)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━*/

export const DeckActions = {
  "deck:reset": (engine: Engine) => {
    if (!engine.deck) throw new Error("No deck attached to engine");
    engine.deck.reset();
  },
  
  "deck:burn": (engine: Engine, { count = 1 }: DeckPayload = {}) => {
    if (!engine.deck) throw new Error("No deck attached to engine");
    engine.deck.burn(count);
  },
  
  "deck:peek": (engine: Engine, { count = 1 }: DeckPayload = {}) => {
    if (!engine.deck) throw new Error("No deck attached to engine");
    const cards: IToken[] = [];
    const stack = engine.deck.tokens || [];
    for (let i = 0; i < (count!) && i < stack.length; i++) {
      cards.push(stack[stack.length - 1 - i]);
    }
    return cards;
  },
  
  "deck:cut": (engine: Engine, { position = null, topToBottom = true }: DeckPayload = {}) => {
    if (!engine.deck) throw new Error("No deck attached to engine");
    const n = position ?? Math.floor((engine.deck.size || 0) / 2);
    engine.deck.cut(n, { topToBottom });
  },
  
  "deck:insertAt": (engine: Engine, { card, position = 0 }: DeckPayload = {}) => {
    if (!engine.deck) throw new Error("No deck attached to engine");
    // @ts-ignore - We assume the payload card is compatible with the Deck's Token type
    if (!card) throw new Error("No card provided to insert");
    engine.deck.insertAt(card as any, position!);
  },
  
  "deck:removeAt": (engine: Engine, { position = 0 }: DeckPayload = {}) => {
    if (!engine.deck) throw new Error("No deck attached to engine");
    return engine.deck.removeAt(position!);
  },
  
  "deck:swap": (engine: Engine, { i, j }: DeckPayload = {}) => {
    if (!engine.deck) throw new Error("No deck attached to engine");
    if (i === undefined || j === undefined) {
      throw new Error("Both i and j positions required for swap");
    }
    engine.deck.swap(i, j);
  },
  
  "deck:reverse": (engine: Engine, { start = 0, end = null }: DeckPayload = {}) => {
    if (!engine.deck) throw new Error("No deck attached to engine");
    const e = end ?? (engine.deck.size || 0) - 1;
    engine.deck.reverseRange(start!, e);
  }
};

/*━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  TABLE OPERATIONS (12 actions)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━*/

export const TableActions = {
  "table:move": (engine: Engine, { fromZone, toZone, placementId }: TablePayload = {}) => {
    if (!engine.table) throw new Error("No table attached to engine");
    if (!fromZone || !toZone) throw new Error("Both fromZone and toZone required");
    if (!placementId) throw new Error("placementId required");
    
    const placement = engine.table.findCard(placementId);
    if (!placement) throw new Error(`Placement ${placementId} not found`);
    
    engine.table.move(fromZone, toZone, placement.id);
  },
  
  "table:flip": (engine: Engine, { zone, placementId, faceUp = null }: TablePayload = {}) => {
    if (!engine.table) throw new Error("No table attached to engine");
    if (!zone) throw new Error("zone required");
    if (!placementId) throw new Error("placementId required");
    
    const placement = engine.table.findCard(placementId);
    if (!placement) throw new Error(`Placement ${placementId} not found`);
    
    // @ts-ignore - flip accepts boolean | undefined
    engine.table.flip(zone, placement, faceUp === null ? undefined : faceUp);
  },
  
  "table:remove": (engine: Engine, { zone, placementId }: TablePayload = {}) => {
    if (!engine.table) throw new Error("No table attached to engine");
    if (!zone) throw new Error("zone required");
    if (!placementId) throw new Error("placementId required");
    
    const placement = engine.table.findCard(placementId);
    if (!placement) throw new Error(`Placement ${placementId} not found`);
    
    engine.table.remove(zone, placement.id);
  },
  
  "table:createZone": (engine: Engine, { id, label, x = 0, y = 0 }: TablePayload = {}) => {
    if (!engine.table) throw new Error("No table attached to engine");
    if (!id) throw new Error("Zone id required");
    
    engine.table.createZone(id, { label: label || id, x: x!, y: y! });
  },
  
  "table:deleteZone": (engine: Engine, { id }: TablePayload = {}) => {
    if (!engine.table) throw new Error("No table attached to engine");
    if (!id) throw new Error("Zone id required");
    
    engine.table.deleteZone(id);
  },
  
  "table:clearZone": (engine: Engine, { zone }: TablePayload = {}) => {
    if (!engine.table) throw new Error("No table attached to engine");
    if (!zone) throw new Error("zone required");
    
    engine.table.clearZone(zone);
  },
  
  "table:shuffleZone": (engine: Engine, { zone, seed = null }: TablePayload = {}) => {
    if (!engine.table) throw new Error("No table attached to engine");
    if (!zone) throw new Error("zone required");
    
    engine.table.shuffleZone(zone, seed as any);
  },
  
  "table:transferZone": (engine: Engine, { fromZone, toZone }: TablePayload = {}) => {
    if (!engine.table) throw new Error("No table attached to engine");
    if (!fromZone || !toZone) throw new Error("Both fromZone and toZone required");
    
    engine.table.transferZone(fromZone, toZone);
  },
  
  "table:fanZone": (engine: Engine, { zone, radius = 100, angleStep = 15, startAngle = 0 }: TablePayload = {}) => {
    if (!engine.table) throw new Error("No table attached to engine");
    if (!zone) throw new Error("zone required");
    
    engine.table.fan(zone, { radius, angleStep, startAngle });
  },
  
  "table:stackZone": (engine: Engine, { zone }: TablePayload = {}) => {
    if (!engine.table) throw new Error("No table attached to engine");
    if (!zone) throw new Error("zone required");
    
    engine.table.stackZone(zone);
  },
  
  "table:spreadZone": (engine: Engine, { zone, pattern = "linear", angleStep = 15, radius = 100 }: TablePayload = {}) => {
    if (!engine.table) throw new Error("No table attached to engine");
    if (!zone) throw new Error("zone required");
    
    engine.table.spreadZone(zone, { pattern, angleStep, radius });
  },
  
  "table:lockZone": (engine: Engine, { zone, locked = true }: TablePayload = {}) => {
    if (!engine.table) throw new Error("No table attached to engine");
    if (!zone) throw new Error("zone required");
    
    engine.table.lockZone(zone, locked);
  }
};

/*━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  SHOE OPERATIONS (6 actions)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━*/

export const ShoeActions = {
  "shoe:shuffle": (engine: Engine, { seed = null }: ShoePayload = {}) => {
    if (!engine.shoe) throw new Error("No shoe attached to engine");
    engine.shoe.shuffle(seed ?? undefined);
  },
  
  "shoe:burn": (engine: Engine, { count = 1 }: ShoePayload = {}) => {
    if (!engine.shoe) throw new Error("No shoe attached to engine");
    engine.shoe.burn(count);
  },
  
  "shoe:reset": (engine: Engine) => {
    if (!engine.shoe) throw new Error("No shoe attached to engine");
    engine.shoe.reset();
  },
  
  "shoe:addDeck": (engine: Engine, { deck }: ShoePayload = {}) => {
    if (!engine.shoe) throw new Error("No shoe attached to engine");
    if (!deck) throw new Error("deck required");
    engine.shoe.addDeck(deck);
  },
  
  "shoe:removeDeck": (engine: Engine, { deck }: ShoePayload = {}) => {
    if (!engine.shoe) throw new Error("No shoe attached to engine");
    if (!deck) throw new Error("deck required");
    engine.shoe.removeDeck(deck);
  },
  
  "shoe:inspect": (engine: Engine) => {
    if (!engine.shoe) throw new Error("No shoe attached to engine");
    return engine.shoe.inspect();
  }
};
/*━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  PLAYER OPERATIONS (8 actions)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━*/

export const PlayerActions = {
  "player:create": (engine: Engine, { name, agent = null, meta = {} }: PlayerPayload = {}) => {
    if (!name) throw new Error("Player name required");
    if (!engine._players) engine._players = [];
    
    if (engine._players.find((p: any) => p.name === name)) {
      throw new Error(`Player ${name} already exists`);
    }
    
    const player = { 
      id: crypto?.randomUUID?.() || `player-${Date.now()}`,
      name, 
      agent,
      meta,
      active: true,
      resources: {},
      hand: [],
      zones: new Map()
    };
    
    engine._players.push(player);
    return player;
  },
  
  "player:remove": (engine: Engine, { name }: PlayerPayload = {}) => {
    if (!name) throw new Error("Player name required");
    if (!engine._players) return;
    
    const index = engine._players.findIndex((p: any) => p.name === name);
    if (index === -1) throw new Error(`Player ${name} not found`);
    
    engine._players.splice(index, 1);
  },
  
  "player:setActive": (engine: Engine, { name, active = true }: PlayerPayload = {}) => {
    if (!name) throw new Error("Player name required");
    const player = engine._players?.find((p: any) => p.name === name);
    if (!player) throw new Error(`Player ${name} not found`);
    
    player.active = active;
  },
  
  "player:giveResource": (engine: Engine, { name, resource, amount = 1 }: PlayerPayload = {}) => {
    if (!name) throw new Error("Player name required");
    if (!resource) throw new Error("Resource type required");
    
    const player = engine._players?.find((p: any) => p.name === name);
    if (!player) throw new Error(`Player ${name} not found`);
    
    if (!player.resources) player.resources = {};
    player.resources[resource] = (player.resources[resource] || 0) + amount!;
  },
  
  "player:takeResource": (engine: Engine, { name, resource, amount = 1 }: PlayerPayload = {}) => {
    if (!name) throw new Error("Player name required");
    if (!resource) throw new Error("Resource type required");
    
    const player = engine._players?.find((p: any) => p.name === name);
    if (!player) throw new Error(`Player ${name} not found`);
    
    if (!player.resources) player.resources = {};
    player.resources[resource] = Math.max(0, (player.resources[resource] || 0) - amount!);
  },
  
  "player:drawCards": (engine: Engine, { name, count = 1, source = "deck" }: PlayerPayload = {}) => {
    if (!name) throw new Error("Player name required");
    
    const player = engine._players?.find((p: any) => p.name === name);
    if (!player) throw new Error(`Player ${name} not found`);
    
    if (!player.hand) player.hand = [];
    
    // @ts-ignore - shoe vs deck access
    const drawSource = source === "shoe" ? engine.shoe : engine.deck;
    if (!drawSource) throw new Error(`No ${source} attached to engine`);
    
    for (let i = 0; i < (count!); i++) {
      const card = drawSource.draw ? drawSource.draw() : null;
      if (card) player.hand.push(card);
    }
  },
  
  "player:discardCards": (engine: Engine, { name, cards }: PlayerPayload = {}) => {
    if (!name) throw new Error("Player name required");
    if (!cards) throw new Error("Cards required");
    
    const player = engine._players?.find((p: any) => p.name === name);
    if (!player) throw new Error(`Player ${name} not found`);
    
    if (!player.hand) player.hand = [];
    
    const cardArray = Array.isArray(cards) ? cards : [cards];
    // @ts-ignore
    player.hand = player.hand.filter(c => !cardArray.includes(c));
    
    if (engine.deck) {
      // @ts-ignore
      cardArray.forEach(c => engine.deck!.discard(c));
    }
  },
  
  "player:get": (engine: Engine, { name }: PlayerPayload = {}) => {
    if (!name) throw new Error("Player name required");
    const player = engine._players?.find((p: any) => p.name === name);
    if (!player) throw new Error(`Player ${name} not found`);
    return player;
  },
  
  "player:transfer": (engine: Engine, { from, to, resource, amount = 1, token = null }: PlayerPayload = {}) => {
    if (!from) throw new Error("Source player (from) required");
    if (!to) throw new Error("Target player (to) required");
    if (!resource && !token) throw new Error("Resource type or token required");
    
    const sourcePlayer = engine._players?.find((p: any) => p.name === from);
    const targetPlayer = engine._players?.find((p: any) => p.name === to);
    
    if (!sourcePlayer) throw new Error(`Player ${from} not found`);
    if (!targetPlayer) throw new Error(`Player ${to} not found`);
    
    if (token) {
      if (!sourcePlayer.hand) sourcePlayer.hand = [];
      if (!targetPlayer.hand) targetPlayer.hand = [];
      
      const tokenIndex = sourcePlayer.hand.indexOf(token);
      if (tokenIndex === -1) {
        throw new Error(`Player ${from} does not have this token`);
      }
      
      sourcePlayer.hand.splice(tokenIndex, 1);
      targetPlayer.hand.push(token);
      
      if (!engine._transactions) engine._transactions = [];
      engine._transactions.push({
        type: 'token_transfer',
        from,
        to,
        token: token.id,
        timestamp: Date.now()
      });
      
      engine.emit("player:transfer", { from, to, token: token.id, type: 'token' });
      return { success: true, token };
    }
    
    if (!sourcePlayer.resources) sourcePlayer.resources = {};
    if (!targetPlayer.resources) targetPlayer.resources = {};
    
    const available = sourcePlayer.resources[resource!] || 0;
    if (available < amount!) {
      throw new Error(`Player ${from} only has ${available} ${resource}, cannot transfer ${amount}`);
    }
    
    sourcePlayer.resources[resource!] = available - amount!;
    targetPlayer.resources[resource!] = (targetPlayer.resources[resource!] || 0) + amount!;
    
    if (!engine._transactions) engine._transactions = [];
    engine._transactions.push({
      type: 'resource_transfer',
      from,
      to,
      resource,
      amount,
      timestamp: Date.now()
    });
    
    engine.emit("player:transfer", { from, to, resource, amount, type: 'resource' });
    
    return { 
      success: true, 
      from: { player: from, remaining: sourcePlayer.resources[resource!] },
      to: { player: to, total: targetPlayer.resources[resource!] }
    };
  },
  
  "player:trade": (engine: Engine, { player1, player2 }: PlayerPayload = {}) => {
    if (!player1 || !player2) throw new Error("Both player1 and player2 required");
    if (!player1.name || !player2.name) throw new Error("Player names required");
    if (!player1.offer || !player2.offer) throw new Error("Both players must provide offers");
    
    const p1 = engine._players?.find((p: any) => p.name === player1.name);
    const p2 = engine._players?.find((p: any) => p.name === player2.name);
    
    if (!p1) throw new Error(`Player ${player1.name} not found`);
    if (!p2) throw new Error(`Player ${player2.name} not found`);
    
    const offer1 = player1.offer;
    const offer2 = player2.offer;
    
    // Check player1's offer
    if (offer1.token) {
      if (!p1.hand || !p1.hand.includes(offer1.token)) {
        throw new Error(`${player1.name} does not have offered token`);
      }
    } else if (offer1.resource) {
      if (!p1.resources) p1.resources = {};
      const available = p1.resources[offer1.resource] || 0;
      if (available < offer1.amount) {
        throw new Error(`${player1.name} only has ${available} ${offer1.resource}`);
      }
    }
    
    // Check player2's offer
    if (offer2.token) {
      if (!p2.hand || !p2.hand.includes(offer2.token)) {
        throw new Error(`${player2.name} does not have offered token`);
      }
    } else if (offer2.resource) {
      if (!p2.resources) p2.resources = {};
      const available = p2.resources[offer2.resource] || 0;
      if (available < offer2.amount) {
        throw new Error(`${player2.name} only has ${available} ${offer2.resource}`);
      }
    }
    
  // Execution
    if (offer1.token) {
      const idx = p1.hand.indexOf(offer1.token);
      p1.hand.splice(idx, 1);
      if (!p2.hand) p2.hand = [];
      p2.hand.push(offer1.token);
    } else if (offer1.resource) {
      p1.resources[offer1.resource] -= offer1.amount;
      p2.resources[offer1.resource] = (p2.resources[offer1.resource] || 0) + offer1.amount;
    }
    
    if (offer2.token) {
      const idx = p2.hand.indexOf(offer2.token);
      p2.hand.splice(idx, 1);
      if (!p1.hand) p1.hand = [];
      p1.hand.push(offer2.token);
    } else if (offer2.resource) {
      p2.resources[offer2.resource] -= offer2.amount;
      p1.resources[offer2.resource] = (p1.resources[offer2.resource] || 0) + offer2.amount;
    }
    
    if (!engine._transactions) engine._transactions = [];
    engine._transactions.push({
      type: 'trade',
      player1: player1.name,
      player2: player2.name,
      offer1: offer1.token ? { token: offer1.token.id } : { resource: offer1.resource, amount: offer1.amount },
      offer2: offer2.token ? { token: offer2.token.id } : { resource: offer2.resource, amount: offer2.amount },
      timestamp: Date.now()
    });
    
    engine.emit("player:trade", { player1: player1.name, player2: player2.name, offer1, offer2 });
    return { success: true, transaction: engine._transactions[engine._transactions.length - 1] };
  },
  
  "player:steal": (engine: Engine, { from, to, resource, amount = 1, token = null, validate }: PlayerPayload = {}) => {
    if (!from) throw new Error("Victim player (from) required");
    if (!to) throw new Error("Thief player (to) required");
    if (!resource && !token) throw new Error("Resource type or token required");
    
    const victimPlayer = engine._players?.find((p: any) => p.name === from);
    const thiefPlayer = engine._players?.find((p: any) => p.name === to);
    
    if (!victimPlayer) throw new Error(`Player ${from} not found`);
    if (!thiefPlayer) throw new Error(`Player ${to} not found`);
    
    if (validate) {
      const isValid = validate(thiefPlayer, victimPlayer, engine);
      if (!isValid) {
        throw new Error(`Steal validation failed: ${to} cannot steal from ${from}`);
      }
    }
    
    if (token) {
      if (!victimPlayer.hand) victimPlayer.hand = [];
      if (!thiefPlayer.hand) thiefPlayer.hand = [];
      
      const tokenIndex = victimPlayer.hand.indexOf(token);
      if (tokenIndex === -1) throw new Error(`Player ${from} does not have this token`);
      
      victimPlayer.hand.splice(tokenIndex, 1);
      thiefPlayer.hand.push(token);
      
      if (!engine._transactions) engine._transactions = [];
      engine._transactions.push({ type: 'steal_token', from, to, token: token.id, timestamp: Date.now() });
      engine.emit("player:steal", { from, to, token: token.id, type: 'token' });
      return { success: true, token };
    }
    
    if (!victimPlayer.resources) victimPlayer.resources = {};
    if (!thiefPlayer.resources) thiefPlayer.resources = {};
    
    const available = victimPlayer.resources[resource!] || 0;
    const stolen = Math.min(available, amount!);
    
    if (stolen === 0) throw new Error(`Player ${from} has no ${resource} to steal`);
    
    victimPlayer.resources[resource!] = available - stolen;
    thiefPlayer.resources[resource!] = (thiefPlayer.resources[resource!] || 0) + stolen;
    
    if (!engine._transactions) engine._transactions = [];
    engine._transactions.push({ type: 'steal_resource', from, to, resource, amount: stolen, timestamp: Date.now() });
    engine.emit("player:steal", { from, to, resource, amount: stolen, type: 'resource' });
    return { success: true, stolen, from: { player: from, remaining: victimPlayer.resources[resource!] }, to: { player: to, total: thiefPlayer.resources[resource!] } };
  }
};

/*━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  GAME STATE OPERATIONS (6 actions)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━*/

export const GameStateActions = {
  "game:start": (engine: Engine) => {
    if (!engine._gameState) engine._gameState = {};
    engine._gameState = { ...engine._gameState, started: true, startTime: Date.now(), phase: "setup", turn: 0, ended: false };
  },
  
  "game:end": (engine: Engine, { winner = null, reason = null }: GameStatePayload = {}) => {
    if (!engine._gameState) engine._gameState = {};
    engine._gameState = { ...engine._gameState, ended: true, endTime: Date.now(), winner: winner || undefined, reason: reason || undefined };
  },
  
  "game:pause": (engine: Engine) => {
    if (!engine._gameState) engine._gameState = {};
    engine._gameState = { ...engine._gameState, paused: true, pauseTime: Date.now() };
  },
  
  "game:resume": (engine: Engine) => {
    if (!engine._gameState) engine._gameState = {};
    const pauseTime = engine._gameState.pauseTime || Date.now();
    const pauseDuration = Date.now() - pauseTime;
    engine._gameState = { ...engine._gameState, paused: false, resumeTime: Date.now(), totalPauseDuration: (engine._gameState.totalPauseDuration || 0) + pauseDuration };
  },
  
  "game:nextPhase": (engine: Engine, { phase = null }: GameStatePayload = {}) => {
    if (!engine._gameState) engine._gameState = {};
    if (phase) {
      engine._gameState.phase = phase;
    } else {
      const phases = ["setup", "play", "scoring", "end"];
      const currentIndex = phases.indexOf(engine._gameState.phase || "setup");
      const nextIndex = Math.min(currentIndex + 1, phases.length - 1);
      engine._gameState.phase = phases[nextIndex];
    }
  },
  
  "game:setProperty": (engine: Engine, { key, value }: GameStatePayload = {}) => {
    if (!key) throw new Error("Property key required");
    if (!engine._gameState) engine._gameState = {};
    engine._gameState[key] = value;
  }
};

/*━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  TOKEN TRANSFORMATION/MUTATION (5 actions)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━*/

export const TokenActions = {
  "token:transform": (engine: Engine, { token, properties = {} }: TokenPayload = {}) => {
    if (!token) throw new Error("No token provided to transform");
    const { meta, ...otherProperties } = properties;
    Object.assign(token, otherProperties);
    if (meta && typeof meta === 'object') {
      token.meta = { ...token.meta, ...meta };
    }
    engine.emit("token:transformed", { token, properties });
    return token;
  },
  
  "token:attach": (engine: Engine, { host, attachment, attachmentType = "default" }: TokenPayload = {}) => {
    if (!host) throw new Error("No host token provided");
    if (!attachment) throw new Error("No attachment token provided");
    
    if (!host._attachments) host._attachments = [];
    
    const attachmentRecord = { token: attachment, type: attachmentType, attachedAt: Date.now(), id: attachment.id };
    host._attachments.push(attachmentRecord);
    
    attachment._attachedTo = host.id;
    attachment._attachmentType = attachmentType;
    
    engine.emit("token:attached", { host, attachment, attachmentType });
    return host;
  },
  
  "token:detach": (engine: Engine, { host, attachmentId = null, attachment = null }: TokenPayload = {}) => {
    if (!host) throw new Error("No host token provided");
    if (!host._attachments || host._attachments.length === 0) return null;
    
    const targetId = attachmentId || attachment?.id;
    const index = host._attachments.findIndex((a: any) => a.id === targetId || a.token === attachment);
    
    if (index === -1) return null;
    
    const [detached] = host._attachments.splice(index, 1);
    const detachedToken = detached.token;
    
    delete detachedToken._attachedTo;
    delete detachedToken._attachmentType;
    
    engine.emit("token:detached", { host, detachedToken, type: detached.type });
    return detachedToken;
  },
  
  "token:merge": (engine: Engine, { tokens = [], resultProperties = {}, keepOriginals = false }: TokenPayload = {}) => {
    if (!tokens || tokens.length < 2) throw new Error("At least 2 tokens required to merge");
    
    const baseToken = tokens[0];
    const mergedToken: any = { ...baseToken, ...resultProperties, _mergedFrom: tokens.map(t => t.id), _mergedAt: Date.now() };
    
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
  
  "token:split": (engine: Engine, { token, count = 2, properties = [] }: TokenPayload = {}) => {
    if (!token) throw new Error("No token provided to split");
    if (count < 2) throw new Error("Split count must be at least 2");
    
    const splitTokens: IToken[] = [];
    
    // @ts-ignore properties array handling
    for (let i = 0; i < count; i++) {
      const customProps = (properties as any[])[i] || {};
      const { meta: customMeta, ...otherCustomProps } = customProps;
      
      const splitToken: any = {
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

export const BatchActions = {
  "tokens:filter": (engine: Engine, { tokens = [], predicate, source = null }: BatchPayload = {}) => {
    if (!predicate || typeof predicate !== 'function') throw new Error("Predicate function required");
    
    let tokensToFilter = tokens;
    if (source === 'deck' && engine.deck) {
      tokensToFilter = engine.deck.tokens || [];
    } else if (source === 'table' && engine.table) {
      // @ts-ignore - Engine.table is typed but methods might not be fully typed yet
      tokensToFilter = engine.table.allCards() || [];
    } else if (source && engine.table) {
      // @ts-ignore
      tokensToFilter = engine.table.zone(source).map((p: any) => p.token || p.card) || [];
    }
    
    const filtered = tokensToFilter.filter(predicate);
    engine.emit("tokens:filtered", { source: source || 'provided', count: filtered.length, total: tokensToFilter.length });
    return filtered;
  },
  
  "tokens:forEach": (engine: Engine, { tokens = [], operation, source = null }: BatchPayload = {}) => {
    if (!operation || typeof operation !== 'function') throw new Error("Operation function required");
    
    let tokensToProcess = tokens;
    if (source === 'deck' && engine.deck) {
      tokensToProcess = engine.deck.tokens || [];
    } else if (source === 'table' && engine.table) {
      // @ts-ignore
      tokensToProcess = engine.table.allCards() || [];
    } else if (source && engine.table) {
      // @ts-ignore
      tokensToProcess = engine.table.zone(source).map((p: any) => p.token || p.card) || [];
    }
    
    const results: any[] = [];
    tokensToProcess.forEach((token, index) => {
      try {
        const result = operation(token, index);
        results.push(result);
      } catch (error) {
        engine.emit("tokens:forEach:error", { token, error });
      }
    });
    engine.emit("tokens:forEach:complete", { count: tokensToProcess.length });
    return results;
  },
  
  "tokens:collect": (engine: Engine, { sources = [], includeAttachments = false }: BatchPayload = {}) => {
    if (!Array.isArray(sources) || sources.length === 0) throw new Error("Sources array required");
    
    const collected: IToken[] = [];
    
    sources.forEach(source => {
      let tokensFromSource: IToken[] = [];
      
      if (source === 'deck' && engine.deck) {
        tokensFromSource = engine.deck.tokens || [];
      } else if (source === 'table' && engine.table) {
        // @ts-ignore
        tokensFromSource = engine.table.allCards();
      } else if (source === 'discard' && engine.deck) {
        tokensFromSource = engine.deck.discards || [];
      } else if (source === 'shoe' && engine.shoe) {
        // @ts-ignore
        if (engine.shoe._decks) {
          // @ts-ignore
          engine.shoe._decks.forEach((deck: any) => {
            tokensFromSource.push(...(deck._stack || []));
          });
        }
      } else if (engine.table) {
        // @ts-ignore
        const zone = engine.table.zone(source);
        // @ts-ignore
        tokensFromSource = zone.map((p: any) => p.token || p.card);
      }
      
      collected.push(...tokensFromSource);
      
      if (includeAttachments) {
        tokensFromSource.forEach(token => {
          if (token && token._attachments) {
            token._attachments.forEach((att: any) => collected.push(att.token));
          }
        });
      }
    });
    
    engine.emit("tokens:collected", { sources, count: collected.length });
    return collected;
  },
  
  "tokens:count": (engine: Engine, { tokens = [], predicate, source = null }: BatchPayload = {}) => {
    let tokensToCount = tokens;
    if (source === 'deck' && engine.deck) {
      tokensToCount = engine.deck.tokens || [];
    } else if (source === 'table' && engine.table) {
      // @ts-ignore
      tokensToCount = engine.table.allCards() || [];
    } else if (source && engine.table) {
      // @ts-ignore
      tokensToCount = engine.table.zone(source).map((p: any) => p.token || p.card) || [];
    }
    
    if (!predicate) return tokensToCount.length;
    
    const count = tokensToCount.filter(predicate).length;
    engine.emit("tokens:counted", { source: source || 'provided', count, total: tokensToCount.length });
    return count;
  },
  
  "tokens:find": (engine: Engine, { tokens = [], predicate, source = null }: BatchPayload = {}) => {
    if (!predicate || typeof predicate !== 'function') throw new Error("Predicate function required");
    
    let tokensToSearch = tokens;
    if (source === 'deck' && engine.deck) {
      tokensToSearch = engine.deck.tokens || [];
    } else if (source === 'table' && engine.table) {
      // @ts-ignore
      tokensToSearch = engine.table.allCards() || [];
    } else if (source && engine.table) {
      // @ts-ignore
      tokensToSearch = engine.table.zone(source).map((p: any) => p.token || p.card) || [];
    }
    
    const found = tokensToSearch.find(predicate);
    engine.emit("tokens:found", { source: source || 'provided', found: !!found });
    return found || null;
  }
};

export const ExtendedActions = {
  ...DeckActions,
  ...TableActions,
  ...ShoeActions,
  ...PlayerActions,
  ...GameStateActions,
  ...TokenActions,
  ...BatchActions
};

// Total: 58 actions
// - Deck: 8
// - Table: 12
// - Shoe: 6
// - Player: 12 (9 base + 3 transfer)
// - GameState: 6
// - Token: 5
// - Batch: 5