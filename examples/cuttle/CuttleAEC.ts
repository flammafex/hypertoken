/**
 * Cuttle PettingZoo AEC Environment
 *
 * Turn-based combat card game where players race to accumulate 21+ points
 * while disrupting their opponent with one-offs, permanents, and scuttling.
 */

import { AECEnvironment } from "../../interface/PettingZoo.js";
import { Observation, ActionID, Space } from "../../interface/Gym.js";
import {
  CuttleGame,
  CuttleConfig,
  SUITS,
  RANKS,
  Card,
  getMaxActionSpaceSize,
} from "./CuttleGame.js";

export interface CuttleAECConfig {
  seed?: number | null;
  handLimit?: number;
}

// ============================================================================
// Action Encoding
// ============================================================================

/**
 * Build a mapping of action strings to integer IDs
 * Actions are encoded as follows:
 * - 0: draw
 * - 1: pass
 * - 2-53: point:cardId (52 cards)
 * - 54+: oneoff, permanent, scuttle, counter, etc.
 *
 * We use a dynamic encoding where actions are mapped on-the-fly
 * since the full action space is too large to enumerate statically.
 */

const STATIC_ACTIONS = ["draw", "pass", "scrap_seven"];

function encodeCard(card: Card): number {
  const suitIndex = SUITS.indexOf(card.suit);
  const rankIndex = RANKS.indexOf(card.rank);
  return suitIndex * 13 + rankIndex;
}

// ============================================================================
// CuttleAEC Class
// ============================================================================

export class CuttleAEC extends AECEnvironment {
  private game: CuttleGame;
  private config: Required<CuttleAECConfig>;
  private _seed: number | null;

  // Dynamic action mapping (rebuilt each step based on valid actions)
  private _currentValidActions: string[] = [];
  private _actionToId: Map<string, number> = new Map();
  private _idToAction: Map<number, string> = new Map();

  constructor(config: CuttleAECConfig = {}) {
    super();

    this.config = {
      seed: config.seed ?? null,
      handLimit: config.handLimit ?? 8,
    };

    this._seed = this.config.seed;

    this.game = new CuttleGame({
      seed: this.config.seed,
      handLimit: this.config.handLimit,
    });

    // Initialize agents (2-player game)
    this._possibleAgents = ["player_0", "player_1"];
    this._agents = [...this._possibleAgents];
    this._currentAgent = this._possibleAgents[1]; // Non-dealer goes first

    for (const agent of this._possibleAgents) {
      this._rewards[agent] = 0;
      this._terminations[agent] = false;
      this._truncations[agent] = false;
      this._infos[agent] = {};
    }

    this.rebuildActionMapping();
  }

  observationSpace(agent: string): Space {
    // Observation features:
    // - My hand: 52 binary (which cards I have)
    // - My point cards: 52 binary
    // - My permanents: 52 binary
    // - Opponent hand size: 1 (normalized)
    // - Opponent point cards: 52 binary
    // - Opponent permanents: 52 binary
    // - Scrap pile: 52 binary
    // - Deck size: 1 (normalized)
    // - My points: 1 (normalized)
    // - My goal: 1 (normalized)
    // - Opponent points: 1 (normalized)
    // - Opponent goal: 1 (normalized)
    // - Current player: 2 (one-hot)
    // - Phase: 7 (one-hot)
    // - Has glasses (opponent's hand visible): 1
    // - Opponent's hand (if visible): 52 binary
    // Total: 52*7 + 8 + 2 + 7 + 1 = 382

    const size = 52 * 7 + 8 + 2 + 7 + 1;

    return {
      shape: [size],
      low: new Array(size).fill(0),
      high: new Array(size).fill(1),
    };
  }

  actionSpace(agent: string): Space {
    return {
      shape: [1],
      n: getMaxActionSpaceSize(),
    };
  }

  async reset(seed?: number): Promise<void> {
    const actualSeed = seed ?? this._seed ?? undefined;
    this._seed = actualSeed ?? null;

    this.game.reset(actualSeed);

    this._agents = [...this._possibleAgents];
    this._currentAgent = this._possibleAgents[1]; // Non-dealer goes first

    for (const agent of this._possibleAgents) {
      this._rewards[agent] = 0;
      this._terminations[agent] = false;
      this._truncations[agent] = false;
      this._infos[agent] = {};
    }

    this.rebuildActionMapping();
  }

