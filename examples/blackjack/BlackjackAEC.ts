/*
 * examples/blackjack/BlackjackAEC.ts
 * PettingZoo AEC wrapper for Multi-agent Blackjack
 *
 * Implements the AEC (Agent Environment Cycle) interface for turn-based
 * multi-agent blackjack, where each agent acts sequentially.
 *
 * Actions:
 *   0: Hit - Take another card
 *   1: Stand - End turn with current hand
 *   2: Double Down - Double bet, take one card, then stand
 *   3: Split - Split pair into two hands (if valid)
 *   4: Insurance - Take insurance bet (if dealer shows Ace)
 */

import { AECEnvironment } from "../../interface/PettingZoo.js";
import { Observation, ActionID, Space } from "../../interface/Gym.js";
import { Engine } from "../../engine/Engine.js";
import { MultiagentBlackjackGame } from "./multiagent-game.js";
import {
  getBestHandValue,
  isSoftHand,
  isBusted,
  canDoubleDown,
  canSplit,
  canTakeInsurance,
} from "./blackjack-utils.js";

// Action constants
export const ACTION_HIT = 0;
export const ACTION_STAND = 1;
export const ACTION_DOUBLE = 2;
export const ACTION_SPLIT = 3;
export const ACTION_INSURANCE = 4;

export interface BlackjackAECConfig {
  numAgents?: number;
  numDecks?: number;
  initialBankroll?: number;
  defaultBet?: number;
  agentNames?: string[];
  variant?: "american" | "european";
  seed?: number | null;
}

/**
 * PettingZoo AEC Environment for Multi-agent Blackjack
 */
export class BlackjackAEC extends AECEnvironment {
  private engine: Engine;
  private game: MultiagentBlackjackGame;
  private config: Required<BlackjackAECConfig>;
  private _lastBankrolls: Record<string, number> = {};
  private _roundComplete: boolean = false;

  constructor(config: BlackjackAECConfig = {}) {
    super();

    this.config = {
      numAgents: config.numAgents ?? 2,
      numDecks: config.numDecks ?? 6,
      initialBankroll: config.initialBankroll ?? 1000,
      defaultBet: config.defaultBet ?? 10,
      agentNames: config.agentNames ?? [],
      variant: config.variant ?? "american",
      seed: config.seed ?? Date.now(),
    };

    // Generate agent names if not provided
    if (this.config.agentNames.length === 0) {
      for (let i = 0; i < this.config.numAgents; i++) {
        this.config.agentNames.push(`player_${i}`);
      }
    }

    this.engine = new Engine();
    this.game = new MultiagentBlackjackGame(this.engine, {
      isHost: true,
      numAgents: this.config.numAgents,
      numStacks: this.config.numDecks,
      seed: this.config.seed ?? null,
      initialBankroll: this.config.initialBankroll,
      agentNames: this.config.agentNames as any,
      variant: this.config.variant,
    } as any);
  }

  // === Spaces ===

  observationSpace(_agent: string): Space {
    // Observation: [handValue, dealerUpcard, isSoft, canDouble, canSplit, canInsurance, deckRatio]
    return {
      shape: [7],
      low: [0, 0, 0, 0, 0, 0, 0],
      high: [1, 1, 1, 1, 1, 1, 1],
    };
  }

  actionSpace(_agent: string): Space {
    // 5 discrete actions: Hit, Stand, Double, Split, Insurance
    return { n: 5, shape: [] };
  }

