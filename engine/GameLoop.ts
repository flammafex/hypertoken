/*
 * engine/GameLoop.ts
 */
import { Emitter } from "../core/events.js";
import { Engine } from "./Engine.js";
import { IGameLoopState } from "../core/types.js";
import { IEngineAgent } from "./types.js";

export class GameLoop extends Emitter {
  engine: Engine;
  delay: number;

  // Track previous state to detect changes (initialized to match default CRDT state
  // so the first _syncState() call does not fire spurious events)
  private _lastState: Partial<IGameLoopState> = {
    turn: 0,
    running: false,
    activeAgentIndex: -1,
    phase: "setup",
  };

  constructor(engine: Engine, { maxTurns = Infinity, delay = 0 } = {}) {
    super();
    this.engine = engine;
    this.delay = delay;

    if (!this.engine.session.state.gameLoop) {
      this.engine.dispatch("game:loopInit", { maxTurns });
    }

    // Listen for state changes to trigger events
    this.engine.on("state:updated", () => this._syncState());

    // Initialize local tracker
    this._syncState();
  }

  // --- STATE GETTERS (always read through engine.session, never a stored ref) ---
  get turn(): number { return this.engine.session.state.gameLoop?.turn ?? 0; }
  get running(): boolean { return this.engine.session.state.gameLoop?.running ?? false; }
  get activeAgentIndex(): number { return this.engine.session.state.gameLoop?.activeAgentIndex ?? -1; }
  get phase(): string { return this.engine.session.state.gameLoop?.phase ?? "setup"; }

  get maxTurns(): number { return this.engine.session.state.gameLoop?.maxTurns ?? Infinity; }
  set maxTurns(value: number) {
    this.engine.dispatch("game:setMaxTurns", { maxTurns: value });
  }

  // --- REACTIVE SYNC ---
  private _syncState() {
    const current = this.engine.session.state.gameLoop;
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

       const agent = this.activeAgent;
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
    this.engine.dispatch("game:loopStart", {});
    this._syncState();
  }

  stop(reason = "manual") {
    this.engine.dispatch("game:loopStop", { phase: "stopped" });
    this._syncState();
  }

  nextTurn() {
    const agentCount = this.engine._agents.length;
    if (!agentCount) return;

    this.engine.dispatch("game:nextTurn", { agentCount });
    this._syncState();
  }

  get activeAgent(): IEngineAgent | null {
    const idx = this.activeAgentIndex;
    if (idx >= 0 && idx < this.engine._agents.length) {
      return this.engine._agents[idx];
    }
    return null;
  }
}