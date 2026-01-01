#!/usr/bin/env node
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
 * Test Suite for RuleEngine Patterns
 * 
 * Demonstrates all rule patterns working together in realistic scenarios
 */

// Mock imports for demonstration
// In real usage, these would be actual imports
const testResults = {
  passed: 0,
  failed: 0,
  tests: []
};

function test(name, fn) {
  try {
    fn();
    testResults.passed++;
    testResults.tests.push({ name, status: '✓', error: null });
    console.log(`✓ ${name}`);
  } catch (err) {
    testResults.failed++;
    testResults.tests.push({ name, status: '✗', error: err.message });
    console.error(`✗ ${name}`);
    console.error(`  ${err.message}`);
  }
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(message || 'Assertion failed');
  }
}

// Mock classes for testing
class MockEngine {
  constructor() {
    this._agents = [];
    this._gameState = {};
    this.history = [];
    this.stack = { size: 52 };
    this.space = { zones: new Map() };
    this.listeners = new Map();
  }
  
  dispatch(type, payload = {}) {
    const action = { type, payload };
    this.history.push(action);
    return action;
  }
  
  emit(event, data) {
    const handlers = this.listeners.get(event) || [];
    handlers.forEach(h => h(data));
  }
  
  on(event, handler) {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, []);
    }
    this.listeners.get(event).push(handler);
  }
  
  undo() {
    return this.history.pop();
  }
}

class MockRuleEngine {
  constructor(engine) {
    this.engine = engine;
    this.rules = [];
  }
  
  addRule(name, condition, action, opts = {}) {
    this.rules.push({ name, condition, action, ...opts });
    return this;
  }
  
  evaluate(lastAction) {
    this.rules.forEach(rule => {
      if (rule.condition(this.engine, lastAction)) {
        rule.action(this.engine);
      }
    });
  }
}

console.log('\n🧪 Testing RuleEngine Patterns\n');
console.log('═'.repeat(60));

// ============================================================================
// TURN ORDER PATTERNS
// ============================================================================

console.log('\n📍 Turn Order Patterns\n');

test('Round-robin turn advancement', () => {
  const engine = new MockEngine();
  const ruleEngine = new MockRuleEngine(engine);
  
  // Create agents
  engine._agents = [
    { name: 'Alice', active: true },
    { name: 'Bob', active: false },
    { name: 'Carol', active: false }
  ];
  
  // Register round-robin rule
  ruleEngine.addRule(
    'round-robin',
    (engine, lastAction) => lastAction?.type === 'agent:endTurn',
    (engine) => {
      const currentIdx = engine._agents.findIndex(p => p.active);
      engine._agents[currentIdx].active = false;
      const nextIdx = (currentIdx + 1) % engine._agents.length;
      engine._agents[nextIdx].active = true;
    }
  );
  
  // Simulate turn
  const action = engine.dispatch('agent:endTurn');
  ruleEngine.evaluate(action);
  
  assert(engine._agents[0].active === false, 'Alice should no longer be active');
  assert(engine._agents[1].active === true, 'Bob should be active');
});

test('Skip inactive agents', () => {
  const engine = new MockEngine();
  const ruleEngine = new MockRuleEngine(engine);
  
  engine._agents = [
    { name: 'Alice', active: true, status: 'active' },
    { name: 'Bob', active: false, status: 'eliminated' },
    { name: 'Carol', active: false, status: 'active' }
  ];
  
  ruleEngine.addRule(
    'skip-inactive',
    (engine, lastAction) => lastAction?.type === 'agent:endTurn',
    (engine) => {
      const currentIdx = engine._agents.findIndex(p => p.active);
      engine._agents[currentIdx].active = false;
      
      let nextIdx = (currentIdx + 1) % engine._agents.length;
      while (engine._agents[nextIdx].status === 'eliminated') {
        nextIdx = (nextIdx + 1) % engine._agents.length;
      }
      
      engine._agents[nextIdx].active = true;
    }
  );
  
  const action = engine.dispatch('agent:endTurn');
  ruleEngine.evaluate(action);
  
  assert(engine._agents[2].active === true, 'Carol should be active (Bob skipped)');
  assert(engine._agents[1].active === false, 'Bob should be skipped');
});

// ============================================================================
// WIN CONDITION PATTERNS
// ============================================================================

console.log('\n🏆 Win Condition Patterns\n');

test('First to goal wins', () => {
  const engine = new MockEngine();
  const ruleEngine = new MockRuleEngine(engine);
  
  engine._agents = [
    { name: 'Alice', score: 95 },
    { name: 'Bob', score: 105 },
    { name: 'Carol', score: 80 }
  ];
  
  let winner = null;
  
  ruleEngine.addRule(
    'first-to-100',
    (engine) => {
      const w = engine._agents.find(p => p.score >= 100);
      return !!w && !engine._gameState.ended;
    },
    (engine) => {
      winner = engine._agents.find(p => p.score >= 100);
      engine._gameState.ended = true;
      engine.dispatch('game:end', { winner: winner.name });
    }
  );
  
  ruleEngine.evaluate({ type: 'game:checkWin' });
  
  assert(winner !== null, 'Winner should be detected');
  assert(winner.name === 'Bob', 'Bob should win with 105 points');
  assert(engine._gameState.ended === true, 'Game should be ended');
});

