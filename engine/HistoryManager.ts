import { Action } from "./Action.js";
import type { IChronicle } from "../core/IChronicle.js";

/**
 * HistoryManager: Undo/redo via periodic checkpoints.
 *
 * Instead of storing a full document snapshot per action (O(n²) memory),
 * checkpoints are taken every _checkpointInterval actions. Undo restores
 * to the nearest checkpoint. This bounds memory to O(_maxCheckpoints × docSize)
 * and CPU per dispatch to O(1) except at checkpoint boundaries.
 *
 * Tradeoff: undo is coarse-grained (restores to nearest checkpoint, up to
 * _checkpointInterval actions back) rather than exact pre-action state.
 */
export class HistoryManager {
  history: Action[] = [];
  future: Action[] = [];
  private _checkpoints: { index: number; snapshot: string }[] = [];
  private _checkpointInterval = 50;
  private _maxCheckpoints = 5;

  /** Returns true when a checkpoint should be taken (every _checkpointInterval actions). */
  shouldCheckpoint(): boolean {
    return this.history.length > 0 && this.history.length % this._checkpointInterval === 0;
  }

  /**
   * Record a successful action dispatch.
   * Pass a snapshot when shouldCheckpoint() returns true; pass null otherwise.
   */
  recordAction(action: Action, snapshot: string | null): void {
    this.history.push(action);
    this.future = [];
    if (snapshot) {
      this._checkpoints.push({ index: this.history.length, snapshot });
      // Prune old checkpoints to bound memory
      if (this._checkpoints.length > this._maxCheckpoints) {
        this._checkpoints.shift();
      }
    }
  }

  clear(): void {
    this.history = [];
    this.future = [];
    this._checkpoints = [];
  }

  /**
   * Attempt undo: restores session to the nearest checkpoint at or before
   * the current position and moves the last action to the future stack.
   * Returns the undone action, or null if nothing to undo.
   *
   * Note: undo restores to the nearest checkpoint (up to _checkpointInterval
   * actions back), not to the exact pre-action state.
   */
  undo(session: IChronicle): Action | null {
    const last = this.history.pop();
    if (!last || !last.reversible) {
      if (last) this.history.push(last);
      return null;
    }

    // Find nearest checkpoint at or before current history length
    for (let i = this._checkpoints.length - 1; i >= 0; i--) {
      if (this._checkpoints[i].index <= this.history.length) {
        session.loadFromBase64(this._checkpoints[i].snapshot);
        break;
      }
    }

    this.future.push(last);
    return last;
  }

  /** Replace history from a restored snapshot. Clears all checkpoints. */
  restoreHistory(actions: Action[]): void {
    this.history = [...actions];
    this.future = [];
    this._checkpoints = [];
  }
}
