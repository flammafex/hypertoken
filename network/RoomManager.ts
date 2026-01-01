/*
 * network/RoomManager.ts
 *
 * Manages logical groupings (rooms/channels) of peers.
 * Allows partitioning peers for different games, lobbies, etc.
 */

import { Emitter } from "../core/events.js";

/**
 * Room member information
 */
export interface RoomMember {
  peerId: string;
  joinedAt: number;
  metadata?: Record<string, unknown>;
}

/**
 * Room configuration
 */
export interface RoomConfig {
  /** Maximum number of members (default: Infinity) */
  maxMembers: number;
  /** Room password (optional) */
  password?: string;
  /** Whether room is private/hidden (default: false) */
  isPrivate: boolean;
  /** Custom room metadata */
  metadata?: Record<string, unknown>;
}

export const DEFAULT_ROOM_CONFIG: RoomConfig = {
  maxMembers: Infinity,
  isPrivate: false,
};

/**
 * Represents a room/channel
 */
export class Room extends Emitter {
  readonly id: string;
  readonly createdAt: number;
  readonly createdBy: string;
  private members: Map<string, RoomMember> = new Map();
  private config: RoomConfig;

  constructor(id: string, createdBy: string, config: Partial<RoomConfig> = {}) {
    super();
    this.id = id;
    this.createdBy = createdBy;
    this.createdAt = Date.now();
    this.config = { ...DEFAULT_ROOM_CONFIG, ...config };
  }

  /**
   * Get room configuration
   */
  getConfig(): RoomConfig {
    return { ...this.config };
  }

  /**
   * Update room configuration
   */
  updateConfig(config: Partial<RoomConfig>): void {
    this.config = { ...this.config, ...config };
    this.emit("room:config:updated", { roomId: this.id, config: this.config });
  }

  /**
   * Get member count
   */
  getMemberCount(): number {
    return this.members.size;
  }

  /**
   * Get all member IDs
   */
  getMemberIds(): string[] {
    return Array.from(this.members.keys());
  }

  /**
   * Get all members
   */
  getMembers(): RoomMember[] {
    return Array.from(this.members.values());
  }

  /**
   * Check if a peer is a member
   */
  hasMember(peerId: string): boolean {
    return this.members.has(peerId);
  }

  /**
   * Get a specific member
   */
  getMember(peerId: string): RoomMember | undefined {
    return this.members.get(peerId);
  }

  /**
   * Check if room is full
   */
  isFull(): boolean {
    return this.members.size >= this.config.maxMembers;
  }

  /**
   * Add a member to the room
   */
  addMember(peerId: string, metadata?: Record<string, unknown>): boolean {
    if (this.members.has(peerId)) {
      return false; // Already a member
    }

    if (this.isFull()) {
      return false; // Room is full
    }

    const member: RoomMember = {
      peerId,
      joinedAt: Date.now(),
      metadata,
    };

    this.members.set(peerId, member);
    this.emit("room:member:joined", { roomId: this.id, member });

    return true;
  }

  /**
   * Remove a member from the room
   */
  removeMember(peerId: string): boolean {
    const member = this.members.get(peerId);
    if (!member) {
      return false;
    }

    this.members.delete(peerId);
    this.emit("room:member:left", { roomId: this.id, member });

    return true;
  }

  /**
   * Update member metadata
   */
  updateMemberMetadata(peerId: string, metadata: Record<string, unknown>): boolean {
    const member = this.members.get(peerId);
    if (!member) {
      return false;
    }

    member.metadata = { ...member.metadata, ...metadata };
    this.emit("room:member:updated", { roomId: this.id, member });

    return true;
  }

  /**
   * Check password (returns true if no password or password matches)
   */
  checkPassword(password?: string): boolean {
    if (!this.config.password) {
      return true;
    }
    return this.config.password === password;
  }

