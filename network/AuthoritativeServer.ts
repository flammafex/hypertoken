/*
 * network/AuthoritativeServer.ts
 *
 * Extensible server-authoritative game server using HyperToken Engine.
 * Unlike UniversalRelayServer in relay mode (P2P), this server is the
 * single source of truth for game state. Extend this class to build
 * custom game servers with lifecycle hooks.
 *
 * Features:
 * - Authoritative state management via Engine + Chronicle
 * - Action history for reconnection/replay
 * - Extensible hooks for game-specific logic
 * - Automatic state broadcasting
 */
import { Emitter } from "../core/events.js";
import { Engine } from "../engine/Engine.js";
import { WebSocketServer, WebSocket } from "ws";

export interface AuthoritativeServerOptions {
  port?: number;
  verbose?: boolean;
  /** Automatically broadcast state after each dispatched action */
  broadcastOnAction?: boolean;
}

export interface ClientInfo {
  id: string;
  ws: WebSocket;
  connectedAt: number;
}

export class AuthoritativeServer extends Emitter {
  engine: Engine;
  port: number;
  verbose: boolean;
  broadcastOnAction: boolean;

  clients: Map<string, ClientInfo>;
  wss: WebSocketServer | null = null;

  constructor(engine: Engine, options: AuthoritativeServerOptions = {}) {
    super();
    this.engine = engine;
    this.port = options.port ?? 8080;
    this.verbose = options.verbose ?? false;
    this.broadcastOnAction = options.broadcastOnAction ?? true;
    this.clients = new Map();

    // Set up default describe if not already set
    if (!this.engine.describe) {
      this.engine.describe = () => this.getState();
    }

    // Auto-broadcast after any action if enabled
    if (this.broadcastOnAction) {
      this.engine.on("engine:action", () => {
        this.broadcast();
      });
    }
  }

  /**
   * Get the current game state to send to clients.
   * Override this in subclasses for custom state filtering.
   */
  protected getState(): any {
    return {
      gameState: this.engine._gameState,
      historyLength: this.engine.history.length,
    };
  }

  /**
   * Get state for a specific client (for player-specific views).
   * Override this for games with hidden information.
   */
  protected getStateForClient(clientId: string): any {
    return this.getState();
  }

  /**
   * Get action history since a given index (for reconnection).
   */
  protected getHistorySince(fromIndex: number): any[] {
    return this.engine.history.slice(fromIndex);
  }

  // ─────────────────────────────────────────────────────────────
  // Lifecycle hooks - override these in subclasses
  // ─────────────────────────────────────────────────────────────

  /**
   * Called when a client connects. Override for custom logic.
   */
  protected onClientConnect(clientId: string): void {
    if (this.verbose) {
      console.log(`[AuthServer] Client connected: ${clientId}`);
    }
  }

  /**
   * Called when a client disconnects. Override for cleanup.
   */
  protected onClientDisconnect(clientId: string): void {
    if (this.verbose) {
      console.log(`[AuthServer] Client disconnected: ${clientId}`);
    }
  }

  /**
   * Called before dispatching an action. Return false to reject.
   * Override for validation, rate limiting, anti-cheat, etc.
   */
  protected beforeDispatch(clientId: string, type: string, payload: any): boolean {
    return true;
  }

  /**
   * Called after an action is dispatched successfully.
   * Override for logging, achievements, etc.
   */
  protected afterDispatch(clientId: string, type: string, payload: any, result: any): void {
    // Default: no-op
  }

  /**
   * Called when an action fails. Override for custom error handling.
   */
  protected onDispatchError(clientId: string, type: string, payload: any, error: Error): void {
    console.error(`[AuthServer] Action failed for ${clientId}:`, error.message);
  }

  // ─────────────────────────────────────────────────────────────
  // Server operations
  // ─────────────────────────────────────────────────────────────

