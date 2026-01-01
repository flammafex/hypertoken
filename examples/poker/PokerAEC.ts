/**
 * PokerAEC - PettingZoo AEC Environment for Texas Hold'em
 *
 * Implements the AEC (Agent Environment Cycle) interface for turn-based
 * heads-up no-limit Texas Hold'em poker.
 *
 * Actions (6 discrete):
 *   0: Fold       - Give up the hand
 *   1: Check      - Pass (when no bet to call)
 *   2: Call       - Match the current bet
 *   3: Raise Half - Raise by half the pot
 *   4: Raise Pot  - Raise by the full pot
 *   5: All-In     - Bet all remaining chips
 *
 * Observation Space:
 *   Basic mode (20 values): Card encodings + betting context
 *   Rich mode (75 values): Hand strength, draws, board texture, betting context
 */

import { AECEnvironment } from "../../interface/PettingZoo.js";
import { Observation, ActionID, Space } from "../../interface/Gym.js";
import { PokerGame, PokerConfig, PokerGameState } from "./PokerGame.js";
import { extractFeatures, getFeatureNames } from "./HandFeatures.js";
import { RewardShaper, RewardShapingConfig, RewardContext, ShapedReward } from "./RewardShaping.js";

// Action constants
export const ACTION_FOLD = 0;
export const ACTION_CHECK = 1;
export const ACTION_CALL = 2;
export const ACTION_RAISE_HALF = 3;
export const ACTION_RAISE_POT = 4;
export const ACTION_ALL_IN = 5;

export interface PokerAECConfig {
  /** Small blind amount (default: 1) */
  smallBlind?: number;
  /** Big blind amount (default: 2) */
  bigBlind?: number;
  /** Starting chip stack (default: 100) */
  startingChips?: number;
  /** Player names (default: ["player_0", "player_1"]) */
  playerNames?: string[];
  /** Random seed for reproducibility */
  seed?: number | null;
  /** Use rich observations with hand features (default: false) */
  richObservations?: boolean;
  /** Use extended action space with 10 bet sizes (default: false = 6 actions) */
  extendedActions?: boolean;
  /** Reward shaping configuration (default: disabled) */
  rewardShaping?: RewardShapingConfig | boolean;
}

/**
 * PettingZoo AEC Environment for Texas Hold'em Poker
 */
export class PokerAEC extends AECEnvironment {
  private game: PokerGame;
  private config: Required<Omit<PokerAECConfig, 'rewardShaping'>> & { rewardShaping: RewardShapingConfig | null };
  private _lastChips: Record<string, number> = {};
  private _seed: number | null;
  private _richObsSize: number;
  private _rewardShaper: RewardShaper | null = null;
  private _prevState: PokerGameState | null = null;
  private _lastActions: Record<string, number> = {};
  private _shapedRewards: Record<string, ShapedReward> = {};

  constructor(config: PokerAECConfig = {}) {
    super();

    // Parse reward shaping config
    let rewardShapingConfig: RewardShapingConfig | null = null;
    if (config.rewardShaping === true) {
      rewardShapingConfig = {}; // Use defaults
    } else if (config.rewardShaping && typeof config.rewardShaping === 'object') {
      rewardShapingConfig = config.rewardShaping;
    }

    this.config = {
      smallBlind: config.smallBlind ?? 1,
      bigBlind: config.bigBlind ?? 2,
      startingChips: config.startingChips ?? 100,
      playerNames: config.playerNames ?? ["player_0", "player_1"],
      seed: config.seed ?? null,
      richObservations: config.richObservations ?? false,
      extendedActions: config.extendedActions ?? false,
      rewardShaping: rewardShapingConfig,
    };

    // Initialize reward shaper if configured
    if (this.config.rewardShaping) {
      this._rewardShaper = new RewardShaper(this.config.rewardShaping);
    }

    // Calculate rich observation size
    this._richObsSize = getFeatureNames().length;

    this._seed = this.config.seed;

    // Initialize game
    this.game = new PokerGame({
      smallBlind: this.config.smallBlind,
      bigBlind: this.config.bigBlind,
      startingChips: this.config.startingChips,
      playerNames: this.config.playerNames,
      extendedActions: this.config.extendedActions,
    });

    // Initialize AEC state
    this._possibleAgents = [...this.config.playerNames];
    this._agents = [...this._possibleAgents];
    this._currentAgent = this._possibleAgents[0];

    for (const agent of this._possibleAgents) {
      this._rewards[agent] = 0;
      this._terminations[agent] = false;
      this._truncations[agent] = false;
      this._infos[agent] = {};
      this._lastChips[agent] = this.config.startingChips;
    }
  }

  // === Spaces ===

  observationSpace(_agent: string): Space {
    const size = this.config.richObservations ? this._richObsSize : 20;
    return {
      shape: [size],
      low: new Array(size).fill(0),
      high: new Array(size).fill(1),
    };
  }

  actionSpace(_agent: string): Space {
    const n = this.config.extendedActions ? 10 : 6;
    return { n, shape: [] };
  }

  /**
   * Get action names for the current action space
   */
  getActionNames(): string[] {
    return this.game.getActionNames();
  }

  /**
   * Returns action mask for valid actions.
   * [Fold, Check, Call, RaiseHalf, RaisePot, AllIn]
   */
  override actionMask(_agent: string): boolean[] {
    return this.game.getValidActions();
  }

