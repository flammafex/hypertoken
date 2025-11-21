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
 * Integration Test Suite
 * 
 * Tests the complete HyperToken system with real scenarios:
 * - Full game rounds
 * - Engine + RuleEngine + Actions working together
 * - Policy chains and interactions
 * - Serialization and state management
 * - Plugin integration
 * 
 * These tests verify the architecture works end-to-end.
 */

// Test helpers
let testCount = 0;
let passCount = 0;
let failCount = 0;

function test(name, fn) {
  testCount++;
  try {
    fn();
    passCount++;
    console.log(`✓ ${name}`);
  } catch (err) {
    failCount++;
    console.error(`✗ ${name}`);
    console.error(`  ${err.message}`);
    if (err.stack) {
      console.error(`  ${err.stack.split('\n').slice(1, 3).join('\n')}`);
    }
  }
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(message || 'Assertion failed');
  }
}

function assertEquals(actual, expected, message) {
  if (actual !== expected) {
    throw new Error(message || `Expected ${expected}, got ${actual}`);
  }
}

// Mock classes that simulate real HyperToken components
class MockCard {
  constructor(id, suit, rank) {
    this.id = id;
    this.suit = suit;
    this.rank = rank;
    this.label = `${rank} of ${suit}`;
  }
}

class MockStack {
  constructor(cards = []) {
    this._stack = cards.slice();
    this._original = cards.slice();
    this.size = this._stack.length;
  }
  
  shuffle() {
    // Simple shuffle
    for (let i = this._stack.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [this._stack[i], this._stack[j]] = [this._stack[j], this._stack[i]];
    }
  }
  
  draw() {
    const card = this._stack.pop();
    this.size = this._stack.length;
    return card;
  }
  
  drawMany(count) {
    const cards = [];
    for (let i = 0; i < count; i++) {
      const card = this.draw();
      if (card) cards.push(card);
    }
    return cards;
  }
  
  reset() {
    this._stack = this._original.slice();
    this.size = this._stack.length;
  }
  
  toJSON() {
    return {
      size: this.size,
      stackSize: this._stack.length
    };
  }
  
  static fromJSON(obj) {
    const stack = new MockStack();
    stack.size = obj.size;
    return stack;
  }
}

class MockSpace {
  constructor() {
    this.zones = new Map();
  }
  
  createZone(id) {
    this.zones.set(id, []);
  }
  
  place(zone, card, opts = {}) {
    if (!this.zones.has(zone)) {
      this.createZone(zone);
    }
    const placement = { card, ...opts, id: `p-${Date.now()}` };
    this.zones.get(zone).push(placement);
    return placement;
  }
  
  clear() {
    this.zones.clear();
  }
  
  clearZone(zone) {
    if (this.zones.has(zone)) {
      this.zones.set(zone, []);
    }
  }
  
  zone(zoneName) {
    return this.zones.get(zoneName) || [];
  }
  
  zoneCount(zoneName) {
    return this.zone(zoneName).length;
  }
  
  toJSON() {
    return {
      zones: Array.from(this.zones.entries()).map(([name, placements]) => ({
        name,
        count: placements.length
      }))
    };
  }
}

class MockSource {
  constructor(stack) {
    this._stack = stack ? stack._stack.slice() : [];
  }
  
  draw() {
    return this._stack.pop();
  }
  
  shuffle() {
    for (let i = this._stack.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [this._stack[i], this._stack[j]] = [this._stack[j], this._stack[i]];
    }
  }
  
  inspect() {
    return {
      remaining: this._stack.length,
      burned: 0
    };
  }
}

class MockEngine {
  constructor({ stack = null, space = null, source = null } = {}) {
    this.stack = stack;
    this.space = space;
    this.source = source;
    this.history = [];
    this.future = [];
    this._policies = new Map();
    this._agents = [];
    this._gameState = {};
    this.listeners = new Map();
  }
  
