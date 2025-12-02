/*
 * core/Space.ts
 */
import { Emitter } from "./events.js";
import * as crypto from "crypto";
/**
 * Space: CRDT-backed spatial zone management
 * Manages 2D placement of tokens in named zones with locking and layout patterns
 */
export class Space extends Emitter {
    session;
    name;
    spreads = {};
    _lockedZones = new Set();
    log = [];
    /**
     * Create a new Space
     * @param session - Chronicle instance for CRDT state management
     * @param name - Name of this space
     * @throws Error if session is null/undefined
     */
    constructor(session, name = "space") {
        super();
        if (!session) {
            throw new Error("Space requires a valid Chronicle session");
        }
        this.session = session;
        this.name = name;
    }
    // ... (Rest of the class implementation remains unchanged)
    // Include all original methods below
    // --- HELPERS ---
    // Helper to sanitize token data for CRDT
    _sanitizeToken(token) {
        const plain = { ...token };
        if (plain._tags instanceof Set) {
            // @ts-ignore
            plain._tags = Array.from(plain._tags);
        }
        return JSON.parse(JSON.stringify(plain));
    }
    get zones() {
        return this.session.state.zones ? Object.keys(this.session.state.zones) : [];
    }
    toJSON() {
        return {
            name: this.name,
            zones: this.session.state.zones || {},
            log: this.log
        };
    }
    snapshot() {
        return this.toJSON();
    }
    zone(name) {
        return this.session.state.zones?.[name] || [];
    }
    zoneCount(name) {
        return this.zone(name).length;
    }
    cards(zoneName) {
        if (zoneName)
            return this.zone(zoneName);
        if (!this.session.state.zones)
            return [];
        return Object.values(this.session.state.zones).flat();
    }
    findCard(idOrFn) {
        const all = this.cards();
        if (typeof idOrFn === "function") {
            return all.find(idOrFn) || null;
        }
        return all.find(p => p.id === idOrFn) || null;
    }
    _isLocked(name) {
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
    place(zoneName, token, opts = {}) {
        if (!token || !token.id) {
            throw new Error("Cannot place invalid token (missing id)");
        }
        if (this._isLocked(zoneName)) {
            this.emit("space:locked", { operation: "place", zoneName });
            return null;
        }
        const safeToken = this._sanitizeToken(token);
        const placement = {
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
            if (!doc.zones)
                doc.zones = {};
            if (!doc.zones[zoneName])
                doc.zones[zoneName] = [];
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
    move(fromZone, toZone, placementId, opts = {}) {
        if (this._isLocked(fromZone) || this._isLocked(toZone)) {
            this.emit("space:locked", { operation: "move", fromZone, toZone });
            return;
        }
        let found = false;
        this.session.change(`move card from ${fromZone} to ${toZone}`, (doc) => {
            if (!doc.zones)
                return;
            const from = doc.zones[fromZone];
            if (!from)
                return;
            const idx = from.findIndex(p => p.id === placementId);
            if (idx === -1)
                return;
            found = true;
            const [placement] = from.splice(idx, 1);
            if (opts.x !== undefined)
                placement.x = opts.x;
            if (opts.y !== undefined)
                placement.y = opts.y;
            if (!doc.zones[toZone])
                doc.zones[toZone] = [];
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
    flip(zoneName, placementId, faceUp) {
        if (this._isLocked(zoneName)) {
            this.emit("space:locked", { operation: "flip", zoneName });
            return;
        }
        let found = false;
        this.session.change(`flip card in ${zoneName}`, (doc) => {
            if (!doc.zones)
                return;
            const zone = doc.zones[zoneName];
            if (!zone)
                return;
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
    remove(zoneName, placementId) {
        if (this._isLocked(zoneName)) {
            this.emit("space:locked", { operation: "remove", zoneName });
            return;
        }
        let found = false;
        this.session.change(`remove card from ${zoneName}`, (doc) => {
            if (!doc.zones)
                return;
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
    clear() {
        this.session.change("clear space", (doc) => {
            doc.zones = {};
        });
        this.log = [];
        this.emit("clear");
    }
    createZone(id, { label = id, x = 0, y = 0 } = {}) {
        this.session.change(`create zone ${id}`, (doc) => {
            if (!doc.zones)
                doc.zones = {};
            if (!doc.zones[id])
                doc.zones[id] = [];
        });
        this.emit("zone:created", { payload: { id, label, x, y } });
        return this;
    }
    deleteZone(id) {
        this.session.change(`delete zone ${id}`, (doc) => {
            if (doc.zones)
                delete doc.zones[id];
        });
        this.emit("zone:deleted", { payload: { id } });
        return this;
    }
    clearZone(name) {
        if (this._isLocked(name))
            return this;
        this.session.change(`clear zone ${name}`, (doc) => {
            if (doc.zones)
                doc.zones[name] = [];
        });
        this.emit("clearZone", { name });
        return this;
    }
    lockZone(id, locked = true) {
        if (!this._lockedZones)
            this._lockedZones = new Set();
        locked ? this._lockedZones.add(id) : this._lockedZones.delete(id);
        this.emit("zone:locked", { payload: { id, locked } });
        return this;
    }
    transferZone(fromZone, toZone) {
        if (this._isLocked(fromZone) || this._isLocked(toZone))
            return 0;
        let count = 0;
        this.session.change(`transfer ${fromZone} to ${toZone}`, (doc) => {
            if (!doc.zones)
                return;
            const from = doc.zones[fromZone];
            if (!from || from.length === 0)
                return;
            if (!doc.zones[toZone])
                doc.zones[toZone] = [];
            const items = from.splice(0, from.length);
            doc.zones[toZone].push(...items);
            count = items.length;
        });
        this.emit("transferZone", { fromZone, toZone, count });
        return count;
    }
    fan(zoneName, opts = {}) {
        this.spreadZone(zoneName, { pattern: "arc", ...opts });
    }
    stackZone(id) {
        if (this._isLocked(id))
            return this;
        this.session.change(`stack zone ${id}`, (doc) => {
            if (!doc.zones)
                return;
            const arr = doc.zones[id];
            if (arr) {
                arr.forEach(p => { p.x = 0; p.y = 0; });
            }
        });
        this.emit("zone:stacked", { payload: { id } });
        return this;
    }
    spreadZone(id, { pattern = "linear", angleStep = 15, radius = 100 } = {}) {
        if (this._isLocked(id))
            return this;
        this.session.change(`spread zone ${id}`, (doc) => {
            if (!doc.zones)
                return;
            const arr = doc.zones[id];
            if (!arr)
                return;
            if (pattern === "arc") {
                arr.forEach((p, i) => {
                    const a = (i - arr.length / 2) * angleStep * Math.PI / 180;
                    p.x = Math.cos(a) * radius;
                    p.y = Math.sin(a) * radius;
                });
            }
            else {
                arr.forEach((p, i) => {
                    p.x = i * angleStep;
                    p.y = 0;
                });
            }
        });
        this.emit("zone:spread", { payload: { id, pattern } });
        return this;
    }
    shuffleZone(name, seed) {
        if (this._isLocked(name))
            return;
        const items = [...this.zone(name)];
        if (!items.length)
            return;
        items.sort(() => Math.random() - 0.5);
        this.session.change(`shuffle zone ${name}`, (doc) => {
            if (!doc.zones)
                doc.zones = {};
            doc.zones[name] = items;
        });
        this.log.push({ type: "shuffleZone", name, timestamp: Date.now() });
    }
    pile(name) {
        return this.zone(name);
    }
    peekZone(name, n = 1) {
        const pile = this.zone(name);
        if (pile.length === 0)
            return null;
        if (n === 1)
            return pile[pile.length - 1];
        return pile.slice(-n).reverse();
    }
    drawFromZone(name, n = 1) {
        if (this._isLocked(name))
            return [];
        let drawn = [];
        this.session.change(`draw ${n} from ${name}`, (doc) => {
            if (!doc.zones)
                return;
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
    pushToZone(name, cards) {
        if (this._isLocked(name))
            return;
        const arr = Array.isArray(cards) ? cards : [cards];
        if (arr.length === 0)
            return;
        this.session.change(`push ${arr.length} to ${name}`, (doc) => {
            if (!doc.zones)
                doc.zones = {};
            if (!doc.zones[name])
                doc.zones[name] = [];
            doc.zones[name].push(...arr);
        });
        this.emit("pushToZone", { zone: name, count: arr.length });
    }
    returnToStack(stack, zoneName, n = 1, { toTop = true } = {}) {
        const removedPlacements = this.drawFromZone(zoneName, n);
        const tokens = removedPlacements.map(p => p.tokenSnapshot);
        // Stack is now CRDT aware, we need to handle insertion via stack methods
        // But here we are accessing stack directly. 
        // Since Stack is refactored, we should use stack.insertAt or create a bulk insert method.
        // For now, we can iterate:
        if (toTop) {
            tokens.forEach(t => stack.insertAt(t, stack.size));
        }
        else {
            tokens.forEach(t => stack.insertAt(t, 0));
        }
        this.emit("returnToStack", { zone: zoneName, count: tokens.length });
        return tokens;
    }
    collectAllInto(stack, { includeEmpty = false } = {}) {
        let total = 0;
        const tokensToReturn = [];
        const zonesToClear = [];
        // Read phase
        for (const zoneName of this.zones) {
            const pile = this.zone(zoneName);
            if (!includeEmpty && pile.length === 0)
                continue;
            pile.forEach(p => tokensToReturn.push(p.tokenSnapshot));
            zonesToClear.push(zoneName);
        }
        // Write phase (Atomic)
        this.session.change("collect all to stack", (doc) => {
            // Clear zones
            if (doc.zones) {
                zonesToClear.forEach(z => doc.zones[z] = []);
            }
            // Add to stack (assuming Stack uses same session)
            // Ideally we call stack methods, but we are inside a change callback here if we want atomicity.
            // Since Stack logic is wrapped in session.change, calling stack.insert() here would nest transactions?
            // Automerge handles nesting fine usually, or we can just do it sequentially.
        });
        // We add tokens back to stack. 
        // Since we are outside the change block above, we can call stack methods.
        // Ideally this should be one atomic move, but for now:
        tokensToReturn.forEach(t => stack.insertAt(t, stack.size));
        total = tokensToReturn.length;
        stack.shuffle();
        this.emit("collectAllInto", { zones: total });
        return total;
    }
    defineSpread(name, zones) {
        this.spreads[name] = zones;
        return this;
    }
    dealSpread(name, source, { faceUp = true } = {}) {
        const pattern = this.spreads[name];
        if (!pattern)
            throw new Error(`Spread "${name}" not defined.`);
        for (const zone of pattern) {
            const card = source.draw();
            if (!card)
                break;
            this.place(zone.id, card, {
                x: zone.x ?? null,
                y: zone.y ?? null,
                faceUp,
                label: zone.label ?? zone.id
            });
        }
        this.emit("dealSpread", { name });
    }
    clearSpread(name) {
        const pattern = this.spreads?.[name];
        if (!pattern)
            return this;
        const ids = new Set(pattern.map(z => z.id));
        this.session.change(`clear spread ${name}`, (doc) => {
            if (!doc.zones)
                return;
            Object.keys(doc.zones).forEach(zone => {
                if (ids.has(zone))
                    doc.zones[zone] = [];
            });
        });
        this.emit("clearSpread", { name });
        return this;
    }
}
