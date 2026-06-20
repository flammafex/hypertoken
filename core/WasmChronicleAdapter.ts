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
import type { HyperTokenState } from './types.js';

// Base64 helpers that work in both Node.js and browser
function base64ToUint8Array(base64: string): Uint8Array {
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
        bytes[i] = binary.charCodeAt(i);
    }
    return bytes;
}

function uint8ArrayToBase64(bytes: Uint8Array): string {
    let binary = '';
    for (let i = 0; i < bytes.length; i++) {
        binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary);
}

export class WasmChronicleAdapter extends Emitter implements IChronicle<HyperTokenState> {
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

    // Sync protocol — delegates to WASM Chronicle backend.
    // The Rust side already implements automerge sync (sync::SyncDoc).
    // The WASM API uses Option<Vec<u8>> for sync state (None = create new)
    // and returns JSON strings with base64-encoded data.
    // We bridge this to the IChronicle interface that ConsensusCore expects.

    initSyncState(): any {
        // Return null — the WASM API uses Option<Vec<u8>>, where None means
        // "create new sync state" on the first generateSyncMessage call.
        return null;
    }

    generateSyncMessage(syncState: any): { nextSyncState: any; message: Uint8Array | null } {
        // syncState is null (first call) or a base64 string from a previous call
        let syncStateBytes: Uint8Array | undefined;
        if (syncState) {
            syncStateBytes = base64ToUint8Array(syncState);
        }

        // Call WASM — returns JSON: { message: base64|null, syncState: base64, hasMessage: boolean }
        const resultJson = this._wasm.generateSyncMessage(syncStateBytes);
        const result = JSON.parse(resultJson);

        return {
            nextSyncState: result.syncState,  // base64 string — passed back on next call
            message: result.message ? base64ToUint8Array(result.message) : null,
        };
    }

    receiveSyncMessage(syncState: any, message: Uint8Array, source?: string): { nextSyncState: any } {
        // Decode sync state (base64 string → Uint8Array) if present
        let syncStateBytes: Uint8Array | undefined;
        if (syncState) {
            syncStateBytes = base64ToUint8Array(syncState);
        }

        // Encode message (Uint8Array → base64) for the WASM API
        const messageBase64 = uint8ArrayToBase64(message);

        // Call WASM — returns JSON: { responseMessage: base64|null, syncState: base64, hasResponse: boolean }
        const resultJson = this._wasm.receiveSyncMessage(messageBase64, syncStateBytes);
        const result = JSON.parse(resultJson);

        // Clear cache — the WASM document has changed
        this._cache = {};

        // Emit state:changed so ConsensusCore updates other peers
        this.emit("state:changed", { doc: this.state, source: source || "sync" });

        return {
            nextSyncState: result.syncState,  // base64 string
        };
    }
}
