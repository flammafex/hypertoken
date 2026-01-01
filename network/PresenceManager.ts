/*
 * network/PresenceManager.ts
 *
 * Manages peer presence information - who's online and their status.
 * Provides real-time presence updates and activity tracking.
 */

import { Emitter } from "../core/events.js";

/**
 * Presence status values
 */
export enum PresenceStatus {
  Online = "online",
  Away = "away",
  Busy = "busy",
  InGame = "in_game",
  Offline = "offline",
}

/**
 * Presence information for a peer
 */
export interface PresenceInfo {
  peerId: string;
  status: PresenceStatus;
  lastSeen: number;
  lastActive: number;
  customStatus?: string;
  metadata?: Record<string, unknown>;
}

/**
 * Presence update event
 */
export interface PresenceUpdate {
  peerId: string;
  status: PresenceStatus;
  previousStatus?: PresenceStatus;
  customStatus?: string;
  metadata?: Record<string, unknown>;
}

/**
 * Configuration for PresenceManager
 */
export interface PresenceConfig {
  /** Time in ms before a peer is considered away (default: 5 minutes) */
  awayTimeout: number;
  /** Time in ms before a peer is considered offline (default: 15 minutes) */
  offlineTimeout: number;
  /** Heartbeat interval in ms (default: 30 seconds) */
  heartbeatInterval: number;
  /** Enable automatic away detection (default: true) */
  autoAway: boolean;
}

export const DEFAULT_PRESENCE_CONFIG: PresenceConfig = {
  awayTimeout: 5 * 60 * 1000, // 5 minutes
  offlineTimeout: 15 * 60 * 1000, // 15 minutes
  heartbeatInterval: 30 * 1000, // 30 seconds
  autoAway: true,
};

/**
 * PresenceManager tracks and broadcasts peer presence
 *
 * Events emitted:
 * - 'presence:update' - Peer presence changed
 * - 'presence:online' - Peer came online
 * - 'presence:offline' - Peer went offline
 * - 'presence:activity' - Peer activity detected
 */
export class PresenceManager extends Emitter {
  private config: PresenceConfig;
  private presenceMap: Map<string, PresenceInfo> = new Map();
  private localPeerId: string | null = null;
  private localStatus: PresenceStatus = PresenceStatus.Online;
  private localCustomStatus?: string;
  private localMetadata?: Record<string, unknown>;
  private heartbeatTimer: ReturnType<typeof setInterval> | null = null;
  private activityCheckTimer: ReturnType<typeof setInterval> | null = null;

  constructor(config: Partial<PresenceConfig> = {}) {
    super();
    this.config = { ...DEFAULT_PRESENCE_CONFIG, ...config };
  }

  /**
   * Initialize presence for the local peer
   */
  initialize(peerId: string): void {
    this.localPeerId = peerId;

    // Set local presence
    this.updatePresence(peerId, {
      status: this.localStatus,
      customStatus: this.localCustomStatus,
      metadata: this.localMetadata,
    });

    // Start heartbeat
    this.startHeartbeat();

    // Start activity checking
    if (this.config.autoAway) {
      this.startActivityCheck();
    }
  }

  /**
   * Shutdown the presence manager
   */
  shutdown(): void {
    this.stopHeartbeat();
    this.stopActivityCheck();

    if (this.localPeerId) {
      this.setOffline(this.localPeerId);
    }
  }

  /**
   * Set the local peer's status
   */
  setStatus(status: PresenceStatus, customStatus?: string): void {
    if (!this.localPeerId) return;

    this.localStatus = status;
    this.localCustomStatus = customStatus;

    this.updatePresence(this.localPeerId, {
      status,
      customStatus,
      metadata: this.localMetadata,
    });
  }

  /**
   * Set the local peer's custom metadata
   */
  setMetadata(metadata: Record<string, unknown>): void {
    if (!this.localPeerId) return;

    this.localMetadata = metadata;

    this.updatePresence(this.localPeerId, {
      status: this.localStatus,
      customStatus: this.localCustomStatus,
      metadata,
    });
  }

  /**
   * Record local activity (resets away timer)
   */
  recordActivity(): void {
    if (!this.localPeerId) return;

    const info = this.presenceMap.get(this.localPeerId);
    if (info) {
      info.lastActive = Date.now();

      // If was away, come back online
      if (info.status === PresenceStatus.Away) {
        this.setStatus(PresenceStatus.Online, this.localCustomStatus);
      }
    }

    this.emit("presence:activity", { peerId: this.localPeerId });
  }

  /**
   * Update presence for any peer
   */
  updatePresence(peerId: string, update: Omit<PresenceUpdate, "peerId" | "previousStatus">): void {
    const existing = this.presenceMap.get(peerId);
    const previousStatus = existing?.status;

    const now = Date.now();
    const info: PresenceInfo = {
      peerId,
      status: update.status,
      lastSeen: now,
      lastActive: now,
      customStatus: update.customStatus,
      metadata: update.metadata,
    };

    this.presenceMap.set(peerId, info);

    // Emit presence update
    this.emit("presence:update", {
      peerId,
      status: update.status,
      previousStatus,
      customStatus: update.customStatus,
      metadata: update.metadata,
    });

    // Emit specific events
    if (!previousStatus || previousStatus === PresenceStatus.Offline) {
      if (update.status !== PresenceStatus.Offline) {
        this.emit("presence:online", { peerId, status: update.status });
      }
    } else if (update.status === PresenceStatus.Offline) {
      this.emit("presence:offline", { peerId });
    }
  }

