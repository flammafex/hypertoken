/*
 * core/WasmChronicleAdapter.ts
 *
 * Dirty-section caching proxy around the WASM ActionDispatcher.
 * Implements IChronicle so Engine can use it interchangeably with Chronicle.
 *
 * On each `.state` access, only the sections flagged dirty by the Rust side
 * are re-exported (JSON.parse), keeping the hot path fast.
 */
import { Emitter } from './events.js';
import type { IChronicle } from './IChronicle.js';

export class WasmChronicleAdapter extends Emitter implements IChronicle {
    private _wasm: any; // ActionDispatcher from WASM module
    private _cache: Record<string, any> = {};

    constructor(wasmDispatcher: any) {
        super();
        this._wasm = wasmDispatcher;
        // Initial full load
        this._cache = JSON.parse(this._wasm.getState());
        this._wasm.clearDirty();
    }

    get state(): any {
        const dirtyJson = this._wasm.getDirty();
        const dirty = JSON.parse(dirtyJson);

        if (dirty.all) {
            this._cache = JSON.parse(this._wasm.getState());
        } else {
            if (dirty.stack) this._cache.stack = JSON.parse(this._wasm.exportStack());
            if (dirty.zones) this._cache.zones = JSON.parse(this._wasm.exportZones());
            if (dirty.source) this._cache.source = JSON.parse(this._wasm.exportSource());
            if (dirty.gameLoop) this._cache.gameLoop = JSON.parse(this._wasm.exportGameLoop());
            if (dirty.gameState) this._cache.gameState = JSON.parse(this._wasm.exportGameState());
            if (dirty.rules) this._cache.rules = JSON.parse(this._wasm.exportRules());
            if (dirty.agents) this._cache.agents = JSON.parse(this._wasm.exportAgents());
            if (dirty.nullifiers) this._cache.nullifiers = JSON.parse(this._wasm.exportNullifiers());
        }
        this._wasm.clearDirty();
        return this._cache;
    }

    change(message: string, callback: (doc: any) => void, source: string = "local"): void {
        throw new Error(
            "Direct change() not supported with WASM Chronicle. Use engine.dispatch() instead."
        );
    }

    update(newDoc: any, source: string = "local"): void {
        throw new Error(
            "Direct update() not supported with WASM Chronicle. Use engine.dispatch() instead."
        );
    }

    save(): Uint8Array {
        return this._wasm.save();
    }

    saveToBase64(): string {
        return this._wasm.saveToBase64();
    }

    load(data: Uint8Array): void {
        this._wasm.load(data);
        this._cache = {};
        this.emit("state:changed", { doc: this.state, source: "load" });
    }

    loadFromBase64(b64: string): void {
        this._wasm.loadFromBase64(b64);
        this._cache = {};
        this.emit("state:changed", { doc: this.state, source: "load" });
    }

    merge(other: Uint8Array): void {
        this._wasm.merge(other);
        this._cache = {};
        this.emit("state:changed", { doc: this.state, source: "merge" });
    }

    // Sync protocol — not supported with WASM backend.
    // Engine.connect() guards against this by returning early when WASM is active.
    initSyncState(): any {
        throw new Error("Sync protocol not supported with WASM Chronicle backend.");
    }

    generateSyncMessage(syncState: any): { nextSyncState: any; message: Uint8Array | null } {
        throw new Error("Sync protocol not supported with WASM Chronicle backend.");
    }

    receiveSyncMessage(syncState: any, message: Uint8Array, source?: string): { nextSyncState: any } {
        throw new Error("Sync protocol not supported with WASM Chronicle backend.");
    }
}