test('Last agent standing wins', () => {
  const engine = new MockEngine();
  const ruleEngine = new MockRuleEngine(engine);
  
  engine._agents = [
    { name: 'Alice', alive: false },
    { name: 'Bob', alive: true },
    { name: 'Carol', alive: false }
  ];
  
  let winner = null;
  
  ruleEngine.addRule(
    'last-standing',
    (engine) => {
      const alive = engine._agents.filter(p => p.alive);
      return alive.length === 1 && !engine._gameState.ended;
    },
    (engine) => {
      winner = engine._agents.find(p => p.alive);
      engine._gameState.ended = true;
      engine.dispatch('game:end', { winner: winner.name });
    }
  );
  
  ruleEngine.evaluate({ type: 'game:checkWin' });
  
  assert(winner !== null, 'Winner should be detected');
  assert(winner.name === 'Bob', 'Bob should be the last standing');
});

test('Stalemate detection', () => {
  const engine = new MockEngine();
  const ruleEngine = new MockRuleEngine(engine);
  
  engine.stack.size = 0;
  engine._gameState.availableMoves = [];
  
  let gameEnded = false;
  
  ruleEngine.addRule(
    'stalemate',
    (engine) => {
      const noCards = engine.stack.size === 0;
      const noMoves = engine._gameState.availableMoves?.length === 0;
      return noCards && noMoves && !engine._gameState.ended;
    },
    (engine) => {
      gameEnded = true;
      engine._gameState.ended = true;
      engine.dispatch('game:end', { winner: null, reason: 'stalemate' });
    }
  );
  
  ruleEngine.evaluate({ type: 'game:checkState' });
  
  assert(gameEnded === true, 'Game should end in stalemate');
  assert(engine.history[0].payload.reason === 'stalemate', 'Reason should be stalemate');
});

// ============================================================================
// RESOURCE MANAGEMENT PATTERNS
// ============================================================================

console.log('\n💰 Resource Management Patterns\n');

test('Hand size limit enforcement', () => {
  const engine = new MockEngine();
  const ruleEngine = new MockRuleEngine(engine);
  
  engine._agents = [
    { 
      name: 'Alice', 
      hand: Array(10).fill({ id: 'card' }) 
    }
  ];
  
  const maxSize = 7;
  
  ruleEngine.addRule(
    'hand-limit',
    (engine, lastAction) => {
      if (lastAction?.type !== 'agent:drawCards') return false;
      const agent = engine._agents.find(p => p.hand.length > maxSize);
      return !!agent;
    },
    (engine) => {
      const agent = engine._agents.find(p => p.hand.length > maxSize);
      const excess = agent.hand.length - maxSize;
      agent.hand = agent.hand.slice(0, maxSize);
      engine.dispatch('agent:discardCards', { count: excess });
    }
  );
  
  const action = engine.dispatch('agent:drawCards', { count: 3 });
  ruleEngine.evaluate(action);
  
  assert(engine._agents[0].hand.length === 7, 'Hand should be limited to 7 cards');
});

test('Resource cost deduction', () => {
  const engine = new MockEngine();
  const ruleEngine = new MockRuleEngine(engine);
  
  engine._agents = [
    { 
      name: 'Alice', 
      active: true,
      resources: { energy: 10, gold: 50 }
    }
  ];
  
  const costs = {
    'game:specialMove': { energy: 3, gold: 5 }
  };
  
  ruleEngine.addRule(
    'deduct-costs',
    (engine, lastAction) => {
      return lastAction && lastAction.type in costs;
    },
    (engine) => {
      const agent = engine._agents.find(p => p.active);
      const lastAction = engine.history[engine.history.length - 1];
      const cost = costs[lastAction.type];
      
      Object.entries(cost).forEach(([resource, amount]) => {
        agent.resources[resource] -= amount;
      });
    }
  );
  
  const action = engine.dispatch('game:specialMove');
  ruleEngine.evaluate(action);
  
  assert(engine._agents[0].resources.energy === 7, 'Energy should be deducted');
  assert(engine._agents[0].resources.gold === 45, 'Gold should be deducted');
});

test('Prevent negative resources', () => {
  const engine = new MockEngine();
  const ruleEngine = new MockRuleEngine(engine);
  
  engine._agents = [
    { 
      name: 'Alice',
      resources: { health: -5, mana: 10 }
    }
  ];
  
  ruleEngine.addRule(
    'no-negative',
    (engine, lastAction) => {
      if (!lastAction?.type.includes('Resource')) return false;
      const agent = engine._agents.find(p => 
        Object.values(p.resources).some(v => v < 0)
      );
      return !!agent;
    },
    (engine) => {
      engine._agents.forEach(p => {
        Object.keys(p.resources).forEach(key => {
          if (p.resources[key] < 0) {
            p.resources[key] = 0;
          }
        });
      });
    }
  );
  
  const action = engine.dispatch('agent:takeResource', { resource: 'health' });
  ruleEngine.evaluate(action);
  
  assert(engine._agents[0].resources.health === 0, 'Health should be clamped to 0');
  assert(engine._agents[0].resources.mana === 10, 'Mana should be unchanged');
});

