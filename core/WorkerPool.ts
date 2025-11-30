/**
 * WorkerPool - Manages a pool of Node.js worker threads for parallel processing
 *
 * Phase 3A: Node.js Worker Threads
 *
 * Features:
 * - Automatic worker lifecycle management
 * - Task distribution across CPU cores
 * - Result collection and aggregation
 * - Error handling and worker recovery
 * - Graceful shutdown
 */

import { Worker } from 'worker_threads';
import { cpus } from 'os';
import { EventEmitter } from 'events';

export interface WorkerTask<T = any, R = any> {
  id: string;
  type: string;
  data: T;
  resolve: (result: R) => void;
  reject: (error: Error) => void;
}

export interface WorkerMessage<T = any> {
  type: string;
  taskId: string;
  data?: T;
  error?: string;
}

export interface WorkerPoolOptions {
  /** Number of workers (defaults to CPU count) */
  numWorkers?: number;
  /** Path to worker script */
  workerScript: string;
  /** Maximum tasks per worker before restart */
  maxTasksPerWorker?: number;
  /** Worker idle timeout in ms */
  workerIdleTimeout?: number;
  /** Enable debug logging */
  debug?: boolean;
}

interface WorkerInfo {
  worker: Worker;
  busy: boolean;
  tasksProcessed: number;
  currentTask?: WorkerTask;
  lastActivity: number;
}

export class WorkerPool extends EventEmitter {
  private workers: Map<number, WorkerInfo> = new Map();
  private taskQueue: WorkerTask[] = [];
  private nextWorkerId = 0;
  private shuttingDown = false;
  private options: Required<WorkerPoolOptions>;
  private idleCheckInterval?: NodeJS.Timeout;

  constructor(options: WorkerPoolOptions) {
    super();

    this.options = {
      numWorkers: options.numWorkers ?? cpus().length,
      workerScript: options.workerScript,
      maxTasksPerWorker: options.maxTasksPerWorker ?? 1000,
      workerIdleTimeout: options.workerIdleTimeout ?? 60000, // 1 minute
      debug: options.debug ?? false,
    };

    this.log(`WorkerPool initialized with ${this.options.numWorkers} workers`);
    this.initializeWorkers();
    this.startIdleCheck();
  }

  /**
   * Initialize worker threads
   */
  private initializeWorkers(): void {
    for (let i = 0; i < this.options.numWorkers; i++) {
      this.createWorker();
    }
  }

  /**
   * Create a new worker thread
   */
  private createWorker(): number {
    const workerId = this.nextWorkerId++;
    const worker = new Worker(this.options.workerScript);

    const workerInfo: WorkerInfo = {
      worker,
      busy: false,
      tasksProcessed: 0,
      lastActivity: Date.now(),
    };

    // Handle messages from worker
    worker.on('message', (message: WorkerMessage) => {
      this.handleWorkerMessage(workerId, message);
    });

    // Handle worker errors
    worker.on('error', (error) => {
      this.handleWorkerError(workerId, error);
    });

    // Handle worker exit
    worker.on('exit', (code) => {
      this.handleWorkerExit(workerId, code);
    });

    this.workers.set(workerId, workerInfo);
    this.log(`Worker ${workerId} created`);

    return workerId;
  }

  /**
   * Handle message from worker
   */
  private handleWorkerMessage(workerId: number, message: WorkerMessage): void {
    const workerInfo = this.workers.get(workerId);
    if (!workerInfo) return;

    workerInfo.lastActivity = Date.now();

    if (message.type === 'result') {
      // Task completed successfully
      if (workerInfo.currentTask) {
        workerInfo.currentTask.resolve(message.data);
        workerInfo.tasksProcessed++;
        workerInfo.currentTask = undefined;
      }

      this.markWorkerIdle(workerId);

    } else if (message.type === 'error') {
      // Task failed
      if (workerInfo.currentTask) {
        workerInfo.currentTask.reject(new Error(message.error || 'Worker task failed'));
        workerInfo.currentTask = undefined;
      }

      this.markWorkerIdle(workerId);

    } else if (message.type === 'log') {
      // Worker log message
      this.log(`Worker ${workerId}: ${message.data}`);
    }

    // Check if worker should be recycled
    if (workerInfo.tasksProcessed >= this.options.maxTasksPerWorker) {
      this.log(`Worker ${workerId} reached max tasks, recycling...`);
      this.recycleWorker(workerId);
    }
  }

  /**
   * Handle worker error
   */
  private handleWorkerError(workerId: number, error: Error): void {
    this.log(`Worker ${workerId} error: ${error.message}`);

    const workerInfo = this.workers.get(workerId);
    if (workerInfo?.currentTask) {
      workerInfo.currentTask.reject(error);
      workerInfo.currentTask = undefined;
    }

    // Recycle the worker
    this.recycleWorker(workerId);
  }

  /**
   * Handle worker exit
   */
  private handleWorkerExit(workerId: number, code: number): void {
    this.log(`Worker ${workerId} exited with code ${code}`);

    const workerInfo = this.workers.get(workerId);
    if (workerInfo?.currentTask) {
      workerInfo.currentTask.reject(new Error(`Worker exited with code ${code}`));
    }

    this.workers.delete(workerId);

    // Create replacement worker if not shutting down
    if (!this.shuttingDown) {
      this.createWorker();
    }
  }

