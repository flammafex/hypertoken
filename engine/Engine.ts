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
import { PeerConnection } from "../network/PeerConnection.js";
import { HybridPeerManager } from "../network/HybridPeerManager.js";
import { ConsensusCore, INetworkConnection } from "../core/ConsensusCore.js";
import { GameLoop } from "./GameLoop.js";
import { RuleEngine } from "./RuleEngine.js"; // Added RuleEngine
import { EventBus } from "../core/EventBus.js";
import { IEngineAgent, IGameState, ITransaction, IEngineSnapshot, IEngineState } from "./types.js";
import { tryLoadWasm, isWasmAvailable, getWasmModule, type WasmActionDispatcher } from "../core/WasmBridge.js";
import type { StackWasm } from "../core/StackWasm.js";
import type { SpaceWasm } from "../core/SpaceWasm.js";
import type { SourceWasm } from "../core/SourceWasm.js";
import { WasmWorker } from "../core/WasmWorker.js";

export interface EngineOptions {
  stack?: Stack | null;
  space?: Space | null;
  source?: Source | null;
  autoConnect?: string;
  useWebRTC?: boolean; // Enable WebRTC with automatic fallback
  useWorker?: boolean; // Enable multi-threaded WASM worker (Phase 4)
  workerOptions?: {
    debug?: boolean;
    timeout?: number;
    enableBatching?: boolean;
    batchWindow?: number;
  };
}

export class Engine extends Emitter {
  stack: Stack | null;
  space: Space;
  source: Source | null;

  session: Chronicle;
  network?: INetworkConnection; // Can be PeerConnection or HybridPeerManager
  sync?: ConsensusCore;
  loop: GameLoop;

  // Local event dispatcher for tests and plugins
  eventBus: EventBus;

  // Exposed RuleEngine
  ruleEngine?: RuleEngine;

  history: Action[];
  future: Action[];
  _policies: Map<string, any>;

  _agents: IEngineAgent[];
  _gameState: IGameState;
  _transactions: ITransaction[];
  debug: boolean;

  private useWebRTC: boolean;
  private _wasmDispatcher: WasmActionDispatcher | null = null;
  private _wasmWorker: WasmWorker | null = null;
  private _useWorker: boolean = false;

  constructor({ stack = null, space = null, source = null, autoConnect, useWebRTC = false, useWorker = false, workerOptions = {} }: EngineOptions = {}) {
    super();

    this.session = new Chronicle();
    this.space = space ?? new Space(this.session, "main-space");
    this.stack = stack;
    this.source = source;
    this.loop = new GameLoop(this);
    this.eventBus = new EventBus();
    this.useWebRTC = useWebRTC;

    this.history = [];
    this.future = [];
    this._policies = new Map();
    this.debug = false;

    this._agents = [];
    this._gameState = {};
    this._transactions = [];

    this.session.on("state:changed", (e) => this.emit("state:updated", e));

    // Initialize worker mode or direct WASM dispatcher
    this._useWorker = useWorker;
    if (useWorker) {
      this._initializeWorker(workerOptions);
    } else {
      // Initialize WASM ActionDispatcher if components support it
      this._initializeWasmDispatcher();
    }

    if (autoConnect) {
      this.connect(autoConnect);
    }
  }

  /**
   * Initialize WasmWorker for multi-threaded execution
   */
  private async _initializeWorker(options: EngineOptions['workerOptions'] = {}): Promise<void> {
    try {
      this._wasmWorker = new WasmWorker({
        debug: options.debug ?? this.debug,
        timeout: options.timeout,
        enableBatching: options.enableBatching,
        batchWindow: options.batchWindow,
      });

      await this._wasmWorker.init();

      // Forward worker events to engine events
      this._wasmWorker.on('state_changed', (payload) => {
        this.emit('state:updated', payload);
      });

      this._wasmWorker.on('action_completed', (payload) => {
        this.emit('engine:action', { payload });
      });

      this._wasmWorker.on('error', (error) => {
        this.emit('engine:error', { payload: { error } });
      });

      if (this.debug) {
        console.log('✅ Engine: WasmWorker initialized');
      }
    } catch (error) {
      console.error('❌ Engine: WasmWorker initialization failed:', error);
      this._useWorker = false;
      this._wasmWorker = null;
      // Fall back to direct WASM dispatcher
      this._initializeWasmDispatcher();
    }
  }

