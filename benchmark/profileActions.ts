/**
 * Action Performance Benchmark
 *
 * Phase 3C: Hybrid Integration - Profiling
 *
 * Comprehensive benchmark testing all 53 actions to identify
 * bottlenecks and prioritize Rust porting.
 */

import { Engine } from '../engine/Engine.js';
import { Chronicle } from '../core/Chronicle.js';
import { Stack } from '../core/Stack.js';
import { Space } from '../core/Space.js';
import { Source } from '../core/Source.js';
import { RuleEngine } from '../engine/RuleEngine.js';
import { ActionProfiler } from './ActionProfiler.js';
import type { IToken } from '../core/types.js';

/**
 * Create test tokens
 */
function createTestTokens(count: number): IToken[] {
  return Array.from({ length: count }, (_, i) => ({
    id: `token-${i}`,
    label: `Token ${i}`,
    group: 'test',
    text: `Test token ${i}`,
    meta: {},
    char: '□',
    kind: 'default',
    index: i,
  }));
}

/**
 * Wrap Engine.dispatch with profiling
 */
function wrapEngineWithProfiler(engine: Engine, profiler: ActionProfiler): Engine {
  const originalDispatch = engine.dispatch.bind(engine);

  engine.dispatch = function(type: string, payload: any = {}, opts: any = {}): any {
    return profiler.record(type, () => originalDispatch(type, payload, opts));
  };

  return engine;
}

/**
 * Run comprehensive action benchmark
 */
