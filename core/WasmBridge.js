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
/**
 * WASM module state
 */
let wasmModule = null;
let wasmLoadPromise = null;
let wasmLoadError = null;
/**
 * Load the WASM module (cached, only loads once)
 *
 * @returns Promise that resolves to the WASM module
 * @throws Error if WASM fails to load
 */
export async function loadWasm() {
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
            wasmModule = wasmImport;
            console.log(`✅ HyperToken WASM loaded successfully (v${wasmModule.version()})`);
            return wasmModule;
        }
        catch (error) {
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
export function isWasmAvailable() {
    return wasmModule !== null;
}
/**
 * Get WASM module if loaded, otherwise return null
 *
 * @returns WASM module or null
 */
export function getWasmModule() {
    return wasmModule;
}
/**
 * Try to load WASM, but don't throw if it fails
 *
 * @returns Promise that resolves to WASM module or null
 */
export async function tryLoadWasm() {
    try {
        return await loadWasm();
    }
    catch {
        return null;
    }
}
/**
 * Reset WASM module state (mainly for testing)
 */
export function resetWasm() {
    wasmModule = null;
    wasmLoadPromise = null;
    wasmLoadError = null;
}
