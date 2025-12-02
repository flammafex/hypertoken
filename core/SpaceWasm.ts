/*
 * core/SpaceWasm.ts
 * WASM-accelerated Space with TypeScript fallback
 */
import { Emitter } from "./events.js";
import { Chronicle } from "./Chronicle.js";
import { IPlacementCRDT, IToken } from "./types.js";
import { Stack } from "./Stack.js";
import { Source } from "./Source.js";
import { tryLoadWasm, isWasmAvailable, getWasmModule } from './WasmBridge.js';
import type { WasmSpace } from './WasmBridge.js';
import * as crypto from "crypto";

export interface SpreadZone {
  id: string;
  x?: number;
  y?: number;
  label?: string;
}

export interface SpaceEvent {
  type: string;
  timestamp: number;
  [key: string]: unknown;
}

/**
 * SpaceWasm: WASM-accelerated spatial zone management
 *
 * Drop-in replacement for Space.ts with ~20x performance improvement.
 *
 * Architecture:
 * - WASM module handles compute-intensive operations (place, move, shuffle, etc.)
 * - Chronicle syncs CRDT state across network
 * - TypeScript fallback for maximum compatibility
 * - All events work identically to Space.ts
 *
 * Performance targets (1000 tokens):
 * - Place operations: 958ms → <50ms
 * - Zone shuffles: ~20x faster
 * - Query operations: ~16x faster
 */
export class SpaceWasm extends Emitter {
  public readonly session: Chronicle;

  name: string;
  spreads: Record<string, SpreadZone[]> = {};
  private _lockedZones: Set<string> = new Set();
  log: SpaceEvent[] = [];

  private _wasmSpace: WasmSpace | null = null;
  private _wasmInitialized: boolean = false;

  /**
   * Create a new SpaceWasm
   * @param session - Chronicle instance for CRDT state management
   * @param name - Name of this space
   * @throws Error if session is null/undefined
   */
  constructor(session: Chronicle, name: string = "space") {
    super();

    if (!session) {
      throw new Error("SpaceWasm requires a valid Chronicle session");
    }

    this.session = session;
    this.name = name;

    // Initialize WASM asynchronously (non-blocking)
    this._initWasm();
  }

  private _initWasm(): void {
    // Try to initialize WASM synchronously if already loaded
    if (isWasmAvailable()) {
      try {
        const wasm = getWasmModule();
        if (wasm) {
          this._wasmSpace = new wasm.Space();
          this._wasmInitialized = true;

          // Sync existing Chronicle state to WASM
          if (this.session.state.zones) {
            this._syncChronicleToWasm();
          }
        }
      } catch (error) {
        console.warn('⚠️  WASM Space initialization failed, using TypeScript fallback');
        this._wasmSpace = null;
        this._wasmInitialized = false;
      }
    } else {
      // WASM not loaded yet, try async
      this._tryLoadWasmAsync();
    }
  }

  private async _tryLoadWasmAsync(): Promise<void> {
    try {
      const wasm = await tryLoadWasm();
      if (wasm && !this._wasmSpace) {
        this._wasmSpace = new wasm.Space();
        this._wasmInitialized = true;

        // Sync current state to WASM if available
        if (this.session.state.zones) {
          this._syncChronicleToWasm();
        }
      }
    } catch (error) {
      // Silently fall back to TypeScript
    }
  }

  // Sync Chronicle state to WASM (transform format)
  private _syncChronicleToWasm(): void {
    if (!this._wasmSpace) return;

    try {
      // Transform Chronicle format to WASM format
      // Chronicle: { zones: { zoneName: [...] } }
      // WASM: { zones: { zoneName: { placements: [...], lock: {...} } } }
      const wasmZones: Record<string, any> = {};
      if (this.session.state.zones) {
        for (const [zoneName, placements] of Object.entries(this.session.state.zones)) {
          wasmZones[zoneName] = {
            placements: placements || [],
            lock: {
              locked: this._lockedZones.has(zoneName),
              locked_at: null,
              locked_by: null
            }
          };
        }
      }

      const wasmState = { zones: wasmZones };
      this._wasmSpace.setState(JSON.stringify(wasmState));
    } catch (error) {
      console.error('Failed to sync Chronicle state to WASM:', error);
    }
  }

