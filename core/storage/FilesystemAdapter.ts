/**
 * core/storage/FilesystemAdapter.ts
 *
 * Filesystem storage adapter for Node.js.
 * Saves game state as JSON files in a directory.
 */
import { readFileSync, writeFileSync, existsSync, unlinkSync, readdirSync, mkdirSync } from "fs";
import { join, basename } from "path";
import type { StorageAdapter, SavedGame, SaveMetadata } from "../StorageAdapter.js";
import { STORAGE_VERSION } from "../StorageAdapter.js";

export interface FilesystemAdapterOptions {
  /** Directory for save files (default: './saves') */
  dir?: string;
}

export class FilesystemAdapter implements StorageAdapter {
  private dir: string;

  constructor(options: FilesystemAdapterOptions = {}) {
    this.dir = options.dir ?? "./saves";
    // Ensure directory exists
    if (!existsSync(this.dir)) {
      mkdirSync(this.dir, { recursive: true });
    }
  }

  async save(name: string, data: string, description?: string): Promise<void> {
    const metadata: SaveMetadata = {
      name,
      timestamp: Date.now(),
      version: STORAGE_VERSION,
      description,
      size: data.length,
    };

    const savedGame: SavedGame = { metadata, data };
    const filepath = join(this.dir, `${name}.json`);
    writeFileSync(filepath, JSON.stringify(savedGame), "utf-8");
  }

  async load(name: string): Promise<SavedGame | null> {
    const filepath = join(this.dir, `${name}.json`);
    if (!existsSync(filepath)) return null;

    const raw = readFileSync(filepath, "utf-8");
    return JSON.parse(raw) as SavedGame;
  }

  async delete(name: string): Promise<void> {
    const filepath = join(this.dir, `${name}.json`);
    if (existsSync(filepath)) {
      unlinkSync(filepath);
    }
  }

  async list(): Promise<SaveMetadata[]> {
    if (!existsSync(this.dir)) return [];

    const files = readdirSync(this.dir);
    const saves: SaveMetadata[] = [];

    for (const file of files) {
      if (!file.endsWith(".json")) continue;
      try {
        const raw = readFileSync(join(this.dir, file), "utf-8");
        const saved = JSON.parse(raw) as SavedGame;
        saves.push(saved.metadata);
      } catch {
        // Skip corrupted files
      }
    }

    saves.sort((a, b) => b.timestamp - a.timestamp);
    return saves;
  }
}
