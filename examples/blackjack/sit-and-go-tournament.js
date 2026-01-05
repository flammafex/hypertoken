/**
 * Sit-and-Go Tournament for Blackjack
 *
 * Poker-style tournament with:
 * - Escalating blind levels (small blind, big blind)
 * - Forced bets rotating around the table
 * - Buy-in based prize pool with payout structure
 * - Elimination when unable to cover big blind
 */

import { Engine } from '../../engine/Engine.js';
import { MultiagentBlackjackGame } from './multiagent-game.js';
import {
  getBestHandValue,
  isSoftHand,
  isBusted,
  isBlackjack,
  canDoubleDown,
  canSplit
} from './blackjack-utils.js';

// Default blind structure (poker-style escalation)
const DEFAULT_BLIND_LEVELS = [
  { small: 10, big: 20, ante: 0, duration: 10 },
  { small: 15, big: 30, ante: 0, duration: 10 },
  { small: 25, big: 50, ante: 0, duration: 10 },
  { small: 50, big: 100, ante: 0, duration: 10 },
  { small: 75, big: 150, ante: 0, duration: 10 },
  { small: 100, big: 200, ante: 25, duration: 10 },
  { small: 150, big: 300, ante: 25, duration: 10 },
  { small: 200, big: 400, ante: 50, duration: 10 },
  { small: 300, big: 600, ante: 50, duration: 10 },
  { small: 400, big: 800, ante: 100, duration: 10 },
  { small: 500, big: 1000, ante: 100, duration: 10 },
  { small: 750, big: 1500, ante: 150, duration: 10 },
  { small: 1000, big: 2000, ante: 200, duration: 10 }
];

// Default payout structure (percentage of prize pool)
const DEFAULT_PAYOUT_STRUCTURE = {
  2: [1.0],                    // Heads-up: winner takes all
  3: [0.65, 0.35],             // 3 players: top 2 paid
  4: [0.60, 0.25, 0.15],       // 4 players: top 3 paid
  5: [0.50, 0.30, 0.20],       // 5 players
  6: [0.50, 0.30, 0.20],       // 6 players
  7: [0.45, 0.27, 0.18, 0.10], // 7+ players: top 4 paid
  8: [0.45, 0.27, 0.18, 0.10],
  9: [0.40, 0.25, 0.18, 0.10, 0.07],
  10: [0.40, 0.25, 0.18, 0.10, 0.07]
};

export class SitAndGoTournament {
  constructor(agents, options = {}) {
    this.options = {
      buyIn: options.buyIn ?? 100,
      startingChips: options.startingChips ?? 1500,
      blindLevels: options.blindLevels ?? DEFAULT_BLIND_LEVELS,
      payoutStructure: options.payoutStructure ?? null, // Will use default based on player count
      numDecks: options.numDecks ?? 6,
      seed: options.seed ?? null,
      maxRounds: options.maxRounds ?? 500,
      verbose: options.verbose ?? false,
      showBlindChanges: options.showBlindChanges ?? true
    };

    // Calculate prize pool
    this.prizePool = agents.length * this.options.buyIn;

    // Determine payout structure based on player count
    const playerCount = agents.length;
    this.payouts = this.options.payoutStructure ||
      DEFAULT_PAYOUT_STRUCTURE[Math.min(playerCount, 10)] ||
      DEFAULT_PAYOUT_STRUCTURE[10];

    this.agents = agents.map((a, idx) => ({
      strategy: a,
      name: a.name,
      seatPosition: idx,
      isEliminated: false,
      eliminatedRound: null,
      eliminatedLevel: null,
      finalRank: null,
      prize: 0,
      stats: {
        handsPlayed: 0,
        handsWon: 0,
        handsLost: 0,
        pushes: 0,
        blackjacks: 0,
        doubles: 0,
        splits: 0,
        blindsPaid: 0,
        antesPaid: 0,
        peakChips: this.options.startingChips,
        totalWagered: 0
      }
    }));

    this.eliminationOrder = [];
    this.round = 0;
    this.levelIndex = 0;
    this.handsAtLevel = 0;
    this.buttonPosition = 0; // Dealer button position
    this.engine = null;
    this.game = null;
  }