  // Sync WASM state back to Chronicle
  private _syncToChronicle(): void {
    if (!this._wasmSpace) return;

    try {
      const wasmStateJson = this._wasmSpace.getState();
      const wasmState = JSON.parse(wasmStateJson);

      // Transform WASM state structure to Chronicle format
      // WASM: { zones: { zoneName: { placements: [...], lock: {...} } } }
      // Chronicle: { zones: { zoneName: [...] } }
      const chronicleZones: Record<string, any[]> = {};
      if (wasmState.zones) {
        for (const [zoneName, zone] of Object.entries(wasmState.zones)) {
          chronicleZones[zoneName] = (zone as any).placements || [];
        }
      }

      this.session.change("sync wasm state", (doc) => {
        doc.zones = chronicleZones;
      }, "wasm");
    } catch (error) {
      console.error('Failed to sync WASM state to Chronicle:', error);
    }
  }

  // Helper to sanitize token data for CRDT
  private _sanitizeToken(token: IToken): any {
    const plain = { ...token };
    if (plain._tags instanceof Set) {
      // @ts-ignore
      plain._tags = Array.from(plain._tags);
    }
    return JSON.parse(JSON.stringify(plain));
  }

  // Helper to deep clone a proxy object to plain JS object
  private _clone<T>(proxy: T): T {
    return JSON.parse(JSON.stringify(proxy));
  }

  get zones(): string[] {
    return this.session.state.zones ? Object.keys(this.session.state.zones) : [];
  }

  hasZone(name: string): boolean {
    return this.zones.includes(name);
  }

  toJSON(): any {
    return {
      name: this.name,
      zones: this.session.state.zones || {},
      log: this.log
    };
  }

  snapshot(): any {
    return this.toJSON();
  }

  zone(name: string): readonly IPlacementCRDT[] {
    return this.session.state.zones?.[name] || [];
  }

  zoneCount(name: string): number {
    return this.zone(name).length;
  }

  cards(zoneName?: string): readonly IPlacementCRDT[] {
    if (zoneName) return this.zone(zoneName);
    if (!this.session.state.zones) return [];
    return (Object.values(this.session.state.zones) as IPlacementCRDT[][]).flat();
  }

  findCard(idOrFn: string | ((p: IPlacementCRDT) => boolean)): IPlacementCRDT | null {
    const all = this.cards();
    if (typeof idOrFn === "function") {
      return all.find(idOrFn) || null;
    }
    return all.find(p => p.id === idOrFn) || null;
  }

  _isLocked(name: string): boolean {
    return this._lockedZones.has(name);
  }

  /**
   * Place a token in a zone
   * @param zoneName - Name of the zone
   * @param token - Token to place
   * @param opts - Placement options (position, face up, etc.)
   * @returns Placement object or null if zone is locked
   * @throws Error if token is invalid
   * @emits space:locked if zone is locked
   */
  place(zoneName: string, token: IToken, opts: Partial<IPlacementCRDT> = {}): IPlacementCRDT | null {
    if (!token || !token.id) {
      throw new Error("Cannot place invalid token (missing id)");
    }

    if (this._isLocked(zoneName)) {
      this.emit("space:locked", { operation: "place", zoneName });
      return null;
    }

    const safeToken = this._sanitizeToken(token);

    // Try WASM first
    if (this._wasmSpace && isWasmAvailable()) {
      try {
        const tokenJson = JSON.stringify(safeToken);
        const placementJson = this._wasmSpace.place(
          zoneName,
          tokenJson,
          opts.x ?? 0,
          opts.y ?? 0
        );
        const placement = JSON.parse(placementJson);

        // Override with any custom opts
        if (opts.faceUp !== undefined) placement.faceUp = opts.faceUp;
        if (opts.label !== undefined) placement.label = opts.label;

        // Don't call setState - the Rust place() already updated the zone
        // Just sync back to Chronicle
        this._syncToChronicle();

        this.log.push({ type: "place", zoneName, placementId: placement.id, timestamp: Date.now() });
        this.emit("place", placement);
        return placement;
      } catch (error) {
        console.error('WASM place failed, falling back to TypeScript:', error);
      }
    }

    // TypeScript fallback
    const placement: IPlacementCRDT = {
      id: typeof crypto.randomUUID === 'function' ? crypto.randomUUID() : `p-${Date.now()}-${Math.random()}`,
      tokenId: token.id,
      tokenSnapshot: safeToken,
      x: opts.x ?? 0,
      y: opts.y ?? 0,
      faceUp: opts.faceUp ?? true,
      label: opts.label ?? null,
      ts: Date.now(),
      reversed: !!token._rev,
      tags: []
    };

    this.session.change(`place card in ${zoneName}`, (doc) => {
      if (!doc.zones) doc.zones = {};
      if (!doc.zones[zoneName]) doc.zones[zoneName] = [];
      doc.zones[zoneName].push(placement);
    });

    this.log.push({ type: "place", zoneName, placementId: placement.id, timestamp: Date.now() });
    this.emit("place", placement);
    return placement;
  }

