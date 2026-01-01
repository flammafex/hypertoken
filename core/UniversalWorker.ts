/**
 * UniversalWorker: Auto-detects Node.js vs Browser and uses appropriate worker
 *
 * This module provides a unified API that works in both Node.js and browser environments.
 * It automatically detects the runtime environment and instantiates the appropriate
 * worker implementation (WasmWorker for Node.js, WebWorker for browsers).
 *
 * Usage:
 * ```typescript
 * const worker = new UniversalWorker({ debug: true });
 * await worker.init();
 * const result = await worker.dispatch('stack:shuffle', { seed: 42 });
 * await worker.terminate();
 * ```
 */

import { Emitter } from './events.js';
import type { WasmWorker } from './WasmWorker.js';
import type { WebWorker } from './WebWorker.js';

export interface UniversalWorkerOptions {
  /**
   * Enable debug logging
   */
  debug?: boolean;

  /**
   * Timeout for worker responses (ms)
   * Default: 30000 (30 seconds)
   */
  timeout?: number;

  /**
   * Enable batching of actions
   */
  enableBatching?: boolean;

  /**
   * Batch window in ms (actions collected in this window are batched together)
   * Default: 10ms
   */
  batchWindow?: number;

  /**
   * Browser-specific: Path to the worker script
   * Default: '/workers/hypertoken.worker.js'
   */
  workerPath?: string;

  /**
   * Browser-specific: Path to WASM files
   * Default: '/wasm/'
   */
  wasmPath?: string;
}

/**
 * Type for the internal worker implementation
 */
type WorkerImplementation = WasmWorker | WebWorker;

/**
 * UniversalWorker: Environment-agnostic worker manager
 *
 * Automatically selects the appropriate worker implementation based on the runtime:
 * - Node.js: Uses WasmWorker (worker_threads)
 * - Browser: Uses WebWorker (Web Workers API)
 */
export class UniversalWorker extends Emitter {
  private implementation: WorkerImplementation | null = null;
  private _isNode: boolean;
  private options: UniversalWorkerOptions;

  constructor(options: UniversalWorkerOptions = {}) {
    super();
    this.options = options;

    // Detect environment
    this._isNode =
      typeof process !== 'undefined' &&
      process.versions != null &&
      process.versions.node != null;
  }

  /**
   * Check if running in Node.js environment
   */
  get isNode(): boolean {
    return this._isNode;
  }

  /**
   * Check if running in browser environment
   */
  get isBrowser(): boolean {
    return !this._isNode;
  }

  /**
   * Get the environment name
   */
  get environment(): 'node' | 'browser' {
    return this._isNode ? 'node' : 'browser';
  }

  /**
   * Initialize the worker (auto-detects environment)
   */
  async init(): Promise<void> {
    if (this.implementation) {
      throw new Error('Worker already initialized');
    }

    if (this._isNode) {
      // Node.js environment: Use WasmWorker
      const { WasmWorker } = await import('./WasmWorker.js');
      this.implementation = new WasmWorker({
        debug: this.options.debug,
        timeout: this.options.timeout,
        enableBatching: this.options.enableBatching,
        batchWindow: this.options.batchWindow,
      });
    } else {
      // Browser environment: Use WebWorker
      const { WebWorker } = await import('./WebWorker.js');
      this.implementation = new WebWorker({
        debug: this.options.debug,
        timeout: this.options.timeout,
        enableBatching: this.options.enableBatching,
        batchWindow: this.options.batchWindow,
        workerPath: this.options.workerPath,
        wasmPath: this.options.wasmPath,
      });
    }

    // Forward events from implementation to this emitter
    this.implementation.on('action_completed', (payload) =>
      this.emit('action_completed', payload)
    );
    this.implementation.on('state_changed', (payload) =>
      this.emit('state_changed', payload)
    );
    this.implementation.on('error', (payload) =>
      this.emit('error', payload)
    );

    // Initialize the worker
    await this.implementation.init();

    if (this.options.debug) {
      console.log(`[UniversalWorker] Initialized in ${this.environment} mode`);
    }
  }

  /**
   * Dispatch an action to the worker
   */
  async dispatch(actionType: string, actionPayload: any = {}): Promise<any> {
    if (!this.implementation) {
      throw new Error('Worker not initialized. Call init() first.');
    }
    return this.implementation.dispatch(actionType, actionPayload);
  }

  /**
   * Get current state from worker
   */
  async getState(): Promise<any> {
    if (!this.implementation) {
      throw new Error('Worker not initialized. Call init() first.');
    }
    return this.implementation.getState();
  }

  /**
   * Merge CRDT state from remote peer
   */
  async mergeState(data: Uint8Array): Promise<void> {
    if (!this.implementation) {
      throw new Error('Worker not initialized. Call init() first.');
    }
    return this.implementation.mergeState(data);
  }

  /**
   * Save CRDT snapshot
   */
  async saveSnapshot(): Promise<Uint8Array> {
    if (!this.implementation) {
      throw new Error('Worker not initialized. Call init() first.');
    }
    return this.implementation.saveSnapshot();
  }

  /**
   * Load CRDT snapshot
   */
  async loadSnapshot(data: Uint8Array): Promise<void> {
    if (!this.implementation) {
      throw new Error('Worker not initialized. Call init() first.');
    }
    return this.implementation.loadSnapshot(data);
  }

  /**
   * Ping worker (health check)
   */
  async ping(): Promise<number> {
    if (!this.implementation) {
      throw new Error('Worker not initialized. Call init() first.');
    }
    return this.implementation.ping();
  }

  /**
   * Terminate the worker
   */
  async terminate(): Promise<void> {
    if (!this.implementation) {
      return;
    }

    await this.implementation.terminate();
    this.implementation = null;

    if (this.options.debug) {
      console.log('[UniversalWorker] Terminated');
    }
  }

  /**
   * Check if worker is ready
   */
  get ready(): boolean {
    return this.implementation?.ready ?? false;
  }

  /**
   * Alias for ready (API compatibility)
   */
  get isReady(): boolean {
    return this.ready;
  }
}

/**
 * Check if the current environment supports workers
 */
export function supportsWorkers(): boolean {
  // Node.js
  if (
    typeof process !== 'undefined' &&
    process.versions != null &&
    process.versions.node != null
  ) {
    // Node.js 12+ supports worker_threads
    const version = parseInt(process.versions.node.split('.')[0], 10);
    return version >= 12;
  }

  // Browser - check for Worker API
  return typeof Worker !== 'undefined';
}

/**
 * Get the current runtime environment
 */
export function getEnvironment(): 'node' | 'browser' | 'unknown' {
  if (
    typeof process !== 'undefined' &&
    process.versions != null &&
    process.versions.node != null
  ) {
    return 'node';
  }

  if (typeof window !== 'undefined' || typeof self !== 'undefined') {
    return 'browser';
  }

  return 'unknown';
}
