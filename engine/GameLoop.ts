/*
 * engine/GameLoop.ts
 */
import { Emitter } from "../core/events.js";
import { Engine } from "./Engine.js";
import { Player } from "./Player.js";
import { SessionManager } from "../core/SessionManager.js";
import { IGameLoopState } from "../core/types.js";

export class GameLoop extends Emitter {
  engine: Engine;
  session: SessionManager;
  delay: number;
  
  // Track previous state to detect changes
  private _lastState: Partial<IGameLoopState> = {};

  constructor(engine: Engine, { maxTurns = Infinity, delay = 0 } = {}) {
    super();
    this.engine = engine;
    this.session = engine.session;
    this.delay = delay;

    if (!this.session.state.gameLoop) {
      this.session.change("init game loop", (doc) => {
        doc.gameLoop = {
          turn: 0,
          running: false,
          activePlayerIndex: -1,
          phase: "setup",
          maxTurns: maxTurns
        };
      });
    }

    // NEW: Listen for state changes to trigger events
    this.engine.on("state:updated", () => this._syncState());
    
    // Initialize local tracker
    this._syncState();
  }

  // --- STATE GETTERS ---
  get turn(): number { return this.session.state.gameLoop?.turn ?? 0; }
  get running(): boolean { return this.session.state.gameLoop?.running ?? false; }
  get activePlayerIndex(): number { return this.session.state.gameLoop?.activePlayerIndex ?? -1; }
  get phase(): string { return this.session.state.gameLoop?.phase ?? "setup"; }
  
  get maxTurns(): number { return this.session.state.gameLoop?.maxTurns ?? Infinity; }
  set maxTurns(value: number) {
    this.session.change("set maxTurns", (doc) => {
      if (doc.gameLoop) doc.gameLoop.maxTurns = value;
    });
  }

  // --- REACTIVE SYNC ---
  private _syncState() {
    const current = this.session.state.gameLoop;
    if (!current) return;

    // 1. Detect Stop
    if (this._lastState.running && !current.running) {
      this.emit("loop:stop", { 
        payload: { reason: "state_change", phase: current.phase, turn: current.turn } 
      });
    }

    // 2. Detect Start
    if (!this._lastState.running && current.running) {
      this.emit("loop:start", { payload: { turn: current.turn } });
      // In auto-mode, we'd trigger _runCycle here. 
      // In manual-mode (blackjack), we just emit the event.
    }

    // 3. Detect Turn/Player Change
    if (current.turn !== this._lastState.turn || 
        current.activePlayerIndex !== this._lastState.activePlayerIndex) {
       
       const player = this.activePlayer;
       this.emit("turn:changed", { 
        payload: { 
          turn: current.turn, 
          player: player?.name ?? "unknown" 
        } 
      });
    }

    // Update cache
    this._lastState = { ...current };
  }

  // --- CONTROLS ---
  start() {
    if (this.running) return;
    this.session.change("start loop", (doc) => {
      if (doc.gameLoop) {
        doc.gameLoop.running = true;
        doc.gameLoop.turn = 0;
        doc.gameLoop.phase = "play";
        doc.gameLoop.activePlayerIndex = 0; 
      }
    });
    // _syncState will catch this and emit loop:start
  }

  stop(reason = "manual") {
    this.session.change("stop loop", (doc) => {
      if (doc.gameLoop) {
        doc.gameLoop.running = false;
        doc.gameLoop.phase = "stopped";
      }
    });
    // _syncState will catch this and emit loop:stop
  }

  nextTurn() {
    this.session.change("next turn", (doc) => {
      if (!doc.gameLoop || !this.engine._players.length) return;
      doc.gameLoop.turn++;
      doc.gameLoop.activePlayerIndex = (doc.gameLoop.activePlayerIndex + 1) % this.engine._players.length;
    });
  }

  get activePlayer(): Player | null {
    const idx = this.activePlayerIndex;
    if (idx >= 0 && idx < this.engine._players.length) {
      return this.engine._players[idx];
    }
    return null;
  }
}