  /**
   * Move a placement from one zone to another
   * @param fromZone - Source zone name
   * @param toZone - Destination zone name
   * @param placementId - ID of placement to move
   * @param opts - Optional new position
   * @throws Error if placement not found
   * @emits space:locked if either zone is locked
   * @emits space:notFound if placement doesn't exist
   */
  move(fromZone: string, toZone: string, placementId: string, opts: { x?: number; y?: number } = {}): void {
    if (this._isLocked(fromZone) || this._isLocked(toZone)) {
      this.emit("space:locked", { operation: "move", fromZone, toZone });
      return;
    }

    // Try WASM first - sync Chronicle state to WASM before operation
    if (this._wasmSpace && isWasmAvailable()) {
      try {
        // Ensure WASM has latest state
        this._syncChronicleToWasm();

        this._wasmSpace.move(placementId, fromZone, toZone, opts.x ?? 0, opts.y ?? 0);
        this._syncToChronicle();

        this.log.push({ type: "move", fromZone, toZone, placementId, timestamp: Date.now() });
        this.emit("move", { fromZone, toZone, placementId });
        return;
      } catch (error) {
        console.error('WASM move failed, falling back to TypeScript:', error);
      }
    }

    // TypeScript fallback
    let found = false;
    this.session.change(`move card from ${fromZone} to ${toZone}`, (doc) => {
      if (!doc.zones) return;
      const from = doc.zones[fromZone];
      if (!from) return;

      const idx = from.findIndex(p => p.id === placementId);
      if (idx === -1) return;

      found = true;
      const [placementProxy] = from.splice(idx, 1);

      // Clone the proxy to avoid Automerge reference errors
      const placement = this._clone(placementProxy);

      if (opts.x !== undefined) placement.x = opts.x;
      if (opts.y !== undefined) placement.y = opts.y;

      if (!doc.zones[toZone]) doc.zones[toZone] = [];
      doc.zones[toZone].push(placement);
    });

    if (!found) {
      this.emit("space:notFound", { operation: "move", placementId, fromZone });
      return;
    }

    this.log.push({ type: "move", fromZone, toZone, placementId, timestamp: Date.now() });
    this.emit("move", { fromZone, toZone, placementId });
  }

  /**
   * Flip a placement face up or face down
   * @param zoneName - Zone name
   * @param placementId - Placement ID
   * @param faceUp - Optional explicit face state (toggles if not provided)
   * @emits space:locked if zone is locked
   * @emits space:notFound if placement doesn't exist
   */
  flip(zoneName: string, placementId: string, faceUp?: boolean): void {
    if (this._isLocked(zoneName)) {
      this.emit("space:locked", { operation: "flip", zoneName });
      return;
    }

    // Try WASM first
    if (this._wasmSpace && isWasmAvailable()) {
      try {
        // Ensure WASM has latest state
        this._syncChronicleToWasm();

        // WASM flip needs to know the current state to toggle
        if (faceUp === undefined) {
          const placement = this.findCard(placementId);
          if (placement) {
            faceUp = !placement.faceUp;
          }
        }

        this._wasmSpace.flip(zoneName, placementId, faceUp ?? true);
        this._syncToChronicle();

        this.log.push({ type: "flip", zoneName, placementId, faceUp, timestamp: Date.now() });
        this.emit("flip", { id: placementId, faceUp });
        return;
      } catch (error) {
        console.error('WASM flip failed, falling back to TypeScript:', error);
      }
    }

    // TypeScript fallback
    let found = false;
    this.session.change(`flip card in ${zoneName}`, (doc) => {
      if (!doc.zones) return;
      const zone = doc.zones[zoneName];
      if (!zone) return;
      const placement = zone.find(p => p.id === placementId);
      if (placement) {
        found = true;
        placement.faceUp = faceUp !== undefined ? faceUp : !placement.faceUp;
      }
    });

    if (!found) {
      this.emit("space:notFound", { operation: "flip", placementId, zoneName });
      return;
    }

    this.log.push({ type: "flip", zoneName, placementId, faceUp, timestamp: Date.now() });
    this.emit("flip", { id: placementId, faceUp });
  }