  /**
   * Initialize WASM ActionDispatcher if WASM is available
   */
  private _initializeWasmDispatcher(): void {
    if (!isWasmAvailable()) {
      // Try async load
      this._tryLoadWasmDispatcherAsync();
      return;
    }

    try {
      const wasm = getWasmModule();
      if (!wasm) return;

      this._wasmDispatcher = new wasm.ActionDispatcher();

      // Set WASM instances if available
      if (this.stack && 'wasmInstance' in this.stack) {
        const wasmStack = (this.stack as StackWasm).wasmInstance;
        if (wasmStack) {
          this._wasmDispatcher.setStack(wasmStack);
        }
      }

      if (this.space && 'wasmInstance' in this.space) {
        const wasmSpace = (this.space as SpaceWasm).wasmInstance;
        if (wasmSpace) {
          this._wasmDispatcher.setSpace(wasmSpace);
        }
      }

      if (this.source && 'wasmInstance' in this.source) {
        const wasmSource = (this.source as SourceWasm).wasmInstance;
        if (wasmSource) {
          this._wasmDispatcher.setSource(wasmSource);
        }
      }

      if (this.debug) {
        console.log('✅ WASM ActionDispatcher initialized');
      }
    } catch (error) {
      if (this.debug) {
        console.warn('⚠️  WASM ActionDispatcher initialization failed:', error);
      }
    }
  }

  /**
   * Try to load WASM dispatcher asynchronously
   */
  private async _tryLoadWasmDispatcherAsync(): Promise<void> {
    try {
      const wasm = await tryLoadWasm();
      if (!wasm || this._wasmDispatcher) return;

      this._wasmDispatcher = new wasm.ActionDispatcher();

      // Set WASM instances if available
      if (this.stack && 'wasmInstance' in this.stack) {
        const wasmStack = (this.stack as StackWasm).wasmInstance;
        if (wasmStack) {
          this._wasmDispatcher.setStack(wasmStack);
        }
      }

      if (this.space && 'wasmInstance' in this.space) {
        const wasmSpace = (this.space as SpaceWasm).wasmInstance;
        if (wasmSpace) {
          this._wasmDispatcher.setSpace(wasmSpace);
        }
      }

      if (this.source && 'wasmInstance' in this.source) {
        const wasmSource = (this.source as SourceWasm).wasmInstance;
        if (wasmSource) {
          this._wasmDispatcher.setSource(wasmSource);
        }
      }

      if (this.debug) {
        console.log('✅ WASM ActionDispatcher initialized (async)');
      }
    } catch (error) {
      // Silently fail - fallback to TypeScript
    }
  }

  // Add helper to attach a RuleEngine
  useRuleEngine(ruleEngine: RuleEngine) {
    this.ruleEngine = ruleEngine;
  }

  connect(url: string): void {
    if (this.network) return;

    if (this.useWebRTC) {
      console.log(`[Engine] Connecting to ${url} with WebRTC support...`);
      this.network = new HybridPeerManager({
        url,
        autoUpgrade: true,
        upgradeDelay: 1000
      });
    } else {
      console.log(`[Engine] Connecting to ${url} (WebSocket only)...`);
      this.network = new PeerConnection(url, this);
    }

    this.sync = new ConsensusCore(this.session, this.network);
    this.network.connect();

    // Forward network events
    this.network.on("net:ready", (e) => this.emit("net:ready", e));
    this.network.on("net:peer:connected", (e) => this.emit("net:peer:connected", e));

    // Forward WebRTC-specific events if using HybridPeerManager
    if (this.useWebRTC) {
      this.network.on("rtc:upgraded", (e) => {
        console.log(`[Engine] WebRTC connection established with peer`);
        this.emit("rtc:upgraded", e);
      });
      this.network.on("rtc:downgraded", (e) => {
        console.log(`[Engine] WebRTC connection lost, using WebSocket`);
        this.emit("rtc:downgraded", e);
      });
    }
  }

