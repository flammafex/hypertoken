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
 * Benchmark CRDT Chronicle Performance
 *
 * This benchmark measures:
 * 1. Chronicle creation
 * 2. State change performance
 * 3. Document merge performance
 * 4. Serialization/deserialization
 *
 * Baseline: TypeScript Automerge
 * Target: Rust automerge-rs (7-10x faster)
 */

import { Chronicle } from '../core/Chronicle.js';
import { Token } from '../core/Token.js';

console.log('📊 Chronicle CRDT Performance Benchmark\n');
console.log('Platform:', process.platform);
console.log('Node:', process.version);
console.log('');

// Helper to create test tokens
function createTokens(count: number): Token[] {
  const tokens = [];
  for (let i = 0; i < count; i++) {
    tokens.push(new Token({ id: `card-${i}`, index: i }));
  }
  return tokens;
}

// Benchmark 1: Chronicle Creation
console.log('Benchmark 1: Chronicle Creation');
const iterations = 1000;
const startCreate = Date.now();

for (let i = 0; i < iterations; i++) {
  new Chronicle();
}

const createDuration = Date.now() - startCreate;
console.log(`  Created ${iterations} Chronicles in ${createDuration}ms`);
console.log(`  Average: ${(createDuration / iterations).toFixed(3)}ms per Chronicle\n`);

// Benchmark 2: State Changes
console.log('Benchmark 2: State Changes (Stack operations)');
const chronicle = new Chronicle();

// Initialize with stack state
const tokens = createTokens(52);

// Helper to sanitize objects for Automerge (remove undefined values)
const sanitize = (obj: any) => JSON.parse(JSON.stringify(obj));

chronicle.change('initialize', (doc) => {
  doc.stack = {
    stack: tokens.map(t => sanitize(t)),
    drawn: [],
    discards: []
  };
});

const changeIterations = 1000;
const startChange = Date.now();

for (let i = 0; i < changeIterations; i++) {
  chronicle.change(`operation-${i}`, (doc) => {
    if (!doc.stack) return;

    // Simulate draw operation (must clone proxy to avoid reference errors)
    const cardProxy = doc.stack.stack.pop();
    if (cardProxy) {
      const card = sanitize(cardProxy);
      doc.stack.drawn.push(card);
    }
  });
}

const changeDuration = Date.now() - startChange;
console.log(`  Performed ${changeIterations} state changes in ${changeDuration}ms`);
console.log(`  Average: ${(changeDuration / changeIterations).toFixed(3)}ms per change\n`);

// Benchmark 3: Document Merge
console.log('Benchmark 3: Document Merge (CRDT sync)');

// Create two peers with divergent changes
const peer1 = new Chronicle();
const peer2 = new Chronicle();

// Peer 1: Initialize with stack
peer1.change('init', (doc) => {
  doc.stack = {
    stack: createTokens(52).map(t => sanitize(t)),
    drawn: [],
    discards: []
  };
});

// Peer 2: Start with same state
const peer1State = peer1.save();
peer2.load(peer1State);

// Both peers make independent changes
for (let i = 0; i < 10; i++) {
  peer1.change(`peer1-op-${i}`, (doc) => {
    if (!doc.stack) return;
    const cardProxy = doc.stack.stack.pop();
    if (cardProxy) {
      const card = sanitize(cardProxy);
      doc.stack.drawn.push(card);
    }
  });

  peer2.change(`peer2-op-${i}`, (doc) => {
    if (!doc.stack) return;
    const cardProxy = doc.stack.stack.shift();
    if (cardProxy) {
      const card = sanitize(cardProxy);
      doc.stack.discards.push(card);
    }
  });
}

// Benchmark merge
const mergeIterations = 100;
const startMerge = Date.now();

for (let i = 0; i < mergeIterations; i++) {
  const mergeTest1 = new Chronicle();
  const mergeTest2 = new Chronicle();

  mergeTest1.load(peer1.save());
  mergeTest2.load(peer2.save());

  // Merge peer2 into peer1
  mergeTest1.merge(mergeTest2.state);
}

