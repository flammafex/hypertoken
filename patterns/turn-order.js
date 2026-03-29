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
        engine.dispatch("agent:setActive", { name: agents[0].name, active: true });
        return;
      }

      // Deactivate current agent
      engine.dispatch("agent:setActive", { name: agents[currentIdx].name, active: false });

      // Find next agent (skip eliminated/inactive if configured)
      let nextIdx = (currentIdx + 1) % agents.length;
      let attempts = 0;

      while (skipInactive && attempts < agents.length) {
        const status = agents[nextIdx].meta?.status;
        if (status !== "eliminated" && status !== "inactive") break;
        nextIdx = (nextIdx + 1) % agents.length;
        attempts++;
      }

      // Activate next agent
      engine.dispatch("agent:setActive", { name: agents[nextIdx].name, active: true });

      const turnNumber = (engine._gameState?.turnNumber || 0) + 1;
      engine.dispatch("game:setProperty", { key: "turnNumber", value: turnNumber });

      engine.emit("turn:changed", {
        payload: {
          from: agents[currentIdx].name,
          to: agents[nextIdx].name,
          turnNumber,
        }
      });
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
        p.meta?.turnComplete === true || p.meta?.status === "eliminated"
      );
      
      const inPlay = engine._gameState?.phase === "play";
      
      return allComplete && inPlay;
    },
    (engine) => {
      const roundNum = (engine._gameState?.roundNumber || 0) + 1;
      
      engine.emit("round:complete", {
        payload: { roundNumber: roundNum }
      });

      // Reset turn-complete flags on all agents
      for (const p of engine._agents) {
        engine.dispatch("agent:setMeta", { name: p.name, key: "turnComplete", value: false });
      }

      if (onRoundComplete) {
        onRoundComplete(engine);
      }

      // Advance to next phase and update counters
      engine.dispatch("game:nextPhase", { phase: nextPhase });
      engine.dispatch("game:mergeState", { state: { roundNumber: roundNum, turnNumber: 0 } });
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
      
      if (onTimeout) {
        onTimeout(engine, activeAgent);
      }

      // Force skip turn and clear timer state
      engine.dispatch("agent:endTurn", { forced: true });
      engine.dispatch("game:mergeState", { state: { turnStartTime: null, waitingForAgent: null } });
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
            (!youngest || (p.meta?.age ?? 0) < (youngest.meta?.age ?? 0)) ? p : youngest
          );
          break;
        case "oldest":
          firstAgent = agents.reduce((oldest, p) =>
            (!oldest || (p.meta?.age ?? 0) > (oldest.meta?.age ?? 0)) ? p : oldest
          );
          break;
        case "score":
          firstAgent = agents.reduce((highest, p) =>
            (!highest || (p.resources?.score ?? 0) > (highest.resources?.score ?? 0)) ? p : highest
          );
          break;
        default:
          firstAgent = agents[0];
      }

      // Deactivate all, activate first
      for (const p of agents) {
        engine.dispatch("agent:setActive", { name: p.name, active: p.name === firstAgent.name });
      }

      engine.dispatch("game:mergeState", { state: { turnNumber: 1, turnStartTime: Date.now() } });

      engine.emit("turn:firstAgent", {
        payload: { agent: firstAgent.name, method }
      });
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
        p.meta?.actionSubmitted === true || p.meta?.status === "eliminated"
      );
      
      const waitingForActions = engine._gameState?.waitingForActions === true;
      
      return allReady && waitingForActions;
    },
    (engine) => {
      engine.emit("turn:allReady", {
        payload: { agents: engine._agents.map(p => p.name) }
      });

      if (onAllReady) {
        onAllReady(engine);
      }

      // Reset per-agent action-submitted flags and clear waiting state
      for (const p of engine._agents) {
        engine.dispatch("agent:setMeta", { name: p.name, key: "actionSubmitted", value: false });
      }
      engine.dispatch("game:setProperty", { key: "waitingForActions", value: false });

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