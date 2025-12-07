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
 * A unified WebSocket relay server that supports two modes:
 *
 * 1. **Relay Mode** (default): Pure P2P signaling relay
 *    - Routes messages between connected peers
 *    - Handles WebRTC signaling (offer, answer, ice-candidate)
 *    - No game state management
 *
 * 2. **Authoritative Mode**: Game server with engine integration
 *    - Handles `describe` command to get current game state
 *    - Handles `dispatch` command to execute game actions
 *    - Auto-broadcasts state changes to all clients
 *    - WebRTC signaling still supported
 *
 * Usage:
 *   // Relay mode (no engine)
 *   const server = new UniversalRelayServer({ port: 3000 });
 *
 *   // Authoritative mode (with engine)
 *   const engine = new Engine();
 *   const server = new UniversalRelayServer({ port: 3000, engine });
 */

import { Emitter } from "../core/events.js";
import { IActionPayload } from "../core/types.js";
import { Engine } from "../engine/Engine.js";
import { WebSocketServer, WebSocket } from "ws";

export type RelayMode = "relay" | "authoritative";

export interface UniversalRelayServerOptions {
  /** Listening port (default: 3000) */
  port?: number;
  /** Engine instance for authoritative mode */
  engine?: Engine | null;
  /** Enable verbose logging (default: false) */
  verbose?: boolean;
  /** Auto-broadcast state on engine actions (default: true in authoritative mode) */
  broadcastOnAction?: boolean;
  /** Server mode - auto-detected if engine is provided */
  mode?: RelayMode;
}

export interface ClientInfo {
  peerId: string;
  connectedAt: Date;
  metadata?: Record<string, unknown>;
}

export class UniversalRelayServer extends Emitter {
  private wss: WebSocketServer | null = null;
  private clients: Map<WebSocket, ClientInfo> = new Map();

  readonly port: number;
  readonly mode: RelayMode;
  readonly verbose: boolean;
  readonly broadcastOnAction: boolean;

  engine: Engine | null;

  constructor(options: UniversalRelayServerOptions = {}) {
    super();

    this.port = options.port ?? 3000;
    this.engine = options.engine ?? null;
    this.verbose = options.verbose ?? false;
    this.broadcastOnAction = options.broadcastOnAction ?? true;

    // Auto-detect mode based on engine presence
    this.mode = options.mode ?? (this.engine ? "authoritative" : "relay");

    // Set up engine event listeners for authoritative mode
    if (this.engine && this.broadcastOnAction) {
      this.engine.on("engine:action", () => this.broadcastState());
    }
  }

  /**
   * Start the relay server
   */
  async start(): Promise<void> {
    return new Promise((resolve) => {
      this.wss = new WebSocketServer({ port: this.port });

      const modeLabel = this.mode === "authoritative" ? "Authoritative" : "Relay";
      console.log(`[UniversalRelay] ${modeLabel} server running on ws://localhost:${this.port}`);

      this.wss.on("listening", () => {
        this.emit("server:start", { payload: { port: this.port, mode: this.mode } });
        resolve();
      });

      this.wss.on("connection", (ws: WebSocket) => this._handleConnection(ws));
    });
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

    // Close the WebSocket server
    if (this.wss) {
      this.wss.close(() => {
        if (this.verbose) {
          console.log("[UniversalRelay] Server stopped");
        }
      });
      this.wss = null;
    }

    this.emit("server:stop");
  }

  /**
   * Get current client count
   */
  get clientCount(): number {
    return this.clients.size;
  }

  /**
   * Get all connected peer IDs
   */
  getPeerIds(): string[] {
    return Array.from(this.clients.values()).map(info => info.peerId);
  }

  /**
   * Broadcast current game state to all clients (authoritative mode)
   */
  broadcastState(): void {
    if (this.mode !== "authoritative" || !this.engine) {
      return;
    }

    try {
      const state = this._getEngineState();
      const msg = JSON.stringify({ cmd: "describe", state });

      for (const [client] of this.clients) {
        if (client.readyState === WebSocket.OPEN) {
          client.send(msg);
        }
      }
    } catch (err) {
      if (this.verbose) {
        console.error("[UniversalRelay] Error broadcasting state:", err);
      }
    }
  }

  /*───────────────────────────────────────────────
    Private: Connection handling
  ───────────────────────────────────────────────*/

