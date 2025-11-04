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
//./core/SessionManager.js
export class SessionManager {
  constructor({ deck, table, shoe = null, registry = null } = {}) {
    this.deck = deck;
    this.table = table;
    this.shoe = shoe;
    this.registry = registry;
  }

  /** Gather all serializable state into one object */
  snapshot() {
    const snap = {
      version: state.version ?? "1.0.0-core",
      t: new Date().toISOString(),
      deck: this.deck?.toJSON?.(),
      table: this.table?.snapshot?.(),
      shoe: this.shoe?.toJSON?.(),
      registry: this.registry?.events ?? [],
    };
    return snap;
  }

  /** Save JSON to localStorage */
  saveLocal(key = "session") {
    const json = JSON.stringify(this.snapshot(), null, 2);
    localStorage.setItem(key, json);
    return json;
  }

  /** Load session from localStorage */
  static loadLocal(key = "session") {
    const raw = localStorage.getItem(key);
    if (!raw) throw new Error("No saved session in localStorage.");
    return JSON.parse(raw);
  }

  /** Rebuild live objects from a loaded snapshot */
  static restore(data) {
    const deck = data.deck ? Deck.fromJSON(data.deck) : null;
    const table = data.table ? Table.fromSnapshot(data.table) : null;
    const shoe = data.shoe ? Shoe.fromJSON(data.shoe) : null;
    const registry = new EventRegistry("Restored");
    registry.events = data.registry || [];
    return new SessionManager({ deck, table, shoe, registry });
  }

  /** Download the snapshot as a JSON file */
toJSONString(pretty = 2) {
  return JSON.stringify(this.snapshot(), null, pretty);
}
toBlob() {
  if (typeof Blob === "undefined") {
    throw new Error("Blob API not available in this environment");
  }
  return new Blob([this.toJSONString()], { type: "application/json" });
}
download(filename = "session.json") {
  if (typeof document === "undefined" || typeof URL === "undefined") {
    throw new Error("download() requires a browser environment");
  }
  const a = document.createElement("a");
  a.href = URL.createObjectURL(this.toBlob());
  a.download = filename;
  a.click();
}
static fromJSONString(json) {
  return SessionManager.restore(JSON.parse(json));
}

  /** Load a snapshot from a File (e.g., input[type=file]) */
  static async fromFile(file) {
    const text = await file.text();
    const data = JSON.parse(text);
    return SessionManager.restore(data);
  }
}