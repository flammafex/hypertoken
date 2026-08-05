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