  /**
   * Get room info (safe to share publicly)
   */
  getInfo(): {
    id: string;
    createdAt: number;
    createdBy: string;
    memberCount: number;
    maxMembers: number;
    isPrivate: boolean;
    hasPassword: boolean;
    metadata?: Record<string, unknown>;
  } {
    return {
      id: this.id,
      createdAt: this.createdAt,
      createdBy: this.createdBy,
      memberCount: this.members.size,
      maxMembers: this.config.maxMembers,
      isPrivate: this.config.isPrivate,
      hasPassword: !!this.config.password,
      metadata: this.config.metadata,
    };
  }
}

/**
 * Room manager configuration
 */
export interface RoomManagerConfig {
  /** Maximum rooms per peer (default: 10) */
  maxRoomsPerPeer: number;
  /** Maximum total rooms (default: 1000) */
  maxTotalRooms: number;
  /** Auto-delete empty rooms (default: true) */
  autoDeleteEmpty: boolean;
  /** Room name validation regex */
  roomIdPattern?: RegExp;
}

export const DEFAULT_ROOM_MANAGER_CONFIG: RoomManagerConfig = {
  maxRoomsPerPeer: 10,
  maxTotalRooms: 1000,
  autoDeleteEmpty: true,
};

/**
 * RoomManager manages all rooms
 *
 * Events emitted:
 * - 'rooms:created' - Room created
 * - 'rooms:deleted' - Room deleted
 * - 'rooms:joined' - Peer joined a room
 * - 'rooms:left' - Peer left a room
 * - 'rooms:message' - Message sent to room
 */
export class RoomManager extends Emitter {
  private rooms: Map<string, Room> = new Map();
  private peerRooms: Map<string, Set<string>> = new Map();
  private config: RoomManagerConfig;

  constructor(config: Partial<RoomManagerConfig> = {}) {
    super();
    this.config = { ...DEFAULT_ROOM_MANAGER_CONFIG, ...config };
  }

  /**
   * Create a new room
   */
  createRoom(
    roomId: string,
    createdBy: string,
    config: Partial<RoomConfig> = {}
  ): Room | null {
    // Validate room ID
    if (this.config.roomIdPattern && !this.config.roomIdPattern.test(roomId)) {
      console.warn(`[RoomManager] Invalid room ID: ${roomId}`);
      return null;
    }

    // Check if room exists
    if (this.rooms.has(roomId)) {
      console.warn(`[RoomManager] Room already exists: ${roomId}`);
      return null;
    }

    // Check total room limit
    if (this.rooms.size >= this.config.maxTotalRooms) {
      console.warn(`[RoomManager] Max room limit reached: ${this.config.maxTotalRooms}`);
      return null;
    }

    // Check peer room limit
    const peerRoomCount = this.peerRooms.get(createdBy)?.size || 0;
    if (peerRoomCount >= this.config.maxRoomsPerPeer) {
      console.warn(`[RoomManager] Peer ${createdBy} has reached room limit`);
      return null;
    }

    const room = new Room(roomId, createdBy, config);

    // Setup room event forwarding
    room.on("room:member:joined", (evt) => {
      const { member } = evt.payload;
      this.trackPeerRoom(member.peerId, roomId);
      this.emit("rooms:joined", { roomId, peerId: member.peerId });
    });

    room.on("room:member:left", (evt) => {
      const { member } = evt.payload;
      this.untrackPeerRoom(member.peerId, roomId);
      this.emit("rooms:left", { roomId, peerId: member.peerId });

      // Auto-delete empty rooms
      if (this.config.autoDeleteEmpty && room.getMemberCount() === 0) {
        this.deleteRoom(roomId);
      }
    });

    this.rooms.set(roomId, room);

    // Creator joins the room
    room.addMember(createdBy);

    this.emit("rooms:created", { roomId, createdBy, config: room.getConfig() });

    return room;
  }

  /**
   * Delete a room
   */
  deleteRoom(roomId: string): boolean {
    const room = this.rooms.get(roomId);
    if (!room) {
      return false;
    }

    // Remove all members from tracking
    for (const memberId of room.getMemberIds()) {
      this.untrackPeerRoom(memberId, roomId);
    }

    this.rooms.delete(roomId);
    this.emit("rooms:deleted", { roomId });

    return true;
  }

  /**
   * Get a room by ID
   */
  getRoom(roomId: string): Room | undefined {
    return this.rooms.get(roomId);
  }

