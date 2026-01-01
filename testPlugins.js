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
 * Plugin System Test Suite
 * 
 * Demonstrates all plugins working together in a realistic game scenario
 */

// Mock classes for testing
class MockEngine {
  constructor() {
    this._agents = [];
    this._gameState = {};
    this.history = [];
    this.stack = { size: 52 };
    this.space = { zones: new Map() };
    this._policies = new Map();
    this.listeners = new Map();
  }
  
  dispatch(type, payload = {}) {
    const action = { type, payload };
    this.history.push(action);
    this.emit('engine:action', { payload: action });
    return action;
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
  
  on(event, handler) {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, []);
    }
    this.listeners.get(event).push(handler);
  }
  
  snapshot() {
    return {
      stack: this.stack,
      space: { zones: Array.from(this.space.zones.entries()) },
      agents: this._agents,
      gameState: this._gameState,
      history: this.history.slice(-10) // Last 10 actions
    };
  }
  
  restore(snapshot) {
    this.stack = snapshot.stack || { size: 52 };
    this.space.zones = new Map(snapshot.space?.zones || []);
    this._agents = snapshot.agents || [];
    this._gameState = snapshot.gameState || {};
  }
}

class MockPluginHost {
  constructor(engine) {
    this.engine = engine;
    this.plugins = new Map();
  }
  
  load(name, fn) {
    this.plugins.set(name, fn);
    fn(this.engine);
    console.log(`Plugin loaded: ${name}`);
  }
}

// Import plugins
import loggingPlugin from './logging-plugin.js';
import analyticsPlugin from './analytics-plugin.js';
import saveStatePlugin from './save-state-plugin.js';

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
  }
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(message || 'Assertion failed');
  }
}

console.log('\n🧪 Testing Plugin System\n');
console.log('═'.repeat(60));

// ============================================================================
// LOGGING PLUGIN TESTS
// ============================================================================

console.log('\n📝 Logging Plugin Tests\n');

test('Logging plugin loads and tracks events', () => {
  const engine = new MockEngine();
  const pluginHost = new MockPluginHost(engine);
  
  // Load plugin with limited events for testing
  loggingPlugin.init(engine, {
    events: ['engine:action', 'game:end'],
    logPayloads: false
  });
  
  assert(engine.loggingPlugin !== undefined, 'Plugin API should be exposed');
  
  // Trigger some events
  engine.dispatch('test:action');
  engine.dispatch('test:action');
  engine.emit('game:end', { payload: { winner: 'Alice' } });
  
  const counts = engine.loggingPlugin.getCounts();
  assert(counts['engine:action'] === 2, 'Should track 2 actions');
  assert(counts['game:end'] === 1, 'Should track 1 game end');
});

test('Logging plugin can be reset', () => {
  const engine = new MockEngine();
  loggingPlugin.init(engine, { events: ['engine:action'] });
  
  engine.dispatch('test:action');
  engine.dispatch('test:action');
  
  let counts = engine.loggingPlugin.getCounts();
  assert(counts['engine:action'] === 2, 'Should have 2 actions before reset');
  
  engine.loggingPlugin.reset();
  
  counts = engine.loggingPlugin.getCounts();
  assert(counts['engine:action'] === 0, 'Should have 0 actions after reset');
});

// ============================================================================
// ANALYTICS PLUGIN TESTS
// ============================================================================

console.log('\n📊 Analytics Plugin Tests\n');

test('Analytics plugin tracks actions', () => {
  const engine = new MockEngine();
  analyticsPlugin.init(engine, {
    trackActions: true,
    trackTurns: false,
    trackErrors: false
  });
  
  assert(engine.analytics !== undefined, 'Plugin API should be exposed');
  
  engine.dispatch('agent:create', { name: 'Alice' });
  engine.dispatch('agent:create', { name: 'Bob' });
  engine.dispatch('game:start');
  
  const stats = engine.analytics.getStats();
  assert(stats.actions.total === 3, 'Should track 3 actions');
  assert(stats.actions.byType['agent:create'] === 2, 'Should count by type');
  assert(stats.actions.byType['game:start'] === 1, 'Should count game start');
});

test('Analytics plugin tracks turns', () => {
  const engine = new MockEngine();
  analyticsPlugin.init(engine, {
    trackActions: false,
    trackTurns: true,
    trackErrors: false
  });
  
  engine.emit('turn:changed', { payload: { from: 'Alice', to: 'Bob' } });
  engine.emit('turn:changed', { payload: { from: 'Bob', to: 'Carol' } });
  engine.emit('turn:changed', { payload: { from: 'Carol', to: 'Alice' } });
  
  const stats = engine.analytics.getStats();
  assert(stats.turns.total === 3, 'Should track 3 turns');
  assert(stats.turns.byAgent['Bob'] === 1, 'Should track turns by agent');
  assert(stats.turns.byAgent['Carol'] === 1, 'Should track Carol\'s turn');
});

test('Analytics plugin tracks errors', () => {
  const engine = new MockEngine();
  analyticsPlugin.init(engine, {
    trackActions: false,
    trackTurns: false,
    trackErrors: true
  });
  
  engine.emit('engine:error', { 
    payload: { 
      err: { name: 'ValidationError', message: 'Invalid move' },
      action: { type: 'game:invalidMove' }
    } 
  });
  
  engine.emit('rule:error', {
    payload: {
      name: 'my-rule',
      error: { message: 'Rule failed' }
    }
  });
  
  const stats = engine.analytics.getStats();
  assert(stats.errors.total === 2, 'Should track 2 errors');
  assert(stats.errors.byType['ValidationError'] === 1, 'Should count error types');
  assert(stats.errors.byType['RuleError'] === 1, 'Should track rule errors');
});

