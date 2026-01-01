/**
 * Liar's Dice PettingZoo AEC Environment
 *
 * Bluffing dice game where players make increasingly bold claims
 * about the total dice showing a face value across all players.
 *
 * Observation space (per player):
 * - Own dice (one-hot encoded)
 * - Own dice count
 * - Other players' dice counts
 * - Current bid (quantity, face)
 * - Last bidder
 * - Total dice in play
 *
 * Action space:
 * - 0: Call "Liar!"
 * - 1+: Bid (quantity, face) combinations
 */

import { AECEnvironment } from "../../interface/PettingZoo.js";
import { Observation, ActionID, Space } from "../../interface/Gym.js";
import {
  LiarsDiceGame,
  LiarsDiceConfig,
  getActionSpaceSize,
  encodeBid,
  decodeBid,
} from "./LiarsDiceGame.js";

// ============================================================================
// Configuration
// ============================================================================

export interface LiarsDiceAECConfig {
  /** Number of players (2-6, default: 2) */
  numPlayers?: number;
  /** Starting dice per player (default: 5) */
  startingDice?: number;
  /** Random seed */
  seed?: number | null;
}

// ============================================================================
// Constants
// ============================================================================

const MAX_DICE_PER_PLAYER = 5;
const MAX_PLAYERS = 6;
const MAX_TOTAL_DICE = MAX_DICE_PER_PLAYER * MAX_PLAYERS; // 30

// ============================================================================
// LiarsDiceAEC Class
// ============================================================================

export class LiarsDiceAEC extends AECEnvironment {
  private game: LiarsDiceGame;
  private config: Required<LiarsDiceAECConfig>;
  private _seed: number | null;
  private maxDice: number;

  constructor(config: LiarsDiceAECConfig = {}) {
    super();

    this.config = {
      numPlayers: config.numPlayers ?? 2,
      startingDice: config.startingDice ?? 5,
      seed: config.seed ?? null,
    };

    this._seed = this.config.seed;
    this.maxDice = this.config.numPlayers * this.config.startingDice;

    // Create game
    this.game = new LiarsDiceGame({
      numPlayers: this.config.numPlayers,
      startingDice: this.config.startingDice,
      seed: this.config.seed,
    });

    // Initialize AEC state
    this._possibleAgents = [];
    for (let i = 0; i < this.config.numPlayers; i++) {
      this._possibleAgents.push(`player_${i}`);
    }
    this._agents = [...this._possibleAgents];
    this._currentAgent = this._possibleAgents[0];

    // Initialize state dictionaries
    for (const agent of this._possibleAgents) {
      this._rewards[agent] = 0;
      this._terminations[agent] = false;
      this._truncations[agent] = false;
      this._infos[agent] = {};
    }
  }

  // === Spaces ===

  observationSpace(agent: string): Space {
    // Observation encoding:
    // My dice: maxDice * 6 (one-hot per die)
    // My dice count: 1 (normalized)
    // Other players' dice counts: (numPlayers - 1) normalized
    // Current bid quantity: 1 (normalized by maxDice)
    // Current bid face: 5 (one-hot for faces 2-6, 0 if no bid)
    // Last bidder: numPlayers (one-hot, 0 if no bid)
    // Am I current player: 1
    // Total dice in play: 1 (normalized)
    // Round number: 1 (normalized)

    const myDiceFeatures = this.config.startingDice * 6;
    const myCountFeature = 1;
    const otherCountsFeatures = this.config.numPlayers - 1;
    const bidQuantityFeature = 1;
    const bidFaceFeatures = 5;
    const lastBidderFeatures = this.config.numPlayers;
    const currentPlayerFeature = 1;
    const totalDiceFeature = 1;
    const roundFeature = 1;

    const totalSize =
      myDiceFeatures +
      myCountFeature +
      otherCountsFeatures +
      bidQuantityFeature +
      bidFaceFeatures +
      lastBidderFeatures +
      currentPlayerFeature +
      totalDiceFeature +
      roundFeature;

    return {
      shape: [totalSize],
      low: new Array(totalSize).fill(0),
      high: new Array(totalSize).fill(1),
    };
  }

  actionSpace(agent: string): Space {
    // Action space: liar (0) + all possible bids
    const n = getActionSpaceSize(this.maxDice);

    return {
      shape: [1],
      n,
    };
  }

  // === Core Loop ===

  async reset(seed?: number): Promise<void> {
    const actualSeed = seed ?? this._seed ?? undefined;
    this._seed = actualSeed ?? null;

    this.game.reset(actualSeed);

    this._agents = [...this._possibleAgents];
    this._currentAgent = this._possibleAgents[0];

    for (const agent of this._possibleAgents) {
      this._rewards[agent] = 0;
      this._terminations[agent] = false;
      this._truncations[agent] = false;
      this._infos[agent] = {};
    }
  }