  /**
   * Get all rooms (optionally filtered)
   */
  getRooms(options?: { includePrivate?: boolean }): Room[] {
    const rooms = Array.from(this.rooms.values());

    if (!options?.includePrivate) {
      return rooms.filter((r) => !r.getConfig().isPrivate);
    }

    return rooms;
  }

  /**
   * Get rooms a peer is in
   */
  getPeerRooms(peerId: string): Room[] {
    const roomIds = this.peerRooms.get(peerId);
    if (!roomIds) {
      return [];
    }

    return Array.from(roomIds)
      .map((id) => this.rooms.get(id))
      .filter((r): r is Room => r !== undefined);
  }

  /**
   * Join a room
   */
  joinRoom(
    roomId: string,
    peerId: string,
    options?: { password?: string; metadata?: Record<string, unknown> }
  ): { success: boolean; error?: string } {
    const room = this.rooms.get(roomId);

    if (!room) {
      return { success: false, error: "Room not found" };
    }

    if (room.hasMember(peerId)) {
      return { success: false, error: "Already in room" };
    }

    if (room.isFull()) {
      return { success: false, error: "Room is full" };
    }

    if (!room.checkPassword(options?.password)) {
      return { success: false, error: "Invalid password" };
    }

    // Check peer room limit
    const peerRoomCount = this.peerRooms.get(peerId)?.size || 0;
    if (peerRoomCount >= this.config.maxRoomsPerPeer) {
      return { success: false, error: "Room limit reached" };
    }

    const added = room.addMember(peerId, options?.metadata);
    if (!added) {
      return { success: false, error: "Failed to join room" };
    }

    return { success: true };
  }

  /**
   * Leave a room
   */
  leaveRoom(roomId: string, peerId: string): boolean {
    const room = this.rooms.get(roomId);
    if (!room) {
      return false;
    }

    return room.removeMember(peerId);
  }

  /**
   * Handle peer disconnection - remove from all rooms
   */
  handlePeerDisconnect(peerId: string): void {
    const roomIds = this.peerRooms.get(peerId);
    if (!roomIds) {
      return;
    }

    for (const roomId of Array.from(roomIds)) {
      this.leaveRoom(roomId, peerId);
    }
  }

  /**
   * Send a message to a room
   */
  broadcastToRoom(
    roomId: string,
    message: { type: string; payload: unknown },
    excludePeerId?: string
  ): string[] {
    const room = this.rooms.get(roomId);
    if (!room) {
      return [];
    }

    const recipients = room
      .getMemberIds()
      .filter((id) => id !== excludePeerId);

    this.emit("rooms:message", {
      roomId,
      message,
      recipients,
      sender: excludePeerId,
    });

    return recipients;
  }

  /**
   * Get room statistics
   */
  getStats(): {
    totalRooms: number;
    totalMembers: number;
    roomsBySize: Record<string, number>;
  } {
    const roomsBySize: Record<string, number> = {};
    let totalMembers = 0;

    for (const room of this.rooms.values()) {
      const size = room.getMemberCount();
      totalMembers += size;

      const sizeKey = size <= 2 ? size.toString() : size <= 5 ? "3-5" : size <= 10 ? "6-10" : "10+";
      roomsBySize[sizeKey] = (roomsBySize[sizeKey] || 0) + 1;
    }

    return {
      totalRooms: this.rooms.size,
      totalMembers,
      roomsBySize,
    };
  }

  /**
   * Track peer's room membership
   */
  private trackPeerRoom(peerId: string, roomId: string): void {
    let rooms = this.peerRooms.get(peerId);
    if (!rooms) {
      rooms = new Set();
      this.peerRooms.set(peerId, rooms);
    }
    rooms.add(roomId);
  }

  /**
   * Untrack peer's room membership
   */
  private untrackPeerRoom(peerId: string, roomId: string): void {
    const rooms = this.peerRooms.get(peerId);
    if (rooms) {
      rooms.delete(roomId);
      if (rooms.size === 0) {
        this.peerRooms.delete(peerId);
      }
    }
  }
}

export default RoomManager;
