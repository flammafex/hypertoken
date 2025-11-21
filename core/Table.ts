/*
 * Copyright 2025 The Carpocratian Church of Commonality and Equality, Inc.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
/*
 * core/Table.ts
 */
import { Emitter } from "./events.js";
import { SessionManager } from "./SessionManager.js";
import { IPlacementCRDT, IToken } from "./types.js";
import { Deck } from "./Deck.js";
import { Shoe } from "./Shoe.js";

export interface SpreadZone {
  id: string;
  x?: number;
  y?: number;
  label?: string;
}

export class Table extends Emitter {
  private session: SessionManager;
  name: string;
  spreads: Record<string, SpreadZone[]> = {};
  _lockedZones: Set<string> = new Set();
  log: any[] = [];

  constructor(session: SessionManager, name: string = "table") {
    super();
    this.session = session;
    this.name = name;
  }

  // --- HELPERS ---

  // Helper to sanitize token data for CRDT
  private _sanitizeToken(token: IToken): any {
    // 1. Convert Class instance to Plain Object
    const plain = { ...token };
    
    // 2. Handle Sets (Automerge doesn't support Set)
    if (plain._tags instanceof Set) {
      // @ts-ignore
      plain._tags = Array.from(plain._tags);
    }
    
    // 3. Remove any other non-serializable fields if necessary
    // A quick way to ensure CRDT safety is JSON cycle:
    return JSON.parse(JSON.stringify(plain));
  }

