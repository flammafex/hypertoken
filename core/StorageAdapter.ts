/**
 * core/StorageAdapter.ts
 *
 * Storage adapter interface for persisting HyperToken game state.
 *
 * The Engine's Chronicle (Automerge CRDT) can be serialized to binary
 * (Uint8Array) or base64 string. A StorageAdapter provides a consistent
 * API for saving/loading this state to different backends:
 *
 * - IndexedDBAdapter (browser) — survives page refresh, works offline
 * - FilesystemAdapter (Node.js) — save to disk, resume across restarts
 * - MemoryAdapter (testing) — in-memory storage for tests
 *
 * Usage:
 *   import { FilesystemAdapter } from './storage/FilesystemAdapter.js';
 *
 *   const adapter = new FilesystemAdapter({ dir: './saves' });
 *   await engine.persist(adapter, 'my-game');
 *   await engine.resume(adapter, 'my-game');
 */

/**
 * Metadata about a saved game.
 */
export interface SaveMetadata {
  /** Unique name for this save */
  name: string;
  /** Timestamp when saved (ms since epoch) */
  timestamp: number;
  /** HyperToken version that created this save */
  version: string;
  /** Optional description */
  description?: string;
  /** Size of the save data in bytes */
  size: number;
}

/**
 * A saved game state.
 */
export interface SavedGame {
  metadata: SaveMetadata;
  /** Base64-encoded Automerge document */
  data: string;
}

/**
 * Storage adapter interface for persisting game state.
 *
 * Implementations:
 * - IndexedDBAdapter (browser)
 * - FilesystemAdapter (Node.js)
 * - MemoryAdapter (testing)
 */
export interface StorageAdapter {
  /**
   * Save game state.
   * @param name - Unique name for this save
   * @param data - Base64-encoded Automerge document
   * @param description - Optional description
   */
  save(name: string, data: string, description?: string): Promise<void>;

  /**
   * Load game state.
   * @param name - Name of the save to load
   * @returns The saved game, or null if not found
   */
  load(name: string): Promise<SavedGame | null>;

  /**
   * Delete a saved game.
   * @param name - Name of the save to delete
   */
  delete(name: string): Promise<void>;

  /**
   * List all saved games.
   * @returns Array of save metadata, sorted by timestamp (newest first)
   */
  list(): Promise<SaveMetadata[]>;
}

/**
 * Current HyperToken version for save compatibility.
 */
export const STORAGE_VERSION = '1.0.0';
