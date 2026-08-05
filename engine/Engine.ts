/*
 * engine/Engine.ts
 */
import { Emitter } from "../core/events.js";
import { Stack } from "../core/Stack.js";
import { Space } from "../core/Space.js";
import { Source } from "../core/Source.js";
import { Action } from "./Action.js";
import { ActionRegistry } from "./actions.js";
import { IActionPayload } from "../core/types.js";
import { Chronicle } from "../core/Chronicle.js";
import type { IChronicle } from '../core/IChronicle.js';
import { GameLoop } from "./GameLoop.js";
import { RuleEngine } from "./RuleEngine.js";
import { IEngineAgent, IGameState, ITransaction, IEngineSnapshot, IEngineState } from "./types.js";
import type { INetworkConnection } from "../core/ConsensusCore.js";
import type { ConsensusCore } from "../core/ConsensusCore.js";
import type { MessageCodec, CodecConfig } from "../network/MessageCodec.js";
import type { ReconnectConfig } from "../network/PeerConnection.js";
import { HistoryManager } from "./HistoryManager.js";
import { NetworkManager } from "./NetworkManager.js";
import { globalProfiler } from "../benchmark/ActionProfiler.js";

export interface EngineNetworkOptions {
  codec?: MessageCodec | Partial<CodecConfig>;
  reconnect?: Partial<ReconnectConfig> | false;
  messageBufferSize?: number;
}

export interface EngineOptions {
  stack?: Stack | null;
  space?: Space | null;
  source?: Source | null;
  autoConnect?: string;
  useWebRTC?: boolean;
  networkOptions?: EngineNetworkOptions;
}

export type DispatchErrorCode =
  | "UNKNOWN_ACTION"
  | "ACTION_HANDLER_ERROR";

export interface DispatchSuccess<T = unknown> {
  ok: true;
  result: T;
}

export interface DispatchFailure {
  ok: false;
  error: {
    code: DispatchErrorCode;
    message: string;
  };
}

export type DispatchOutcome<T = unknown> = DispatchSuccess<T> | DispatchFailure;

export class DispatchError extends Error {
  readonly code: DispatchErrorCode;
  readonly actionId: string;

  constructor(code: DispatchErrorCode, message: string, actionId: string, cause?: unknown) {
    super(message, cause === undefined ? undefined : { cause });
    this.name = "DispatchError";
    this.code = code;
    this.actionId = actionId;
  }
}

export class Engine extends Emitter {
  stack: Stack | null;
  space: Space;
  source: Source | null;

  session: IChronicle;
  loop: GameLoop;
  eventBus: Emitter;
  ruleEngine?: RuleEngine;
  _policies: Map<string, any>;
  debug: boolean;

  readonly historyManager: HistoryManager;
  readonly net: NetworkManager;

  private _useWebRTC: boolean;
  private _networkOptions: EngineNetworkOptions;

  constructor({ stack = null, space = null, source = null, autoConnect, useWebRTC = false, networkOptions = {} }: EngineOptions = {}) {
    super();

    this.session = new Chronicle();
    this.space = space ?? new Space(this.session as Chronicle, "main-space");
    this.stack = stack;
    this.source = source;
    this.eventBus = new Emitter();
    this._useWebRTC = useWebRTC;
    this._networkOptions = networkOptions;
    this._policies = new Map();
    this.debug = false;

    this.historyManager = new HistoryManager();
    this.net = new NetworkManager();

    this.loop = new GameLoop(this);
    this.session.on("state:changed", (e: any) => this.emit("state:updated", e));

    if (autoConnect) {
      this.connect(autoConnect);
    }
  }

  // ── Public API compat getters ──────────────────────────────────────────────

  get history(): Action[] { return this.historyManager.history; }
  set history(v: Action[]) { this.historyManager.restoreHistory(v); }

  get future(): Action[] { return this.historyManager.future; }

  get network(): INetworkConnection | undefined { return this.net.network; }
  get sync(): ConsensusCore | undefined { return this.net.sync; }

  // ── State getters ──────────────────────────────────────────────────────────

