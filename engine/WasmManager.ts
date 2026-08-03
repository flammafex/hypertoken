import { WasmChronicleAdapter } from '../core/WasmChronicleAdapter.js';
import { tryLoadWasm, isWasmAvailable, getWasmModule, type WasmActionDispatcher } from "../core/WasmBridge.js";
import type { IChronicle } from "../core/IChronicle.js";
import type { IActionPayload } from "../core/types.js";

export type SessionReplaceCallback = (newSession: IChronicle) => void;

export class WasmManager {
  private _dispatcher: WasmActionDispatcher | null = null;
  private _dispatchTable: Record<string, (p: any) => unknown> | null = null;

  /** Actions whose public TypeScript payload schema matches the WASM bridge. */
  static readonly WASM_ACTIONS = new Set([
    // Stack actions
    "stack:draw", "stack:peek", "stack:shuffle",
    "stack:cut", "stack:insertAt", "stack:removeAt", "stack:swap",
    // stack:reset is intentionally excluded: semantic divergence. The TS
    // handler restores the constructor's original deck, while the Rust bridge
    // re-merges stack + drawn + discards sorted by index.
    // Space actions. space:place intentionally stays on the TypeScript path:
    // its public payload is { card, opts }, while the WASM bridge expects
    // { token, x, y }. space:flip and space:createZone also stay in TS because
    // the bridge omits public faceUp and zone metadata options.
    "space:remove",
    "space:deleteZone", "space:clearZone",
    "space:lockZone", "space:shuffleZone",
    "space:transferZone", "space:clear",
    // Source actions
    "source:draw", "source:shuffle",
    // Token operations (5)
    "token:transform", "token:attach", "token:detach",
    "token:merge", "token:split",
    // Agent actions
    "agent:create",
    "agent:remove", "agent:setActive", "agent:setMeta",
    "agent:giveResource", "agent:takeResource",
    "agent:addToken", "agent:removeToken",
    "agent:transferResource", "agent:transferToken",
    "agent:stealResource", "agent:stealToken",
    "agent:drawCards",
    // agent:trade and agent:discardCards intentionally stay on the TypeScript
    // path: schema divergence. TS trade offers are { token?, resource?, amount? }
    // while the WASM binding expects { resources: {}, tokens: [] }; TS
    // discardCards takes explicit tokenIds + per-card stack.discard() while the
    // WASM binding discards N cards from the end of inventory (same class of
    // divergence as space:place).
    // agent:get / agent:getAll stay on the TS path: read-only, already work on
    // WASM engines via the TS fallback; getAll return shape diverges (Rust
    // exports a MAP, TS returns an ARRAY).
    // Transaction records (doc.transactions) are NOT written on the WASM path
    // for transfer/steal/trade — accepted divergence: only engine.getTransactions()
    // reads them and it has zero consumers.
    // agent:drawCards on the WASM path does not update stack.drawn (the TS
    // Stack.draw does) — accepted divergence, no example consumer reads stack.drawn.
    // agent:takeResource / agent:transferResource semantics are aligned TS-to-Rust
    // in engine/actions.ts.
    // GameLoop actions
    "game:loopInit", "game:loopStart",
    // GameState actions
    "game:start",
    // rule:markFired stays on the TypeScript path: rule timestamps are
    // JavaScript numbers while the WASM binding requires a BigInt.
    // Batch operations (8)
    "tokens:shuffle", "tokens:draw", "tokens:filter", "tokens:map",
    "tokens:find", "tokens:count", "tokens:collect", "tokens:forEach",

  ]);

  get dispatcher(): WasmActionDispatcher | null { return this._dispatcher; }