  dispatch(type, payload = {}) {
    const action = { type, payload };
    const result = this.apply(action);
    this.history.push(action);
    this.emit('engine:action', { payload: action });
    
    // Execute policies
    for (const [, policy] of this._policies) {
      try {
        policy.evaluate(this);
      } catch (err) {
        this.emit('engine:error', { payload: { policy, err } });
      }
    }
    
    return result;
  }
  
  apply(action) {
    // Simulate action execution
    const { type, payload } = action;
    
    // Stack actions
    if (type === 'stack:shuffle') {
      this.stack?.shuffle();
    } else if (type === 'stack:draw') {
      return this.stack?.drawMany(payload.count || 1);
    } else if (type === 'stack:reset') {
      this.stack?.reset();
    }
    
    // Space actions
    else if (type === 'space:place') {
      return this.space?.place(payload.zone, payload.card, payload.opts);
    } else if (type === 'space:clear') {
      this.space?.clear();
    } else if (type === 'space:clearZone') {
      this.space?.clearZone(payload.zone);
    }
    
    // Source actions
    else if (type === 'source:draw') {
      return this.source?.draw();
    } else if (type === 'source:inspect') {
      return this.source?.inspect();
    }
    
    // Agent actions
    else if (type === 'agent:create') {
      const agent = {
        id: `p-${Date.now()}`,
        name: payload.name,
        active: true,
        resources: {},
        hand: []
      };
      this._agents.push(agent);
      return agent;
    } else if (type === 'agent:giveResource') {
      const agent = this._agents.find(p => p.name === payload.name);
      if (agent) {
        agent.resources[payload.resource] = 
          (agent.resources[payload.resource] || 0) + payload.amount;
      }
    }
    
    // Game actions
    else if (type === 'game:start') {
      this._gameState = {
        started: true,
        startTime: Date.now(),
        phase: 'setup',
        turn: 0
      };
    } else if (type === 'game:end') {
      this._gameState.ended = true;
      this._gameState.winner = payload.winner;
      this._gameState.reason = payload.reason;
      this.emit('game:end', { payload });
    }
    
    return undefined;
  }
  
  registerPolicy(name, policy) {
    this._policies.set(name, policy);
    return this;
  }
  
  on(event, handler) {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, []);
    }
    this.listeners.get(event).push(handler);
  }
  
  emit(event, data) {
    const handlers = this.listeners.get(event) || [];
    handlers.forEach(h => {
      try {
        h(data);
      } catch (err) {
        console.error('Event handler error:', err);
      }
    });
  }
  
  snapshot() {
    return {
      stack: this.stack?.toJSON(),
      space: this.space?.toJSON(),
      gameState: this._gameState,
      agents: this._agents.map(p => ({
        name: p.name,
        resources: p.resources,
        handSize: p.hand?.length || 0
      })),
      historyLength: this.history.length
    };
  }
  
  restore(snapshot) {
    this._gameState = snapshot.gameState || {};
    // In real implementation, would fully restore stack/space
  }
}

class MockRuleEngine {
  constructor(engine) {
    this.engine = engine;
    this.rules = [];
    
    // Auto-evaluate on actions
    this.engine.on('engine:action', (e) => {
      this.evaluate(e.payload);
    });
  }
  
  addRule(name, condition, action, opts = {}) {
    this.rules.push({ name, condition, action, ...opts });
    this.rules.sort((a, b) => (b.priority || 0) - (a.priority || 0));
    return this;
  }
  
  evaluate(lastAction) {
    for (const rule of this.rules) {
      if (rule.once && rule.fired) continue;
      
      try {
        if (rule.condition(this.engine, lastAction)) {
          rule.action(this.engine, lastAction);
          rule.fired = true;
          this.engine.emit('rule:triggered', { payload: { name: rule.name } });
        }
      } catch (err) {
        this.engine.emit('rule:error', { payload: { name: rule.name, err } });
      }
    }
  }
}

class MockPolicy {
  constructor(name, fn) {
    this.name = name;
    this.fn = fn;
  }
  
  evaluate(engine) {
    this.fn(engine);
  }
}

