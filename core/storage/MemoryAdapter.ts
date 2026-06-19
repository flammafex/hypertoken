/**
 * core/storage/MemoryAdapter.ts
 *
 * In-memory storage adapter for testing.
 * Saves are stored in a Map — cleared when the process exits.
 */
import type { StorageAdapter, SavedGame, SaveMetadata } from "../StorageAdapter.js";
import { STORAGE_VERSION } from "../StorageAdapter.js";

export class MemoryAdapter implements StorageAdapter {
  private saves: Map<string, SavedGame> = new Map();

  async save(name: string, data: string, description?: string): Promise<void> {
    const metadata: SaveMetadata = {
      name,
      timestamp: Date.now(),
      version: STORAGE_VERSION,
      description,
      size: data.length,
    };
    this.saves.set(name, { metadata, data });
  }

  async load(name: string): Promise<SavedGame | null> {
    return this.saves.get(name) ?? null;
  }

  async delete(name: string): Promise<void> {
    this.saves.delete(name);
  }

  async list(): Promise<SaveMetadata[]> {
    const saves = Array.from(this.saves.values());
    saves.sort((a, b) => b.metadata.timestamp - a.metadata.timestamp);
    return saves.map((s) => s.metadata);
  }

  /** Clear all saves (for testing) */
  clear(): void {
    this.saves.clear();
  }
}