  disconnect(): void {
    this.network?.disconnect();
    this.network = undefined;
    this.sync = undefined;
  }

  /**
   * Shutdown the engine and cleanup resources
   */
  async shutdown(): Promise<void> {
    // Disconnect network
    this.disconnect();

    // Terminate worker
    if (this._wasmWorker) {
      await this._wasmWorker.terminate();
      this._wasmWorker = null;
      this._useWorker = false;
    }

    // Clear policies and history
    this._policies.clear();
    this.history = [];
    this.future = [];

    this.emit('engine:shutdown');
  }

  registerPolicy(name: string, policy: any): this {
    this._policies.set(name, policy);
    this.emit("engine:policy", { payload: { name } });
    return this;
  }

  unregisterPolicy(name: string): this {
    this._policies.delete(name);
    this.emit("engine:policy:removed", { payload: { name } });
    return this;
  }

  clearPolicies(): this {
    this._policies.clear();
    this.emit("engine:policy:cleared");
    return this;
  }

  /**
   * Dispatch an action (synchronous version for backward compatibility)
   *
   * @deprecated When using worker mode, prefer dispatchAsync() for better performance
   */
  dispatch(type: string, payload: IActionPayload = {}, opts: any = {}): any {
    // If worker mode is enabled, use async dispatch but block
    if (this._useWorker && this._wasmWorker) {
      // This is a blocking call - not ideal, but maintains backward compatibility
      console.warn('⚠️  Synchronous dispatch() called in worker mode. Consider using dispatchAsync() for better performance.');
      // For now, fall through to sync execution
    }

    const action = new Action(type, payload, opts);
    if (this.debug) console.log("🧩 dispatch:", type, payload);

    const result = this.apply(action);
    this.history.push(action);
    this.emit("engine:action", { payload: action });

    for (const [, policy] of this._policies) {
      try {
        policy.evaluate(this);
      } catch (err) {
        this.emit("engine:error", { payload: { policy, err } });
      }
    }

    return result;
  }

  /**
   * Dispatch an action asynchronously (worker-optimized)
   *
   * Use this method when worker mode is enabled for best performance.
   * Falls back to synchronous execution if worker is not available.
   */
  async dispatchAsync(type: string, payload: IActionPayload = {}, opts: any = {}): Promise<any> {
    const action = new Action(type, payload, opts);
    if (this.debug) console.log("🧩 dispatchAsync:", type, payload);

    let result: any;

    // Use worker if available
    if (this._useWorker && this._wasmWorker && this._wasmWorker.ready) {
      try {
        result = await this._wasmWorker.dispatch(type, payload);
        action.result = result;
      } catch (error) {
        if (this.debug) {
          console.log('⚠️  Worker dispatch failed, falling back to sync:', error);
        }
        // Fall back to sync execution
        result = this.apply(action);
      }
    } else {
      // Sync fallback
      result = this.apply(action);
    }

    this.history.push(action);
    this.emit("engine:action", { payload: action });

    // Evaluate policies
    for (const [, policy] of this._policies) {
      try {
        policy.evaluate(this);
      } catch (err) {
        this.emit("engine:error", { payload: { policy, err } });
      }
    }

    return result;
  }

