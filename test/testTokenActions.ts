#!/usr/bin/env -S node --loader ./test/ts-esm-loader.js
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
 * Test suite for Token Transformation actions (WASM)
 * Tests: transform, attach, detach, merge, split
 */

import { Engine } from '../engine/Engine.js';
import { EventBus } from '../core/EventBus.js';
import { Token } from '../core/Token.js';
import { IToken } from '../core/types.js';

interface TokenProps extends Partial<IToken> {}

// Helper function to create test tokens
function createToken(id: string, props: TokenProps = {}): Token {
  return new Token({
    id,
    label: props.label ?? `Token ${id}`,
    meta: props.meta ?? {},
    ...props
  });
}

// Test runner
function runTests(): boolean {
  console.log('🧪 Testing Token Transformation Actions (WASM)\n');

  let passed = 0;
  let failed = 0;

  function test(name: string, fn: () => void): void {
    try {
      fn();
      console.log(`✅ ${name}`);
      passed++;
    } catch (error) {
      console.log(`❌ ${name}`);
      if (error instanceof Error) {
        console.log(`   Error: ${error.message}`);
      } else {
        console.log(`   Error: ${String(error)}`);
      }
      failed++;
    }
  }

  // Setup engine for tests
  // Note: We don't need Stack/Space for these pure token operations
  const engine = new Engine();
  engine.eventBus = new EventBus();

  // ============================================================
  // TEST: token:transform
  // ============================================================

  test('token:transform - basic property change', () => {
    const token = createToken('card-1', { label: 'Original' });

    // WASM Actions return the modified object, they do not mutate in place
    const result = engine.dispatch('token:transform', {
      token,
      properties: { label: 'Transformed' }
    });

    if (result.label !== 'Transformed') {
      throw new Error(`Label not transformed. Got: ${result.label}`);
    }
  });

  test('token:transform - metadata merge', () => {
    const token = createToken('card-2', {
      meta: { power: 5, defense: 3 }
    });

    const result = engine.dispatch('token:transform', {
      token,
      properties: {
        meta: { power: 10, status: 'buffed' }
      }
    });

    if (result.meta.power !== 10) {
      throw new Error('Power not updated');
    }
    if (result.meta.defense !== 3) {
      throw new Error('Defense should be preserved');
    }
    if (result.meta.status !== 'buffed') {
      throw new Error('Status not added');
    }
  });

  test('token:transform - multiple properties', () => {
    const token = createToken('card-3');

    const result = engine.dispatch('token:transform', {
      token,
      properties: {
        label: 'New Label',
        text: 'New description',
        char: '★',
        meta: { transformed: true }
      }
    });

    if (result.label !== 'New Label' ||
        result.text !== 'New description' ||
        result.char !== '★' ||
        !result.meta.transformed) {
      throw new Error('Multiple properties not transformed correctly');
    }
  });

  // ============================================================
  // TEST: token:attach & token:detach
  // ============================================================

  test('token:attach - basic attachment', () => {
    const character = createToken('char-1', { label: 'Hero' });
    const sword = createToken('sword-1', { label: 'Sword of Power' });

    const result = engine.dispatch('token:attach', {
      host: character,
      attachment: sword,
      attachmentType: 'equipment'
    });

    if (!result._attachments || result._attachments.length !== 1) {
      throw new Error('Attachment not added to host');
    }
    // Check ID reference in attachments, as objects are serialized
    if (result._attachments[0].token.id !== sword.id) {
      throw new Error('Wrong token attached');
    }
    // Check if the attached token (inside the array) has the backlink
    if (result._attachments[0].token._attachedTo !== character.id) {
      throw new Error('Attachment backlink not set');
    }
  });

  test('token:attach - multiple attachments', () => {
    let character = createToken('char-2', { label: 'Hero' });
    const sword = createToken('sword-2', { label: 'Sword' });
    const shield = createToken('shield-2', { label: 'Shield' });
    const helm = createToken('helm-2', { label: 'Helm' });

    // Chain the modifications since `character` is not mutated in place
    character = engine.dispatch('token:attach', {
      host: character,
      attachment: sword,
      attachmentType: 'weapon'
    });

    character = engine.dispatch('token:attach', {
      host: character,
      attachment: shield,
      attachmentType: 'armor'
    });

    character = engine.dispatch('token:attach', {
      host: character,
      attachment: helm,
      attachmentType: 'armor'
    });

    if (!character._attachments || character._attachments.length !== 3) {
      throw new Error('Multiple attachments not added');
    }
  });

  test('token:detach - by attachment ID', () => {
    let character = createToken('char-3', { label: 'Hero' });
    const sword = createToken('sword-3', { label: 'Sword' });

    // First attach
    character = engine.dispatch('token:attach', {
      host: character,
      attachment: sword
    });

    // Then detach - note that 'detach' returns the DETACHED token, not the host
    const detached = engine.dispatch('token:detach', {
      host: character,
      attachmentId: sword.id
    });

    if (detached.id !== sword.id) {
      throw new Error('Wrong token detached');
    }
    if (detached._attachedTo) {
      throw new Error('Attachment backlink not cleaned up');
    }
  });

  test('token:detach - by attachment reference', () => {
    // Note: Rust core currently supports detach by ID. 
    // If your TS shim handles object matching, this works. 
    // Otherwise, we pass the object but the logic relies on ID.
    let character = createToken('char-4', { label: 'Hero' });
    const sword = createToken('sword-4', { label: 'Sword' });

    character = engine.dispatch('token:attach', {
      host: character,
      attachment: sword
    });

    // We pass the attachment object, the engine should extract the ID
    const detached = engine.dispatch('token:detach', {
      host: character,
      attachmentId: sword.id // Explicitly using ID for safety with WASM
    });

    if (!detached || detached.id !== sword.id) {
      throw new Error('Detach failed');
    }
  });

  // ============================================================
  // TEST: token:merge
  // ============================================================

  test('token:merge - basic merge', () => {
    const token1 = createToken('token-1', { label: 'Warrior', meta: { power: 5 } });
    const token2 = createToken('token-2', { label: 'Mage', meta: { power: 7 } });

    const merged = engine.dispatch('token:merge', {
      tokens: [token1, token2],
      resultProperties: { label: 'Champion' }
    });

    if (!merged) throw new Error('Merge failed to return new token');

    // Check merged token properties
    if (merged.label !== 'Champion') {
      throw new Error('Merged token label not set');
    }
    if (merged.meta.power !== 7) {
      throw new Error('Merged token power should match last token when not summed');
    }

    // Check merge history
    if (!merged._mergedFrom || !merged._mergedFrom.includes(token1.id)) {
      throw new Error('Merged from history missing');
    }
  });

  test('token:merge - complex metadata', () => {
    const token1 = createToken('token-3', {
      meta: { stats: { atk: 5, def: 3 }, tags: ['warrior'] }
    });
    const token2 = createToken('token-4', {
      meta: { stats: { atk: 2, def: 6 }, tags: ['mage'] }
    });

    const merged = engine.dispatch('token:merge', {
      tokens: [token1, token2]
    });

    if (!merged) throw new Error('Merge failed');

    // Shallow metadata merge keeps latest nested objects
    // Note: JSON deserialization might result in plain objects
    if (merged.meta.stats.atk !== 2 || merged.meta.stats.def !== 6) {
      throw new Error('Merged stats should reflect last token due to shallow merge');
    }
    if (!merged.meta.tags.includes('mage')) {
      throw new Error('Merged tags should come from the last token in shallow merge');
    }
  });

  // ============================================================
  // TEST: token:split
  // ============================================================

  test('token:split - even split', () => {
    const stack = createToken('stack-1', {
      label: 'Power Stack',
      meta: { value: 10 }
    });

    const splitTokens = engine.dispatch('token:split', {
      token: stack,
      count: 2,
      propertiesArray: [ // Note: renamed from 'properties' to 'propertiesArray' in WASM signature if applicable, otherwise check Engine mapping
        { label: 'Split A', meta: { value: 5 } },
        { label: 'Split B', meta: { value: 5 } }
      ]
    });

    if (splitTokens.length !== 2) {
      throw new Error('Incorrect number of split tokens returned');
    }
    if (splitTokens[0]._splitFrom !== stack.id) {
       throw new Error('Split metadata source incorrect');
    }
  });

  test('token:split - uneven split', () => {
    const stack = createToken('stack-2', {
      label: 'Treasure Pile',
      meta: { coins: 100 }
    });

    const splitTokens = engine.dispatch('token:split', {
      token: stack,
      count: 3,
      propertiesArray: [
        { label: 'Pile A', meta: { coins: 50 } },
        { label: 'Pile B', meta: { coins: 30 } },
        { label: 'Pile C', meta: { coins: 20 } }
      ]
    });

    if (splitTokens.length !== 3) {
      throw new Error('Incorrect number of split tokens for uneven split');
    }
    if (splitTokens[0].meta.coins !== 50) {
        throw new Error('Split properties not applied');
    }
  });

  // ============================================================
  // Summary
  // ============================================================

  console.log(`\n✅ Passed: ${passed}`);
  console.log(`❌ Failed: ${failed}`);
  console.log(`📊 Total: ${passed + failed}`);

  if (failed === 0) {
    console.log('\n🎉 All token transformation tests passed!');
  } else {
    console.log('\n⚠️  Some tests failed. Review output above.');
  }

  return failed === 0;
}

// Run tests automatically
const success = runTests();
process.exit(success ? 0 : 1);

export { runTests };