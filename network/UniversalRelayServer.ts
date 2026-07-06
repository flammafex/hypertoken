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

/**
 * UniversalRelayServer
 *
 * A WebSocket relay server for P2P signaling and message routing.
 *
 * Features:
 *   - Routes messages between connected peers
 *   - Handles WebRTC signaling (offer, answer, ice-candidate)
 *   - Rate limiting to prevent abuse
 *   - Health check endpoint for monitoring
 *   - Binary protocol support (MessagePack + compression)
 *
 * For authoritative game servers, use AuthoritativeServer instead.
 *
 * Usage:
 *   const server = new UniversalRelayServer({ port: 3000 });
 *   await server.start();
 */

import { createServer, IncomingMessage, ServerResponse } from "http";
import { Emitter } from "../core/events.js";
import { RateLimiter, RateLimitConfig } from "./RateLimiter.js";
import { MessageCodec, CodecConfig, jsonCodec } from "./MessageCodec.js";
import { WebSocketServer, WebSocket } from "ws";

export interface UniversalRelayServerOptions {
  /** Listening port (default: 3000) */
  port?: number;
  /** Enable verbose logging (default: false) */
  verbose?: boolean;
  /** Rate limiting config (optional, enabled by default) */
  rateLimit?: Partial<RateLimitConfig> | false;
  /** Message codec (default: JSON for backward compatibility) */
  codec?: MessageCodec | Partial<CodecConfig>;
  /** Enable room multiplexing (default: true). When enabled, peers can create/join
   *  rooms and broadcasts are scoped to the room. Non-room peers broadcast to
   *  other non-room peers only (backward compatible). */
  rooms?: boolean;
}

export interface ClientInfo {
  peerId: string;
  connectedAt: Date;
  metadata?: Record<string, unknown>;
  /** Whether this client uses binary protocol */
  binaryMode: boolean;
}

/**
 * Generate a human-readable room code (format: XXXX-XXXX).
 * Uses unambiguous characters (no 0/O/1/I/L).
 */
function generateRoomCode(): string {
  const chars = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
  let code = "";
  for (let i = 0; i < 4; i++) code += chars[Math.floor(Math.random() * chars.length)];
  code += "-";
  for (let i = 0; i < 4; i++) code += chars[Math.floor(Math.random() * chars.length)];
  return code;
}

export class UniversalRelayServer extends Emitter {
  private httpServer: ReturnType<typeof createServer> | null = null;
  private wss: WebSocketServer | null = null;
  private clients: Map<WebSocket, ClientInfo> = new Map();
  private rateLimiter: RateLimiter | null = null;
  private startTime: number = Date.now();
  private codec: MessageCodec;

  /** Room multiplexing: roomCode → set of client WebSockets */
  private rooms: Map<string, Set<WebSocket>> = new Map();
  /** Track which room each peer is in: peerId → roomCode */
  private peerRooms: Map<string, string> = new Map();
  /** Whether room multiplexing is enabled */
  private readonly roomsEnabled: boolean;

  readonly port: number;
  readonly verbose: boolean;

  constructor(options: UniversalRelayServerOptions = {}) {
    super();

    this.port = options.port ?? 3000;
    this.verbose = options.verbose ?? false;
    this.roomsEnabled = options.rooms ?? true;

    // Setup codec (default to JSON for backward compatibility)
    if (options.codec instanceof MessageCodec) {
      this.codec = options.codec;
    } else if (options.codec) {
      this.codec = new MessageCodec(options.codec);
    } else {
      this.codec = jsonCodec;
    }

    // Initialize rate limiter unless explicitly disabled
    if (options.rateLimit !== false) {
      this.rateLimiter = new RateLimiter(options.rateLimit ?? {});
    }
  }

  /**
   * Start the relay server with HTTP health endpoint
   */
  async start(): Promise<void> {
    this.startTime = Date.now();

    // Create HTTP server with health check endpoint
    this.httpServer = createServer((req, res) => this._handleHttpRequest(req, res));

    // Attach WebSocket server to HTTP server
    this.wss = new WebSocketServer({ server: this.httpServer });

    const codecFormat = this.codec.getConfig().format;
    console.log(`[UniversalRelay] Relay server running on ws://localhost:${this.port}`);
    console.log(`[UniversalRelay] Health check: http://localhost:${this.port}/health`);
    console.log(`[UniversalRelay] Protocol: ${codecFormat} (auto-detect per client)`);
    if (this.rateLimiter) {
      console.log(`[UniversalRelay] Rate limiting: enabled`);
    }

    this.wss.on("connection", (ws: WebSocket) => this._handleConnection(ws));

    return new Promise((resolve) => {
      this.httpServer!.listen(this.port, () => {
        this.emit("server:start", { payload: { port: this.port } });
        resolve();
      });
    });
  }