const mergeDuration = Date.now() - startMerge;
console.log(`  Performed ${mergeIterations} merges in ${mergeDuration}ms`);
console.log(`  Average: ${(mergeDuration / mergeIterations).toFixed(3)}ms per merge\n`);

// Benchmark 4: Serialization/Deserialization
console.log('Benchmark 4: Serialization/Deserialization');

const largeChronicle = new Chronicle();
largeChronicle.change('large-state', (doc) => {
  doc.stack = {
    stack: createTokens(1000).map(t => sanitize(t)),
    drawn: [],
    discards: []
  };
});

const serIterations = 100;
let totalSaveTime = 0;
let totalLoadTime = 0;
let serializedSize = 0;

for (let i = 0; i < serIterations; i++) {
  // Save
  const startSave = Date.now();
  const data = largeChronicle.save();
  totalSaveTime += Date.now() - startSave;

  if (i === 0) serializedSize = data.length;

  // Load
  const startLoad = Date.now();
  const restored = new Chronicle();
  restored.load(data);
  totalLoadTime += Date.now() - startLoad;
}

console.log(`  Serialized ${serIterations}x (1000 tokens): ${totalSaveTime}ms total`);
console.log(`  Average save: ${(totalSaveTime / serIterations).toFixed(3)}ms`);
console.log(`  Serialized size: ${serializedSize} bytes (${(serializedSize / 1024).toFixed(2)} KB)`);
console.log(`  Deserialized ${serIterations}x: ${totalLoadTime}ms total`);
console.log(`  Average load: ${(totalLoadTime / serIterations).toFixed(3)}ms\n`);

// Benchmark 5: Base64 Encoding/Decoding
console.log('Benchmark 5: Base64 Encoding/Decoding');

const b64Iterations = 100;
let totalEncodeTime = 0;
let totalDecodeTime = 0;

for (let i = 0; i < b64Iterations; i++) {
  // Encode
  const startEncode = Date.now();
  const base64 = largeChronicle.saveToBase64();
  totalEncodeTime += Date.now() - startEncode;

  // Decode
  const startDecode = Date.now();
  const restored = new Chronicle();
  restored.loadFromBase64(base64);
  totalDecodeTime += Date.now() - startDecode;
}

console.log(`  Base64 encode ${b64Iterations}x: ${totalEncodeTime}ms total`);
console.log(`  Average encode: ${(totalEncodeTime / b64Iterations).toFixed(3)}ms`);
console.log(`  Base64 decode ${b64Iterations}x: ${totalDecodeTime}ms total`);
console.log(`  Average decode: ${(totalDecodeTime / b64Iterations).toFixed(3)}ms\n`);

// Summary
console.log('==================================================');
console.log('Summary (TypeScript Automerge Baseline)');
console.log('==================================================');
console.log(`Chronicle creation: ${(createDuration / iterations).toFixed(3)}ms`);
console.log(`State change: ${(changeDuration / changeIterations).toFixed(3)}ms`);
console.log(`Document merge: ${(mergeDuration / mergeIterations).toFixed(3)}ms`);
console.log(`Serialization: ${(totalSaveTime / serIterations).toFixed(3)}ms`);
console.log(`Deserialization: ${(totalLoadTime / serIterations).toFixed(3)}ms`);
console.log('');
console.log('Expected with Rust automerge-rs:');
console.log(`  Merge: ${(mergeDuration / mergeIterations / 7).toFixed(3)}ms (~7x faster)`);
console.log(`  Serialization: ${(totalSaveTime / serIterations / 10).toFixed(3)}ms (~10x faster)`);
console.log(`  Deserialization: ${(totalLoadTime / serIterations / 10).toFixed(3)}ms (~10x faster)`);
console.log('');
console.log('✅ Benchmark complete!');

process.exit(0);
