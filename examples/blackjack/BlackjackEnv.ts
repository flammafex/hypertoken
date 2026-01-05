/*
 * examples/blackjack/BlackjackEnv.ts
 * Enhanced Gym Environment for Blackjack RL Training
 *
 * Features:
 * - Full action space: Hit, Stand, Double, Split, Surrender, Insurance
 * - Rich observation space with game state features
 * - Action masking for invalid actions
 * - Card counting integration (Hi-Lo)
 */
import { GymEnvironment, Observation, StepResult, Space } from "../../interface/Gym.js";
import { Engine } from "../../engine/Engine.js";
import { MultiagentBlackjackGame } from "./multiagent-game.js";
import { Agent } from "../../engine/Agent.js";
import { IEngineAgent } from "../../engine/types.js";
import {
  getBestHandValue,
  isSoftHand,
  isBusted,
  isBlackjack,
  canDoubleDown,
  canSplit,
  canTakeInsurance
} from "./blackjack-utils.js";

// Action constants
export const Actions = {
  HIT: 0,
  STAND: 1,
  DOUBLE: 2,
  SPLIT: 3,
  SURRENDER: 4,
  INSURANCE: 5
} as const;

export type ActionType = typeof Actions[keyof typeof Actions];

// Observation indices for easier access
export const ObsIndex = {
  HAND_VALUE: 0,
  DEALER_VALUE: 1,
  IS_SOFT: 2,
  DECK_PENETRATION: 3,
  CURRENT_BET: 4,
  BANKROLL: 5,
  CAN_HIT: 6,
  CAN_STAND: 7,
  CAN_DOUBLE: 8,
  CAN_SPLIT: 9,
  CAN_SURRENDER: 10,
  CAN_INSURANCE: 11,
  IS_SPLIT_HAND: 12,
  SPLIT_HAND_VALUE: 13,
  RUNNING_COUNT: 14,
  TRUE_COUNT: 15,
  DEALER_SHOWS_ACE: 16,
  HAND_IS_BLACKJACK: 17,
  NUM_CARDS_IN_HAND: 18
} as const;

export interface BlackjackEnvConfig {
  agentName?: string;
  initialBankroll?: number;
  numDecks?: number;
  baseBet?: number;
  allowSurrender?: boolean;
  seed?: number;
}

export class BlackjackEnv extends GymEnvironment {
  engine: Engine;
  game: MultiagentBlackjackGame;
  agentName: string;
  config: Required<BlackjackEnvConfig>;

  private _lastBankroll: number;
  private _runningCount: number = 0;
  private _cardsDealt: number = 0;
  private _insurancePhase: boolean = false;
  private _roundActive: boolean = false;

  constructor(config: BlackjackEnvConfig | string = {}) {
    super();

    // Handle legacy string argument (agentName)
    if (typeof config === 'string') {
      config = { agentName: config };
    }

    this.config = {
      agentName: config.agentName ?? "Agent",
      initialBankroll: config.initialBankroll ?? 1000,
      numDecks: config.numDecks ?? 6,
      baseBet: config.baseBet ?? 10,
      allowSurrender: config.allowSurrender ?? true,
      seed: config.seed ?? undefined as any
    };

    this.agentName = this.config.agentName;
    this._lastBankroll = this.config.initialBankroll;

    this.engine = new Engine();
    this.game = new MultiagentBlackjackGame(this.engine, {
      isHost: true,
      numAgents: 1,
      agentNames: [this.agentName] as any,
      initialBankroll: this.config.initialBankroll,
      numStacks: this.config.numDecks,
      seed: this.config.seed
    });
  }

  get observationSpace(): Space {
    // 19 features total
    return {
      shape: [19],
      low: Array(19).fill(0),
      high: Array(19).fill(1)
    };
  }

  get actionSpace(): Space {
    return { n: 6, shape: [] }; // 6 discrete actions
  }

