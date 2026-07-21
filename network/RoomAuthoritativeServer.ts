/*
 * network/RoomAuthoritativeServer.ts
 *
 * Extends AuthoritativeServer to support multiple concurrent game rooms.
 * Each room gets its own Engine instance for isolated game state.
 *
 * Features:
 * - Room creation with shareable codes
 * - Room join/leave with password support
 * - Per-room state broadcasting
 * - Automatic cleanup when rooms empty
 */
import {
  AuthoritativeServer,
  AuthoritativeServerOptions,
  OutboundPrincipal,
} from "./AuthoritativeServer.js";
import { RoomManager, RoomConfig } from "./RoomManager.js";
import { Engine } from "../engine/Engine.js";

export interface RoomAuthoritativeServerOptions extends AuthoritativeServerOptions {
  /** Maximum rooms per server (default: 100) */
  maxRooms?: number;
  /** Room code length (default: 8, format XXXX-XXXX) */
  roomCodeLength?: number;
  /** Auto-delete empty rooms (default: true) */
  autoDeleteEmptyRooms?: boolean;
}

export interface RoomInfo {
  roomCode: string;
  engine: Engine;
  variant?: string;
  createdAt: number;
  createdBy: string;
}

/**
 * Generate a human-friendly room code
 * Uses characters that are unambiguous (no 0/O/1/I/L)
 */