  /**
   * Returns action mask for valid actions.
   * [Hit, Stand, Double, Split, Insurance]
   */
  override actionMask(agent: string): boolean[] {
    const agentObj = this.getAgentByName(agent);
    if (!agentObj) return [false, false, false, false, false];

    const zoneName = agentObj.handZone || `agent-0-hand`;
    const cards = this.engine.space.zone(zoneName).map((p) => p.tokenSnapshot);
    const dealerCards = this.engine.space.zone("dealer-hand").map((p) => p.tokenSnapshot);

    const canHit = !isBusted(cards) && !agentObj.resources.stood;
    const canStand = !agentObj.resources.stood && !agentObj.resources.busted;
    const canDouble = canDoubleDown(cards) && agentObj.resources.bankroll >= agentObj.resources.currentBet;
    const canSplitHand = canSplit(cards) && agentObj.resources.bankroll >= agentObj.resources.currentBet && !agentObj.resources.hasSplit;
    const canInsurance = canTakeInsurance(dealerCards) && !agentObj.resources.insuranceBet && this.config.variant === "american";

    return [canHit, canStand, canDouble, canSplitHand, canInsurance];
  }

  // === Core Loop ===

  async reset(seed?: number): Promise<void> {
    // Reset engine state
    if (this.engine.stack) {
      this.engine.space.collectAllInto(this.engine.stack);
      const shuffleSeed = seed ?? this.config.seed ?? undefined;
      this.engine.stack.shuffle(shuffleSeed);
    }

    // Reset agent state
    const agentNames = this.config.agentNames;
    this.resetState(agentNames);

    // Place default bets and track bankrolls
    for (const agentObj of this.engine._agents) {
      agentObj.resources.currentBet = this.config.defaultBet;
      agentObj.resources.stood = 0;
      agentObj.resources.busted = 0;
      agentObj.resources.insuranceBet = 0;
      agentObj.resources.hasSplit = 0;
      this._lastBankrolls[agentObj.name] = agentObj.resources.bankroll;
    }

    // Deal initial cards
    this.game.deal();
    this._roundComplete = false;

    // Set current agent from game loop
    const activeAgent = this.engine.loop.activeAgent;
    if (activeAgent) {
      this._currentAgent = activeAgent.name;
    }
  }

  observe(agent: string): Observation {
    const agentObj = this.getAgentByName(agent);
    if (!agentObj) return [0, 0, 0, 0, 0, 0, 0];

    const zoneName = agentObj.handZone || `agent-0-hand`;
    const agentCards = this.engine.space.zone(zoneName).map((p) => p.tokenSnapshot);
    const dealerHand = this.engine.space.zone("dealer-hand");
    const dealerVisible = dealerHand.filter((c) => c.faceUp).map((c) => c.tokenSnapshot);

    const agentVal = getBestHandValue(agentCards);
    const dealerVal = getBestHandValue(dealerVisible);

    const totalCards = this.config.numDecks * 52;
    const cardsRemaining = this.engine.stack?.size ?? 0;

    return [
      this.normalize(agentVal, 0, 30),
      this.normalize(dealerVal, 0, 11),
      isSoftHand(agentCards) ? 1 : 0,
      canDoubleDown(agentCards) ? 1 : 0,
      canSplit(agentCards) ? 1 : 0,
      canTakeInsurance(dealerVisible) && this.config.variant === "american" ? 1 : 0,
      this.normalize(cardsRemaining, 0, totalCards),
    ];
  }

