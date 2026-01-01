/**
 * WasmWorker: Manages WASM execution in a Worker Thread (Node.js) or Web Worker (Browser)
 *
 * Provides a Promise-based API for dispatching actions to the WASM core
 * running in a separate thread.
 *
 * Benefits:
 * - UI/main thread never freezes during CRDT operations
 * - True parallelism on multi-core systems
 * - Isolated WASM memory space
 */

import { Worker } from 'node:worker_threads';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { EventEmitter } from 'events';
import type {
  WorkerRequest,
  WorkerResponse,
  WorkerRequestType,
  WorkerResponseType,
  DispatchActionRequest,
  DispatchBatchRequest,
  StateChangedResponse,
} from './WorkerProtocol.js';
import {
  createRequest,
  generateMessageId,
  isWorkerResponse,
} from './WorkerProtocol.js';

export interface WasmWorkerOptions {
  /**
   * Path to the worker script
   * Defaults to './WasmWorker.worker.js' in same directory
   */
  workerPath?: string;

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
}

interface PendingRequest {
  resolve: (value: any) => void;
  reject: (error: Error) => void;
  timer: NodeJS.Timeout;
  requestType: WorkerRequestType;
}

/**
 * WasmWorker: Thread-safe WASM execution manager
 */
export class WasmWorker extends EventEmitter {
  private worker: Worker | null = null;
  private pendingRequests: Map<string, PendingRequest> = new Map();
  private isReady: boolean = false;
  private options: Required<WasmWorkerOptions>;
  private batchQueue: Array<{ actionType: string; actionPayload: any }> = [];
  private batchTimer: NodeJS.Timeout | null = null;

  constructor(options: WasmWorkerOptions = {}) {
    super();

    this.options = {
      workerPath:
        options.workerPath ||
        join(dirname(fileURLToPath(import.meta.url)), 'WasmWorker.worker.js'),
      debug: options.debug ?? false,
      timeout: options.timeout ?? 30000,
      enableBatching: options.enableBatching ?? false,
      batchWindow: options.batchWindow ?? 10,
    };
  }

  /**
   * Initialize the worker thread
   */
  async init(): Promise<void> {
    if (this.worker) {
      throw new Error('Worker already initialized');
    }

    return new Promise((resolve, reject) => {
      try {
        this.worker = new Worker(this.options.workerPath, {
          // Pass any worker options here
        });

        this.worker.on('message', this.handleMessage.bind(this));
        this.worker.on('error', this.handleError.bind(this));
        this.worker.on('exit', this.handleExit.bind(this));

        // Wait for worker ready signal
        const readyHandler = (msg: WorkerResponse) => {
          if (msg.type === 'ready') {
            this.isReady = true;
            if (this.options.debug) {
              console.log('✅ WasmWorker ready');
            }
            resolve();
          }
        };

        this.once('ready', readyHandler);

        // Timeout if worker doesn't become ready
        setTimeout(() => {
          if (!this.isReady) {
            this.removeListener('ready', readyHandler);
            reject(new Error('Worker initialization timeout'));
          }
        }, this.options.timeout);
      } catch (error) {
        reject(error);
      }
    });
  }

  /**
   * Dispatch a single action to the worker
   */
  async dispatch(actionType: string, actionPayload: any = {}): Promise<any> {
    // If batching enabled, queue the action
    if (this.options.enableBatching) {
      return this.queueAction(actionType, actionPayload);
    }

    // Otherwise dispatch immediately
    return this.sendAction(actionType, actionPayload);
  }

  /**
   * Queue an action for batching
   */
  private async queueAction(
    actionType: string,
    actionPayload: any
  ): Promise<any> {
    return new Promise((resolve, reject) => {
      this.batchQueue.push({ actionType, actionPayload });

      // Clear existing timer
      if (this.batchTimer) {
        clearTimeout(this.batchTimer);
      }

      // Set new timer to flush batch
      this.batchTimer = setTimeout(() => {
        this.flushBatch()
          .then(resolve)
          .catch(reject);
      }, this.options.batchWindow);
    });
  }

  /**
   * Flush queued actions as a batch
   */
  private async flushBatch(): Promise<any> {
    if (this.batchQueue.length === 0) {
      return;
    }

    const actions = [...this.batchQueue];
    this.batchQueue = [];
    this.batchTimer = null;

    if (this.options.debug) {
      console.log(`📦 Flushing batch of ${actions.length} actions`);
    }

    const request: DispatchBatchRequest = createRequest(
      'dispatch_batch' as WorkerRequestType,
      { actions }
    ) as DispatchBatchRequest;

    return this.sendRequest(request);
  }

  /**
   * Send a single action immediately
   */
  private async sendAction(actionType: string, actionPayload: any): Promise<any> {
    const request: DispatchActionRequest = createRequest(
      'dispatch_action' as WorkerRequestType,
      { actionType, actionPayload }
    ) as DispatchActionRequest;

    return this.sendRequest(request);
  }

