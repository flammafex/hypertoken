#!/usr/bin/env node
/*
 * Copyright 2025 The Carpocratian Church of Commonality and Equality, Inc.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

/**
 * Regression test for Space.move / Space.transferZone.
 *
 * These methods splice a placement out of one zone and re-push the Automerge
 * proxy into another zone, which Automerge rejects with
 * "Cannot create a reference to an existing document object". The fix
 * materializes the spliced placement via JSON clone before re-inserting it.
 */

import { Engine } from '../engine/Engine.js';
import { Token } from '../core/Token.js';

// Test helpers
let passed = 0;
let failed = 0;

async function test(name: string, fn: () => void | Promise<void>) {
  try {
    await fn();
    passed++;
    console.log(`✓ ${name}`);
  } catch (err: any) {
    failed++;
    console.error(`✗ ${name}`);
    console.error(`  ${err.message}`);
  }
}

function assert(condition: boolean, message: string) {
  if (!condition) throw new Error(message);
}

function makeEngine(): Engine {
  const engine = new Engine();
  engine.dispatch('space:createZone', { name: 'zone1' });
  engine.dispatch('space:createZone', { name: 'zone2' });
  return engine;
}

// Summary
async function run() {
  await test('space:move moves a placement between zones and updates x/y', () => {
    const engine = makeEngine();
    const card = new Token({ id: 'c1', label: 'Card 1' });

    engine.dispatch('space:place', { zone: 'zone1', card, opts: { x: 1, y: 2 } });

    const placement = engine.space.zone('zone1')[0];
    assert(!!placement, 'placement should exist in zone1');
    const placementId = placement.id;

    // Move to zone2 with a new position.
    engine.dispatch('space:move', {
      fromZone: 'zone1',
      toZone: 'zone2',
      placementId,
      x: 10,
      y: 20,
    });

    const zone1 = engine.space.zone('zone1');
    const zone2 = engine.space.zone('zone2');

    assert(zone1.length === 0, 'source zone should no longer contain the placement');
    assert(zone2.length === 1, 'target zone should contain the placement');
    assert(zone2[0].id === placementId, 'moved placement should keep its id');
    assert(zone2[0].x === 10, 'moved placement x should be updated');
    assert(zone2[0].y === 20, 'moved placement y should be updated');
  });

  await test('Space.move (direct call) moves a placement between zones', () => {
    const engine = makeEngine();
    const card = new Token({ id: 'c2', label: 'Card 2' });

    engine.dispatch('space:place', { zone: 'zone1', card, opts: { x: 5, y: 5 } });
    const placementId = engine.space.zone('zone1')[0].id;

    // Signature: move(fromZone, toZone, placementId, opts)
    engine.space.move('zone1', 'zone2', placementId, { x: 7, y: 8 });

    const zone1 = engine.space.zone('zone1');
    const zone2 = engine.space.zone('zone2');

    assert(zone1.length === 0, 'source zone should be empty after direct move');
    assert(zone2.length === 1, 'target zone should contain the placement after direct move');
    assert(zone2[0].id === placementId, 'direct move should keep placement id');
    assert(zone2[0].x === 7 && zone2[0].y === 8, 'direct move should update x/y');
  });

  await test('space:transferZone moves all placements between zones', async () => {
    const engine = makeEngine();
    const card1 = new Token({ id: 't1', label: 'Token 1' });
    const card2 = new Token({ id: 't2', label: 'Token 2' });
    const card3 = new Token({ id: 't3', label: 'Token 3' });

    engine.dispatch('space:place', { zone: 'zone1', card: card1 });
    engine.dispatch('space:place', { zone: 'zone1', card: card2 });
    engine.dispatch('space:place', { zone: 'zone1', card: card3 });

    const count = await engine.dispatch('space:transferZone', {
      fromZone: 'zone1',
      toZone: 'zone2',
    });

    assert(count === 3, 'transferZone should report 3 moved placements');

    const zone1 = engine.space.zone('zone1');
    const zone2 = engine.space.zone('zone2');

    assert(zone1.length === 0, 'source zone should be empty after transferZone');
    assert(zone2.length === 3, 'target zone should contain all 3 placements after transferZone');

    const ids = zone2.map((p: any) => p.tokenId).sort();
    assert(ids.join(',') === 't1,t2,t3', 'all placements should be present in target zone');
  });

  console.log(`\n${passed} passed, ${failed} failed`);
  if (failed > 0) process.exit(1);
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