  /**
   * Returns a boolean mask indicating which actions are valid
   * Useful for action masking in RL algorithms
   */
  getActionMask(): boolean[] {
    const agent = this.getAgent();
    const handZone = agent.handZone || `agent-0-hand`;
    const agentCards = this.engine.space.zone(handZone).map(p => p.tokenSnapshot);
    const dealerCards = this.engine.space.zone("dealer-hand").map(p => p.tokenSnapshot);

    const canHit = !isBusted(agentCards) && !isBlackjack(agentCards) && this._roundActive;
    const canStand = this._roundActive;
    const canDouble = canDoubleDown(agentCards) && agent.resources.bankroll >= agent.resources.currentBet;
    const canSplitHand = canSplit(agentCards) && agent.resources.bankroll >= agent.resources.currentBet && !agent.resources.hasSplit;
    const canSurrender = this.config.allowSurrender && agentCards.length === 2 && !agent.resources.hasSplit;
    const canInsurance = this._insurancePhase && canTakeInsurance(dealerCards) && !agent.resources.insuranceBet;

    return [
      canHit,        // HIT
      canStand,      // STAND
      canDouble,     // DOUBLE
      canSplitHand,  // SPLIT
      canSurrender,  // SURRENDER
      canInsurance   // INSURANCE
    ];
  }

  async reset(seed?: number): Promise<Observation> {
    // Reset card counting
    this._runningCount = 0;
    this._cardsDealt = 0;
    this._insurancePhase = false;

    // Reshuffle if needed
    if (this.engine.stack) {
      if (this.engine.stack.size < 52) {
        this.engine.space.collectAllInto(this.engine.stack);
        this.engine.stack.shuffle(seed ?? this.config.seed);
        this._runningCount = 0;
        this._cardsDealt = 0;
      }
    }

    const agent = this.getAgent();
    agent.resources.currentBet = this.config.baseBet;
    agent.resources.insuranceBet = 0;
    agent.resources.hasSplit = 0;
    agent.resources.splitHandBet = 0;
    agent.resources.playingSplitHand = 0;
    this._lastBankroll = agent.resources.bankroll;

    this.game.deal();
    this._roundActive = true;

    // Update card count from dealt cards
    this._updateCardCount();

    // Check for insurance opportunity
    const dealerCards = this.engine.space.zone("dealer-hand").map(p => p.tokenSnapshot);
    this._insurancePhase = canTakeInsurance(dealerCards);

    return this._observe();
  }

  async step(action: number): Promise<StepResult> {
    const agent = this.getAgent();
    const actionMask = this.getActionMask();

    // Handle invalid actions gracefully
    if (!actionMask[action]) {
      // Invalid action - return current state with small negative reward
      return {
        observation: this._observe(),
        reward: -0.1,
        terminated: false,
        truncated: false,
        info: {
          hand: this._getHandString(),
          bankroll: agent.resources.bankroll,
          invalidAction: true,
          actionAttempted: action
        }
      };
    }

    let roundEnded = false;

    switch (action) {
      case Actions.HIT:
        this.game.hit();
        this._updateCardCount();
        // Check if busted
        const handAfterHit = this._getHandCards();
        if (isBusted(handAfterHit)) {
          roundEnded = true;
        }
        break;

      case Actions.STAND:
        this.game.stand();
        // If not in split hand, play dealer
        if (!agent.resources.hasSplit || agent.resources.playingSplitHand) {
          this.game.playDealer();
          this._updateCardCount();
          roundEnded = true;
        }
        break;

      case Actions.DOUBLE:
        this.game.doubleDown();
        this._updateCardCount();
        // If not in split hand, play dealer
        if (!agent.resources.hasSplit || agent.resources.playingSplitHand) {
          this.game.playDealer();
          this._updateCardCount();
          roundEnded = true;
        }
        break;

      case Actions.SPLIT:
        this.game.split();
        this._updateCardCount();
        break;

      case Actions.SURRENDER:
        // Surrender returns half bet
        const surrenderBet = agent.resources.currentBet;
        agent.resources.bankroll += surrenderBet / 2;
        agent.resources.currentBet = 0;
        roundEnded = true;
        break;

      case Actions.INSURANCE:
        this.game.takeInsurance();
        this._insurancePhase = false;
        // Check dealer blackjack
        if (this.game.checkDealerBlackjack()) {
          roundEnded = true;
        }
        break;
    }

    // Clear insurance phase after any non-insurance action
    if (action !== Actions.INSURANCE) {
      this._insurancePhase = false;
    }

    // Check if round ended naturally
    const isRoundOver = roundEnded || !this.engine.loop.running || this.engine.loop.phase === "dealer" || this.engine.loop.phase === "complete";

    if (isRoundOver) {
      this._roundActive = false;
    }

    // Calculate reward
    const currentBankroll = agent.resources.bankroll;
    const reward = currentBankroll - this._lastBankroll;
    this._lastBankroll = currentBankroll;

    return {
      observation: this._observe(),
      reward,
      terminated: isRoundOver,
      truncated: false,
      info: {
        hand: this._getHandString(),
        bankroll: currentBankroll,
        action,
        actionName: this._getActionName(action),
        runningCount: this._runningCount,
        trueCount: this._getTrueCount()
      }
    };
  }

