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
 * Resource Management Rule Patterns
 * 
 * Patterns for enforcing limits, costs, and constraints on game resources
 * like cards, chips, energy, health, etc.
 */

/**
 * Register hand size limit enforcement
 * Automatically discards excess cards when hand exceeds maximum
 * 
 * @param {RuleEngine} ruleEngine
 * @param {Object} opts - Configuration options
 * @param {number} opts.maxSize - Maximum hand size (default: 7)
 * @param {string} opts.triggerAction - Action that triggers check (default: "player:drawCards")
 * @param {string} opts.discardMode - "auto" or "choice" (default: "auto")
 */
export function registerHandSizeLimit(ruleEngine, opts = {}) {
  const {
    maxSize = 7,
    triggerAction = "player:drawCards",
    discardMode = "auto"
  } = opts;
  
  ruleEngine.addRule(
    "enforce-hand-limit",
    (engine, lastAction) => {
      if (!lastAction || lastAction.type !== triggerAction) return false;
      
      const player = engine._players?.find(p => 
        p.hand?.length > maxSize
      );
      
      return !!player;
    },
    (engine) => {
      const player = engine._players.find(p => p.hand.length > maxSize);
      const excess = player.hand.length - maxSize;
      
      if (discardMode === "auto") {
        // Auto-discard from end of hand
        const toDiscard = player.hand.slice(-excess);
        
        engine.dispatch("player:discardCards", {
          name: player.name,
          cards: toDiscard
        });
        
        engine.emit("hand:limitEnforced", {
          payload: {
            player: player.name,
            discarded: excess,
            auto: true
          }
        });
      } else {
        // Set flag requiring player choice
        player.mustDiscard = excess;
        engine._gameState.waitingForDiscard = player.name;
        
        engine.emit("hand:mustDiscard", {
          payload: {
            player: player.name,
            count: excess
          }
        });
      }
    },
    { priority: 100 }
  );
}

/**
 * Register resource cost enforcement
 * Automatically deducts costs when actions are performed
 * 
 * @param {RuleEngine} ruleEngine
 * @param {Object} opts - Configuration options
 * @param {Object} opts.costs - Map of action types to costs { "action:type": { resource: amount } }
 * @param {boolean} opts.preventOverdraw - Prevent negative resources (default: true)
 */
export function registerResourceCosts(ruleEngine, opts = {}) {
  const {
    costs = {},
    preventOverdraw = true
  } = opts;
  
  const actionTypes = Object.keys(costs);
  
  if (actionTypes.length === 0) return;
  
  // Check if action has sufficient resources (if preventOverdraw is true)
  if (preventOverdraw) {
    ruleEngine.addRule(
      "check-resource-costs",
      (engine, lastAction) => {
        if (!lastAction || !actionTypes.includes(lastAction.type)) return false;
        
        const activePlayer = engine._players?.find(p => p.active);
        if (!activePlayer) return false;
        
        const cost = costs[lastAction.type];
        const insufficient = Object.entries(cost).some(([resource, amount]) => {
          const current = activePlayer.resources?.[resource] || 0;
          return current < amount;
        });
        
        return insufficient;
      },
      (engine) => {
        // Undo the action
        engine.undo();
        
        const activePlayer = engine._players.find(p => p.active);
        
        engine.emit("action:insufficientResources", {
          payload: {
            player: activePlayer.name,
            action: engine.history[engine.history.length - 1]?.type
          }
        });
      },
      { priority: 200 } // High priority - validate before other rules
    );
  }
  
  // Deduct resources after action
  ruleEngine.addRule(
    "deduct-resource-costs",
    (engine, lastAction) => {
      return lastAction && actionTypes.includes(lastAction.type);
    },
    (engine) => {
      const activePlayer = engine._players?.find(p => p.active);
      if (!activePlayer) return;
      
      const cost = costs[lastAction.type];
      
      Object.entries(cost).forEach(([resource, amount]) => {
        engine.dispatch("player:takeResource", {
          name: activePlayer.name,
          resource,
          amount
        });
      });
    },
    { priority: 95 }
  );
}

/**
 * Register negative resource prevention
 * Ensures resources never go below zero
 * 
 * @param {RuleEngine} ruleEngine
 * @param {Object} opts - Configuration options
 * @param {Array<string>} opts.resources - Resources to protect (default: all)
 * @param {Function} opts.onViolation - Callback when negative detected
 */