  get _gameState(): IGameState {
    return (this.session.state as any).gameState ?? {};
  }

  get _agents(): IEngineAgent[] {
    return Object.values((this.session.state as any).agents ?? {}) as IEngineAgent[];
  }

  get _transactions(): ITransaction[] {
    return (this.session.state as any).transactions ?? [];
  }

  // ── RuleEngine ─────────────────────────────────────────────────────────────

  useRuleEngine(ruleEngine: RuleEngine): void {
    this.ruleEngine = ruleEngine;
  }

  // ── Network ────────────────────────────────────────────────────────────────

  connect(url: string): void {
    this.net.connect(url, this.session, this, {
      useWebRTC: this._useWebRTC,
      codec: this._networkOptions.codec,
      reconnect: this._networkOptions.reconnect,
      messageBufferSize: this._networkOptions.messageBufferSize,
    });
  }

  disconnect(): void {
    this.net.disconnect();
  }

  // ── Lifecycle ──────────────────────────────────────────────────────────────

  async shutdown(): Promise<void> {
    this.net.disconnect();
    this._policies.clear();
    this.historyManager.clear();
    this.emit('engine:shutdown');
  }

  // ── Policies ───────────────────────────────────────────────────────────────

  registerPolicy(name: string, policy: any): this {
    this._policies.set(name, policy);
    this.emit("engine:policy", { payload: { name } });
    return this;
  }

  // ── Dispatch ───────────────────────────────────────────────────────────────

  async dispatch(type: string, payload: IActionPayload = {}, opts: any = {}): Promise<any> {
    const action = new Action(type, payload, opts);
    return this._dispatchAction(action);
  }

  async dispatchChecked(type: string, payload: IActionPayload = {}, opts: any = {}): Promise<DispatchOutcome> {
    const action = new Action(type, payload, opts);

    try {
      const result = await this._dispatchAction(action);
      return { ok: true, result };
    } catch (err) {
      const dispatchError = err instanceof DispatchError
        ? err
        : new DispatchError("ACTION_HANDLER_ERROR", this._errorMessage(err), action.id, err);
      return {
        ok: false,
        error: {
          code: dispatchError.code,
          message: dispatchError.message,
        },
      };
    }
  }

  private _dispatchAction(action: Action): Promise<any> {
    const { type, payload } = action;
    if (this.debug) console.log("🧩 dispatch:", type, payload);

    // Only snapshot at checkpoint intervals (fixes O(n²) memory + CPU)
    const snapshot = this.historyManager.shouldCheckpoint()
      ? this.session.saveToBase64()
      : null;

    const result = this.apply(action);
    if (this._isPromiseLike(result)) {
      return Promise.resolve(result).then(resolved => this._recordSuccessfulAction(action, snapshot, resolved));
    }

    return Promise.resolve(this._recordSuccessfulAction(action, snapshot, result));
  }

  private _recordSuccessfulAction(action: Action, snapshot: string | null, result: unknown): unknown {
    this.historyManager.recordAction(action, snapshot);
    try {
      this.emit("engine:action", { payload: action });
    } catch (err) {
      // The handler has completed and history is committed. Listener failures
      // are post-commit errors and must not change the dispatch outcome.
      this._reportPostCommitError(action, "engine:action", err);
    }

    for (const [, policy] of this._policies) {
      try {
        policy.evaluate(this);
      } catch (err) {
        this._reportPostCommitError(action, "policy", err, policy);
      }
    }

    return result;
  }

  apply(action: Action): any {
    const fn = ActionRegistry[action.type];
    if (fn) {
      try {
        const result = globalProfiler.record(action.type, () => fn(this, action.payload));
        if (this._isPromiseLike(result)) {
          return Promise.resolve(result).then(
            resolved => {
              action.result = resolved;
              return resolved;
            },
            err => {
              this.emit("engine:error", { payload: { action, err } });
              throw new DispatchError("ACTION_HANDLER_ERROR", this._errorMessage(err), action.id, err);
            },
          );
        }
        action.result = result;
        return result;
      } catch (err) {
        this.emit("engine:error", { payload: { action, err } });
        throw new DispatchError("ACTION_HANDLER_ERROR", this._errorMessage(err), action.id, err);
      }
    } else {
      this.emit("engine:error", { payload: { action, msg: "Unknown action" } });
      throw new DispatchError("UNKNOWN_ACTION", `Unknown action: ${action.type}`, action.id);
    }
  }