  /**
   * Get current blind level
   */
  get currentLevel() {
    return this.options.blindLevels[this.levelIndex] ||
           this.options.blindLevels[this.options.blindLevels.length - 1];
  }

  /**
   * Get the small blind position (left of button)
   */
  getSmallBlindPosition() {
    const activePlayers = this.getActivePlayers();
    if (activePlayers.length <= 2) {
      // Heads-up: button is small blind
      return this.buttonPosition;
    }
    return (this.buttonPosition + 1) % activePlayers.length;
  }

  /**
   * Get the big blind position (left of small blind)
   */
  getBigBlindPosition() {
    const activePlayers = this.getActivePlayers();
    if (activePlayers.length <= 2) {
      // Heads-up: other player is big blind
      return (this.buttonPosition + 1) % activePlayers.length;
    }
    return (this.buttonPosition + 2) % activePlayers.length;
  }

  /**
   * Initialize the game engine and multiagent game
   */
  initGame() {
    this.engine = new Engine();

    const activeAgents = this.agents.filter(a => !a.isEliminated);

    this.game = new MultiagentBlackjackGame(this.engine, {
      isHost: true,
      numAgents: activeAgents.length,
      agentNames: activeAgents.map(a => a.name),
      initialBankroll: this.options.startingChips,
      numStacks: this.options.numDecks,
      seed: this.options.seed
    });
  }

  /**
   * Reinitialize game after eliminations
   */
  reinitGame() {
    const activeAgents = this.getActivePlayers();

    // Store current chip counts
    const chipCounts = {};
    for (const agent of activeAgents) {
      const engineAgent = this.getEngineAgent(agent.name);
      if (engineAgent) {
        chipCounts[agent.name] = engineAgent.resources.bankroll;
      }
    }

    // Recreate game
    this.engine = new Engine();
    this.game = new MultiagentBlackjackGame(this.engine, {
      isHost: true,
      numAgents: activeAgents.length,
      agentNames: activeAgents.map(a => a.name),
      initialBankroll: this.options.startingChips,
      numStacks: this.options.numDecks,
      seed: this.options.seed
    });

    // Restore chip counts
    for (const agent of activeAgents) {
      const engineAgent = this.getEngineAgent(agent.name);
      if (engineAgent && chipCounts[agent.name] !== undefined) {
        engineAgent.resources.bankroll = chipCounts[agent.name];
      }
    }
  }

  /**
   * Get the engine agent by name
   */
  getEngineAgent(name) {
    return this.engine._agents.find(a => a.name === name);
  }

  /**
   * Get active (non-eliminated) players
   */
  getActivePlayers() {
    return this.agents.filter(a => !a.isEliminated);
  }

  /**
   * Check if blinds should increase
   */
  checkBlindIncrease() {
    if (this.handsAtLevel >= this.currentLevel.duration) {
      const previousLevel = this.currentLevel;
      this.levelIndex++;
      this.handsAtLevel = 0;

      if (this.options.showBlindChanges && this.levelIndex < this.options.blindLevels.length) {
        console.log(`\n⬆️  BLIND LEVEL UP!`);
        console.log(`   Level ${this.levelIndex + 1}: ${this.currentLevel.small}/${this.currentLevel.big}${this.currentLevel.ante ? ` + ${this.currentLevel.ante} ante` : ''}`);
        console.log(`   (was: ${previousLevel.small}/${previousLevel.big})`);
      }
    }
  }

  /**
   * Move the dealer button
   */
  moveButton() {
    const activePlayers = this.getActivePlayers();
    this.buttonPosition = (this.buttonPosition + 1) % activePlayers.length;
  }