  get zones(): string[] {
    // Fix: Check if zones exists
    return this.session.state.zones ? Object.keys(this.session.state.zones) : [];
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

  // --- READ METHODS ---

  zone(name: string): readonly IPlacementCRDT[] {
    // Fix: Check if zones exists
    return this.session.state.zones?.[name] || [];
  }

  zoneCount(name: string): number {
    return this.zone(name).length;
  }

  cards(zoneName?: string): readonly IPlacementCRDT[] {
    if (zoneName) return this.zone(zoneName);
    // Fix: Handle missing zones object
    if (!this.session.state.zones) return [];
    return Object.values(this.session.state.zones).flat();
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

  // --- WRITE METHODS ---

place(zoneName: string, token: IToken, opts: Partial<IPlacementCRDT> = {}): IPlacementCRDT | null {
    if (this._isLocked(zoneName)) return null;

    // SANITIZE: Convert Token instance to pure JSON data for Automerge
    const safeToken = this._sanitizeToken(token);

    const placement: IPlacementCRDT = {
      id: crypto.randomUUID(),
      tokenId: token.id,
      tokenSnapshot: safeToken, // Use the sanitized version
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

    this.log.push({ t: "place", zoneName, placementId: placement.id });
    this.emit("place", placement);
    return placement;
  }

  move(fromZone: string, toZone: string, placementId: string, opts: { x?: number; y?: number } = {}): void {
    if (this._isLocked(fromZone) || this._isLocked(toZone)) return;

    this.session.change(`move card from ${fromZone} to ${toZone}`, (doc) => {
      if (!doc.zones) return; // Cannot move if no zones exist
      const from = doc.zones[fromZone];
      if (!from) return;

      const idx = from.findIndex(p => p.id === placementId);
      if (idx === -1) return;

      const [placement] = from.splice(idx, 1);
      
      if (opts.x !== undefined) placement.x = opts.x;
      if (opts.y !== undefined) placement.y = opts.y;

      if (!doc.zones[toZone]) doc.zones[toZone] = [];
      doc.zones[toZone].push(placement);
    });

    this.log.push({ t: "move", fromZone, toZone, placementId });
    this.emit("move", { fromZone, toZone, placementId });
  }

  flip(zoneName: string, placementId: string, faceUp?: boolean): void {
    if (this._isLocked(zoneName)) return;

    this.session.change(`flip card in ${zoneName}`, (doc) => {
      if (!doc.zones) return;
      const zone = doc.zones[zoneName];
      if (!zone) return;
      const placement = zone.find(p => p.id === placementId);
      if (placement) {
        placement.faceUp = faceUp !== undefined ? faceUp : !placement.faceUp;
      }
    });

    this.log.push({ t: "flip", zoneName, placementId, faceUp });
    this.emit("flip", { id: placementId, faceUp });
  }

  remove(zoneName: string, placementId: string): void {
    if (this._isLocked(zoneName)) return;

    this.session.change(`remove card from ${zoneName}`, (doc) => {
      if (!doc.zones) return;
      const zone = doc.zones[zoneName];
      if (zone) {
        const idx = zone.findIndex(p => p.id === placementId);
        if (idx >= 0) zone.splice(idx, 1);
      }
    });

    this.log.push({ t: "remove", zoneName, placementId });
    this.emit("remove", { id: placementId });
  }

  clear(): void {
    this.session.change("clear table", (doc) => {
      doc.zones = {};
    });
    this.log = [];
    this.emit("clear");
  }

  createZone(id: string, { label = id, x = 0, y = 0 } = {}): this {
    this.session.change(`create zone ${id}`, (doc) => {
      if (!doc.zones) doc.zones = {};
      if (!doc.zones[id]) doc.zones[id] = [];
    });
    this.emit("zone:created", { payload: { id, label, x, y } });
    return this;
  }

  deleteZone(id: string): this {
    this.session.change(`delete zone ${id}`, (doc) => {
      if (doc.zones) delete doc.zones[id];
    });
    this.emit("zone:deleted", { payload: { id } });
    return this;
  }

  clearZone(name: string): this {
    if (this._isLocked(name)) return this;
    this.session.change(`clear zone ${name}`, (doc) => {
      if (doc.zones) doc.zones[name] = [];
    });
    this.emit("clearZone", { name });
    return this;
  }

  lockZone(id: string, locked = true): this {
    if (!this._lockedZones) this._lockedZones = new Set();
    locked ? this._lockedZones.add(id) : this._lockedZones.delete(id);
    this.emit("zone:locked", { payload: { id, locked } });
    return this;
  }

  transferZone(fromZone: string, toZone: string): number {
    if (this._isLocked(fromZone) || this._isLocked(toZone)) return 0;
    let count = 0;
    this.session.change(`transfer ${fromZone} to ${toZone}`, (doc) => {
      if (!doc.zones) return;
      const from = doc.zones[fromZone];
      if (!from || from.length === 0) return;
      
      if (!doc.zones[toZone]) doc.zones[toZone] = [];
      
      const items = from.splice(0, from.length);
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
    const items = [...this.zone(name)];
    if (!items.length) return;
    
    items.sort(() => Math.random() - 0.5);

    this.session.change(`shuffle zone ${name}`, (doc) => {
      if (!doc.zones) doc.zones = {};
      doc.zones[name] = items;
    });
    this.log.push({ t: "shuffleZone", name, ts: Date.now() });
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
    let drawn: IPlacementCRDT[] = [];
    this.session.change(`draw ${n} from ${name}`, (doc) => {
      if (!doc.zones) return;
      const zone = doc.zones[name];
      if (zone && zone.length > 0) {
        const amount = Math.min(n, zone.length);
        drawn = zone.splice(zone.length - amount, amount);
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

    this.session.change(`push ${arr.length} to ${name}`, (doc) => {
      if (!doc.zones) doc.zones = {};
      if (!doc.zones[name]) doc.zones[name] = [];
      doc.zones[name].push(...arr);
    });
    this.emit("pushToZone", { zone: name, count: arr.length });
  }

  returnToDeck(deck: Deck, zoneName: string, n: number = 1, { toTop = true } = {}): IToken[] {
    const removedPlacements = this.drawFromZone(zoneName, n);
    const tokens = removedPlacements.map(p => p.tokenSnapshot);
    if (toTop) {
        // @ts-ignore
        tokens.forEach(t => deck._stack.push(t)); 
    } else {
        // @ts-ignore
        tokens.forEach(t => deck._stack.unshift(t));
    }
    this.emit("returnToDeck", { zone: zoneName, count: tokens.length });
    return tokens;
  }

  collectAllInto(deck: Deck, { includeEmpty = false } = {}): number {
    let total = 0;
    const zonesToClear: string[] = [];
    
    for (const zoneName of this.zones) {
      const pile = this.zone(zoneName);
      if (!includeEmpty && pile.length === 0) continue;
      
      pile.forEach(p => {
        // @ts-ignore
        deck._stack.push(p.tokenSnapshot);
        total++;
      });
      zonesToClear.push(zoneName);
    }

    if (zonesToClear.length > 0) {
      this.session.change("collect all to deck", (doc) => {
        if (!doc.zones) return;
        zonesToClear.forEach(z => doc.zones![z] = []);
      });
    }

    deck.shuffle();
    this.emit("collectAllInto", { zones: total });
    return total;
  }

  defineSpread(name: string, zones: SpreadZone[]): this {
    this.spreads[name] = zones;
    return this;
  }

  dealSpread(name: string, source: Deck | Shoe, { faceUp = true } = {}): void {
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
}