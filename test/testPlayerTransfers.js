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
 * Test suite for Agent Transfer actions
 * Tests: transfer, trade, steal
 */

import { Engine } from '../engine/Engine.js';
import { EventBus } from '../core/EventBus.js';
import { Token } from '../core/Token.js';
import { AgentActions } from '../engine/actions-extended.js';
import { Chronicle } from '../core/Chronicle.js'; // FIX: Import Chronicle
import { Space } from '../core/Space.js'; // FIX: Import Space

// Helper to create tokens
function createToken(id, props = {}) {
  return new Token({
    id,
    label: props.label || `Token ${id}`,
    meta: props.meta || {},
    ...props
  });
}

// Test runner
function runTests() {
  console.log('🧪 Testing Agent Transfer Actions\n');
  
  let passed = 0;
  let failed = 0;
  
  function test(name, fn) {
    try {
      fn();
      console.log(`✅ ${name}`);
      passed++;
    } catch (error) {
      console.log(`❌ ${name}`);
      console.log(`   Error: ${error.message}`);
      failed++;
    }
  }
  
  // Setup
  const session = new Chronicle(); // FIX: Create session
  const space = new Space(session); // FIX: Create space
 const engine = new Engine({ session: session, space: space }); // FIX 3: Provision engine with a synched space
  engine.eventBus = new EventBus();
  
  // ============================================================
  // TEST: agent:transfer - resource transfers
  // ============================================================
  
  test('agent:transfer - basic resource transfer', () => {
    engine._agents = [];
    
    // Create agents with resources
    const alice = { 
      name: 'Alice', 
      id: 'alice-1',
      resources: { gold: 100 }
    };
    const bob = { 
      name: 'Bob', 
      id: 'bob-1',
      resources: { gold: 50 }
    };
    
    engine._agents.push(alice, bob);
    
    // Transfer gold from Alice to Bob
    const result = AgentActions['agent:transfer'](engine, {
      from: 'Alice',
      to: 'Bob',
      resource: 'gold',
      amount: 30
    });
    
    if (!result.success) {
      throw new Error('Transfer should succeed');
    }
    if (alice.resources.gold !== 70) {
      throw new Error(`Alice should have 70 gold, has ${alice.resources.gold}`);
    }
    if (bob.resources.gold !== 80) {
      throw new Error(`Bob should have 80 gold, has ${bob.resources.gold}`);
    }
  });
  
  test('agent:transfer - insufficient resources', () => {
    engine._agents = [];
    
    const alice = { name: 'Alice', id: 'alice-2', resources: { gold: 10 } };
    const bob = { name: 'Bob', id: 'bob-2', resources: {} };
    
    engine._agents.push(alice, bob);
    
    try {
      AgentActions['agent:transfer'](engine, {
        from: 'Alice',
        to: 'Bob',
        resource: 'gold',
        amount: 50
      });
      throw new Error('Should have thrown insufficient resources error');
    } catch (error) {
      if (!error.message.includes('only has 10')) {
        throw new Error('Wrong error message: ' + error.message);
      }
    }
  });
  
  test('agent:transfer - token transfer', () => {
    engine._agents = [];
    
    const sword = createToken('sword-1', { label: 'Magic Sword' });
    
    const alice = { 
      name: 'Alice', 
      id: 'alice-3',
      inventory: [sword] // FIX
    };
    const bob = { 
      name: 'Bob', 
      id: 'bob-3',
      inventory: [] // FIX
    };
    
    engine._agents.push(alice, bob);
    
    const result = AgentActions['agent:transfer'](engine, {
      from: 'Alice',
      to: 'Bob',
      token: sword
    });
    
    if (!result.success) {
      throw new Error('Token transfer should succeed');
    }
    if (alice.inventory.length !== 0) { // FIX
      throw new Error('Alice should have no cards in hand');
    }
    if (bob.inventory.length !== 1 || bob.inventory[0] !== sword) { // FIX
      throw new Error('Bob should have the sword');
    }
  });
  
  test('agent:transfer - transaction tracking', () => {
    engine._agents = [];
    engine._transactions = [];
    
    const alice = { name: 'Alice', id: 'alice-4', resources: { gems: 20 } };
    const bob = { name: 'Bob', id: 'bob-4', resources: {} };
    
    engine._agents.push(alice, bob);
    
    AgentActions['agent:transfer'](engine, {
      from: 'Alice',
      to: 'Bob',
      resource: 'gems',
      amount: 5
    });
    
    if (engine._transactions.length !== 1) {
      throw new Error('Should have 1 transaction recorded');
    }
    
    const tx = engine._transactions[0];
    if (tx.type !== 'resource_transfer' || tx.from !== 'Alice' || tx.to !== 'Bob') {
      throw new Error('Transaction not properly recorded');
    }
  });
  
  // ============================================================
  // TEST: agent:trade - bidirectional exchanges
  // ============================================================
  
  test('agent:trade - resource for resource', () => {
    engine._agents = [];
    
    const alice = { 
      name: 'Alice', 
      id: 'alice-5',
      resources: { gold: 100, wood: 0 }
    };
    const bob = { 
      name: 'Bob', 
      id: 'bob-5',
      resources: { gold: 0, wood: 200 }
    };
    
    engine._agents.push(alice, bob);
    
    const result = AgentActions['agent:trade'](engine, {
      agent1: { 
        name: 'Alice', 
        offer: { resource: 'gold', amount: 50 }
      },
      agent2: { 
        name: 'Bob', 
        offer: { resource: 'wood', amount: 100 }
      }
    });
    
    if (!result.success) {
      throw new Error('Trade should succeed');
    }
    
    // Alice should have: 50 gold, 100 wood
    if (alice.resources.gold !== 50 || alice.resources.wood !== 100) {
      throw new Error(`Alice resources wrong: ${JSON.stringify(alice.resources)}`);
    }
    
    // Bob should have: 50 gold, 100 wood
    if (bob.resources.gold !== 50 || bob.resources.wood !== 100) {
      throw new Error(`Bob resources wrong: ${JSON.stringify(bob.resources)}`);
    }
  });
  
  test('agent:trade - token for resource', () => {
    engine._agents = [];
    
    const magicRing = createToken('ring-1', { label: 'Magic Ring' });
    
    const alice = { 
      name: 'Alice', 
      id: 'alice-6',
      inventory: [magicRing], // FIX
      resources: {}
    };
    const bob = { 
      name: 'Bob', 
      id: 'bob-6',
      inventory: [], // FIX
      resources: { gold: 500 }
    };
    
    engine._agents.push(alice, bob);
    
    const result = AgentActions['agent:trade'](engine, {
      agent1: { 
        name: 'Alice', 
        offer: { token: magicRing }
      },
      agent2: { 
        name: 'Bob', 
        offer: { resource: 'gold', amount: 100 }
      }
    });
    
    if (!result.success) {
      throw new Error('Trade should succeed');
    }
    
    // Alice should have: 100 gold, no ring
    if (alice.inventory.length !== 0) { // FIX
      throw new Error('Alice should not have the ring');
    }
    if (alice.resources.gold !== 100) {
      throw new Error('Alice should have 100 gold');
    }
    
    // Bob should have: 400 gold, ring
    if (bob.inventory.length !== 1 || bob.inventory[0] !== magicRing) { // FIX
      throw new Error('Bob should have the ring');
    }
    if (bob.resources.gold !== 400) {
      throw new Error('Bob should have 400 gold remaining');
    }
  });
  
  test('agent:trade - insufficient resources validation', () => {
    engine._agents = [];
    
    const alice = { name: 'Alice', id: 'alice-7', resources: { gold: 10 } };
    const bob = { name: 'Bob', id: 'bob-7', resources: { wood: 100 } };
    
    engine._agents.push(alice, bob);
    
    try {
      AgentActions['agent:trade'](engine, {
        agent1: { 
          name: 'Alice', 
          offer: { resource: 'gold', amount: 50 }  // Alice only has 10!
        },
        agent2: { 
          name: 'Bob', 
          offer: { resource: 'wood', amount: 10 }
        }
      });
      throw new Error('Trade should have failed');
    } catch (error) {
      if (!error.message.includes('only has 10')) {
        throw new Error('Wrong error: ' + error.message);
      }
    }
  });
  
  test('agent:trade - token for token', () => {
    engine._agents = [];
    
    const sword = createToken('sword-2', { label: 'Iron Sword' });
    const shield = createToken('shield-1', { label: 'Steel Shield' });
    
    const alice = { name: 'Alice', id: 'alice-8', inventory: [sword] }; // FIX
    const bob = { name: 'Bob', id: 'bob-8', inventory: [shield] }; // FIX
    
    engine._agents.push(alice, bob);
    
    const result = AgentActions['agent:trade'](engine, {
      agent1: { 
        name: 'Alice', 
        offer: { token: sword }
      },
      agent2: { 
        name: 'Bob', 
        offer: { token: shield }
      }
    });
    
    if (!result.success) {
      throw new Error('Trade should succeed');
    }
    
    // Alice should have shield, not sword
    if (alice.inventory.length !== 1 || alice.inventory[0] !== shield) { // FIX
      throw new Error('Alice should have the shield');
    }
    
    // Bob should have sword, not shield
    if (bob.inventory.length !== 1 || bob.inventory[0] !== sword) { // FIX
      throw new Error('Bob should have the sword');
    }
  });
  
  // ============================================================
  // TEST: agent:steal - forcible taking
  // ============================================================
  
  test('agent:steal - basic resource steal', () => {
    engine._agents = [];
    
    const victim = { name: 'Victim', id: 'v-1', resources: { gold: 100 } };
    const thief = { name: 'Thief', id: 't-1', resources: {} };
    
    engine._agents.push(victim, thief);
    
    const result = AgentActions['agent:steal'](engine, {
      from: 'Victim',
      to: 'Thief',
      resource: 'gold',
      amount: 30
    });
    
    if (!result.success) {
      throw new Error('Steal should succeed');
    }
    if (result.stolen !== 30) {
      throw new Error('Should have stolen 30 gold');
    }
    if (victim.resources.gold !== 70) {
      throw new Error('Victim should have 70 gold left');
    }
    if (thief.resources.gold !== 30) {
      throw new Error('Thief should have 30 gold');
    }
  });
  
  test('agent:steal - steal more than available', () => {
    engine._agents = [];
    
    const victim = { name: 'Victim', id: 'v-2', resources: { gold: 20 } };
    const thief = { name: 'Thief', id: 't-2', resources: {} };
    
    engine._agents.push(victim, thief);
    
    // Try to steal 100, but only 20 available
    const result = AgentActions['agent:steal'](engine, {
      from: 'Victim',
      to: 'Thief',
      resource: 'gold',
      amount: 100
    });
    
    if (!result.success) {
      throw new Error('Steal should succeed with partial amount');
    }
    if (result.stolen !== 20) {
      throw new Error('Should have stolen 20 gold (all available)');
    }
    if (victim.resources.gold !== 0) {
      throw new Error('Victim should have 0 gold');
    }
    if (thief.resources.gold !== 20) {
      throw new Error('Thief should have 20 gold');
    }
  });
  
  test('agent:steal - token steal', () => {
    engine._agents = [];
    
    const treasure = createToken('treasure-1', { label: 'Treasure Chest' });
    
    const victim = { name: 'Victim', id: 'v-3', inventory: [treasure] }; // FIX
    const thief = { name: 'Thief', id: 't-3', inventory: [] }; // FIX
    
    engine._agents.push(victim, thief);
    
    const result = AgentActions['agent:steal'](engine, {
      from: 'Victim',
      to: 'Thief',
      token: treasure
    });
    
    if (!result.success) {
      throw new Error('Steal should succeed');
    }
    if (victim.inventory.length !== 0) { // FIX
      throw new Error('Victim should have no tokens');
    }
    if (thief.inventory.length !== 1 || thief.inventory[0] !== treasure) { // FIX
      throw new Error('Thief should have the treasure');
    }
  });
  
  test('agent:steal - with validation function', () => {
    engine._agents = [];
    
    const victim = { name: 'Victim', id: 'v-4', resources: { gold: 50 } };
    const thief = { 
      name: 'Thief', 
      id: 't-4', 
      resources: {},
      meta: { hasThiefAbility: true }
    };
    const nonThief = { 
      name: 'NonThief', 
      id: 'nt-4', 
      resources: {},
      meta: { hasThiefAbility: false }
    };
    
    engine._agents.push(victim, thief, nonThief);
    
    // Validation function: can only steal if has thief ability
    const validate = (stealer, victim, engine) => {
      return stealer.meta.hasThiefAbility === true;
    };
    
    // Thief should succeed
    const result1 = AgentActions['agent:steal'](engine, {
      from: 'Victim',
      to: 'Thief',
      resource: 'gold',
      amount: 10,
      validate
    });
    
    if (!result1.success) {
      throw new Error('Thief with ability should succeed');
    }
    
    // NonThief should fail
    try {
      AgentActions['agent:steal'](engine, {
        from: 'Victim',
        to: 'NonThief',
        resource: 'gold',
        amount: 10,
        validate
      });
      throw new Error('NonThief should have failed validation');
    } catch (error) {
      if (!error.message.includes('validation failed')) {
        throw new Error('Wrong error: ' + error.message);
      }
    }
  });
  
  test('agent:steal - empty resources', () => {
    engine._agents = [];
    
    const victim = { name: 'Victim', id: 'v-5', resources: {} };
    const thief = { name: 'Thief', id: 't-5', resources: {} };
    
    engine._agents.push(victim, thief);
    
    try {
      AgentActions['agent:steal'](engine, {
        from: 'Victim',
        to: 'Thief',
        resource: 'gold',
        amount: 10
      });
      throw new Error('Should have thrown no resources error');
    } catch (error) {
      if (!error.message.includes('has no gold')) {
        throw new Error('Wrong error: ' + error.message);
      }
    }
  });
  
  // ============================================================
  // INTEGRATION TEST: Complex multi-agent economy
  // ============================================================
  
  test('Integration - multi-agent trading economy', () => {
    engine._agents = [];
    engine._transactions = [];
    
    // Setup 3 agents with different resources
    const merchant = { 
      name: 'Merchant', 
      id: 'm-1',
      resources: { gold: 1000, food: 50 },
      inventory: [] // FIX
    };
    const farmer = { 
      name: 'Farmer', 
      id: 'f-1',
      resources: { gold: 100, food: 500 },
      inventory: [] // FIX
    };
    const warrior = { 
      name: 'Warrior', 
      id: 'w-1',
      resources: { gold: 200, food: 100 },
      inventory: [], // FIX
      meta: { hasThiefAbility: true }
    };
    
    engine._agents.push(merchant, farmer, warrior);
    
    // 1. Merchant buys food from Farmer
    AgentActions['agent:trade'](engine, {
      agent1: { 
        name: 'Merchant', 
        offer: { resource: 'gold', amount: 100 }
      },
      agent2: { 
        name: 'Farmer', 
        offer: { resource: 'food', amount: 200 }
      }
    });
    
    if (merchant.resources.gold !== 900 || merchant.resources.food !== 250) {
      throw new Error('Merchant trade failed');
    }
    if (farmer.resources.gold !== 200 || farmer.resources.food !== 300) {
      throw new Error('Farmer trade failed');
    }
    
    // 2. Warrior demands tribute from Farmer
    AgentActions['agent:transfer'](engine, {
      from: 'Farmer',
      to: 'Warrior',
      resource: 'gold',
      amount: 50
    });
    
    if (farmer.resources.gold !== 150) {
      throw new Error('Farmer tribute failed');
    }
    if (warrior.resources.gold !== 250) {
      throw new Error(`Warrior tribute failed (Expected 250, got ${warrior.resources.gold})`);
    }
    
    // 3. Warrior steals from Merchant
    const validate = (stealer) => stealer.meta.hasThiefAbility;
    
    AgentActions['agent:steal'](engine, {
      from: 'Merchant',
      to: 'Warrior',
      resource: 'gold',
      amount: 100,
      validate
    });
    
    if (merchant.resources.gold !== 800) {
      throw new Error('Merchant steal failed');
    }
    if (warrior.resources.gold !== 350) {
      throw new Error('Warrior steal failed');
    }
    
    // Verify transaction log
    if (engine._transactions.length !== 3) {
      throw new Error(`Expected 3 transactions, got ${engine._transactions.length}`);
    }
    
    const types = engine._transactions.map(t => t.type);
    if (!types.includes('trade') || !types.includes('resource_transfer') || !types.includes('steal_resource')) {
      throw new Error('Transaction types incorrect');
    }
  });
  
  // ============================================================
  // SUMMARY
  // ============================================================
  
  console.log('\n' + '='.repeat(50));
  console.log(`✅ Passed: ${passed}`);
  console.log(`❌ Failed: ${failed}`);
  console.log(`📊 Total: ${passed + failed}`);
  
  if (failed === 0) {
    console.log('\n🎉 All agent transfer tests passed!');
  } else {
    console.log('\n⚠️  Some tests failed. Review output above.');
  }
  
  return failed === 0;
}

// Run tests if executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  const success = runTests();
  process.exit(success ? 0 : 1);
}

export { runTests };