  /**
   * Broadcast current state to all connected clients.
   */
  broadcast(): void {
    for (const [clientId, client] of this.clients) {
      if (client.ws.readyState === WebSocket.OPEN) {
        this.sendToClient(clientId, {
          cmd: "state",
          state: this.getStateForClient(clientId),
        });
      }
    }
  }

  /**
   * Send a message to a specific client.
   */
  sendToClient(clientId: string, message: any): void {
    const client = this.clients.get(clientId);
    if (client && client.ws.readyState === WebSocket.OPEN) {
      client.ws.send(JSON.stringify(message));
    }
  }

  /**
   * Start the WebSocket server.
   */
  start(): Promise<void> {
    return new Promise((resolve) => {
      this.wss = new WebSocketServer({ port: this.port });

      this.wss.on("listening", () => {
        console.log(`🎮 AuthoritativeServer running on ws://localhost:${this.port}`);
        resolve();
      });

      this.wss.on("connection", (ws: WebSocket) => {
        const clientId = this.generateClientId();
        const clientInfo: ClientInfo = {
          id: clientId,
          ws,
          connectedAt: Date.now(),
        };
        this.clients.set(clientId, clientInfo);

        // Notify subclass
        this.onClientConnect(clientId);
        this.emit("client:connected", { clientId });

        // Send welcome message with initial state
        this.sendToClient(clientId, {
          cmd: "welcome",
          clientId,
          state: this.getStateForClient(clientId),
        });

        // Handle incoming messages
        ws.on("message", (data: any) => this.handleMessage(clientId, data));

        // Handle disconnect
        ws.on("close", () => {
          this.clients.delete(clientId);
          this.onClientDisconnect(clientId);
          this.emit("client:disconnected", { clientId });
        });

        // Handle errors
        ws.on("error", (error) => {
          console.error(`[AuthServer] WebSocket error for ${clientId}:`, error);
        });
      });
    });
  }

  /**
   * Stop the server and disconnect all clients.
   */
  stop(): void {
    if (this.wss) {
      // Close all client connections
      for (const [, client] of this.clients) {
        client.ws.close();
      }
      this.clients.clear();
      this.wss.close();
      this.wss = null;
    }
  }

  // ─────────────────────────────────────────────────────────────
  // Protocol handling
  // ─────────────────────────────────────────────────────────────

  private async handleMessage(clientId: string, rawData: any): Promise<void> {
    try {
      const msg = JSON.parse(rawData.toString());

      switch (msg.cmd) {
        case "describe":
          // Client requesting current state
          this.sendToClient(clientId, {
            cmd: "state",
            state: this.getStateForClient(clientId),
          });
          break;

        case "dispatch":
          // Client requesting action execution
          await this.handleDispatch(clientId, msg.type, msg.payload);
          break;

        case "history":
          // Client requesting action history (for reconnection)
          const fromIndex = msg.fromIndex ?? 0;
          this.sendToClient(clientId, {
            cmd: "history",
            actions: this.getHistorySince(fromIndex),
          });
          break;

        default:
          // Unknown command - emit event for custom handling
          this.emit("message", { clientId, message: msg });
      }
    } catch (error) {
      this.sendToClient(clientId, {
        cmd: "error",
        message: error instanceof Error ? error.message : "Unknown error",
      });
    }
  }

  protected async handleDispatch(clientId: string, type: string, payload: any): Promise<void> {
    // Validate via hook
    if (!this.beforeDispatch(clientId, type, payload)) {
      this.sendToClient(clientId, {
        cmd: "error",
        message: "Action rejected",
        type,
      });
      return;
    }

    try {
      // Dispatch to engine
      const result = await this.engine.dispatch(type, payload);

      // Notify subclass
      this.afterDispatch(clientId, type, payload, result);

      // Note: broadcast happens automatically via engine:action if broadcastOnAction is true
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      this.onDispatchError(clientId, type, payload, err);
      this.sendToClient(clientId, {
        cmd: "error",
        message: err.message,
        type,
      });
      // Still broadcast state to keep clients in sync
      this.broadcast();
    }
  }

  private generateClientId(): string {
    return `client-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
  }
}
