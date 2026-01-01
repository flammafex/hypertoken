/**
 * ParallelOps - Parallel operations for HyperToken using Worker Threads
 *
 * Phase 3A: Node.js Worker Threads
 *
 * Provides high-level parallel operations for:
 * - Game simulations (4-8x speedup)
 * - Chronicle CRDT merges (parallel document merging)
 * - Batch Stack/Space operations
 * - Monte Carlo simulations
 */

import { WorkerPool } from './WorkerPool.js';
import { Chronicle } from './ChronicleWasm.js';
import type { IToken } from './types.js';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

export interface ParallelSimulationConfig {
  /** Number of parallel simulations to run */
  numSimulations: number;
  /** Turns per simulation */
  turnsPerSimulation: number;
  /** Initial Chronicle state (Base64) */
  initialState?: string;
  /** Tokens to initialize with */
  tokens?: IToken[];
  /** Seed prefix for deterministic simulations */
  seedPrefix?: string;
  /** Custom actions to execute */
  actions?: Array<{
    type: string;
    [key: string]: any;
  }>;
}

export interface SimulationResult {
  simulationId: number;
  finalState: string;
  turnsExecuted: number;
  executionTime: number;
  metrics: {
    totalActions: number;
    successfulActions: number;
    failedActions: number;
    [key: string]: any;
  };
}

export interface ParallelMergeConfig {
  /** Base Chronicle document (Base64) */
  baseDoc?: string;
  /** Documents to merge (Base64 array) */
  documents: string[];
  /** Batch size for parallel merging */
  batchSize?: number;
}

/**
 * ParallelOps - Manage parallel operations using worker threads
 */
export class ParallelOps {
  private workerPool: WorkerPool | null = null;
  private workerScriptPath: string;

  constructor() {
    // Resolve worker script path using import.meta.url (ES module compatible)
    const __filename = fileURLToPath(import.meta.url);
    const __dirname = dirname(__filename);
    this.workerScriptPath = resolve(__dirname, 'worker', 'game-worker.js');
  }

  /**
   * Initialize the worker pool
   */
  private ensureWorkerPool(): WorkerPool {
    if (!this.workerPool) {
      this.workerPool = new WorkerPool({
        workerScript: this.workerScriptPath,
        debug: false,
      });
    }
    return this.workerPool;
  }

  /**
   * Run parallel game simulations
   *
   * Example:
   * ```ts
   * const parallel = new ParallelOps();
   * const results = await parallel.runSimulations({
   *   numSimulations: 100,
   *   turnsPerSimulation: 1000,
   *   tokens: myTokens,
   * });
   * ```
   *
   * @returns Array of simulation results
   */
  public async runSimulations(
    config: ParallelSimulationConfig
  ): Promise<SimulationResult[]> {
    const pool = this.ensureWorkerPool();

    // Create simulation tasks
    const tasks = Array.from({ length: config.numSimulations }, (_, i) => ({
      seed: config.seedPrefix ? `${config.seedPrefix}-${i}` : undefined,
      turns: config.turnsPerSimulation,
      initialState: config.initialState,
      tokens: config.tokens,
      actions: config.actions,
    }));

    // Execute simulations in parallel
    const results = await pool.executeParallel<any, SimulationResult>(
      'simulate-game',
      tasks
    );

    // Add simulation IDs
    return results.map((result, i) => ({
      ...result,
      simulationId: i,
    }));
  }

  /**
   * Run Monte Carlo simulation (many random runs)
   *
   * Useful for testing game balance, probability analysis, etc.
   *
   * Example:
   * ```ts
   * const parallel = new ParallelOps();
   * const outcomes = await parallel.monteCarlo({
   *   numSimulations: 10000,
   *   turnsPerSimulation: 50,
   *   tokens: deck,
   * });
   *
   * // Analyze outcomes
   * const winRate = outcomes.filter(o => o.metrics.playerWon).length / outcomes.length;
   * ```
   */
  public async monteCarlo(
    config: ParallelSimulationConfig
  ): Promise<SimulationResult[]> {
    // Monte Carlo uses random seeds for each simulation
    return this.runSimulations({
      ...config,
      seedPrefix: config.seedPrefix ?? `mc-${Date.now()}`,
    });
  }

  /**
   * Merge multiple Chronicle documents in parallel
   *
   * Uses tree-based parallel merging for optimal performance:
   * 1. Split documents into batches
   * 2. Merge each batch in parallel
   * 3. Merge batch results
   *
   * Example:
   * ```ts
   * const parallel = new ParallelOps();
   * const merged = await parallel.mergeDocuments({
   *   documents: [doc1, doc2, doc3, doc4],
   *   batchSize: 2, // Merge in pairs
   * });
   * ```
   */
  public async mergeDocuments(config: ParallelMergeConfig): Promise<string> {
    const pool = this.ensureWorkerPool();

    if (config.documents.length === 0) {
      return config.baseDoc || '';
    }

    if (config.documents.length === 1) {
      if (!config.baseDoc) {
        return config.documents[0];
      }
      // Merge single document with base
      return pool.execute('merge-chronicles', {
        baseDoc: config.baseDoc,
        docsToMerge: config.documents,
      });
    }

    // Tree-based parallel merging
    const batchSize = config.batchSize ?? 4;
    let currentDocs = [...config.documents];

    // Add base document to the merge queue
    if (config.baseDoc) {
      currentDocs.unshift(config.baseDoc);
    }

    // Repeatedly merge in parallel until we have one document
    while (currentDocs.length > 1) {
      const batches: string[][] = [];

      // Create batches
      for (let i = 0; i < currentDocs.length; i += batchSize) {
        batches.push(currentDocs.slice(i, i + batchSize));
      }

      // Merge each batch in parallel
      const mergeTasks = batches.map(batch => ({
        baseDoc: batch[0],
        docsToMerge: batch.slice(1),
      }));

      currentDocs = await pool.executeParallel<any, string>(
        'merge-chronicles',
        mergeTasks
      );
    }

    return currentDocs[0];
  }

