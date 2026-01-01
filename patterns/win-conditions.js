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
 * Win Condition Rule Patterns
 * 
 * Common patterns for detecting victory, defeat, and draw conditions
 * across different game types.
 */

/**
 * Register "first to goal" win condition
 * Agent wins when reaching a target score/resource amount
 * 
 * @param {RuleEngine} ruleEngine
 * @param {Object} opts - Configuration options
 * @param {string} opts.resource - Resource to check (default: "score")
 * @param {number} opts.goal - Goal value (default: 100)
 * @param {string} opts.comparison - Comparison operator: ">=", ">", "==" (default: ">=")
 */
export function registerFirstToGoal(ruleEngine, opts = {}) {
  const {
    resource = "score",
    goal = 100,
    comparison = ">="
  } = opts;
  
  ruleEngine.addRule(
    `first-to-${goal}-wins`,
    (engine) => {
      const agents = engine._agents || [];
      const gameEnded = engine._gameState?.ended;
      
      if (gameEnded) return false;
      
      const winner = agents.find(p => {
        const value = resource === "score" ? p.score : p.resources?.[resource] || 0;
        
        switch (comparison) {
          case ">=": return value >= goal;
          case ">": return value > goal;
          case "==": return value === goal;
          default: return value >= goal;
        }
      });
      
      return !!winner;
    },
    (engine) => {
      const agents = engine._agents || [];
      const winner = agents.find(p => {
        const value = resource === "score" ? p.score : p.resources?.[resource] || 0;
        
        switch (comparison) {
          case ">=": return value >= goal;
          case ">": return value > goal;
          case "==": return value === goal;
          default: return value >= goal;
        }
      });
      
      engine.dispatch("game:end", {
        winner: winner.name,
        reason: "reached_goal",
        finalValue: resource === "score" ? winner.score : winner.resources[resource],
        goal
      });
    },
    { priority: 100, once: true }
  );
}

/**
 * Register "last agent standing" win condition
 * Agent wins when all others are eliminated
 * 
 * @param {RuleEngine} ruleEngine
 * @param {Object} opts - Configuration options
 * @param {string} opts.statusField - Field to check for elimination (default: "alive")
 * @param {any} opts.eliminatedValue - Value indicating elimination (default: false)
 */
export function registerLastStanding(ruleEngine, opts = {}) {
  const {
    statusField = "alive",
    eliminatedValue = false
  } = opts;
  
  ruleEngine.addRule(
    "last-standing-wins",
    (engine) => {
      const agents = engine._agents || [];
      const gameEnded = engine._gameState?.ended;
      
      if (gameEnded || agents.length === 0) return false;
      
      const alive = agents.filter(p => p[statusField] !== eliminatedValue);
      return alive.length === 1;
    },
    (engine) => {
      const agents = engine._agents || [];
      const winner = agents.find(p => p[statusField] !== eliminatedValue);
      
      engine.dispatch("game:end", {
        winner: winner.name,
        reason: "elimination",
        survivors: 1,
        eliminated: agents.length - 1
      });
    },
    { priority: 100, once: true }
  );
}

/**
 * Register "highest score" win condition
 * Agent with highest score wins after time/rounds expire
 * 
 * @param {RuleEngine} ruleEngine
 * @param {Object} opts - Configuration options
 * @param {string} opts.trigger - What triggers end: "time", "rounds", "manual"
 * @param {number} opts.limit - Time limit (ms) or round limit
 * @param {string} opts.scoreField - Field containing score (default: "score")
 */
