/**
 * WebWorker: Browser Web Worker manager for WASM execution
 *
 * This is the browser-compatible version of WasmWorker.ts.
 * Uses the Web Worker API instead of Node.js worker_threads.
 *
 * Key Differences from Node.js WasmWorker:
 * - Uses browser `Worker` constructor instead of `worker_threads`
 * - Uses `worker.onmessage` instead of `worker.on('message', ...)`
 * - Uses `worker.onerror` instead of `worker.on('error', ...)`
 * - Worker script loaded via URL, not file path
 */

import { Emitter } from './events.js';
import type {
  WorkerRequest,
  WorkerResponse,
  WorkerRequestType,
  DispatchActionRequest,
  DispatchBatchRequest,
  StateChangedResponse,
} from './WorkerProtocol.js';
import {
  createRequest,
  isWorkerResponse,
} from './WorkerProtocol.js';

export interface WebWorkerOptions {
  /**
   * Path to the worker script
   * Default: '/workers/hypertoken.worker.js'
   */
  workerPath?: string;

  /**
   * Path to WASM files
   * Default: '/wasm/'
   */
  wasmPath?: string;

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
  timer: ReturnType<typeof setTimeout>;
  requestType: WorkerRequestType;
}

/**
 * WebWorker: Browser Web Worker manager for WASM execution
 *
 * Provides the same API as WasmWorker but uses browser Web Workers.
 */
export class WebWorker extends Emitter {
  private worker: Worker | null = null;
  private pendingRequests: Map<string, PendingRequest> = new Map();
  private _isReady: boolean = false;
  private options: Required<WebWorkerOptions>;
  private batchQueue: Array<{ actionType: string; actionPayload: any }> = [];
  private batchTimer: ReturnType<typeof setTimeout> | null = null;

  constructor(options: WebWorkerOptions = {}) {
    super();

    this.options = {
      workerPath: options.workerPath || '/workers/hypertoken.worker.js',
      wasmPath: options.wasmPath || '/wasm/',
      debug: options.debug ?? false,
      timeout: options.timeout ?? 30000,
      enableBatching: options.enableBatching ?? false,
      batchWindow: options.batchWindow ?? 10,
    };
  }

  /**
   * Initialize the Web Worker
   */
  async init(): Promise<void> {
    if (this.worker) {
      throw new Error('Worker already initialized');
    }

    return new Promise((resolve, reject) => {
      try {
        // Create Web Worker with module support
        this.worker = new Worker(this.options.workerPath, { type: 'module' });

        // Set up message handler
        this.worker.onmessage = this.handleMessage.bind(this);

        // Set up error handler
        this.worker.onerror = (event: ErrorEvent) => {
          this.handleError(new Error(event.message || 'Worker error'));
        };

        // Wait for worker ready signal, then send init request
        const readyHandler = (msg: WorkerResponse) => {
          if (msg.type === 'ready') {
            // Worker is ready, now send init request with wasmPath
            this.sendInitRequest()
              .then(() => {
                this._isReady = true;
                if (this.options.debug) {
                  console.log('[WebWorker] Ready');
                }
                resolve();
              })
              .catch(reject);
          }
        };

        this.once('ready', readyHandler);

        // Timeout if worker doesn't become ready
        setTimeout(() => {
          if (!this._isReady) {
            this.off('ready', readyHandler);
            reject(new Error('Worker initialization timeout'));
          }
        }, this.options.timeout);
      } catch (error) {
        reject(error);
      }
    });
  }

  /**
   * Send initialization request to worker
   */
  private async sendInitRequest(): Promise<void> {
    const request = createRequest('init' as WorkerRequestType, {
      wasmPath: this.options.wasmPath,
    });

    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pendingRequests.delete(request.id);
        reject(new Error(`Worker init timeout (${this.options.timeout}ms)`));
      }, this.options.timeout);

      this.pendingRequests.set(request.id, {
        resolve,
        reject,
        timer,
        requestType: request.type,
      });

      this.worker!.postMessage(request);
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
      console.log(`[WebWorker] Flushing batch of ${actions.length} actions`);
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
    if (!this.worker || !this._isReady) {
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
        console.log(`[WebWorker] -> ${request.type} (${request.id})`);
      }
    });
  }

  /**
   * Handle message from worker
   */
  private handleMessage(event: MessageEvent): void {
    const message = event.data;

    if (!isWorkerResponse(message)) {
      console.warn('[WebWorker] Invalid worker response:', message);
      return;
    }

    const response = message as WorkerResponse;

    if (this.options.debug) {
      console.log(`[WebWorker] <- ${response.type} (${response.id})`);
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
      // This can happen for init responses
      if (response.requestId !== 'boot') {
        console.warn('[WebWorker] No pending request for response:', response.requestId);
      }
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
    console.error('[WebWorker] Error:', error);
    this.emit('error', error);

    // Reject all pending requests
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
      // Don't wait for response, just send
      this.worker.postMessage(request);
    } catch {
      // Ignore errors during shutdown
    }

    // Terminate worker
    this.worker.terminate();
    this.worker = null;
    this._isReady = false;
    this.pendingRequests.clear();
  }

  /**
   * Check if worker is ready
   */
  get ready(): boolean {
    return this._isReady;
  }

  /**
   * Alias for ready (API compatibility with WasmWorker)
   */
  get isReady(): boolean {
    return this._isReady;
  }
}
