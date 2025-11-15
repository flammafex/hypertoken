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
 * Test suite for Token Transformation actions
 * Tests: transform, attach, detach, merge, split
 */

import { Engine } from '../engine/Engine.js';
import { EventBus } from '../core/EventBus.js';
import { Token } from '../core/Token.js';
import { TokenActions } from '../engine/actions-extended.js';

// Helper function to create test tokens
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
  console.log('🧪 Testing Token Transformation Actions\n');
  
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
  
  // Setup engine for tests
  const engine = new Engine();
  engine.eventBus = new EventBus();
  
  // ============================================================
  // TEST: token:transform
  // ============================================================
  
  test('token:transform - basic property change', () => {
    const token = createToken('card-1', { label: 'Original' });
    
    TokenActions['token:transform'](engine, {
      token,
      properties: { label: 'Transformed' }
    });
    
    if (token.label !== 'Transformed') {
      throw new Error('Label not transformed');
    }
  });
  
  test('token:transform - metadata merge', () => {
    const token = createToken('card-2', { 
      meta: { power: 5, defense: 3 } 
    });
    
    TokenActions['token:transform'](engine, {
      token,
      properties: { 
        meta: { power: 10, status: 'buffed' }
      }
    });
    
    if (token.meta.power !== 10) {
      throw new Error('Power not updated');
    }
    if (token.meta.defense !== 3) {
      throw new Error('Defense should be preserved');
    }
    if (token.meta.status !== 'buffed') {
      throw new Error('Status not added');
    }
  });
  
  test('token:transform - multiple properties', () => {
    const token = createToken('card-3');
    
    TokenActions['token:transform'](engine, {
      token,
      properties: {
        label: 'New Label',
        text: 'New description',
        char: '★',
        meta: { transformed: true }
      }
    });
    
    if (token.label !== 'New Label' || 
        token.text !== 'New description' || 
        token.char !== '★' ||
        !token.meta.transformed) {
      throw new Error('Multiple properties not transformed correctly');
    }
  });
  
  // ============================================================
  // TEST: token:attach & token:detach
  // ============================================================
  
  test('token:attach - basic attachment', () => {
    const character = createToken('char-1', { label: 'Hero' });
    const sword = createToken('sword-1', { label: 'Sword of Power' });
    
    TokenActions['token:attach'](engine, {
      host: character,
      attachment: sword,
      attachmentType: 'equipment'
    });
    
    if (!character._attachments || character._attachments.length !== 1) {
      throw new Error('Attachment not added to host');
    }
    if (character._attachments[0].token !== sword) {
      throw new Error('Wrong token attached');
    }
    if (sword._attachedTo !== character.id) {
      throw new Error('Attachment backlink not set');
    }
  });
  
  test('token:attach - multiple attachments', () => {
    const character = createToken('char-2', { label: 'Hero' });
    const sword = createToken('sword-2', { label: 'Sword' });
    const shield = createToken('shield-2', { label: 'Shield' });
    const helm = createToken('helm-2', { label: 'Helm' });
    
    TokenActions['token:attach'](engine, {
      host: character,
      attachment: sword,
      attachmentType: 'weapon'
    });
    
    TokenActions['token:attach'](engine, {
      host: character,
      attachment: shield,
      attachmentType: 'armor'
    });
    
    TokenActions['token:attach'](engine, {
      host: character,
      attachment: helm,
      attachmentType: 'armor'
    });
    
    if (character._attachments.length !== 3) {
      throw new Error('Multiple attachments not added');
    }
  });
  
  test('token:detach - by attachment ID', () => {
    const character = createToken('char-3', { label: 'Hero' });
    const sword = createToken('sword-3', { label: 'Sword' });
    
    TokenActions['token:attach'](engine, {
      host: character,
      attachment: sword
    });
    
    const detached = TokenActions['token:detach'](engine, {
      host: character,
      attachmentId: sword.id
    });
    
    if (detached !== sword) {
      throw new Error('Wrong token detached');
    }
    if (character._attachments.length !== 0) {
      throw new Error('Attachment not removed from host');
    }
    if (sword._attachedTo) {
      throw new Error('Attachment backlink not cleaned up');
    }
  });
  
  test('token:detach - by attachment reference', () => {
    const character = createToken('char-4', { label: 'Hero' });
    const sword = createToken('sword-4', { label: 'Sword' });
    
    TokenActions['token:attach'](engine, {
      host: character,
      attachment: sword
    });
    
    const detached = TokenActions['token:detach'](engine, {
      host: character,
      attachment: sword
    });
    
    if (!detached || character._attachments.length !== 0) {
      throw new Error('Detach by reference failed');
    }
  });
  
  // ============================================================
  // TEST: token:merge
  // ============================================================
  
  test('token:merge - basic merge', () => {
    const token1 = createToken('resource-1', { 
      label: 'Wood', 
      meta: { quantity: 5 } 
    });
    const token2 = createToken('resource-2', { 
      label: 'Wood', 
      meta: { quantity: 3 } 
    });
    
    const merged = TokenActions['token:merge'](engine, {
      tokens: [token1, token2],
      resultProperties: {
        label: 'Wood Stack',
        meta: { quantity: 8 }
      }
    });
    
    if (!merged._mergedFrom) {
      throw new Error('Merge metadata not set');
    }
    if (merged._mergedFrom.length !== 2) {
      throw new Error('Wrong number of source tokens tracked');
    }
    if (merged.meta.quantity !== 8) {
      throw new Error('Merged properties not applied');
    }
  });
  
  test('token:merge - auto-merge metadata', () => {
    const token1 = createToken('gem-1', { 
      meta: { color: 'red', power: 5 } 
    });
    const token2 = createToken('gem-2', { 
      meta: { color: 'blue', defense: 3 } 
    });
    
    const merged = TokenActions['token:merge'](engine, {
      tokens: [token1, token2],
      resultProperties: {
        label: 'Fused Gem'
      }
    });
    
    // Should merge all meta properties
    if (merged.meta.power !== 5 || merged.meta.defense !== 3) {
      throw new Error('Metadata not auto-merged');
    }
    if (merged.meta.color !== 'blue') {
      throw new Error('Later metadata should override earlier');
    }
  });
  
  test('token:merge - keep originals', () => {
    const token1 = createToken('part-1');
    const token2 = createToken('part-2');
    
    TokenActions['token:merge'](engine, {
      tokens: [token1, token2],
      keepOriginals: true
    });
    
    if (token1._merged || token2._merged) {
      throw new Error('Original tokens marked as merged when keepOriginals=true');
    }
  });
  
  test('token:merge - mark originals merged', () => {
    const token1 = createToken('unit-1');
    const token2 = createToken('unit-2');
    
    const merged = TokenActions['token:merge'](engine, {
      tokens: [token1, token2],
      keepOriginals: false
    });
    
    if (!token1._merged || !token2._merged) {
      throw new Error('Original tokens not marked as merged');
    }
    if (token1._mergedInto !== merged.id || token2._mergedInto !== merged.id) {
      throw new Error('Merged destination not tracked');
    }
  });
  
  // ============================================================
  // TEST: token:split
  // ============================================================
  
  test('token:split - basic split', () => {
    const stack = createToken('stack-1', { 
      label: 'Resource Stack',
      meta: { quantity: 10 }
    });
    
    const splits = TokenActions['token:split'](engine, {
      token: stack,
      count: 2
    });
    
    if (!Array.isArray(splits) || splits.length !== 2) {
      throw new Error('Wrong number of split tokens returned');
    }
    if (!stack._split) {
      throw new Error('Original token not marked as split');
    }
    if (stack._splitInto.length !== 2) {
      throw new Error('Split destinations not tracked');
    }
  });
  
  test('token:split - custom properties for each split', () => {
    const stack = createToken('stack-2', { 
      meta: { type: 'gold' }
    });
    
    const splits = TokenActions['token:split'](engine, {
      token: stack,
      count: 3,
      properties: [
        { label: 'Gold Piece 1', meta: { value: 100 } },
        { label: 'Gold Piece 2', meta: { value: 100 } },
        { label: 'Gold Piece 3', meta: { value: 100 } }
      ]
    });
    
    if (splits[0].label !== 'Gold Piece 1' ||
        splits[1].label !== 'Gold Piece 2' ||
        splits[2].label !== 'Gold Piece 3') {
      throw new Error('Custom properties not applied to splits');
    }
    
    // Should preserve original meta
    if (splits[0].meta.type !== 'gold') {
      throw new Error('Original metadata not preserved in splits');
    }
  });
  
  test('token:split - split tracking', () => {
    const original = createToken('original-1');
    
    const splits = TokenActions['token:split'](engine, {
      token: original,
      count: 4
    });
    
    splits.forEach((split, index) => {
      if (split._splitFrom !== original.id) {
        throw new Error('Split source not tracked');
      }
      if (split._splitIndex !== index) {
        throw new Error('Split index not tracked');
      }
      if (!split._splitAt) {
        throw new Error('Split timestamp not set');
      }
    });
  });
  
  // ============================================================
  // INTEGRATION TEST: Complex scenario
  // ============================================================
  
  test('Integration - character with equipment that merges and splits', () => {
    const character = createToken('hero', { 
      label: 'Hero',
      meta: { hp: 100 }
    });
    
    const sword1 = createToken('sword-a', { 
      label: 'Iron Sword',
      meta: { damage: 10 }
    });
    
    const sword2 = createToken('sword-b', { 
      label: 'Steel Sword',
      meta: { damage: 15 }
    });
    
    // Attach first sword
    TokenActions['token:attach'](engine, {
      host: character,
      attachment: sword1,
      attachmentType: 'weapon'
    });
    
    // Merge swords into legendary weapon
    const legendary = TokenActions['token:merge'](engine, {
      tokens: [sword1, sword2],
      resultProperties: {
        label: 'Legendary Blade',
        meta: { damage: 30 }
      }
    });
    
    // Detach old sword
    TokenActions['token:detach'](engine, {
      host: character,
      attachment: sword1
    });
    
    // Attach legendary sword
    TokenActions['token:attach'](engine, {
      host: character,
      attachment: legendary,
      attachmentType: 'weapon'
    });
    
    // Transform character (level up)
    TokenActions['token:transform'](engine, {
      token: character,
      properties: {
        label: 'Hero (Level 10)',
        meta: { hp: 150, level: 10 }
      }
    });
    
    // Verify final state
    if (character._attachments.length !== 1) {
      throw new Error('Wrong number of attachments');
    }
    if (character._attachments[0].token.label !== 'Legendary Blade') {
      throw new Error('Wrong weapon attached');
    }
    if (character.meta.level !== 10) {
      throw new Error('Character not leveled up');
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
    console.log('\n🎉 All token transformation tests passed!');
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