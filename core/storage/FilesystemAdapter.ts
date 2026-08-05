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
