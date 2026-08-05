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

import { PeerConnection, PeerConnectionOptions, ReconnectConfig } from "../network/PeerConnection.js";
import { HybridPeerManager } from "../network/HybridPeerManager.js";
import { ConsensusCore, INetworkConnection } from "../core/ConsensusCore.js";
import { MessageCodec, CodecConfig } from "../network/MessageCodec.js";
import type { IChronicle } from "../core/IChronicle.js";
import type { Engine } from "./Engine.js";

export interface NetworkManagerOptions {
  useWebRTC: boolean;
  codec?: MessageCodec | Partial<CodecConfig>;
  reconnect?: Partial<ReconnectConfig> | false;
  messageBufferSize?: number;
}

export class NetworkManager {
  private _network?: INetworkConnection;
  private _sync?: ConsensusCore;

  get network(): INetworkConnection | undefined { return this._network; }
  get sync(): ConsensusCore | undefined { return this._sync; }

  connect(url: string, session: IChronicle, engine: Engine, options: NetworkManagerOptions): void {
    if (this._network) return;

    const peerOptions: PeerConnectionOptions = {
      codec: options.codec,
      reconnect: options.reconnect,
      messageBufferSize: options.messageBufferSize,
    };

    if (options.useWebRTC) {
      if (engine.debug) console.log(`[Engine] Connecting to ${url} with WebRTC support...`);
      this._network = new HybridPeerManager({
        url,
        autoUpgrade: true,
        upgradeDelay: 1000,
        reconnect: options.reconnect,
        peerConnectionOptions: peerOptions,
      });
    } else {
      if (engine.debug) console.log(`[Engine] Connecting to ${url} (WebSocket only)...`);
      this._network = new PeerConnection(url, engine, peerOptions);
    }

    this._sync = new ConsensusCore(session, this._network);
    this._network.connect();

    // Forward network events
    this._network.on("net:ready", (e) => engine.emit("net:ready", e));
    this._network.on("net:peer:connected", (e) => engine.emit("net:peer:connected", e));
    this._network.on("net:peer:disconnected", (e) => engine.emit("net:peer:disconnected", e));
    this._network.on("net:disconnected", (e) => engine.emit("net:disconnected", e));
    this._network.on("net:error", (e) => engine.emit("net:error", e));
    this._network.on("net:reconnecting", (e) => {
      if (engine.debug) console.log(`[Engine] Reconnecting... (attempt ${e.payload?.attempt || 1})`);
      engine.emit("net:reconnecting", e);
    });
    this._network.on("net:reconnected", (e) => {
      if (engine.debug) console.log(`[Engine] Reconnected successfully`);
      engine.emit("net:reconnected", e);
    });

    if (options.useWebRTC) {
      this._network.on("rtc:upgraded", (e) => {
        if (engine.debug) console.log(`[Engine] WebRTC connection established with peer`);
        engine.emit("rtc:upgraded", e);
      });
      this._network.on("rtc:downgraded", (e) => {
        if (engine.debug) console.log(`[Engine] WebRTC connection lost, using WebSocket`);
        engine.emit("rtc:downgraded", e);
      });
      this._network.on("rtc:connection-failed", (e) => engine.emit("rtc:connection-failed", e));
      this._network.on("rtc:retrying", (e) => engine.emit("rtc:retrying", e));
    }
  }

  disconnect(): void {
    this._network?.disconnect();
    this._network = undefined;
    this._sync = undefined;
  }
}