  /**
   * Post blinds and antes
   */
  postBlinds() {
    const activePlayers = this.getActivePlayers();
    const level = this.currentLevel;

    const sbPos = this.getSmallBlindPosition();
    const bbPos = this.getBigBlindPosition();

    const sbPlayer = activePlayers[sbPos];
    const bbPlayer = activePlayers[bbPos];

    const sbAgent = this.getEngineAgent(sbPlayer.name);
    const bbAgent = this.getEngineAgent(bbPlayer.name);

    // Post small blind
    const sbAmount = Math.min(level.small, sbAgent.resources.bankroll);
    sbAgent.resources.bankroll -= sbAmount;
    sbPlayer.stats.blindsPaid += sbAmount;
    sbPlayer.stats.totalWagered += sbAmount;

    // Post big blind
    const bbAmount = Math.min(level.big, bbAgent.resources.bankroll);
    bbAgent.resources.bankroll -= bbAmount;
    bbPlayer.stats.blindsPaid += bbAmount;
    bbPlayer.stats.totalWagered += bbAmount;

    if (this.options.verbose) {
      console.log(`Blinds: ${sbPlayer.name} posts SB $${sbAmount}, ${bbPlayer.name} posts BB $${bbAmount}`);
    }

    // Post antes from all players
    if (level.ante > 0) {
      for (const player of activePlayers) {
        const agent = this.getEngineAgent(player.name);
        if (agent && agent.resources.bankroll > 0) {
          const anteAmount = Math.min(level.ante, agent.resources.bankroll);
          agent.resources.bankroll -= anteAmount;
          player.stats.antesPaid += anteAmount;
          player.stats.totalWagered += anteAmount;
        }
      }
      if (this.options.verbose) {
        console.log(`All players post $${level.ante} ante`);
      }
    }

    // Set bet amounts for the round (blinds serve as forced bets)
    sbAgent.resources.currentBet = sbAmount;
    bbAgent.resources.currentBet = bbAmount;

    // Non-blind players must at least match big blind
    for (const player of activePlayers) {
      if (player !== sbPlayer && player !== bbPlayer) {
        const agent = this.getEngineAgent(player.name);
        // They'll decide their bet in calculateBet, but minimum is BB
        agent.resources.currentBet = 0; // Will be set in bet phase
      }
    }

    return { sbPlayer, bbPlayer, sbAmount, bbAmount };
  }

  /**
   * Build a gameState object for an agent to make decisions
   */
  buildAgentGameState(agentInfo) {
    const engineAgent = this.getEngineAgent(agentInfo.name);
    if (!engineAgent) return null;

    const handZone = engineAgent.handZone;
    const agentCards = this.engine.space.zone(handZone).map(p => p.tokenSnapshot);
    const dealerCards = this.engine.space.zone("dealer-hand").map(p => p.tokenSnapshot);

    // Only show face-up dealer cards for decision making
    const dealerVisible = this.engine.space.zone("dealer-hand")
      .filter(p => p.faceUp)
      .map(p => p.tokenSnapshot);

    const agentValue = getBestHandValue(agentCards);
    const dealerValue = getBestHandValue(dealerVisible);

    return {
      agentHand: {
        cards: agentCards,
        value: agentValue,
        busted: isBusted(agentCards),
        blackjack: isBlackjack(agentCards)
      },
      dealerHand: {
        cards: dealerCards,
        value: dealerValue,
        visibleValue: dealerValue
      },
      canHit: !isBusted(agentCards) && !isBlackjack(agentCards),
      canStand: true,
      canDouble: canDoubleDown(agentCards) && engineAgent.resources.bankroll >= engineAgent.resources.currentBet,
      canSplit: canSplit(agentCards) && engineAgent.resources.bankroll >= engineAgent.resources.currentBet,
      bankroll: engineAgent.resources.bankroll,
      currentBet: engineAgent.resources.currentBet,
      // Tournament-specific info
      blindLevel: this.levelIndex + 1,
      smallBlind: this.currentLevel.small,
      bigBlind: this.currentLevel.big,
      ante: this.currentLevel.ante,
      playersRemaining: this.getActivePlayers().length
    };
  }