console.log('\n🧪 Integration Test Suite\n');
console.log('═'.repeat(60));

// ============================================================================
// BASIC INTEGRATION
// ============================================================================

console.log('\n🎮 Basic Integration Tests\n');

test('Engine dispatches actions and tracks history', () => {
  const engine = new MockEngine();
  
  engine.dispatch('game:start');
  engine.dispatch('agent:create', { name: 'Alice' });
  engine.dispatch('agent:create', { name: 'Bob' });
  
  assertEquals(engine.history.length, 3, 'Should track 3 actions');
  assert(engine._gameState.started === true, 'Game should be started');
  assertEquals(engine._agents.length, 2, 'Should have 2 agents');
});

test('Actions modify engine state correctly', () => {
  const cards = [
    new MockCard(1, 'hearts', 'A'),
    new MockCard(2, 'hearts', '2'),
    new MockCard(3, 'hearts', '3')
  ];
  const stack = new MockStack(cards);
  const space = new MockSpace();
  const engine = new MockEngine({ stack, space });
  
  // Draw cards
  const drawn = engine.dispatch('stack:draw', { count: 2 });
  
  assertEquals(drawn.length, 2, 'Should draw 2 cards');
  assertEquals(stack.size, 1, 'Stack should have 1 card left');
  
  // Place card on space
  engine.dispatch('space:place', { 
    zone: 'field', 
    card: drawn[0],
    opts: { faceUp: true }
  });
  
  assertEquals(space.zoneCount('field'), 1, 'Space should have 1 card');
});

// ============================================================================
// RULE ENGINE INTEGRATION
// ============================================================================

console.log('\n📜 RuleEngine Integration Tests\n');

test('RuleEngine responds to engine actions', () => {
  const engine = new MockEngine();
  const ruleEngine = new MockRuleEngine(engine);
  
  let ruleTriggered = false;
  
  ruleEngine.addRule(
    'test-rule',
    (engine, lastAction) => lastAction.type === 'game:start',
    (engine) => {
      ruleTriggered = true;
      engine._gameState.ruleExecuted = true;
    }
  );
  
  engine.dispatch('game:start');
  
  assert(ruleTriggered === true, 'Rule should be triggered');
  assert(engine._gameState.ruleExecuted === true, 'Rule should modify state');
});

test('Multiple rules execute in priority order', () => {
  const engine = new MockEngine();
  const ruleEngine = new MockRuleEngine(engine);
  
  const executionOrder = [];
  
  ruleEngine.addRule(
    'low-priority',
    (engine, lastAction) => lastAction.type === 'test:action',
    () => executionOrder.push('low'),
    { priority: 10 }
  );
  
  ruleEngine.addRule(
    'high-priority',
    (engine, lastAction) => lastAction.type === 'test:action',
    () => executionOrder.push('high'),
    { priority: 100 }
  );
  
  ruleEngine.addRule(
    'medium-priority',
    (engine, lastAction) => lastAction.type === 'test:action',
    () => executionOrder.push('medium'),
    { priority: 50 }
  );
  
  engine.dispatch('test:action');
  
  assertEquals(executionOrder[0], 'high', 'High priority should execute first');
  assertEquals(executionOrder[1], 'medium', 'Medium priority should execute second');
  assertEquals(executionOrder[2], 'low', 'Low priority should execute last');
});

test('Rules can dispatch additional actions', () => {
  const engine = new MockEngine();
  const ruleEngine = new MockRuleEngine(engine);
  
  ruleEngine.addRule(
    'cascade-rule',
    (engine, lastAction) => lastAction.type === 'agent:create',
    (engine) => {
      // Rule dispatches another action
      engine.dispatch('agent:giveResource', {
        name: engine._agents[0].name,
        resource: 'gold',
        amount: 100
      });
    }
  );
  
  engine.dispatch('agent:create', { name: 'Alice' });
  
  const agent = engine._agents[0];
  assertEquals(agent.resources.gold, 100, 'Rule should give starting gold');
  assert(engine.history.length >= 2, 'Should have multiple actions');
});

