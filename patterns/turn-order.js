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
 * Turn Order Rule Patterns
 * 
 * Common patterns for managing agent turns, round progression,
 * and sequential game flow.
 */

/**
 * Register round-robin turn order rules
 * Agents take turns in sequence, cycling back to the first agent
 * 
 * @param {RuleEngine} ruleEngine
 * @param {Object} opts - Configuration options
 * @param {string} opts.triggerAction - Action type that ends a turn (default: "agent:endTurn")
 * @param {boolean} opts.skipInactive - Skip eliminated/inactive agents (default: true)
 */
export function registerRoundRobinTurns(ruleEngine, opts = {}) {
  const {
    triggerAction = "agent:endTurn",
    skipInactive = true
  } = opts;
  
  ruleEngine.addRule(
    "round-robin-advance",
    (engine, lastAction) => {
      if (!lastAction || lastAction.type !== triggerAction) return false;
      const agents = engine._agents || [];
      return agents.length > 0;
    },
    (engine) => {
      const agents = engine._agents;
      const currentIdx = agents.findIndex(p => p.active);
      
      if (currentIdx === -1) {
        // No active agent, start with first
        agents[0].active = true;
        return;
      }
      
      // Deactivate current agent
      agents[currentIdx].active = false;
      
      // Find next agent (skip inactive if configured)
      let nextIdx = (currentIdx + 1) % agents.length;
      let attempts = 0;
      
      while (skipInactive && attempts < agents.length) {
        if (agents[nextIdx].status !== "eliminated" && 
            agents[nextIdx].status !== "inactive") {
          break;
        }
        nextIdx = (nextIdx + 1) % agents.length;
        attempts++;
      }
      
      // Activate next agent
      agents[nextIdx].active = true;
      
      // Emit turn change event
      engine.emit("turn:changed", {
        payload: {
          from: agents[currentIdx].name,
          to: agents[nextIdx].name,
          turnNumber: (engine._gameState?.turnNumber || 0) + 1
        }
      });
      
      // Increment turn counter
      if (!engine._gameState) engine._gameState = {};
      engine._gameState.turnNumber = (engine._gameState.turnNumber || 0) + 1;
    },
    { priority: 100 }
  );
}

/**
 * Register round completion detection
 * Detects when all agents have completed their turns in a round
 * 
 * @param {RuleEngine} ruleEngine
 * @param {Object} opts - Configuration options
 * @param {Function} opts.onRoundComplete - Callback when round completes
 * @param {string} opts.nextPhase - Phase to transition to (default: "scoring")
 */
export function registerRoundCompletion(ruleEngine, opts = {}) {
  const {
    onRoundComplete = null,
    nextPhase = "scoring"
  } = opts;
  
  ruleEngine.addRule(
    "detect-round-complete",
    (engine) => {
      const agents = engine._agents || [];
      if (agents.length === 0) return false;
      
      // Check if all agents have completed their turn
      const allComplete = agents.every(p => 
        p.turnComplete === true || p.status === "eliminated"
      );
      
      const inPlay = engine._gameState?.phase === "play";
      
      return allComplete && inPlay;
    },
    (engine) => {
      const roundNum = (engine._gameState?.roundNumber || 0) + 1;
      
      // Emit round complete event
      engine.emit("round:complete", {
        payload: { roundNumber: roundNum }
      });
      
      // Reset turn flags
      engine._agents.forEach(p => {
        p.turnComplete = false;
      });
      
      // Execute callback if provided
      if (onRoundComplete) {
        onRoundComplete(engine);
      }
      
      // Advance to next phase
      engine.dispatch("game:nextPhase", { phase: nextPhase });
      
      // Update state
      if (!engine._gameState) engine._gameState = {};
      engine._gameState.roundNumber = roundNum;
      engine._gameState.turnNumber = 0;
    },
    { priority: 90, once: true }
  );
}

/**
 * Register turn time limit enforcement
 * Automatically skips turn if agent doesn't act within time limit
 * 
 * @param {RuleEngine} ruleEngine
 * @param {Object} opts - Configuration options
 * @param {number} opts.timeLimit - Time limit in milliseconds (default: 60000)
 * @param {Function} opts.onTimeout - Callback when timeout occurs
 */
export function registerTurnTimer(ruleEngine, opts = {}) {
  const {
    timeLimit = 60000, // 60 seconds
    onTimeout = null
  } = opts;
  
  ruleEngine.addRule(
    "enforce-turn-timer",
    (engine) => {
      const turnStart = engine._gameState?.turnStartTime;
      const waitingForAgent = engine._gameState?.waitingForAgent;
      
      if (!turnStart || !waitingForAgent) return false;
      
      const elapsed = Date.now() - turnStart;
      return elapsed > timeLimit;
    },
    (engine) => {
      const activeAgent = engine._agents?.find(p => p.active);
      
      // Emit timeout event
      engine.emit("turn:timeout", {
        payload: { 
          agent: activeAgent?.name,
          elapsed: Date.now() - engine._gameState.turnStartTime
        }
      });
      
      // Execute callback if provided
      if (onTimeout) {
        onTimeout(engine, activeAgent);
      }
      
      // Force skip turn
      engine.dispatch("agent:endTurn", { forced: true });
      
      // Clear timer state
      delete engine._gameState.turnStartTime;
      delete engine._gameState.waitingForAgent;
    },
    { priority: 95 }
  );
}