  render(): void {
    const obs = this._observe();
    const agent = this.getAgent();
    const actionMask = this.getActionMask();

    const availableActions = ['Hit', 'Stand', 'Double', 'Split', 'Surrender', 'Insurance']
      .filter((_, i) => actionMask[i]);

    console.log(`
    ===== Blackjack Environment =====
    Hand:     ${this._getHandString()}
    Value:    ${this._getHandValue()}${obs[ObsIndex.IS_SOFT] ? ' (soft)' : ''}
    Dealer:   ${this._getDealerVisibleString()}
    Bankroll: $${agent.resources.bankroll}
    Bet:      $${agent.resources.currentBet}

    Card Count: RC=${this._runningCount} TC=${this._getTrueCount().toFixed(1)}

    Available: ${availableActions.join(', ')}
    ================================
    `);
  }

  // --- Helper Methods ---

  private getAgent(): IEngineAgent {
    return this.engine._agents.find(p => p.name === this.agentName)!;
  }

  private _getHandCards(): any[] {
    const agent = this.getAgent();
    const zoneName = agent.resources.playingSplitHand
      ? agent.resources.splitHandZone
      : (agent.handZone || `agent-0-hand`);
    return this.engine.space.zone(zoneName).map(pl => pl.tokenSnapshot);
  }

  private _getHandValue(): number {
    return getBestHandValue(this._getHandCards());
  }

  private _getHandString(): string {
    const agent = this.getAgent();
    const zoneName = agent.resources.playingSplitHand
      ? agent.resources.splitHandZone
      : (agent.handZone || `agent-0-hand`);
    const cards = this.engine.space.zone(zoneName);
    return cards.map(c => c.tokenSnapshot.label).join(", ");
  }

  private _getDealerVisibleString(): string {
    const dealerHand = this.engine.space.zone("dealer-hand");
    const visible = dealerHand.filter(c => c.faceUp).map(c => c.tokenSnapshot.label);
    return visible.join(", ") + (dealerHand.length > visible.length ? " + [hidden]" : "");
  }

  private _getActionName(action: number): string {
    const names = ['Hit', 'Stand', 'Double', 'Split', 'Surrender', 'Insurance'];
    return names[action] || 'Unknown';
  }