export function registerHighestScore(ruleEngine, opts = {}) {
  const {
    trigger = "rounds",
    limit = 10,
    scoreField = "score"
  } = opts;
  
  ruleEngine.addRule(
    "highest-score-wins",
    (engine) => {
      const gameEnded = engine._gameState?.ended;
      if (gameEnded) return false;
      
      if (trigger === "time") {
        const startTime = engine._gameState?.startTime;
        return startTime && (Date.now() - startTime >= limit);
      } else if (trigger === "rounds") {
        const round = engine._gameState?.roundNumber || 0;
        return round >= limit;
      } else if (trigger === "manual") {
        return engine._gameState?.forceEnd === true;
      }
      
      return false;
    },
    (engine) => {
      const agents = engine._agents || [];
      
      // Sort by score
      const sorted = [...agents].sort((a, b) => {
        const aScore = a[scoreField] || 0;
        const bScore = b[scoreField] || 0;
        return bScore - aScore;
      });
      
      const winner = sorted[0];
      const runnerUp = sorted[1];
      
      // Check for tie
      if (runnerUp && winner[scoreField] === runnerUp[scoreField]) {
        // Handle tie - you might want to check tiebreaker criteria
        engine.dispatch("game:end", {
          winner: null,
          reason: "tie",
          tiedAgents: sorted.filter(p => p[scoreField] === winner[scoreField]).map(p => p.name),
          finalScores: sorted.map(p => ({ name: p.name, score: p[scoreField] }))
        });
      } else {
        engine.dispatch("game:end", {
          winner: winner.name,
          reason: trigger === "time" ? "time_expired" : trigger === "rounds" ? "rounds_complete" : "game_ended",
          finalScore: winner[scoreField],
          finalScores: sorted.map(p => ({ name: p.name, score: p[scoreField] }))
        });
      }
    },
    { priority: 100, once: true }
  );
}

/**
 * Register "objective complete" win condition
 * Agent wins when completing specific objectives
 * 
 * @param {RuleEngine} ruleEngine
 * @param {Object} opts - Configuration options
 * @param {Array<string>} opts.objectives - List of required objective IDs
 * @param {boolean} opts.requireAll - Must complete all objectives (default: true)
 */
export function registerObjectiveWin(ruleEngine, opts = {}) {
  const {
    objectives = [],
    requireAll = true
  } = opts;
  
  ruleEngine.addRule(
    "objective-complete-wins",
    (engine) => {
      const agents = engine._agents || [];
      const gameEnded = engine._gameState?.ended;
      
      if (gameEnded || objectives.length === 0) return false;
      
      const winner = agents.find(p => {
        const completed = p.completedObjectives || [];
        
        if (requireAll) {
          // Must complete ALL objectives
          return objectives.every(obj => completed.includes(obj));
        } else {
          // Must complete ANY objective
          return objectives.some(obj => completed.includes(obj));
        }
      });
      
      return !!winner;
    },
    (engine) => {
      const agents = engine._agents || [];
      const winner = agents.find(p => {
        const completed = p.completedObjectives || [];
        
        if (requireAll) {
          return objectives.every(obj => completed.includes(obj));
        } else {
          return objectives.some(obj => completed.includes(obj));
        }
      });
      
      engine.dispatch("game:end", {
        winner: winner.name,
        reason: "objectives_complete",
        completed: winner.completedObjectives,
        required: objectives
      });
    },
    { priority: 100, once: true }
  );
}

/**
 * Register "no moves available" draw condition
 * Game ends in draw when no agent can make a legal move
 * 
 * @param {RuleEngine} ruleEngine
 * @param {Object} opts - Configuration options
 * @param {Function} opts.checkMoves - Custom function to check available moves
 */
export function registerStalemate(ruleEngine, opts = {}) {
  const { checkMoves = null } = opts;
  
  ruleEngine.addRule(
    "detect-stalemate",
    (engine) => {
      const gameEnded = engine._gameState?.ended;
      if (gameEnded) return false;
      
      // Use custom check if provided
      if (checkMoves) {
        return !checkMoves(engine);
      }
      
      // Default: check if stack empty and no moves tracked
      const stackEmpty = engine.stack?.size === 0;
      const noMoves = engine._gameState?.availableMoves?.length === 0;
      
      return stackEmpty && noMoves;
    },
    (engine) => {
      engine.dispatch("game:end", {
        winner: null,
        reason: "stalemate",
        message: "No legal moves available"
      });
    },
    { priority: 90, once: true }
  );
}

