/*
 * engine/GameLoop.ts
 */
import { Emitter } from "../core/events.js";
import { Engine } from "./Engine.js";
import { Agent } from "./Agent.js"; // This import is necessary for activeAgent's type
import { Chronicle } from "../core/Chronicle.js";
import { IGameLoopState } from "../core/types.js";
import { IEngineAgent } from "./types.js";

export class GameLoop extends Emitter {
  engine: Engine;
  session: Chronicle;
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
          activeAgentIndex: -1,
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
  get activeAgentIndex(): number { return this.session.state.gameLoop?.activeAgentIndex ?? -1; }
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
    }

    // 3. Detect Turn/Agent Change
    if (current.turn !== this._lastState.turn || 
        current.activeAgentIndex !== this._lastState.activeAgentIndex) {
       
       const agent = this.activeAgent; // This line needs the getter defined below
       this.emit("turn:changed", { 
        payload: { 
          turn: current.turn, 
          agent: agent?.name ?? "unknown" 
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
        doc.gameLoop.activeAgentIndex = 0; 
      }
    });
    // FIX 1: Explicitly emit start events now
    this._syncState();
  }

  stop(reason = "manual") {
    this.session.change("stop loop", (doc) => {
      if (doc.gameLoop) {
        doc.gameLoop.running = false;
        doc.gameLoop.phase = "stopped";
      }
    });
    // FIX 2: Explicitly emit stop events now
    this._syncState();
  }

  nextTurn() {
    this.session.change("next turn", (doc) => {
      if (!doc.gameLoop || !this.engine._agents.length) return;
      doc.gameLoop.turn++;
      doc.gameLoop.activeAgentIndex = (doc.gameLoop.activeAgentIndex + 1) % this.engine._agents.length;
    });
    // FIX 3: Explicitly emit turn change events now
    this._syncState();
  }

  // FIX 4: This entire getter must be present for compilation to pass
  get activeAgent(): IEngineAgent | null {
    const idx = this.activeAgentIndex;
    // Check Agent import is resolved here, otherwise the Agent type won't work
    if (idx >= 0 && idx < this.engine._agents.length) {
      return this.engine._agents[idx];
    }
    return null;
  }
}