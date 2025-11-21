/*
 * core/SessionManager.ts
 */
import * as A from "@automerge/automerge";
import { Emitter } from "./events.js";
import { HyperTokenState } from "./types.js";

export class SessionManager extends Emitter {
  private _doc: A.Doc<HyperTokenState>;

  constructor(initialState?: HyperTokenState) {
    super();
    // Initialize with empty state to allow clean merging
    this._doc = initialState ? A.from<HyperTokenState>(initialState) : A.init<HyperTokenState>();
  }

  get state(): A.Doc<HyperTokenState> {
    return this._doc;
  }

  change(message: string, callback: (doc: HyperTokenState) => void): void {
    const newDoc = A.change(this._doc, message, callback);
    this._doc = newDoc;
    this.emit("state:changed", { doc: newDoc });
  }

  update(newDoc: A.Doc<HyperTokenState>): void {
    this._doc = newDoc;
    this.emit("state:changed", { doc: this._doc });
  }

  // ... (merge, save, load methods remain the same)
  merge(remoteDoc: A.Doc<HyperTokenState>): void {
    this._doc = A.merge(this._doc, remoteDoc);
    this.emit("state:changed", { doc: this._doc });
  }

  save(): Uint8Array {
    return A.save(this._doc);
  }

  load(binary: Uint8Array): void {
    this._doc = A.load(binary);
    this.emit("state:changed", { doc: this._doc });
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