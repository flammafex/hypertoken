/*
 * interface/NetworkInterface.ts
 * Robust handling for both Node (ws) and Browser (WebSocket) environments.
 */
import { Emitter } from "../core/events.js";
import { Engine } from "../engine/Engine.js";
import WebSocket from "ws";

// Message Types
export interface NetworkMessage {
  type: string;
  payload?: any;
  targetPeerId?: string;
  fromPeerId?: string;
}

export class NetworkInterface extends Emitter {
  url: string;
  engine: Engine | null;
  socket: WebSocket | null;
  connected: boolean;
  
  peerId: string | null = null;
  peers: Set<string> = new Set();

  constructor(url: string, engine: Engine | null = null) {
    super();
    this.url = url;
    this.engine = engine;
    this.socket = null;
    this.connected = false;
  }

  connect(): void {
    // Use 'ws' in Node, native WebSocket in browser
    const WS = typeof WebSocket !== 'undefined' ? WebSocket : (global as any).WebSocket;
    this.socket = new WS(this.url);

    if (!this.socket) return;

    // Use standard 'on' pattern if available (Node/ws), fall back to addEventListener (Browser)
    if (typeof this.socket.on === 'function') {
      this.socket.on('open', () => this._onOpen());
      this.socket.on('message', (data: any) => this._handleMessageData(data));
      this.socket.on('close', () => this._onClose());
      this.socket.on('error', (err: any) => this._onError(err));
    } else {
      this.socket.addEventListener("open", () => this._onOpen());
      this.socket.addEventListener("message", (ev: any) => this._handleMessageEvent(ev));
      this.socket.addEventListener("close", () => this._onClose());
      this.socket.addEventListener("error", (err: any) => this._onError(err));
    }
  }

  disconnect(): void {
    if (this.socket) this.socket.close();
  }

  sendToPeer(targetPeerId: string, payload: any): void {
    this._send({ type: "p2p", targetPeerId, payload });
  }

  broadcast(type: string, payload: any = {}): void {
    this._send({ type, payload });
  }

  private _send(msg: Partial<NetworkMessage>): void {
    if (!this.socket || this.socket.readyState !== 1) return;
    this.socket.send(JSON.stringify(msg));
  }

  // --- Event Handlers ---

  private _onOpen() {
    this.connected = true;
    this.emit("net:connected");
  }

  private _onClose() {
    this.connected = false;
    this.peers.clear();
    this.emit("net:disconnected");
  }

  private _onError(err: any) {
    this.emit("net:error", { payload: { error: err } });
  }

  // Browser-style event wrapper
  private _handleMessageEvent(ev: any) {
    this._handleMessageData(ev.data);
  }

  // Core logic handling raw data string/buffer
  private _handleMessageData(data: any) {
    try {
      const str = data.toString(); // Convert buffer to string if necessary
      const msg = JSON.parse(str);

      // DEBUG LOG: Uncomment if needed to trace raw traffic
      // if (msg.type !== 'p2p') console.log(`[Net In] ${msg.type}`); 

      switch (msg.type) {
        case "welcome":
          this.peerId = msg.peerId;
          this.emit("net:ready", { peerId: this.peerId });
          break;

        case "peer:joined":
          if (msg.peerId !== this.peerId) {
            this.peers.add(msg.peerId);
            this.emit("net:peer:connected", { peerId: msg.peerId });
          }
          break;

        case "peer:left":
          this.peers.delete(msg.peerId);
          this.emit("net:peer:disconnected", { peerId: msg.peerId });
          break;

        case "p2p":
          this.emit("net:message", { 
            ...msg.payload, 
            fromPeerId: msg.fromPeerId 
          });
          break;

        case "error":
          this.emit("net:error", msg);
          break;

        default:
          this.emit("net:message", msg);
          break;
      }
    } catch (err) {
      console.error("Network parse error", err);
    }
  }
}