/*
 * network/RelayServer.ts
 * WebSocket relay server for P2P engine synchronization
 * With Packet Tracing
 */
import { Emitter } from "../core/events.js";
import { WebSocketServer, WebSocket } from "ws";
export class RelayServer extends Emitter {
    engine;
    port;
    verbose;
    clients;
    wss = null;
    constructor(engine = null, { port = 8080, verbose = false } = {}) {
        super();
        this.engine = engine;
        this.port = port;
        this.verbose = verbose;
        this.clients = new Map();
    }
    start() {
        return new Promise((resolve) => {
            this.wss = new WebSocketServer({ port: this.port });
            console.log(`🌐 RelayServer running on ws://localhost:${this.port}`);
            this.wss.on("listening", () => resolve());
            this.wss.on("connection", (ws) => {
                const peerId = `peer-${Math.random().toString(36).substring(2, 9)}`;
                this.clients.set(ws, peerId);
                console.log(`[Server] Client connected: ${peerId}`);
                this._send(ws, { type: "welcome", peerId });
                this._broadcast({ type: "peer:joined", peerId }, ws);
                for (const existingId of this.clients.values()) {
                    if (existingId !== peerId) {
                        this._send(ws, { type: "peer:joined", peerId: existingId });
                    }
                }
                ws.on("message", (data) => this._handle(ws, peerId, data));
                ws.on("close", () => {
                    this.clients.delete(ws);
                    this._broadcast({ type: "peer:left", peerId });
                    console.log(`[Server] Client disconnected: ${peerId}`);
                });
            });
        });
    }
    stop() {
        if (this.wss)
            this.wss.close();
        this.clients.clear();
    }
    _send(ws, msg) {
        if (ws.readyState === WebSocket.OPEN)
            ws.send(JSON.stringify(msg));
    }
    _broadcast(msg, excludeWs) {
        const str = JSON.stringify(msg);
        for (const [client] of this.clients) {
            if (client !== excludeWs && client.readyState === WebSocket.OPEN) {
                client.send(str);
            }
        }
    }
    _handle(ws, fromPeerId, rawData) {
        try {
            const msg = JSON.parse(rawData.toString());
            // Handle WebRTC signaling messages (always have targetPeerId in payload)
            if (this._isWebRTCSignaling(msg)) {
                this._routeWebRTCSignaling(ws, fromPeerId, msg);
                return;
            }
            if (msg.targetPeerId) {
                const target = msg.targetPeerId;
                const type = msg.payload?.type || "unknown";
                // console.log(`[Server] Routing ${type} from ${fromPeerId} -> ${target}`);
                for (const [client, id] of this.clients) {
                    if (id === target) {
                        this._send(client, { ...msg, fromPeerId });
                        return;
                    }
                }
                console.warn(`[Server] Target peer ${target} not found!`);
            }
            else {
                this._broadcast({ ...msg, fromPeerId }, ws);
            }
        }
        catch (err) {
            console.error("Relay handling error:", err);
        }
    }
    _isWebRTCSignaling(msg) {
        return msg.payload && [
            'webrtc-offer',
            'webrtc-answer',
            'webrtc-ice-candidate'
        ].includes(msg.payload.type);
    }
    _routeWebRTCSignaling(ws, fromPeerId, msg) {
        const targetPeerId = msg.targetPeerId;
        const signalType = msg.payload.type;
        if (!targetPeerId) {
            console.warn(`[Server] WebRTC signaling missing targetPeerId:`, msg);
            return;
        }
        if (this.verbose) {
            console.log(`[Server] Routing WebRTC ${signalType} from ${fromPeerId} -> ${targetPeerId}`);
        }
        for (const [client, id] of this.clients) {
            if (id === targetPeerId) {
                this._send(client, { ...msg, fromPeerId });
                return;
            }
        }
        console.warn(`[Server] WebRTC signaling target peer ${targetPeerId} not found!`);
    }
}