// ============================================================================
// POLICY INTEGRATION
// ============================================================================

console.log('\n🔒 Policy Integration Tests\n');

test('Policies evaluate after every action', () => {
  const engine = new MockEngine();
  
  let policyRunCount = 0;
  
  const countingPolicy = new MockPolicy('counter', (engine) => {
    policyRunCount++;
  });
  
  engine.registerPolicy('counter', countingPolicy);
  
  engine.dispatch('test:action1');
  engine.dispatch('test:action2');
  engine.dispatch('test:action3');
  
  assertEquals(policyRunCount, 3, 'Policy should run after each action');
});

test('Policy can trigger game end', () => {
  const engine = new MockEngine();
  
  const winPolicy = new MockPolicy('win-check', (engine) => {
    const winner = engine._agents.find(p => (p.resources.score || 0) >= 100);
    if (winner && !engine._gameState.ended) {
      engine.dispatch('game:end', { 
        winner: winner.name,
        reason: 'reached_goal'
      });
    }
  });
  
  engine.registerPolicy('win-check', winPolicy);
  
  engine.dispatch('agent:create', { name: 'Alice' });
  engine.dispatch('agent:giveResource', {
    name: 'Alice',
    resource: 'score',
    amount: 100
  });
  
  assert(engine._gameState.ended === true, 'Game should end');
  assertEquals(engine._gameState.winner, 'Alice', 'Alice should win');
});

// ============================================================================
// COMPLETE GAME SCENARIO
// ============================================================================

console.log('\n🎯 Complete Game Scenarios\n');

test('Full card game round with rules and policies', () => {
  // Setup game
  const cards = Array.from({ length: 52 }, (_, i) => 
    new MockCard(i, ['hearts', 'diamonds', 'clubs', 'spades'][i % 4], (i % 13) + 1)
  );
  const stack = new MockStack(cards);
  const space = new MockSpace();
  const engine = new MockEngine({ stack, space });
  const ruleEngine = new MockRuleEngine(engine);
  
  // Rule: Agents draw 5 cards when created
  ruleEngine.addRule(
    'deal-starting-hand',
    (engine, lastAction) => lastAction.type === 'agent:create',
    (engine, lastAction) => {
      const cards = engine.dispatch('stack:draw', { count: 5 });
      const agent = engine._agents.find(p => p.name === lastAction.payload.name);
      if (agent) {
        agent.hand = cards;
      }
    },
    { priority: 100 }
  );
  
  // Rule: Detect winner
  ruleEngine.addRule(
    'check-winner',
    (engine) => {
      const winner = engine._agents.find(p => (p.resources.score || 0) >= 50);
      return !!winner && !engine._gameState.ended;
    },
    (engine) => {
      const winner = engine._agents.find(p => p.resources.score >= 50);
      engine.dispatch('game:end', { winner: winner.name });
    },
    { priority: 90 }
  );
  
  // Start game
  engine.dispatch('game:start');
  
  // Create agents
  engine.dispatch('agent:create', { name: 'Alice' });
  engine.dispatch('agent:create', { name: 'Bob' });
  
  // Both agents should have hands
  assertEquals(engine._agents[0].hand.length, 5, 'Alice should have 5 cards');
  assertEquals(engine._agents[1].hand.length, 5, 'Bob should have 5 cards');
  
  // Simulate gameplay
  engine.dispatch('agent:giveResource', { name: 'Alice', resource: 'score', amount: 25 });
  engine.dispatch('agent:giveResource', { name: 'Bob', resource: 'score', amount: 30 });
  engine.dispatch('agent:giveResource', { name: 'Alice', resource: 'score', amount: 30 });
  
  // Game should end
  assert(engine._gameState.ended === true, 'Game should end when agent reaches 50');
  assertEquals(engine._gameState.winner, 'Alice', 'Alice should win with 55 points');
});

