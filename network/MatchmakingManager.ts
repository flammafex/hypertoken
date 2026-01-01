/*
 * network/MatchmakingManager.ts
 *
 * Manages matchmaking for finding games and opponents.
 * Supports queuing, skill-based matching, and game mode filtering.
 */

import { Emitter } from "../core/events.js";

/**
 * Player in the matchmaking queue
 */
export interface QueuedPlayer {
  peerId: string;
  gameMode: string;
  joinedAt: number;
  /** Skill rating for ranked matching (optional) */
  rating?: number;
  /** Custom matchmaking preferences */
  preferences?: Record<string, unknown>;
  /** Maximum acceptable rating difference (optional) */
  ratingTolerance?: number;
}

/**
 * Match result
 */
export interface Match {
  id: string;
  gameMode: string;
  players: string[];
  createdAt: number;
  /** Average rating of players (if applicable) */
  avgRating?: number;
}

/**
 * Matchmaking configuration
 */
export interface MatchmakingConfig {
  /** Minimum players for a match (default: 2) */
  minPlayers: number;
  /** Maximum players for a match (default: 2) */
  maxPlayers: number;
  /** Time in ms before expanding search criteria (default: 30s) */
  searchExpansionTime: number;
  /** Rating tolerance expansion per interval (default: 50) */
  ratingExpansionStep: number;
  /** Maximum rating tolerance (default: 500) */
  maxRatingTolerance: number;
  /** Queue timeout in ms (default: 5 minutes) */
  queueTimeout: number;
  /** Match check interval in ms (default: 1 second) */
  matchCheckInterval: number;
}

export const DEFAULT_MATCHMAKING_CONFIG: MatchmakingConfig = {
  minPlayers: 2,
  maxPlayers: 2,
  searchExpansionTime: 30000,
  ratingExpansionStep: 50,
  maxRatingTolerance: 500,
  queueTimeout: 5 * 60 * 1000,
  matchCheckInterval: 1000,
};

/**
 * Game mode specific configuration
 */
export interface GameModeConfig {
  name: string;
  minPlayers: number;
  maxPlayers: number;
  /** Whether this mode uses skill-based matching */
  ranked?: boolean;
}

/**
 * MatchmakingManager handles player queuing and match creation
 *
 * Events emitted:
 * - 'matchmaking:queued' - Player joined queue
 * - 'matchmaking:dequeued' - Player left queue
 * - 'matchmaking:matched' - Match found
 * - 'matchmaking:timeout' - Queue timeout
 * - 'matchmaking:cancelled' - Matchmaking cancelled
 */
export class MatchmakingManager extends Emitter {
  private config: MatchmakingConfig;
  private queues: Map<string, QueuedPlayer[]> = new Map();
  private gameModes: Map<string, GameModeConfig> = new Map();
  private matchCheckTimer: ReturnType<typeof setInterval> | null = null;
  private matchCounter: number = 0;

  constructor(config: Partial<MatchmakingConfig> = {}) {
    super();
    this.config = { ...DEFAULT_MATCHMAKING_CONFIG, ...config };
  }

  /**
   * Start the matchmaking service
   */
  start(): void {
    this.stopMatchChecking();
    this.matchCheckTimer = setInterval(
      () => this.checkForMatches(),
      this.config.matchCheckInterval
    );
  }

  /**
   * Stop the matchmaking service
   */
  stop(): void {
    this.stopMatchChecking();

    // Cancel all queued players
    for (const [gameMode, queue] of this.queues) {
      for (const player of queue) {
        this.emit("matchmaking:cancelled", {
          peerId: player.peerId,
          gameMode,
          reason: "service_stopped",
        });
      }
    }
    this.queues.clear();
  }

  /**
   * Register a game mode
   */
  registerGameMode(config: GameModeConfig): void {
    this.gameModes.set(config.name, config);
    this.queues.set(config.name, []);
  }

  /**
   * Unregister a game mode
   */
  unregisterGameMode(name: string): void {
    const queue = this.queues.get(name);
    if (queue) {
      for (const player of queue) {
        this.emit("matchmaking:cancelled", {
          peerId: player.peerId,
          gameMode: name,
          reason: "mode_removed",
        });
      }
    }
    this.gameModes.delete(name);
    this.queues.delete(name);
  }

  /**
   * Get available game modes
   */
  getGameModes(): GameModeConfig[] {
    return Array.from(this.gameModes.values());
  }

