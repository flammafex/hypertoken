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

/**
 * RelayServer for Network Tic-Tac-Toe
 *
 * Self-contained relay server that doesn't depend on root HyperToken dependencies.
 * This is a simplified version specifically for the network-tictactoe example.
 *
 * For the full HyperToken RelayServer, see network/RelayServer.ts
 */

import { WebSocketServer } from 'ws';
import { Emitter } from '../../core/events.js';

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
    this.wss = new WebSocketServer({ port: this.port });
    
    if (this.verbose) {
      console.log(`🌐 RelayServer running on ws://localhost:${this.port}`);
    }

    this.wss.on('connection', (ws) => {
      this.clients.add(ws);
      
      if (this.verbose) {
        console.log(`👥 Client connected (${this.clients.size})`);
      }

      ws.on('message', (msg) => this._handle(ws, msg));
      
      ws.on('close', () => {
        this.clients.delete(ws);
        if (this.verbose) {
          console.log('❌ Client disconnected');
        }
      });
    });

    // Re-broadcast new state whenever the engine changes
    if (this.broadcastOnAction && this.engine?.on) {
      this.engine.on('engine:action', () => this.broadcastDescribe());
    }

    this.emit('server:start', { payload: { port: this.port } });
  }

  stop() {
    if (this.verbose) {
      console.log('Closing all client connections...');
    }
    
    // Close all client connections
    for (const client of this.clients) {
      try {
        client.close();
      } catch (err) {
        // Ignore errors when closing
      }
    }
    this.clients.clear();
    
    // Close the WebSocket server
    if (this.wss) {
      this.wss.close(() => {
        if (this.verbose) {
          console.log('WebSocket server closed.');
        }
      });
    }
    
    this.emit('server:stop');
  }

  /*───────────────────────────────────────────────
    Command handling
  ───────────────────────────────────────────────*/
  _handle(ws, msg) {
    try {
      const data = JSON.parse(msg.toString());
      const { cmd, type, payload } = data;

      if (cmd === 'describe') {
        try {
          const state = this.engine.describe ? this.engine.describe() : { _gameState: this.engine._gameState };
          ws.send(JSON.stringify({ cmd: 'describe', state }));
        } catch (err) {
          ws.send(JSON.stringify({ 
            cmd: 'error', 
            message: `Failed to describe state: ${err.message}` 
          }));
          if (this.verbose) {
            console.error('Error describing state:', err);
          }
        }
        return;
      }

      if (cmd === 'dispatch') {
        this.engine.dispatch(type, payload);
        if (this.broadcastOnAction) {
          this.broadcastDescribe();
        }
        return;
      }

      ws.send(JSON.stringify({ 
        cmd: 'error', 
        message: `Unknown command: ${cmd}` 
      }));
    } catch (err) {
      ws.send(JSON.stringify({ 
        cmd: 'error', 
        message: err.message 
      }));
      
      if (this.verbose) {
        console.error('RelayServer error:', err);
      }
    }
  }

  broadcastDescribe() {
    try {
      const state = this.engine.describe ? this.engine.describe() : { _gameState: this.engine._gameState };
      const msg = JSON.stringify({ cmd: 'describe', state });
      
      for (const client of this.clients) {
        // WebSocket.OPEN = 1
        if (client.readyState === 1) {
          client.send(msg);
        }
      }
    } catch (err) {
      if (this.verbose) {
        console.error('Error broadcasting state:', err);
      }
    }
  }
}