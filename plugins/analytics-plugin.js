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
 * Analytics Plugin
 * 
 * Tracks game statistics including actions, turns, errors, and performance.
 * Provides detailed reports and insights into game behavior.
 * 
 * @example
 * import analyticsPlugin from './analytics-plugin.js';
 * pluginHost.load('analytics', analyticsPlugin.init);
 * 
 * // Later, get stats
 * console.log(engine.analytics.getReport());
 */

/**
 * Initialize the analytics plugin
 * 
 * @param {Engine} engine - Game engine instance
 * @param {Object} config - Plugin configuration
 * @param {boolean} config.trackActions - Track action counts (default: true)
 * @param {boolean} config.trackTurns - Track turn counts (default: true)
 * @param {boolean} config.trackErrors - Track error counts (default: true)
 * @param {boolean} config.trackTiming - Track action timing (default: false)
 */
export function init(engine, config = {}) {
  const {
    trackActions = true,
    trackTurns = true,
    trackErrors = true,
    trackTiming = false
  } = config;
  
  // Initialize statistics
  const stats = {
    startTime: Date.now(),
    endTime: null,
    duration: null,
    actions: {
      total: 0,
      byType: {},
      timeline: []
    },
    turns: {
      total: 0,
      byAgent: {},
      averageDuration: 0
    },
    errors: {
      total: 0,
      byType: {},
      list: []
    },
    rules: {
      triggered: 0,
      byRule: {}
    },
    agents: {
      created: 0,
      eliminated: 0,
      active: []
    }
  };
  
  // Track current turn start
  let turnStartTime = null;
  const turnDurations = [];
  
  // Track actions
  if (trackActions) {
    engine.on('engine:action', (e) => {
      const action = e.payload;
      stats.actions.total++;
      
      // Count by type
      stats.actions.byType[action.type] = 
        (stats.actions.byType[action.type] || 0) + 1;
      
      // Timeline entry
      stats.actions.timeline.push({
        type: action.type,
        timestamp: Date.now() - stats.startTime,
        turn: stats.turns.total
      });
      
      // Keep timeline manageable
      if (stats.actions.timeline.length > 1000) {
        stats.actions.timeline.shift();
      }
    });
  }
  
  // Track turns
  if (trackTurns) {
    engine.on('turn:changed', (e) => {
      stats.turns.total++;
      
      const agent = e.payload?.to;
      if (agent) {
        stats.turns.byAgent[agent] = 
          (stats.turns.byAgent[agent] || 0) + 1;
      }
      
      // Track turn duration
      if (turnStartTime) {
        const duration = Date.now() - turnStartTime;
        turnDurations.push(duration);
        
        // Calculate average
        const sum = turnDurations.reduce((a, b) => a + b, 0);
        stats.turns.averageDuration = Math.round(sum / turnDurations.length);
      }
      
      turnStartTime = Date.now();
    });
  }
  
  // Track errors
  if (trackErrors) {
    engine.on('engine:error', (e) => {
      stats.errors.total++;
      
      const errorType = e.payload?.err?.name || 'Unknown';
      stats.errors.byType[errorType] = 
        (stats.errors.byType[errorType] || 0) + 1;
      
      stats.errors.list.push({
        type: errorType,
        message: e.payload?.err?.message,
        action: e.payload?.action?.type,
        timestamp: Date.now() - stats.startTime
      });
      
      // Keep error list manageable
      if (stats.errors.list.length > 100) {
        stats.errors.list.shift();
      }
    });
    
    engine.on('rule:error', (e) => {
      stats.errors.total++;
      stats.errors.byType['RuleError'] = 
        (stats.errors.byType['RuleError'] || 0) + 1;
      
      stats.errors.list.push({
        type: 'RuleError',
        rule: e.payload?.name,
        message: e.payload?.error?.message,
        timestamp: Date.now() - stats.startTime
      });
    });
  }
  
  // Track rules
  engine.on('rule:triggered', (e) => {
    stats.rules.triggered++;
    const ruleName = e.payload?.name;
    
    if (ruleName) {
      stats.rules.byRule[ruleName] = 
        (stats.rules.byRule[ruleName] || 0) + 1;
    }
  });
  
  // Track agents
  engine.on('agent:eliminated', (e) => {
    stats.agents.eliminated++;
    const agent = e.payload?.agent;
    
    if (agent) {
      stats.agents.active = stats.agents.active.filter(p => p !== agent);
    }
  });
  
  // Track game end
  engine.on('game:end', (e) => {
    stats.endTime = Date.now();
    stats.duration = stats.endTime - stats.startTime;
    stats.winner = e.payload?.winner;
    stats.reason = e.payload?.reason;
  });
  
  // Track timing (optional, more overhead)
  if (trackTiming) {
    const originalDispatch = engine.dispatch.bind(engine);
    const timings = new Map();
    
    engine.dispatch = (type, payload, opts) => {
      const start = performance.now();
      const result = originalDispatch(type, payload, opts);
      const duration = performance.now() - start;
      
      if (!timings.has(type)) {
        timings.set(type, { count: 0, total: 0, avg: 0, max: 0, min: Infinity });
      }
      
      const timing = timings.get(type);
      timing.count++;
      timing.total += duration;
      timing.avg = timing.total / timing.count;
      timing.max = Math.max(timing.max, duration);
      timing.min = Math.min(timing.min, duration);
      
      return result;
    };
    
    stats.timing = timings;
  }
  
  // Public API
  engine.analytics = {
    /**
     * Get current statistics
     */
    getStats: () => ({ ...stats }),
    
    /**
     * Get formatted report
     */
    getReport: () => {
      const report = [];
      
      report.push('═══ Game Analytics Report ═══');
      report.push('');
      report.push(`Duration: ${formatDuration(stats.duration || (Date.now() - stats.startTime))}`);
      report.push(`Status: ${stats.endTime ? 'Ended' : 'In Progress'}`);
      
      if (stats.winner) {
        report.push(`Winner: ${stats.winner} (${stats.reason})`);
      }
      
      report.push('');
      report.push('Actions:');
      report.push(`  Total: ${stats.actions.total}`);
      report.push(`  Types: ${Object.keys(stats.actions.byType).length}`);
      
      const topActions = Object.entries(stats.actions.byType)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5);
      
      topActions.forEach(([type, count]) => {
        report.push(`    ${type}: ${count}`);
      });
      
      report.push('');
      report.push('Turns:');
      report.push(`  Total: ${stats.turns.total}`);
      report.push(`  Average Duration: ${stats.turns.averageDuration}ms`);
      
      if (Object.keys(stats.turns.byAgent).length > 0) {
        report.push('  By Agent:');
        Object.entries(stats.turns.byAgent).forEach(([agent, count]) => {
          report.push(`    ${agent}: ${count}`);
        });
      }
      
      if (stats.errors.total > 0) {
        report.push('');
        report.push('Errors:');
        report.push(`  Total: ${stats.errors.total}`);
        Object.entries(stats.errors.byType).forEach(([type, count]) => {
          report.push(`    ${type}: ${count}`);
        });
      }
      
      if (stats.rules.triggered > 0) {
        report.push('');
        report.push('Rules:');
        report.push(`  Triggered: ${stats.rules.triggered}`);
        
        const topRules = Object.entries(stats.rules.byRule)
          .sort((a, b) => b[1] - a[1])
          .slice(0, 5);
        
        topRules.forEach(([rule, count]) => {
          report.push(`    ${rule}: ${count}`);
        });
      }
      
      if (trackTiming && stats.timing) {
        report.push('');
        report.push('Performance:');
        
        const timingArray = Array.from(stats.timing.entries())
          .sort((a, b) => b[1].total - a[1].total)
          .slice(0, 5);
        
        timingArray.forEach(([type, timing]) => {
          report.push(`  ${type}:`);
          report.push(`    Avg: ${timing.avg.toFixed(3)}ms`);
          report.push(`    Max: ${timing.max.toFixed(3)}ms`);
          report.push(`    Calls: ${timing.count}`);
        });
      }
      
      report.push('');
      report.push('═══════════════════════════════');
      
      return report.join('\n');
    },
    
    /**
     * Print report to console
     */
    printReport: () => {
      console.log(engine.analytics.getReport());
    },
    
    /**
     * Reset statistics
     */
    reset: () => {
      stats.startTime = Date.now();
      stats.endTime = null;
      stats.duration = null;
      stats.actions.total = 0;
      stats.actions.byType = {};
      stats.actions.timeline = [];
      stats.turns.total = 0;
      stats.turns.byAgent = {};
      stats.errors.total = 0;
      stats.errors.byType = {};
      stats.errors.list = [];
      stats.rules.triggered = 0;
      stats.rules.byRule = {};
      
      if (trackTiming) {
        stats.timing.clear();
      }
    },
    
    /**
     * Export statistics as JSON
     */
    export: () => {
      return JSON.stringify(stats, null, 2);
    }
  };
  
  console.log('✓ Analytics plugin loaded');
}

/**
 * Format milliseconds as human-readable duration
 */
function formatDuration(ms) {
  if (!ms) return '0ms';
  
  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  
  if (hours > 0) {
    return `${hours}h ${minutes % 60}m ${seconds % 60}s`;
  } else if (minutes > 0) {
    return `${minutes}m ${seconds % 60}s`;
  } else if (seconds > 0) {
    return `${seconds}s`;
  } else {
    return `${ms}ms`;
  }
}

// Export for named imports
export default { init };