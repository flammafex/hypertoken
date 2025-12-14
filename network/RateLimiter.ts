/**
 * RateLimiter - WebSocket message rate limiting
 *
 * Tracks message rates per connection and enforces limits.
 * Designed for use with WebSocket servers where nginx handles
 * connection-level rate limiting, but message-level needs app support.
 */

export interface RateLimitConfig {
  /** Max messages per window (default: 100) */
  maxMessages: number;
  /** Time window in milliseconds (default: 1000 = 1 second) */
  windowMs: number;
  /** Action on limit exceeded: 'close' or 'drop' (default: 'close') */
  onExceeded: 'close' | 'drop';
}

export const DEFAULT_RATE_LIMIT: RateLimitConfig = {
  maxMessages: 100,
  windowMs: 1000,
  onExceeded: 'close',
};

interface ConnectionState {
  timestamps: number[];
  warned: boolean;
}

export class RateLimiter {
  private config: RateLimitConfig;
  private connections: Map<string, ConnectionState> = new Map();
  private cleanupInterval: NodeJS.Timeout | null = null;

  constructor(config: Partial<RateLimitConfig> = {}) {
    this.config = { ...DEFAULT_RATE_LIMIT, ...config };

    // Periodic cleanup of old connection data
    this.cleanupInterval = setInterval(() => this.cleanup(), 60000);
  }

  /**
   * Check if a message should be allowed for a connection.
   * Returns true if allowed, false if rate limited.
   */
  check(connectionId: string): boolean {
    const now = Date.now();
    const windowStart = now - this.config.windowMs;

    let state = this.connections.get(connectionId);
    if (!state) {
      state = { timestamps: [], warned: false };
      this.connections.set(connectionId, state);
    }

    // Remove timestamps outside the window
    state.timestamps = state.timestamps.filter(t => t > windowStart);

    // Check if limit exceeded
    if (state.timestamps.length >= this.config.maxMessages) {
      return false;
    }

    // Record this message
    state.timestamps.push(now);
    return true;
  }

  /**
   * Check if connection is approaching the limit (80%+).
   * Useful for sending warnings before hard cutoff.
   */
  isNearLimit(connectionId: string): boolean {
    const state = this.connections.get(connectionId);
    if (!state) return false;

    const threshold = Math.floor(this.config.maxMessages * 0.8);
    return state.timestamps.length >= threshold;
  }

  /**
   * Get current message count for a connection within the window.
   */
  getCount(connectionId: string): number {
    const state = this.connections.get(connectionId);
    if (!state) return 0;

    const now = Date.now();
    const windowStart = now - this.config.windowMs;
    return state.timestamps.filter(t => t > windowStart).length;
  }

  /**
   * Remove tracking for a disconnected client.
   */
  remove(connectionId: string): void {
    this.connections.delete(connectionId);
  }

  /**
   * Clean up old connection data.
   */
  private cleanup(): void {
    const now = Date.now();
    const windowStart = now - this.config.windowMs;

    for (const [id, state] of this.connections) {
      // Remove timestamps outside window
      state.timestamps = state.timestamps.filter(t => t > windowStart);

      // Remove connection if no recent activity
      if (state.timestamps.length === 0) {
        this.connections.delete(id);
      }
    }
  }

  /**
   * Stop the cleanup interval (call on server shutdown).
   */
  destroy(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }
    this.connections.clear();
  }

  /**
   * Get stats for monitoring.
   */
  getStats(): { connections: number; config: RateLimitConfig } {
    return {
      connections: this.connections.size,
      config: this.config,
    };
  }
}
