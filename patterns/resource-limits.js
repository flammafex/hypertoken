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
 * @param {string} opts.triggerAction - Action that triggers check (default: "agent:drawCards")
 * @param {string} opts.discardMode - "auto" or "choice" (default: "auto")
 */
export function registerHandSizeLimit(ruleEngine, opts = {}) {
  const {
    maxSize = 7,
    triggerAction = "agent:drawCards",
    discardMode = "auto"
  } = opts;
  
  ruleEngine.addRule(
    "enforce-hand-limit",
    (engine, lastAction) => {
      if (!lastAction || lastAction.type !== triggerAction) return false;
      
      const agent = engine._agents?.find(p => 
        p.hand?.length > maxSize
      );
      
      return !!agent;
    },
    (engine) => {
      const agent = engine._agents.find(p => p.hand.length > maxSize);
      const excess = agent.hand.length - maxSize;
      
      if (discardMode === "auto") {
        // Auto-discard from end of hand
        const toDiscard = agent.hand.slice(-excess);
        
        engine.dispatch("agent:discardCards", {
          name: agent.name,
          cards: toDiscard
        });
        
        engine.emit("hand:limitEnforced", {
          payload: {
            agent: agent.name,
            discarded: excess,
            auto: true
          }
        });
      } else {
        // Set flag requiring agent choice
        agent.mustDiscard = excess;
        engine._gameState.waitingForDiscard = agent.name;
        
        engine.emit("hand:mustDiscard", {
          payload: {
            agent: agent.name,
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
        
        const activeAgent = engine._agents?.find(p => p.active);
        if (!activeAgent) return false;
        
        const cost = costs[lastAction.type];
        const insufficient = Object.entries(cost).some(([resource, amount]) => {
          const current = activeAgent.resources?.[resource] || 0;
          return current < amount;
        });
        
        return insufficient;
      },
      (engine) => {
        // Undo the action
        engine.undo();
        
        const activeAgent = engine._agents.find(p => p.active);
        
        engine.emit("action:insufficientResources", {
          payload: {
            agent: activeAgent.name,
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
      const activeAgent = engine._agents?.find(p => p.active);
      if (!activeAgent) return;
      
      const cost = costs[lastAction.type];
      
      Object.entries(cost).forEach(([resource, amount]) => {
        engine.dispatch("agent:takeResource", {
          name: activeAgent.name,
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
      
      const agent = engine._agents?.find(p => {
        const resourcesToCheck = resources || Object.keys(p.resources || {});
        return resourcesToCheck.some(r => (p.resources?.[r] || 0) < 0);
      });
      
      return !!agent;
    },
    (engine) => {
      engine._agents.forEach(p => {
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
                agent: p.name,
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
      
      const agent = engine._agents?.find(p => {
        return Object.entries(maxima).some(([resource, max]) => {
          return (p.resources?.[resource] || 0) > max;
        });
      });
      
      return !!agent;
    },
    (engine) => {
      engine._agents.forEach(p => {
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
                agent: p.name,
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
 * Automatically gives resources to agents each turn/phase
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
        shouldGenerate = lastAction?.type === "agent:endTurn";
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
      const agents = engine._agents || [];
      
      agents.forEach(p => {
        if (p.status === "eliminated") return;
        
        Object.entries(amounts).forEach(([resource, amount]) => {
          engine.dispatch("agent:giveResource", {
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
 * Periodically removes resources from agents
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
        return lastAction?.type === "agent:endTurn";
      } else if (trigger === "round") {
        return engine._gameState?.roundComplete === true;
      } else if (trigger === "time") {
        const lastDrain = engine._gameState?.lastDrainTime || 0;
        return Date.now() - lastDrain >= interval;
      }
      
      return false;
    },
    (engine) => {
      const agents = engine._agents || [];
      
      agents.forEach(p => {
        if (p.status === "eliminated") return;
        
        Object.entries(amounts).forEach(([resource, amount]) => {
          engine.dispatch("agent:takeResource", {
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
 * Agent is eliminated when a critical resource reaches zero
 * 
 * @param {RuleEngine} ruleEngine
 * @param {Object} opts - Configuration options
 * @param {string} opts.resource - Critical resource (e.g., "health", "lives")
 * @param {number} opts.threshold - Value at which agent is eliminated (default: 0)
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
      
      const agent = engine._agents?.find(p => {
        const value = p.resources?.[resource] || 0;
        return value <= threshold && p.status !== "eliminated";
      });
      
      return !!agent;
    },
    (engine) => {
      const agent = engine._agents.find(p => {
        const value = p.resources?.[resource] || 0;
        return value <= threshold && p.status !== "eliminated";
      });
      
      agent.status = "eliminated";
      agent.active = false;
      agent.alive = false;
      
      engine.emit("agent:eliminated", {
        payload: {
          agent: agent.name,
          reason: `${resource}_depleted`
        }
      });
      
      // Check if this triggers game end
      const remaining = engine._agents.filter(p => p.status !== "eliminated");
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