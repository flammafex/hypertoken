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
 * ChronicleWasm: Fully Rust-backed Chronicle implementation
 *
 * This implementation uses Rust automerge-rs as the CRDT backend,
 * providing performance improvements for merge/save/load operations.
 *
 * The Rust Chronicle now stores HyperTokenState fields as native Automerge
 * types (maps, lists, scalars) for proper field-level CRDT conflict resolution.
 *
 * CRDT History Preservation:
 * - Binary format is used for all sync operations to preserve history
 * - The TypeScript Automerge doc is synced via binary load, not JSON reconstruction
 * - This ensures merge conflicts are properly resolved at the field level
 */

import * as A from "@automerge/automerge";
import { Emitter } from "./events.js";
import { HyperTokenState } from "./types.js";
import { Buffer } from "node:buffer";
import { tryLoadWasm, isWasmAvailable, getWasmModule, type WasmChronicle } from "./WasmBridge.js";

/**
 * Chronicle with Rust/WASM backend
 *
 * Maintains the same API as Chronicle.ts but uses automerge-rs internally.
 * Falls back to TypeScript Automerge if WASM is unavailable.
 *
 * Key design principle: WASM Chronicle is the source of truth when enabled.
 * TypeScript doc is synced via binary to preserve CRDT history.
 */
export class ChronicleWasm extends Emitter {
  private _doc: A.Doc<HyperTokenState>;
  private _wasmChronicle: WasmChronicle | null = null;
  private _useWasm: boolean = false;

  constructor(initialState?: HyperTokenState) {
    super();

    // Initialize TypeScript doc (fallback or initial state)
    this._doc = initialState ? A.from<HyperTokenState>(initialState) : A.init<HyperTokenState>();

    // Initialize WASM Chronicle
    this._initializeWasm(initialState);
  }

  private _initializeWasm(initialState?: HyperTokenState): void {
    if (!isWasmAvailable()) {
      console.warn("⚠️  WASM not available, Chronicle using TypeScript Automerge fallback");
      return;
    }

    try {
      const wasm = getWasmModule();
      if (!wasm) {
        console.warn("⚠️  WASM module not loaded, Chronicle using TypeScript fallback");
        return;
      }

      // Create Rust Chronicle
      this._wasmChronicle = new wasm.Chronicle();

      // Initialize with state if provided
      if (initialState) {
        this._wasmChronicle.setState(JSON.stringify(initialState));
      } else {
        // Initialize with empty state
        const emptyState: HyperTokenState = {};
        this._wasmChronicle.setState(JSON.stringify(emptyState));
      }

      this._useWasm = true;
    } catch (error) {
      console.error("❌ Failed to initialize WASM Chronicle:", error);
      console.warn("⚠️  Falling back to TypeScript Automerge");
      this._wasmChronicle = null;
      this._useWasm = false;
    }
  }

  /**
   * Get the current state as an Automerge document.
   *
   * When WASM is enabled, this syncs the TypeScript doc from the WASM binary
   * to preserve CRDT history. This is essential for proper merge behavior.
   */
  get state(): A.Doc<HyperTokenState> {
    if (this._useWasm && this._wasmChronicle) {
      try {
        // Get the binary from WASM and load it to preserve CRDT history
        const binary = this._wasmChronicle.save();
        this._doc = A.load<HyperTokenState>(new Uint8Array(binary));
      } catch (error) {
        console.error("❌ Failed to sync state from WASM Chronicle:", error);
        // Fall back to getting JSON state if binary sync fails
        try {
          const stateJson = this._wasmChronicle.getState();
          const state = JSON.parse(stateJson) as HyperTokenState;
          // Note: This loses history, but it's better than throwing
          this._doc = A.from<HyperTokenState>(state);
        } catch (innerError) {
          console.error("❌ Failed to get state from WASM Chronicle:", innerError);
        }
      }
    }

    return this._doc;
  }

  get isWasmEnabled(): boolean {
    return this._useWasm && this._wasmChronicle !== null;
  }

  /**
   * Apply a change to the document with a descriptive message.
   *
   * The callback receives the current state and can modify it.
   * Changes are tracked in the CRDT history.
   */
  change(message: string, callback: (doc: HyperTokenState) => void, source: string = "local"): void {
    if (this._useWasm && this._wasmChronicle) {
      try {
        // Get current state from WASM
        const currentStateJson = this._wasmChronicle.getState();
        const currentState = JSON.parse(currentStateJson) as HyperTokenState;

        // Apply callback to get new state (deep clone to avoid mutation issues)
        const newState = JSON.parse(JSON.stringify(currentState)) as HyperTokenState;
        callback(newState);

        // Store new state in WASM (this creates a proper CRDT change)
        this._wasmChronicle.change(message, JSON.stringify(newState));

        // Sync TypeScript doc from WASM binary to preserve CRDT history
        const binary = this._wasmChronicle.save();
        this._doc = A.load<HyperTokenState>(new Uint8Array(binary));

        this.emit("state:changed", { doc: this._doc, source });
      } catch (error) {
        console.error("❌ WASM Chronicle change failed, falling back to TypeScript:", error);
        // Fallback to TypeScript
        const newDoc = A.change(this._doc, message, callback);
        this._doc = newDoc;
        this.emit("state:changed", { doc: newDoc, source });
      }
    } else {
      // Use TypeScript Automerge
      const newDoc = A.change(this._doc, message, callback);
      this._doc = newDoc;
      this.emit("state:changed", { doc: newDoc, source });
    }
  }

