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
import { createRequest, isWorkerResponse, } from './WorkerProtocol.js';
/**
 * WasmWorker: Thread-safe WASM execution manager
 */
export class WasmWorker extends EventEmitter {
    worker = null;
    pendingRequests = new Map();
    isReady = false;
    options;
    batchQueue = [];
    batchTimer = null;
    constructor(options = {}) {
        super();
        this.options = {
            workerPath: options.workerPath ||
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
    async init() {
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
                const readyHandler = (msg) => {
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
            }
            catch (error) {
                reject(error);
            }
        });
    }
    /**
     * Dispatch a single action to the worker
     */
    async dispatch(actionType, actionPayload = {}) {
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
    async queueAction(actionType, actionPayload) {
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
    async flushBatch() {
        if (this.batchQueue.length === 0) {
            return;
        }
        const actions = [...this.batchQueue];
        this.batchQueue = [];
        this.batchTimer = null;
        if (this.options.debug) {
            console.log(`📦 Flushing batch of ${actions.length} actions`);
        }
        const request = createRequest('dispatch_batch', { actions });
        return this.sendRequest(request);
    }
    /**
     * Send a single action immediately
     */
    async sendAction(actionType, actionPayload) {
        const request = createRequest('dispatch_action', { actionType, actionPayload });
        return this.sendRequest(request);
    }
    /**
     * Send a request to the worker and wait for response
     */
    sendRequest(request) {
        if (!this.worker || !this.isReady) {
            return Promise.reject(new Error('Worker not ready'));
        }
        return new Promise((resolve, reject) => {
            // Set up timeout
            const timer = setTimeout(() => {
                this.pendingRequests.delete(request.id);
                reject(new Error(`Worker request timeout (${this.options.timeout}ms): ${request.type}`));
            }, this.options.timeout);
            // Store pending request
            this.pendingRequests.set(request.id, {
                resolve,
                reject,
                timer,
                requestType: request.type,
            });
            // Send to worker
            this.worker.postMessage(request);
            if (this.options.debug) {
                console.log(`→ Sent: ${request.type} (${request.id})`);
            }
        });
    }
    /**
     * Handle message from worker
     */
    handleMessage(message) {
        if (!isWorkerResponse(message)) {
            console.warn('Invalid worker response:', message);
            return;
        }
        const response = message;
        if (this.options.debug) {
            console.log(`← Received: ${response.type} (${response.id})`);
        }
        // Handle proactive messages (not responses to requests)
        if (response.type === 'ready') {
            this.emit('ready', response);
            return;
        }
        if (response.type === 'state_changed') {
            this.emit('state_changed', response.payload);
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
            const error = new Error(response.error?.message || 'Worker error');
            if (response.error?.stack) {
                error.stack = response.error.stack;
            }
            pending.reject(error);
        }
        else {
            pending.resolve(response.payload);
        }
    }
    /**
     * Handle worker error
     */
    handleError(error) {
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
    handleExit(code) {
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
    async getState() {
        const request = createRequest('get_state');
        return this.sendRequest(request);
    }
    /**
     * Merge CRDT state from remote peer
     */
    async mergeState(data) {
        const request = createRequest('merge_state', { data });
        return this.sendRequest(request);
    }
    /**
     * Save CRDT snapshot
     */
    async saveSnapshot() {
        const request = createRequest('save_snapshot');
        return this.sendRequest(request);
    }
    /**
     * Load CRDT snapshot
     */
    async loadSnapshot(data) {
        const request = createRequest('load_snapshot', { data });
        return this.sendRequest(request);
    }
    /**
     * Ping worker (health check)
     */
    async ping() {
        const start = Date.now();
        const request = createRequest('ping');
        await this.sendRequest(request);
        return Date.now() - start;
    }
    /**
     * Terminate the worker
     */
    async terminate() {
        if (!this.worker) {
            return;
        }
        // Send shutdown request
        try {
            const request = createRequest('shutdown');
            await this.sendRequest(request);
        }
        catch {
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
    get ready() {
        return this.isReady;
    }
}