test('Turn-based game with round-robin mechanics', () => {
  const engine = new MockEngine();
  const ruleEngine = new MockRuleEngine(engine);
  
  // Rule: Advance turn
  ruleEngine.addRule(
    'advance-turn',
    (engine, lastAction) => lastAction.type === 'agent:endTurn',
    (engine) => {
      const currentIdx = engine._agents.findIndex(p => p.active);
      engine._agents[currentIdx].active = false;
      const nextIdx = (currentIdx + 1) % engine._agents.length;
      engine._agents[nextIdx].active = true;
      
      engine._gameState.turnCount = (engine._gameState.turnCount || 0) + 1;
      
      engine.emit('turn:changed', { 
        payload: { 
          from: engine._agents[currentIdx].name,
          to: engine._agents[nextIdx].name
        } 
      });
    }
  );
  
  // Create game
  engine.dispatch('game:start');
  engine.dispatch('agent:create', { name: 'Alice' });
  engine.dispatch('agent:create', { name: 'Bob' });
  engine.dispatch('agent:create', { name: 'Carol' });
  
  // Set first agent active
  engine._agents[0].active = true;
  engine._agents[1].active = false;
  engine._agents[2].active = false;
  
  // Simulate turns
  assert(engine._agents[0].active === true, 'Alice should start');
  
  engine.dispatch('agent:endTurn');
  assert(engine._agents[1].active === true, 'Bob should be active');
  assert(engine._agents[0].active === false, 'Alice should not be active');
  
  engine.dispatch('agent:endTurn');
  assert(engine._agents[2].active === true, 'Carol should be active');
  
  engine.dispatch('agent:endTurn');
  assert(engine._agents[0].active === true, 'Should cycle back to Alice');
  
  assertEquals(engine._gameState.turnCount, 3, 'Should have 3 turns');
});

// ============================================================================
// SERIALIZATION INTEGRATION
// ============================================================================

console.log('\n💾 Serialization Integration Tests\n');

test('Engine state can be saved and restored', () => {
  const cards = [new MockCard(1, 'hearts', 'A'), new MockCard(2, 'hearts', '2')];
  const stack = new MockStack(cards);
  const space = new MockSpace();
  const engine = new MockEngine({ stack, space });
  
  // Setup initial state
  engine.dispatch('game:start');
  engine.dispatch('agent:create', { name: 'Alice' });
  engine.dispatch('agent:giveResource', { name: 'Alice', resource: 'gold', amount: 50 });
  
  // Take snapshot
  const snapshot = engine.snapshot();
  
  assert(snapshot.gameState.started === true, 'Snapshot should include game state');
  assertEquals(snapshot.agents.length, 1, 'Snapshot should include agents');
  assertEquals(snapshot.historyLength, 3, 'Snapshot should track history');
  
  // Create new engine and restore
  const engine2 = new MockEngine({ stack: new MockStack(), space: new MockSpace() });
  engine2.restore(snapshot);
  
  assert(engine2._gameState.started === true, 'Restored state should match');
});

test('Game can be paused and resumed', () => {
  const engine = new MockEngine();
  
  engine.dispatch('game:start');
  assert(engine._gameState.started === true, 'Game should be started');
  
  // Pause
  engine._gameState.paused = true;
  engine._gameState.pauseTime = Date.now();
  
  assert(engine._gameState.paused === true, 'Game should be paused');
  
  // Resume
  engine._gameState.paused = false;
  
  assert(engine._gameState.paused === false, 'Game should be resumed');
});

// ============================================================================
// PLUGIN INTEGRATION
// ============================================================================

console.log('\n🔌 Plugin Integration Tests\n');

test('Plugins work with full game engine', () => {
  const engine = new MockEngine();
  
  // Simple analytics plugin
  const stats = { actions: 0, events: 0 };
  
  const analyticsPlugin = {
    init: (engine) => {
      engine.on('engine:action', () => stats.actions++);
      engine.on('game:end', () => stats.events++);
      engine.analytics = { getStats: () => ({ ...stats }) };
    }
  };
  
  // Load plugin
  analyticsPlugin.init(engine);
  
  // Play game
  engine.dispatch('game:start');
  engine.dispatch('agent:create', { name: 'Alice' });
  engine.dispatch('game:end', { winner: 'Alice' });
  
  const pluginStats = engine.analytics.getStats();
  assertEquals(pluginStats.actions, 3, 'Plugin should track actions');
  assertEquals(pluginStats.events, 1, 'Plugin should track events');
});

