/**
 * Hanabi PettingZoo AEC Environment
 *
 * Cooperative multi-agent environment where players work together
 * to build firework stacks. Players can see everyone's cards except their own.
 *
 * Observation space (per player):
 * - Own card knowledge (color/number hints received)
 * - Other players' visible cards
 * - Firework stacks state
 * - Info tokens, life tokens, deck size
 * - Discard pile encoding
 *
 * Action space:
 * - Play card (0 to handSize-1)
 * - Discard card (handSize to 2*handSize-1)
 * - Give hint (remaining indices)
 */

import { AECEnvironment } from "../../interface/PettingZoo.js";
import { Observation, ActionID, Space } from "../../interface/Gym.js";
import {
  HanabiGame,
  HanabiConfig,
  HanabiAction,
  COLORS,
  NUMBERS,
  Color,
  CardNumber,
  encodeAction,
  decodeAction,
  getActionSpaceSize,
} from "./HanabiGame.js";

// ============================================================================
// Configuration
// ============================================================================

export interface HanabiAECConfig {
  /** Number of players (2-5, default: 2) */
  numPlayers?: number;
  /** Random seed */
  seed?: number | null;
}

// ============================================================================
// Constants
// ============================================================================

const HAND_SIZES: Record<number, number> = {
  2: 5,
  3: 5,
  4: 4,
  5: 4,
};

// ============================================================================
// HanabiAEC Class
// ============================================================================

export class HanabiAEC extends AECEnvironment {
  private game: HanabiGame;
  private config: Required<HanabiAECConfig>;
  private _seed: number | null;
  private _lastScore: number = 0;