  /**
   * Execute batch Stack operations in parallel
   *
   * Example:
   * ```ts
   * const parallel = new ParallelOps();
   * const results = await parallel.batchStackOps([
   *   { operation: 'draw', params: { count: 5 } },
   *   { operation: 'shuffle', params: { seed: 'test' } },
   *   { operation: 'burn', params: { count: 3 } },
   * ]);
   * ```
   */
  public async batchStackOps(operations: Array<{
    operation: 'draw' | 'shuffle' | 'burn' | 'discard';
    params: any;
    stackState?: string;
  }>): Promise<string[]> {
    const pool = this.ensureWorkerPool();
    return pool.execute('batch-stack-operations', operations);
  }

  /**
   * Execute batch Space operations in parallel
   *
   * Example:
   * ```ts
   * const parallel = new ParallelOps();
   * const results = await parallel.batchSpaceOps([
   *   { operation: 'place', params: { zone: 'hand', token, x: 0, y: 0 } },
   *   { operation: 'move', params: { placementId, fromZone: 'hand', toZone: 'field' } },
   * ]);
   * ```
   */
  public async batchSpaceOps(operations: Array<{
    operation: 'place' | 'move' | 'remove' | 'flip';
    params: any;
    spaceState?: string;
  }>): Promise<string[]> {
    const pool = this.ensureWorkerPool();
    return pool.execute('batch-space-operations', operations);
  }

  /**
   * Run A/B testing simulations
   *
   * Compare two different configurations by running parallel simulations
   *
   * Example:
   * ```ts
   * const parallel = new ParallelOps();
   * const comparison = await parallel.abTest({
   *   variantA: {
   *     numSimulations: 1000,
   *     turnsPerSimulation: 100,
   *     tokens: deckA,
   *   },
   *   variantB: {
   *     numSimulations: 1000,
   *     turnsPerSimulation: 100,
   *     tokens: deckB,
   *   },
   * });
   *
   * console.log('Variant A avg turns:', comparison.variantA.avgTurns);
   * console.log('Variant B avg turns:', comparison.variantB.avgTurns);
   * ```
   */
  public async abTest(config: {
    variantA: ParallelSimulationConfig;
    variantB: ParallelSimulationConfig;
  }): Promise<{
    variantA: SimulationResult[];
    variantB: SimulationResult[];
    comparison: {
      avgExecutionTimeA: number;
      avgExecutionTimeB: number;
      avgSuccessRateA: number;
      avgSuccessRateB: number;
    };
  }> {
    // Run both variants in parallel
    const [variantA, variantB] = await Promise.all([
      this.runSimulations(config.variantA),
      this.runSimulations(config.variantB),
    ]);

    // Calculate comparison metrics
    const avgExecutionTimeA =
      variantA.reduce((sum, r) => sum + r.executionTime, 0) / variantA.length;
    const avgExecutionTimeB =
      variantB.reduce((sum, r) => sum + r.executionTime, 0) / variantB.length;

    const avgSuccessRateA =
      variantA.reduce((sum, r) => sum + (r.metrics.successfulActions / r.metrics.totalActions), 0) /
      variantA.length;
    const avgSuccessRateB =
      variantB.reduce((sum, r) => sum + (r.metrics.successfulActions / r.metrics.totalActions), 0) /
      variantB.length;

    return {
      variantA,
      variantB,
      comparison: {
        avgExecutionTimeA,
        avgExecutionTimeB,
        avgSuccessRateA,
        avgSuccessRateB,
      },
    };
  }

  /**
   * Get worker pool statistics
   */
  public getStats() {
    if (!this.workerPool) {
      return {
        initialized: false,
        totalWorkers: 0,
        busyWorkers: 0,
        idleWorkers: 0,
        queuedTasks: 0,
        totalTasksProcessed: 0,
      };
    }

    return {
      initialized: true,
      ...this.workerPool.getStats(),
    };
  }

  /**
   * Shutdown worker pool gracefully
   */
  public async shutdown(): Promise<void> {
    if (this.workerPool) {
      await this.workerPool.shutdown();
      this.workerPool = null;
    }
  }
}

/**
 * Create a singleton instance for convenience
 */
let defaultInstance: ParallelOps | null = null;

export function getParallelOps(): ParallelOps {
  if (!defaultInstance) {
    defaultInstance = new ParallelOps();
  }
  return defaultInstance;
}

export async function shutdownParallelOps(): Promise<void> {
  if (defaultInstance) {
    await defaultInstance.shutdown();
    defaultInstance = null;
  }
}
