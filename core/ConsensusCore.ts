/*
 * core/ConsensusCore.ts
 * Fixed Event Unwrapping & Echo Loop
 *
 * Now supports both PeerConnection and HybridPeerManager for WebRTC!
 */
import * as A from "@automerge/automerge";
import { Chronicle } from "./Chronicle.js";
import { PeerConnection } from "../network/PeerConnection.js";
import { Emitter } from "./events.js";
import { Buffer } from "node:buffer";

// Type for network connections that can be used with ConsensusCore
// Both PeerConnection and HybridPeerManager satisfy this interface
export interface INetworkConnection extends Emitter {
  sendToPeer(targetPeerId: string, payload: any): void;
  connect(): void;
  disconnect(): void;
  getPeerId?(): string | null; // Optional: for getting local peer ID
}

export class ConsensusCore extends Emitter {
  session: Chronicle;
  network: INetworkConnection;

  private _syncStates: Map<string, A.SyncState> = new Map();

  constructor(session: Chronicle, network: INetworkConnection) {
    super();
    this.session = session;
    this.network = network;

    // FIX: Check the source of the change to avoid echoing back to sender
    this.session.on("state:changed", (evt) => {
      const source = evt.source || "local";
      this.updatePeers(source);
    });

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

  // FIX: Don't send updates back to the peer that generated them
  private updatePeers(excludePeerId: string = "local") {
    for (const peerId of this._syncStates.keys()) {
      if (peerId !== excludePeerId) {
        this.updatePeer(peerId);
      }
    }
  }

  private updatePeer(peerId: string) {
    const syncState = this._syncStates.get(peerId);
    if (!syncState) return;

    const doc = this.session.state;
    const [nextSyncState, message] = A.generateSyncMessage(doc, syncState);

    this._syncStates.set(peerId, nextSyncState);

    if (message) {
      // console.log(`[Sync] Sending ${message.byteLength} bytes to ${peerId}`);
      this.network.sendToPeer(peerId, {
        type: "sync",
        data: this.arrayBufferToBase64(message)
      });
    }
  }

  private processMessage(payload: any) {
    if (!payload || payload.type !== "sync") return;
    
    if (!payload.data || !payload.fromPeerId) {
      console.warn("[Sync] Received malformed sync message", payload);
      return;
    }

    const peerId = payload.fromPeerId;
    // console.log(`[Sync] Received sync data from ${peerId}`);

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
      
      // FIX: Mark this update as coming from 'peerId' so we don't echo it back in the listener
      this.session.update(newDoc, peerId);
      
      // We DO want to reply to the sender specifically to acknowledge/converge, 
      // just not via the generic broadcast listener loop.
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