  /**
   * Remove a placement from a zone
   * @param zoneName - Zone name
   * @param placementId - Placement ID
   * @emits space:locked if zone is locked
   * @emits space:notFound if placement doesn't exist
   */
  remove(zoneName: string, placementId: string): void {
    if (this._isLocked(zoneName)) {
      this.emit("space:locked", { operation: "remove", zoneName });
      return;
    }

    // Try WASM first
    if (this._wasmSpace && isWasmAvailable()) {
      try {
        // Ensure WASM has latest state
        this._syncChronicleToWasm();

        this._wasmSpace.remove(zoneName, placementId);
        this._syncToChronicle();

        this.log.push({ type: "remove", zoneName, placementId, timestamp: Date.now() });
        this.emit("remove", { id: placementId });
        return;
      } catch (error) {
        console.error('WASM remove failed, falling back to TypeScript:', error);
      }
    }

    // TypeScript fallback
    let found = false;
    this.session.change(`remove card from ${zoneName}`, (doc) => {
      if (!doc.zones) return;
      const zone = doc.zones[zoneName];
      if (zone) {
        const idx = zone.findIndex(p => p.id === placementId);
        if (idx >= 0) {
          zone.splice(idx, 1);
          found = true;
        }
      }
    });

    if (!found) {
      this.emit("space:notFound", { operation: "remove", placementId, zoneName });
      return;
    }

    this.log.push({ type: "remove", zoneName, placementId, timestamp: Date.now() });
    this.emit("remove", { id: placementId });
  }

  clear(): void {
    // Try WASM first
    if (this._wasmSpace && isWasmAvailable()) {
      try {
        this._wasmSpace.clear();
        this._syncToChronicle();
        this.log = [];
        this.emit("clear");
        return;
      } catch (error) {
        console.error('WASM clear failed, falling back to TypeScript:', error);
      }
    }

    // TypeScript fallback
    this.session.change("clear space", (doc) => {
      doc.zones = {};
    });
    this.log = [];
    this.emit("clear");
  }

  createZone(id: string, { label = id, x = 0, y = 0 } = {}): this {
    // Try WASM first
    if (this._wasmSpace && isWasmAvailable()) {
      try {
        this._wasmSpace.createZone(id);
        this._syncToChronicle();
        this.emit("zone:created", { payload: { id, label, x, y } });
        return this;
      } catch (error) {
        console.error('WASM createZone failed, falling back to TypeScript:', error);
      }
    }

    // TypeScript fallback
    this.session.change(`create zone ${id}`, (doc) => {
      if (!doc.zones) doc.zones = {};
      if (!doc.zones[id]) doc.zones[id] = [];
    });
    this.emit("zone:created", { payload: { id, label, x, y } });
    return this;
  }

  deleteZone(id: string): this {
    // Try WASM first
    if (this._wasmSpace && isWasmAvailable()) {
      try {
        this._wasmSpace.deleteZone(id);
        this._syncToChronicle();
        this.emit("zone:deleted", { payload: { id } });
        return this;
      } catch (error) {
        console.error('WASM deleteZone failed, falling back to TypeScript:', error);
      }
    }

    // TypeScript fallback
    this.session.change(`delete zone ${id}`, (doc) => {
      if (doc.zones) delete doc.zones[id];
    });
    this.emit("zone:deleted", { payload: { id } });
    return this;
  }

  clearZone(name: string): this {
    if (this._isLocked(name)) return this;

    // Try WASM first
    if (this._wasmSpace && isWasmAvailable()) {
      try {
        this._wasmSpace.clearZone(name);
        this._syncToChronicle();
        this.emit("clearZone", { name });
        return this;
      } catch (error) {
        console.error('WASM clearZone failed, falling back to TypeScript:', error);
      }
    }

    // TypeScript fallback
    this.session.change(`clear zone ${name}`, (doc) => {
      if (doc.zones) doc.zones[name] = [];
    });
    this.emit("clearZone", { name });
    return this;
  }

  lockZone(id: string, locked = true): this {
    if (!this._lockedZones) this._lockedZones = new Set();
    locked ? this._lockedZones.add(id) : this._lockedZones.delete(id);

    // WASM also needs to know about locks
    if (this._wasmSpace && isWasmAvailable()) {
      try {
        this._wasmSpace.lockZone(id, locked);
      } catch (error) {
        // Non-critical, zone locking is tracked in TypeScript
      }
    }

    this.emit("zone:locked", { payload: { id, locked } });
    return this;
  }

