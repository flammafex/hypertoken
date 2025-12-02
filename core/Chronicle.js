/*
 * core/Chronicle.ts
 */
import * as A from "@automerge/automerge";
import { Emitter } from "./events.js";
import { Buffer } from "node:buffer";
export class Chronicle extends Emitter {
    _doc;
    constructor(initialState) {
        super();
        // Initialize with empty state to allow clean merging
        this._doc = initialState ? A.from(initialState) : A.init();
    }
    get state() {
        return this._doc;
    }
    // Modified to accept an optional source
    change(message, callback, source = "local") {
        const newDoc = A.change(this._doc, message, callback);
        this._doc = newDoc;
        this.emit("state:changed", { doc: newDoc, source });
    }
    // Modified to accept an optional source
    update(newDoc, source = "local") {
        this._doc = newDoc;
        this.emit("state:changed", { doc: this._doc, source });
    }
    // ... (merge, save, load methods remain the same)
    merge(remoteDoc) {
        this._doc = A.merge(this._doc, remoteDoc);
        this.emit("state:changed", { doc: this._doc, source: "merge" });
    }
    save() {
        return A.save(this._doc);
    }
    load(binary) {
        this._doc = A.load(binary);
        this.emit("state:changed", { doc: this._doc, source: "load" });
    }
    saveToBase64() {
        const bytes = this.save();
        return Buffer.from(bytes).toString('base64');
    }
    loadFromBase64(base64) {
        const bytes = new Uint8Array(Buffer.from(base64, 'base64'));
        this.load(bytes);
    }
}
