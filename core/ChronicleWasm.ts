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
 * ChronicleWasm: WASM-accelerated Chronicle implementation
 *
 * NOTE: This is a hybrid implementation. The Rust Chronicle currently
 * provides basic CRDT operations (save/load/merge) but doesn't yet
 * fully implement the HyperTokenState structure.
 *
 * For now, we use TypeScript Automerge for state management and
 * can add WASM acceleration for specific operations later.
 *
 * The real performance wins are in Stack and Space operations,
 * which are fully implemented in Rust/WASM.
 */

import * as A from "@automerge/automerge";
import { Emitter } from "./events.js";
import { HyperTokenState } from "./types.js";
import { Buffer } from "node:buffer";
import { tryLoadWasm, isWasmAvailable } from "./WasmBridge.js";

/**
 * Chronicle with optional WASM acceleration
 *
 * Currently uses TypeScript Automerge for compatibility.
 * WASM acceleration can be enabled for specific operations
 * once the Rust Chronicle fully implements HyperTokenState.
 */
export class ChronicleWasm extends Emitter {
  private _doc: A.Doc<HyperTokenState>;
  private _useWasm: boolean = false;

  constructor(initialState?: HyperTokenState) {
    super();
    this._doc = initialState ? A.from<HyperTokenState>(initialState) : A.init<HyperTokenState>();

    // Try to enable WASM (non-blocking)
    this._tryEnableWasm();
  }

  private async _tryEnableWasm(): Promise<void> {
    const wasm = await tryLoadWasm();
    if (wasm && wasm.health_check()) {
      this._useWasm = true;
      // Future: Initialize WASM Chronicle here
    }
  }

  get state(): A.Doc<HyperTokenState> {
    return this._doc;
  }

  get isWasmEnabled(): boolean {
    return this._useWasm && isWasmAvailable();
  }

  change(message: string, callback: (doc: HyperTokenState) => void, source: string = "local"): void {
    // Use TypeScript Automerge (WASM Chronicle doesn't support callbacks yet)
    const newDoc = A.change(this._doc, message, callback);
    this._doc = newDoc;
    this.emit("state:changed", { doc: newDoc, source });
  }

  update(newDoc: A.Doc<HyperTokenState>, source: string = "local"): void {
    this._doc = newDoc;
    this.emit("state:changed", { doc: this._doc, source });
  }

  merge(remoteDoc: A.Doc<HyperTokenState>): void {
    // TODO: Use WASM Chronicle for faster merging once it supports HyperTokenState
    // For now, use TypeScript Automerge
    this._doc = A.merge(this._doc, remoteDoc);
    this.emit("state:changed", { doc: this._doc, source: "merge" });
  }

  save(): Uint8Array {
    // TODO: Use WASM Chronicle for faster serialization
    return A.save(this._doc);
  }

  load(binary: Uint8Array): void {
    // TODO: Use WASM Chronicle for faster deserialization
    this._doc = A.load(binary);
    this.emit("state:changed", { doc: this._doc, source: "load" });
  }

  saveToBase64(): string {
    const bytes = this.save();
    return Buffer.from(bytes).toString('base64');
  }

  loadFromBase64(base64: string): void {
    const bytes = new Uint8Array(Buffer.from(base64, 'base64'));
    this.load(bytes);
  }
}

// Export as default Chronicle replacement
export { ChronicleWasm as Chronicle };