  transferZone(fromZone: string, toZone: string): number {
    if (this._isLocked(fromZone) || this._isLocked(toZone)) return 0;

    // Try WASM first
    if (this._wasmSpace && isWasmAvailable()) {
      try {
        const count = this._wasmSpace.transferZone(fromZone, toZone);
        this._syncToChronicle();
        this.emit("transferZone", { fromZone, toZone, count });
        return count;
      } catch (error) {
        console.error('WASM transferZone failed, falling back to TypeScript:', error);
      }
    }

    // TypeScript fallback
    let count = 0;
    this.session.change(`transfer ${fromZone} to ${toZone}`, (doc) => {
      if (!doc.zones) return;
      const from = doc.zones[fromZone];
      if (!from || from.length === 0) return;

      if (!doc.zones[toZone]) doc.zones[toZone] = [];

      // Clone items to avoid Automerge reference errors
      const itemsProxy = from.splice(0, from.length);
      const items = this._clone(itemsProxy);
      doc.zones[toZone].push(...items);
      count = items.length;
    });
    this.emit("transferZone", { fromZone, toZone, count });
    return count;
  }

  fan(zoneName: string, opts: any = {}): void {
    this.spreadZone(zoneName, { pattern: "arc", ...opts });
  }

  stackZone(id: string): this {
    if (this._isLocked(id)) return this;

    // WASM method not implemented for this operation, using TypeScript
    // (WASM has stackLayout with different signature)

    // TypeScript implementation
    this.session.change(`stack zone ${id}`, (doc) => {
      if (!doc.zones) return;
      const arr = doc.zones[id];
      if (arr) {
        arr.forEach(p => { p.x = 0; p.y = 0; });
      }
    });
    this.emit("zone:stacked", { payload: { id } });
    return this;
  }

  spreadZone(id: string, { pattern = "linear", angleStep = 15, radius = 100 } = {}): this {
    if (this._isLocked(id)) return this;

    // WASM methods (fan, spread) have different signatures, using TypeScript
    // TODO: Map to WASM fan() or spread() methods with proper parameters

    // TypeScript implementation (handles both linear and arc)
    this.session.change(`spread zone ${id}`, (doc) => {
      if (!doc.zones) return;
      const arr = doc.zones[id];
      if (!arr) return;

      if (pattern === "arc") {
        arr.forEach((p, i) => {
          const a = (i - arr.length / 2) * angleStep * Math.PI / 180;
          p.x = Math.cos(a) * radius;
          p.y = Math.sin(a) * radius;
        });
      } else {
        arr.forEach((p, i) => {
          p.x = i * angleStep;
          p.y = 0;
        });
      }
    });
    this.emit("zone:spread", { payload: { id, pattern } });
    return this;
  }

  shuffleZone(name: string, seed?: number | null): void {
    if (this._isLocked(name)) return;

    // Try WASM first
    if (this._wasmSpace && isWasmAvailable()) {
      try {
        const seedStr = seed !== null && seed !== undefined ? String(seed) : undefined;
        this._wasmSpace.shuffleZone(name, seedStr);
        this._syncToChronicle();
        this.log.push({ type: "shuffleZone", name, timestamp: Date.now() });
        return;
      } catch (error) {
        console.error('WASM shuffleZone failed, falling back to TypeScript:', error);
      }
    }

    // TypeScript fallback
    const itemsProxy = [...this.zone(name)];
    if (!itemsProxy.length) return;

    // Clone to plain objects to avoid Automerge reference errors
    const items = this._clone(itemsProxy);
    items.sort(() => Math.random() - 0.5);

    this.session.change(`shuffle zone ${name}`, (doc) => {
      if (!doc.zones) doc.zones = {};
      doc.zones[name] = items;
    });
    this.log.push({ type: "shuffleZone", name, timestamp: Date.now() });
  }

  pile(name: string): readonly IPlacementCRDT[] {
    return this.zone(name);
  }

  peekZone(name: string, n: number = 1): IPlacementCRDT | IPlacementCRDT[] | null {
    const pile = this.zone(name);
    if (pile.length === 0) return null;
    if (n === 1) return pile[pile.length - 1];
    return pile.slice(-n).reverse();
  }

