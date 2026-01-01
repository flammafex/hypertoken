/**
 * Coup PettingZoo AEC Environment
 *
 * Turn-based bluffing game where players claim roles and can be challenged.
 * The game has multiple phases per turn (action → challenge → block → etc.)
 */

import { AECEnvironment } from "../../interface/PettingZoo.js";
import { Observation, ActionID, Space } from "../../interface/Gym.js";
import { CoupGame, CoupConfig, ROLES, ACTIONS, Role, getActionSpaceSize } from "./CoupGame.js";

export interface CoupAECConfig {
  numPlayers?: number;
  seed?: number | null;
}

// Action encoding
const ACTION_MAP: string[] = [
  // Basic actions (0-3)
  "income", "foreign_aid", "tax", "exchange",
  // Targeted actions - will append :target (4-12 for 3 players)
  "coup:0", "coup:1", "coup:2", "coup:3", "coup:4", "coup:5",
  "assassinate:0", "assassinate:1", "assassinate:2", "assassinate:3", "assassinate:4", "assassinate:5",
  "steal:0", "steal:1", "steal:2", "steal:3", "steal:4", "steal:5",
  // Challenge/pass (for all challenge phases)
  "challenge", "pass",
  // Block actions
  "block:duke", "block:contessa", "block:captain", "block:ambassador",
  // Lose influence
  "lose:0", "lose:1",
  // Exchange keep choices (simplified)
  "keep:0,1", "keep:0,2", "keep:0,3", "keep:1,2", "keep:1,3", "keep:2,3",
  "keep:0", "keep:1", "keep:2", "keep:3",
];

export class CoupAEC extends AECEnvironment {
  private game: CoupGame;
  private config: Required<CoupAECConfig>;
  private _seed: number | null;
  private _actionMap: Map<string, number>;
  private _reverseMap: Map<number, string>;

  constructor(config: CoupAECConfig = {}) {
    super();

    this.config = {
      numPlayers: config.numPlayers ?? 2,
      seed: config.seed ?? null,
    };

    this._seed = this.config.seed;

    this.game = new CoupGame({
      numPlayers: this.config.numPlayers,
      seed: this.config.seed,
    });

    // Build action maps
    this._actionMap = new Map();
    this._reverseMap = new Map();
    ACTION_MAP.forEach((action, idx) => {
      this._actionMap.set(action, idx);
      this._reverseMap.set(idx, action);
    });

    // Initialize agents
    this._possibleAgents = [];
    for (let i = 0; i < this.config.numPlayers; i++) {
      this._possibleAgents.push(`player_${i}`);
    }
    this._agents = [...this._possibleAgents];
    this._currentAgent = this._possibleAgents[0];

    for (const agent of this._possibleAgents) {
      this._rewards[agent] = 0;
      this._terminations[agent] = false;
      this._truncations[agent] = false;
      this._infos[agent] = {};
    }
  }

  observationSpace(agent: string): Space {
    // Observation:
    // My cards (2 * 6 one-hot for roles, + 2 revealed flags) = 14
    // My coins (normalized) = 1
    // Other players: coins + card count + 2*revealed cards = (1 + 1 + 12) * (n-1)
    // Phase one-hot (6 phases) = 6
    // Current player one-hot = n
    // Pending action info ≈ 20
    const n = this.config.numPlayers;
    const size = 14 + 1 + 14 * (n - 1) + 6 + n + 20;

    return {
      shape: [size],
      low: new Array(size).fill(0),
      high: new Array(size).fill(1),
    };
  }

  actionSpace(agent: string): Space {
    return {
      shape: [1],
      n: ACTION_MAP.length,
    };
  }

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
    const state = this.game.getState();

    const features: number[] = [];

    // My cards (one-hot role + revealed)
    for (let i = 0; i < 2; i++) {
      const card = obs.myCards[i];
      if (card) {
        for (const role of ROLES) {
          features.push(card.role === role ? 1 : 0);
        }
        features.push(card.revealed ? 1 : 0);
      } else {
        features.push(...new Array(6).fill(0));
        features.push(0);
      }
    }

    // My coins (normalized 0-12)
    features.push(obs.myCoins / 12);

    // Other players
    for (const other of obs.otherPlayers) {
      features.push(other.coins / 12);
      features.push(other.cardCount / 2);
      // Revealed cards (up to 2)
      for (let i = 0; i < 2; i++) {
        const revealed = other.revealedCards[i];
        for (const role of ROLES) {
          features.push(revealed === role ? 1 : 0);
        }
      }
    }

    // Pad for missing players (up to 6)
    const missingPlayers = 5 - obs.otherPlayers.length;
    features.push(...new Array(missingPlayers * 14).fill(0));

    // Phase one-hot
    const phases = ["action", "challenge", "block", "block_challenge", "lose_influence", "exchange"];
    for (const phase of phases) {
      features.push(state.phase === phase ? 1 : 0);
    }

    // Current player one-hot
    for (let i = 0; i < this.config.numPlayers; i++) {
      features.push(state.currentPlayer === i ? 1 : 0);
    }
    // Pad to 6
    features.push(...new Array(6 - this.config.numPlayers).fill(0));

    // Pending action info (simplified)
    if (state.pendingAction) {
      for (const action of ACTIONS) {
        features.push(state.pendingAction.type === action ? 1 : 0);
      }
      features.push(state.pendingAction.player / 6);
      features.push((state.pendingAction.target ?? -1) / 6);
    } else {
      features.push(...new Array(9).fill(0));
    }

    // Pending block
    if (state.pendingBlock) {
      for (const role of ROLES) {
        features.push(state.pendingBlock.claimedRole === role ? 1 : 0);
      }
      features.push(state.pendingBlock.player / 6);
    } else {
      features.push(...new Array(6).fill(0));
    }

    return features;
  }

  actionMask(agent: string): boolean[] {
    const mask = new Array(ACTION_MAP.length).fill(false);
    const playerIndex = this.getPlayerIndex(agent);
    const valid = this.game.getValidActions(playerIndex);

    for (const action of valid) {
      const idx = this._actionMap.get(action);
      if (idx !== undefined) {
        mask[idx] = true;
      }
    }

    return mask;
  }

  async step(action: ActionID): Promise<void> {
    const state = this.game.getState();
    const playerIndex = this.findActingPlayer();

    if (playerIndex < 0) {
      return;
    }

    const actionStr = this._reverseMap.get(action as number);
    if (!actionStr) return;

    const result = this.game.action(playerIndex, actionStr);

    const newState = this.game.getState();

    // Determine rewards
    for (let i = 0; i < this.config.numPlayers; i++) {
      const agent = this._possibleAgents[i];

      if (newState.winner !== null) {
        // Game over - winner gets +1, losers get -1
        this._rewards[agent] = newState.winner === i ? 1 : -1;
        this._terminations[agent] = true;
      } else {
        this._rewards[agent] = 0;
        // Check if player was eliminated this turn
        if (!newState.players[i].alive && state.players[i].alive) {
          this._rewards[agent] = -0.5; // Partial penalty for elimination
        }
      }

      this._infos[agent] = {
        phase: newState.phase,
        coins: newState.players[i].coins,
        alive: newState.players[i].alive,
        lastAction: result.message,
      };
    }

    // Update current agent
    this._currentAgent = this._possibleAgents[this.findActingPlayer()];
  }

  private findActingPlayer(): number {
    const state = this.game.getState();

    if (state.winner !== null) return -1;

    // Find first player with valid actions
    for (let i = 0; i < this.config.numPlayers; i++) {
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

  getActionNames(): string[] {
    return ACTION_MAP;
  }
}

export default CoupAEC;
