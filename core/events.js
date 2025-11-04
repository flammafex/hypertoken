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
// ./core/events.js
export class Emitter {
  constructor() { this._events = {}; }
  
  on(type, fn) {
    if (!this._events[type]) this._events[type] = new Set();
    this._events[type].add(fn);
    return this;
  }
  
  off(type, fn) {
    if (this._events[type]) this._events[type].delete(fn);
    return this;
  }
  
  once(type, fn) {
    const wrapper = (...args) => { fn(...args); this.off(type, wrapper); };
    return this.on(type, wrapper);
  }
  
  emit(type, payload = {}) {
  // Always create a structured event object
  const evt = (payload && payload.type && payload.payload !== undefined)
    ? payload  // already an event object
    : {
        id: crypto.randomUUID?.() || String(Date.now() + Math.random()),
        type,
        payload,
        ts: Date.now()
      };

  // Dispatch to type-specific listeners
  if (this._events[type]) {
    for (const fn of this._events[type]) fn(evt);
  }
  // Dispatch to wildcard listeners
  if (this._events["*"]) {
    for (const fn of this._events["*"]) fn(evt);
  }
  return true;
  }
}

export class EventRegistry extends Emitter {
  constructor(name = "session") {
    super();                   // call Emitter constructor
    this.name = name;
    this.events = [];
    this._sources = new Set();
  }
  attach(source, label = null) {
    if (!source?.on) throw new Error("Source must be an Emitter.");
    if (this._sources.has(source)) return this;
    this._sources.add(source);

    const tag = label || source.constructor.name;
    source.on("*", payload => this.record("*", tag, payload));

    const emit = source.emit.bind(source);
    source.emit = (type, payload) => {
      const result = emit(type, payload);
      this.record(type, tag, payload);
      return result;
    };
    return this;
  }
record(type, source, payload) {
  const evt = {
    id: crypto.randomUUID?.() || String(Date.now() + Math.random()),
    type,
    source,
    payload,
    ts: Date.now()
  };
  this.events.push(evt);
  this.emit(type, evt);   // no wildcard broadcast here
}

  last(n = null) { return n ? this.events.slice(-n) : this.events.slice(); }
  filter(type) { return this.events.filter(e => e.type === type); }
  toJSON() { return JSON.stringify({ name: this.name, count: this.events.length, events: this.events }, null, 2); }
  // events.js
saveLocal(key="eventlog") {
  if (!this.storage?.setItem) return;
  this.storage.setItem(key, this.toJSON());
}
static loadLocal(key="eventlog", { storage } = {}) {
  if (!storage?.getItem) return null;
  const raw = storage.getItem(key);
  if (!raw) return null;
  const data = JSON.parse(raw);
  const reg = new EventRegistry(data.name, { storage });
  reg.events = data.events;
  return reg;
}

  clear() { this.events = []; }
}

