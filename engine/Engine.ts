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
import { WasmChronicleAdapter } from '../core/WasmChronicleAdapter.js';
import { PeerConnection, PeerConnectionOptions, ReconnectConfig } from "../network/PeerConnection.js";
import { HybridPeerManager, HybridPeerManagerOptions } from "../network/HybridPeerManager.js";
import { ConsensusCore, INetworkConnection } from "../core/ConsensusCore.js";
import { MessageCodec, CodecConfig } from "../network/MessageCodec.js";
import { GameLoop } from "./GameLoop.js";
import { RuleEngine } from "./RuleEngine.js";
import { IEngineAgent, IGameState, ITransaction, IEngineSnapshot, IEngineState } from "./types.js";
import { tryLoadWasm, isWasmAvailable, getWasmModule, type WasmActionDispatcher } from "../core/WasmBridge.js";
import type { StackWasm } from "../core/StackWasm.js";
import type { SpaceWasm } from "../core/SpaceWasm.js";
import type { SourceWasm } from "../core/SourceWasm.js";
import type { UniversalWorker } from "../core/UniversalWorker.js";

/**
 * Network configuration options for Engine
 */
export interface EngineNetworkOptions {
  /** Message codec configuration (default: JSON for compatibility) */
  codec?: MessageCodec | Partial<CodecConfig>;
  /** Reconnection configuration (default: enabled with exponential backoff) */
  reconnect?: Partial<ReconnectConfig> | false;
  /** Maximum messages to buffer during reconnection (default: 100) */
  messageBufferSize?: number;
}

export interface EngineOptions {
  stack?: Stack | StackWasm | null;
  space?: Space | SpaceWasm | null;
  source?: Source | SourceWasm | null;
  autoConnect?: string;
  useWebRTC?: boolean; // Enable WebRTC with automatic fallback
  useWorker?: boolean; // Enable multi-threaded WASM worker (Phase 4)
  workerOptions?: {
    debug?: boolean;
    timeout?: number;
    enableBatching?: boolean;
    batchWindow?: number;
    // Browser-specific options
    workerPath?: string;  // Path to worker script (browser only)
    wasmPath?: string;    // Path to WASM files (browser only)
  };
  /** Network configuration options */
  networkOptions?: EngineNetworkOptions;
}

export class Engine extends Emitter {
  stack: Stack | StackWasm | null;
  space: Space | SpaceWasm;
  source: Source | SourceWasm | null;

  session: IChronicle;
  network?: INetworkConnection; // Can be PeerConnection or HybridPeerManager
  sync?: ConsensusCore;
  loop: GameLoop;

  // Local event dispatcher for tests and plugins
  eventBus: Emitter;

  // Exposed RuleEngine
  ruleEngine?: RuleEngine;

  history: Action[];
  future: Action[];
  private _snapshots: string[]; // CRDT snapshots for undo support
  _policies: Map<string, any>;

  _agents: IEngineAgent[];
  _gameState: IGameState;
  _transactions: ITransaction[];
  debug: boolean;

  private useWebRTC: boolean;
  private networkOptions: EngineNetworkOptions;
  private _wasmDispatcher: WasmActionDispatcher | null = null;
  private _wasmWorker: UniversalWorker | null = null;
  private _useWorker: boolean = false;