  // Actions implemented in WASM ActionDispatcher
  private static readonly WASM_ACTIONS = new Set([
    "stack:draw", "stack:peek", "stack:shuffle", "stack:burn", "stack:reset",
    "stack:cut", "stack:insertAt", "stack:removeAt", "stack:swap",
    "space:place", "space:remove", "space:move", "space:flip",
    "space:createZone", "space:deleteZone", "space:clearZone",
    "space:lockZone", "space:shuffleZone",
    "source:draw", "source:shuffle", "source:burn",
    "debug:log"
  ]);

  apply(action: Action): any {
    // NOTE: WASM ActionDispatcher is currently disabled because:
    // 1. StackWasm/SpaceWasm/SourceWasm already bypass Chronicle for WASM ops
    // 2. ActionDispatcher adds JSON serialization overhead without benefit
    // 3. The architecture needs rethinking for better integration
    //
    // The infrastructure is in place (ActionDispatcher in Rust, WasmBridge types,
    // wasmInstance getters) for future experimentation with batched operations
    // or other optimization strategies.

    const fn = ActionRegistry[action.type];
    if (fn) {
      try {
        const result = fn(this, action.payload);
        action.result = result;
        return result;
      } catch (err) {
        this.emit("engine:error", { payload: { action, err } });
        return undefined;
      }
    } else {
      this.emit("engine:error", { payload: { action, msg: "Unknown action" } });
      return undefined;
    }
  }

  undo(): Action | null {
    const last = this.history.pop();
    if (!last || !last.reversible) return null;
    this.future.push(last);
    this.emit("engine:undo", { payload: last });
    return last;
  }

  redo(): Action | null {
    const next = this.future.pop();
    if (!next) return null;
    this.apply(next);
    this.history.push(next);
    this.emit("engine:redo", { payload: next });
    return next;
  }

  snapshot(): IEngineSnapshot {
    return {
      stack: this.stack?.toJSON?.() ?? null,
      space: this.space.snapshot(),
      source: this.source?.toJSON?.() ?? null,
      history: this.history.map(a => a.toJSON()),
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
    // Local history isn't synced via CRDT, so we trust the snapshot
    this.history = snapshot.history ?? [];
    // Policies are code, not state, so we just list them. 
    // Logic must be re-registered by the application layer.
    this.emit("engine:restored", { payload: { history: this.history.length } });
    return this;
  }

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
      handCount: p.hand?.length ?? 0,
      discardCount: p.discard?.length ?? 0,
      turns: p.turns ?? 0,
      active: p.active ?? false
    })) ?? [];

    const summary = {
      version: this.state.version,
      turn: this.state.turn ?? null,
      agents,
      stack: stack
        ? { remaining: stack.size, drawn: stack.drawn?.length ?? 0 }
        : null,
      space: space
        ? {
            zones: space.zones, 
            totalPlacements: space.cards().length
          }
        : null,
      source: source
        ? {
            remaining: source.tokens?.length ?? 0,
            burned: source.burned?.length ?? 0,
            policy: source.policy ?? null
          }
        : null
    };

    if (!detail) return summary;

    return {
      ...summary,
      stackState: stack?.toJSON?.() ?? null,
      spaceState: space?.snapshot?.() ?? null,
      sourceState: source?.inspect?.() ?? null
    };
  }

  availableActions(): any[] {
    const actions = [];
    if (this.state.stack) {
      actions.push(
        { type: "stack:draw", payload: { count: 1 } },
        { type: "stack:shuffle", payload: {} },
        { type: "stack:reset", payload: {} }
      );
    }
    if (this.state.space) {
      actions.push(
        { type: "space:place", payload: { zone: "altar" } },
        { type: "space:clear", payload: {} }
      );
    }
    if (this.state.source) {
      actions.push(
        { type: "source:draw", payload: { count: 1 } },
        { type: "source:shuffle", payload: {} }
      );
    }
    actions.push(
      { type: "loop:start", payload: {} },
      { type: "loop:stop", payload: {} }
    );
    return actions;
  }
}