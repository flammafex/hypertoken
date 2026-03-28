/*
 * core/IChronicle.ts
 *
 * Abstraction over Chronicle (Automerge) and WasmChronicleAdapter (dirty-section caching).
 * Allows Engine and ConsensusCore to work with either backend transparently.
 */

import type { HyperTokenState } from "./types.js";

export interface IChronicle<T = HyperTokenState> {
    readonly state: T;
    save(): Uint8Array;
    saveToBase64(): string;
    load(data: Uint8Array): void;
    loadFromBase64(b64: string): void;
    merge(other: any): void;
    change(message: string, callback: (doc: T) => void, source?: string): void;
    update(newDoc: any, source?: string): void;
    // Sync protocol (used by ConsensusCore)
    initSyncState(): any;
    generateSyncMessage(syncState: any): { nextSyncState: any; message: Uint8Array | null };
    receiveSyncMessage(syncState: any, message: Uint8Array, source?: string): { nextSyncState: any };
    // Emitter methods
    on(type: string, fn: Function): any;
    off(type: string, fn: Function): any;
    emit(type: string, payload?: any): boolean;
}