export function registerNegativePrevention(ruleEngine, opts = {}) {
  const {
    resources = null,
    onViolation = null
  } = opts;
  
  ruleEngine.addRule(
    "prevent-negative-resources",
    (engine, lastAction) => {
      // Check after any resource-modifying action
      if (!lastAction?.type.includes("Resource")) return false;
      
      const player = engine._players?.find(p => {
        const resourcesToCheck = resources || Object.keys(p.resources || {});
        return resourcesToCheck.some(r => (p.resources?.[r] || 0) < 0);
      });
      
      return !!player;
    },
    (engine) => {
      engine._players.forEach(p => {
        const resourcesToCheck = resources || Object.keys(p.resources || {});
        
        resourcesToCheck.forEach(resource => {
          if ((p.resources?.[resource] || 0) < 0) {
            const deficit = p.resources[resource];
            p.resources[resource] = 0;
            
            if (onViolation) {
              onViolation(engine, p, resource, deficit);
            }
            
            engine.emit("resource:negative", {
              payload: {
                player: p.name,
                resource,
                deficit
              }
            });
          }
        });
      });
    },
    { priority: 150 }
  );
}

/**
 * Register resource maximum caps
 * Prevents resources from exceeding maximum values
 * 
 * @param {RuleEngine} ruleEngine
 * @param {Object} opts - Configuration options
 * @param {Object} opts.maxima - Map of resource names to maximum values
 * @param {string} opts.overflowMode - "cap" or "refund" (default: "cap")
 */
export function registerResourceMaxima(ruleEngine, opts = {}) {
  const {
    maxima = {},
    overflowMode = "cap"
  } = opts;
  
  ruleEngine.addRule(
    "enforce-resource-maxima",
    (engine, lastAction) => {
      // Check after any resource-gaining action
      if (!lastAction?.type.includes("giveResource")) return false;
      
      const player = engine._players?.find(p => {
        return Object.entries(maxima).some(([resource, max]) => {
          return (p.resources?.[resource] || 0) > max;
        });
      });
      
      return !!player;
    },
    (engine) => {
      engine._players.forEach(p => {
        Object.entries(maxima).forEach(([resource, max]) => {
          const current = p.resources?.[resource] || 0;
          
          if (current > max) {
            const overflow = current - max;
            
            if (overflowMode === "cap") {
              p.resources[resource] = max;
            } else if (overflowMode === "refund") {
              // Convert overflow to another resource (if defined)
              p.resources[resource] = max;
              p.resources.overflow = (p.resources.overflow || 0) + overflow;
            }
            
            engine.emit("resource:overflow", {
              payload: {
                player: p.name,
                resource,
                overflow,
                mode: overflowMode
              }
            });
          }
        });
      });
    },
    { priority: 90 }
  );
}

/**
 * Register periodic resource generation
 * Automatically gives resources to players each turn/phase
 * 
 * @param {RuleEngine} ruleEngine
 * @param {Object} opts - Configuration options
 * @param {string} opts.trigger - When to generate: "turn", "round", "phase"
 * @param {Object} opts.amounts - Resources to generate { resource: amount }
 * @param {Function} opts.condition - Optional condition function
 */
export function registerResourceGeneration(ruleEngine, opts = {}) {
  const {
    trigger = "turn",
    amounts = {},
    condition = null
  } = opts;
  
  ruleEngine.addRule(
    "generate-resources",
    (engine, lastAction) => {
      let shouldGenerate = false;
      
      if (trigger === "turn") {
        shouldGenerate = lastAction?.type === "player:endTurn";
      } else if (trigger === "round") {
        shouldGenerate = engine._gameState?.roundComplete === true;
      } else if (trigger === "phase") {
        shouldGenerate = lastAction?.type === "game:nextPhase";
      }
      
      if (shouldGenerate && condition) {
        shouldGenerate = condition(engine, lastAction);
      }
      
      return shouldGenerate;
    },
    (engine) => {
      const players = engine._players || [];
      
      players.forEach(p => {
        if (p.status === "eliminated") return;
        
        Object.entries(amounts).forEach(([resource, amount]) => {
          engine.dispatch("player:giveResource", {
            name: p.name,
            resource,
            amount
          });
        });
      });
      
      engine.emit("resources:generated", {
        payload: { amounts }
      });
    },
    { priority: 85 }
  );
}