  /**
   * Join the matchmaking queue
   */
  joinQueue(
    peerId: string,
    gameMode: string,
    options?: {
      rating?: number;
      preferences?: Record<string, unknown>;
      ratingTolerance?: number;
    }
  ): boolean {
    // Check if game mode exists
    if (!this.queues.has(gameMode)) {
      console.warn(`[Matchmaking] Unknown game mode: ${gameMode}`);
      return false;
    }

    const queue = this.queues.get(gameMode)!;

    // Check if already in queue
    if (queue.some((p) => p.peerId === peerId)) {
      console.warn(`[Matchmaking] Player ${peerId} already in queue for ${gameMode}`);
      return false;
    }

    const player: QueuedPlayer = {
      peerId,
      gameMode,
      joinedAt: Date.now(),
      rating: options?.rating,
      preferences: options?.preferences,
      ratingTolerance: options?.ratingTolerance ?? this.config.maxRatingTolerance,
    };

    queue.push(player);

    this.emit("matchmaking:queued", {
      peerId,
      gameMode,
      queuePosition: queue.length,
      rating: player.rating,
    });

    return true;
  }

  /**
   * Leave the matchmaking queue
   */
  leaveQueue(peerId: string, gameMode?: string): boolean {
    let found = false;

    const modesToCheck = gameMode
      ? [gameMode]
      : Array.from(this.queues.keys());

    for (const mode of modesToCheck) {
      const queue = this.queues.get(mode);
      if (!queue) continue;

      const index = queue.findIndex((p) => p.peerId === peerId);
      if (index !== -1) {
        queue.splice(index, 1);
        found = true;

        this.emit("matchmaking:dequeued", {
          peerId,
          gameMode: mode,
          reason: "player_left",
        });
      }
    }

    return found;
  }

  /**
   * Handle player disconnect - remove from all queues
   */
  handlePlayerDisconnect(peerId: string): void {
    for (const [gameMode, queue] of this.queues) {
      const index = queue.findIndex((p) => p.peerId === peerId);
      if (index !== -1) {
        queue.splice(index, 1);
        this.emit("matchmaking:dequeued", {
          peerId,
          gameMode,
          reason: "disconnect",
        });
      }
    }
  }

  /**
   * Get queue status for a game mode
   */
  getQueueStatus(gameMode: string): {
    playersInQueue: number;
    estimatedWaitTime: number;
  } | null {
    const queue = this.queues.get(gameMode);
    const modeConfig = this.gameModes.get(gameMode);

    if (!queue || !modeConfig) {
      return null;
    }

    const playersInQueue = queue.length;
    const playersNeeded = modeConfig.minPlayers;

    // Rough estimate based on queue size
    const estimatedWaitTime =
      playersInQueue >= playersNeeded
        ? 0
        : Math.max(0, (playersNeeded - playersInQueue) * 10000); // ~10s per player needed

    return {
      playersInQueue,
      estimatedWaitTime,
    };
  }

  /**
   * Get player's queue position
   */
  getQueuePosition(peerId: string, gameMode: string): number | null {
    const queue = this.queues.get(gameMode);
    if (!queue) return null;

    const index = queue.findIndex((p) => p.peerId === peerId);
    return index === -1 ? null : index + 1;
  }

  /**
   * Check all queues for possible matches
   */
  private checkForMatches(): void {
    const now = Date.now();

    for (const [gameMode, queue] of this.queues) {
      if (queue.length === 0) continue;

      const modeConfig = this.gameModes.get(gameMode);
      if (!modeConfig) continue;

      // Remove timed-out players
      this.removeTimedOutPlayers(queue, gameMode);

      // Try to create matches
      this.tryCreateMatch(queue, modeConfig, now);
    }
  }

  /**
   * Remove players who have been waiting too long
   */
  private removeTimedOutPlayers(queue: QueuedPlayer[], gameMode: string): void {
    const now = Date.now();

    for (let i = queue.length - 1; i >= 0; i--) {
      const player = queue[i];
      if (now - player.joinedAt > this.config.queueTimeout) {
        queue.splice(i, 1);
        this.emit("matchmaking:timeout", {
          peerId: player.peerId,
          gameMode,
          waitTime: now - player.joinedAt,
        });
      }
    }
  }