  constructor({ stack = null, space = null, source = null, autoConnect, useWebRTC = false, useWorker = false, workerOptions = {}, networkOptions = {} }: EngineOptions = {}) {
    super();

    this.session = new Chronicle();
    this.space = space ?? new Space(this.session as Chronicle, "main-space");
    this.stack = stack;
    this.source = source;
    this.eventBus = new Emitter();
    this.useWebRTC = useWebRTC;
    this.networkOptions = networkOptions;

    this.history = [];
    this.future = [];
    this._snapshots = [];
    this._policies = new Map();
    this.debug = false;

    this._agents = [];
    this._gameState = {};
    this._transactions = [];

    // GameLoop must be created after all fields are initialized,
    // because its constructor calls engine.dispatch() which accesses history/etc.
    this.loop = new GameLoop(this);

    this.session.on("state:changed", (e: any) => this.emit("state:updated", e));

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
   * Initialize UniversalWorker for multi-threaded execution
   *
   * Automatically detects the environment (Node.js vs Browser) and uses
   * the appropriate worker implementation:
   * - Node.js: WasmWorker (worker_threads)
   * - Browser: WebWorker (Web Workers API)
   */
  private async _initializeWorker(options: EngineOptions['workerOptions'] = {}): Promise<void> {
    try {
      const { UniversalWorker } = await import('../core/UniversalWorker.js');

      this._wasmWorker = new UniversalWorker({
        debug: options.debug ?? this.debug,
        timeout: options.timeout,
        enableBatching: options.enableBatching,
        batchWindow: options.batchWindow,
        // Browser-specific options
        workerPath: options.workerPath,
        wasmPath: options.wasmPath,
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
        const env = this._wasmWorker.environment;
        console.log(`✅ Engine: UniversalWorker initialized (${env} mode)`);
      }
    } catch (error) {
      console.error('❌ Engine: UniversalWorker initialization failed:', error);
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

      // Initialize WASM Chronicle with current TS state and swap session
      this._wasmDispatcher.initializeState(JSON.stringify(this.session.state));
      this.session = new WasmChronicleAdapter(this._wasmDispatcher);
      // Re-wire state:changed -> state:updated relay
      this.session.on("state:changed", (e: any) => this.emit("state:updated", e));

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

      // Initialize WASM Chronicle with current TS state and swap session
      this._wasmDispatcher.initializeState(JSON.stringify(this.session.state));
      this.session = new WasmChronicleAdapter(this._wasmDispatcher);
      // Re-wire state:changed -> state:updated relay
      this.session.on("state:changed", (e: any) => this.emit("state:updated", e));

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
    if (this._wasmDispatcher) {
      console.warn('[Engine] Network sync is not yet supported with WASM Chronicle backend');
      return;
    }

    // Build peer connection options from engine network config
    const peerOptions: PeerConnectionOptions = {
      codec: this.networkOptions.codec,
      reconnect: this.networkOptions.reconnect,
      messageBufferSize: this.networkOptions.messageBufferSize,
    };

    if (this.useWebRTC) {
      console.log(`[Engine] Connecting to ${url} with WebRTC support...`);
      this.network = new HybridPeerManager({
        url,
        autoUpgrade: true,
        upgradeDelay: 1000,
        reconnect: this.networkOptions.reconnect,
        peerConnectionOptions: peerOptions,
      });
    } else {
      console.log(`[Engine] Connecting to ${url} (WebSocket only)...`);
      this.network = new PeerConnection(url, this, peerOptions);
    }

    this.sync = new ConsensusCore(this.session as Chronicle, this.network);
    this.network.connect();

    // Forward network events
    this.network.on("net:ready", (e) => this.emit("net:ready", e));
    this.network.on("net:peer:connected", (e) => this.emit("net:peer:connected", e));
    this.network.on("net:peer:disconnected", (e) => this.emit("net:peer:disconnected", e));
    this.network.on("net:disconnected", (e) => this.emit("net:disconnected", e));
    this.network.on("net:error", (e) => this.emit("net:error", e));

    // Forward reconnection events
    this.network.on("net:reconnecting", (e) => {
      console.log(`[Engine] Reconnecting... (attempt ${e.payload?.attempt || 1})`);
      this.emit("net:reconnecting", e);
    });
    this.network.on("net:reconnected", (e) => {
      console.log(`[Engine] Reconnected successfully`);
      this.emit("net:reconnected", e);
    });

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
      this.network.on("rtc:connection-failed", (e) => this.emit("rtc:connection-failed", e));
      this.network.on("rtc:retrying", (e) => this.emit("rtc:retrying", e));
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
    this._snapshots = [];

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
   * Dispatch an action asynchronously
   *
   * Uses worker mode when enabled for best performance.
   * Falls back to synchronous execution if worker is not available.
   */
  async dispatch(type: string, payload: IActionPayload = {}, opts: any = {}): Promise<any> {
    const action = new Action(type, payload, opts);
    if (this.debug) console.log("🧩 dispatch:", type, payload);

    // Snapshot CRDT state before applying, for undo support
    const snapshot = this.session.saveToBase64();

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

    // Only record successful actions in history
    if (result !== Engine.ACTION_FAILED) {
      this.history.push(action);
      this._snapshots.push(snapshot);
      this.future = []; // Clear redo stack on new action to prevent timeline corruption
      this.emit("engine:action", { payload: action });

      // Evaluate policies
      for (const [, policy] of this._policies) {
        try {
          policy.evaluate(this);
        } catch (err) {
          this.emit("engine:error", { payload: { policy, err } });
        }
      }
    }

    return result === Engine.ACTION_FAILED ? undefined : result;
  }

  // Actions implemented in WASM ActionDispatcher
  private static readonly WASM_ACTIONS = new Set([
    // Stack actions (10)
    "stack:draw", "stack:peek", "stack:shuffle", "stack:burn", "stack:reset",
    "stack:cut", "stack:insertAt", "stack:removeAt", "stack:swap",
    "stack:reverse",
    // Space actions (14)
    "space:place", "space:remove", "space:move", "space:flip",
    "space:createZone", "space:deleteZone", "space:clearZone",
    "space:lockZone", "space:shuffleZone",
    "space:fanZone", "space:spreadZone", "space:stackZone", 
    "space:transferZone", "space:clear",
    // Source actions (7)
    "source:draw", "source:shuffle", "source:burn",
    "source:addStack", "source:removeStack", "source:reset", "source:inspect",
    // Agent actions (16)
    "agent:create", "agent:remove", "agent:setActive",
    "agent:giveResource", "agent:takeResource",
    "agent:addToken", "agent:removeToken", "agent:get",
    "agent:transferResource", "agent:transferToken",
    "agent:stealResource", "agent:stealToken", "agent:getAll",
    "agent:trade", "agent:drawCards", "agent:discardCards",
    // Token operations (5)
    "token:transform", "token:attach", "token:detach",
    "token:merge", "token:split",
    // GameLoop actions (6)
    "game:loopInit", "game:loopStart", "game:loopStop",
    "game:nextTurn", "game:setPhase", "game:setMaxTurns",
    // GameState actions (7)
    "game:start", "game:end", "game:pause", "game:resume",
    "game:nextPhase", "game:setProperty", "game:getState",
    // Rules actions (1) — rule:initRules stays TS-only (no WASM equivalent)
    "rule:markFired",
    // Batch operations (8)
    "tokens:shuffle", "tokens:draw", "tokens:filter", "tokens:map",
    "tokens:find", "tokens:count", "tokens:collect", "tokens:forEach",
    // Debug
    "debug:log"
  ]);

  /** Sentinel returned by apply() to distinguish errors from void results */
  private static readonly ACTION_FAILED = Symbol("ACTION_FAILED");

  apply(action: Action): any {
    // Try WASM ActionDispatcher first (zero overhead with typed methods)
    if (this._wasmDispatcher && Engine.WASM_ACTIONS.has(action.type)) {
      try {
        const result = this._dispatchWasm(action.type, action.payload);
        action.result = result;
        // Emit state:changed so GameLoop/RuleEngine can react
        this.session.emit("state:changed", { source: "dispatch" });
        return result;
      } catch (err) {
        if (this.debug) {
          console.log(`⚠️  WASM dispatch failed for ${action.type}, falling back to TypeScript:`, err);
        }
        // Fall through to TypeScript implementation
      }
    }

    // TypeScript ActionRegistry fallback
    const fn = ActionRegistry[action.type];
    if (fn) {
      try {
        const result = fn(this, action.payload);
        action.result = result;
        return result;
      } catch (err) {
        this.emit("engine:error", { payload: { action, err } });
        return Engine.ACTION_FAILED;
      }
    } else {
      this.emit("engine:error", { payload: { action, msg: "Unknown action" } });
      return Engine.ACTION_FAILED;
    }
  }

  /**
   * Dispatch using typed WASM ActionDispatcher methods (zero overhead)
   */
  private _dispatchWasm(type: string, payload: IActionPayload): any {
    if (!this._wasmDispatcher) {
      throw new Error("WASM ActionDispatcher not available");
    }

    const dispatcher = this._wasmDispatcher;

    // Stack actions
    if (type === "stack:draw") {
      const result = dispatcher.stackDraw(payload.count ?? 1);
      return JSON.parse(result);
    }
    if (type === "stack:peek") {
      const result = dispatcher.stackPeek(payload.count ?? 1);
      return JSON.parse(result);
    }
    if (type === "stack:shuffle") {
      dispatcher.stackShuffle(payload.seed !== undefined ? String(payload.seed) : undefined);
      return;
    }
    if (type === "stack:burn") {
      const result = dispatcher.stackBurn(payload.count ?? 1);
      return JSON.parse(result);
    }
    if (type === "stack:reset") {
      dispatcher.stackReset();
      return;
    }
    if (type === "stack:cut") {
      dispatcher.stackCut(payload.position ?? 0);
      return;
    }
    if (type === "stack:insertAt") {
      dispatcher.stackInsertAt(payload.position ?? 0, JSON.stringify(payload.card));
      return;
    }
    if (type === "stack:removeAt") {
      const result = dispatcher.stackRemoveAt(payload.position ?? 0);
      return JSON.parse(result);
    }
    if (type === "stack:swap") {
      dispatcher.stackSwap(payload.i!, payload.j!);
      return;
    }

    // Space actions
    if (type === "space:place") {
      const result = dispatcher.spacePlace(
        payload.zone!,
        JSON.stringify(payload.token),
        payload.x,
        payload.y
      );
      return JSON.parse(result);
    }
    if (type === "space:remove") {
      const result = dispatcher.spaceRemove(payload.zone!, payload.placementId!);
      return JSON.parse(result);
    }
    if (type === "space:move") {
      dispatcher.spaceMove(
        payload.placementId!,
        payload.fromZone!,
        payload.toZone!,
        payload.x,
        payload.y
      );
      return;
    }
    if (type === "space:flip") {
      dispatcher.spaceFlip(payload.zone!, payload.placementId!);
      return;
    }
    if (type === "space:createZone") {
      dispatcher.spaceCreateZone(payload.name!);
      return;
    }
    if (type === "space:deleteZone") {
      dispatcher.spaceDeleteZone(payload.name!);
      return;
    }
    if (type === "space:clearZone") {
      dispatcher.spaceClearZone(payload.zone!);
      return;
    }
    if (type === "space:lockZone") {
      dispatcher.spaceLockZone(payload.zone!, payload.locked ?? true);
      return;
    }
    if (type === "space:shuffleZone") {
      dispatcher.spaceShuffleZone(
        payload.zone!,
        payload.seed !== undefined ? String(payload.seed) : undefined
      );
      return;
    }

    // Source actions
    if (type === "source:draw") {
      const result = dispatcher.sourceDraw(payload.count ?? 1);
      return JSON.parse(result);
    }
    if (type === "source:shuffle") {
      dispatcher.sourceShuffle(payload.seed !== undefined ? String(payload.seed) : undefined);
      return;
    }
    if (type === "source:burn") {
      const result = dispatcher.sourceBurn(payload.count ?? 1);
      return JSON.parse(result);
    }

    // Agent actions
    if (type === "agent:create") {
      const result = dispatcher.agentCreate(
        payload.id!,
        payload.name!,
        payload.meta ? JSON.stringify(payload.meta) : undefined
      );
      return JSON.parse(result);
    }
    if (type === "agent:remove") {
      dispatcher.agentRemove(payload.name!);
      return;
    }
    if (type === "agent:setActive") {
      dispatcher.agentSetActive(payload.name!, payload.active ?? true);
      return;
    }
    if (type === "agent:giveResource") {
      dispatcher.agentGiveResource(payload.name!, payload.resource!, payload.amount ?? 1);
      return;
    }
    if (type === "agent:takeResource") {
      dispatcher.agentTakeResource(payload.name!, payload.resource!, payload.amount ?? 1);
      return;
    }
    if (type === "agent:addToken") {
      dispatcher.agentAddToken(payload.name!, JSON.stringify(payload.token));
      return;
    }
    if (type === "agent:removeToken") {
      const result = dispatcher.agentRemoveToken(payload.name!, payload.tokenId!);
      return JSON.parse(result);
    }
    if (type === "agent:get") {
      const result = dispatcher.agentGet(payload.name!);
      return JSON.parse(result);
    }
    if (type === "agent:transferResource") {
      const result = dispatcher.agentTransferResource(
        payload.from!,
        payload.to!,
        payload.resource!,
        payload.amount ?? 1
      );
      return JSON.parse(result);
    }
    if (type === "agent:transferToken") {
      const result = dispatcher.agentTransferToken(
        payload.from!,
        payload.to!,
        payload.tokenId!
      );
      return JSON.parse(result);
    }
    if (type === "agent:stealResource") {
      const result = dispatcher.agentStealResource(
        payload.from!,
        payload.to!,
        payload.resource!,
        payload.amount ?? 1
      );
      return JSON.parse(result);
    }
    if (type === "agent:stealToken") {
      const result = dispatcher.agentStealToken(
        payload.from!,
        payload.to!,
        payload.tokenId!
      );
      return JSON.parse(result);
    }
    if (type === "agent:getAll") {
      const result = dispatcher.agentGetAll();
      return JSON.parse(result);
    }

    // Token operations
    if (type === "token:transform") {
      const result = dispatcher.tokenTransform(
        JSON.stringify(payload.token),
        JSON.stringify(payload.properties ?? {})
      );
      return JSON.parse(result);
    }
    if (type === "token:attach") {
      const result = dispatcher.tokenAttach(
        JSON.stringify(payload.host),
        JSON.stringify(payload.attachment),
        payload.attachmentType ?? "default"
      );
      return JSON.parse(result);
    }
    if (type === "token:detach") {
      const result = dispatcher.tokenDetach(
        JSON.stringify(payload.host),
        payload.attachmentId!
      );
      return JSON.parse(result);
    }
    if (type === "token:merge") {
      const result = dispatcher.tokenMerge(
        JSON.stringify(payload.tokens),
        payload.properties ? JSON.stringify(payload.properties) : undefined,
        payload.keepOriginals ?? false
      );
      return JSON.parse(result);
    }
    if (type === "token:split") {
      const result = dispatcher.tokenSplit(
        JSON.stringify(payload.token),
        payload.count ?? 2,
        payload.propertiesArray ? JSON.stringify(payload.propertiesArray) : undefined
      );
      return JSON.parse(result);
    }

    // GameLoop actions
    if (type === "game:loopInit") {
      dispatcher.gameLoopInit(payload.maxTurns ?? 100);
      return;
    }
    if (type === "game:loopStart") {
      dispatcher.gameLoopStart();
      return;
    }
    if (type === "game:loopStop") {
      dispatcher.gameLoopStop(payload.phase ?? "stopped");
      return;
    }
    if (type === "game:nextTurn") {
      dispatcher.gameLoopNextTurn(payload.agentCount ?? 0);
      return;
    }
    if (type === "game:setPhase") {
      dispatcher.gameLoopSetPhase(payload.phase);
      return;
    }
    if (type === "game:setMaxTurns") {
      dispatcher.gameLoopInit(payload.maxTurns ?? 100);
      return;
    }

    // GameState actions
    if (type === "game:start") {
      const result = dispatcher.gameStart();
      return JSON.parse(result);
    }
    if (type === "game:end") {
      const result = dispatcher.gameEnd(
        payload.winner ? String(payload.winner) : undefined,
        payload.reason ? String(payload.reason) : undefined
      );
      return JSON.parse(result);
    }
    if (type === "game:pause") {
      const result = dispatcher.gamePause();
      return JSON.parse(result);
    }
    if (type === "game:resume") {
      const result = dispatcher.gameResume();
      return JSON.parse(result);
    }
    if (type === "game:nextPhase") {
      const result = dispatcher.gameNextPhase(
        payload.phase ? String(payload.phase) : undefined
      );
      return JSON.parse(result);
    }
    if (type === "game:setProperty") {
      const result = dispatcher.gameSetProperty(
        payload.key!,
        JSON.stringify(payload.value)
      );
      return JSON.parse(result);
    }
    if (type === "game:getState") {
      const result = dispatcher.gameGetState();
      return JSON.parse(result);
    }

    // Rules actions
    if (type === "rule:markFired") {
      dispatcher.ruleMarkFired(payload.name, payload.timestamp ?? Date.now());
      return;
    }
    // Batch operations
    if (type === "tokens:shuffle") {
      const result = dispatcher.batchShuffle(
        JSON.stringify(payload.decks),
        payload.seed ? String(payload.seed) : undefined
      );
      return JSON.parse(result);
    }
    if (type === "tokens:draw") {
      const result = dispatcher.batchDraw(
        JSON.stringify(payload.decks),
        JSON.stringify(payload.counts)
      );
      return JSON.parse(result);
    }
    if (type === "tokens:filter") {
      const result = dispatcher.batchFilter(
        JSON.stringify(payload.tokens),
        payload.predicate ?? "reversed"
      );
      return JSON.parse(result);
    }
    if (type === "tokens:map") {
      const result = dispatcher.batchMap(
        JSON.stringify(payload.tokens),
        payload.operation ?? "flip"
      );
      return JSON.parse(result);
    }

    throw new Error(`Unknown WASM action type: ${type}`);
  }

  undo(): Action | null {
    const last = this.history.pop();
    if (!last || !last.reversible) {
      // Put it back if it exists but isn't reversible
      if (last) this.history.push(last);
      return null;
    }
    const snapshot = this._snapshots.pop();
    if (snapshot) {
      this.session.loadFromBase64(snapshot);
    }
    this.future.push(last);
    this.emit("engine:undo", { payload: last });
    return last;
  }

  redo(): Action | null {
    const next = this.future.pop();
    if (!next) return null;
    // Save current state before re-applying for future undo
    this._snapshots.push(this.session.saveToBase64());
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
      inventoryCount: p.inventory?.length ?? 0,
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