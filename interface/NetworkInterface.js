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
// ./interface/NetworkInterface.js
// Deterministic socket bridge for ad-hoc LAN or remote multiplayer.
//
// This module defines both the client-side interface (NetworkInterface)
// and an optional minimal host/relay (RelayServer).

import { Emitter } from "../core/events.js";

/*───────────────────────────────────────────────────────────────
  NetworkInterface (client)
───────────────────────────────────────────────────────────────*/
export class NetworkInterface extends Emitter {
  /**
   * @param {string} url - WebSocket or local relay URL (e.g. ws://localhost:8080)
   * @param {Engine|null} [engine=null] - Optional local engine mirror
   */
  constructor(url, engine = null) {
    super();
    this.url = url;
    this.engine = engine;
    this.socket = null;
    this.connected = false;
  }

  connect() {
    this.socket = new WebSocket(this.url);

    this.socket.addEventListener("open", () => {
      this.connected = true;
      this.emit("net:connected");
      if (this.engine) this.syncDescribe(); // pull initial state
    });

    this.socket.addEventListener("message", ev => this._handleMessage(ev));
    this.socket.addEventListener("close", () => {
      this.connected = false;
      this.emit("net:disconnected");
    });

    this.socket.addEventListener("error", err => {
      this.emit("net:error", { payload: { error: err } });
    });
  }

  disconnect() {
    if (this.socket && this.connected) this.socket.close();
  }

  /*───────────────────────────────────────────────
    Network protocol
  ───────────────────────────────────────────────*/
  describe() {
    this._send({ cmd: "describe" });
  }

  dispatch(type, payload = {}) {
    this._send({ cmd: "dispatch", type, payload });
  }

  syncDescribe() {
    this.describe();
  }

  _send(msg) {
    if (!this.socket || this.socket.readyState !== WebSocket.OPEN) return;
    this.socket.send(JSON.stringify(msg));
  }

  _handleMessage(ev) {
    try {
      const data = JSON.parse(ev.data);

      switch (data.cmd) {
        case "describe":
          this.emit("engine:state", { payload: data.state });
          if (this.engine && this.engine.applySnapshot)
            this.engine.applySnapshot(data.state);
          break;

        case "dispatch":
          this.emit("engine:action", { payload: data });
          break;

        case "error":
          this.emit("net:error", { payload: data });
          break;

        default:
          this.emit("net:message", { payload: data });
          break;
      }
    } catch (err) {
      this.emit("net:error", { payload: { error: err } });
    }
  }
}

/*───────────────────────────────────────────────────────────────
  RelayServer (host)
───────────────────────────────────────────────────────────────*/
export class RelayServer extends Emitter {
  /**
   * @param {Engine} engine - authoritative engine instance
   * @param {object} [opts]
   * @param {number} [opts.port=8080]
   * @param {boolean} [opts.verbose=false]
   */
  constructor(engine, { port = 8080, verbose = false } = {}) {
    super();
    this.engine = engine;
    this.port = port;
    this.verbose = verbose;
    this.clients = new Set();
  }

  start() {
    // Use dynamic import so this file works in both browser and Node
    import("ws").then(({ WebSocketServer }) => {
      const wss = new WebSocketServer({ port: this.port });
      if (this.verbose) console.log(`🌐 RelayServer running on ws://localhost:${this.port}`);

      wss.on("connection", ws => {
        this.clients.add(ws);
        if (this.verbose) console.log("Client connected");

        ws.on("message", msg => this._handle(ws, msg));
        ws.on("close", () => this.clients.delete(ws));
      });

      this.wss = wss;
    });
  }

  stop() {
    if (this.wss) this.wss.close();
    this.clients.clear();
  }

  _broadcast(cmd, payload) {
    const msg = JSON.stringify({ cmd, ...payload });
    for (const c of this.clients) c.send(msg);
  }

  _handle(ws, msg) {
    try {
      const data = JSON.parse(msg);
      const { cmd, type, payload } = data;

      if (cmd === "describe") {
        const state = this.engine.describe();
        ws.send(JSON.stringify({ cmd: "describe", state }));
        return;
      }

      if (cmd === "dispatch") {
        this.engine.dispatch(type, payload);
        // Re-broadcast state or action to all clients
        const state = this.engine.describe();
        this._broadcast("describe", { state });
        return;
      }

      ws.send(JSON.stringify({ cmd: "error", message: "Unknown command" }));
    } catch (err) {
      ws.send(JSON.stringify({ cmd: "error", message: err.message }));
    }
  }
}