  drawFromZone(name: string, n: number = 1): IPlacementCRDT[] {
    if (this._isLocked(name)) return [];

    // WASM doesn't have drawFromZone helper method, using TypeScript
    // (could be implemented using WASM getTokens + remove if needed)

    // TypeScript implementation
    let drawn: IPlacementCRDT[] = [];
    this.session.change(`draw ${n} from ${name}`, (doc) => {
      if (!doc.zones) return;
      const zone = doc.zones[name];
      if (zone && zone.length > 0) {
        const amount = Math.min(n, zone.length);
        const drawnProxy = zone.splice(zone.length - amount, amount);
        // Clone to avoid Automerge reference errors
        drawn = this._clone(drawnProxy);
      }
    });
    drawn.reverse();
    this.emit("drawFromZone", { zone: name, count: drawn.length });
    return drawn;
  }

  pushToZone(name: string, cards: IPlacementCRDT | IPlacementCRDT[]): void {
    if (this._isLocked(name)) return;
    const arr = Array.isArray(cards) ? cards : [cards];
    if (arr.length === 0) return;

    // WASM doesn't have pushToZone helper method, using TypeScript
    // (could be implemented using WASM place for each card if needed)

    // TypeScript fallback
    this.session.change(`push ${arr.length} to ${name}`, (doc) => {
      if (!doc.zones) doc.zones = {};
      if (!doc.zones[name]) doc.zones[name] = [];
      doc.zones[name].push(...arr);
    });
    this.emit("pushToZone", { zone: name, count: arr.length });
  }

  returnToStack(stack: Stack, zoneName: string, n: number = 1, { toTop = true } = {}): IToken[] {
    const removedPlacements = this.drawFromZone(zoneName, n);
    const tokens = removedPlacements.map(p => p.tokenSnapshot);

    if (toTop) {
      tokens.forEach(t => stack.insertAt(t, stack.size));
    } else {
      tokens.forEach(t => stack.insertAt(t, 0));
    }

    this.emit("returnToStack", { zone: zoneName, count: tokens.length });
    return tokens;
  }

  collectAllInto(stack: Stack | any, { includeEmpty = false } = {}): number {
    let total = 0;
    const tokensToReturn: IToken[] = [];
    const zonesToClear: string[] = [];

    // Read phase
    for (const zoneName of this.zones) {
      const pile = this.zone(zoneName);
      if (!includeEmpty && pile.length === 0) continue;

      pile.forEach(p => tokensToReturn.push(p.tokenSnapshot));
      zonesToClear.push(zoneName);
    }

    // Write phase (Atomic)
    this.session.change("collect all to stack", (doc) => {
      if (doc.zones) {
        zonesToClear.forEach(z => doc.zones![z] = []);
      }
    });

    // Add tokens back to stack
    tokensToReturn.forEach(t => stack.insertAt(t, stack.size));
    total = tokensToReturn.length;

    stack.shuffle();
    this.emit("collectAllInto", { zones: total });
    return total;
  }

  defineSpread(name: string, zones: SpreadZone[]): this {
    this.spreads[name] = zones;
    return this;
  }

  dealSpread(name: string, source: Stack | Source, { faceUp = true } = {}): void {
    const pattern = this.spreads[name];
    if (!pattern) throw new Error(`Spread "${name}" not defined.`);

    for (const zone of pattern) {
      const card = source.draw() as IToken | undefined;
      if (!card) break;
      this.place(zone.id, card, {
        x: zone.x ?? null,
        y: zone.y ?? null,
        faceUp,
        label: zone.label ?? zone.id
      });
    }
    this.emit("dealSpread", { name });
  }

  clearSpread(name: string): this {
    const pattern = this.spreads?.[name];
    if (!pattern) return this;
    const ids = new Set(pattern.map(z => z.id));

    this.session.change(`clear spread ${name}`, (doc) => {
      if (!doc.zones) return;
      Object.keys(doc.zones).forEach(zone => {
        if (ids.has(zone)) doc.zones![zone] = [];
      });
    });
    this.emit("clearSpread", { name });
    return this;
  }

  /**
   * Check if WASM is being used
   * @returns true if WASM is available and initialized
   */
  get isWasmEnabled(): boolean {
    return this._wasmSpace !== null && isWasmAvailable();
  }

  /**
   * Get the underlying WASM Space instance
   * @returns WasmSpace instance or null if not initialized
   */
  get wasmInstance(): WasmSpace | null {
    return this._wasmSpace;
  }
}