  async step(action: ActionID): Promise<void> {
    const currentAgent = this._currentAgent;
    const agentObj = this.getAgentByName(currentAgent);
    if (!agentObj) return;

    // Execute action
    switch (action) {
      case ACTION_HIT:
        this.game.hit();
        break;
      case ACTION_STAND:
        this.game.stand();
        break;
      case ACTION_DOUBLE:
        if (this.actionMask(currentAgent)[ACTION_DOUBLE]) {
          this.game.doubleDown();
        } else {
          // Invalid action, treat as stand
          this.game.stand();
        }
        break;
      case ACTION_SPLIT:
        if (this.actionMask(currentAgent)[ACTION_SPLIT]) {
          this.game.split();
        } else {
          // Invalid action, treat as stand
          this.game.stand();
        }
        break;
      case ACTION_INSURANCE:
        if (this.actionMask(currentAgent)[ACTION_INSURANCE]) {
          this.game.takeInsurance();
          // After insurance, dealer peeks for blackjack
          const dealerHasBJ = this.game.checkDealerBlackjack();
          if (dealerHasBJ) {
            // Round ended due to dealer blackjack
            this._roundComplete = true;
            this.calculateRewards();
            for (const agent of this._possibleAgents) {
              this._terminations[agent] = true;
            }
            return;
          }
        }
        // Insurance doesn't end turn - player can still hit/stand
        return;
      default:
        // Unknown action, treat as stand
        this.game.stand();
        break;
    }

    // Check if agent busted
    if (agentObj.resources.busted) {
      this._terminations[currentAgent] = true;
    }

    // Check if round is complete (all agents done)
    const isRoundOver = !this.engine.loop.running || this.engine.loop.phase === "dealer";

    if (isRoundOver && !this._roundComplete) {
      this._roundComplete = true;
      // Play dealer and resolve bets
      this.game.playDealer();
      this.calculateRewards();

      // Mark all agents as terminated (round over)
      for (const agent of this._possibleAgents) {
        this._terminations[agent] = true;
      }
    } else {
      // Update current agent from game loop
      const activeAgent = this.engine.loop.activeAgent;
      if (activeAgent) {
        this._currentAgent = activeAgent.name;
      }
    }
  }

  // === Rendering ===

  render(): void {
    console.log("\n=== Blackjack Table ===");

    // Show dealer hand
    const dealerHand = this.engine.space.zone("dealer-hand");
    const dealerCards = dealerHand.map((p) => {
      if (p.faceUp) return p.tokenSnapshot.label;
      return "[?]";
    });
    console.log(`Dealer: ${dealerCards.join(" ")} (${getBestHandValue(dealerHand.filter((c) => c.faceUp).map((c) => c.tokenSnapshot))})`);

    // Show each agent's hand
    for (const agentName of this._possibleAgents) {
      const agentObj = this.getAgentByName(agentName);
      if (!agentObj) continue;

      const zoneName = agentObj.handZone || `agent-0-hand`;
      const cards = this.engine.space.zone(zoneName).map((p) => p.tokenSnapshot);
      const cardLabels = cards.map((c) => c.label).join(" ");
      const value = getBestHandValue(cards);
      const soft = isSoftHand(cards) ? " (soft)" : "";
      const status = agentObj.resources.busted ? " BUSTED" : agentObj.resources.stood ? " STOOD" : "";
      const isCurrent = agentName === this._currentAgent ? " <--" : "";

      console.log(`${agentName}: ${cardLabels} (${value}${soft})${status}${isCurrent}`);
      console.log(`  Bankroll: $${agentObj.resources.bankroll} | Bet: $${agentObj.resources.currentBet}`);
    }

    console.log("=======================\n");
  }

  close(): void {
    // Cleanup if needed
  }

  // === Private Helpers ===

  private getAgentByName(name: string) {
    return this.engine._agents.find((p) => p.name === name);
  }

  private calculateRewards(): void {
    for (const agentObj of this.engine._agents) {
      const currentBankroll = agentObj.resources.bankroll;
      const lastBankroll = this._lastBankrolls[agentObj.name] ?? this.config.initialBankroll;
      const reward = currentBankroll - lastBankroll;

      this.addReward(agentObj.name, reward);
      this._lastBankrolls[agentObj.name] = currentBankroll;

      this._infos[agentObj.name] = {
        bankroll: currentBankroll,
        handValue: this.getHandValue(agentObj.name),
        busted: !!agentObj.resources.busted,
        stood: !!agentObj.resources.stood,
      };
    }
  }

  private getHandValue(agentName: string): number {
    const agentObj = this.getAgentByName(agentName);
    if (!agentObj) return 0;

    const zoneName = agentObj.handZone || `agent-0-hand`;
    const cards = this.engine.space.zone(zoneName).map((p) => p.tokenSnapshot);
    return getBestHandValue(cards);
  }
}