function generateRoomCode(): string {
  const chars = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
  let code = "";
  for (let i = 0; i < 4; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  code += "-";
  for (let i = 0; i < 4; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return code;
}

/**
 * RoomAuthoritativeServer manages multiple game rooms, each with its own Engine.
 *
 * Events emitted (in addition to AuthoritativeServer events):
 * - 'room:created' - Room created
 * - 'room:joined' - Client joined room
 * - 'room:left' - Client left room
 * - 'room:deleted' - Room deleted
 */
export class RoomAuthoritativeServer extends AuthoritativeServer {
  roomManager: RoomManager;
  rooms: Map<string, RoomInfo> = new Map(); // roomCode → RoomInfo
  clientRooms: Map<string, string> = new Map(); // clientId → roomCode

  protected maxRooms: number;
  protected autoDeleteEmptyRooms: boolean;
  private checkedDispatchesByRoom: Map<string, number> = new Map();
  private dispatchQueuesByRoom: Map<string, Promise<void>> = new Map();

  /** Factory function to create an Engine for a new room */
  protected createRoomEngine: (roomCode: string, variant?: string) => Engine;

  /** Factory function to initialize a room's game state */
  protected initializeRoom?: (engine: Engine, roomCode: string, variant?: string) => Promise<void> | void;

  constructor(options: RoomAuthoritativeServerOptions = {}) {
    // Create a dummy engine for the base class - we'll use per-room engines
    const dummyEngine = new Engine();
    super(dummyEngine, options);

    this.maxRooms = options.maxRooms ?? 100;
    this.autoDeleteEmptyRooms = options.autoDeleteEmptyRooms ?? true;

    // Initialize room manager
    this.roomManager = new RoomManager({
      maxTotalRooms: this.maxRooms,
      autoDeleteEmpty: this.autoDeleteEmptyRooms,
    });

    // Default engine factory - subclasses should override
    this.createRoomEngine = () => new Engine();

    // Wire up room manager events
    this.roomManager.on("rooms:deleted", (evt) => {
      const { roomId } = evt.payload;
      this.rooms.delete(roomId);
      this.emit("room:deleted", { roomCode: roomId });
      if (this.verbose) {
        console.log(`[RoomAuthServer] Room deleted: ${roomId}`);
      }
    });

    // Disable base class auto-broadcast (we broadcast per-room)
    this.broadcastOnAction = false;
  }

  /**
   * Create a new game room
   */
  async createRoom(
    clientId: string,
    options: {
      variant?: string;
      password?: string;
      maxMembers?: number;
      isPrivate?: boolean;
    } = {}
  ): Promise<{ success: boolean; roomCode?: string; error?: string }> {
    // Check room limit
    if (this.rooms.size >= this.maxRooms) {
      return { success: false, error: "Server room limit reached" };
    }

    // Generate unique room code
    let roomCode: string;
    let attempts = 0;
    do {
      roomCode = generateRoomCode();
      attempts++;
    } while (this.rooms.has(roomCode) && attempts < 100);

    if (this.rooms.has(roomCode)) {
      return { success: false, error: "Could not generate unique room code" };
    }

    // Create room in RoomManager
    const roomConfig: Partial<RoomConfig> = {
      maxMembers: options.maxMembers ?? 2,
      password: options.password,
      isPrivate: options.isPrivate ?? false,
    };

    const room = this.roomManager.createRoom(roomCode, clientId, roomConfig);
    if (!room) {
      return { success: false, error: "Failed to create room" };
    }

    // Create engine for this room
    const engine = this.createRoomEngine(roomCode, options.variant);

    // Store room info
    const roomInfo: RoomInfo = {
      roomCode,
      engine,
      variant: options.variant,
      createdAt: Date.now(),
      createdBy: clientId,
    };
    this.rooms.set(roomCode, roomInfo);

    // Track client's room
    this.clientRooms.set(clientId, roomCode);

    // Initialize room game state
    if (this.initializeRoom) {
      await this.initializeRoom(engine, roomCode, options.variant);
    }

    // Wire up engine broadcasts for this room
    engine.on("engine:action", () => {
      if ((this.checkedDispatchesByRoom.get(roomCode) ?? 0) === 0) {
        this.broadcastToRoom(roomCode);
      }
    });

    this.emit("room:created", { roomCode, clientId, variant: options.variant });

    if (this.verbose) {
      console.log(`[RoomAuthServer] Room created: ${roomCode} by ${clientId.substring(0, 12)}...`);
    }

    return { success: true, roomCode };
  }

  /**
   * Join an existing room
   */
  joinRoom(
    clientId: string,
    roomCode: string,
    options: { password?: string } = {}
  ): { success: boolean; error?: string; playerIndex?: number } {
    if (typeof roomCode !== "string" || roomCode.length === 0 || roomCode.length > 64) {
      return { success: false, error: "Room request failed" };
    }
    // Normalize room code
    roomCode = roomCode.toUpperCase().trim();

    const roomInfo = this.rooms.get(roomCode);
    if (!roomInfo) {
      return { success: false, error: "Room not found" };
    }

    // Check if already in a room
    const currentRoom = this.clientRooms.get(clientId);
    if (currentRoom) {
      if (currentRoom === roomCode) {
        return { success: false, error: "Already in this room" };
      }
      // Leave current room first
      this.leaveRoom(clientId);
    }

    // Try to join via RoomManager
    const result = this.roomManager.joinRoom(roomCode, clientId, {
      password: options.password,
    });

    if (!result.success) {
      return { success: false, error: result.error };
    }

    // Track client's room
    this.clientRooms.set(clientId, roomCode);

    // Get player index from room state
    const state = roomInfo.engine._gameState as any;
    let playerIndex = -1;
    if (state?.players) {
      for (let i = 0; i < (state.numPlayers || 2); i++) {
        if (state.players[i] === clientId) {
          playerIndex = i;
          break;
        }
      }
    }

    this.emit("room:joined", { roomCode, clientId, playerIndex });

    if (this.verbose) {
      console.log(`[RoomAuthServer] Client ${clientId.substring(0, 12)}... joined room ${roomCode}`);
    }

    return { success: true, playerIndex };
  }

  /**
   * Leave current room
   */
  leaveRoom(clientId: string): boolean {
    const roomCode = this.clientRooms.get(clientId);
    if (!roomCode) {
      return false;
    }

    this.clientRooms.delete(clientId);
    this.roomManager.leaveRoom(roomCode, clientId);

    this.emit("room:left", { roomCode, clientId });

    if (this.verbose) {
      console.log(`[RoomAuthServer] Client ${clientId.substring(0, 12)}... left room ${roomCode}`);
    }

    return true;
  }

  /**
   * Get room info by code
   */
  getRoom(roomCode: string): RoomInfo | undefined {
    if (typeof roomCode !== "string") return undefined;
    return this.rooms.get(roomCode.toUpperCase().trim());
  }

  /**
   * Get client's current room
   */
  getClientRoom(clientId: string): RoomInfo | undefined {
    const roomCode = this.clientRooms.get(clientId);
    return roomCode ? this.rooms.get(roomCode) : undefined;
  }

  /**
   * List public rooms
   */
  listRooms(): Array<{
    roomCode: string;
    memberCount: number;
    maxMembers: number;
    variant?: string;
    hasPassword: boolean;
  }> {
    const publicRooms = this.roomManager.getRooms({ includePrivate: false });
    return publicRooms.map((room) => {
      const roomInfo = this.rooms.get(room.id);
      return {
        roomCode: room.id,
        memberCount: room.getMemberCount(),
        maxMembers: room.getConfig().maxMembers,
        variant: roomInfo?.variant,
        hasPassword: !!room.getConfig().password,
      };
    });
  }

  /**
   * Broadcast state to all members of a room
   */
  broadcastToRoom(roomCode: string): void {
    const room = this.roomManager.getRoom(roomCode);
    if (!room) return;

    const roomInfo = this.rooms.get(roomCode);
    if (!roomInfo) return;

    for (const memberId of room.getMemberIds()) {
      const client = this.clients.get(memberId);
      if (client && client.ws.readyState === 1) {
        // WebSocket.OPEN = 1
        this.sendToClient(memberId, {
          cmd: "state",
          roomCode,
          state: this.getStateForRoom(roomCode, memberId),
        }, "state:broadcast");
      }
    }
  }

  /**
   * Get state for a specific client in a room
   * Override in subclass for player-specific views
   */
  protected getStateForRoom(roomCode: string, _clientId: string): any {
    const roomInfo = this.rooms.get(roomCode);
    if (!roomInfo) return null;

    return {
      roomCode,
      historyLength: roomInfo.engine.history.length,
    };
  }

  /**
   * Override base class getStateForClient to be room-aware
   */
  protected override getStateForClient(clientId: string): any {
    const roomCode = this.clientRooms.get(clientId);
    if (!roomCode) {
      return { inRoom: false };
    }
    return this.getStateForRoom(roomCode, clientId);
  }

  /** Select the current room's raw history; the final policy projects entries. */
  protected override getHistoryForClient(clientId: string, fromIndex: number): any[] {
    const roomCode = this.clientRooms.get(clientId);
    const roomInfo = roomCode ? this.rooms.get(roomCode) : undefined;
    return roomInfo ? roomInfo.engine.history.slice(fromIndex) : [];
  }

  /** Add room/player context to the final outbound projection principal. */
  protected override getOutboundPrincipal(clientId: string): OutboundPrincipal {
    const roomCode = this.clientRooms.get(clientId);
    if (!roomCode) return { clientId };

    const state = this.rooms.get(roomCode)?.engine._gameState as any;
    let playerIndex: number | undefined;
    if (state?.players) {
      const index = Array.from({ length: state.numPlayers || 2 }, (_, i) => i)
        .find((i) => state.players[i] === clientId);
      if (index !== undefined) playerIndex = index;
    }

    return { clientId, roomCode, ...(playerIndex !== undefined ? { playerIndex } : {}) };
  }

  /**
   * Override handleDispatch to route actions to the correct room's engine
   */
  protected override async handleDispatch(
    clientId: string,
    type: string,
    payload: any,
    requestId?: string | number
  ): Promise<void> {
    const roomCode = this.clientRooms.get(clientId);
    if (!roomCode) {
      this.sendToClient(clientId, {
        cmd: "error",
        reason: "not-in-room",
        type,
        requestId,
      }, "dispatch:error");
      return;
    }

    const previous = this.dispatchQueuesByRoom.get(roomCode) ?? Promise.resolve();
    const queued = previous.then(() =>
      this.handleRoomDispatchSerial(roomCode, clientId, type, payload, requestId)
    );
    const continuation = queued.catch(() => undefined);
    this.dispatchQueuesByRoom.set(roomCode, continuation);
    try {
      await queued;
    } finally {
      if (this.dispatchQueuesByRoom.get(roomCode) === continuation) {
        this.dispatchQueuesByRoom.delete(roomCode);
      }
    }
  }

  private async handleRoomDispatchSerial(
    roomCode: string,
    clientId: string,
    type: string,
    payload: any,
    requestId?: string | number
  ): Promise<void> {
    if (this.clientRooms.get(clientId) !== roomCode) {
      this.sendToClient(clientId, {
        cmd: "error",
        reason: "not-in-room",
        type,
        requestId,
      }, "dispatch:error");
      return;
    }

    const roomInfo = this.rooms.get(roomCode);
    if (!roomInfo) {
      this.sendToClient(clientId, {
        cmd: "error",
        reason: "room-not-found",
        type,
        requestId,
      }, "dispatch:error");
      return;
    }

    // Validate via hook
    let accepted = false;
    try {
      accepted = this.beforeDispatch(clientId, type, payload);
    } catch (error) {
      this.reportRoomDispatchFailure(clientId, type, payload, requestId, error);
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

    const dispatchChecked = (roomInfo.engine as any).dispatchChecked;
    if (typeof dispatchChecked !== "function") {
      this.reportRoomDispatchFailure(
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
      this.checkedDispatchesByRoom.set(roomCode, 1);
      try {
        outcome = await dispatchChecked.call(roomInfo.engine, type, payload);
      } finally {
        this.checkedDispatchesByRoom.delete(roomCode);
      }
    } catch (error) {
      this.reportRoomDispatchFailure(clientId, type, payload, requestId, error);
      return;
    }

    if (!outcome || typeof outcome !== "object" || outcome.ok !== true) {
      this.reportRoomDispatchFailure(clientId, type, payload, requestId, outcome?.error);
      return;
    }

    try {
      this.afterDispatch(clientId, type, payload, outcome.result);
    } catch (error) {
      this.reportRoomPostCommitError("afterDispatch", clientId, type, error);
    }

    try {
      this.broadcastToRoom(roomCode);
    } catch (error) {
      this.reportRoomPostCommitError("broadcast", clientId, type, error);
    }

    this.sendToClient(clientId, {
      cmd: "dispatch:result",
      type,
      requestId,
    }, "dispatch:success");
  }

  private reportRoomDispatchFailure(
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
      if (this.verbose) console.error("[RoomAuthServer] onDispatchError hook failed:", hookError);
    }
    this.sendToClient(clientId, {
      cmd: "error",
      reason: "failed",
      type,
      requestId,
    }, "dispatch:error");
  }

  private reportRoomPostCommitError(stage: string, clientId: string, type: string, error: unknown): void {
    if (this.verbose) {
      console.error(`[RoomAuthServer] Post-commit ${stage} failed for ${clientId} (${type}):`, error);
    }
    try {
      this.emit("dispatch:postCommitError", { clientId, type, stage, error });
    } catch (listenerError) {
      if (this.verbose) console.error("[RoomAuthServer] Post-commit error listener failed:", listenerError);
    }
  }

  /**
   * Handle client disconnect - leave room and cleanup
   */
  protected override onClientDisconnect(clientId: string): void {
    super.onClientDisconnect(clientId);
    this.leaveRoom(clientId);
    this.roomManager.handlePeerDisconnect(clientId);
  }

  /**
   * Handle incoming messages - add room protocol support
   */
  protected async handleRoomMessage(
    clientId: string,
    msg: any
  ): Promise<{ handled: boolean; response?: any }> {
    if (!msg || typeof msg !== "object") return { handled: false };

    switch (msg.cmd) {
      case "room:create": {
        const validCreate =
          this.isOptionalBoundedString(msg.variant, 128) &&
          this.isOptionalBoundedString(msg.password, 1024) &&
          (msg.maxMembers === undefined ||
            (Number.isSafeInteger(msg.maxMembers) && msg.maxMembers > 0 && msg.maxMembers <= 1024)) &&
          (msg.isPrivate === undefined || typeof msg.isPrivate === "boolean");
        if (!validCreate) {
          this.sendMalformedRoomRequest(clientId, msg.requestId);
          return { handled: true };
        }

        const result = await this.createRoom(clientId, {
          variant: msg.variant,
          password: msg.password,
          maxMembers: msg.maxMembers,
          isPrivate: msg.isPrivate,
        });

        if (result.success) {
          this.sendToClient(clientId, {
            cmd: "room:created",
            roomCode: result.roomCode,
          }, "room:created");
        } else {
          this.sendToClient(clientId, {
            cmd: "room:error",
            message: result.error,
            requestId: msg.requestId,
          }, "room:error");
        }
        return { handled: true };
      }

      case "room:join": {
        if (
          typeof msg.roomCode !== "string" ||
          msg.roomCode.trim().length === 0 ||
          msg.roomCode.length > 64 ||
          !this.isOptionalBoundedString(msg.password, 1024)
        ) {
          this.sendMalformedRoomRequest(clientId, msg.requestId);
          return { handled: true };
        }

        const normalizedRoomCode = msg.roomCode.toUpperCase().trim();
        const result = this.joinRoom(clientId, normalizedRoomCode, {
          password: msg.password,
        });

        if (result.success) {
          const roomInfo = this.getRoom(normalizedRoomCode);
          this.sendToClient(clientId, {
            cmd: "room:joined",
            roomCode: normalizedRoomCode,
            playerIndex: result.playerIndex,
            state: roomInfo ? this.getStateForRoom(normalizedRoomCode, clientId) : null,
          }, "room:joined");
          // Broadcast to other room members
          this.broadcastToRoom(normalizedRoomCode);
        } else {
          this.sendToClient(clientId, {
            cmd: "room:error",
            message: result.error,
            requestId: msg.requestId,
          }, "room:error");
        }
        return { handled: true };
      }

      case "room:leave": {
        this.leaveRoom(clientId);
        this.sendToClient(clientId, { cmd: "room:left" }, "room:left");
        return { handled: true };
      }

      case "room:list": {
        const rooms = this.listRooms();
        this.sendToClient(clientId, {
          cmd: "room:list",
          rooms,
        }, "room:list");
        return { handled: true };
      }

      // Note: "dispatch" is handled by the overridden handleDispatch method

      default:
        return { handled: false };
    }
  }

  private isOptionalBoundedString(value: unknown, maxLength: number): boolean {
    return value === undefined || (typeof value === "string" && value.length <= maxLength);
  }

  private sendMalformedRoomRequest(clientId: string, requestId: unknown): void {
    this.sendToClient(clientId, {
      cmd: "room:error",
      message: "Room request failed",
      requestId,
    }, "room:error");
  }

  /**
   * Override start to set up room message handling
   */
  override async start(): Promise<void> {
    await super.start();

    // Override message handler to include room protocol
    this.on("message", (evt) => {
      const { clientId, message } = evt.payload;
      void this.handleRoomMessage(clientId, message).catch(() => {
        // Emitter listeners are not awaited. Always contain room-flow
        // rejections so malformed input cannot become an unhandled rejection.
        this.sendMalformedRoomRequest(clientId, message?.requestId);
      });
    });
  }

  /**
   * Get server statistics
   */
  getStats(): {
    totalRooms: number;
    totalClients: number;
    roomStats: ReturnType<RoomManager["getStats"]>;
  } {
    return {
      totalRooms: this.rooms.size,
      totalClients: this.clients.size,
      roomStats: this.roomManager.getStats(),
    };
  }
}

export default RoomAuthoritativeServer;