  // === Core Loop ===

  async reset(seed?: number): Promise<void> {
    // Use provided seed or stored seed
    const actualSeed = seed ?? this._seed ?? undefined;
    this._seed = actualSeed ?? null;

    // Reset the game
    this.game.reset(actualSeed);

    // Reset AEC state
    this._agents = [...this._possibleAgents];

    for (const agent of this._possibleAgents) {
      this._rewards[agent] = 0;
      this._terminations[agent] = false;
      this._truncations[agent] = false;
      this._infos[agent] = {};

      const player = this.game.getPlayer(agent);
      this._lastChips[agent] = player?.chips ?? this.config.startingChips;
      this._lastActions[agent] = -1;
      this._shapedRewards[agent] = {
        baseReward: 0,
        shapedReward: 0,
        components: { foldSavings: 0, potEquity: 0, actionQuality: 0, aggressionBonus: 0 },
      };
    }

    // Reset reward shaper
    if (this._rewardShaper) {
      this._rewardShaper.reset();
    }

    // Store initial state for reward shaping
    this._prevState = this.game.getState();

    // Set current agent from game state
    const gameState = this.game.getState();
    this._currentAgent = gameState.players[gameState.currentPlayerIndex].name;
  }

  observe(agent: string): Observation {
    if (this.config.richObservations) {
      const gameState = this.game.getState();
      const { features } = extractFeatures(gameState, agent);
      return features;
    }
    return this.game.getObservation(agent);
  }

  /**
   * Get feature names for the rich observation space
   */
  getFeatureNames(): string[] {
    if (this.config.richObservations) {
      return getFeatureNames();
    }
    return [
      "hole_card1_rank", "hole_card1_suit", "hole_card2_rank", "hole_card2_suit",
      "comm1_rank", "comm1_suit", "comm2_rank", "comm2_suit", "comm3_rank", "comm3_suit",
      "comm4_rank", "comm4_suit", "comm5_rank", "comm5_suit",
      "pot_size", "my_chips", "opp_chips", "to_call", "phase", "position"
    ];
  }

  async step(action: ActionID): Promise<void> {
    const currentAgent = this._currentAgent;
    const actionNum = action as number;

    // Track action for reward shaping
    this._lastActions[currentAgent] = actionNum;

    // Store state before action for reward shaping
    const prevState = this._prevState;

    // Execute the action
    this.game.action(actionNum);

    // Get updated state
    const gameState = this.game.getState();

    // Check if hand is complete
    if (gameState.phase === "complete") {
      // Calculate rewards based on chip changes
      for (const agent of this._possibleAgents) {
        const player = this.game.getPlayer(agent);
        if (player) {
          const chipChange = player.chips - this._lastChips[agent];
          let finalReward = chipChange;

          // Apply reward shaping if enabled
          if (this._rewardShaper && prevState) {
            const context: RewardContext = {
              prevState,
              currState: gameState,
              action: this._lastActions[agent],
              playerName: agent,
              folded: player.folded,
            };

            const shaped = this._rewardShaper.computeReward(context, chipChange);
            finalReward = shaped.shapedReward;
            this._shapedRewards[agent] = shaped;
          }

          this._rewards[agent] = finalReward;
          this._lastChips[agent] = player.chips;

          // Set termination
          this._terminations[agent] = true;

          // Add info
          this._infos[agent] = {
            chips: player.chips,
            winner: gameState.winner === agent,
            winningHand: gameState.winningHand,
            folded: player.folded,
            shapedReward: this._shapedRewards[agent],
          };
        }
      }
    } else {
      // Update current agent
      this._currentAgent = gameState.players[gameState.currentPlayerIndex].name;

      // Apply intermediate reward shaping
      if (this._rewardShaper && prevState) {
        const player = this.game.getPlayer(currentAgent);
        const context: RewardContext = {
          prevState,
          currState: gameState,
          action: actionNum,
          playerName: currentAgent,
          folded: player?.folded ?? false,
        };

        const shaped = this._rewardShaper.computeReward(context, 0);
        this._rewards[currentAgent] = shaped.shapedReward;
        this._shapedRewards[currentAgent] = shaped;

        // Other agent gets no intermediate reward
        for (const agent of this._possibleAgents) {
          if (agent !== currentAgent) {
            this._rewards[agent] = 0;
          }
        }
      } else {
        // No reward during hand
        for (const agent of this._possibleAgents) {
          this._rewards[agent] = 0;
        }
      }
    }

    // Update previous state for next step
    this._prevState = gameState;
  }

  // === Rendering ===

  render(): void {
    this.game.render();
  }

  close(): void {
    // No cleanup needed
  }

  // === Additional Helpers ===

  /**
   * Get the current pot size
   */
  getPotSize(): number {
    return this.game.getState().pot;
  }

  /**
   * Get current phase
   */
  getPhase(): string {
    return this.game.getState().phase;
  }

  /**
   * Get chip count for an agent
   */
  getChips(agent: string): number {
    return this.game.getPlayer(agent)?.chips ?? 0;
  }

  /**
   * Get detailed shaped reward breakdown for an agent
   */
  getShapedReward(agent: string): ShapedReward | null {
    return this._shapedRewards[agent] ?? null;
  }

  /**
   * Check if reward shaping is enabled
   */
  hasRewardShaping(): boolean {
    return this._rewardShaper !== null;
  }
}

// Default export for convenience
export default PokerAEC;