  /**
   * Mark worker as idle and process next task
   */
  private markWorkerIdle(workerId: number): void {
    const workerInfo = this.workers.get(workerId);
    if (!workerInfo) return;

    workerInfo.busy = false;
    this.processNextTask();
  }

  /**
   * Recycle a worker (terminate and create new one)
   */
  private async recycleWorker(workerId: number): Promise<void> {
    const workerInfo = this.workers.get(workerId);
    if (!workerInfo) return;

    await workerInfo.worker.terminate();
    this.workers.delete(workerId);

    if (!this.shuttingDown) {
      this.createWorker();
      this.processNextTask();
    }
  }

  /**
   * Start idle worker check interval
   */
  private startIdleCheck(): void {
    this.idleCheckInterval = setInterval(() => {
      const now = Date.now();
      for (const [workerId, workerInfo] of this.workers) {
        if (!workerInfo.busy &&
            now - workerInfo.lastActivity > this.options.workerIdleTimeout) {
          this.log(`Worker ${workerId} idle timeout, recycling...`);
          this.recycleWorker(workerId);
        }
      }
    }, 10000); // Check every 10 seconds
  }

  /**
   * Execute a task on an available worker
   */
  public execute<T = any, R = any>(type: string, data: T): Promise<R> {
    if (this.shuttingDown) {
      return Promise.reject(new Error('WorkerPool is shutting down'));
    }

    return new Promise((resolve, reject) => {
      const task: WorkerTask<T, R> = {
        id: `task-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        type,
        data,
        resolve: resolve as any,
        reject,
      };

      this.taskQueue.push(task);
      this.processNextTask();
    });
  }

  /**
   * Process the next task in queue
   */
  private processNextTask(): void {
    if (this.taskQueue.length === 0) return;

    // Find an idle worker
    let idleWorkerId: number | undefined;
    for (const [workerId, workerInfo] of this.workers) {
      if (!workerInfo.busy) {
        idleWorkerId = workerId;
        break;
      }
    }

    if (idleWorkerId === undefined) {
      // All workers busy
      return;
    }

    const task = this.taskQueue.shift();
    if (!task) return;

    const workerInfo = this.workers.get(idleWorkerId);
    if (!workerInfo) return;

    // Assign task to worker
    workerInfo.busy = true;
    workerInfo.currentTask = task;
    workerInfo.lastActivity = Date.now();

    this.log(`Assigning task ${task.id} (${task.type}) to worker ${idleWorkerId}`);

    // Send task to worker
    workerInfo.worker.postMessage({
      type: task.type,
      taskId: task.id,
      data: task.data,
    });
  }

  /**
   * Execute multiple tasks in parallel
   */
  public async executeParallel<T = any, R = any>(
    type: string,
    dataArray: T[]
  ): Promise<R[]> {
    const promises = dataArray.map(data => this.execute<T, R>(type, data));
    return Promise.all(promises);
  }

  /**
   * Execute tasks in batches
   */
  public async executeBatched<T = any, R = any>(
    type: string,
    dataArray: T[],
    batchSize?: number
  ): Promise<R[]> {
    const actualBatchSize = batchSize ?? this.options.numWorkers;
    const results: R[] = [];

    for (let i = 0; i < dataArray.length; i += actualBatchSize) {
      const batch = dataArray.slice(i, i + actualBatchSize);
      const batchResults = await this.executeParallel<T, R>(type, batch);
      results.push(...batchResults);
    }

    return results;
  }

  /**
   * Get pool statistics
   */
  public getStats() {
    const workers = Array.from(this.workers.values());
    return {
      totalWorkers: workers.length,
      busyWorkers: workers.filter(w => w.busy).length,
      idleWorkers: workers.filter(w => !w.busy).length,
      queuedTasks: this.taskQueue.length,
      totalTasksProcessed: workers.reduce((sum, w) => sum + w.tasksProcessed, 0),
    };
  }

  /**
   * Graceful shutdown
   */
  public async shutdown(): Promise<void> {
    this.shuttingDown = true;
    this.log('WorkerPool shutting down...');

    // Clear idle check interval
    if (this.idleCheckInterval) {
      clearInterval(this.idleCheckInterval);
    }

    // Wait for queued tasks to complete (with timeout)
    const timeout = 30000; // 30 seconds
    const startTime = Date.now();

    while (this.taskQueue.length > 0 && Date.now() - startTime < timeout) {
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    if (this.taskQueue.length > 0) {
      this.log(`Warning: ${this.taskQueue.length} tasks remaining in queue after timeout`);
      // Reject remaining tasks
      for (const task of this.taskQueue) {
        task.reject(new Error('WorkerPool shutdown before task could be processed'));
      }
      this.taskQueue = [];
    }

    // Terminate all workers
    const terminatePromises = Array.from(this.workers.values()).map(
      workerInfo => workerInfo.worker.terminate()
    );

    await Promise.all(terminatePromises);
    this.workers.clear();

    this.log('WorkerPool shutdown complete');
  }

  /**
   * Log message (if debug enabled)
   */
  private log(message: string): void {
    if (this.options.debug) {
      console.log(`[WorkerPool] ${message}`);
    }
  }
}