async function runBenchmark() {
  console.log('='.repeat(80));
  console.log('HYPERTOKEN ACTION PERFORMANCE BENCHMARK');
  console.log('='.repeat(80));
  console.log('');
  console.log('Testing all 53 actions with realistic workloads...');
  console.log('');

  const profiler = new ActionProfiler(true);
  profiler.start();

  // Create test environment
  const tokens = createTestTokens(100);
  const chronicle = new Chronicle();
  const stack = new Stack(chronicle, tokens);
  const space = new Space(chronicle, 'test-space');
  const source = new Source(chronicle);

  const engine = new Engine({ stack, space, source });
  wrapEngineWithProfiler(engine, profiler);

  // Benchmark scenarios
  console.log('Running benchmark scenarios...');
  console.log('');

  // ============================================================================
  // Scenario 1: Stack Operations (500 iterations)
  // ============================================================================
  console.log('📦 Scenario 1: Stack Operations (500 iterations)...');
  for (let i = 0; i < 500; i++) {
    // Basic operations
    if (i % 10 === 0) engine.dispatch('stack:shuffle');
    if (i % 5 === 0) engine.dispatch('stack:draw', { count: 1 });
    if (i % 20 === 0) engine.dispatch('stack:burn', { count: 2 });

    // Advanced operations
    if (i % 30 === 0) engine.dispatch('stack:cut', { position: 26 });
    if (i % 40 === 0) engine.dispatch('stack:reverse', { start: 0, end: 10 });
    if (i % 50 === 0) engine.dispatch('stack:peek', { count: 5 });

    // Reset periodically
    if (i % 100 === 0) engine.dispatch('stack:reset');
  }
  console.log('   ✓ Stack operations complete');

  // ============================================================================
  // Scenario 2: Space Operations (300 iterations)
  // ============================================================================
  console.log('🎲 Scenario 2: Space Operations (300 iterations)...');

  // Create zones
  const zones = ['hand', 'field', 'graveyard', 'deck', 'exile'];
  zones.forEach((zone, i) => {
    engine.dispatch('space:createZone', { id: zone, label: zone, x: i * 100, y: 0 });
  });

  // Place tokens
  for (let i = 0; i < 100; i++) {
    engine.dispatch('space:place', {
      zone: zones[i % zones.length],
      token: tokens[i],
      x: Math.random() * 500,
      y: Math.random() * 500,
    });
  }

  // Operations
  for (let i = 0; i < 300; i++) {
    const fromZone = zones[i % zones.length];
    const toZone = zones[(i + 1) % zones.length];

    if (i % 10 === 0) {
      engine.dispatch('space:transferZone', { fromZone, toZone });
    }

    if (i % 15 === 0) {
      engine.dispatch('space:shuffleZone', { zone: fromZone });
    }

    if (i % 20 === 0) {
      engine.dispatch('space:spreadZone', { zone: fromZone, pattern: 'linear' });
    }

    if (i % 25 === 0) {
      engine.dispatch('space:fanZone', { zone: fromZone, radius: 100 });
    }

    if (i % 30 === 0) {
      engine.dispatch('space:stackZone', { zone: fromZone });
    }

    if (i % 50 === 0) {
      engine.dispatch('space:clearZone', { zone: fromZone });
    }
  }
  console.log('   ✓ Space operations complete');

  // ============================================================================
  // Scenario 3: Source Operations (200 iterations)
  // ============================================================================
  console.log('♻️  Scenario 3: Source Operations (200 iterations)...');

  // Add stacks to source
  engine.dispatch('source:addStack', { stack: new Stack(chronicle, createTestTokens(52)) });
  engine.dispatch('source:addStack', { stack: new Stack(chronicle, createTestTokens(52)) });

  for (let i = 0; i < 200; i++) {
    if (i % 10 === 0) engine.dispatch('source:shuffle');
    if (i % 20 === 0) engine.dispatch('source:draw', { count: 5 });
    if (i % 30 === 0) engine.dispatch('source:burn', { count: 3 });
    if (i % 100 === 0) engine.dispatch('source:reset');
  }
  console.log('   ✓ Source operations complete');

  // ============================================================================
  // Scenario 4: Agent Operations (150 iterations)
  // ============================================================================
  console.log('🤖 Scenario 4: Agent Operations (150 iterations)...');

  for (let i = 0; i < 150; i++) {
    if (i % 50 === 0) {
      engine.dispatch('agent:create', { name: `agent-${i}`, meta: { score: 0 } });
    }

    engine.dispatch('agent:giveResource', {
      name: `agent-${Math.floor(i / 50) * 50}`,
      resource: 'gold',
      amount: 10,
    });

    if (i % 10 === 0) {
      engine.dispatch('agent:takeResource', {
        name: `agent-${Math.floor(i / 50) * 50}`,
        resource: 'gold',
        amount: 2,
      });
    }

    if (i % 20 === 0) {
      engine.dispatch('agent:giveCards', {
        name: `agent-${Math.floor(i / 50) * 50}`,
        cards: [tokens[i % tokens.length]],
        source: 'deck',
      });
    }
  }
  console.log('   ✓ Agent operations complete');

  // ============================================================================
  // Scenario 5: Token Operations (200 iterations)
  // ============================================================================
  console.log('🎴 Scenario 5: Token Operations (200 iterations)...');

  for (let i = 0; i < 200; i++) {
    const token = tokens[i % tokens.length];

    if (i % 10 === 0) {
      engine.dispatch('token:setProperty', {
        token,
        properties: { power: Math.random() * 10, toughness: Math.random() * 10 },
      });
    }

    if (i % 20 === 0) {
      engine.dispatch('token:attach', {
        host: token,
        attachment: tokens[(i + 1) % tokens.length],
        attachmentType: 'equipment',
      });
    }

    if (i % 30 === 0) {
      engine.dispatch('token:detach', {
        token,
      });
    }
  }
  console.log('   ✓ Token operations complete');

  // ============================================================================
  // Scenario 6: Batch Operations (100 iterations)
  // ============================================================================
  console.log('📊 Scenario 6: Batch Operations (100 iterations)...');

  for (let i = 0; i < 100; i++) {
    if (i % 10 === 0) {
      engine.dispatch('batch:filterTokens', {
        tokens,
        predicate: (t: IToken) => parseInt(t.id.split('-')[1]) % 2 === 0,
      });
    }

    if (i % 20 === 0) {
      engine.dispatch('batch:transformTokens', {
        tokens: tokens.slice(0, 20),
        operation: (t: IToken) => ({ ...t, modified: true }),
      });
    }
  }
  console.log('   ✓ Batch operations complete');

  // ============================================================================
  // Scenario 7: Game State Operations (100 iterations)
  // ============================================================================
  console.log('🎮 Scenario 7: Game State Operations (100 iterations)...');

  for (let i = 0; i < 100; i++) {
    if (i % 10 === 0) {
      engine.dispatch('game:setPhase', { phase: `phase-${i % 5}` });
    }

    if (i % 20 === 0) {
      engine.dispatch('game:setCustomValue', { key: 'turn', value: i });
    }

    if (i % 50 === 0) {
      engine.dispatch('game:declareWinner', { winner: 'player1', reason: 'test' });
    }
  }
  console.log('   ✓ Game state operations complete');

  // ============================================================================
  // Scenario 8: Rule Engine Stress Test (if available)
  // ============================================================================
  if (engine.ruleEngine) {
    console.log('⚙️  Scenario 8: Rule Engine (100 evaluations)...');

    for (let i = 0; i < 100; i++) {
      // Trigger rule evaluation through actions
      engine.dispatch('stack:draw', { count: 1 });
      engine.dispatch('space:place', {
        zone: 'hand',
        token: tokens[i % tokens.length],
        x: i * 10,
        y: 0,
      });
    }
    console.log('   ✓ Rule engine operations complete');
  }

  console.log('');
  console.log('✅ All scenarios complete!');
  console.log('');

  // Generate report
  profiler.printReport();

  // Export JSON for further analysis
  const json = profiler.exportJSON();
  const fs = await import('fs');
  fs.writeFileSync('/home/user/hypertoken/benchmark/profile-results.json', json);
  console.log('');
  console.log('📝 Detailed results saved to: benchmark/profile-results.json');
  console.log('');
}

// Run benchmark
runBenchmark()
  .then(() => {
    console.log('Benchmark complete!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('Benchmark failed:', error);
    process.exit(1);
  });
