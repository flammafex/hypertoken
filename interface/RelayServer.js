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
// ./interface/RelayServer.js
// Authoritative multiplayer host for deterministic simulations.
// Manages WebSocket clients, validates incoming actions, and syncs state.

import { Emitter } from "../core/events.js";

/**
 * RelayServer
 * - Runs a single authoritative Engine instance.
 * - Clients connect via WebSocket and send simple JSON messages:
 *   { cmd: "describe" }       → sends back engine.describe()
 *   { cmd: "dispatch", type, payload } → applies action + broadcasts new state
 */
export class RelayServer extends Emitter {
  /**
   * @param {Engine} engine - The authoritative engine instance.
   * @param {object} [opts]
   * @param {number} [opts.port=8080] - Listening port.
   * @param {boolean} [opts.verbose=true]
   * @param {boolean} [opts.broadcastOnAction=true] - Send updates to all on each action.
   */
  constructor(engine, { port = 8080, verbose = true, broadcastOnAction = true } = {}) {
    super();
    this.engine = engine;
    this.port = port;
    this.verbose = verbose;
    this.broadcastOnAction = broadcastOnAction;
    this.clients = new Set();
    this.wss = null;
  }

  async start() {
    const { WebSocketServer } = await import("ws");

    this.wss = new WebSocketServer({ port: this.port });
    if (this.verbose)
      console.log(`🌐 RelayServer running on ws://localhost:${this.port}`);

    this.wss.on("connection", ws => {
      this.clients.add(ws);
      if (this.verbose) console.log(`👥 Client connected (${this.clients.size})`);

      ws.on("message", msg => this._handle(ws, msg));
      ws.on("close", () => {
        this.clients.delete(ws);
        if (this.verbose) console.log("❌ Client disconnected");
      });
    });

    // Re-broadcast new state whenever the engine changes
    if (this.broadcastOnAction && this.engine?.on)
      this.engine.on("engine:action", () => this.broadcastDescribe());

    this.emit("server:start", { payload: { port: this.port } });
  }

  stop() {
    if (this.wss) this.wss.close();
    this.clients.clear();
    this.emit("server:stop");
  }

  /*───────────────────────────────────────────────
    Command handling
  ───────────────────────────────────────────────*/
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
        if (this.broadcastOnAction) this.broadcastDescribe();
        return;
      }

      ws.send(JSON.stringify({ cmd: "error", message: `Unknown command: ${cmd}` }));
    } catch (err) {
      ws.send(JSON.stringify({ cmd: "error", message: err.message }));
      if (this.verbose) console.error("RelayServer error:", err);
    }
  }

  broadcastDescribe() {
    const state = this.engine.describe();
    const msg = JSON.stringify({ cmd: "describe", state });
    for (const c of this.clients) {
      if (c.readyState === 1) c.send(msg);
    }
  }
}