  private _updateCardCount(): void {
    // Hi-Lo counting system
    // 2-6: +1, 7-9: 0, 10-A: -1
    const countCard = (card: any): number => {
      const rank = card.meta?.rank;
      if (['2', '3', '4', '5', '6'].includes(rank)) return 1;
      if (['10', 'J', 'Q', 'K', 'A'].includes(rank)) return -1;
      return 0;
    };

    // Count all face-up cards
    let count = 0;
    let cardsDealt = 0;

    // Agent hands
    for (const agent of this.engine._agents) {
      const handZone = agent.handZone || `agent-0-hand`;
      const cards = this.engine.space.zone(handZone);
      for (const c of cards) {
        if (c.faceUp) {
          count += countCard(c.tokenSnapshot);
          cardsDealt++;
        }
      }
      // Split hand
      if (agent.resources.splitHandZone) {
        const splitCards = this.engine.space.zone(agent.resources.splitHandZone);
        for (const c of splitCards) {
          if (c.faceUp) {
            count += countCard(c.tokenSnapshot);
            cardsDealt++;
          }
        }
      }
    }

    // Dealer hand
    const dealerCards = this.engine.space.zone("dealer-hand");
    for (const c of dealerCards) {
      if (c.faceUp) {
        count += countCard(c.tokenSnapshot);
        cardsDealt++;
      }
    }

    this._runningCount = count;
    this._cardsDealt = cardsDealt;
  }

  private _getTrueCount(): number {
    const decksRemaining = (this.engine.stack?.size ?? 0) / 52;
    if (decksRemaining < 0.5) return this._runningCount; // Avoid division by small numbers
    return this._runningCount / decksRemaining;
  }

  private _observe(): Observation {
    const agent = this.getAgent();
    const agentCards = this._getHandCards();
    const dealerHand = this.engine.space.zone("dealer-hand");
    const dealerVisible = dealerHand.filter(c => c.faceUp).map(c => c.tokenSnapshot);

    const agentVal = getBestHandValue(agentCards);
    const dealerVal = getBestHandValue(dealerVisible);
    const actionMask = this.getActionMask();

    // Get split hand value if applicable
    let splitHandVal = 0;
    if (agent.resources.hasSplit && agent.resources.splitHandZone) {
      const splitCards = this.engine.space.zone(agent.resources.splitHandZone).map(p => p.tokenSnapshot);
      splitHandVal = getBestHandValue(splitCards);
    }

    // Check if dealer shows ace
    const dealerShowsAce = dealerVisible.some(c => c.meta?.rank === 'A');

    return [
      this.normalize(agentVal, 0, 30),                           // 0: Hand value
      this.normalize(dealerVal, 0, 12),                          // 1: Dealer visible
      isSoftHand(agentCards) ? 1 : 0,                           // 2: Is soft hand
      this.normalize(this.engine.stack?.size ?? 0, 0, 312),     // 3: Deck penetration
      this.normalize(agent.resources.currentBet, 0, 500),       // 4: Current bet
      this.normalize(agent.resources.bankroll, 0, 5000),        // 5: Bankroll
      actionMask[Actions.HIT] ? 1 : 0,                          // 6: Can hit
      actionMask[Actions.STAND] ? 1 : 0,                        // 7: Can stand
      actionMask[Actions.DOUBLE] ? 1 : 0,                       // 8: Can double
      actionMask[Actions.SPLIT] ? 1 : 0,                        // 9: Can split
      actionMask[Actions.SURRENDER] ? 1 : 0,                    // 10: Can surrender
      actionMask[Actions.INSURANCE] ? 1 : 0,                    // 11: Can insurance
      agent.resources.playingSplitHand ? 1 : 0,                 // 12: Is split hand
      this.normalize(splitHandVal, 0, 30),                      // 13: Split hand value
      this.normalize(this._runningCount, -20, 20),              // 14: Running count
      this.normalize(this._getTrueCount(), -10, 10),            // 15: True count
      dealerShowsAce ? 1 : 0,                                   // 16: Dealer shows ace
      isBlackjack(agentCards) ? 1 : 0,                          // 17: Hand is blackjack
      this.normalize(agentCards.length, 0, 10)                  // 18: Num cards in hand
    ];
  }
}
