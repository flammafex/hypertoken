/*
 * Copyright 2025 The Carpocratian Church of Commonality and Equality, Inc.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *      http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
//./core/Table.js
import { Emitter } from "./events.js";
import { mulberry32, shuffleArray } from "./random.js";

export class Table extends Emitter {
  constructor(name="session") {
    super();
    this.name = name;
    this.zones = new Map();
    this.log = [];
  }
// Always ensure a valid zone array exists and return it
zone(name) {
  if (!this.zones.has(name)) this.zones.set(name, []);
  return this.zones.get(name);
}

_isLocked(name) {
  return this._lockedZones?.has(name);
}

  place(zoneName, token, { x=null, y=null, faceUp=true, label=null } = {}) {
      if (this._isLocked(zoneName)) return null;

    const placement = {
      id: crypto?.randomUUID?.() || String(Date.now() + Math.random()),
      token,                // new neutral property
      card: token,          // backward-compat alias
      x, y, faceUp,
      label,
      ts: Date.now(),
      reversed: !!token._rev
    };
    this.zone(zoneName).push(placement);
    this.log.push({ t:"place", zoneName, placementId: placement.id });
    this.emit("place", placement);
    return placement;
  }
  move(fromZone, toZone, placement, { x=placement.x, y=placement.y } = {}) {
      if (this._isLocked(fromZone) || this._isLocked(toZone)) return placement;
        const from = this.zone(fromZone);
        const idx = from.indexOf(placement);
        if (idx >= 0) from.splice(idx,1);
        placement.x = x; placement.y = y;
        this.zone(toZone).push(placement);
        this.log.push({ t:"move", fromZone, toZone, placementId: placement.id });
        this.emit("move",{from,to,placement:placement}); return placement;
  }
  flip(zoneName, placement, faceUp = !placement.faceUp) {
      if (this._isLocked(zoneName)) return placement;
        placement.faceUp = faceUp;
        this.log.push({ t:"flip", zoneName, placementId: placement.id, faceUp });
        this.emit("flip", placement); return placement;
  }
  remove(zoneName, placement) {
      if (this._isLocked(zoneName)) return null;
        const arr = this.zone(zoneName);
        if (!arr) return null;
        const i = arr.indexOf(placement);
        if (i >= 0) arr.splice(i,1);
        this.log.push({ t:"remove", zoneName, placementId: placement.id });
        this.emit("remove", placement); return placement;
  }
  snapshot() {
        return JSON.parse(JSON.stringify({
          name: this.name,
          zones: [...this.zones.entries()],
          log: this.log,
        }));
  }
  toJSON() {
  return this.snapshot();
}
  clear() { this.zones.clear(); this.log = []; this.emit("clear"); }
            /** Return all placement objects (optionally from a specific zone). */
  cards(zoneName = null) {
        if (zoneName) return (this.zones.get(zoneName) || []).slice();
        return Array.from(this.zones.values()).flat();
  }

        /** Return all card objects (stripped of placement wrappers). */
  allCards() {
        return this.cards().map(p => p.card);
  }

        /** Find a placement by ID or by predicate function. */
  findCard(idOrFn) {
    for (const [zone, arr] of this.zones) {
                for (const p of arr) {
                if (typeof idOrFn === "function" ? idOrFn(p) : p.id === idOrFn) return p;
                }
            }
        return null;
    }

        /** Return an array of placements matching a predicate. */
  where(fn) {
        return this.cards().filter(fn);
    }
            /** Count how many cards in a zone. */
  zoneCount(name) {
        return (this.zones.get(name) || []).length;
  }

        /** Rename a zone while preserving its contents. */
  renameZone(oldName, newName) {
        if (!this.zones.has(oldName)) return;
        const cards = this.zones.get(oldName);
        this.zones.set(newName, cards);
        this.zones.delete(oldName);
        this.log.push({ t:"renameZone", oldName, newName, ts: Date.now() });
        this.emit("renameZone",{oldName,newName});
  }

        /** Merge zones into a new or existing zone. */
  mergeZones(zoneA, zoneB, dest) {
        const a = this.zones.get(zoneA) || [];
        const b = this.zones.get(zoneB) || [];
        this.zones.set(dest, [...(this.zones.get(dest) || []), ...a, ...b]);
        this.zones.delete(zoneA);
        this.zones.delete(zoneB);
        this.log.push({ t:"mergeZones", zoneA, zoneB, dest, ts: Date.now() });
  }

        /** Clear a single zone. */
  clearZone(name) {
       if (this._isLocked(name)) return this;
        if (this.zones.has(name)) this.zones.set(name, []);
        this.log.push({ t:"clearZone", name, ts: Date.now() });
        this.emit("clearZone",{name});
  }
            /** Return the last N actions from the table log. */
  history({ last = null } = {}) {
        return last ? this.log.slice(-last) : this.log.slice();
  }

        /** Return the most recent action of a given type (e.g., "place"). */
  lastActionOf(type) {
        for (let i = this.log.length - 1; i >= 0; i--) {
            if (this.log[i].t === type) return this.log[i];
        }
        return null;
  }

        /** Undo the most recent placement / movement (very basic). */
  undoLast() {
        const last = this.log.pop();
        if (!last) return null;

        if (last.t === "place") {
            const arr = this.zones.get(last.zoneName);
            if (arr) {
            const idx = arr.findIndex(p => p.id === last.placementId);
            if (idx >= 0) arr.splice(idx, 1);
            }
        } else if (last.t === "move") {
            const toArr = this.zones.get(last.toZone);
            const placement = toArr.find(p => p.id === last.placementId);
            if (placement) {
            toArr.splice(toArr.indexOf(placement), 1);
            this.zone(last.fromZone).push(placement);
            }
        }
        return last;
  }
            /** Shuffle cards within a zone (useful for piles). */
  shuffleZone(name, seed = null) {
      if (this._isLocked(name)) return this;
        const arr = this._getZoneOrSkip(zoneName);
        if (!arr) return this;
        shuffleArray(arr, seed);
        this.log.push({ t:"shuffleZone", name, ts: Date.now() });
        return this;
  }

        /** Fan cards within a zone (assigns x,y in simple arc pattern). */
  fan(zoneName, { radius = 100, angleStep = 15, startAngle = 0 } = {}) {
      if (this._isLocked(zoneName)) return this;
        const arr = this.zones.get(zoneName);
        if (!arr) return this;
        arr.forEach((p, i) => {
            const angle = (startAngle + i * angleStep) * Math.PI / 180;
            p.x = Math.cos(angle) * radius;
            p.y = Math.sin(angle) * radius;
        });
        this.log.push({ t:"fan", zoneName, ts: Date.now() });
        return this;
  }
            // ─── Spreads ─────────────────────────────────────────────────
  defineSpread(name, zones) {
        // zones: [{id, x, y, label}]
        if (!this.spreads) this.spreads = {};
        this.spreads[name] = zones;
        return this;
   }

        /** Return defined spread names */
  listSpreads() {
        return Object.keys(this.spreads || {});
  }

        /** Delete a spread definition */
  removeSpread(name) {
        if (this.spreads) delete this.spreads[name];
  }

    /**
     * Deal cards into a spread from a Deck or Shoe.
     * @param {string} name - spread name
     * @param {Deck|Shoe} source - card source
     * @param {boolean} faceUp - if true, cards are placed face-up
     */
    dealSpread(name, source, { faceUp = true } = {}) {
    const pattern = this.spreads?.[name];
    if (!pattern) throw new Error(`Spread "${name}" not defined.`);
    const placed = [];

    for (const zone of pattern) {
        const card = source.draw();
        if (!card) break;
        const p = this.place(zone.id, card, {
        x: zone.x ?? null,
        y: zone.y ?? null,
        faceUp,
        label: zone.label ?? zone.id
        });
        placed.push(p);
    }

    this.emit?.("dealSpread", { name, placed });
    return placed;
    }
    clearSpread(name) {
    const pattern = this.spreads?.[name];
    if (!pattern) return this;
    const ids = new Set(pattern.map(z => z.id));
    for (const [zone, arr] of this.zones) {
        if (ids.has(zone)) this.zones.set(zone, []);
    }
    this.emit?.("clearSpread", { name });
    return this;
    }
      /*───────────────────────────────────────────────────────────────
   TABLE PILE + RETURN UTILITIES
   Enables: drawFromZone, pushToZone, returnToDeck, shuffleZoneIntoDeck,
            collectAllInto
───────────────────────────────────────────────────────────────*/