/**
 * Register first agent selection rules
 * Determines who goes first based on various criteria
 * 
 * @param {RuleEngine} ruleEngine
 * @param {Object} opts - Configuration options
 * @param {string} opts.method - Selection method: "random", "youngest", "oldest", "score"
 */
export function registerFirstAgentSelection(ruleEngine, opts = {}) {
  const { method = "random" } = opts;
  
  ruleEngine.addRule(
    "select-first-agent",
    (engine) => {
      const gameStarted = engine._gameState?.started;
      const noActiveAgent = !engine._agents?.some(p => p.active);
      return gameStarted && noActiveAgent;
    },
    (engine) => {
      const agents = engine._agents || [];
      if (agents.length === 0) return;
      
      let firstAgent;
      
      switch (method) {
        case "random":
          firstAgent = agents[Math.floor(Math.random() * agents.length)];
          break;
          
        case "youngest":
          firstAgent = agents.reduce((youngest, p) => 
            (!youngest || p.age < youngest.age) ? p : youngest
          );
          break;
          
        case "oldest":
          firstAgent = agents.reduce((oldest, p) => 
            (!oldest || p.age > oldest.age) ? p : oldest
          );
          break;
          
        case "score":
          firstAgent = agents.reduce((highest, p) => 
            (!highest || p.score > highest.score) ? p : highest
          );
          break;
          
        default:
          firstAgent = agents[0];
      }
      
      // Set first agent as active
      agents.forEach(p => p.active = false);
      firstAgent.active = true;
      
      // Emit event
      engine.emit("turn:firstAgent", {
        payload: { 
          agent: firstAgent.name,
          method 
        }
      });
      
      // Initialize turn state
      if (!engine._gameState) engine._gameState = {};
      engine._gameState.turnNumber = 1;
      engine._gameState.turnStartTime = Date.now();
    },
    { priority: 100, once: true }
  );
}

/**
 * Register simultaneous turn handling
 * All agents act simultaneously rather than sequentially
 * 
 * @param {RuleEngine} ruleEngine
 * @param {Object} opts - Configuration options
 * @param {Function} opts.onAllReady - Callback when all agents have acted
 */
export function registerSimultaneousTurns(ruleEngine, opts = {}) {
  const { onAllReady = null } = opts;
  
  ruleEngine.addRule(
    "check-all-agents-ready",
    (engine) => {
      const agents = engine._agents || [];
      if (agents.length === 0) return false;
      
      const allReady = agents.every(p => 
        p.actionSubmitted === true || p.status === "eliminated"
      );
      
      const waitingForActions = engine._gameState?.waitingForActions;
      
      return allReady && waitingForActions;
    },
    (engine) => {
      // Emit all ready event
      engine.emit("turn:allReady", {
        payload: { 
          agents: engine._agents.map(p => p.name)
        }
      });
      
      // Execute callback if provided
      if (onAllReady) {
        onAllReady(engine);
      }
      
      // Reset action flags
      engine._agents.forEach(p => {
        p.actionSubmitted = false;
      });
      
      // Clear waiting state
      engine._gameState.waitingForActions = false;
      
      // Resolve actions
      engine.dispatch("game:resolveActions");
    },
    { priority: 90 }
  );
}

/**
 * Example: Setting up a game with round-robin turns
 */
export function exampleUsage() {
  // In your game initialization:
  /*
  import { RuleEngine } from './RuleEngine.js';
  import { 
    registerRoundRobinTurns,
    registerRoundCompletion,
    registerTurnTimer
  } from './turn-order.js';
  
  const engine = new Engine({ ... });
  const ruleEngine = new RuleEngine(engine);
  
  // Set up turn order
  registerRoundRobinTurns(ruleEngine, {
    triggerAction: "agent:endTurn",
    skipInactive: true
  });
  
  // Detect round completion
  registerRoundCompletion(ruleEngine, {
    nextPhase: "scoring",
    onRoundComplete: (engine) => {
      console.log("Round complete!");
    }
  });
  
  // Add turn timer (optional)
  registerTurnTimer(ruleEngine, {
    timeLimit: 30000, // 30 seconds
    onTimeout: (engine, agent) => {
      console.log(`${agent.name} timed out!`);
    }
  });
  
  // Start game
  engine.dispatch("game:start");
  */
}