  /**
   * Calculate bet size for an agent
   */
  calculateBet(agentInfo, isBigBlind = false) {
    const engineAgent = this.getEngineAgent(agentInfo.name);
    if (!engineAgent) return this.currentLevel.big;

    // Minimum bet is the big blind
    const minBet = this.currentLevel.big;
    const maxBet = engineAgent.resources.bankroll;

    // If agent has a getBetSize method, use it
    if (agentInfo.strategy.getBetSize) {
      const bet = agentInfo.strategy.getBetSize({
        bankroll: engineAgent.resources.bankroll,
        minBet: minBet,
        maxBet: maxBet,
        blindLevel: this.levelIndex + 1,
        smallBlind: this.currentLevel.small,
        bigBlind: this.currentLevel.big
      });
      return Math.min(Math.max(bet, minBet), maxBet);
    }

    // Default: bet 2-3x big blind based on chips
    const chipMultiple = engineAgent.resources.bankroll / this.currentLevel.big;
    let bet;

    if (chipMultiple < 5) {
      // Short stack: all-in or fold mentality, bet big
      bet = Math.min(minBet * 2, maxBet);
    } else if (chipMultiple < 15) {
      // Medium stack: standard raises
      bet = Math.min(minBet * 2, maxBet);
    } else {
      // Deep stack: can afford bigger bets
      bet = Math.min(minBet * 3, maxBet);
    }

    return Math.max(bet, minBet);
  }

  /**
   * Play a single round of the tournament
   */
  async playRound() {
    this.round++;
    this.handsAtLevel++;
    const activePlayers = this.getActivePlayers();

    if (activePlayers.length <= 1) {
      return false; // Tournament over
    }

    // Check blind increase
    this.checkBlindIncrease();

    if (this.options.verbose) {
      console.log(`\n${"═".repeat(60)}`);
      console.log(`HAND ${this.round} | Level ${this.levelIndex + 1} (${this.currentLevel.small}/${this.currentLevel.big}) | ${activePlayers.length} players`);
      console.log(`${"═".repeat(60)}`);
    }

    // Post blinds
    const { sbPlayer, bbPlayer, sbAmount, bbAmount } = this.postBlinds();

    // Set bets for non-blind players
    for (const agentInfo of activePlayers) {
      if (agentInfo !== sbPlayer && agentInfo !== bbPlayer) {
        const engineAgent = this.getEngineAgent(agentInfo.name);
        if (engineAgent && engineAgent.resources.bankroll > 0) {
          const bet = this.calculateBet(agentInfo);

          // Deduct bet from bankroll
          const actualBet = Math.min(bet, engineAgent.resources.bankroll);
          engineAgent.resources.bankroll -= actualBet;
          engineAgent.resources.currentBet = actualBet;
          agentInfo.stats.totalWagered += actualBet;

          if (this.options.verbose) {
            console.log(`${agentInfo.name} bets $${actualBet} (chips: $${engineAgent.resources.bankroll})`);
          }
        }
      }
    }

    // Deal cards
    this.game.deal();

    if (this.options.verbose) {
      this.printTableState();
    }

    // Each player takes their turn
    for (const agentInfo of activePlayers) {
      const engineAgent = this.getEngineAgent(agentInfo.name);
      if (!engineAgent || engineAgent.resources.currentBet === 0) continue;

      // Skip if already busted or has blackjack
      const gameState = this.buildAgentGameState(agentInfo);
      if (!gameState || gameState.agentHand.busted || gameState.agentHand.blackjack) {
        if (gameState?.agentHand.blackjack) {
          agentInfo.stats.blackjacks++;
        }
        continue;
      }

      await this.playAgentTurn(agentInfo);
    }

    // Dealer plays
    this.game.playDealer();

    if (this.options.verbose) {
      console.log(`\nDealer's final hand:`);
      const dealerCards = this.engine.space.zone("dealer-hand").map(p => p.tokenSnapshot);
      console.log(`  ${dealerCards.map(c => c.label).join(", ")} = ${getBestHandValue(dealerCards)}`);
    }

    // Record results and check for eliminations
    this.recordRoundResults();
    const hadEliminations = this.checkEliminations();

    // Move button for next hand
    this.moveButton();

    // Reset for next round
    this.engine.space.collectAllInto(this.engine.stack);

    // Reshuffle if needed
    if (this.engine.stack.size < 52) {
      this.engine.stack.shuffle();
    }

    // Reinit game if we had eliminations
    if (hadEliminations && this.getActivePlayers().length > 1) {
      this.reinitGame();
    }

    return true;
  }