/** Always return a valid pile array for a zone. */
pile(name) {
  return this.zone(name);
}


/** Peek at top card(s) of a zone pile. */
peekZone(name, n = 1) {
  const pile = this.pile(name);
  if (n === 1) return pile[pile.length - 1] || null;
  return pile.slice(-n).reverse();
}

/** Draw (remove) top card(s) from a zone pile. */
drawFromZone(name, n = 1) {
  const pile = this.pile(name);
  const drawn = [];
  for (let i = 0; i < n && pile.length; i++) drawn.push(pile.pop());
  this.emit?.("drawFromZone", { zone: name, count: drawn.length, cards: drawn });
  return drawn;
}

/** Push card(s) onto a zone pile (acts like a mini deck). */
pushToZone(name, cards) {
  const pile = this.pile(name);
  const arr = Array.isArray(cards) ? cards : [cards];
  for (const c of arr) pile.push(c);
  this.emit?.("pushToZone", { zone: name, count: arr.length });
  return pile;
}

/** Return specific card(s) from a zone back onto the deck top or bottom. */
returnToDeck(deck, zoneName, n = 1, { toTop = true } = {}) {
  const pile = this.pile(zoneName);
  const moved = [];
  for (let i = 0; i < n && pile.length; i++) {
    const placement = pile.pop();
    if (!placement) break;
    if (toTop) deck.pushTop(placement.card)
    else deck._stack.unshift(placement.card);
    moved.push(placement.card);
    deck._drawn = deck.removeFromDrawn(placement.card)
 deck._discards = deck.removeFromDiscards(placement.card);
  }
  this.emit?.("returnToDeck", { zone: zoneName, count: moved.length });
  return moved;
}

