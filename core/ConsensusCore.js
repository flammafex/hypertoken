/*
 * core/ConsensusCore.ts
 * Fixed Event Unwrapping & Echo Loop
 *
 * Now supports both PeerConnection and HybridPeerManager for WebRTC!
 */
import * as A from "@automerge/automerge";
import { Emitter } from "./events.js";
import { Buffer } from "node:buffer";
export class ConsensusCore extends Emitter {
    session;
    network;
    _syncStates = new Map();
    constructor(session, network) {
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
    addPeer(peerId) {
        if (this._syncStates.has(peerId))
            return;
        this._syncStates.set(peerId, A.initSyncState());
        this.updatePeer(peerId);
    }
    removePeer(peerId) {
        this._syncStates.delete(peerId);
    }
    // FIX: Don't send updates back to the peer that generated them
    updatePeers(excludePeerId = "local") {
        for (const peerId of this._syncStates.keys()) {
            if (peerId !== excludePeerId) {
                this.updatePeer(peerId);
            }
        }
    }
    updatePeer(peerId) {
        const syncState = this._syncStates.get(peerId);
        if (!syncState)
            return;
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
    processMessage(payload) {
        if (!payload || payload.type !== "sync")
            return;
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
            const [newDoc, newSyncState] = A.receiveSyncMessage(this.session.state, syncState, message);
            this._syncStates.set(peerId, newSyncState);
            // FIX: Mark this update as coming from 'peerId' so we don't echo it back in the listener
            this.session.update(newDoc, peerId);
            // We DO want to reply to the sender specifically to acknowledge/converge, 
            // just not via the generic broadcast listener loop.
            this.updatePeer(peerId);
        }
        catch (err) {
            console.error("[Sync] Error applying sync message:", err);
        }
    }
    arrayBufferToBase64(buffer) {
        return Buffer.from(buffer).toString("base64");
    }
    base64ToUint8Array(base64) {
        return new Uint8Array(Buffer.from(base64, "base64"));
    }
}