  constructor(config: HanabiAECConfig = {}) {
    super();

    this.config = {
      numPlayers: config.numPlayers ?? 2,
      seed: config.seed ?? null,
    };

    this._seed = this.config.seed;

    // Create game
    this.game = new HanabiGame({
      numPlayers: this.config.numPlayers,
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
    // For each card in my hand: 5 (color known) + 5 (number known) = 10
    // For each other player's card: 5 (color one-hot) + 5 (number one-hot) = 10
    // Fireworks: 5 colors * 6 values (0-5) one-hot = 30
    // Info tokens: 9 (one-hot 0-8)
    // Life tokens: 4 (one-hot 0-3)
    // Deck size: normalized float
    // Current player: numPlayers one-hot
    // Last action: encoded (simplified)

    const handSize = HAND_SIZES[this.config.numPlayers];
    const numOtherPlayers = this.config.numPlayers - 1;

    const myHandFeatures = handSize * 10; // color + number knowledge
    const otherHandFeatures = numOtherPlayers * handSize * 10;
    const fireworkFeatures = 5 * 6; // 5 colors, 6 possible values
    const tokenFeatures = 9 + 4; // info + life
    const deckFeature = 1; // normalized
    const playerFeatures = this.config.numPlayers;
    const discardFeatures = 5 * 5; // simplified: count per color/number

    const totalSize =
      myHandFeatures +
      otherHandFeatures +
      fireworkFeatures +
      tokenFeatures +
      deckFeature +
      playerFeatures +
      discardFeatures;

    return {
      shape: [totalSize],
      low: new Array(totalSize).fill(0),
      high: new Array(totalSize).fill(1),
    };
  }

  actionSpace(agent: string): Space {
    const handSize = HAND_SIZES[this.config.numPlayers];
    const n = getActionSpaceSize(this.config.numPlayers, handSize);

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
    this._lastScore = 0;

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
    const state = this.game.getState();
    const handSize = HAND_SIZES[this.config.numPlayers];

    const features: number[] = [];

    // My card knowledge (what I know about my own cards)
    for (let i = 0; i < handSize; i++) {
      const knowledge = obs.myKnowledge[i];
      if (knowledge) {
        // Color knowledge (one-hot or unknown)
        for (const color of COLORS) {
          if (knowledge.color === color) {
            features.push(1);
          } else if (knowledge.notColors.has(color)) {
            features.push(0);
          } else {
            features.push(0.2); // Unknown
          }
        }
        // Number knowledge
        for (const num of NUMBERS) {
          if (knowledge.number === num) {
            features.push(1);
          } else if (knowledge.notNumbers.has(num)) {
            features.push(0);
          } else {
            features.push(0.2);
          }
        }
      } else {
        // No card in this slot
        features.push(...new Array(10).fill(0));
      }
    }

    // Other players' cards (visible to me)
    for (const otherHand of obs.otherHands) {
      for (let i = 0; i < handSize; i++) {
        const card = otherHand.cards[i];
        if (card) {
          // Color one-hot
          for (const color of COLORS) {
            features.push(card.color === color ? 1 : 0);
          }
          // Number one-hot
          for (const num of NUMBERS) {
            features.push(card.number === num ? 1 : 0);
          }
        } else {
          features.push(...new Array(10).fill(0));
        }
      }
    }

    // Fireworks (one-hot per color)
    for (const color of COLORS) {
      const value = obs.fireworks[color];
      for (let v = 0; v <= 5; v++) {
        features.push(value === v ? 1 : 0);
      }
    }

    // Info tokens (one-hot)
    for (let i = 0; i <= 8; i++) {
      features.push(obs.infoTokens === i ? 1 : 0);
    }

    // Life tokens (one-hot)
    for (let i = 0; i <= 3; i++) {
      features.push(obs.lifeTokens === i ? 1 : 0);
    }

    // Deck size (normalized)
    features.push(obs.deckSize / 50);

    // Current player (one-hot)
    for (let i = 0; i < this.config.numPlayers; i++) {
      features.push(obs.currentPlayer === i ? 1 : 0);
    }

    // Discard pile (count per color/number)
    const discardCounts: number[][] = COLORS.map(() =>
      NUMBERS.map(() => 0)
    );
    for (const card of obs.discardPile) {
      const ci = COLORS.indexOf(card.color);
      const ni = NUMBERS.indexOf(card.number);
      discardCounts[ci][ni]++;
    }
    for (let ci = 0; ci < COLORS.length; ci++) {
      for (let ni = 0; ni < NUMBERS.length; ni++) {
        // Normalize by max count for that number
        const maxCount = ni === 0 ? 3 : ni === 4 ? 1 : 2;
        features.push(discardCounts[ci][ni] / maxCount);
      }
    }

    return features;
  }

  actionMask(agent: string): boolean[] {
    const handSize = HAND_SIZES[this.config.numPlayers];
    const actionSize = getActionSpaceSize(this.config.numPlayers, handSize);
    const mask = new Array(actionSize).fill(false);

    const playerIndex = this.getPlayerIndex(agent);
    const state = this.game.getState();

    // Only current player can act
    if (state.currentPlayer !== playerIndex || state.gameOver) {
      return mask;
    }

    const validActions = this.game.getValidActions();
    for (const action of validActions) {
      const encoded = encodeAction(
        action,
        this.config.numPlayers,
        handSize,
        state.currentPlayer
      );
      if (encoded >= 0 && encoded < actionSize) {
        mask[encoded] = true;
      }
    }

    return mask;
  }

  async step(action: ActionID): Promise<void> {
    const state = this.game.getState();
    const handSize = HAND_SIZES[this.config.numPlayers];

    // Decode action
    const decoded = decodeAction(
      action as number,
      this.config.numPlayers,
      handSize,
      state.currentPlayer
    );

    if (decoded) {
      this.game.action(decoded);
    }

    // Get updated state
    const newState = this.game.getState();

    // Cooperative reward: score change shared by all players
    const scoreChange = newState.score - this._lastScore;
    this._lastScore = newState.score;

    for (const agent of this._possibleAgents) {
      this._rewards[agent] = scoreChange;
      this._terminations[agent] = newState.gameOver;
      this._infos[agent] = {
        score: newState.score,
        infoTokens: newState.infoTokens,
        lifeTokens: newState.lifeTokens,
        lastAction: newState.lastAction,
        lastResult: newState.lastActionResult,
      };
    }

    // Update current agent
    if (!newState.gameOver) {
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
    const handSize = HAND_SIZES[this.config.numPlayers];
    const names: string[] = [];

    // Play actions
    for (let i = 0; i < handSize; i++) {
      names.push(`Play ${i + 1}`);
    }

    // Discard actions
    for (let i = 0; i < handSize; i++) {
      names.push(`Discard ${i + 1}`);
    }

    // Hint actions
    for (let p = 0; p < this.config.numPlayers - 1; p++) {
      for (const color of COLORS) {
        names.push(`Hint P${p} ${color}`);
      }
    }
    for (let p = 0; p < this.config.numPlayers - 1; p++) {
      for (const num of NUMBERS) {
        names.push(`Hint P${p} #${num}`);
      }
    }

    return names;
  }

  /**
   * Get current score
   */
  getScore(): number {
    return this.game.getState().score;
  }

  /**
   * Get info tokens remaining
   */
  getInfoTokens(): number {
    return this.game.getState().infoTokens;
  }

  /**
   * Get life tokens remaining
   */
  getLifeTokens(): number {
    return this.game.getState().lifeTokens;
  }
}

export default HanabiAEC;