/** Shuffle all cards from a zone back into the deck. */
shuffleZoneIntoDeck(deck, zoneName) {
  const pile = this.pile(zoneName);
  const cards = pile.splice(0, pile.length).map(p => p.card);
  deck._stack.push(...cards);
  deck.shuffle();
  this.emit?.("shuffleZoneIntoDeck", { zone: zoneName, count: cards.length });
  return cards.length;
}

/** Move all cards from one zone to another (table→table). */
transferZone(fromZone, toZone) {
  const drawn = this.drawFromZone(fromZone, this.pile(fromZone).length);
  const cards = drawn.map(p => p.card);
  this.pushToZone(toZone, cards.map(card => ({ card, x:null, y:null, faceUp:true, label:toZone, ts:Date.now() })));
  this.emit?.("transferZone", { fromZone, toZone, count: cards.length });
  return cards.length;
}

/** Collect all cards from all zones back into a deck and shuffle. */
collectAllInto(deck, { includeEmpty = false } = {}) {
  let total = 0;
  for (const [zone, arr] of this.zones) {
    if (!includeEmpty && !arr.length) continue;
    for (const p of arr) {
        deck._stack.push(p.card);
      // Remove from drawn/discards if present
        deck._drawn = deck._drawn.filter(c => c !== p.card);
         deck._discards = deck._discards.filter(c => c !== p.card);
    }
    arr.length = 0;
    total++;
  }
  deck.shuffle();
  this.emit?.("collectAllInto", { zones: total });
  return total;
  }

  // Table.js
static fromSnapshot(snap) {
  const t = new Table(snap?.name ?? "session");
  t.log = Array.isArray(snap?.log) ? snap.log.slice() : [];
  t.zones = new Map(snap?.zones?.map(([name, arr]) => [name, arr.map(p => ({ ...p }))]) ?? []);
  return t;
}

createZone(id, { label = id, x = 0, y = 0 } = {}) {
  if (!id) return this;
  if (this.zones.has(id)) return this; // idempotent
  this.zones.set(id, []);
  this.emit("zone:created", { payload: { id, label, x, y } });
  return this;
}

deleteZone(id) {
  if (!this.zones.has(id)) return this;
  this.zones.delete(id);
  this.emit("zone:deleted", { payload: { id } });
  return this;
}

moveMany(fromZone, toZone, count, { preserveOrder = true } = {}) {
  const from = this.zone(fromZone);
  const to = this.zone(toZone);
  if (!from.length || count <= 0) return [];

  const moved = from.splice(-count, count);
  if (preserveOrder) moved.reverse();
  to.push(...moved);

  this.emit("placements:moved", {
    payload: { fromZone, toZone, count: moved.length, preserveOrder }
  });
  return moved;
}

swapZones(a, b) {
  if (!this.zones.has(a) || !this.zones.has(b)) return this;
  const tmp = this.zones.get(a);
  this.zones.set(a, this.zones.get(b));
  this.zones.set(b, tmp);
  this.emit("zones:swapped", { payload: { a, b } });
  return this;
}

stackZone(id) {
  const arr = this.zone(id);
  arr.forEach((p, i) => { p.x = 0; p.y = 0; p.offset = i; });
  this.emit("zone:stacked", { payload: { id, count: arr.length } });
  return this;
}

spreadZone(id, { pattern = "linear", angleStep = 15, radius = 100 } = {}) {
  const arr = this.zone(id);
  if (!arr.length) return this;

  if (pattern === "arc") {
    arr.forEach((p, i) => {
      const a = (i - arr.length / 2) * angleStep * Math.PI / 180;
      p.x = Math.cos(a) * radius;
      p.y = Math.sin(a) * radius;
    });
  } else {
    arr.forEach((p, i) => { p.x = i * angleStep; p.y = 0; });
  }

  this.emit("zone:spread", {
    payload: { id, pattern, count: arr.length, angleStep, radius }
  });
  return this;
}

lockZone(id, locked = true) {
  const zone = this.zone(id);
  if (!zone) return this;
  if (!this._lockedZones) this._lockedZones = new Set();
  locked ? this._lockedZones.add(id) : this._lockedZones.delete(id);
  this.emit("zone:locked", { payload: { id, locked } });
  return this;
}

query(fn) {
  const results = [];
  for (const [zone, arr] of this.zones) {
    for (const p of arr) if (fn(p, zone)) results.push(p);
  }
  this.emit("table:query", { payload: { results: results.length } });
  return results;
}

tagPlacement(idOrPlacement, tags) {
  const placement = typeof idOrPlacement === "string"
    ? this.findCard(idOrPlacement)
    : idOrPlacement;
  if (!placement) return this;
  const arr = Array.isArray(tags) ? tags : [tags];
  if (!placement._tags) placement._tags = new Set();
  arr.forEach(t => placement._tags.add(t));
  this.emit("placement:tagged", { payload: { id: placement.id, tags: arr } });
  return this;
}

findPlacementByTag(tag) {
  const results = this.query(p => p._tags?.has(tag));
  this.emit("placement:findByTag", { payload: { tag, count: results.length } });
  return results;
}

  
}