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

/*
 * core/IChronicle.ts
 *
 * Abstraction over Chronicle (Automerge). Allows Engine and ConsensusCore to
 * work with the backend transparently.
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
    /** Compact the document by discarding history. Creates a fresh document from current state. */
    newEpoch(): void;
    /** Create a divergent branch with a new actor ID. Changes can be merged back via merge(). */
    fork(): IChronicle;
    // Sync protocol (used by ConsensusCore)
    initSyncState(): any;
    generateSyncMessage(syncState: any): { nextSyncState: any; message: Uint8Array | null };
    receiveSyncMessage(syncState: any, message: Uint8Array, source?: string): { nextSyncState: any };
    // Emitter methods
    on(type: string, fn: Function): any;
    off(type: string, fn: Function): any;
    emit(type: string, payload?: any): boolean;
}
