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
 * 
 * This module provides 50 fundamental actions covering:
 * - Deck operations (8 actions)
 * - Table operations (12 actions)
 * - Shoe operations (6 actions)
 * - Player operations (8 actions)
 * - Game state operations (6 actions)
 * - Token transformation operations (5 actions)
 * - Batch/query operations (5 actions)
 * 
 * Import and merge with base ActionRegistry for complete coverage.
 */
 
/*━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  DECK OPERATIONS (8 actions)
  Core card deck manipulation: reset, burn, peek, cut, insert, remove
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━*/

export const DeckActions = {
  /**
   * Reset deck to original unshuffled state
   * Usage: engine.dispatch("deck:reset")
   */
  "deck:reset": (engine) => {
    if (!engine.deck) throw new Error("No deck attached to engine");
    engine.deck.reset();
  },
  
  /**
   * Burn (discard) N cards from top of deck without drawing them
   * Usage: engine.dispatch("deck:burn", { count: 3 })
   */
  "deck:burn": (engine, { count = 1 } = {}) => {
    if (!engine.deck) throw new Error("No deck attached to engine");
    engine.deck.burn(count);
  },
  
  /**
   * Peek at top N cards without removing them from deck
   * Returns array of cards (does not modify deck state)
   * Usage: const cards = engine.dispatch("deck:peek", { count: 3 })
   */
  "deck:peek": (engine, { count = 1 } = {}) => {
    if (!engine.deck) throw new Error("No deck attached to engine");
    const cards = [];
    const stack = engine.deck._stack || [];
    for (let i = 0; i < count && i < stack.length; i++) {
      cards.push(stack[stack.length - 1 - i]);
    }
    return cards;
  },
  
  /**
   * Cut the deck at specified position
   * Usage: engine.dispatch("deck:cut", { position: 26, topToBottom: true })
   */
  "deck:cut": (engine, { position = null, topToBottom = true } = {}) => {
    if (!engine.deck) throw new Error("No deck attached to engine");
    const n = position ?? Math.floor((engine.deck._stack?.length || 0) / 2);
    engine.deck.cut(n, { topToBottom });
  },
  
  /**
   * Insert card at specific position in deck
   * Usage: engine.dispatch("deck:insertAt", { card: myCard, position: 5 })
   */
  "deck:insertAt": (engine, { card, position = 0 } = {}) => {
    if (!engine.deck) throw new Error("No deck attached to engine");
    if (!card) throw new Error("No card provided to insert");
    engine.deck.insertAt(card, position);
  },
  
  /**
   * Remove card at specific position from deck
   * Returns the removed card
   * Usage: const card = engine.dispatch("deck:removeAt", { position: 10 })
   */
  "deck:removeAt": (engine, { position = 0 } = {}) => {
    if (!engine.deck) throw new Error("No deck attached to engine");
    return engine.deck.removeAt(position);
  },
  
  /**
   * Swap two cards in the deck by position
   * Usage: engine.dispatch("deck:swap", { i: 0, j: 51 })
   */
  "deck:swap": (engine, { i, j } = {}) => {
    if (!engine.deck) throw new Error("No deck attached to engine");
    if (i === undefined || j === undefined) {
      throw new Error("Both i and j positions required for swap");
    }
    engine.deck.swap(i, j);
  },
  
  /**
   * Reverse a range of cards in the deck
   * Usage: engine.dispatch("deck:reverse", { start: 0, end: 12 })
   */
  "deck:reverse": (engine, { start = 0, end = null } = {}) => {
    if (!engine.deck) throw new Error("No deck attached to engine");
    const e = end ?? (engine.deck._stack?.length || 0) - 1;
    engine.deck.reverseRange(start, e);
  }
};

/*━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  TABLE OPERATIONS (12 actions)
  Zone and placement management: move, flip, remove, zones, layouts
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━*/