  /**
   * Handle HTTP requests (health check endpoint)
   */
  private _handleHttpRequest(req: IncomingMessage, res: ServerResponse): void {
    if (req.url === "/health" || req.url === "/health/") {
      const health = {
        status: "healthy",
        uptime: Math.floor((Date.now() - this.startTime) / 1000),
        connections: this.clients.size,
        protocol: this.codec.getConfig().format,
        rateLimit: this.rateLimiter?.getStats() ?? null,
      };

      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify(health));
      return;
    }

    if (req.url === "/ready" || req.url === "/ready/") {
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ ready: true }));
      return;
    }

    // For any other HTTP request, return 426 Upgrade Required
    res.writeHead(426, { "Content-Type": "text/plain" });
    res.end("WebSocket connection required. Use ws:// protocol.");
  }

  /**
   * Stop the relay server and close all connections
   */
  stop(): void {
    if (this.verbose) {
      console.log("[UniversalRelay] Shutting down...");
    }

    // Close all client connections
    for (const [client] of this.clients) {
      try {
        client.close();
      } catch {
        // Ignore errors when closing
      }
    }
    this.clients.clear();
    this.rooms.clear();
    this.peerRooms.clear();

    // Close the WebSocket server
    if (this.wss) {
      this.wss.close(() => {
        if (this.verbose) {
          console.log("[UniversalRelay] Server stopped");
        }
      });
      this.wss = null;
    }

    // Close HTTP server
    this.httpServer?.close();
    this.httpServer = null;

    // Cleanup rate limiter
    this.rateLimiter?.destroy();

    this.emit("server:stop");
  }

  /**
   * Get current client count
   */
  get clientCount(): number {
    return this.clients.size;
  }

  /*───────────────────────────────────────────────
    Private: Connection handling
  ───────────────────────────────────────────────*/

  private _handleConnection(ws: WebSocket): void {
    const peerId = `peer-${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 7)}`;
    const clientInfo: ClientInfo = {
      peerId,
      connectedAt: new Date(),
      binaryMode: false // Will be set on first message
    };

    this.clients.set(ws, clientInfo);

    if (this.verbose) {
      console.log(`[UniversalRelay] Client connected: ${peerId} (${this.clients.size} total)`);
    }

    // Send welcome message (use JSON initially, client will set binary mode on first message)
    this._send(ws, clientInfo, {
      type: "welcome",
      peerId,
      clientCount: this.clients.size
    });

    // Notify other peers
    this._broadcast({ type: "peer:joined", peerId }, ws);

    // Send list of existing peers to the new client
    for (const info of this.clients.values()) {
      if (info.peerId !== peerId) {
        this._send(ws, clientInfo, { type: "peer:joined", peerId: info.peerId });
      }
    }

    // Set up message handler
    ws.on("message", (data: Buffer | ArrayBuffer | Buffer[]) => {
      // Convert to Uint8Array for unified handling
      let rawData: Uint8Array;
      if (Buffer.isBuffer(data)) {
        rawData = new Uint8Array(data);
      } else if (data instanceof ArrayBuffer) {
        rawData = new Uint8Array(data);
      } else if (Array.isArray(data)) {
        rawData = new Uint8Array(Buffer.concat(data));
      } else {
        rawData = new Uint8Array(data as ArrayBuffer);
      }
      this._handleMessage(ws, clientInfo, rawData);
    });

    // Set up close handler
    ws.on("close", () => {
      this.clients.delete(ws);
      this.rateLimiter?.remove(peerId);

      // Clean up room membership (notifies room peers if applicable)
      const wasInRoom = this.roomsEnabled && this.peerRooms.has(peerId);
      if (wasInRoom) {
        this._leaveCurrentRoom(ws, clientInfo);
      } else {
        // Not in a room — broadcast to non-room peers (backward compat)
        this._broadcast({ type: "peer:left", peerId });
      }

      if (this.verbose) {
        console.log(`[UniversalRelay] Client disconnected: ${peerId} (${this.clients.size} remaining)`);
      }

      this.emit("client:disconnect", { payload: { peerId } });
    });

    // Set up error handler
    ws.on("error", (err) => {
      if (this.verbose) {
        console.error(`[UniversalRelay] WebSocket error for ${peerId}:`, err);
      }
    });

    this.emit("client:connect", { payload: { peerId } });
  }

  /*───────────────────────────────────────────────
    Private: Message handling
  ───────────────────────────────────────────────*/

  private async _handleMessage(ws: WebSocket, clientInfo: ClientInfo, rawData: Uint8Array): Promise<void> {
    const fromPeerId = clientInfo.peerId;

    // Rate limiting check
    if (this.rateLimiter && !this.rateLimiter.check(fromPeerId)) {
      if (this.verbose) {
        console.warn(`[UniversalRelay] Rate limit exceeded for ${fromPeerId}, closing connection`);
      }
      ws.close(1008, "Rate limit exceeded");
      return;
    }

    try {
      // Detect if client is using binary protocol
      const isBinary = this.codec.isBinaryEncoded(rawData);
      if (isBinary && !clientInfo.binaryMode) {
        clientInfo.binaryMode = true;
        if (this.verbose) {
          console.log(`[UniversalRelay] Client ${fromPeerId} using binary protocol`);
        }
      }

      // Decode message using codec
      const msg = this.codec.decode(rawData) as any;

      // Handle room protocol messages (if rooms enabled)
      if (this.roomsEnabled && this._isRoomMessage(msg)) {
        this._handleRoomMessage(ws, clientInfo, msg);
        return;
      }

      // Handle WebRTC signaling
      if (this._isWebRTCSignaling(msg)) {
        this._routeWebRTCSignaling(fromPeerId, msg);
        return;
      }

      // Handle targeted messages (peer-to-peer routing)
      if (msg.targetPeerId) {
        this._routeToTarget(fromPeerId, msg);
        return;
      }

      // Broadcast to all other peers
      this._broadcast({ ...msg, fromPeerId }, ws);

    } catch (err) {
      if (this.verbose) {
        console.error("[UniversalRelay] Message handling error:", err);
      }

      this._send(ws, clientInfo, {
        cmd: "error",
        message: err instanceof Error ? err.message : "Unknown error"
      });
    }
  }

  /*───────────────────────────────────────────────
    Private: WebRTC signaling
  ───────────────────────────────────────────────*/

  private _isWebRTCSignaling(msg: any): boolean {
    return msg.payload && [
      "webrtc-offer",
      "webrtc-answer",
      "webrtc-ice-candidate"
    ].includes(msg.payload.type);
  }

  private _routeWebRTCSignaling(fromPeerId: string, msg: any): void {
    const targetPeerId = msg.targetPeerId;
    const signalType = msg.payload?.type;

    if (!targetPeerId) {
      if (this.verbose) {
        console.warn("[UniversalRelay] WebRTC signaling missing targetPeerId");
      }
      return;
    }

    if (this.verbose) {
      console.log(`[UniversalRelay] Routing WebRTC ${signalType}: ${fromPeerId} -> ${targetPeerId}`);
    }

    // Find target client and send
    for (const [client, info] of this.clients) {
      if (info.peerId === targetPeerId) {
        this._send(client, info, { ...msg, fromPeerId });
        return;
      }
    }

    if (this.verbose) {
      console.warn(`[UniversalRelay] WebRTC target peer not found: ${targetPeerId}`);
    }
  }

  /*───────────────────────────────────────────────
    Private: Room multiplexing
  ───────────────────────────────────────────────*/

  private _isRoomMessage(msg: any): boolean {
    return msg.type === "room:create" || msg.type === "room:join" || msg.type === "room:leave";
  }

  private _handleRoomMessage(ws: WebSocket, clientInfo: ClientInfo, msg: any): void {
    switch (msg.type) {
      case "room:create": {
        // Generate unique room code
        let roomCode: string;
        let attempts = 0;
        do {
          roomCode = generateRoomCode();
          attempts++;
        } while (this.rooms.has(roomCode) && attempts < 100);

        if (this.rooms.has(roomCode)) {
          this._send(ws, clientInfo, { type: "room:error", message: "Could not generate unique room code" });
          return;
        }

        // Leave current room if in one
        this._leaveCurrentRoom(ws, clientInfo);

        // Create room and add peer
        this.rooms.set(roomCode, new Set([ws]));
        this.peerRooms.set(clientInfo.peerId, roomCode);

        // Respond
        this._send(ws, clientInfo, { type: "room:created", roomCode });

        if (this.verbose) {
          console.log(`[UniversalRelay] Room created: ${roomCode} by ${clientInfo.peerId}`);
        }
        break;
      }

      case "room:join": {
        const roomCode = (msg.payload?.roomCode || msg.roomCode || "").toUpperCase().trim();
        const room = this.rooms.get(roomCode);

        if (!room) {
          this._send(ws, clientInfo, { type: "room:error", message: "Room not found" });
          return;
        }

        // Leave current room if in one
        this._leaveCurrentRoom(ws, clientInfo);

        // Join new room
        room.add(ws);
        this.peerRooms.set(clientInfo.peerId, roomCode);

        // Send existing peers in room to new joiner
        for (const [client, info] of this.clients) {
          if (client !== ws && this.peerRooms.get(info.peerId) === roomCode) {
            this._send(ws, clientInfo, { type: "peer:joined", peerId: info.peerId });
          }
        }

        // Notify room peers of new joiner
        this._broadcastToRoom(roomCode, { type: "peer:joined", peerId: clientInfo.peerId }, ws);

        // Respond
        this._send(ws, clientInfo, { type: "room:joined", roomCode });

        if (this.verbose) {
          console.log(`[UniversalRelay] Peer ${clientInfo.peerId} joined room ${roomCode}`);
        }
        break;
      }

      case "room:leave": {
        this._leaveCurrentRoom(ws, clientInfo);
        this._send(ws, clientInfo, { type: "room:left" });
        break;
      }
    }
  }

  /**
   * Remove a peer from their current room (if any).
   * Notifies remaining room peers of the departure.
   */
  private _leaveCurrentRoom(ws: WebSocket, clientInfo: ClientInfo): void {
    const roomCode = this.peerRooms.get(clientInfo.peerId);
    if (!roomCode) return;

    const room = this.rooms.get(roomCode);
    if (room) {
      room.delete(ws);
      if (room.size === 0) {
        this.rooms.delete(roomCode);
        if (this.verbose) {
          console.log(`[UniversalRelay] Room ${roomCode} deleted (empty)`);
        }
      } else {
        // Notify remaining peers
        this._broadcastToRoom(roomCode, { type: "peer:left", peerId: clientInfo.peerId });
      }
    }
    this.peerRooms.delete(clientInfo.peerId);
  }

  /**
   * Broadcast a message to all peers in a specific room.
   */
  private _broadcastToRoom(roomCode: string, msg: any, excludeWs?: WebSocket): void {
    const room = this.rooms.get(roomCode);
    if (!room) return;

    const jsonStr = JSON.stringify(msg);
    for (const client of room) {
      if (client !== excludeWs && client.readyState === WebSocket.OPEN) {
        const info = this.clients.get(client);
        if (info) {
          if (info.binaryMode) {
            client.send(this.codec.encode(msg));
          } else {
            client.send(jsonStr);
          }
        }
      }
    }
  }

  /*───────────────────────────────────────────────
    Private: Message routing
  ───────────────────────────────────────────────*/

  private _routeToTarget(fromPeerId: string, msg: any): void {
    const targetPeerId = msg.targetPeerId;

    for (const [client, info] of this.clients) {
      if (info.peerId === targetPeerId) {
        this._send(client, info, { ...msg, fromPeerId });
        return;
      }
    }

    if (this.verbose) {
      console.warn(`[UniversalRelay] Target peer not found: ${targetPeerId}`);
    }
  }

  private _send(ws: WebSocket, clientInfo: ClientInfo, msg: any): void {
    if (ws.readyState !== WebSocket.OPEN) return;

    // Use JSON for clients that haven't indicated binary support yet
    if (!clientInfo.binaryMode) {
      ws.send(JSON.stringify(msg));
    } else {
      const encoded = this.codec.encode(msg);
      ws.send(encoded);
    }
  }

  private _broadcast(msg: any, excludeWs?: WebSocket): void {
    // If rooms are enabled, scope broadcast to sender's room
    if (this.roomsEnabled && excludeWs) {
      const senderInfo = this.clients.get(excludeWs);
      const senderRoom = senderInfo ? this.peerRooms.get(senderInfo.peerId) : undefined;

      if (senderRoom) {
        // Sender is in a room — broadcast to room peers only
        this._broadcastToRoom(senderRoom, msg, excludeWs);
        return;
      }
      // Sender is not in a room — broadcast to non-room peers only (backward compat)
    }

    // Pre-encode for efficiency
    const jsonStr = JSON.stringify(msg);
    const binaryData = this.codec.getConfig().format === "msgpack"
      ? this.codec.encode(msg) as Uint8Array
      : null;

    for (const [client, info] of this.clients) {
      if (client !== excludeWs && client.readyState === WebSocket.OPEN) {
        // Skip peers in rooms (they only receive room-scoped broadcasts)
        if (this.roomsEnabled && this.peerRooms.has(info.peerId)) continue;

        if (info.binaryMode && binaryData) {
          client.send(binaryData);
        } else {
          client.send(jsonStr);
        }
      }
    }
  }
}

// Default export for convenience
export default UniversalRelayServer;