  /**
   * Send a request to the worker and wait for response
   */
  private sendRequest(request: WorkerRequest): Promise<any> {
    if (!this.worker || !this.isReady) {
      return Promise.reject(new Error('Worker not ready'));
    }

    return new Promise((resolve, reject) => {
      // Set up timeout
      const timer = setTimeout(() => {
        this.pendingRequests.delete(request.id);
        reject(
          new Error(
            `Worker request timeout (${this.options.timeout}ms): ${request.type}`
          )
        );
      }, this.options.timeout);

      // Store pending request
      this.pendingRequests.set(request.id, {
        resolve,
        reject,
        timer,
        requestType: request.type,
      });

      // Send to worker
      this.worker!.postMessage(request);

      if (this.options.debug) {
        console.log(`→ Sent: ${request.type} (${request.id})`);
      }
    });
  }

  /**
   * Handle message from worker
   */
  private handleMessage(message: any): void {
    if (!isWorkerResponse(message)) {
      console.warn('Invalid worker response:', message);
      return;
    }

    const response = message as WorkerResponse;

    if (this.options.debug) {
      console.log(`← Received: ${response.type} (${response.id})`);
    }

    // Handle proactive messages (not responses to requests)
    if (response.type === 'ready') {
      this.emit('ready', response);
      return;
    }

    if (response.type === 'state_changed') {
      this.emit('state_changed', (response as StateChangedResponse).payload);
      return;
    }

    if (response.type === 'action_completed') {
      this.emit('action_completed', response.payload);
      // Don't return - still need to resolve the pending request
    }

    // Handle response to a request
    const pending = this.pendingRequests.get(response.requestId);
    if (!pending) {
      console.warn('No pending request for response:', response.requestId);
      return;
    }

    // Clear timeout
    clearTimeout(pending.timer);
    this.pendingRequests.delete(response.requestId);

    // Resolve or reject based on response type
    if (response.type === 'error' || response.error) {
      const error = new Error(
        response.error?.message || 'Worker error'
      );
      if (response.error?.stack) {
        error.stack = response.error.stack;
      }
      pending.reject(error);
    } else {
      pending.resolve(response.payload);
    }
  }

  /**
   * Handle worker error
   */
  private handleError(error: Error): void {
    console.error('Worker error:', error);
    this.emit('error', error);

    // Reject all pending requests
    for (const [id, pending] of this.pendingRequests.entries()) {
      pending.reject(error);
      clearTimeout(pending.timer);
    }
    this.pendingRequests.clear();
  }

  /**
   * Handle worker exit
   */
  private handleExit(code: number): void {
    if (code !== 0) {
      console.error(`Worker exited with code ${code}`);
    }

    this.isReady = false;
    this.worker = null;
    this.emit('exit', code);

    // Reject all pending requests
    const error = new Error(`Worker exited with code ${code}`);
    for (const [id, pending] of this.pendingRequests.entries()) {
      pending.reject(error);
      clearTimeout(pending.timer);
    }
    this.pendingRequests.clear();
  }

  /**
   * Get current state from worker
   */
  async getState(): Promise<any> {
    const request = createRequest('get_state' as WorkerRequestType);
    return this.sendRequest(request);
  }

  /**
   * Merge CRDT state from remote peer
   */
  async mergeState(data: Uint8Array): Promise<void> {
    const request = createRequest('merge_state' as WorkerRequestType, { data });
    return this.sendRequest(request);
  }

  /**
   * Save CRDT snapshot
   */
  async saveSnapshot(): Promise<Uint8Array> {
    const request = createRequest('save_snapshot' as WorkerRequestType);
    return this.sendRequest(request);
  }

  /**
   * Load CRDT snapshot
   */
  async loadSnapshot(data: Uint8Array): Promise<void> {
    const request = createRequest('load_snapshot' as WorkerRequestType, { data });
    return this.sendRequest(request);
  }

  /**
   * Ping worker (health check)
   */
  async ping(): Promise<number> {
    const start = Date.now();
    const request = createRequest('ping' as WorkerRequestType);
    await this.sendRequest(request);
    return Date.now() - start;
  }

  /**
   * Terminate the worker
   */
  async terminate(): Promise<void> {
    if (!this.worker) {
      return;
    }

    // Send shutdown request
    try {
      const request = createRequest('shutdown' as WorkerRequestType);
      await this.sendRequest(request);
    } catch {
      // Ignore errors during shutdown
    }

    // Force terminate
    await this.worker.terminate();
    this.worker = null;
    this.isReady = false;
    this.pendingRequests.clear();
  }

  /**
   * Check if worker is ready
   */
  get ready(): boolean {
    return this.isReady;
  }
}