  /**
   * Play a single agent's turn
   */
  async playAgentTurn(agentInfo) {
    const engineAgent = this.getEngineAgent(agentInfo.name);
    if (!engineAgent) return;

    let continuePlay = true;
    let actions = 0;
    const maxActions = 10;

    while (continuePlay && actions < maxActions) {
      actions++;
      const gameState = this.buildAgentGameState(agentInfo);

      if (!gameState || gameState.agentHand.busted || gameState.agentHand.blackjack) {
        break;
      }

      // Get decision from agent
      const decision = agentInfo.strategy.decide(gameState);

      if (this.options.verbose) {
        console.log(`${agentInfo.name}: ${gameState.agentHand.cards.map(c => c.label).join(", ")} = ${gameState.agentHand.value} → ${decision.toUpperCase()}`);
      }

      switch (decision.toLowerCase()) {
        case 'hit':
          const currentActiveIdx = this.engine.loop.activeAgentIndex;
          const agentIdx = this.engine._agents.findIndex(a => a.name === agentInfo.name);
          this.engine.session.change("set active", doc => {
            doc.gameLoop.activeAgentIndex = agentIdx;
          });

          this.game.hit();

          const afterHit = this.buildAgentGameState(agentInfo);
          if (afterHit?.agentHand.busted) {
            continuePlay = false;
          }
          break;

        case 'stand':
          continuePlay = false;
          break;

        case 'double':
          if (gameState.canDouble) {
            const agentIdx = this.engine._agents.findIndex(a => a.name === agentInfo.name);
            this.engine.session.change("set active", doc => {
              doc.gameLoop.activeAgentIndex = agentIdx;
            });
            this.game.doubleDown();
            agentInfo.stats.doubles++;
            agentInfo.stats.totalWagered += engineAgent.resources.currentBet / 2;
          }
          continuePlay = false;
          break;

        case 'split':
          if (gameState.canSplit) {
            const agentIdx = this.engine._agents.findIndex(a => a.name === agentInfo.name);
            this.engine.session.change("set active", doc => {
              doc.gameLoop.activeAgentIndex = agentIdx;
            });
            this.game.split();
            agentInfo.stats.splits++;
            agentInfo.stats.totalWagered += engineAgent.resources.currentBet;
          }
          continuePlay = false;
          break;

        default:
          continuePlay = false;
      }
    }
  }