  private _isPromiseLike(value: unknown): value is PromiseLike<unknown> {
    return (
      (typeof value === "object" && value !== null) || typeof value === "function"
    ) && typeof (value as PromiseLike<unknown>).then === "function";
  }

  private _errorMessage(err: unknown): string {
    return err instanceof Error ? err.message : String(err);
  }

  private _reportPostCommitError(action: Action, phase: string, err: unknown, policy?: unknown): void {
    try {
      this.emit("engine:error", {
        payload: { action, phase, err, ...(policy === undefined ? {} : { policy }), postCommit: true },
      });
    } catch (reportingError) {
      if (this.debug) {
        console.error(`[Engine] Post-commit ${phase} error:`, err, reportingError);
      }
    }
  }

  // ── Undo / Redo ────────────────────────────────────────────────────────────

  undo(): Action | null {
    const action = this.historyManager.undo(this.session);
    if (!action) return null;
    this.emit("engine:undo", { payload: action });
    return action;
  }

  // ── Snapshot / Restore ─────────────────────────────────────────────────────

  snapshot(): IEngineSnapshot {
    return {
      stack: this.stack?.toJSON?.() ?? null,
      space: this.space.snapshot(),
      source: this.source?.toJSON?.() ?? null,
      history: this.historyManager.history.map(a => a.toJSON()),
      policies: Array.from(this._policies.keys()),
      crdt: this.session.saveToBase64()
    };
  }

  toJSON(): IEngineSnapshot { return this.snapshot(); }

  restore(snapshot: IEngineSnapshot): this {
    if (!snapshot) return this;
    if (snapshot.crdt) {
      this.session.loadFromBase64(snapshot.crdt);
    }
    this.history = snapshot.history ?? [];
    this.emit("engine:restored", { payload: { history: this.historyManager.history.length } });
    return this;
  }

  // ── Compaction / Fork / Merge ──────────────────────────────────────────────

  /**
   * Compact the CRDT document by discarding history.
   * Creates a fresh document from current state, dropping all change history.
   * This dramatically reduces document size (e.g., 208 KB → 0.1 KB at 100k ops).
   *
   * Important: After compaction, the document cannot merge with pre-compaction
   * documents. All peers must compact at the same point (epoch boundary).
   * Use this at game-phase boundaries or when document size becomes problematic.
   */
  compact(): void {
    this.session.newEpoch();
    // Clear history — old snapshots are invalid after compaction
    this.historyManager.clear();
    this.emit("engine:compacted", {});
  }

  /**
   * Fork the engine: create a divergent copy with its own CRDT branch.
   * Changes to the fork can be merged back via mergeFrom().
   *
   * The fork shares ancestry with the original, so divergent changes merge
   * via CRDT conflict resolution (last-write-wins for scalars, CRDT semantics
   * for collections).
   *
   * Use case: explore alternative game timelines, "what-if" scenarios.
   */
  fork(): Engine {
    const forkedSession = this.session.fork();
    const forkedEngine = new Engine(); // fork uses TS path
    forkedEngine.session = forkedSession as any;
    forkedEngine.space = new Space(forkedSession as any, "main-space");
    // Copy current state references — Stack/Source are stateless views over the session
    forkedEngine.stack = this.stack;
    forkedEngine.source = this.source;
    return forkedEngine;
  }

  /**
   * Merge changes from a forked engine back into this one.
   * CRDT conflict resolution handles divergent changes automatically.
   */
  mergeFrom(fork: Engine): void {
    this.session.merge(fork.session);
    this.emit("engine:merged", { from: fork });
    this.emit("state:updated", { source: "merge" });
  }

  // ── Persistence (StorageAdapter) ──────────────────────────────────────────

  private _storageAdapter: any = null;
  private _autoSaveTimer: any = null;

