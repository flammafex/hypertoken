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

/** Identity and game context available to the outbound projection policy. */
export interface OutboundPrincipal {
  clientId: string;
  roomCode?: string;
  playerIndex?: number;
}

/**
 * Categories are deliberately independent of the wire-level `cmd`. This lets a
 * policy distinguish, for example, an initial state from a live broadcast.
 */
export type OutboundMessageCategory =
  | "welcome"
  | "state:broadcast"
  | "state:describe"
  | "history"
  | "dispatch:success"
  | "dispatch:error"
  | "protocol:error"
  | "room:created"
  | "room:joined"
  | "room:left"
  | "room:list"
  | "room:error"
  | "custom";

export class AuthoritativeServer extends Emitter {
  engine: Engine;
  port: number;
  verbose: boolean;
  broadcastOnAction: boolean;

  clients: Map<string, ClientInfo>;
  wss: WebSocketServer | null = null;
  private checkedDispatchesInFlight = 0;
  private dispatchQueue: Promise<void> = Promise.resolve();

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
        if (this.checkedDispatchesInFlight === 0) this.broadcast();
      });
    }
  }

  /**
   * Get the current game state to send to clients.
   * Override this in subclasses for custom state filtering.
   */
  protected getState(): any {
    return {
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

  /** Room-aware servers can override this while preserving getHistorySince. */
  protected getHistoryForClient(_clientId: string, fromIndex: number): any[] {
    return this.getHistorySince(fromIndex);
  }

  /**
   * Project one history entry for an untrusted client. History is denied by
   * default because actions can contain private payloads. Subclasses may return
   * a safe representation of individual entries.
   */
  protected projectHistory(
    _principal: OutboundPrincipal,
    _entry: any,
    _index: number
  ): any | null {
    return null;
  }

  /** Build the principal supplied to the final outbound policy boundary. */
  protected getOutboundPrincipal(clientId: string): OutboundPrincipal {
    return { clientId };
  }

  /**
   * Final policy boundary for all messages sent to untrusted clients.
   *
   * Override this to enforce application-specific disclosure rules. Returning
   * null/undefined or throwing fails closed. State supplied here has already
   * passed through getStateForClient/getStateForRoom, which remain the explicit
   * compatibility hooks for game-specific state views.
   */
  protected projectOutbound(
    principal: OutboundPrincipal,
    category: OutboundMessageCategory,
    payload: any
  ): any | null {
    if (!payload || typeof payload !== "object") return null;

    const requestId = this.safeCorrelationId(payload.requestId);
    const actionType = typeof payload.type === "string" ? payload.type : undefined;
    const roomCode = principal.roomCode ?? this.safeString(payload.roomCode);

    switch (category) {
      case "welcome":
        return {
          cmd: "welcome",
          clientId: principal.clientId,
          state: payload.state ?? null,
        };

      case "state:broadcast":
      case "state:describe":
        return {
          cmd: "state",
          ...(roomCode ? { roomCode } : {}),
          state: payload.state ?? null,
        };

      case "history":
        return {
          cmd: "history",
          actions: Array.isArray(payload.actions)
            ? payload.actions.flatMap((entry: any, offset: number) => {
                try {
                  const index = Number.isSafeInteger(payload.fromIndex)
                    ? payload.fromIndex + offset
                    : offset;
                  const projected = this.projectHistory(principal, entry, index);
                  return projected == null ? [] : [projected];
                } catch {
                  return [];
                }
              })
            : [],
          ...(Number.isSafeInteger(payload.fromIndex) ? { fromIndex: payload.fromIndex } : {}),
        };

      case "dispatch:success":
        return {
          cmd: "dispatch:result",
          ok: true,
          ...(actionType ? { type: actionType } : {}),
          ...(requestId !== undefined ? { requestId } : {}),
        };

      case "dispatch:error":
        return {
          cmd: "error",
          message: this.dispatchErrorMessage(payload.reason),
          ...(actionType ? { type: actionType } : {}),
          ...(requestId !== undefined ? { requestId } : {}),
        };

      case "protocol:error":
        return { cmd: "error", message: "Invalid message" };

      case "room:created":
        return {
          cmd: "room:created",
          ...(roomCode ? { roomCode } : {}),
          ...(Object.prototype.hasOwnProperty.call(payload, "state")
            ? { state: payload.state ?? null }
            : {}),
        };

      case "room:joined":
        return {
          cmd: "room:joined",
          ...(roomCode ? { roomCode } : {}),
          ...(Number.isSafeInteger(payload.playerIndex) ? { playerIndex: payload.playerIndex } : {}),
          state: payload.state ?? null,
        };

      case "room:left":
        return { cmd: "room:left" };

      case "room:list":
        return {
          cmd: "room:list",
          rooms: Array.isArray(payload.rooms)
            ? payload.rooms.map((room: any) => ({
                roomCode: this.safeString(room?.roomCode) ?? "",
                memberCount: Number.isSafeInteger(room?.memberCount) ? room.memberCount : 0,
                maxMembers: Number.isSafeInteger(room?.maxMembers) ? room.maxMembers : 0,
                ...(typeof room?.variant === "string" ? { variant: room.variant } : {}),
                hasPassword: room?.hasPassword === true,
              }))
            : [],
        };

      case "room:error":
        return {
          cmd: "room:error",
          message: this.safeRoomError(payload.message),
          ...(requestId !== undefined ? { requestId } : {}),
        };

      default:
        // Unknown/custom outbound shapes require an explicit policy override.
        return null;
    }
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
        }, "state:broadcast");
      }
    }
  }

  /**
   * Send a message to a specific client.
   */
  sendToClient(
    clientId: string,
    message: any,
    category: OutboundMessageCategory = this.inferOutboundCategory(message)
  ): void {
    const client = this.clients.get(clientId);
    if (!client || client.ws.readyState !== WebSocket.OPEN) return;

    try {
      const projected = this.projectOutbound(this.getOutboundPrincipal(clientId), category, message);
      if (projected == null) return;
      this.sendRaw(client, projected);
    } catch {
      // Projection and serialization failures are policy denials.
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
        }, "welcome");

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
          }, "state:describe");
          break;

        case "dispatch":
          // Client requesting action execution
          await this.handleDispatch(
            clientId,
            msg.type,
            msg.payload,
            this.safeCorrelationId(msg.requestId ?? msg.id)
          );
          break;

        case "history":
          // Client requesting action history (for reconnection)
          const fromIndex = Number.isSafeInteger(msg.fromIndex) && msg.fromIndex >= 0
            ? msg.fromIndex
            : 0;
          this.sendToClient(clientId, {
            cmd: "history",
            actions: this.getHistoryForClient(clientId, fromIndex),
            fromIndex,
          }, "history");
          break;

        default:
          // Unknown command - emit event for custom handling
          this.emit("message", { clientId, message: msg });
      }
    } catch (error) {
      this.sendToClient(clientId, {
        cmd: "error",
      }, "protocol:error");
    }
  }

  protected async handleDispatch(
    clientId: string,
    type: string,
    payload: any,
    requestId?: string | number
  ): Promise<void> {
    const queued = this.dispatchQueue.then(() =>
      this.handleDispatchSerial(clientId, type, payload, requestId)
    );
    this.dispatchQueue = queued.catch(() => undefined);
    await queued;
  }

  private async handleDispatchSerial(
    clientId: string,
    type: string,
    payload: any,
    requestId?: string | number
  ): Promise<void> {
    // Validate via hook
    let accepted = false;
    try {
      accepted = this.beforeDispatch(clientId, type, payload);
    } catch (error) {
      this.reportDispatchFailure(clientId, type, payload, requestId, error);
      return;
    }
    if (!accepted) {
      this.sendToClient(clientId, {
        cmd: "error",
        reason: "rejected",
        type,
        requestId,
      }, "dispatch:error");
      return;
    }

    const dispatchChecked = (this.engine as any).dispatchChecked;
    if (typeof dispatchChecked !== "function") {
      this.reportDispatchFailure(
        clientId,
        type,
        payload,
        requestId,
        new Error("Strict dispatch is unavailable")
      );
      return;
    }

    let outcome: any;
    try {
      this.checkedDispatchesInFlight++;
      try {
        outcome = await dispatchChecked.call(this.engine, type, payload);
      } finally {
        this.checkedDispatchesInFlight--;
      }
    } catch (error) {
      this.reportDispatchFailure(clientId, type, payload, requestId, error);
      return;
    }

    if (!outcome || typeof outcome !== "object" || outcome.ok !== true) {
      this.reportDispatchFailure(clientId, type, payload, requestId, outcome?.error);
      return;
    }

    // Everything below is post-commit. Hook and projection failures are
    // isolated so they cannot contradict an already committed strict success.
    try {
      this.afterDispatch(clientId, type, payload, outcome.result);
    } catch (error) {
      this.reportPostCommitError("afterDispatch", clientId, type, error);
    }

    if (this.broadcastOnAction) {
      try {
        this.broadcast();
      } catch (error) {
        this.reportPostCommitError("broadcast", clientId, type, error);
      }
    }

    // Correlated acknowledgement intentionally excludes the handler result.
    this.sendToClient(clientId, {
      cmd: "dispatch:result",
      type,
      requestId,
    }, "dispatch:success");
  }

  private reportDispatchFailure(
    clientId: string,
    type: string,
    payload: any,
    requestId: string | number | undefined,
    error: unknown
  ): void {
    const err = error instanceof Error
      ? error
      : new Error(typeof (error as any)?.message === "string" ? (error as any).message : "Action failed");
    try {
      this.onDispatchError(clientId, type, payload, err);
    } catch (hookError) {
      if (this.verbose) console.error("[AuthServer] onDispatchError hook failed:", hookError);
    }
    this.sendToClient(clientId, {
      cmd: "error",
      reason: "failed",
      type,
      requestId,
    }, "dispatch:error");
  }

  private reportPostCommitError(stage: string, clientId: string, type: string, error: unknown): void {
    if (this.verbose) {
      console.error(`[AuthServer] Post-commit ${stage} failed for ${clientId} (${type}):`, error);
    }
    try {
      this.emit("dispatch:postCommitError", { clientId, type, stage, error });
    } catch (listenerError) {
      if (this.verbose) console.error("[AuthServer] Post-commit error listener failed:", listenerError);
    }
  }

  private sendRaw(client: ClientInfo, projected: any): void {
    const serialized = JSON.stringify(projected);
    if (serialized === undefined) return;
    client.ws.send(serialized);
  }

  private inferOutboundCategory(message: any): OutboundMessageCategory {
    switch (message?.cmd) {
      case "welcome": return "welcome";
      case "state": return "state:broadcast";
      case "history": return "history";
      case "dispatch:result": return "dispatch:success";
      case "error": return "dispatch:error";
      case "room:created": return "room:created";
      case "room:joined": return "room:joined";
      case "room:left": return "room:left";
      case "room:list": return "room:list";
      case "room:error": return "room:error";
      default: return "custom";
    }
  }

  private safeCorrelationId(value: any): string | number | undefined {
    return typeof value === "string" || (typeof value === "number" && Number.isSafeInteger(value))
      ? value
      : undefined;
  }

  private safeString(value: any): string | undefined {
    return typeof value === "string" && value.length > 0 ? value : undefined;
  }

  private dispatchErrorMessage(reason: any): string {
    switch (reason) {
      case "rejected": return "Action rejected";
      case "not-in-room": return "Not in a room";
      case "room-not-found": return "Room not found";
      default: return "Action failed";
    }
  }

  private safeRoomError(message: any): string {
    const allowed = new Set([
      "Server room limit reached",
      "Could not generate unique room code",
      "Failed to create room",
      "Room not found",
      "Already in this room",
      "Already in room",
      "Room is full",
      "Invalid password",
      "Room limit reached",
      "Failed to join room",
    ]);
    return typeof message === "string" && allowed.has(message)
      ? message
      : "Room request failed";
  }

  private generateClientId(): string {
    return `client-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
  }
}