  observe(agent: string): Observation {
    const playerIndex = this.getPlayerIndex(agent);
    const obs = this.game.getObservation(playerIndex);

    const features: number[] = [];

    // My dice (one-hot encoded)
    for (let i = 0; i < this.config.startingDice; i++) {
      const die = obs.myDice[i];
      for (let face = 1; face <= 6; face++) {
        features.push(die === face ? 1 : 0);
      }
    }

    // My dice count (normalized)
    features.push(obs.myDiceCount / this.config.startingDice);

    // Other players' dice counts (normalized)
    for (const other of obs.otherPlayers) {
      features.push(other.diceCount / this.config.startingDice);
    }

    // Current bid quantity (normalized)
    features.push(obs.currentBid ? obs.currentBid.quantity / this.maxDice : 0);

    // Current bid face (one-hot for faces 2-6)
    for (let face = 2; face <= 6; face++) {
      features.push(obs.currentBid?.face === face ? 1 : 0);
    }

    // Last bidder (one-hot)
    for (let i = 0; i < this.config.numPlayers; i++) {
      features.push(obs.lastBidder === i ? 1 : 0);
    }

    // Am I current player
    features.push(obs.currentPlayer === playerIndex ? 1 : 0);

    // Total dice in play (normalized)
    features.push(obs.totalDiceInPlay / this.maxDice);

    // Round number (normalized, cap at 20)
    features.push(Math.min(obs.roundNumber / 20, 1));

    return features;
  }

  actionMask(agent: string): boolean[] {
    const actionSize = getActionSpaceSize(this.maxDice);
    const mask = new Array(actionSize).fill(false);

    const playerIndex = this.getPlayerIndex(agent);
    const state = this.game.getState();

    // Only current player can act
    if (state.currentPlayer !== playerIndex || state.winner !== null) {
      return mask;
    }

    const validActions = this.game.getValidActions(playerIndex);

    for (const actionStr of validActions) {
      if (actionStr === "liar") {
        mask[0] = true;
      } else if (actionStr.startsWith("bid:")) {
        const [_, qtyStr, faceStr] = actionStr.split(":");
        const quantity = parseInt(qtyStr);
        const face = parseInt(faceStr);
        const encoded = encodeBid(quantity, face, this.maxDice);
        if (encoded >= 0 && encoded < actionSize) {
          mask[encoded] = true;
        }
      }
    }

    return mask;
  }

  async step(action: ActionID): Promise<void> {
    const state = this.game.getState();
    const currentPlayer = state.currentPlayer;

    // Decode action
    const decoded = decodeBid(action as number, this.maxDice);
    let actionStr: string;

    if (decoded.type === "liar") {
      actionStr = "liar";
    } else {
      actionStr = `bid:${decoded.quantity}:${decoded.face}`;
    }

    // Execute action
    const result = this.game.action(actionStr);

    // Get updated state
    const newState = this.game.getState();

    // Reset rewards
    for (const agent of this._possibleAgents) {
      this._rewards[agent] = 0;
    }

    // Assign rewards on game end
    if (newState.winner !== null) {
      for (let i = 0; i < this.config.numPlayers; i++) {
        const agent = this._possibleAgents[i];
        if (i === newState.winner) {
          this._rewards[agent] = 1;
        } else {
          this._rewards[agent] = -1;
        }
        this._terminations[agent] = true;
      }
    }

    // Update infos
    for (const agent of this._possibleAgents) {
      this._infos[agent] = {
        lastAction: newState.lastAction,
        roundNumber: newState.roundNumber,
        phase: newState.phase,
      };
    }

    // Update current agent
    if (newState.winner === null) {
      this._currentAgent = this._possibleAgents[newState.currentPlayer];
    }
  }

  // === Rendering ===

  render(): void {
    this.game.render();
  }

  close(): void {
    // No cleanup needed
  }

  // === Helpers ===

  private getPlayerIndex(agent: string): number {
    const index = this._possibleAgents.indexOf(agent);
    return index >= 0 ? index : 0;
  }

  /**
   * Get action names for display
   */
  getActionNames(): string[] {
    const names: string[] = ["Liar!"];

    for (let qty = 1; qty <= this.maxDice; qty++) {
      for (let face = 2; face <= 6; face++) {
        names.push(`Bid ${qty}x${face}s`);
      }
    }

    return names;
  }

  /**
   * Get current round number
   */
  getRoundNumber(): number {
    return this.game.getState().roundNumber;
  }

  /**
   * Get total dice remaining in play
   */
  getTotalDice(): number {
    const state = this.game.getState();
    return state.players.reduce((sum, p) => sum + p.diceCount, 0);
  }
}

export default LiarsDiceAEC;
