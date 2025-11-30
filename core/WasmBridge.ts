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
 * WasmBridge: TypeScript ↔ Rust/WASM integration layer
 *
 * This module provides:
 * - Lazy loading of the WASM module
 * - Type-safe wrappers around Rust types
 * - Graceful fallback if WASM fails to load
 * - Performance monitoring and logging
 */

import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

// Type definitions for the WASM module
// These match the Rust wasm-bindgen exports
export interface WasmChronicle {
  new(): WasmChronicle;
  setState(stateJson: string): void;
  getState(): string;
  change(message: string, newStateJson: string): void;
  save(): Uint8Array;
  load(data: Uint8Array): void;
  saveToBase64(): string;
  loadFromBase64(base64: string): void;
  merge(otherData: Uint8Array): void;
  changeCount(): number;
  generateSyncMessage(syncState?: Uint8Array): Uint8Array;
  receiveSyncMessage(message: Uint8Array): void;
}

export interface WasmStack {
  new(): WasmStack;
  initializeWithTokens(tokensJson: string): void;
  size(): number;
  drawnCount(): number;
  discardCount(): number;
  peek(count: number): string;
  draw(count: number): string;
  shuffle(seed?: string): void;
  burn(count: number): string;
  discard(count: number): void;
  cut(index: number): void;
  insertAt(index: number, tokenJson: string): void;
  removeAt(index: number): string;
  swap(indexA: number, indexB: number): void;
  reverseRange(start: number, end: number): void;
  reset(): void;
  getState(): string;
  setState(stateJson: string): void;
}

export interface WasmSpace {
  new(): WasmSpace;
  createZone(name: string): void;
  deleteZone(name: string): void;
  hasZone(name: string): boolean;
  lockZone(name: string, locked: boolean): void;
  isZoneLocked(name: string): boolean;
  place(zoneName: string, tokenJson: string, x?: number, y?: number): void;
  remove(zoneName: string, tokenId: string): string;
  move(tokenId: string, fromZone: string, toZone: string, x?: number, y?: number): void;
  flip(zoneName: string, tokenId: string): void;
  clearZone(zoneName: string): void;
  getTokens(zoneName: string): string;
  getPlacements(zoneName: string): string;
  count(zoneName: string): number;
  shuffleZone(zoneName: string, seed?: string): void;
  getZoneNames(): string[];
  getState(): string;
  setState(stateJson: string): void;
}

export interface WasmSource {
  new(): WasmSource;
  initializeWithTokens(tokensJson: string, stackIdsJson: string): void;
  size(): number;
  burnedCount(): number;
  getTokens(): string;
  getBurned(): string;
  addStack(tokensJson: string, stackId: string): void;
  removeStack(stackId: string): void;
  burn(count: number): string;
  shuffle(seed?: string): void;
  draw(count: number): string;
  setReshufflePolicy(threshold: number, mode: string): void;
  reset(tokensJson: string): void;
  getSeed(): number | null;
  getReshufflePolicy(): string;
  getStackIds(): string;
  getState(): string;
  setState(stateJson: string): void;
}

export interface WasmToken {
  new(id: string, index: number): WasmToken;
  fromJSON(json: string): WasmToken;
  toJSON(): string;
  addTag(tag: string): void;
  removeTag(tag: string): boolean;
  hasTag(tag: string): boolean;
  flip(): void;
  isReversed(): boolean;
  getId(): string;
  getIndex(): number;
}

export interface WasmActionDispatcher {
  new(): WasmActionDispatcher;
  setStack(stack: WasmStack): void;
  setSpace(space: WasmSpace): void;
  setSource(source: WasmSource): void;
  getStack(): WasmStack | undefined;
  getSpace(): WasmSpace | undefined;
  getSource(): WasmSource | undefined;

  // Legacy JSON-based dispatch (has 19% overhead - deprecated)
  dispatch(actionJson: string): string;

  // Typed dispatch methods (zero overhead - use these!)
  // Stack actions
  stackDraw(count: number): string;
  stackPeek(count: number): string;
  stackShuffle(seed?: string): void;
  stackBurn(count: number): string;
  stackReset(): void;
  stackCut(index: number): void;
  stackInsertAt(index: number, tokenJson: string): void;
  stackRemoveAt(index: number): string;
  stackSwap(indexA: number, indexB: number): void;

  // Space actions
  spacePlace(zone: string, tokenJson: string, x?: number, y?: number): string;
  spaceRemove(zone: string, tokenId: string): string;
  spaceMove(tokenId: string, fromZone: string, toZone: string, x?: number, y?: number): void;
  spaceFlip(zone: string, tokenId: string): void;
  spaceCreateZone(name: string): void;
  spaceDeleteZone(name: string): void;
  spaceClearZone(name: string): void;
  spaceLockZone(name: string, locked: boolean): void;
  spaceShuffleZone(name: string, seed?: string): void;