  /**
   * Try to create a match from the queue
   */
  private tryCreateMatch(
    queue: QueuedPlayer[],
    modeConfig: GameModeConfig,
    now: number
  ): void {
    if (queue.length < modeConfig.minPlayers) {
      return;
    }

    // For non-ranked modes, just take the first N players
    if (!modeConfig.ranked) {
      const playersToMatch = queue.splice(0, modeConfig.maxPlayers);
      this.createMatch(modeConfig.name, playersToMatch);
      return;
    }

    // For ranked modes, try skill-based matching
    const matchedPlayers = this.findRankedMatch(queue, modeConfig, now);
    if (matchedPlayers) {
      // Remove matched players from queue
      for (const player of matchedPlayers) {
        const index = queue.indexOf(player);
        if (index !== -1) {
          queue.splice(index, 1);
        }
      }
      this.createMatch(modeConfig.name, matchedPlayers);
    }
  }

  /**
   * Find a skill-matched group of players
   */
  private findRankedMatch(
    queue: QueuedPlayer[],
    modeConfig: GameModeConfig,
    now: number
  ): QueuedPlayer[] | null {
    // Sort by rating
    const sorted = [...queue]
      .filter((p) => p.rating !== undefined)
      .sort((a, b) => (a.rating ?? 0) - (b.rating ?? 0));

    if (sorted.length < modeConfig.minPlayers) {
      // Not enough rated players, check if we can mix with unrated
      const unrated = queue.filter((p) => p.rating === undefined);
      if (sorted.length + unrated.length >= modeConfig.minPlayers) {
        // Mix rated and unrated players
        return [...sorted.slice(0, modeConfig.maxPlayers - unrated.length), ...unrated].slice(
          0,
          modeConfig.maxPlayers
        );
      }
      return null;
    }

    // Find the best group of adjacent players by rating
    for (let i = 0; i <= sorted.length - modeConfig.minPlayers; i++) {
      const group = sorted.slice(i, i + modeConfig.maxPlayers);

      // Check if all players in group are within tolerance
      const minRating = group[0].rating ?? 0;
      const maxRating = group[group.length - 1].rating ?? 0;
      const ratingSpread = maxRating - minRating;

      // Calculate effective tolerance based on wait time
      const oldestPlayer = group.reduce(
        (oldest, p) => (p.joinedAt < oldest.joinedAt ? p : oldest),
        group[0]
      );
      const waitTime = now - oldestPlayer.joinedAt;
      const expansions = Math.floor(waitTime / this.config.searchExpansionTime);
      const effectiveTolerance = Math.min(
        (oldestPlayer.ratingTolerance ?? this.config.maxRatingTolerance) +
          expansions * this.config.ratingExpansionStep,
        this.config.maxRatingTolerance
      );

      if (ratingSpread <= effectiveTolerance) {
        return group;
      }
    }

    return null;
  }

  /**
   * Create a match from a group of players
   */
  private createMatch(gameMode: string, players: QueuedPlayer[]): Match {
    this.matchCounter++;

    const match: Match = {
      id: `match-${Date.now().toString(36)}-${this.matchCounter}`,
      gameMode,
      players: players.map((p) => p.peerId),
      createdAt: Date.now(),
    };

    // Calculate average rating if all players have ratings
    const ratings = players.map((p) => p.rating).filter((r): r is number => r !== undefined);
    if (ratings.length === players.length) {
      match.avgRating = Math.round(ratings.reduce((a, b) => a + b, 0) / ratings.length);
    }

    this.emit("matchmaking:matched", {
      match,
      players: players.map((p) => ({
        peerId: p.peerId,
        rating: p.rating,
        waitTime: Date.now() - p.joinedAt,
      })),
    });

    return match;
  }

  /**
   * Stop the match checking timer
   */
  private stopMatchChecking(): void {
    if (this.matchCheckTimer) {
      clearInterval(this.matchCheckTimer);
      this.matchCheckTimer = null;
    }
  }

  /**
   * Get matchmaking statistics
   */
  getStats(): {
    totalQueued: number;
    queuesByMode: Record<string, number>;
    matchesCreated: number;
  } {
    const queuesByMode: Record<string, number> = {};
    let totalQueued = 0;

    for (const [mode, queue] of this.queues) {
      queuesByMode[mode] = queue.length;
      totalQueued += queue.length;
    }

    return {
      totalQueued,
      queuesByMode,
      matchesCreated: this.matchCounter,
    };
  }
}

export default MatchmakingManager;