  /**
   * Record results after a round
   */
  recordRoundResults() {
    const dealerCards = this.engine.space.zone("dealer-hand").map(p => p.tokenSnapshot);
    const dealerValue = getBestHandValue(dealerCards);
    const dealerBusted = isBusted(dealerCards);

    for (const agentInfo of this.getActivePlayers()) {
      const engineAgent = this.getEngineAgent(agentInfo.name);
      if (!engineAgent) continue;

      const handZone = engineAgent.handZone;
      const agentCards = this.engine.space.zone(handZone).map(p => p.tokenSnapshot);
      const agentValue = getBestHandValue(agentCards);
      const agentBusted = isBusted(agentCards);
      const agentBlackjack = isBlackjack(agentCards);

      agentInfo.stats.handsPlayed++;

      // Track peak chips
      if (engineAgent.resources.bankroll > agentInfo.stats.peakChips) {
        agentInfo.stats.peakChips = engineAgent.resources.bankroll;
      }

      // Determine result
      if (agentBusted) {
        agentInfo.stats.handsLost++;
        if (this.options.verbose) {
          console.log(`${agentInfo.name}: BUST - Lost $${engineAgent.resources.currentBet}`);
        }
      } else if (dealerBusted) {
        agentInfo.stats.handsWon++;
        if (this.options.verbose) {
          console.log(`${agentInfo.name}: WIN (dealer bust) - Chips: $${engineAgent.resources.bankroll}`);
        }
      } else if (agentBlackjack && !isBlackjack(dealerCards)) {
        agentInfo.stats.handsWon++;
        if (this.options.verbose) {
          console.log(`${agentInfo.name}: BLACKJACK! - Chips: $${engineAgent.resources.bankroll}`);
        }
      } else if (agentValue > dealerValue) {
        agentInfo.stats.handsWon++;
        if (this.options.verbose) {
          console.log(`${agentInfo.name}: WIN (${agentValue} vs ${dealerValue}) - Chips: $${engineAgent.resources.bankroll}`);
        }
      } else if (agentValue < dealerValue) {
        agentInfo.stats.handsLost++;
        if (this.options.verbose) {
          console.log(`${agentInfo.name}: LOSE (${agentValue} vs ${dealerValue}) - Chips: $${engineAgent.resources.bankroll}`);
        }
      } else {
        agentInfo.stats.pushes++;
        if (this.options.verbose) {
          console.log(`${agentInfo.name}: PUSH - Chips: $${engineAgent.resources.bankroll}`);
        }
      }
    }
  }

  /**
   * Check for eliminated players
   */
  checkEliminations() {
    let hadEliminations = false;

    for (const agentInfo of this.getActivePlayers()) {
      const engineAgent = this.getEngineAgent(agentInfo.name);

      // Eliminated if can't afford big blind
      if (!engineAgent || engineAgent.resources.bankroll < this.currentLevel.big) {
        agentInfo.isEliminated = true;
        agentInfo.eliminatedRound = this.round;
        agentInfo.eliminatedLevel = this.levelIndex + 1;
        this.eliminationOrder.push(agentInfo);
        hadEliminations = true;

        const remaining = this.getActivePlayers().length;
        console.log(`\n💀 ${agentInfo.name} ELIMINATED!`);
        console.log(`   Hand ${this.round} | Level ${this.levelIndex + 1} (${this.currentLevel.small}/${this.currentLevel.big})`);
        console.log(`   ${remaining} player${remaining !== 1 ? 's' : ''} remaining`);

        // Check if in the money
        const finishPosition = this.agents.length - this.eliminationOrder.length + 1;
        if (finishPosition <= this.payouts.length) {
          const prize = Math.floor(this.prizePool * this.payouts[finishPosition - 1]);
          console.log(`   🎉 Finished ${this.getOrdinal(finishPosition)} - Wins $${prize}!`);
        }
      }
    }

    return hadEliminations;
  }

  /**
   * Get ordinal suffix for a number
   */
  getOrdinal(n) {
    const s = ["th", "st", "nd", "rd"];
    const v = n % 100;
    return n + (s[(v - 20) % 10] || s[v] || s[0]);
  }

  /**
   * Print current table state
   */
  printTableState() {
    console.log(`\nTable State:`);

    // Dealer
    const dealerCards = this.engine.space.zone("dealer-hand");
    const visibleDealer = dealerCards.filter(p => p.faceUp).map(p => p.tokenSnapshot.label);
    const hiddenCount = dealerCards.filter(p => !p.faceUp).length;
    console.log(`  Dealer: ${visibleDealer.join(", ")}${hiddenCount ? ` + [${hiddenCount} hidden]` : ""}`);

    // Players with position indicators
    const activePlayers = this.getActivePlayers();
    const sbPos = this.getSmallBlindPosition();
    const bbPos = this.getBigBlindPosition();

    for (let i = 0; i < activePlayers.length; i++) {
      const agentInfo = activePlayers[i];
      const engineAgent = this.getEngineAgent(agentInfo.name);
      if (!engineAgent) continue;

      const cards = this.engine.space.zone(engineAgent.handZone).map(p => p.tokenSnapshot);
      const value = getBestHandValue(cards);

      let position = "";
      if (i === this.buttonPosition) position = " (BTN)";
      else if (i === sbPos) position = " (SB)";
      else if (i === bbPos) position = " (BB)";

      console.log(`  ${agentInfo.name}${position}: ${cards.map(c => c.label).join(", ")} = ${value} (bet: $${engineAgent.resources.currentBet}, chips: $${engineAgent.resources.bankroll})`);
    }
  }