/**
 * Register "territory control" win condition
 * Agent wins by controlling majority of zones/territories
 * 
 * @param {RuleEngine} ruleEngine
 * @param {Object} opts - Configuration options
 * @param {number} opts.threshold - Percentage required to win (0-1, default: 0.5)
 * @param {Array<string>} opts.zones - Zones to count (default: all zones)
 */
export function registerTerritoryControl(ruleEngine, opts = {}) {
  const {
    threshold = 0.5,
    zones = null
  } = opts;
  
  ruleEngine.addRule(
    "territory-control-wins",
    (engine) => {
      const gameEnded = engine._gameState?.ended;
      if (gameEnded || !engine.space) return false;
      
      const zonesToCheck = zones || Array.from(engine.space.zones.keys());
      const totalZones = zonesToCheck.length;
      
      if (totalZones === 0) return false;
      
      const agents = engine._agents || [];
      
      const winner = agents.find(p => {
        const controlled = zonesToCheck.filter(z => {
          const owner = engine.space.zones.get(z)?._owner;
          return owner === p.name;
        }).length;
        
        return (controlled / totalZones) >= threshold;
      });
      
      return !!winner;
    },
    (engine) => {
      const zonesToCheck = zones || Array.from(engine.space.zones.keys());
      const totalZones = zonesToCheck.length;
      const agents = engine._agents || [];
      
      const winner = agents.find(p => {
        const controlled = zonesToCheck.filter(z => {
          const owner = engine.space.zones.get(z)?._owner;
          return owner === p.name;
        }).length;
        
        return (controlled / totalZones) >= threshold;
      });
      
      const controlled = zonesToCheck.filter(z => {
        const owner = engine.space.zones.get(z)?._owner;
        return owner === winner.name;
      }).length;
      
      engine.dispatch("game:end", {
        winner: winner.name,
        reason: "territory_control",
        controlled,
        total: totalZones,
        percentage: (controlled / totalZones * 100).toFixed(1)
      });
    },
    { priority: 100, once: true }
  );
}

/**
 * Register cooperative win condition
 * All agents win or lose together based on team objectives
 * 
 * @param {RuleEngine} ruleEngine
 * @param {Object} opts - Configuration options
 * @param {Function} opts.winCondition - Function returning true if team wins
 * @param {Function} opts.loseCondition - Function returning true if team loses
 */
export function registerCooperativeWin(ruleEngine, opts = {}) {
  const {
    winCondition = null,
    loseCondition = null
  } = opts;
  
  if (winCondition) {
    ruleEngine.addRule(
      "cooperative-win",
      (engine) => {
        const gameEnded = engine._gameState?.ended;
        return !gameEnded && winCondition(engine);
      },
      (engine) => {
        const agents = engine._agents || [];
        engine.dispatch("game:end", {
          winner: "all",
          reason: "team_victory",
          agents: agents.map(p => p.name)
        });
      },
      { priority: 100, once: true }
    );
  }
  
  if (loseCondition) {
    ruleEngine.addRule(
      "cooperative-loss",
      (engine) => {
        const gameEnded = engine._gameState?.ended;
        return !gameEnded && loseCondition(engine);
      },
      (engine) => {
        const agents = engine._agents || [];
        engine.dispatch("game:end", {
          winner: null,
          reason: "team_defeat",
          agents: agents.map(p => p.name)
        });
      },
      { priority: 100, once: true }
    );
  }
}

/**
 * Example: Setting up win conditions for a racing game
 */
export function exampleUsage() {
  /*
  import { RuleEngine } from './RuleEngine.js';
  import { 
    registerFirstToGoal,
    registerHighestScore 
  } from './win-conditions.js';
  
  const engine = new Engine({ ... });
  const ruleEngine = new RuleEngine(engine);
  
  // Win by reaching finish line (position 100)
  registerFirstToGoal(ruleEngine, {
    resource: "position",
    goal: 100,
    comparison: ">="
  });
  
  // Or win by highest score after 10 laps
  registerHighestScore(ruleEngine, {
    trigger: "rounds",
    limit: 10,
    scoreField: "score"
  });
  */
}