  observe(agent: string): Observation {
    const playerIndex = this.getPlayerIndex(agent);
    const obs = this.game.getObservation(playerIndex);
    const state = this.game.getState();

    const features: number[] = [];

    // Helper to encode card set as 52-binary array
    const encodeCardSet = (cards: Card[]): number[] => {
      const arr = new Array(52).fill(0);
      for (const card of cards) {
        arr[encodeCard(card)] = 1;
      }
      return arr;
    };

    // My hand (52)
    features.push(...encodeCardSet(obs.myHand));

    // My point cards (52) - cards I control
    const myPointCards = obs.myPointCards
      .filter((pc) => pc.controller === playerIndex)
      .map((pc) => pc.card);
    features.push(...encodeCardSet(myPointCards));

    // My permanents (52)
    const myPerms = obs.myPermanents.map((p) => p.card);
    features.push(...encodeCardSet(myPerms));

    // Opponent hand size (normalized 0-8)
    features.push(obs.opponentHandSize / 8);

    // Opponent point cards (52) - cards they control
    const oppPointCards = obs.opponentPointCards
      .filter((pc) => pc.controller === 1 - playerIndex)
      .map((pc) => pc.card);
    features.push(...encodeCardSet(oppPointCards));

    // Opponent permanents (52)
    const oppPerms = obs.opponentPermanents.map((p) => p.card);
    features.push(...encodeCardSet(oppPerms));

    // Scrap pile (52)
    features.push(...encodeCardSet(obs.scrap));

    // Deck size (normalized 0-52)
    features.push(obs.deckSize / 52);

    // My points (normalized 0-21)
    features.push(obs.myPoints / 21);

    // My goal (normalized)
    features.push(obs.myGoal / 21);

    // Opponent points (normalized 0-21)
    features.push(obs.opponentPoints / 21);

    // Opponent goal (normalized)
    features.push(obs.opponentGoal / 21);

    // Current player (one-hot)
    for (let i = 0; i < 2; i++) {
      features.push(state.currentPlayer === i ? 1 : 0);
    }

    // Phase (one-hot) - 7 phases
    const phases = [
      "play",
      "counter",
      "resolve_three",
      "resolve_four",
      "resolve_seven",
      "resolve_nine",
      "complete",
    ];
    for (const phase of phases) {
      features.push(state.phase === phase ? 1 : 0);
    }

    // Has glasses (can see opponent's hand)
    const hasGlasses = obs.opponentHand !== null ? 1 : 0;
    features.push(hasGlasses);

    // Opponent's hand if visible (52)
    if (obs.opponentHand) {
      features.push(...encodeCardSet(obs.opponentHand));
    } else {
      features.push(...new Array(52).fill(0));
    }

    return features;
  }

  actionMask(agent: string): boolean[] {
    const mask = new Array(getMaxActionSpaceSize()).fill(false);
    const playerIndex = this.getPlayerIndex(agent);
    const valid = this.game.getValidActions(playerIndex);

    // Rebuild action mapping if needed
    if (
      valid.length !== this._currentValidActions.length ||
      !valid.every((v, i) => v === this._currentValidActions[i])
    ) {
      this.rebuildActionMapping();
    }

    for (const action of valid) {
      const idx = this._actionToId.get(action);
      if (idx !== undefined && idx < mask.length) {
        mask[idx] = true;
      }
    }

    return mask;
  }

  private rebuildActionMapping(): void {
    this._actionToId.clear();
    this._idToAction.clear();

    // Get all valid actions from both players
    const allActions = new Set<string>();
    for (let i = 0; i < 2; i++) {
      for (const action of this.game.getValidActions(i)) {
        allActions.add(action);
      }
    }

    this._currentValidActions = Array.from(allActions);

    // Assign IDs - static actions first, then dynamic
    let id = 0;

    // Static actions always have fixed IDs
    for (const action of STATIC_ACTIONS) {
      this._actionToId.set(action, id);
      this._idToAction.set(id, action);
      id++;
    }

    // Dynamic actions
    for (const action of this._currentValidActions) {
      if (!this._actionToId.has(action)) {
        this._actionToId.set(action, id);
        this._idToAction.set(id, action);
        id++;
      }
    }
  }

  async step(action: ActionID): Promise<void> {
    const state = this.game.getState();
    const playerIndex = this.findActingPlayer();

    if (playerIndex < 0) {
      return;
    }

    const actionStr = this._idToAction.get(action as number);
    if (!actionStr) return;

    const result = this.game.action(playerIndex, actionStr);

    const newState = this.game.getState();

    // Determine rewards
    for (let i = 0; i < 2; i++) {
      const agent = this._possibleAgents[i];

      if (newState.winner !== null) {
        // Game over - winner gets +1, loser gets -1
        this._rewards[agent] = newState.winner === i ? 1 : -1;
        this._terminations[agent] = true;
      } else if (newState.isDraw) {
        // Draw - both get 0
        this._rewards[agent] = 0;
        this._terminations[agent] = true;
      } else {
        // Intermediate rewards based on point differential
        const myPoints = this.game.getPoints(i);
        const oppPoints = this.game.getPoints(1 - i);
        const myGoal = this.game.getPointGoal(i);
        const oppGoal = this.game.getPointGoal(1 - i);

        // Small reward for progress toward goal
        this._rewards[agent] = (myPoints / myGoal - oppPoints / oppGoal) * 0.01;
      }

      this._infos[agent] = {
        phase: newState.phase,
        points: this.game.getPoints(i),
        goal: this.game.getPointGoal(i),
        lastAction: result.message,
      };
    }

    // Update current agent
    const nextPlayer = this.findActingPlayer();
    if (nextPlayer >= 0) {
      this._currentAgent = this._possibleAgents[nextPlayer];
    }

    // Rebuild action mapping for next step
    this.rebuildActionMapping();
  }

  private findActingPlayer(): number {
    const state = this.game.getState();

    if (state.winner !== null || state.isDraw) return -1;

    // Find first player with valid actions
    for (let i = 0; i < 2; i++) {
      const valid = this.game.getValidActions(i);
      if (valid.length > 0) {
        return i;
      }
    }

    return state.currentPlayer;
  }

  private getPlayerIndex(agent: string): number {
    return this._possibleAgents.indexOf(agent);
  }

  render(): void {
    this.game.render();
  }

  close(): void {}

  /**
   * Get human-readable action names for the current state
   */
  getActionNames(): Map<number, string> {
    return new Map(this._idToAction);
  }

  /**
   * Get the underlying game instance for direct access
   */
  getGame(): CuttleGame {
    return this.game;
  }
}

export default CuttleAEC;
