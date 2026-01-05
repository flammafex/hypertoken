/**
 * Elimination Tournament for Blackjack
 *
 * Players compete at a shared table against the same dealer.
 * When a player's bankroll hits zero, they're eliminated.
 * Last player standing wins.
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

export class EliminationTournament {
  constructor(agents, options = {}) {
    this.options = {
      initialBankroll: options.initialBankroll ?? 1000,
      minBet: options.minBet ?? 10,
      maxBet: options.maxBet ?? 500,
      numDecks: options.numDecks ?? 6,
      seed: options.seed ?? null,
      maxRounds: options.maxRounds ?? 1000,
      verbose: options.verbose ?? false
    };

    this.agents = agents.map(a => ({
      strategy: a,
      name: a.name,
      isEliminated: false,
      eliminatedRound: null,
      finalRank: null,
      stats: {
        handsPlayed: 0,
        handsWon: 0,
        handsLost: 0,
        pushes: 0,
        blackjacks: 0,
        doubles: 0,
        splits: 0,
        peakBankroll: this.options.initialBankroll,
        totalWagered: 0
      }
    }));

    this.eliminationOrder = [];
    this.round = 0;
    this.engine = null;
    this.game = null;
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
      initialBankroll: this.options.initialBankroll,
      numStacks: this.options.numDecks,
      seed: this.options.seed
    });
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
      currentBet: engineAgent.resources.currentBet
    };
  }

  /**
   * Calculate bet size for an agent
   */
  calculateBet(agentInfo) {
    const engineAgent = this.getEngineAgent(agentInfo.name);
    if (!engineAgent) return this.options.minBet;

    // If agent has a getBetSize method, use it
    if (agentInfo.strategy.getBetSize) {
      const bet = agentInfo.strategy.getBetSize({
        bankroll: engineAgent.resources.bankroll,
        minBet: this.options.minBet,
        maxBet: this.options.maxBet
      });
      return Math.min(Math.max(bet, this.options.minBet), this.options.maxBet, engineAgent.resources.bankroll);
    }

    // Default: bet minimum or 10% of bankroll, whichever is larger (up to max)
    const percentBet = Math.floor(engineAgent.resources.bankroll * 0.1);
    return Math.min(Math.max(percentBet, this.options.minBet), this.options.maxBet, engineAgent.resources.bankroll);
  }

  /**
   * Play a single round of the tournament
   */
  async playRound() {
    this.round++;
    const activePlayers = this.getActivePlayers();

    if (activePlayers.length <= 1) {
      return false; // Tournament over
    }

    if (this.options.verbose) {
      console.log(`\n${"═".repeat(60)}`);
      console.log(`ROUND ${this.round} - ${activePlayers.length} players remaining`);
      console.log(`${"═".repeat(60)}`);
    }

    // Set bets for all active players
    for (const agentInfo of activePlayers) {
      const engineAgent = this.getEngineAgent(agentInfo.name);
      if (engineAgent && engineAgent.resources.bankroll > 0) {
        const bet = this.calculateBet(agentInfo);
        engineAgent.resources.currentBet = bet;
        agentInfo.stats.totalWagered += bet;

        if (this.options.verbose) {
          console.log(`${agentInfo.name} bets $${bet} (bankroll: $${engineAgent.resources.bankroll})`);
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
    this.checkEliminations();

    // Reset for next round
    this.engine.space.collectAllInto(this.engine.stack);

    // Reshuffle if needed
    if (this.engine.stack.size < 52) {
      this.engine.stack.shuffle();
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
    const maxActions = 10; // Safety limit

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
          // Simulate being the active agent
          const currentActiveIdx = this.engine.loop.activeAgentIndex;
          const agentIdx = this.engine._agents.findIndex(a => a.name === agentInfo.name);
          this.engine.session.change("set active", doc => {
            doc.gameLoop.activeAgentIndex = agentIdx;
          });

          this.game.hit();
          agentInfo.stats.handsPlayed; // Will be counted at end

          // Check if busted
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
            agentInfo.stats.totalWagered += engineAgent.resources.currentBet / 2; // Half was already counted
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
          // Continue playing split hands...
          // For simplicity, treat as stand after split
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

      // Track peak bankroll
      if (engineAgent.resources.bankroll > agentInfo.stats.peakBankroll) {
        agentInfo.stats.peakBankroll = engineAgent.resources.bankroll;
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
          console.log(`${agentInfo.name}: WIN (dealer bust) - Bankroll: $${engineAgent.resources.bankroll}`);
        }
      } else if (agentBlackjack && !isBlackjack(dealerCards)) {
        agentInfo.stats.handsWon++;
        if (this.options.verbose) {
          console.log(`${agentInfo.name}: BLACKJACK! - Bankroll: $${engineAgent.resources.bankroll}`);
        }
      } else if (agentValue > dealerValue) {
        agentInfo.stats.handsWon++;
        if (this.options.verbose) {
          console.log(`${agentInfo.name}: WIN (${agentValue} vs ${dealerValue}) - Bankroll: $${engineAgent.resources.bankroll}`);
        }
      } else if (agentValue < dealerValue) {
        agentInfo.stats.handsLost++;
        if (this.options.verbose) {
          console.log(`${agentInfo.name}: LOSE (${agentValue} vs ${dealerValue}) - Bankroll: $${engineAgent.resources.bankroll}`);
        }
      } else {
        agentInfo.stats.pushes++;
        if (this.options.verbose) {
          console.log(`${agentInfo.name}: PUSH - Bankroll: $${engineAgent.resources.bankroll}`);
        }
      }
    }
  }

  /**
   * Check for eliminated players
   */
  checkEliminations() {
    for (const agentInfo of this.getActivePlayers()) {
      const engineAgent = this.getEngineAgent(agentInfo.name);

      if (!engineAgent || engineAgent.resources.bankroll < this.options.minBet) {
        agentInfo.isEliminated = true;
        agentInfo.eliminatedRound = this.round;
        this.eliminationOrder.push(agentInfo);

        console.log(`\n💀 ${agentInfo.name} ELIMINATED in round ${this.round}!`);
        console.log(`   Played ${agentInfo.stats.handsPlayed} hands, Won ${agentInfo.stats.handsWon}`);
      }
    }
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

    // Players
    for (const agentInfo of this.getActivePlayers()) {
      const engineAgent = this.getEngineAgent(agentInfo.name);
      if (!engineAgent) continue;

      const cards = this.engine.space.zone(engineAgent.handZone).map(p => p.tokenSnapshot);
      const value = getBestHandValue(cards);
      console.log(`  ${agentInfo.name}: ${cards.map(c => c.label).join(", ")} = ${value} (bet: $${engineAgent.resources.currentBet})`);
    }
  }

  /**
   * Run the full tournament
   */
  async run() {
    console.log(`\n${"╔" + "═".repeat(58) + "╗"}`);
    console.log(`║${" ".repeat(15)}ELIMINATION TOURNAMENT${" ".repeat(21)}║`);
    console.log(`${"╚" + "═".repeat(58) + "╝"}\n`);

    console.log(`Players: ${this.agents.length}`);
    console.log(`Starting bankroll: $${this.options.initialBankroll}`);
    console.log(`Min bet: $${this.options.minBet}`);
    console.log(`Decks: ${this.options.numDecks}`);
    console.log(`\nParticipants:`);
    for (const agent of this.agents) {
      console.log(`  - ${agent.name}`);
    }

    // Initialize game
    this.initGame();

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
        const bankrolls = remaining.map(a => {
          const ea = this.getEngineAgent(a.name);
          return `${a.name}: $${ea?.resources.bankroll ?? 0}`;
        }).join(" | ");
        console.log(`Round ${this.round}: ${remaining.length} players - ${bankrolls}`);
      }
    }

    // Determine final rankings
    this.calculateFinalRankings();
    this.printResults();
  }

  /**
   * Calculate final rankings
   */
  calculateFinalRankings() {
    // Remaining players ranked by bankroll
    const remaining = this.getActivePlayers();
    remaining.sort((a, b) => {
      const bankrollA = this.getEngineAgent(a.name)?.resources.bankroll ?? 0;
      const bankrollB = this.getEngineAgent(b.name)?.resources.bankroll ?? 0;
      return bankrollB - bankrollA;
    });

    // Assign ranks
    let rank = 1;
    for (const agent of remaining) {
      agent.finalRank = rank++;
    }

    // Eliminated players get reverse elimination order ranks
    for (let i = this.eliminationOrder.length - 1; i >= 0; i--) {
      this.eliminationOrder[i].finalRank = rank++;
    }
  }

  /**
   * Print tournament results
   */
  printResults() {
    console.log(`\n${"╔" + "═".repeat(58) + "╗"}`);
    console.log(`║${" ".repeat(17)}TOURNAMENT RESULTS${" ".repeat(23)}║`);
    console.log(`${"╚" + "═".repeat(58) + "╝"}\n`);

    console.log(`Total Rounds: ${this.round}`);
    console.log(`\n${"─".repeat(60)}`);
    console.log(`FINAL STANDINGS`);
    console.log(`${"─".repeat(60)}\n`);

    // Sort all agents by final rank
    const sorted = [...this.agents].sort((a, b) => a.finalRank - b.finalRank);

    for (const agent of sorted) {
      const medal = agent.finalRank === 1 ? "🥇" : agent.finalRank === 2 ? "🥈" : agent.finalRank === 3 ? "🥉" : `${agent.finalRank}.`;
      const engineAgent = this.getEngineAgent(agent.name);
      const finalBankroll = engineAgent?.resources.bankroll ?? 0;
      const status = agent.isEliminated ? `(eliminated round ${agent.eliminatedRound})` : `$${finalBankroll}`;

      console.log(`${medal} ${agent.name.padEnd(25)} ${status}`);
      console.log(`   Hands: ${agent.stats.handsPlayed} | Won: ${agent.stats.handsWon} | Lost: ${agent.stats.handsLost} | Push: ${agent.stats.pushes}`);
      console.log(`   Win Rate: ${agent.stats.handsPlayed > 0 ? ((agent.stats.handsWon / agent.stats.handsPlayed) * 100).toFixed(1) : 0}%`);
      console.log(`   Blackjacks: ${agent.stats.blackjacks} | Doubles: ${agent.stats.doubles} | Splits: ${agent.stats.splits}`);
      console.log(`   Peak Bankroll: $${agent.stats.peakBankroll} | Total Wagered: $${agent.stats.totalWagered}`);
      console.log();
    }

    // Winner announcement
    const winner = sorted[0];
    if (winner) {
      console.log(`${"═".repeat(60)}`);
      console.log(`🏆 WINNER: ${winner.name}`);
      if (!winner.isEliminated) {
        const engineAgent = this.getEngineAgent(winner.name);
        console.log(`   Final Bankroll: $${engineAgent?.resources.bankroll ?? 0}`);
      }
      console.log(`${"═".repeat(60)}`);
    }
  }
}