  /**
   * Handle a received presence update from network
   */
  handlePresenceUpdate(update: PresenceUpdate): void {
    this.updatePresence(update.peerId, update);
  }

  /**
   * Mark a peer as offline
   */
  setOffline(peerId: string): void {
    this.updatePresence(peerId, { status: PresenceStatus.Offline });
  }

  /**
   * Remove a peer from presence tracking
   */
  removePeer(peerId: string): void {
    this.presenceMap.delete(peerId);
  }

  /**
   * Get presence info for a peer
   */
  getPresence(peerId: string): PresenceInfo | undefined {
    return this.presenceMap.get(peerId);
  }

  /**
   * Get all presence info
   */
  getAllPresence(): PresenceInfo[] {
    return Array.from(this.presenceMap.values());
  }

  /**
   * Get peers with a specific status
   */
  getPeersByStatus(status: PresenceStatus): string[] {
    return Array.from(this.presenceMap.entries())
      .filter(([_, info]) => info.status === status)
      .map(([peerId]) => peerId);
  }

  /**
   * Get online peers (online, away, busy, in_game)
   */
  getOnlinePeers(): string[] {
    return Array.from(this.presenceMap.entries())
      .filter(([_, info]) => info.status !== PresenceStatus.Offline)
      .map(([peerId]) => peerId);
  }

  /**
   * Check if a peer is online
   */
  isOnline(peerId: string): boolean {
    const info = this.presenceMap.get(peerId);
    return info !== undefined && info.status !== PresenceStatus.Offline;
  }

  /**
   * Create a presence update message to broadcast
   */
  createPresenceMessage(): PresenceUpdate {
    return {
      peerId: this.localPeerId!,
      status: this.localStatus,
      customStatus: this.localCustomStatus,
      metadata: this.localMetadata,
    };
  }

  /**
   * Get presence statistics
   */
  getStats(): {
    total: number;
    online: number;
    away: number;
    busy: number;
    inGame: number;
    offline: number;
  } {
    let online = 0;
    let away = 0;
    let busy = 0;
    let inGame = 0;
    let offline = 0;

    for (const info of this.presenceMap.values()) {
      switch (info.status) {
        case PresenceStatus.Online:
          online++;
          break;
        case PresenceStatus.Away:
          away++;
          break;
        case PresenceStatus.Busy:
          busy++;
          break;
        case PresenceStatus.InGame:
          inGame++;
          break;
        case PresenceStatus.Offline:
          offline++;
          break;
      }
    }

    return {
      total: this.presenceMap.size,
      online,
      away,
      busy,
      inGame,
      offline,
    };
  }

  /**
   * Start the heartbeat timer
   */
  private startHeartbeat(): void {
    this.stopHeartbeat();

    this.heartbeatTimer = setInterval(() => {
      if (this.localPeerId) {
        const info = this.presenceMap.get(this.localPeerId);
        if (info) {
          info.lastSeen = Date.now();
        }

        // Emit heartbeat for network broadcast
        this.emit("presence:heartbeat", {
          peerId: this.localPeerId,
          status: this.localStatus,
        });
      }
    }, this.config.heartbeatInterval);
  }

  /**
   * Stop the heartbeat timer
   */
  private stopHeartbeat(): void {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
  }

  /**
   * Start the activity check timer
   */
  private startActivityCheck(): void {
    this.stopActivityCheck();

    this.activityCheckTimer = setInterval(() => {
      this.checkActivity();
    }, 60000); // Check every minute
  }

  /**
   * Stop the activity check timer
   */
  private stopActivityCheck(): void {
    if (this.activityCheckTimer) {
      clearInterval(this.activityCheckTimer);
      this.activityCheckTimer = null;
    }
  }

  /**
   * Check activity and update status
   */
  private checkActivity(): void {
    const now = Date.now();

    for (const [peerId, info] of this.presenceMap) {
      if (info.status === PresenceStatus.Offline) continue;

      const timeSinceActive = now - info.lastActive;
      const timeSinceSeen = now - info.lastSeen;

      // Check for offline (no heartbeat)
      if (timeSinceSeen > this.config.offlineTimeout) {
        if (peerId !== this.localPeerId) {
          this.setOffline(peerId);
        }
        continue;
      }

      // Check for auto-away (only for local peer)
      if (peerId === this.localPeerId && this.config.autoAway) {
        if (
          timeSinceActive > this.config.awayTimeout &&
          info.status === PresenceStatus.Online
        ) {
          this.setStatus(PresenceStatus.Away, this.localCustomStatus);
        }
      }
    }
  }
}

export default PresenceManager;