export const TableActions = {
  /**
   * Move a placement from one zone to another
   * Usage: engine.dispatch("table:move", { 
   *   fromZone: "hand", 
   *   toZone: "field", 
   *   placementId: "abc-123" 
   * })
   */
  "table:move": (engine, { fromZone, toZone, placementId } = {}) => {
    if (!engine.table) throw new Error("No table attached to engine");
    if (!fromZone || !toZone) throw new Error("Both fromZone and toZone required");
    if (!placementId) throw new Error("placementId required");
    
    const placement = engine.table.findCard(placementId);
    if (!placement) throw new Error(`Placement ${placementId} not found`);
    
    engine.table.move(fromZone, toZone, placement);
  },
  
  /**
   * Flip a placement face up or face down
   * Usage: engine.dispatch("table:flip", { 
   *   zone: "field", 
   *   placementId: "abc-123", 
   *   faceUp: true 
   * })
   */
  "table:flip": (engine, { zone, placementId, faceUp = null } = {}) => {
    if (!engine.table) throw new Error("No table attached to engine");
    if (!zone) throw new Error("zone required");
    if (!placementId) throw new Error("placementId required");
    
    const placement = engine.table.findCard(placementId);
    if (!placement) throw new Error(`Placement ${placementId} not found`);
    
    engine.table.flip(zone, placement, faceUp);
  },
  
  /**
   * Remove a placement from the table entirely
   * Usage: engine.dispatch("table:remove", { 
   *   zone: "field", 
   *   placementId: "abc-123" 
   * })
   */
  "table:remove": (engine, { zone, placementId } = {}) => {
    if (!engine.table) throw new Error("No table attached to engine");
    if (!zone) throw new Error("zone required");
    if (!placementId) throw new Error("placementId required");
    
    const placement = engine.table.findCard(placementId);
    if (!placement) throw new Error(`Placement ${placementId} not found`);
    
    engine.table.remove(zone, placement);
  },
  
  /**
   * Create a new zone on the table
   * Usage: engine.dispatch("table:createZone", { 
   *   id: "discard", 
   *   label: "Discard Pile", 
   *   x: 100, 
   *   y: 200 
   * })
   */
  "table:createZone": (engine, { id, label = null, x = 0, y = 0 } = {}) => {
    if (!engine.table) throw new Error("No table attached to engine");
    if (!id) throw new Error("Zone id required");
    
    engine.table.createZone(id, { label: label || id, x, y });
  },
  
  /**
   * Delete a zone from the table (cards in zone are removed)
   * Usage: engine.dispatch("table:deleteZone", { id: "temporary" })
   */
  "table:deleteZone": (engine, { id } = {}) => {
    if (!engine.table) throw new Error("No table attached to engine");
    if (!id) throw new Error("Zone id required");
    
    engine.table.deleteZone(id);
  },
  
  /**
   * Clear all cards from a specific zone (zone remains)
   * Usage: engine.dispatch("table:clearZone", { zone: "hand" })
   */
  "table:clearZone": (engine, { zone } = {}) => {
    if (!engine.table) throw new Error("No table attached to engine");
    if (!zone) throw new Error("zone required");
    
    engine.table.clearZone(zone);
  },
  
  /**
   * Shuffle cards within a zone
   * Usage: engine.dispatch("table:shuffleZone", { zone: "deck", seed: 42 })
   */
  "table:shuffleZone": (engine, { zone, seed = null } = {}) => {
    if (!engine.table) throw new Error("No table attached to engine");
    if (!zone) throw new Error("zone required");
    
    engine.table.shuffleZone(zone, seed);
  },
  
  /**
   * Transfer all cards from one zone to another
   * Usage: engine.dispatch("table:transferZone", { 
   *   fromZone: "hand", 
   *   toZone: "discard" 
   * })
   */
  "table:transferZone": (engine, { fromZone, toZone } = {}) => {
    if (!engine.table) throw new Error("No table attached to engine");
    if (!fromZone || !toZone) throw new Error("Both fromZone and toZone required");
    
    engine.table.transferZone(fromZone, toZone);
  },
  
  /**
   * Arrange zone cards in a fan pattern (for display)
   * Usage: engine.dispatch("table:fanZone", { 
   *   zone: "hand", 
   *   radius: 150, 
   *   angleStep: 10 
   * })
   */
  "table:fanZone": (engine, { zone, radius = 100, angleStep = 15, startAngle = 0 } = {}) => {
    if (!engine.table) throw new Error("No table attached to engine");
    if (!zone) throw new Error("zone required");
    
    engine.table.fan(zone, { radius, angleStep, startAngle });
  },
  
  /**
   * Stack zone cards on top of each other (for display)
   * Usage: engine.dispatch("table:stackZone", { zone: "deck" })
   */
  "table:stackZone": (engine, { zone } = {}) => {
    if (!engine.table) throw new Error("No table attached to engine");
    if (!zone) throw new Error("zone required");
    
    engine.table.stackZone(zone);
  },
  
  /**
   * Spread zone cards in a pattern (linear or arc)
   * Usage: engine.dispatch("table:spreadZone", { 
   *   zone: "river", 
   *   pattern: "linear", 
   *   angleStep: 20 
   * })
   */
  "table:spreadZone": (engine, { zone, pattern = "linear", angleStep = 15, radius = 100 } = {}) => {
    if (!engine.table) throw new Error("No table attached to engine");
    if (!zone) throw new Error("zone required");
    
    engine.table.spreadZone(zone, { pattern, angleStep, radius });
  },
  
  /**
   * Lock a zone to prevent modifications
   * Usage: engine.dispatch("table:lockZone", { zone: "deck", locked: true })
   */
  "table:lockZone": (engine, { zone, locked = true } = {}) => {
    if (!engine.table) throw new Error("No table attached to engine");
    if (!zone) throw new Error("zone required");
    
    engine.table.lockZone(zone, locked);
  }
};