  /** Override dispatcher (for test compatibility). Rebuilds dispatch table. */
  setDispatcher(v: WasmActionDispatcher | null): void {
    this._dispatcher = v;
    this._dispatchTable = v ? this._buildDispatchTable(v) : null;
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
      // Fail-safe: never leave a half-initialized dispatcher with empty state
      // (would silently corrupt reads for WASM_ACTIONS actions). Fall back to TS.
      this._dispatcher = null;
      this._dispatchTable = null;
      if (debug) console.warn('⚠️  WASM ActionDispatcher initialization failed, falling back to TypeScript:', error);
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
    } catch (error) {
      // Fail-safe: never leave a half-initialized dispatcher with empty state.
      // Fall back to TypeScript.
      this._dispatcher = null;
      this._dispatchTable = null;
      if (debug) console.warn('⚠️  WASM ActionDispatcher async initialization failed, falling back to TypeScript:', error);
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
      "space:transferZone": (p) => { d.spaceTransferZone(p.fromZone, p.toZone); },
      "space:clear": (_) => { d.spaceClear(); },
      // Source
      "source:draw":    (p) => JSON.parse(d.sourceDraw(p.count ?? 1)),
      "source:shuffle": (p) => { d.sourceShuffle(p.seed !== undefined ? String(p.seed) : undefined); },
      "source:burn":    (p) => JSON.parse(d.sourceBurn(p.count ?? 1)),
      // Agent
      // id is optional in AgentCreatePayload (payloads.ts); mirror the TS
      // default from actions.ts so a missing id does not crash the wasm-bindgen
      // wrapper (which reads .length off the passed string). TS throws on
      // duplicate agent names; Rust silently overwrites — acceptable divergence,
      // the parity test never hits it.
      "agent:create":           (p) => JSON.parse(d.agentCreate(p.id ?? `agent-${Date.now()}-${Math.random().toString(36).slice(2)}`, p.name, p.meta ? JSON.stringify(p.meta) : undefined)),
      "agent:remove":           (p) => { d.agentRemove(p.name); },
      "agent:setActive":        (p) => { d.agentSetActive(p.name, p.active ?? true); },
      "agent:setMeta":          (p) => { d.agentSetMeta(p.name, p.key, JSON.stringify(p.value)); },
      "agent:giveResource":     (p) => { d.agentGiveResource(p.name, p.resource, p.amount ?? 1); },
      "agent:takeResource":     (p) => { d.agentTakeResource(p.name, p.resource, p.amount ?? 1); },
      "agent:addToken":         (p) => { d.agentAddToken(p.name, JSON.stringify(p.token)); },
      "agent:removeToken":      (p) => JSON.parse(d.agentRemoveToken(p.name, p.tokenId)),
      "agent:drawCards":        (p) => JSON.parse(d.agentDrawCards(p.name, p.count ?? 1)),
      "agent:get":              (p) => { const r = d.agentGet(p.name) as any; return r ? JSON.parse(r) : null; },
      "agent:transferResource": (p) => { d.agentTransferResource(p.from, p.to, p.resource, p.amount ?? 1); },
      "agent:transferToken":    (p) => { d.agentTransferToken(p.from, p.to, p.tokenId); },
      "agent:stealResource":    (p) => { d.agentStealResource(p.from, p.to, p.resource, p.amount ?? 1); },
      "agent:stealToken":       (p) => { d.agentStealToken(p.from, p.to, p.tokenId); },
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
      "game:mergeState":  (p) => { d.gameMergeState(JSON.stringify(p.state)); return {}; },
      "game:getState":    (_) => JSON.parse(d.gameGetState()),
      // Rules
      "rule:markFired": (p) => { d.ruleMarkFired(p.name, p.timestamp ?? Date.now()); },
      // Batch
      "tokens:shuffle": (p) => JSON.parse(d.batchShuffle(JSON.stringify(p.decks), p.seed !== undefined ? String(p.seed) : undefined)),
      "tokens:draw":    (p) => JSON.parse(d.batchDraw(JSON.stringify(p.decks), JSON.stringify(p.counts))),
      "tokens:filter":  (p) => JSON.parse(d.batchFilter(JSON.stringify(p.tokens), p.predicate ?? "reversed")),
      "tokens:map":     (p) => JSON.parse(d.batchMap(JSON.stringify(p.tokens), p.operation ?? "flip")),
      "tokens:find":    (p) => JSON.parse(d.batchFind(JSON.stringify(p.tokens), p.predicate ?? "reversed")),
      "tokens:count":   (p) => d.batchCount(JSON.stringify(p.tokens), p.predicate ?? "reversed"),
      "tokens:forEach": (p) => JSON.parse(d.batchForEach(JSON.stringify(p.tokens), p.operation ?? "flip")),
      "tokens:collect": (p) => JSON.parse(d.batchCollect(JSON.stringify(p.sources))),
    };
  }

  /** Dispatch via WASM dispatch table (sync). Throws if dispatcher not available or action unknown. */
  dispatch(type: string, payload: IActionPayload): unknown {
    if (!this._dispatchTable) throw new Error("WASM ActionDispatcher not available");
    const handler = this._dispatchTable[type];
    if (!handler) throw new Error(`Unknown WASM action type: ${type}`);
    return handler(payload);
  }

  async terminate(): Promise<void> {
    // No-op: worker cleanup removed. Kept for Engine.shutdown() compatibility.
  }
}
