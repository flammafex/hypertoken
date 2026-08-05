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

import { Action } from "./Action.js";
import type { IChronicle } from "../core/IChronicle.js";

/**
 * HistoryManager: Undo via periodic checkpoints.
 *
 * Instead of storing a full document snapshot per action (O(n²) memory),
 * checkpoints are taken every _checkpointInterval actions. Undo restores
 * to the nearest checkpoint. This bounds memory to O(_maxCheckpoints × docSize)
 * and CPU per dispatch to O(1) except at checkpoint boundaries.
 *
 * Tradeoff: undo is coarse-grained (restores to nearest checkpoint, up to
 * _checkpointInterval actions back) rather than exact pre-action state.
 *
 * Coherence guarantees:
 *  - undo NEVER silently succeeds with no state change. If no checkpoint is
 *    available to restore from, it returns null (the caller must not report
 *    success).
 *  - after undo, the document state and the recorded history always agree:
 *    history is truncated to the number of actions the restored snapshot
 *    actually represents, and stale checkpoints are pruned.
 */
export class HistoryManager {
  history: Action[] = [];
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
    this._checkpoints = [];
  }

  /**
   * Attempt undo: restores the session to the nearest checkpoint at or before
   * the current position and truncates history to match the restored state.
   * Returns the undone action, or null if nothing can be undone.
   *
   * Note: undo is coarse-grained — it restores to the nearest checkpoint (up
   * to _checkpointInterval actions back), not to the exact pre-action state.
   * Because the checkpoint snapshot is captured BEFORE the action at
   * `checkpoint.index` was applied, restoring it yields the state after
   * `checkpoint.index - 1` actions, so history is truncated to that length.
   *
   * Returns null (never a silent no-op) when:
   *  - there is nothing to undo, or
   *  - the last action is not reversible, or
   *  - no checkpoint exists yet (the first checkpoint is taken at action 51),
   *    so the exact prior state cannot be restored.
   */
  undo(session: IChronicle): Action | null {
    if (this.history.length === 0) return null;

    const last = this.history[this.history.length - 1];
    if (!last.reversible) return null;

    // Find nearest checkpoint at or before the current position.
    let checkpoint: { index: number; snapshot: string } | null = null;
    for (let i = this._checkpoints.length - 1; i >= 0; i--) {
      if (this._checkpoints[i].index <= this.history.length) {
        checkpoint = this._checkpoints[i];
        break;
      }
    }
    if (!checkpoint) return null; // no checkpoint — cannot restore exactly

    session.loadFromBase64(checkpoint.snapshot);

    // Truncate history to match the restored state (checkpoint.index - 1
    // actions were applied when the snapshot was taken).
    this.history = this.history.slice(0, checkpoint.index - 1);
    // Prune checkpoints that now point beyond the truncated history.
    this._checkpoints = this._checkpoints.filter(c => c.index <= this.history.length);

    return last;
  }

  /** Replace history from a restored snapshot. Clears all checkpoints. */
  restoreHistory(actions: Action[]): void {
    this.history = [...actions];
    this._checkpoints = [];
  }
}