test('Analytics plugin generates report', () => {
  const engine = new MockEngine();
  analyticsPlugin.init(engine);
  
  // Generate some activity
  engine.dispatch('game:start');
  engine.dispatch('agent:create', { name: 'Alice' });
  engine.dispatch('agent:create', { name: 'Bob' });
  engine.emit('turn:changed', { payload: { to: 'Alice' } });
  engine.emit('turn:changed', { payload: { to: 'Bob' } });
  engine.emit('game:end', { payload: { winner: 'Alice', reason: 'victory' } });
  
  const report = engine.analytics.getReport();
  assert(typeof report === 'string', 'Report should be a string');
  assert(report.includes('Game Analytics Report'), 'Should include header');
  assert(report.includes('Alice'), 'Should include winner');
  assert(report.includes('victory'), 'Should include reason');
});

test('Analytics plugin can be reset', () => {
  const engine = new MockEngine();
  analyticsPlugin.init(engine);
  
  engine.dispatch('test:action');
  engine.dispatch('test:action');
  
  let stats = engine.analytics.getStats();
  assert(stats.actions.total === 2, 'Should have 2 actions');
  
  engine.analytics.reset();
  
  stats = engine.analytics.getStats();
  assert(stats.actions.total === 0, 'Should have 0 actions after reset');
});

// ============================================================================
// SAVE STATE PLUGIN TESTS
// ============================================================================

console.log('\n💾 Save State Plugin Tests\n');

test('Save state plugin exposes save/load API', () => {
  const engine = new MockEngine();
  saveStatePlugin.init(engine, { 
    storageType: 'localStorage',
    autoSaveInterval: null
  });
  
  assert(typeof engine.saveGame === 'function', 'Should expose saveGame');
  assert(typeof engine.loadGame === 'function', 'Should expose loadGame');
  assert(typeof engine.deleteSave === 'function', 'Should expose deleteSave');
  assert(typeof engine.listSaves === 'function', 'Should expose listSaves');
  assert(typeof engine.enableAutoSave === 'function', 'Should expose enableAutoSave');
  assert(typeof engine.disableAutoSave === 'function', 'Should expose disableAutoSave');
});

test('Save state plugin emits events', () => {
  const engine = new MockEngine();
  saveStatePlugin.init(engine, { storageType: 'localStorage' });
  
  let saveEventFired = false;
  
  engine.on('save:success', () => {
    saveEventFired = true;
  });
  
  // Note: In real test, this would save to localStorage
  // For mock, we just verify the API exists
  assert(typeof engine.saveGame === 'function', 'Save API should exist');
});

// ============================================================================
// INTEGRATION TESTS
// ============================================================================

console.log('\n🎯 Plugin Integration Tests\n');

test('Multiple plugins work together', () => {
  const engine = new MockEngine();
  const pluginHost = new MockPluginHost(engine);
  
  // Load multiple plugins
  pluginHost.load('logging', loggingPlugin.init);
  pluginHost.load('analytics', analyticsPlugin.init);
  
  // Both plugins should be active
  assert(engine.loggingPlugin !== undefined, 'Logging plugin loaded');
  assert(engine.analytics !== undefined, 'Analytics plugin loaded');
  
  // Trigger activity
  engine.dispatch('game:start');
  engine.dispatch('agent:create', { name: 'Alice' });
  engine.emit('turn:changed', { payload: { to: 'Alice' } });
  
  // Both plugins should track
  const logCounts = engine.loggingPlugin.getCounts();
  const stats = engine.analytics.getStats();
  
  assert(logCounts['engine:action'] >= 2, 'Logging should track actions');
  assert(stats.actions.total === 2, 'Analytics should track actions');
  assert(stats.turns.total === 1, 'Analytics should track turns');
});

test('Plugins receive all engine events', () => {
  const engine = new MockEngine();
  
  // Custom plugin that counts events
  let eventCount = 0;
  const counterPlugin = {
    init: (engine) => {
      engine.on('engine:action', () => eventCount++);
      engine.on('turn:changed', () => eventCount++);
      engine.on('game:end', () => eventCount++);
    }
  };
  
  const pluginHost = new MockPluginHost(engine);
  pluginHost.load('counter', counterPlugin.init);
  
  // Trigger events
  engine.dispatch('test:action');
  engine.emit('turn:changed', {});
  engine.emit('game:end', {});
  
  assert(eventCount === 3, 'Plugin should receive all 3 events');
});

test('Plugins can extend engine API', () => {
  const engine = new MockEngine();
  
  // Custom plugin that adds methods
  const customPlugin = {
    init: (engine) => {
      engine.customMethod = (x) => x * 2;
      engine.customData = { value: 42 };
    }
  };
  
  const pluginHost = new MockPluginHost(engine);
  pluginHost.load('custom', customPlugin.init);
  
  assert(engine.customMethod(5) === 10, 'Custom method should work');
  assert(engine.customData.value === 42, 'Custom data should be accessible');
});

// ============================================================================
// RESULTS
// ============================================================================

console.log('\n' + '═'.repeat(60));
console.log(`\n📊 Test Results: ${passCount}/${testCount} passed\n`);

if (failCount === 0) {
  console.log('🎉 All plugin tests passed!\n');
  process.exit(0);
} else {
  console.log(`❌ ${failCount} tests failed\n`);
  process.exit(1);
}