  /**
   * Print current chip stacks
   */
  printChipStacks() {
    const activePlayers = this.getActivePlayers();
    activePlayers.sort((a, b) => {
      const chipsA = this.getEngineAgent(a.name)?.resources.bankroll ?? 0;
      const chipsB = this.getEngineAgent(b.name)?.resources.bankroll ?? 0;
      return chipsB - chipsA;
    });

    console.log(`\nChip Stacks (Level ${this.levelIndex + 1}: ${this.currentLevel.small}/${this.currentLevel.big}):`);
    for (const agent of activePlayers) {
      const chips = this.getEngineAgent(agent.name)?.resources.bankroll ?? 0;
      const bbs = Math.floor(chips / this.currentLevel.big);
      const bar = "█".repeat(Math.min(20, Math.floor(chips / this.options.startingChips * 20)));
      console.log(`  ${agent.name.padEnd(20)} $${String(chips).padStart(6)} (${bbs} BB) ${bar}`);
    }
  }

  /**
   * Calculate prize payouts
   */
  calculatePayouts() {
    // Final rankings by elimination order (last eliminated = best non-winner)
    const activePlayers = this.getActivePlayers();
    let finishOrder;

    if (activePlayers.length > 0) {
      // Normal case: we have a winner
      finishOrder = [...activePlayers, ...this.eliminationOrder.slice().reverse()];
    } else {
      // Edge case: all players eliminated (e.g., simultaneous elimination)
      // Last eliminated players get top positions
      finishOrder = this.eliminationOrder.slice().reverse();
    }

    const payoutResults = [];
    for (let i = 0; i < finishOrder.length; i++) {
      const player = finishOrder[i];
      if (!player) continue;

      const percentage = this.payouts[i] || 0;
      const prize = Math.floor(this.prizePool * percentage);

      player.finalRank = i + 1;
      player.prize = prize;

      payoutResults.push({
        player: player.name,
        rank: i + 1,
        prize,
        percentage: percentage * 100
      });
    }

    return payoutResults;
  }

  /**
   * Run the full tournament
   */
  async run() {
    console.log(`\n${"╔" + "═".repeat(58) + "╗"}`);
    console.log(`║${" ".repeat(15)}SIT-AND-GO TOURNAMENT${" ".repeat(22)}║`);
    console.log(`${"╚" + "═".repeat(58) + "╝"}\n`);

    console.log(`📋 Tournament Info:`);
    console.log(`   Players: ${this.agents.length}`);
    console.log(`   Buy-in: $${this.options.buyIn}`);
    console.log(`   Prize Pool: $${this.prizePool}`);
    console.log(`   Starting Chips: ${this.options.startingChips}`);
    console.log(`   Blind Levels: ${this.options.blindLevels.length}`);
    console.log(`   Decks: ${this.options.numDecks}`);

    console.log(`\n💰 Payout Structure:`);
    for (let i = 0; i < this.payouts.length; i++) {
      const prize = Math.floor(this.prizePool * this.payouts[i]);
      console.log(`   ${this.getOrdinal(i + 1)}: $${prize} (${(this.payouts[i] * 100).toFixed(0)}%)`);
    }

    console.log(`\n📊 Blind Structure (first 5 levels):`);
    for (let i = 0; i < Math.min(5, this.options.blindLevels.length); i++) {
      const level = this.options.blindLevels[i];
      console.log(`   Level ${i + 1}: ${level.small}/${level.big}${level.ante ? ` + ${level.ante} ante` : ''} (${level.duration} hands)`);
    }

    console.log(`\n👥 Participants:`);
    for (const agent of this.agents) {
      console.log(`   - ${agent.name}`);
    }

    // Initialize game
    this.initGame();

    console.log(`\n${"─".repeat(60)}`);
    console.log(`TOURNAMENT BEGINS!`);
    console.log(`${"─".repeat(60)}`);

    // Play rounds until one player remains or max rounds reached
    let continueGame = true;
    while (continueGame && this.round < this.options.maxRounds) {
      continueGame = await this.playRound();

      const remaining = this.getActivePlayers();
      if (remaining.length <= 1) {
        break;
      }

      // Progress update every 10 rounds
      if (!this.options.verbose && this.round % 10 === 0) {
        this.printChipStacks();
      }
    }

    // Calculate payouts and print results
    const payouts = this.calculatePayouts();
    this.printResults(payouts);
  }

