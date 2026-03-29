import { Action } from "./Action.js";
import type { IChronicle } from "../core/IChronicle.js";

export class HistoryManager {
  history: Action[] = [];
  future: Action[] = [];
  private _snapshots: string[] = [];

  /** Record a successful action dispatch: push action + pre-snapshot, clear redo stack. */
  recordAction(action: Action, snapshot: string): void {
    this.history.push(action);
    this._snapshots.push(snapshot);
    this.future = [];
  }

  clear(): void {
    this.history = [];
    this.future = [];
    this._snapshots = [];
  }

  /**
   * Attempt undo: restores session to previous snapshot and moves action to future stack.
   * Returns the undone action, or null if nothing to undo.
   */
  undo(session: IChronicle): Action | null {
    const last = this.history.pop();
    if (!last || !last.reversible) {
      if (last) this.history.push(last);
      return null;
    }
    const snapshot = this._snapshots.pop();
    if (snapshot) {
      session.loadFromBase64(snapshot);
    }
    this.future.push(last);
    return last;
  }

  /** Pop next action from redo stack (caller must save current snapshot and apply the action). */
  popRedo(): Action | null {
    return this.future.pop() ?? null;
  }

  /** Push a snapshot (used before re-applying a redo action). */
  pushSnapshot(snapshot: string): void {
    this._snapshots.push(snapshot);
  }

  /** Push an action to history (used after successfully re-applying a redo). */
  pushHistory(action: Action): void {
    this.history.push(action);
  }

  /** Replace history from a restored snapshot. */
  restoreHistory(actions: Action[]): void {
    this.history = [...actions];
    this.future = [];
    this._snapshots = [];
  }
}
