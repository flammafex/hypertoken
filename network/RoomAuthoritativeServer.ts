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
import { AuthoritativeServer, AuthoritativeServerOptions } from "./AuthoritativeServer.js";
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
      this.broadcastToRoom(roomCode);
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
    const state = roomInfo.engine._gameState;
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
        });
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
      _gameState: roomInfo.engine._gameState,
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

  /**
   * Override handleDispatch to route actions to the correct room's engine
   */
  protected override async handleDispatch(clientId: string, type: string, payload: any): Promise<void> {
    // Find client's room
    const roomCode = this.clientRooms.get(clientId);
    if (!roomCode) {
      this.sendToClient(clientId, {
        cmd: "error",
        message: "Not in a room",
        type,
      });
      return;
    }

    const roomInfo = this.rooms.get(roomCode);
    if (!roomInfo) {
      this.sendToClient(clientId, {
        cmd: "error",
        message: "Room not found",
        type,
      });
      return;
    }

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
      // Dispatch to room's engine (not the base dummy engine)
      const result = await roomInfo.engine.dispatch(type, payload);

      // Notify subclass
      this.afterDispatch(clientId, type, payload, result);

      // Broadcast to room (engine:action event handles this via listener set up in createRoom)
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      this.sendToClient(clientId, {
        cmd: "error",
        message: err.message,
        type,
      });
      // Still broadcast to keep clients in sync
      this.broadcastToRoom(roomCode);
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
    switch (msg.cmd) {
      case "room:create": {
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
          });
        } else {
          this.sendToClient(clientId, {
            cmd: "room:error",
            message: result.error,
          });
        }
        return { handled: true };
      }

      case "room:join": {
        const result = this.joinRoom(clientId, msg.roomCode, {
          password: msg.password,
        });

        if (result.success) {
          const roomInfo = this.getRoom(msg.roomCode);
          this.sendToClient(clientId, {
            cmd: "room:joined",
            roomCode: msg.roomCode.toUpperCase().trim(),
            playerIndex: result.playerIndex,
            state: roomInfo ? this.getStateForRoom(msg.roomCode, clientId) : null,
          });
          // Broadcast to other room members
          this.broadcastToRoom(msg.roomCode.toUpperCase().trim());
        } else {
          this.sendToClient(clientId, {
            cmd: "room:error",
            message: result.error,
          });
        }
        return { handled: true };
      }

      case "room:leave": {
        this.leaveRoom(clientId);
        this.sendToClient(clientId, { cmd: "room:left" });
        return { handled: true };
      }

      case "room:list": {
        const rooms = this.listRooms();
        this.sendToClient(clientId, {
          cmd: "room:list",
          rooms,
        });
        return { handled: true };
      }

      // Note: "dispatch" is handled by the overridden handleDispatch method

      default:
        return { handled: false };
    }
  }

  /**
   * Override start to set up room message handling
   */
  override async start(): Promise<void> {
    await super.start();

    // Override message handler to include room protocol
    this.on("message", async (evt) => {
      const { clientId, message } = evt.payload;
      await this.handleRoomMessage(clientId, message);
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
