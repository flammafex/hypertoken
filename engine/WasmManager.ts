import { WasmChronicleAdapter } from '../core/WasmChronicleAdapter.js';
import { tryLoadWasm, isWasmAvailable, getWasmModule, type WasmActionDispatcher } from "../core/WasmBridge.js";
import type { UniversalWorker } from "../core/UniversalWorker.js";
import type { IChronicle } from "../core/IChronicle.js";
import type { IActionPayload } from "../core/types.js";

export type SessionReplaceCallback = (newSession: IChronicle) => void;

export interface WorkerInitOptions {
  debug?: boolean;
  timeout?: number;
  enableBatching?: boolean;
  batchWindow?: number;
  workerPath?: string;
  wasmPath?: string;
}

export class WasmManager {
  private _dispatcher: WasmActionDispatcher | null = null;
  private _dispatchTable: Record<string, (p: any) => unknown> | null = null;
  private _worker: UniversalWorker | null = null;
  private _useWorker: boolean = false;

  static readonly WASM_ACTIONS = new Set([
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
    // Rules actions (1)
    "rule:markFired",
    // Batch operations (8)
    "tokens:shuffle", "tokens:draw", "tokens:filter", "tokens:map",
    "tokens:find", "tokens:count", "tokens:collect", "tokens:forEach",
    // Debug
    "debug:log",
  ]);

  get dispatcher(): WasmActionDispatcher | null { return this._dispatcher; }
  get worker(): UniversalWorker | null { return this._worker; }
  get useWorker(): boolean { return this._useWorker; }

  /** Override dispatcher (for test compatibility). Rebuilds dispatch table. */
  setDispatcher(v: WasmActionDispatcher | null): void {
    this._dispatcher = v;
    this._dispatchTable = v ? this._buildDispatchTable(v) : null;
  }

  async initWorker(
    options: WorkerInitOptions,
    debug: boolean,
    onStateChanged: (payload: any) => void,
    onAction: (payload: any) => void,
    onError: (payload: any) => void,
    fallback: () => void,
  ): Promise<void> {
    try {
      const { UniversalWorker } = await import('../core/UniversalWorker.js');
      this._worker = new UniversalWorker({
        debug: options.debug ?? debug,
        timeout: options.timeout,
        enableBatching: options.enableBatching,
        batchWindow: options.batchWindow,
        workerPath: options.workerPath,
        wasmPath: options.wasmPath,
      });

      await this._worker.init();

      this._worker.on('state_changed', onStateChanged);
      this._worker.on('action_completed', onAction);
      this._worker.on('error', onError);

      if (debug) {
        const env = this._worker.environment;
        console.log(`✅ Engine: UniversalWorker initialized (${env} mode)`);
      }
    } catch (error) {
      console.error('❌ Engine: UniversalWorker initialization failed:', error);
      this._useWorker = false;
      this._worker = null;
      fallback();
    }
  }

  initDispatcher(
    getStateJson: () => string,
    debug: boolean,
    onSessionReplace: SessionReplaceCallback,
    onStateChanged: (e: any) => void,
  ): void {
    if (!isWasmAvailable()) {
      this._tryLoadAsync(getStateJson, debug, onSessionReplace, onStateChanged);
      return;
    }
    try {
      const wasm = getWasmModule();
      if (!wasm) return;
      this._dispatcher = new wasm.ActionDispatcher();
      this._dispatchTable = this._buildDispatchTable(this._dispatcher);
      this._dispatcher.initializeState(getStateJson());
      const newSession = new WasmChronicleAdapter(this._dispatcher);
      newSession.on("state:changed", onStateChanged);
      onSessionReplace(newSession);
      if (debug) console.log('✅ WASM ActionDispatcher initialized');
    } catch (error) {
      if (debug) console.warn('⚠️  WASM ActionDispatcher initialization failed:', error);
    }
  }

