/*
 * core/Chronicle.ts
 */
import * as A from "@automerge/automerge";
import { Emitter } from "./events.js";
import { HyperTokenState } from "./types.js";
import { Buffer } from "node:buffer";

export class Chronicle extends Emitter {
  private _doc: A.Doc<HyperTokenState>;

  constructor(initialState?: HyperTokenState) {
    super();
    // Initialize with empty state to allow clean merging
    this._doc = initialState ? A.from<HyperTokenState>(initialState) : A.init<HyperTokenState>();
  }

  get state(): A.Doc<HyperTokenState> {
    return this._doc;
  }

  // Modified to accept an optional source
  change(message: string, callback: (doc: HyperTokenState) => void, source: string = "local"): void {
    const newDoc = A.change(this._doc, message, callback);
    this._doc = newDoc;
    this.emit("state:changed", { doc: newDoc, source });
  }

  // Modified to accept an optional source
  update(newDoc: A.Doc<HyperTokenState>, source: string = "local"): void {
    this._doc = newDoc;
    this.emit("state:changed", { doc: this._doc, source });
  }

  // ... (merge, save, load methods remain the same)
  merge(remoteDoc: A.Doc<HyperTokenState>): void {
    this._doc = A.merge(this._doc, remoteDoc);
    this.emit("state:changed", { doc: this._doc, source: "merge" });
  }

  save(): Uint8Array {
    return A.save(this._doc);
  }

  load(binary: Uint8Array): void {
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