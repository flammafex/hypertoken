/*
 * core/IChronicle.ts
 *
 * Abstraction over Chronicle (Automerge) and WasmChronicleAdapter (dirty-section caching).
 * Allows Engine to work with either backend transparently.
 */

export interface IChronicle {
    readonly state: any; // HyperTokenState
    save(): Uint8Array;
    saveToBase64(): string;
    load(data: Uint8Array): void;
    loadFromBase64(b64: string): void;
    merge(other: Uint8Array): void;
    change(message: string, callback: (doc: any) => void, source?: string): void;
    generateSyncMessage?(state?: Uint8Array): string;
    receiveSyncMessage?(msg: Uint8Array, state?: Uint8Array): string;
    // Emitter methods
    on(type: string, fn: Function): any;
    off(type: string, fn: Function): any;
    emit(type: string, payload?: any): boolean;
}