  /**
   * Print tournament results
   */
  printResults(payouts) {
    console.log(`\n${"╔" + "═".repeat(58) + "╗"}`);
    console.log(`║${" ".repeat(17)}TOURNAMENT RESULTS${" ".repeat(23)}║`);
    console.log(`${"╚" + "═".repeat(58) + "╝"}\n`);

    console.log(`📊 Tournament Summary:`);
    console.log(`   Total Hands: ${this.round}`);
    console.log(`   Final Level: ${this.levelIndex + 1} (${this.currentLevel.small}/${this.currentLevel.big})`);
    console.log(`   Prize Pool: $${this.prizePool}`);

    console.log(`\n${"─".repeat(60)}`);
    console.log(`🏆 FINAL STANDINGS & PAYOUTS`);
    console.log(`${"─".repeat(60)}\n`);

    // Sort all agents by final rank
    const sorted = [...this.agents].sort((a, b) => a.finalRank - b.finalRank);

    for (const agent of sorted) {
      const medal = agent.finalRank === 1 ? "🥇" : agent.finalRank === 2 ? "🥈" : agent.finalRank === 3 ? "🥉" : `${agent.finalRank}.`;
      const prizeStr = agent.prize > 0 ? `💰 $${agent.prize}` : "";
      const status = agent.isEliminated ? `(out hand ${agent.eliminatedRound}, level ${agent.eliminatedLevel})` : `WINNER`;

      console.log(`${medal} ${agent.name.padEnd(22)} ${status.padEnd(25)} ${prizeStr}`);
      console.log(`   Hands: ${agent.stats.handsPlayed} | Won: ${agent.stats.handsWon} | Lost: ${agent.stats.handsLost} | Push: ${agent.stats.pushes}`);
      console.log(`   Win Rate: ${agent.stats.handsPlayed > 0 ? ((agent.stats.handsWon / agent.stats.handsPlayed) * 100).toFixed(1) : 0}%`);
      console.log(`   Blackjacks: ${agent.stats.blackjacks} | Doubles: ${agent.stats.doubles} | Splits: ${agent.stats.splits}`);
      console.log(`   Blinds Paid: $${agent.stats.blindsPaid} | Antes Paid: $${agent.stats.antesPaid}`);
      console.log(`   Peak Chips: $${agent.stats.peakChips} | Total Wagered: $${agent.stats.totalWagered}`);

      // ROI calculation
      const roi = ((agent.prize - this.options.buyIn) / this.options.buyIn * 100).toFixed(1);
      if (agent.prize > 0) {
        console.log(`   ROI: ${roi}%`);
      }
      console.log();
    }

    // Winner announcement
    const winner = sorted[0];
    if (winner) {
      console.log(`${"═".repeat(60)}`);
      console.log(`🏆 CHAMPION: ${winner.name}`);
      console.log(`   Prize: $${winner.prize} (${(this.payouts[0] * 100).toFixed(0)}% of pool)`);
      console.log(`   ROI: ${((winner.prize - this.options.buyIn) / this.options.buyIn * 100).toFixed(0)}%`);
      console.log(`${"═".repeat(60)}`);
    }
  }
}
