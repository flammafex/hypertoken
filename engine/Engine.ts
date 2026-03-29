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
import type { StackWasm } from "../core/StackWasm.js";
import type { SpaceWasm } from "../core/SpaceWasm.js";
import type { SourceWasm } from "../core/SourceWasm.js";
import type { INetworkConnection } from "../core/ConsensusCore.js";
import type { ConsensusCore } from "../core/ConsensusCore.js";
import type { MessageCodec, CodecConfig } from "../network/MessageCodec.js";
import type { ReconnectConfig } from "../network/PeerConnection.js";
import { HistoryManager } from "./HistoryManager.js";
import { WasmManager } from "./WasmManager.js";
import { NetworkManager } from "./NetworkManager.js";

export interface EngineNetworkOptions {
  codec?: MessageCodec | Partial<CodecConfig>;
  reconnect?: Partial<ReconnectConfig> | false;
  messageBufferSize?: number;
}

export interface EngineOptions {
  stack?: Stack | StackWasm | null;
  space?: Space | SpaceWasm | null;
  source?: Source | SourceWasm | null;
  autoConnect?: string;
  useWebRTC?: boolean;
  useWorker?: boolean;
  workerOptions?: {
    debug?: boolean;
    timeout?: number;
    enableBatching?: boolean;
    batchWindow?: number;
    workerPath?: string;
    wasmPath?: string;
  };
  networkOptions?: EngineNetworkOptions;
}

export class Engine extends Emitter {
  stack: Stack | StackWasm | null;
  space: Space | SpaceWasm;
  source: Source | SourceWasm | null;

  session: IChronicle;
  loop: GameLoop;
  eventBus: Emitter;
  ruleEngine?: RuleEngine;
  _policies: Map<string, any>;
  debug: boolean;

  readonly historyManager: HistoryManager;
  readonly wasm: WasmManager;
  readonly net: NetworkManager;

  private _useWebRTC: boolean;
  private _networkOptions: EngineNetworkOptions;

  constructor({ stack = null, space = null, source = null, autoConnect, useWebRTC = false, useWorker = false, workerOptions = {}, networkOptions = {} }: EngineOptions = {}) {
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
    this.wasm = new WasmManager();
    this.net = new NetworkManager();

    this.loop = new GameLoop(this);
    this.session.on("state:changed", (e: any) => this.emit("state:updated", e));

    if (useWorker) {
      this.wasm.initWorker(
        workerOptions,
        this.debug,
        (payload) => this.emit('state:updated', payload),
        (payload) => this.emit('engine:action', { payload }),
        (error) => this.emit('engine:error', { payload: { error } }),
        () => {
          // Worker init failed, fall back to direct WASM
          this._initWasm();
        },
      );
    } else {
      this._initWasm();
    }

    if (autoConnect) {
      this.connect(autoConnect);
    }
  }

  private _initWasm(): void {
    this.wasm.initDispatcher(
      () => JSON.stringify(this.session.state),
      this.debug,
      (newSession) => {
        this.session = newSession;
        // Re-wire state:changed → state:updated relay
        this.session.on("state:changed", (e: any) => this.emit("state:updated", e));
      },
      (e: any) => this.emit("state:updated", e),
    );
  }

  // ── Public API compat getters ──────────────────────────────────────────────

  get history(): Action[] { return this.historyManager.history; }
  set history(v: Action[]) { this.historyManager.restoreHistory(v); }

  get future(): Action[] { return this.historyManager.future; }

  get network(): INetworkConnection | undefined { return this.net.network; }
  get sync(): ConsensusCore | undefined { return this.net.sync; }

  /** Test compatibility: get/set _wasmDispatcher via WasmManager. */
  get _wasmDispatcher() { return this.wasm.dispatcher; }
  set _wasmDispatcher(v: any) { this.wasm.setDispatcher(v); }

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
    if (this.wasm.dispatcher) {
      console.warn('[Engine] Network sync is not yet supported with WASM Chronicle backend');
      return;
    }
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
    await this.wasm.terminate();
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

  // ── Dispatch ───────────────────────────────────────────────────────────────

  async dispatch(type: string, payload: IActionPayload = {}, opts: any = {}): Promise<any> {
    const action = new Action(type, payload, opts);
    if (this.debug) console.log("🧩 dispatch:", type, payload);

    const snapshot = this.session.saveToBase64();
    let result: any;

    if (this.wasm.useWorker && this.wasm.worker?.ready) {
      try {
        result = await this.wasm.dispatchWorker(type, payload);
        action.result = result;
      } catch (error) {
        if (this.debug) console.log('⚠️  Worker dispatch failed, falling back to sync:', error);
        result = this.apply(action);
      }
    } else {
      result = this.apply(action);
    }

    if (result !== Engine.ACTION_FAILED) {
      this.historyManager.recordAction(action, snapshot);
      this.emit("engine:action", { payload: action });

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

  private static readonly ACTION_FAILED = Symbol("ACTION_FAILED");

  apply(action: Action): any {
    if (this.wasm.dispatcher && WasmManager.WASM_ACTIONS.has(action.type)) {
      try {
        const result = this.wasm.dispatch(action.type, action.payload);
        action.result = result;
        this.session.emit("state:changed", { source: "dispatch" });
        return result;
      } catch (err) {
        if (this.debug) console.log(`⚠️  WASM dispatch failed for ${action.type}, falling back to TypeScript:`, err);
      }
    }

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

  // ── Undo / Redo ────────────────────────────────────────────────────────────

  undo(): Action | null {
    const action = this.historyManager.undo(this.session);
    if (!action) return null;
    this.emit("engine:undo", { payload: action });
    return action;
  }

  redo(): Action | null {
    const next = this.historyManager.popRedo();
    if (!next) return null;
    this.historyManager.pushSnapshot(this.session.saveToBase64());
    this.apply(next);
    this.historyManager.pushHistory(next);
    this.emit("engine:redo", { payload: next });
    return next;
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
