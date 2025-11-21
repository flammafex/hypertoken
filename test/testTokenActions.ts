#!/usr/bin/env -S node --loader ./test/ts-esm-loader.js
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
  console.log('🧪 Testing Token Transformation Actions\n');

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

    if (!character._attachments || character._attachments.length !== 3) {
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
    if (!character._attachments || character._attachments.length !== 0) {
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

    if (!detached || (character._attachments && character._attachments.length !== 0)) {
      throw new Error('Detach by reference failed');
    }
  });

  // ============================================================
  // TEST: token:merge
  // ============================================================

  test('token:merge - basic merge', () => {
    const token1 = createToken('token-1', { label: 'Warrior', meta: { power: 5 } });
    const token2 = createToken('token-2', { label: 'Mage', meta: { power: 7 } });

    const merged = TokenActions['token:merge'](engine, {
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
    if (!token1._merged || !token2._merged) {
      throw new Error('Original tokens not marked as merged');
    }
    if (token1._mergedInto !== merged.id || token2._mergedInto !== merged.id) {
      throw new Error('Merged token references incorrect');
    }
  });

  test('token:merge - complex metadata', () => {
    const token1 = createToken('token-3', {
      meta: { stats: { atk: 5, def: 3 }, tags: ['warrior'] }
    });
    const token2 = createToken('token-4', {
      meta: { stats: { atk: 2, def: 6 }, tags: ['mage'] }
    });

    const merged = TokenActions['token:merge'](engine, {
      tokens: [token1, token2]
    });

    if (!merged) throw new Error('Merge failed');

    // Shallow metadata merge keeps latest nested objects
    if (merged.meta.stats.atk !== 2 || merged.meta.stats.def !== 6) {
      throw new Error('Merged stats should reflect last token due to shallow merge');
    }
    if (!merged.meta.tags.includes('mage')) {
      throw new Error('Merged tags should come from the last token in shallow merge');
    }
  });

  test('token:merge - handles missing meta gracefully', () => {
    const token1 = createToken('token-5');
    const token2 = createToken('token-6');

    const merged = TokenActions['token:merge'](engine, {
      tokens: [token1, token2],
      resultProperties: {
        meta: { description: 'Merged token' }
      }
    });

    if (!merged || !merged.meta.description) {
      throw new Error('Merge did not handle missing meta');
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

    const splitTokens = TokenActions['token:split'](engine, {
      token: stack,
      count: 2,
      properties: [
        { label: 'Split A', meta: { value: 5 } },
        { label: 'Split B', meta: { value: 5 } }
      ]
    });

    if (!stack._split || !stack._splitInto || stack._splitInto.length !== 2) {
      throw new Error('Split metadata not set on original token');
    }
    if (splitTokens.length !== 2) {
      throw new Error('Incorrect number of split tokens returned');
    }
  });

  test('token:split - uneven split', () => {
    const stack = createToken('stack-2', {
      label: 'Treasure Pile',
      meta: { coins: 100 }
    });

    const splitTokens = TokenActions['token:split'](engine, {
      token: stack,
      count: 3,
      properties: [
        { label: 'Pile A', meta: { coins: 50 } },
        { label: 'Pile B', meta: { coins: 30 } },
        { label: 'Pile C', meta: { coins: 20 } }
      ]
    });

    if (!stack._split || !stack._splitInto || stack._splitInto.length !== 3) {
      throw new Error('Split metadata not set correctly');
    }
    if (splitTokens.length !== 3) {
      throw new Error('Incorrect number of split tokens for uneven split');
    }
  });

  test('token:split - preserves attachments', () => {
    const stack = createToken('stack-3', { label: 'Artifact', meta: { rarity: 'legendary' } });
    const charm = createToken('charm-1', { label: 'Magic Charm' });
    const rune = createToken('rune-1', { label: 'Ancient Rune' });

    // Attach items to original stack
    TokenActions['token:attach'](engine, {
      host: stack,
      attachment: charm
    });

    TokenActions['token:attach'](engine, {
      host: stack,
      attachment: rune
    });

    const splitTokens = TokenActions['token:split'](engine, {
      token: stack,
      count: 2,
      properties: [
        { label: 'Shard A' },
        { label: 'Shard B' }
      ]
    });

    if (!stack._split || !stack._splitInto || stack._splitInto.length !== 2) {
      throw new Error('Split metadata missing on stack with attachments');
    }
    if (splitTokens.length !== 2) {
      throw new Error('Incorrect number of split tokens when attachments present');
    }
  });

  // ============================================================
  // TEST: token:detach edge cases
  // ============================================================

  test('token:detach - handles missing attachments', () => {
    const character = createToken('char-7', { label: 'Hero' });

    const detached = TokenActions['token:detach'](engine, {
      host: character,
      attachmentId: 'non-existent'
    });

    if (detached !== null) {
      throw new Error('Detaching non-existent attachment should return null');
    }
  });

  test('token:detach - detaches multiple attachments', () => {
    const character = createToken('char-8', { label: 'Hero' });
    const sword = createToken('sword-8', { label: 'Sword' });
    const shield = createToken('shield-8', { label: 'Shield' });
    const ring = createToken('ring-8', { label: 'Ring' });

    TokenActions['token:attach'](engine, {
      host: character,
      attachment: sword
    });

    TokenActions['token:attach'](engine, {
      host: character,
      attachment: shield
    });

    TokenActions['token:attach'](engine, {
      host: character,
      attachment: ring
    });

    TokenActions['token:detach'](engine, {
      host: character,
      attachmentId: sword.id
    });

    const detached = TokenActions['token:detach'](engine, {
      host: character,
      attachment: ring
    });

    if (!detached || (character._attachments && character._attachments.length !== 1)) {
      throw new Error('Multiple detach did not remove correct attachments');
    }
  });

  test('token:detach - throws when host missing', () => {
    const sword = createToken('sword-9', { label: 'Sword' });

    let threw = false;
    try {
      TokenActions['token:detach'](engine, {
        host: null as unknown as Token,
        attachment: sword
      });
    } catch (error) {
      threw = true;
    }

    if (!threw) {
      throw new Error('Detach should throw when host is missing');
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