  /**
   * Attach a storage adapter for persistence.
   * After attaching, call persist() to save or resume() to load.
   *
   * @param adapter - StorageAdapter instance (FilesystemAdapter, IndexedDBAdapter, etc.)
   */
  useStorage(adapter: any): this {
    this._storageAdapter = adapter;
    return this;
  }

  /**
   * Save the current game state to the storage adapter.
   *
   * @param name - Unique name for this save (default: 'autosave')
   * @param description - Optional description
   */
  async persist(name: string = 'autosave', description?: string): Promise<void> {
    if (!this._storageAdapter) throw new Error('No storage adapter attached. Call engine.useStorage(adapter) first.');
    const data = this.session.saveToBase64();
    await this._storageAdapter.save(name, data, description);
    this.emit('engine:saved', { payload: { name } });
  }

  /**
   * Load a saved game state from the storage adapter.
   *
   * @param name - Name of the save to load (default: 'autosave')
   * @returns true if a save was found and loaded, false if no save exists
   */
  async resume(name: string = 'autosave'): Promise<boolean> {
    if (!this._storageAdapter) throw new Error('No storage adapter attached. Call engine.useStorage(adapter) first.');
    const saved = await this._storageAdapter.load(name);
    if (!saved) return false;
    this.session.loadFromBase64(saved.data);
    this.emit('engine:restored', { payload: { name, timestamp: saved.metadata.timestamp } });
    return true;
  }

  /**
   * List all saved games.
   */
  async listSaves(): Promise<any[]> {
    if (!this._storageAdapter) throw new Error('No storage adapter attached. Call engine.useStorage(adapter) first.');
    return this._storageAdapter.list();
  }

  /**
   * Delete a saved game.
   */
  async deleteSave(name: string): Promise<void> {
    if (!this._storageAdapter) throw new Error('No storage adapter attached. Call engine.useStorage(adapter) first.');
    await this._storageAdapter.delete(name);
    this.emit('engine:saveDeleted', { payload: { name } });
  }

  /**
   * Enable auto-save at a regular interval.
   *
   * @param intervalMs - Interval in milliseconds (default: 30000)
   * @param name - Save name (default: 'autosave')
   */
  enableAutoSave(intervalMs: number = 30000, name: string = 'autosave'): this {
    if (this._autoSaveTimer) clearInterval(this._autoSaveTimer);
    this._autoSaveTimer = setInterval(() => {
      this.persist(name).catch(err => {
        if (this.debug) console.warn('[Engine] Auto-save failed:', err.message);
      });
    }, intervalMs);
    return this;
  }

  /**
   * Disable auto-save.
   */
  disableAutoSave(): this {
    if (this._autoSaveTimer) {
      clearInterval(this._autoSaveTimer);
      this._autoSaveTimer = null;
    }
    return this;
  }

  // ── State / Describe ───────────────────────────────────────────────────────

  get state(): IEngineState {
    return {
      version: "2.0.0-crdt",
      turn: this._gameState.turn ?? null,
      agents: this._agents,
      stack: this.stack,
      space: this.space,
      source: this.source
    };
  }

  describe({ detail = false } = {}): any {
    const { stack, space, source } = this;
    const agents = this.state.agents?.map((p: any) => ({
      name: p.name,
      inventoryCount: p.inventory?.length ?? 0,
      discardCount: p.discard?.length ?? 0,
      turns: p.turns ?? 0,
      active: p.active ?? false
    })) ?? [];

    const summary = {
      version: this.state.version,
      turn: this.state.turn ?? null,
      agents,
      stack: stack ? { remaining: stack.size, drawn: stack.drawn?.length ?? 0 } : null,
      space: space ? { zones: space.zones, totalPlacements: space.cards().length } : null,
      source: source ? { remaining: source.tokens?.length ?? 0, burned: source.burned?.length ?? 0, policy: source.policy ?? null } : null
    };

    if (!detail) return summary;
    return {
      ...summary,
      stackState: stack?.toJSON?.() ?? null,
      spaceState: space?.snapshot?.() ?? null,
      sourceState: source?.inspect?.() ?? null
    };
  }
}