/**
 * Register resource decay/drain
 * Periodically removes resources from players
 * 
 * @param {RuleEngine} ruleEngine
 * @param {Object} opts - Configuration options
 * @param {string} opts.trigger - When to drain: "turn", "round", "time"
 * @param {Object} opts.amounts - Resources to drain { resource: amount }
 * @param {number} opts.interval - Time interval in ms (for "time" trigger)
 */
export function registerResourceDecay(ruleEngine, opts = {}) {
  const {
    trigger = "turn",
    amounts = {},
    interval = 10000
  } = opts;
  
  ruleEngine.addRule(
    "drain-resources",
    (engine, lastAction) => {
      if (trigger === "turn") {
        return lastAction?.type === "player:endTurn";
      } else if (trigger === "round") {
        return engine._gameState?.roundComplete === true;
      } else if (trigger === "time") {
        const lastDrain = engine._gameState?.lastDrainTime || 0;
        return Date.now() - lastDrain >= interval;
      }
      
      return false;
    },
    (engine) => {
      const players = engine._players || [];
      
      players.forEach(p => {
        if (p.status === "eliminated") return;
        
        Object.entries(amounts).forEach(([resource, amount]) => {
          engine.dispatch("player:takeResource", {
            name: p.name,
            resource,
            amount
          });
        });
      });
      
      if (trigger === "time") {
        if (!engine._gameState) engine._gameState = {};
        engine._gameState.lastDrainTime = Date.now();
      }
      
      engine.emit("resources:drained", {
        payload: { amounts }
      });
    },
    { priority: 85 }
  );
}

/**
 * Register elimination on resource depletion
 * Player is eliminated when a critical resource reaches zero
 * 
 * @param {RuleEngine} ruleEngine
 * @param {Object} opts - Configuration options
 * @param {string} opts.resource - Critical resource (e.g., "health", "lives")
 * @param {number} opts.threshold - Value at which player is eliminated (default: 0)
 */
export function registerEliminationOnDepletion(ruleEngine, opts = {}) {
  const {
    resource = "health",
    threshold = 0
  } = opts;
  
  ruleEngine.addRule(
    `eliminate-on-${resource}-depleted`,
    (engine, lastAction) => {
      // Check after resource changes
      if (!lastAction?.type.includes("Resource")) return false;
      
      const player = engine._players?.find(p => {
        const value = p.resources?.[resource] || 0;
        return value <= threshold && p.status !== "eliminated";
      });
      
      return !!player;
    },
    (engine) => {
      const player = engine._players.find(p => {
        const value = p.resources?.[resource] || 0;
        return value <= threshold && p.status !== "eliminated";
      });
      
      player.status = "eliminated";
      player.active = false;
      player.alive = false;
      
      engine.emit("player:eliminated", {
        payload: {
          player: player.name,
          reason: `${resource}_depleted`
        }
      });
      
      // Check if this triggers game end
      const remaining = engine._players.filter(p => p.status !== "eliminated");
      if (remaining.length === 1) {
        engine.dispatch("game:end", {
          winner: remaining[0].name,
          reason: "elimination"
        });
      }
    },
    { priority: 110 }
  );
}

/**
 * Example: Setting up resource limits for a card game
 */
export function exampleUsage() {
  /*
  import { RuleEngine } from './RuleEngine.js';
  import { 
    registerHandSizeLimit,
    registerResourceCosts,
    registerResourceGeneration
  } from './resource-limits.js';
  
  const engine = new Engine({ ... });
  const ruleEngine = new RuleEngine(engine);
  
  // Enforce 7-card hand limit
  registerHandSizeLimit(ruleEngine, {
    maxSize: 7,
    discardMode: "auto"
  });
  
  // Set action costs
  registerResourceCosts(ruleEngine, {
    costs: {
      "game:specialMove": { energy: 3 },
      "game:powerUp": { energy: 5, gold: 10 }
    },
    preventOverdraw: true
  });
  
  // Generate 2 energy per turn
  registerResourceGeneration(ruleEngine, {
    trigger: "turn",
    amounts: { energy: 2 }
  });
  */
}