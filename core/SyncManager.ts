/*
 * core/SyncManager.ts
 * Fixed Event Unwrapping
 */
import * as A from "@automerge/automerge";
import { SessionManager } from "./SessionManager.js";
import { NetworkInterface } from "../interface/NetworkInterface.js";
import { Emitter } from "./events.js";

export class SyncManager extends Emitter {
  session: SessionManager;
  network: NetworkInterface;
  
  private _syncStates: Map<string, A.SyncState> = new Map();

  constructor(session: SessionManager, network: NetworkInterface) {
    super();
    this.session = session;
    this.network = network;

    this.session.on("state:changed", () => {
      this.updatePeers();
    });

    // Note: 'evt.payload' contains the data we emitted
    this.network.on("net:peer:connected", (evt) => {
      const { peerId } = evt.payload; 
      console.log(`[Sync] Connected to peer: ${peerId}`);
      this.addPeer(peerId);
    });

    this.network.on("net:peer:disconnected", (evt) => {
      const { peerId } = evt.payload;
      console.log(`[Sync] Disconnected from peer: ${peerId}`);
      this.removePeer(peerId);
    });

    // FIX: Unwrap 'evt.payload' here!
    this.network.on("net:message", (evt) => {
      this.processMessage(evt.payload);
    });
  }

  addPeer(peerId: string) {
    if (this._syncStates.has(peerId)) return;
    this._syncStates.set(peerId, A.initSyncState());
    this.updatePeer(peerId);
  }

  removePeer(peerId: string) {
    this._syncStates.delete(peerId);
  }

  private updatePeers() {
    for (const peerId of this._syncStates.keys()) {
      this.updatePeer(peerId);
    }
  }

  private updatePeer(peerId: string) {
    const syncState = this._syncStates.get(peerId);
    if (!syncState) return;

    const doc = this.session.state;
    const [nextSyncState, message] = A.generateSyncMessage(doc, syncState);

    this._syncStates.set(peerId, nextSyncState);

    if (message) {
      console.log(`[Sync] Sending ${message.byteLength} bytes to ${peerId}`);
      this.network.sendToPeer(peerId, {
        type: "sync",
        data: this.arrayBufferToBase64(message)
      });
    }
  }

  private processMessage(payload: any) {
    // Now 'payload' is the actual data object, e.g. { type: 'sync', ... }
    if (!payload || payload.type !== "sync") return;
    
    if (!payload.data || !payload.fromPeerId) {
      console.warn("[Sync] Received malformed sync message", payload);
      return;
    }

    const peerId = payload.fromPeerId;
    console.log(`[Sync] Received sync data from ${peerId}`);

    let syncState = this._syncStates.get(peerId);
    if (!syncState) {
      syncState = A.initSyncState();
      this._syncStates.set(peerId, syncState);
    }

    const message = this.base64ToUint8Array(payload.data);

    try {
      const [newDoc, newSyncState] = A.receiveSyncMessage(
        this.session.state,
        syncState,
        message
      );

      this._syncStates.set(peerId, newSyncState);
      this.session.update(newDoc);
      this.updatePeer(peerId);
    } catch (err) {
      console.error("[Sync] Error applying sync message:", err);
    }
  }

  private arrayBufferToBase64(buffer: Uint8Array): string {
    return Buffer.from(buffer).toString("base64");
  }

  private base64ToUint8Array(base64: string): Uint8Array {
    return new Uint8Array(Buffer.from(base64, "base64"));
  }
}