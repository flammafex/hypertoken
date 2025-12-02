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
/*
 * core/events.ts
 */
import { generateId } from "./crypto.js";
export class Emitter {
    // Map event names to sets of handlers
    _events = {};
    constructor() {
        this._events = {};
    }
    on(type, fn) {
        if (!this._events[type])
            this._events[type] = new Set();
        this._events[type].add(fn);
        return this;
    }
    off(type, fn) {
        if (this._events[type])
            this._events[type].delete(fn);
        return this;
    }
    once(type, fn) {
        const wrapper = (...args) => {
            fn(...args);
            this.off(type, wrapper);
        };
        return this.on(type, wrapper);
    }
    emit(type, payload = {}) {
        // Always create a structured event object
        const evt = (payload && payload.type && payload.payload !== undefined)
            ? payload // already an event object
            : {
                id: generateId(),
                type,
                payload,
                ts: Date.now()
            };
        // Dispatch to type-specific listeners
        if (this._events[type]) {
            for (const fn of this._events[type])
                fn(evt);
        }
        // Dispatch to wildcard listeners
        if (this._events["*"]) {
            for (const fn of this._events["*"])
                fn(evt);
        }
        return true;
    }
}
/**
 * EventRegistry: Event logging and replay system with automatic pruning
 * Maintains a bounded log of events with configurable pruning strategies
 */
export class EventRegistry extends Emitter {
    name;
    events;
    _sources;
    storage;
    _maxEvents;
    _pruneStrategy;
    /**
     * Create a new EventRegistry
     * @param name - Name of this registry
     * @param options - Configuration options
     */
    constructor(name = "session", { storage, maxEvents = 10000, pruneStrategy = "fifo" } = {}) {
        super();
        this.name = name;
        this.events = [];
        this._sources = new Set();
        this.storage = storage;
        this._maxEvents = maxEvents;
        this._pruneStrategy = pruneStrategy;
    }
    attach(source, label = null) {
        if (!source?.on)
            throw new Error("Source must be an Emitter.");
        if (this._sources.has(source))
            return this;
        this._sources.add(source);
        const tag = label || source.constructor.name;
        source.on("*", (payload) => this.record("*", tag, payload));
        // Monkey-patch emit to intercept all events (common pattern in this architecture)
        const originalEmit = source.emit.bind(source);
        source.emit = (type, payload) => {
            const result = originalEmit(type, payload);
            this.record(type, tag, payload);
            return result;
        };
        return this;
    }
    /**
     * Record an event to the registry
     * Automatically prunes old events if max limit is reached
     * @param type - Event type
     * @param source - Event source identifier
     * @param payload - Event payload data
     */
    record(type, source, payload) {
        const evt = {
            id: generateId(),
            type,
            source,
            payload,
            ts: Date.now()
        };
        this.events.push(evt);
        // Prune if we've exceeded max events
        if (this.events.length > this._maxEvents) {
            this._prune();
        }
        // Emit without wildcard to prevent infinite loops if registry is attached to itself
        if (this._events[type]) {
            for (const fn of this._events[type])
                fn(evt);
        }
    }
    /**
     * Prune events based on configured strategy
     * @private
     */
    _prune() {
        const excess = this.events.length - this._maxEvents;
        if (excess <= 0)
            return;
        if (this._pruneStrategy === "fifo" || this._pruneStrategy === "oldest") {
            // Both strategies remove from the beginning
            this.events.splice(0, excess);
            this.emit("registry:pruned", { count: excess, strategy: this._pruneStrategy });
        }
    }
    /**
     * Set maximum number of events to retain
     * @param max - Maximum event count
     * @throws Error if max is not a positive integer
     */
    setMaxEvents(max) {
        if (max < 1 || !Number.isInteger(max)) {
            throw new Error(`Invalid max events: ${max}. Must be a positive integer.`);
        }
        this._maxEvents = max;
        if (this.events.length > this._maxEvents) {
            this._prune();
        }
        return this;
    }
    /**
     * Get current event count and maximum
     */
    getStats() {
        return {
            current: this.events.length,
            max: this._maxEvents,
            strategy: this._pruneStrategy
        };
    }
    last(n = null) {
        return n ? this.events.slice(-n) : [...this.events];
    }
    filter(type) {
        return this.events.filter(e => e.type === type);
    }
    toJSON() {
        return JSON.stringify({ name: this.name, count: this.events.length, events: this.events }, null, 2);
    }
    saveLocal(key = "eventlog") {
        if (!this.storage?.setItem)
            return;
        this.storage.setItem(key, this.toJSON());
    }
    static loadLocal(key = "eventlog", { storage } = {}) {
        if (!storage?.getItem)
            return null;
        const raw = storage.getItem(key);
        if (!raw)
            return null;
        const data = JSON.parse(raw);
        const reg = new EventRegistry(data.name, { storage });
        reg.events = data.events || [];
        return reg;
    }
    clear() { this.events = []; }
}