  // Source actions
  sourceDraw(count: number): string;
  sourceShuffle(seed?: string): void;
  sourceBurn(count: number): string;

  // Agent actions (13 methods)
  agentCreate(id: string, name: string, metaJson?: string): string;
  agentRemove(name: string): void;
  agentSetActive(name: string, active: boolean): void;
  agentGiveResource(name: string, resource: string, amount: number): void;
  agentTakeResource(name: string, resource: string, amount: number): void;
  agentAddToken(name: string, tokenJson: string): void;
  agentRemoveToken(name: string, tokenId: string): string;
  agentGet(name: string): string;
  agentTransferResource(from: string, to: string, resource: string, amount: number): string;
  agentTransferToken(from: string, to: string, tokenId: string): string;
  agentStealResource(from: string, to: string, resource: string, amount: number): string;
  agentStealToken(from: string, to: string, tokenId: string): string;
  agentGetAll(): string;

  // Token operations (5 methods)
  tokenTransform(tokenJson: string, propertiesJson: string): string;
  tokenAttach(hostJson: string, attachmentJson: string, attachmentType: string): string;
  tokenDetach(hostJson: string, attachmentId: string): string;
  tokenMerge(tokensJson: string, resultPropertiesJson?: string, keepOriginals?: boolean): string;
  tokenSplit(tokenJson: string, count: number, propertiesArrayJson?: string): string;

  // GameState actions (7 methods)
  gameStart(): string;
  gameEnd(winner?: string, reason?: string): string;
  gamePause(): string;
  gameResume(): string;
  gameNextPhase(phase?: string): string;
  gameSetProperty(key: string, valueJson: string): string;
  gameGetState(): string;

  // Batch operations (4 methods)
  batchShuffle(decksJson: string, seedPrefix?: string): string;
  batchDraw(decksJson: string, countsJson: string): string;
  batchFilter(tokensJson: string, predicate: string): string;
  batchMap(tokensJson: string, operation: string): string;
}

export interface HyperTokenWasm {
  Chronicle: typeof WasmChronicle;
  Stack: typeof WasmStack;
  Space: typeof WasmSpace;
  Source: typeof WasmSource;
  Token: typeof WasmToken;
  ActionDispatcher: typeof WasmActionDispatcher;
  version(): string;
  health_check(): boolean;
}

/**
 * WASM module state
 */
let wasmModule: HyperTokenWasm | null = null;
let wasmLoadPromise: Promise<HyperTokenWasm> | null = null;
let wasmLoadError: Error | null = null;

/**
 * Load the WASM module (cached, only loads once)
 *
 * @returns Promise that resolves to the WASM module
 * @throws Error if WASM fails to load
 */
export async function loadWasm(): Promise<HyperTokenWasm> {
  // Return cached module if already loaded
  if (wasmModule) {
    return wasmModule;
  }

  // Return existing load promise if already loading
  if (wasmLoadPromise) {
    return wasmLoadPromise;
  }

  // If previously failed, throw the cached error
  if (wasmLoadError) {
    throw wasmLoadError;
  }

  // Start loading
  wasmLoadPromise = (async () => {
    try {
      // Detect environment and load appropriate WASM package
      const __filename = fileURLToPath(import.meta.url);
      const __dirname = dirname(__filename);

      // Try to load the WASM module from the nodejs build
      const wasmPath = join(__dirname, '..', 'core-rs', 'pkg', 'nodejs', 'hypertoken_core.js');

      const wasmImport = await import(wasmPath);

      // Initialize WASM (wasm-bindgen generates an init function)
      if (wasmImport.default && typeof wasmImport.default === 'function') {
        await wasmImport.default();
      }

      // Cache the module
      wasmModule = wasmImport as HyperTokenWasm;

      console.log(`✅ HyperToken WASM loaded successfully (v${wasmModule.version()})`);

      return wasmModule;
    } catch (error) {
      wasmLoadError = error instanceof Error ? error : new Error(String(error));
      console.warn('⚠️  Failed to load WASM module:', wasmLoadError.message);
      console.warn('    Falling back to TypeScript implementation');
      throw wasmLoadError;
    }
  })();

  return wasmLoadPromise;
}

/**
 * Check if WASM is available (non-throwing)
 *
 * @returns true if WASM loaded successfully
 */
export function isWasmAvailable(): boolean {
  return wasmModule !== null;
}

/**
 * Get WASM module if loaded, otherwise return null
 *
 * @returns WASM module or null
 */
export function getWasmModule(): HyperTokenWasm | null {
  return wasmModule;
}

/**
 * Try to load WASM, but don't throw if it fails
 *
 * @returns Promise that resolves to WASM module or null
 */
export async function tryLoadWasm(): Promise<HyperTokenWasm | null> {
  try {
    return await loadWasm();
  } catch {
    return null;
  }
}

/**
 * Reset WASM module state (mainly for testing)
 */
export function resetWasm(): void {
  wasmModule = null;
  wasmLoadPromise = null;
  wasmLoadError = null;
}