test('Resource generation per turn', () => {
  const engine = new MockEngine();
  const ruleEngine = new MockRuleEngine(engine);
  
  engine._agents = [
    { name: 'Alice', resources: { energy: 0 } },
    { name: 'Bob', resources: { energy: 0 } }
  ];
  
  ruleEngine.addRule(
    'generate-energy',
    (engine, lastAction) => lastAction?.type === 'game:newTurn',
    (engine) => {
      engine._agents.forEach(p => {
        p.resources.energy += 2;
      });
    }
  );
  
  const action = engine.dispatch('game:newTurn');
  ruleEngine.evaluate(action);
  
  assert(engine._agents[0].resources.energy === 2, 'Alice should gain energy');
  assert(engine._agents[1].resources.energy === 2, 'Bob should gain energy');
});

test('Elimination on resource depletion', () => {
  const engine = new MockEngine();
  const ruleEngine = new MockRuleEngine(engine);
  
  engine._agents = [
    { name: 'Alice', resources: { health: 0 }, status: 'active' },
    { name: 'Bob', resources: { health: 50 }, status: 'active' }
  ];
  
  ruleEngine.addRule(
    'eliminate-on-death',
    (engine, lastAction) => {
      if (!lastAction?.type.includes('Resource')) return false;
      const agent = engine._agents.find(p => 
        p.resources.health <= 0 && p.status !== 'eliminated'
      );
      return !!agent;
    },
    (engine) => {
      const agent = engine._agents.find(p => 
        p.resources.health <= 0 && p.status !== 'eliminated'
      );
      agent.status = 'eliminated';
      agent.alive = false;
      engine.dispatch('agent:eliminated', { name: agent.name });
    }
  );
  
  const action = engine.dispatch('agent:takeResource', { resource: 'health' });
  ruleEngine.evaluate(action);
  
  assert(engine._agents[0].status === 'eliminated', 'Alice should be eliminated');
  assert(engine._agents[0].alive === false, 'Alice should not be alive');
  assert(engine._agents[1].status === 'active', 'Bob should still be active');
});

// ============================================================================
// COMPLEX SCENARIOS
// ============================================================================

console.log('\n🎯 Complex Integration Scenarios\n');

test('Full turn cycle with multiple rules', () => {
  const engine = new MockEngine();
  const ruleEngine = new MockRuleEngine(engine);
  
  // Setup
  engine._agents = [
    { name: 'Alice', active: true, score: 95, resources: { energy: 3 } },
    { name: 'Bob', active: false, score: 90, resources: { energy: 5 } }
  ];
  
  // Rule 1: Generate energy at turn start
  ruleEngine.addRule(
    'generate-energy',
    (engine, lastAction) => lastAction?.type === 'game:startTurn',
    (engine) => {
      const active = engine._agents.find(p => p.active);
      if (active) active.resources.energy += 2;
    },
    { priority: 100 }
  );
  
  // Rule 2: Check for winner
  ruleEngine.addRule(
    'check-winner',
    (engine, lastAction) => {
      if (lastAction?.type !== 'agent:endTurn') return false;
      const winner = engine._agents.find(p => p.score >= 100);
      return !!winner && !engine._gameState.ended;
    },
    (engine) => {
      const winner = engine._agents.find(p => p.score >= 100);
      engine._gameState.ended = true;
      engine._gameState.winner = winner.name;
    },
    { priority: 90 }
  );
  
  // Rule 3: Advance turn
  ruleEngine.addRule(
    'advance-turn',
    (engine, lastAction) => lastAction?.type === 'agent:endTurn',
    (engine) => {
      const currentIdx = engine._agents.findIndex(p => p.active);
      engine._agents[currentIdx].active = false;
      const nextIdx = (currentIdx + 1) % engine._agents.length;
      engine._agents[nextIdx].active = true;
    },
    { priority: 80 }
  );
  
  // Execute turn sequence
  let action = engine.dispatch('game:startTurn');
  ruleEngine.evaluate(action);
  
  assert(engine._agents[0].resources.energy === 5, 'Energy should be generated');
  
  // Simulate scoring
  engine._agents[0].score = 100;
  
  action = engine.dispatch('agent:endTurn');
  ruleEngine.evaluate(action);
  
  assert(engine._gameState.ended === true, 'Game should end');
  assert(engine._gameState.winner === 'Alice', 'Alice should win');
  assert(engine._agents[1].active === true, 'Turn should advance to Bob');
});

// ============================================================================
// RESULTS
// ============================================================================

console.log('\n' + '═'.repeat(60));
console.log(`\n📊 Test Results: ${testResults.passed}/${testResults.passed + testResults.failed} passed\n`);

if (testResults.failed === 0) {
  console.log('🎉 All pattern tests passed!\n');
  process.exit(0);
} else {
  console.log(`❌ ${testResults.failed} tests failed\n`);
  process.exit(1);
}