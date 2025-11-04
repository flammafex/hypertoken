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
 *
 * GameLoop
 * ---------
 * Coordinates deterministic progression of turns and player actions.
 * The loop serves as the temporal controller of the simulation, invoking
 * player decisions and engine transitions in strict sequence.
 *
 * It extends the core Emitter to broadcast lifecycle and per-turn events,
 * providing a unified source of temporal truth for visualization,
 * analysis, and orchestration of external systems.
 *
 * Execution proceeds in a simple cycle:
 *   1. Select the active player.
 *   2. Begin turn and notify subsystems.
 *   3. Invoke player decision logic (synchronous or asynchronous).
 *   4. End turn and advance to the next.
 *
 * The design favors predictability over concurrency; actions are evaluated
 * serially to guarantee deterministic outcomes across identical seeds.
 */

import { Emitter } from "../core/events.js";

export class GameLoop extends Emitter {
  /**
   * Initializes a loop instance around a shared engine and a fixed player roster.
   * Options define pacing and termination constraints. The loop can operate
   * indefinitely or for a bounded number of turns.
   */
  constructor(engine, players = [], { maxTurns = Infinity, autoStart = false, delay = 0 } = {}) {
    super();
    this.engine = engine;
    this.players = players;
    this.turn = 0;
    this.maxTurns = maxTurns;
    this.delay = delay;
    this.running = false;
    this.activePlayer = null;

    if (autoStart) this.start();
  }

  /*───────────────────────────────────────────────
    Lifecycle control
  ───────────────────────────────────────────────*/

  /**
   * Starts the main execution loop if not already running.
   * Resets turn counters and emits loop:start before entering the cycle.
   */
  start() {
    if (this.running) return;
    this.running = true;
    this.turn = 0;
    this.emit("loop:start", { payload: { players: this.players.length } });
    this._loop();
  }

  /**
   * Halts execution immediately and emits loop:stop.
   * The reason parameter is recorded for diagnostics.
   */
  stop(reason = "manual") {
    this.running = false;
    this.emit("loop:stop", { payload: { turn: this.turn, reason } });
  }

  /**
   * Resets loop state and player contexts without starting execution.
   * Players are individually reset to clear transient state.
   */
  reset() {
    this.turn = 0;
    this.activePlayer = null;
    for (const p of this.players) p.reset();
    this.emit("loop:reset");
  }

  /*───────────────────────────────────────────────
    Core turn and tick execution
  ───────────────────────────────────────────────*/

  /**
   * Internal asynchronous loop driving sequential turns.
   * Each iteration selects a player by round-robin index, performs
   * begin/think/end phases, and optionally delays for pacing.
   *
   * The loop terminates automatically when maxTurns is reached or
   * when running is manually disabled.
   */
  async _loop() {
    while (this.running && this.turn < this.maxTurns) {
      const player = this.players[this.turn % this.players.length];
      this.activePlayer = player;
      this.turn++;

      // Begin phase: initialize turn context and notify observers.
      player.beginTurn(this.engine);
      this.emit("loop:turn:start", { payload: { player: player.name, turn: this.turn } });

      // Decision phase: delegate to player’s agent or human controller.
      await player.think(this.engine);

      // End phase: finalize turn and broadcast completion.
      player.endTurn(this.engine);
      this.emit("loop:turn:end", { payload: { player: player.name, turn: this.turn } });

      // Optional inter-turn delay for visualization or throttled pacing.
      if (this.delay > 0) await new Promise(r => setTimeout(r, this.delay));
    }

    this.running = false;
    this.emit("loop:end", { payload: { totalTurns: this.turn } });
  }

  /*───────────────────────────────────────────────
    Player roster management
  ───────────────────────────────────────────────*/

  /**
   * Appends a player to the active roster.
   * Emits loop:player:add for downstream synchronization.
   */
  addPlayer(player) {
    this.players.push(player);
    this.emit("loop:player:add", { payload: { name: player.name } });
    return this;
  }

  /**
   * Removes a player by instance or name.
   * Emits loop:player:remove when successful.
   */
  removePlayer(nameOrPlayer) {
    const idx = this.players.findIndex(
      p => p === nameOrPlayer || p.name === nameOrPlayer
    );
    if (idx >= 0) {
      const [removed] = this.players.splice(idx, 1);
      this.emit("loop:player:remove", { payload: { name: removed.name } });
    }
    return this;
  }

  /**
   * Retrieves a player reference by name, or undefined if not found.
   */
  getPlayer(name) {
    return this.players.find(p => p.name === name);
  }

  /*───────────────────────────────────────────────
    State serialization
  ───────────────────────────────────────────────*/

  /**
   * Returns a structural snapshot of the loop state, including
   * turn index, running flag, and serialized player states.
   * Useful for persistence, debugging, and deterministic replay.
   */
  snapshot() {
    return {
      turn: this.turn,
      running: this.running,
      players: this.players.map(p => p.snapshot())
    };
  }

  /** JSON-compatible alias for snapshot(). */
  toJSON() { return this.snapshot(); }
}