  private async _tryLoadAsync(
    getStateJson: () => string,
    debug: boolean,
    onSessionReplace: SessionReplaceCallback,
    onStateChanged: (e: any) => void,
  ): Promise<void> {
    try {
      const wasm = await tryLoadWasm();
      if (!wasm || this._dispatcher) return;
      this._dispatcher = new wasm.ActionDispatcher();
      this._dispatchTable = this._buildDispatchTable(this._dispatcher);
      this._dispatcher.initializeState(getStateJson());
      const newSession = new WasmChronicleAdapter(this._dispatcher);
      newSession.on("state:changed", onStateChanged);
      onSessionReplace(newSession);
      if (debug) console.log('✅ WASM ActionDispatcher initialized (async)');
    } catch (_) {
      // Silently fail — fallback to TypeScript
    }
  }

  private _buildDispatchTable(d: WasmActionDispatcher): Record<string, (p: any) => unknown> {
    return {
      // Stack
      "stack:draw":     (p) => JSON.parse(d.stackDraw(p.count ?? 1)),
      "stack:peek":     (p) => JSON.parse(d.stackPeek(p.count ?? 1)),
      "stack:shuffle":  (p) => { d.stackShuffle(p.seed !== undefined ? String(p.seed) : undefined); },
      "stack:burn":     (p) => JSON.parse(d.stackBurn(p.count ?? 1)),
      "stack:reset":    (_) => { d.stackReset(); },
      "stack:cut":      (p) => { d.stackCut(p.position ?? 0); },
      "stack:insertAt": (p) => { d.stackInsertAt(p.position ?? 0, JSON.stringify(p.card)); },
      "stack:removeAt": (p) => JSON.parse(d.stackRemoveAt(p.position ?? 0)),
      "stack:swap":     (p) => { d.stackSwap(p.i, p.j); },
      // Space
      "space:place":       (p) => JSON.parse(d.spacePlace(p.zone, JSON.stringify(p.token), p.x, p.y)),
      "space:remove":      (p) => JSON.parse(d.spaceRemove(p.zone, p.placementId)),
      "space:move":        (p) => { d.spaceMove(p.placementId, p.fromZone, p.toZone, p.x, p.y); },
      "space:flip":        (p) => { d.spaceFlip(p.zone, p.placementId); },
      "space:createZone":  (p) => { d.spaceCreateZone(p.name); },
      "space:deleteZone":  (p) => { d.spaceDeleteZone(p.name); },
      "space:clearZone":   (p) => { d.spaceClearZone(p.zone); },
      "space:lockZone":    (p) => { d.spaceLockZone(p.zone, p.locked ?? true); },
      "space:shuffleZone": (p) => { d.spaceShuffleZone(p.zone, p.seed !== undefined ? String(p.seed) : undefined); },
      // Source
      "source:draw":    (p) => JSON.parse(d.sourceDraw(p.count ?? 1)),
      "source:shuffle": (p) => { d.sourceShuffle(p.seed !== undefined ? String(p.seed) : undefined); },
      "source:burn":    (p) => JSON.parse(d.sourceBurn(p.count ?? 1)),
      // Agent
      "agent:create":           (p) => JSON.parse(d.agentCreate(p.id, p.name, p.meta ? JSON.stringify(p.meta) : undefined)),
      "agent:remove":           (p) => { d.agentRemove(p.name); },
      "agent:setActive":        (p) => { d.agentSetActive(p.name, p.active ?? true); },
      "agent:giveResource":     (p) => { d.agentGiveResource(p.name, p.resource, p.amount ?? 1); },
      "agent:takeResource":     (p) => { d.agentTakeResource(p.name, p.resource, p.amount ?? 1); },
      "agent:addToken":         (p) => { d.agentAddToken(p.name, JSON.stringify(p.token)); },
      "agent:removeToken":      (p) => JSON.parse(d.agentRemoveToken(p.name, p.tokenId)),
      "agent:get":              (p) => { const r = d.agentGet(p.name) as any; return r ? JSON.parse(r) : null; },
      "agent:transferResource": (p) => { d.agentTransferResource(p.from, p.to, p.resource, p.amount ?? 1); return {}; },
      "agent:transferToken":    (p) => { d.agentTransferToken(p.from, p.to, p.tokenId); return {}; },
      "agent:stealResource":    (p) => { d.agentStealResource(p.from, p.to, p.resource, p.amount ?? 1); return {}; },
      "agent:stealToken":       (p) => { d.agentStealToken(p.from, p.to, p.tokenId); return {}; },
      "agent:getAll":           (_) => JSON.parse(d.agentGetAll()),
      // Token
      "token:transform": (p) => JSON.parse(d.tokenTransform(JSON.stringify(p.token), JSON.stringify(p.properties ?? {}))),
      "token:attach":    (p) => JSON.parse(d.tokenAttach(JSON.stringify(p.host), JSON.stringify(p.attachment), p.attachmentType ?? "default")),
      "token:detach":    (p) => JSON.parse(d.tokenDetach(JSON.stringify(p.host), p.attachmentId)),
      "token:merge":     (p) => JSON.parse(d.tokenMerge(JSON.stringify(p.tokens), p.properties ? JSON.stringify(p.properties) : undefined, p.keepOriginals ?? false)),
      "token:split":     (p) => JSON.parse(d.tokenSplit(JSON.stringify(p.token), p.count ?? 2, p.propertiesArray ? JSON.stringify(p.propertiesArray) : undefined)),
      // GameLoop
      "game:loopInit":    (p) => { d.gameLoopInit(p.maxTurns ?? 100); },
      "game:loopStart":   (_) => { d.gameLoopStart(); },
      "game:loopStop":    (p) => { d.gameLoopStop(p.phase ?? "stopped"); },
      "game:nextTurn":    (p) => { d.gameLoopNextTurn(p.agentCount ?? 0); },
      "game:setPhase":    (p) => { d.gameLoopSetPhase(p.phase); },
      "game:setMaxTurns": (p) => { d.gameLoopInit(p.maxTurns ?? 100); },
      // GameState
      "game:start":       (_) => { const r = d.gameStart() as any; return r ? JSON.parse(r) : {}; },
      "game:end":         (p) => { const r = d.gameEnd(p.winner ? String(p.winner) : undefined, p.reason ? String(p.reason) : undefined) as any; return r ? JSON.parse(r) : {}; },
      "game:pause":       (_) => { d.gamePause(); return {}; },
      "game:resume":      (_) => { d.gameResume(); return {}; },
      "game:nextPhase":   (p) => { d.gameNextPhase(p.phase ? String(p.phase) : undefined); return {}; },
      "game:setProperty": (p) => { d.gameSetProperty(p.key, JSON.stringify(p.value)); return {}; },
      "game:getState":    (_) => JSON.parse(d.gameGetState()),
      // Rules
      "rule:markFired": (p) => { d.ruleMarkFired(p.name, p.timestamp ?? Date.now()); },
      // Batch
      "tokens:shuffle": (p) => JSON.parse(d.batchShuffle(JSON.stringify(p.decks), p.seed ? String(p.seed) : undefined)),
      "tokens:draw":    (p) => JSON.parse(d.batchDraw(JSON.stringify(p.decks), JSON.stringify(p.counts))),
      "tokens:filter":  (p) => JSON.parse(d.batchFilter(JSON.stringify(p.tokens), p.predicate ?? "reversed")),
      "tokens:map":     (p) => JSON.parse(d.batchMap(JSON.stringify(p.tokens), p.operation ?? "flip")),
    };
  }

  /** Dispatch via WASM dispatch table (sync). Throws if dispatcher not available or action unknown. */
  dispatch(type: string, payload: IActionPayload): unknown {
    if (!this._dispatchTable) throw new Error("WASM ActionDispatcher not available");
    const handler = this._dispatchTable[type];
    if (!handler) throw new Error(`Unknown WASM action type: ${type}`);
    return handler(payload);
  }

  /** Dispatch via worker (async). Throws if worker not ready. */
  async dispatchWorker(type: string, payload: IActionPayload): Promise<unknown> {
    if (!this._worker?.ready) throw new Error("Worker not ready");
    return this._worker.dispatch(type, payload);
  }

  async terminate(): Promise<void> {
    if (this._worker) {
      await this._worker.terminate();
      this._worker = null;
    }
    this._useWorker = false;
  }
}
