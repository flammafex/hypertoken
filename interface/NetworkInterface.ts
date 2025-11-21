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

/*
 * interface/NetworkInterface.ts
 */
// @ts-ignore
import { Emitter } from "../core/events.js";
import { Engine } from "../engine/Engine.js";

export class NetworkInterface extends Emitter {
  url: string;
  engine: Engine | null;
  socket: WebSocket | null;
  connected: boolean;

  constructor(url: string, engine: Engine | null = null) {
    super();
    this.url = url;
    this.engine = engine;
    this.socket = null;
    this.connected = false;
  }

  connect(): void {
    this.socket = new WebSocket(this.url);

    this.socket.addEventListener("open", () => {
      this.connected = true;
      this.emit("net:connected");
      if (this.engine) this.syncDescribe(); // pull initial state
    });

    this.socket.addEventListener("message", (ev) => this._handleMessage(ev));
    this.socket.addEventListener("close", () => {
      this.connected = false;
      this.emit("net:disconnected");
    });

    this.socket.addEventListener("error", (err) => {
      this.emit("net:error", { payload: { error: err } });
    });
  }

  disconnect(): void {
    if (this.socket && this.connected) this.socket.close();
  }

  describe(): void {
    this._send({ cmd: "describe" });
  }

  dispatch(type: string, payload: any = {}): void {
    this._send({ cmd: "dispatch", type, payload });
  }

  syncDescribe(): void {
    this.describe();
  }

  private _send(msg: any): void {
    if (!this.socket || this.socket.readyState !== WebSocket.OPEN) return;
    this.socket.send(JSON.stringify(msg));
  }

  private _handleMessage(ev: MessageEvent): void {
    try {
      const data = JSON.parse(ev.data);

      switch (data.cmd) {
        case "describe":
          this.emit("engine:state", { payload: data.state });
          // @ts-ignore - applySnapshot is dynamic/optional on Engine
          if (this.engine && this.engine.applySnapshot)
            // @ts-ignore
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
  engine: Engine;
  port: number;
  verbose: boolean;
  clients: Set<any>; // WebSocket objects
  wss: any;

  constructor(engine: Engine, { port = 8080, verbose = false } = {}) {
    super();
    this.engine = engine;
    this.port = port;
    this.verbose = verbose;
    this.clients = new Set();
  }

  start(): void {
    // Use dynamic import so this file works in both browser and Node
    // @ts-ignore
    import("ws").then(({ WebSocketServer }) => {
      const wss = new WebSocketServer({ port: this.port });
      if (this.verbose) console.log(`🌐 RelayServer running on ws://localhost:${this.port}`);

      wss.on("connection", (ws: any) => {
        this.clients.add(ws);
        if (this.verbose) console.log("Client connected");

        ws.on("message", (msg: any) => this._handle(ws, msg));
        ws.on("close", () => this.clients.delete(ws));
      });

      this.wss = wss;
    });
  }

  stop(): void {
    if (this.wss) this.wss.close();
    this.clients.clear();
  }

  private _broadcast(cmd: string, payload: any): void {
    const msg = JSON.stringify({ cmd, ...payload });
    for (const c of this.clients) c.send(msg);
  }

  private _handle(ws: any, msg: any): void {
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
    } catch (err: any) {
      ws.send(JSON.stringify({ cmd: "error", message: err.message }));
    }
  }
}