/*━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  SHOE OPERATIONS (6 actions)
  Multi-deck shoe management: shuffle, burn, reset, add/remove decks
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━*/

export const ShoeActions = {
  /**
   * Shuffle all cards in the shoe
   * Usage: engine.dispatch("shoe:shuffle", { seed: 42 })
   */
  "shoe:shuffle": (engine, { seed = null } = {}) => {
    if (!engine.shoe) throw new Error("No shoe attached to engine");
    engine.shoe.shuffle(seed);
  },
  
  /**
   * Burn (discard) N cards from shoe
   * Usage: engine.dispatch("shoe:burn", { count: 5 })
   */
  "shoe:burn": (engine, { count = 1 } = {}) => {
    if (!engine.shoe) throw new Error("No shoe attached to engine");
    engine.shoe.burn(count);
  },
  
  /**
   * Reset shoe to original state (all decks restored)
   * Usage: engine.dispatch("shoe:reset")
   */
  "shoe:reset": (engine) => {
    if (!engine.shoe) throw new Error("No shoe attached to engine");
    engine.shoe.reset();
  },
  
  /**
   * Add another deck to the shoe
   * Usage: engine.dispatch("shoe:addDeck", { deck: myDeck })
   */
  "shoe:addDeck": (engine, { deck } = {}) => {
    if (!engine.shoe) throw new Error("No shoe attached to engine");
    if (!deck) throw new Error("deck required");
    engine.shoe.addDeck(deck);
  },
  
  /**
   * Remove a specific deck from the shoe
   * Usage: engine.dispatch("shoe:removeDeck", { deck: myDeck })
   */
  "shoe:removeDeck": (engine, { deck } = {}) => {
    if (!engine.shoe) throw new Error("No shoe attached to engine");
    if (!deck) throw new Error("deck required");
    engine.shoe.removeDeck(deck);
  },
  
  /**
   * Get shoe statistics (remaining cards, burned, etc.)
   * Returns object with shoe state
   * Usage: const stats = engine.dispatch("shoe:inspect")
   */
  "shoe:inspect": (engine) => {
    if (!engine.shoe) throw new Error("No shoe attached to engine");
    return engine.shoe.inspect();
  }
};

/*━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  PLAYER OPERATIONS (8 actions)
  Player management: create, remove, resources, cards, state
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━*/