  /**
   * Update the document directly with a new Automerge doc.
   *
   * This syncs the new document to WASM if enabled.
   */
  update(newDoc: A.Doc<HyperTokenState>, source: string = "local"): void {
    this._doc = newDoc;

    // Sync to WASM if enabled - use binary to preserve CRDT history
    if (this._useWasm && this._wasmChronicle) {
      try {
        // Save TypeScript doc to binary and load into WASM
        const binary = A.save(newDoc);
        this._wasmChronicle.load(binary);
      } catch (error) {
        console.error("❌ Failed to sync state to WASM Chronicle:", error);
      }
    }

    this.emit("state:changed", { doc: this._doc, source });
  }

  /**
   * Merge a remote document into this one.
   *
   * Uses CRDT merge semantics - concurrent changes to different fields
   * are preserved without conflict.
   */
  merge(remoteDoc: A.Doc<HyperTokenState>): void {
    if (this._useWasm && this._wasmChronicle) {
      try {
        // Save remote doc to binary (preserves CRDT history)
        const remoteBinary = A.save(remoteDoc);

        // Merge in WASM
        this._wasmChronicle.merge(remoteBinary);

        // Sync TypeScript doc from WASM binary to get merged result with history
        const mergedBinary = this._wasmChronicle.save();
        this._doc = A.load<HyperTokenState>(new Uint8Array(mergedBinary));

        this.emit("state:changed", { doc: this._doc, source: "merge" });
      } catch (error) {
        console.error("❌ WASM Chronicle merge failed, falling back to TypeScript:", error);
        // Fallback to TypeScript merge
        this._doc = A.merge(this._doc, remoteDoc);
        this.emit("state:changed", { doc: this._doc, source: "merge" });
      }
    } else {
      // Use TypeScript Automerge
      this._doc = A.merge(this._doc, remoteDoc);
      this.emit("state:changed", { doc: this._doc, source: "merge" });
    }
  }

  /**
   * Save the document to a binary format.
   *
   * The binary includes full CRDT history for proper merging.
   */
  save(): Uint8Array {
    if (this._useWasm && this._wasmChronicle) {
      try {
        // Use WASM for faster serialization
        const binary = this._wasmChronicle.save();
        return new Uint8Array(binary);
      } catch (error) {
        console.error("❌ WASM Chronicle save failed, falling back to TypeScript:", error);
        return A.save(this._doc);
      }
    }

    return A.save(this._doc);
  }

  /**
   * Load a document from binary format.
   *
   * This replaces the current document with the loaded one,
   * including its full CRDT history.
   */
  load(binary: Uint8Array): void {
    if (this._useWasm && this._wasmChronicle) {
      try {
        // Load binary into WASM
        this._wasmChronicle.load(binary);

        // Sync TypeScript doc from WASM binary (preserves CRDT history)
        const savedBinary = this._wasmChronicle.save();
        this._doc = A.load<HyperTokenState>(new Uint8Array(savedBinary));

        this.emit("state:changed", { doc: this._doc, source: "load" });
      } catch (error) {
        console.error("❌ WASM Chronicle load failed, falling back to TypeScript:", error);
        this._doc = A.load(binary);
        this.emit("state:changed", { doc: this._doc, source: "load" });
      }
    } else {
      this._doc = A.load(binary);
      this.emit("state:changed", { doc: this._doc, source: "load" });
    }
  }

  /**
   * Save the document to a Base64 string.
   *
   * Useful for transport over text-based protocols.
   */
  saveToBase64(): string {
    if (this._useWasm && this._wasmChronicle) {
      try {
        // Use WASM base64 encoding
        return this._wasmChronicle.saveToBase64();
      } catch (error) {
        console.error("❌ WASM Chronicle saveToBase64 failed, falling back to TypeScript:", error);
        const bytes = this.save();
        return Buffer.from(bytes).toString('base64');
      }
    }

    const bytes = this.save();
    return Buffer.from(bytes).toString('base64');
  }

  /**
   * Load a document from a Base64 string.
   */
  loadFromBase64(base64: string): void {
    if (this._useWasm && this._wasmChronicle) {
      try {
        // Use WASM base64 decoding
        this._wasmChronicle.loadFromBase64(base64);

        // Sync TypeScript doc from WASM binary (preserves CRDT history)
        const binary = this._wasmChronicle.save();
        this._doc = A.load<HyperTokenState>(new Uint8Array(binary));

        this.emit("state:changed", { doc: this._doc, source: "load" });
      } catch (error) {
        console.error("❌ WASM Chronicle loadFromBase64 failed, falling back to TypeScript:", error);
        const bytes = new Uint8Array(Buffer.from(base64, 'base64'));
        this.load(bytes);
      }
    } else {
      const bytes = new Uint8Array(Buffer.from(base64, 'base64'));
      this.load(bytes);
    }
  }
}

// Export as default Chronicle replacement
export { ChronicleWasm as Chronicle };
