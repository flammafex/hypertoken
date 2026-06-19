/**
 * core/storage/IndexedDBAdapter.ts
 *
 * IndexedDB storage adapter for browsers.
 * Survives page refresh, works offline.
 *
 * Uses a single database 'hypertoken' with an object store 'saves'.
 * Each save is stored as a SavedGame object keyed by name.
 */
import type { StorageAdapter, SavedGame, SaveMetadata } from "../StorageAdapter.js";
import { STORAGE_VERSION } from "../StorageAdapter.js";

const DB_NAME = "hypertoken";
const DB_VERSION = 1;
const STORE_NAME = "saves";

export interface IndexedDBAdapterOptions {
  /** Database name (default: 'hypertoken') */
  dbName?: string;
}

export class IndexedDBAdapter implements StorageAdapter {
  private dbName: string;
  private dbPromise: Promise<IDBDatabase> | null = null;

  constructor(options: IndexedDBAdapterOptions = {}) {
    this.dbName = options.dbName ?? DB_NAME;
  }

  private getDB(): Promise<IDBDatabase> {
    if (this.dbPromise) return this.dbPromise;

    this.dbPromise = new Promise((resolve, reject) => {
      const request = indexedDB.open(this.dbName, DB_VERSION);

      request.onupgradeneeded = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          db.createObjectStore(STORE_NAME, { keyPath: "metadata.name" });
        }
      };

      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });

    return this.dbPromise;
  }

  async save(name: string, data: string, description?: string): Promise<void> {
    const db = await this.getDB();

    const metadata: SaveMetadata = {
      name,
      timestamp: Date.now(),
      version: STORAGE_VERSION,
      description,
      size: data.length,
    };

    const savedGame: SavedGame = { metadata, data };

    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, "readwrite");
      const store = tx.objectStore(STORE_NAME);
      const request = store.put(savedGame);

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  async load(name: string): Promise<SavedGame | null> {
    const db = await this.getDB();

    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, "readonly");
      const store = tx.objectStore(STORE_NAME);
      const request = store.get(name);

      request.onsuccess = () => resolve(request.result ?? null);
      request.onerror = () => reject(request.error);
    });
  }

  async delete(name: string): Promise<void> {
    const db = await this.getDB();

    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, "readwrite");
      const store = tx.objectStore(STORE_NAME);
      const request = store.delete(name);

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  async list(): Promise<SaveMetadata[]> {
    const db = await this.getDB();

    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, "readonly");
      const store = tx.objectStore(STORE_NAME);
      const request = store.getAll();

      request.onsuccess = () => {
        const results = (request.result ?? []) as SavedGame[];
        const saves = results.map((s) => s.metadata);
        saves.sort((a, b) => b.timestamp - a.timestamp);
        resolve(saves);
      };
      request.onerror = () => reject(request.error);
    });
  }
}
