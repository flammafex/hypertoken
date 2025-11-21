/*
 * interface/RelayServer.ts
 * With Packet Tracing
 */
import { Emitter } from "../core/events.js";
import { Engine } from "../engine/Engine.js";
import { WebSocketServer, WebSocket } from "ws";

export class RelayServer extends Emitter {
  engine: Engine | null;
  port: number;
  verbose: boolean;
  clients: Map<WebSocket, string>; 
  wss: WebSocketServer | null = null;

  constructor(engine: Engine | null = null, { port = 8080, verbose = false } = {}) {
    super();
    this.engine = engine;
    this.port = port;
    this.verbose = verbose;
    this.clients = new Map();
  }

  start(): Promise<void> {
    return new Promise((resolve) => {
      this.wss = new WebSocketServer({ port: this.port });
      console.log(`🌐 RelayServer running on ws://localhost:${this.port}`);

      this.wss.on("listening", () => resolve());

      this.wss.on("connection", (ws: WebSocket) => {
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

        ws.on("message", (data: any) => this._handle(ws, peerId, data));
        
        ws.on("close", () => {
          this.clients.delete(ws);
          this._broadcast({ type: "peer:left", peerId });
          console.log(`[Server] Client disconnected: ${peerId}`);
        });
      });
    });
  }

  stop(): void {
    if (this.wss) this.wss.close();
    this.clients.clear();
  }

  private _send(ws: WebSocket, msg: any): void {
    if (ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify(msg));
  }

  private _broadcast(msg: any, excludeWs?: WebSocket): void {
    const str = JSON.stringify(msg);
    for (const [client] of this.clients) {
      if (client !== excludeWs && client.readyState === WebSocket.OPEN) {
        client.send(str);
      }
    }
  }

  private _handle(ws: WebSocket, fromPeerId: string, rawData: any): void {
    try {
      const msg = JSON.parse(rawData.toString());

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
      } else {
        this._broadcast({ ...msg, fromPeerId }, ws);
      }

    } catch (err) {
      console.error("Relay handling error:", err);
    }
  }
}