export const PlayerActions = {
  /**
   * Create a new player and add to game
   * Usage: engine.dispatch("player:create", { 
   *   name: "Alice", 
   *   agent: myAgent, 
   *   meta: { color: "blue" } 
   * })
   */
  "player:create": (engine, { name, agent = null, meta = {} } = {}) => {
    if (!name) throw new Error("Player name required");
    if (!engine._players) engine._players = [];
    
    // Check for duplicate
    if (engine._players.find(p => p.name === name)) {
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
  
  /**
   * Remove a player from the game
   * Usage: engine.dispatch("player:remove", { name: "Alice" })
   */
  "player:remove": (engine, { name } = {}) => {
    if (!name) throw new Error("Player name required");
    if (!engine._players) return;
    
    const index = engine._players.findIndex(p => p.name === name);
    if (index === -1) throw new Error(`Player ${name} not found`);
    
    engine._players.splice(index, 1);
  },
  
  /**
   * Set player active/inactive (for folding, elimination, etc.)
   * Usage: engine.dispatch("player:setActive", { name: "Alice", active: false })
   */
  "player:setActive": (engine, { name, active = true } = {}) => {
    if (!name) throw new Error("Player name required");
    const player = engine._players?.find(p => p.name === name);
    if (!player) throw new Error(`Player ${name} not found`);
    
    player.active = active;
  },
  
  /**
   * Give resource to player (chips, points, life, etc.)
   * Usage: engine.dispatch("player:giveResource", { 
   *   name: "Alice", 
   *   resource: "chips", 
   *   amount: 100 
   * })
   */
  "player:giveResource": (engine, { name, resource, amount = 1 } = {}) => {
    if (!name) throw new Error("Player name required");
    if (!resource) throw new Error("Resource type required");
    
    const player = engine._players?.find(p => p.name === name);
    if (!player) throw new Error(`Player ${name} not found`);
    
    if (!player.resources) player.resources = {};
    player.resources[resource] = (player.resources[resource] || 0) + amount;
  },
  
  /**
   * Take resource from player
   * Usage: engine.dispatch("player:takeResource", { 
   *   name: "Alice", 
   *   resource: "chips", 
   *   amount: 50 
   * })
   */
  "player:takeResource": (engine, { name, resource, amount = 1 } = {}) => {
    if (!name) throw new Error("Player name required");
    if (!resource) throw new Error("Resource type required");
    
    const player = engine._players?.find(p => p.name === name);
    if (!player) throw new Error(`Player ${name} not found`);
    
    if (!player.resources) player.resources = {};
    player.resources[resource] = Math.max(0, (player.resources[resource] || 0) - amount);
  },
  
  /**
   * Player draws N cards from deck to their hand
   * Usage: engine.dispatch("player:drawCards", { name: "Alice", count: 5 })
   */
  "player:drawCards": (engine, { name, count = 1, source = "deck" } = {}) => {
    if (!name) throw new Error("Player name required");
    
    const player = engine._players?.find(p => p.name === name);
    if (!player) throw new Error(`Player ${name} not found`);
    
    if (!player.hand) player.hand = [];
    
    const drawSource = source === "shoe" ? engine.shoe : engine.deck;
    if (!drawSource) throw new Error(`No ${source} attached to engine`);
    
    for (let i = 0; i < count; i++) {
      const card = drawSource.draw ? drawSource.draw() : null;
      if (card) player.hand.push(card);
    }
  },
  
  /**
   * Player discards specific cards from hand
   * Usage: engine.dispatch("player:discardCards", { 
   *   name: "Alice", 
   *   cards: [card1, card2] 
   * })
   */
  "player:discardCards": (engine, { name, cards } = {}) => {
    if (!name) throw new Error("Player name required");
    if (!cards) throw new Error("Cards required");
    
    const player = engine._players?.find(p => p.name === name);
    if (!player) throw new Error(`Player ${name} not found`);
    
    if (!player.hand) player.hand = [];
    
    const cardArray = Array.isArray(cards) ? cards : [cards];
    player.hand = player.hand.filter(c => !cardArray.includes(c));
    
    // Optionally add to deck's discard pile
    if (engine.deck) {
      cardArray.forEach(c => engine.deck.discard(c));
    }
  },
  
  /**
   * Get player state (resources, hand, etc.)
   * Returns player object
   * Usage: const player = engine.dispatch("player:get", { name: "Alice" })
   */
  "player:get": (engine, { name } = {}) => {
    if (!name) throw new Error("Player name required");
    const player = engine._players?.find(p => p.name === name);
    if (!player) throw new Error(`Player ${name} not found`);
    return player;
  }
};

/*━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  GAME STATE OPERATIONS (6 actions)
  High-level game flow: start, end, pause, phases
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━*/

export const GameStateActions = {
  /**
   * Initialize game state (call at game start)
   * Usage: engine.dispatch("game:start")
   */
  "game:start": (engine) => {
    if (!engine._gameState) engine._gameState = {};
    
    engine._gameState = {
      ...engine._gameState,
      started: true,
      startTime: Date.now(),
      phase: "setup",
      turn: 0,
      ended: false
    };
  },
  
  /**
   * End the game and record winner
   * Usage: engine.dispatch("game:end", { 
   *   winner: "Alice", 
   *   reason: "victory" 
   * })
   */
  "game:end": (engine, { winner = null, reason = null } = {}) => {
    if (!engine._gameState) engine._gameState = {};
    
    engine._gameState = {
      ...engine._gameState,
      ended: true,
      endTime: Date.now(),
      winner,
      reason
    };
  },
  
  /**
   * Pause the game (for save/load)
   * Usage: engine.dispatch("game:pause")
   */
  "game:pause": (engine) => {
    if (!engine._gameState) engine._gameState = {};
    
    engine._gameState = {
      ...engine._gameState,
      paused: true,
      pauseTime: Date.now()
    };
  },
  
  /**
   * Resume a paused game
   * Usage: engine.dispatch("game:resume")
   */
  "game:resume": (engine) => {
    if (!engine._gameState) engine._gameState = {};
    
    const pauseTime = engine._gameState.pauseTime || Date.now();
    const pauseDuration = Date.now() - pauseTime;
    
    engine._gameState = {
      ...engine._gameState,
      paused: false,
      resumeTime: Date.now(),
      totalPauseDuration: (engine._gameState.totalPauseDuration || 0) + pauseDuration
    };
  },
  
  /**
   * Advance to next phase (setup -> play -> end, etc.)
   * Usage: engine.dispatch("game:nextPhase", { phase: "play" })
   */
  "game:nextPhase": (engine, { phase = null } = {}) => {
    if (!engine._gameState) engine._gameState = {};
    
    if (phase) {
      engine._gameState.phase = phase;
    } else {
      // Auto-advance through default phases
      const phases = ["setup", "play", "scoring", "end"];
      const currentIndex = phases.indexOf(engine._gameState.phase || "setup");
      const nextIndex = Math.min(currentIndex + 1, phases.length - 1);
      engine._gameState.phase = phases[nextIndex];
    }
  },
  
  /**
   * Set arbitrary game state property
   * Usage: engine.dispatch("game:setProperty", { key: "round", value: 3 })
   */
  "game:setProperty": (engine, { key, value } = {}) => {
    if (!key) throw new Error("Property key required");
    if (!engine._gameState) engine._gameState = {};
    
    engine._gameState[key] = value;
  }
};

/*━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  TOKEN TRANSFORMATION/MUTATION (5 actions)
  Modify token properties without moving them - for state changes, attachments
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━*/

export const TokenActions = {
  /**
   * Transform token properties (modify metadata, label, text, etc.)
   * Useful for: flipping cards, changing state, applying effects
   * Usage: engine.dispatch("token:transform", { 
   *   token: myToken, 
   *   properties: { meta: { status: "tapped" }, label: "Tapped Card" }
   * })
   */
  "token:transform": (engine, { token, properties = {} } = {}) => {
    if (!token) throw new Error("No token provided to transform");
    
    // Handle meta separately to ensure proper merging
    const { meta, ...otherProperties } = properties;
    
    // Apply non-meta properties
    Object.assign(token, otherProperties);
    
    // Merge meta properties if provided
    if (meta && typeof meta === 'object') {
      token.meta = { ...token.meta, ...meta };
    }
    
    // Emit event for tracking
    engine.eventBus?.emit?.("token:transformed", { token, properties });
    
    return token;
  },
  
  /**
   * Attach one token to another (equipment, enchantments, status effects)
   * Creates a relationship where the attached token modifies the host
   * Usage: engine.dispatch("token:attach", { 
   *   host: characterToken, 
   *   attachment: swordToken,
   *   attachmentType: "equipment"
   * })
   */
  "token:attach": (engine, { host, attachment, attachmentType = "default" } = {}) => {
    if (!host) throw new Error("No host token provided");
    if (!attachment) throw new Error("No attachment token provided");
    
    // Initialize attachments array if it doesn't exist
    if (!host._attachments) {
      host._attachments = [];
    }
    
    // Create attachment record
    const attachmentRecord = {
      token: attachment,
      type: attachmentType,
      attachedAt: Date.now(),
      id: attachment.id
    };
    
    host._attachments.push(attachmentRecord);
    
    // Mark the attachment token as attached
    attachment._attachedTo = host.id;
    attachment._attachmentType = attachmentType;
    
    engine.eventBus?.emit?.("token:attached", { host, attachment, attachmentType });
    
    return host;
  },
  
  /**
   * Detach a token from its host
   * Usage: engine.dispatch("token:detach", { 
   *   host: characterToken, 
   *   attachmentId: "sword-001" 
   * })
   */
  "token:detach": (engine, { host, attachmentId = null, attachment = null } = {}) => {
    if (!host) throw new Error("No host token provided");
    if (!host._attachments || host._attachments.length === 0) {
      return null; // Nothing to detach
    }
    
    // Find attachment by ID or by reference
    const targetId = attachmentId || attachment?.id;
    const index = host._attachments.findIndex(a => a.id === targetId || a.token === attachment);
    
    if (index === -1) {
      return null; // Attachment not found
    }
    
    // Remove attachment
    const [detached] = host._attachments.splice(index, 1);
    const detachedToken = detached.token;
    
    // Clean up attachment token metadata
    delete detachedToken._attachedTo;
    delete detachedToken._attachmentType;
    
    engine.eventBus?.emit?.("token:detached", { host, detachedToken, type: detached.type });
    
    return detachedToken;
  },
  
  /**
   * Merge multiple tokens into a single token
   * Useful for: combining resources, upgrading units, crafting
   * Usage: engine.dispatch("token:merge", { 
   *   tokens: [token1, token2, token3],
   *   resultProperties: { label: "Combined Token", meta: { power: 10 } },
   *   keepOriginals: false
   * })
   */
  "token:merge": (engine, { tokens = [], resultProperties = {}, keepOriginals = false } = {}) => {
    if (!tokens || tokens.length < 2) {
      throw new Error("At least 2 tokens required to merge");
    }
    
    // Create merged token from first token as base
    const baseToken = tokens[0];
    const mergedToken = {
      ...baseToken,
      ...resultProperties,
      _mergedFrom: tokens.map(t => t.id),
      _mergedAt: Date.now()
    };
    
    // Merge meta objects if not overridden
    if (!resultProperties.meta) {
      mergedToken.meta = tokens.reduce((acc, token) => {
        return { ...acc, ...token.meta };
      }, {});
    }
    
    // Mark original tokens as merged (if not keeping them)
    if (!keepOriginals) {
      tokens.forEach(token => {
        token._merged = true;
        token._mergedInto = mergedToken.id;
      });
    }
    
    engine.eventBus?.emit?.("token:merged", { tokens, mergedToken, keepOriginals });
    
    return mergedToken;
  },
  
  /**
   * Split a token into multiple tokens
   * Useful for: breaking combined resources, dividing stacks
   * Usage: engine.dispatch("token:split", { 
   *   token: stackToken,
   *   count: 3,
   *   properties: [{ label: "Part 1" }, { label: "Part 2" }, { label: "Part 3" }]
   * })
   */
  "token:split": (engine, { token, count = 2, properties = [] } = {}) => {
    if (!token) throw new Error("No token provided to split");
    if (count < 2) throw new Error("Split count must be at least 2");
    
    const splitTokens = [];
    
    for (let i = 0; i < count; i++) {
      const customProps = properties[i] || {};
      const { meta: customMeta, ...otherCustomProps } = customProps;
      
      const splitToken = {
        ...token,
        id: `${token.id}-split-${i}`,
        ...otherCustomProps,
        meta: { ...token.meta, ...(customMeta || {}) }, // Merge meta properly
        _splitFrom: token.id,
        _splitIndex: i,
        _splitAt: Date.now()
      };
      
      splitTokens.push(splitToken);
    }
    
    // Mark original token as split
    token._split = true;
    token._splitInto = splitTokens.map(t => t.id);
    
    engine.eventBus?.emit?.("token:split", { originalToken: token, splitTokens, count });
    
    return splitTokens;
  }
};

/*━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  BATCH/QUERY OPERATIONS (5 actions)
  Operate on collections of tokens - filtering, searching, counting, batch operations
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━*/

export const BatchActions = {
  /**
   * Filter tokens by criteria
   * Returns all tokens matching the predicate function
   * Usage: const redCards = engine.dispatch("tokens:filter", {
   *   tokens: deck.cards,
   *   predicate: (token) => token.meta.color === "red"
   * })
   */
  "tokens:filter": (engine, { tokens = [], predicate, source = null } = {}) => {
    if (!predicate || typeof predicate !== 'function') {
      throw new Error("Predicate function required for tokens:filter");
    }
    
    // If source is provided, get tokens from there
    let tokensToFilter = tokens;
    if (source === 'deck' && engine.deck) {
      tokensToFilter = engine.deck._stack || [];
    } else if (source === 'table' && engine.table) {
      tokensToFilter = engine.table.allCards() || [];
    } else if (source && engine.table) {
      // Try as zone name
      tokensToFilter = engine.table.zone(source).map(p => p.token || p.card) || [];
    }
    
    const filtered = tokensToFilter.filter(predicate);
    
    engine.eventBus?.emit?.("tokens:filtered", { 
      source: source || 'provided', 
      count: filtered.length,
      total: tokensToFilter.length 
    });
    
    return filtered;
  },
  
  /**
   * Apply an operation to each token in a collection
   * Usage: engine.dispatch("tokens:forEach", {
   *   tokens: playerHand,
   *   operation: (token) => token.meta.buffed = true
   * })
   */
  "tokens:forEach": (engine, { tokens = [], operation, source = null } = {}) => {
    if (!operation || typeof operation !== 'function') {
      throw new Error("Operation function required for tokens:forEach");
    }
    
    // If source is provided, get tokens from there
    let tokensToProcess = tokens;
    if (source === 'deck' && engine.deck) {
      tokensToProcess = engine.deck._stack || [];
    } else if (source === 'table' && engine.table) {
      tokensToProcess = engine.table.allCards() || [];
    } else if (source && engine.table) {
      // Try as zone name
      tokensToProcess = engine.table.zone(source).map(p => p.token || p.card) || [];
    }
    
    const results = [];
    tokensToProcess.forEach((token, index) => {
      try {
        const result = operation(token, index);
        results.push(result);
      } catch (error) {
        engine.eventBus?.emit?.("tokens:forEach:error", { token, error });
      }
    });
    
    engine.eventBus?.emit?.("tokens:forEach:complete", { 
      count: tokensToProcess.length 
    });
    
    return results;
  },
  
  /**
   * Collect tokens from multiple sources into a single array
   * Usage: const allTokens = engine.dispatch("tokens:collect", {
   *   sources: ['deck', 'table', 'discard']
   * })
   */
  "tokens:collect": (engine, { sources = [], includeAttachments = false } = {}) => {
    if (!Array.isArray(sources) || sources.length === 0) {
      throw new Error("Sources array required for tokens:collect");
    }
    
    const collected = [];
    
    sources.forEach(source => {
      let tokensFromSource = [];
      
      if (source === 'deck' && engine.deck) {
        tokensFromSource = engine.deck._stack || [];
      } else if (source === 'table' && engine.table) {
        tokensFromSource = engine.table.allCards();
      } else if (source === 'discard' && engine.deck) {
        tokensFromSource = engine.deck._discards || [];
      } else if (source === 'shoe' && engine.shoe) {
        // Collect from shoe's decks
        if (engine.shoe._decks) {
          engine.shoe._decks.forEach(deck => {
            tokensFromSource.push(...(deck._stack || []));
          });
        }
      } else if (engine.table) {
        // Try as zone name
        const zone = engine.table.zone(source);
        tokensFromSource = zone.map(p => p.token || p.card);
      }
      
      // Add tokens from this source
      collected.push(...tokensFromSource);
      
      // Optionally include attachments from all collected tokens
      if (includeAttachments) {
        tokensFromSource.forEach(token => {
          if (token && token._attachments) {
            token._attachments.forEach(att => collected.push(att.token));
          }
        });
      }
    });
    
    engine.eventBus?.emit?.("tokens:collected", { 
      sources, 
      count: collected.length 
    });
    
    return collected;
  },
  
  /**
   * Count tokens matching criteria
   * Usage: const redCount = engine.dispatch("tokens:count", {
   *   tokens: deck.cards,
   *   predicate: (token) => token.meta.color === "red"
   * })
   */
  "tokens:count": (engine, { tokens = [], predicate = null, source = null } = {}) => {
    // If source is provided, get tokens from there
    let tokensToCount = tokens;
    if (source === 'deck' && engine.deck) {
      tokensToCount = engine.deck._stack || [];
    } else if (source === 'table' && engine.table) {
      tokensToCount = engine.table.allCards() || [];
    } else if (source && engine.table) {
      // Try as zone name
      tokensToCount = engine.table.zone(source).map(p => p.token || p.card) || [];
    }
    
    // If no predicate, return total count
    if (!predicate) {
      return tokensToCount.length;
    }
    
    // Count matching tokens
    const count = tokensToCount.filter(predicate).length;
    
    engine.eventBus?.emit?.("tokens:counted", { 
      source: source || 'provided',
      count,
      total: tokensToCount.length 
    });
    
    return count;
  },
  
  /**
   * Find first token matching criteria
   * Returns the first token that matches the predicate, or null
   * Usage: const aceOfSpades = engine.dispatch("tokens:find", {
   *   tokens: deck.cards,
   *   predicate: (token) => token.id === "spades-ace"
   * })
   */
  "tokens:find": (engine, { tokens = [], predicate, source = null } = {}) => {
    if (!predicate || typeof predicate !== 'function') {
      throw new Error("Predicate function required for tokens:find");
    }
    
    // If source is provided, get tokens from there
    let tokensToSearch = tokens;
    if (source === 'deck' && engine.deck) {
      tokensToSearch = engine.deck._stack || [];
    } else if (source === 'table' && engine.table) {
      tokensToSearch = engine.table.allCards() || [];
    } else if (source && engine.table) {
      // Try as zone name
      tokensToSearch = engine.table.zone(source).map(p => p.token || p.card) || [];
    }
    
    const found = tokensToSearch.find(predicate);
    
    engine.eventBus?.emit?.("tokens:found", { 
      source: source || 'provided',
      found: !!found 
    });
    
    return found || null;
  }
};

/*━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  COMBINED EXPORT
  All action categories merged into single object
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━*/

export const ExtendedActions = {
  ...DeckActions,
  ...TableActions,
  ...ShoeActions,
  ...PlayerActions,
  ...GameStateActions,
  ...TokenActions,
  ...BatchActions
};

// Total: 50 actions
// - Deck: 8
// - Table: 12
// - Shoe: 6
// - Player: 8
// - GameState: 6
// - Token: 5
// - Batch: 5