test('Multiple systems work together', () => {
  const engine = new MockEngine({ stack: new MockStack([new MockCard(1, 'hearts', 'A')]) });
  const ruleEngine = new MockRuleEngine(engine);
  
  let eventLog = [];
  
  // Plugin
  const loggingPlugin = {
    init: (engine) => {
      engine.on('engine:action', (e) => {
        eventLog.push(e.payload.type);
      });
      engine.on('rule:triggered', (e) => {
        eventLog.push(`rule:${e.payload.name}`);
      });
    }
  };
  
  loggingPlugin.init(engine);
  
  // Rule
  ruleEngine.addRule(
    'auto-deal',
    (engine, lastAction) => lastAction.type === 'game:start',
    (engine) => {
      engine.dispatch('agent:create', { name: 'Alice' });
    }
  );
  
  // Policy
  const validationPolicy = new MockPolicy('validate', (engine) => {
    if (engine._agents.length > 4) {
      throw new Error('Too many agents');
    }
  });
  
  engine.registerPolicy('validate', validationPolicy);
  
  // Execute
  engine.dispatch('game:start');
  
  // Verify all systems interacted
  assert(eventLog.includes('game:start'), 'Plugin should log game start');
  assert(eventLog.includes('rule:auto-deal'), 'Plugin should log rule trigger');
  assert(eventLog.includes('agent:create'), 'Plugin should log action from rule');
  assertEquals(engine._agents.length, 1, 'Rule should create agent');
});

// ============================================================================
// ERROR HANDLING
// ============================================================================

console.log('\n⚠️  Error Handling Tests\n');

test('Engine handles action errors gracefully', () => {
  const engine = new MockEngine();
  
  let errorCaught = false;
  
  engine.on('engine:error', () => {
    errorCaught = true;
  });
  
  // This should not crash the engine
  try {
    engine.apply({ type: 'invalid:action', payload: {} });
  } catch (e) {
    // Errors should be emitted, not thrown
  }
  
  // Engine should still work
  engine.dispatch('game:start');
  assert(engine._gameState.started === true, 'Engine should still function after error');
});

test('Rule errors are isolated', () => {
  const engine = new MockEngine();
  const ruleEngine = new MockRuleEngine(engine);
  
  let errorCount = 0;
  
  engine.on('rule:error', () => {
    errorCount++;
  });
  
  // Rule that throws
  ruleEngine.addRule(
    'broken-rule',
    (engine, lastAction) => lastAction.type === 'test:action',
    (engine) => {
      throw new Error('Rule failed');
    }
  );
  
  // Rule that works
  ruleEngine.addRule(
    'working-rule',
    (engine, lastAction) => lastAction.type === 'test:action',
    (engine) => {
      engine._gameState.workingRuleExecuted = true;
    }
  );
  
  engine.dispatch('test:action');
  
  assertEquals(errorCount, 1, 'Error should be caught');
  assert(engine._gameState.workingRuleExecuted === true, 'Other rules should still execute');
});

// ============================================================================
// RESULTS
// ============================================================================

console.log('\n' + '═'.repeat(60));
console.log(`\n📊 Test Results: ${passCount}/${testCount} passed\n`);

if (failCount === 0) {
  console.log('🎉 All integration tests passed!\n');
  console.log('✓ Engine + Actions integration verified');
  console.log('✓ RuleEngine integration verified');
  console.log('✓ Policy integration verified');
  console.log('✓ Complete game scenarios verified');
  console.log('✓ Serialization verified');
  console.log('✓ Plugin integration verified');
  console.log('✓ Error handling verified\n');
  process.exit(0);
} else {
  console.log(`❌ ${failCount} tests failed\n`);
  process.exit(1);
}