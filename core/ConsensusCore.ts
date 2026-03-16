/*
 * core/ConsensusCore.ts
 * Fixed Event Unwrapping & Echo Loop
 *
 * Now supports both PeerConnection and HybridPeerManager for WebRTC!
 * Uses IChronicle interface — sync protocol is delegated to the session.
 */
import type { IChronicle } from "./IChronicle.js";
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
  session: IChronicle;
  network: INetworkConnection;

  private _syncStates: Map<string, any> = new Map();

  constructor(session: IChronicle, network: INetworkConnection) {
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
    this._syncStates.set(peerId, this.session.initSyncState());
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

    const { nextSyncState, message } = this.session.generateSyncMessage(syncState);

    this._syncStates.set(peerId, nextSyncState);

    if (message) {
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

    let syncState = this._syncStates.get(peerId);
    if (!syncState) {
      syncState = this.session.initSyncState();
      this._syncStates.set(peerId, syncState);
    }

    const message = this.base64ToUint8Array(payload.data);

    try {
      // Delegate sync to session — it applies the message internally and emits state:changed
      const { nextSyncState } = this.session.receiveSyncMessage(syncState, message, peerId);

      this._syncStates.set(peerId, nextSyncState);

      // Reply to sender to acknowledge/converge
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