  private _handleConnection(ws: WebSocket): void {
    const peerId = `peer-${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 7)}`;
    const clientInfo: ClientInfo = {
      peerId,
      connectedAt: new Date()
    };

    this.clients.set(ws, clientInfo);

    if (this.verbose) {
      console.log(`[UniversalRelay] Client connected: ${peerId} (${this.clients.size} total)`);
    }

    // Send welcome message
    this._send(ws, {
      type: "welcome",
      peerId,
      mode: this.mode,
      clientCount: this.clients.size
    });

    // Notify other peers
    this._broadcast({ type: "peer:joined", peerId }, ws);

    // Send list of existing peers to the new client
    for (const info of this.clients.values()) {
      if (info.peerId !== peerId) {
        this._send(ws, { type: "peer:joined", peerId: info.peerId });
      }
    }

    // In authoritative mode, send initial state
    if (this.mode === "authoritative" && this.engine) {
      try {
        const state = this._getEngineState();
        this._send(ws, { cmd: "describe", state });
      } catch (err) {
        if (this.verbose) {
          console.error("[UniversalRelay] Error sending initial state:", err);
        }
      }
    }

    // Set up message handler
    ws.on("message", (data: Buffer) => this._handleMessage(ws, clientInfo, data));

    // Set up close handler
    ws.on("close", () => {
      this.clients.delete(ws);
      this._broadcast({ type: "peer:left", peerId });

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

  private async _handleMessage(ws: WebSocket, clientInfo: ClientInfo, rawData: Buffer): Promise<void> {
    try {
      const msg = JSON.parse(rawData.toString());
      const fromPeerId = clientInfo.peerId;

      // Handle authoritative commands (describe, dispatch)
      if (this.mode === "authoritative") {
        if (msg.cmd === "describe") {
          this._handleDescribe(ws);
          return;
        }

        if (msg.cmd === "dispatch") {
          await this._handleDispatch(ws, msg);
          return;
        }
      }

      // Handle WebRTC signaling (both modes)
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

      this._send(ws, {
        cmd: "error",
        message: err instanceof Error ? err.message : "Unknown error"
      });
    }
  }

  /*───────────────────────────────────────────────
    Private: Authoritative mode commands
  ───────────────────────────────────────────────*/

  private _handleDescribe(ws: WebSocket): void {
    if (!this.engine) {
      this._send(ws, { cmd: "error", message: "No engine available" });
      return;
    }

    try {
      const state = this._getEngineState();
      this._send(ws, { cmd: "describe", state });
    } catch (err) {
      this._send(ws, {
        cmd: "error",
        message: `Failed to describe state: ${err instanceof Error ? err.message : "Unknown error"}`
      });
    }
  }

  private async _handleDispatch(ws: WebSocket, msg: { type?: string; payload?: IActionPayload }): Promise<void> {
    if (!this.engine) {
      this._send(ws, { cmd: "error", message: "No engine available" });
      return;
    }

    const { type, payload } = msg;

    if (!type) {
      this._send(ws, { cmd: "error", message: "Dispatch requires 'type' field" });
      return;
    }

    try {
      await this.engine.dispatch(type, payload ?? {});

      // State broadcast happens automatically via engine:action event
      // But send confirmation to the sender
      this._send(ws, { cmd: "dispatch:ok", type });

    } catch (err) {
      this._send(ws, {
        cmd: "error",
        message: `Dispatch failed: ${err instanceof Error ? err.message : "Unknown error"}`
      });
    }
  }

  private _getEngineState(): Record<string, unknown> {
    if (!this.engine) {
      return {};
    }

    // Use engine's describe method if available, otherwise fallback
    if (typeof (this.engine as any).describe === "function") {
      return (this.engine as any).describe();
    }

    // Fallback: return basic engine state
    return {
      _gameState: (this.engine as any)._gameState ?? null,
      history: (this.engine as any).history ?? []
    };
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
        this._send(client, { ...msg, fromPeerId });
        return;
      }
    }

    if (this.verbose) {
      console.warn(`[UniversalRelay] WebRTC target peer not found: ${targetPeerId}`);
    }
  }

  /*───────────────────────────────────────────────
    Private: Message routing
  ───────────────────────────────────────────────*/

  private _routeToTarget(fromPeerId: string, msg: any): void {
    const targetPeerId = msg.targetPeerId;

    for (const [client, info] of this.clients) {
      if (info.peerId === targetPeerId) {
        this._send(client, { ...msg, fromPeerId });
        return;
      }
    }

    if (this.verbose) {
      console.warn(`[UniversalRelay] Target peer not found: ${targetPeerId}`);
    }
  }

  private _send(ws: WebSocket, msg: any): void {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(msg));
    }
  }

  private _broadcast(msg: any, excludeWs?: WebSocket): void {
    const str = JSON.stringify(msg);

    for (const [client] of this.clients) {
      if (client !== excludeWs && client.readyState === WebSocket.OPEN) {
        client.send(str);
      }
    }
  }
}

// Default export for convenience
export default UniversalRelayServer;
