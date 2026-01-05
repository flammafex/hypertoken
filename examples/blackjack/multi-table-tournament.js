/**
 * Multi-Table Tournament (MTT) for Blackjack
 *
 * Large-scale tournament with:
 * - Multiple tables running in parallel
 * - Table balancing when players are eliminated
 * - Player movement between tables
 * - Final table transition when down to one table
 * - Escalating blinds across all tables
 * - Prize pool with tiered payouts
 */

import { Engine } from '../../engine/Engine.js';
import { MultiagentBlackjackGame } from './multiagent-game.js';
import {
  getBestHandValue,
  isBusted,
  isBlackjack,
  canDoubleDown,
  canSplit
} from './blackjack-utils.js';

// Default blind structure for MTT (longer levels for larger field)
const DEFAULT_BLIND_LEVELS = [
  { small: 10, big: 20, ante: 0, duration: 15 },
  { small: 15, big: 30, ante: 0, duration: 15 },
  { small: 25, big: 50, ante: 0, duration: 15 },
  { small: 50, big: 100, ante: 0, duration: 15 },
  { small: 75, big: 150, ante: 0, duration: 15 },
  { small: 100, big: 200, ante: 25, duration: 15 },
  { small: 150, big: 300, ante: 25, duration: 15 },
  { small: 200, big: 400, ante: 50, duration: 15 },
  { small: 300, big: 600, ante: 50, duration: 15 },
  { small: 400, big: 800, ante: 100, duration: 15 },
  { small: 500, big: 1000, ante: 100, duration: 15 },
  { small: 750, big: 1500, ante: 150, duration: 15 },
  { small: 1000, big: 2000, ante: 200, duration: 15 },
  { small: 1500, big: 3000, ante: 300, duration: 15 },
  { small: 2000, big: 4000, ante: 400, duration: 15 }
];

// MTT payout structures based on field size
const MTT_PAYOUT_STRUCTURES = {
  // 10-18 players: top 3 paid
  small: {
    minPlayers: 10,
    paidPlaces: 3,
    payouts: [0.50, 0.30, 0.20]
  },
  // 19-27 players: top 5 paid
  medium: {
    minPlayers: 19,
    paidPlaces: 5,
    payouts: [0.40, 0.25, 0.15, 0.12, 0.08]
  },
  // 28-45 players: top 7 paid
  large: {
    minPlayers: 28,
    paidPlaces: 7,
    payouts: [0.35, 0.20, 0.14, 0.10, 0.08, 0.07, 0.06]
  },
  // 46+ players: top 10 paid
  xlarge: {
    minPlayers: 46,
    paidPlaces: 10,
    payouts: [0.30, 0.18, 0.12, 0.09, 0.07, 0.06, 0.05, 0.05, 0.04, 0.04]
  }
};

/**
 * Represents a single table in the tournament
 */
class TableInstance {
  constructor(tableId, players, options) {
    this.tableId = tableId;
    this.players = players; // Array of player objects
    this.options = options;
    this.engine = null;
    this.game = null;
    this.buttonPosition = 0;
    this.isActive = true;
    this.handNumber = 0;
  }

  /**
   * Initialize the table's game engine
   */
  init() {
    this.engine = new Engine();

    const activePlayers = this.getActivePlayers();
    if (activePlayers.length < 2) {
      this.isActive = false;
      return;
    }

    this.game = new MultiagentBlackjackGame(this.engine, {
      isHost: true,
      numAgents: activePlayers.length,
      agentNames: activePlayers.map(p => p.name),
      initialBankroll: this.options.startingChips,
      numStacks: this.options.numDecks,
      seed: this.options.seed ? this.options.seed + this.tableId : null
    });

    // Restore chip counts for existing players
    for (const player of activePlayers) {
      const engineAgent = this.getEngineAgent(player.name);
      if (engineAgent && player.chips !== undefined) {
        engineAgent.resources.bankroll = player.chips;
      }
    }
  }

  /**
   * Reinitialize after player changes
   */
  reinit() {
    // Save chip counts
    for (const player of this.players) {
      if (!player.isEliminated) {
        const engineAgent = this.getEngineAgent(player.name);
        if (engineAgent) {
          player.chips = engineAgent.resources.bankroll;
        }
      }
    }
    this.init();
  }

  getEngineAgent(name) {
    if (!this.engine) return null;
    return this.engine._agents.find(a => a.name === name);
  }

  getActivePlayers() {
    return this.players.filter(p => !p.isEliminated);
  }

  getPlayerCount() {
    return this.getActivePlayers().length;
  }

  /**
   * Add a player to this table (from balancing)
   */
  addPlayer(player) {
    this.players.push(player);
    player.tableId = this.tableId;
  }

  /**
   * Remove a player from this table (for balancing)
   */
  removePlayer(playerName) {
    const idx = this.players.findIndex(p => p.name === playerName);
    if (idx >= 0) {
      const player = this.players[idx];
      this.players.splice(idx, 1);
      return player;
    }
    return null;
  }

  /**
   * Get the small blind position
   */
  getSmallBlindPosition() {
    const activePlayers = this.getActivePlayers();
    if (activePlayers.length <= 2) {
      return this.buttonPosition;
    }
    return (this.buttonPosition + 1) % activePlayers.length;
  }

  /**
   * Get the big blind position
   */
  getBigBlindPosition() {
    const activePlayers = this.getActivePlayers();
    if (activePlayers.length <= 2) {
      return (this.buttonPosition + 1) % activePlayers.length;
    }
    return (this.buttonPosition + 2) % activePlayers.length;
  }

  /**
   * Move the button
   */
  moveButton() {
    const activePlayers = this.getActivePlayers();
    if (activePlayers.length > 0) {
      this.buttonPosition = (this.buttonPosition + 1) % activePlayers.length;
    }
  }
}

/**
 * Multi-Table Tournament Manager
 */
export class MultiTableTournament {
  constructor(agents, options = {}) {
    this.options = {
      buyIn: options.buyIn ?? 100,
      startingChips: options.startingChips ?? 3000,
      blindLevels: options.blindLevels ?? DEFAULT_BLIND_LEVELS,
      playersPerTable: options.playersPerTable ?? 6,
      finalTableSize: options.finalTableSize ?? 9,
      numDecks: options.numDecks ?? 6,
      seed: options.seed ?? null,
      maxRounds: options.maxRounds ?? 1000,
      verbose: options.verbose ?? false,
      showTableUpdates: options.showTableUpdates ?? true,
      showBalancing: options.showBalancing ?? true
    };

    // Calculate prize pool
    this.prizePool = agents.length * this.options.buyIn;
    this.totalPlayers = agents.length;

    // Determine payout structure
    this.payoutStructure = this.getPayoutStructure(agents.length);

    // Create player objects
    this.players = agents.map((a, idx) => ({
      strategy: a,
      name: a.name,
      playerId: idx,
      tableId: null,
      chips: this.options.startingChips,
      isEliminated: false,
      eliminatedHand: null,
      eliminatedLevel: null,
      finalRank: null,
      prize: 0,
      tablesMoved: 0,
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

    this.tables = [];
    this.eliminationOrder = [];
    this.globalHandNumber = 0;
    this.levelIndex = 0;
    this.handsAtLevel = 0;
    this.isFinalTable = false;
    this.balancingEvents = [];
  }

  /**
   * Get current blind level
   */
  get currentLevel() {
    return this.options.blindLevels[this.levelIndex] ||
           this.options.blindLevels[this.options.blindLevels.length - 1];
  }

  /**
   * Get payout structure based on field size
   */
  getPayoutStructure(playerCount) {
    if (playerCount >= MTT_PAYOUT_STRUCTURES.xlarge.minPlayers) {
      return MTT_PAYOUT_STRUCTURES.xlarge;
    } else if (playerCount >= MTT_PAYOUT_STRUCTURES.large.minPlayers) {
      return MTT_PAYOUT_STRUCTURES.large;
    } else if (playerCount >= MTT_PAYOUT_STRUCTURES.medium.minPlayers) {
      return MTT_PAYOUT_STRUCTURES.medium;
    } else {
      return MTT_PAYOUT_STRUCTURES.small;
    }
  }

  /**
   * Create initial tables and distribute players
   */
  createTables() {
    const perTable = this.options.playersPerTable;
    const numTables = Math.ceil(this.players.length / perTable);

    // Shuffle players for random seating
    const shuffledPlayers = [...this.players].sort(() => Math.random() - 0.5);

    // Distribute players evenly across tables
    for (let t = 0; t < numTables; t++) {
      const tablePlayers = [];
      for (let i = t; i < shuffledPlayers.length; i += numTables) {
        const player = shuffledPlayers[i];
        player.tableId = t;
        tablePlayers.push(player);
      }

      const table = new TableInstance(t, tablePlayers, {
        startingChips: this.options.startingChips,
        numDecks: this.options.numDecks,
        seed: this.options.seed
      });

      this.tables.push(table);
    }

    // Initialize all tables
    for (const table of this.tables) {
      table.init();
    }
  }

  /**
   * Get all active (non-eliminated) players across all tables
   */
  getActivePlayers() {
    return this.players.filter(p => !p.isEliminated);
  }

  /**
   * Get active tables (with 2+ players)
   */
  getActiveTables() {
    return this.tables.filter(t => t.isActive && t.getPlayerCount() >= 2);
  }

  /**
   * Check if blinds should increase
   */
  checkBlindIncrease() {
    if (this.handsAtLevel >= this.currentLevel.duration) {
      const previousLevel = this.currentLevel;
      this.levelIndex++;
      this.handsAtLevel = 0;

      if (this.options.showTableUpdates) {
        console.log(`\n⬆️  BLIND LEVEL UP! Level ${this.levelIndex + 1}`);
        console.log(`   Blinds: ${this.currentLevel.small}/${this.currentLevel.big}${this.currentLevel.ante ? ` + ${this.currentLevel.ante} ante` : ''}`);
        console.log(`   (was: ${previousLevel.small}/${previousLevel.big})`);
      }
    }
  }

  /**
   * Check if we should transition to final table
   */
  shouldTransitionToFinalTable() {
    const activePlayers = this.getActivePlayers();
    const activeTables = this.getActiveTables();

    return !this.isFinalTable &&
           activePlayers.length <= this.options.finalTableSize &&
           activeTables.length > 1;
  }

  /**
   * Transition to final table
   */
  transitionToFinalTable() {
    console.log(`\n${"═".repeat(60)}`);
    console.log(`🏆 FINAL TABLE! ${this.getActivePlayers().length} players remaining`);
    console.log(`${"═".repeat(60)}\n`);

    this.isFinalTable = true;

    // Collect all active players
    const activePlayers = this.getActivePlayers();

    // Create new final table
    const finalTable = new TableInstance(0, activePlayers, {
      startingChips: this.options.startingChips,
      numDecks: this.options.numDecks,
      seed: this.options.seed
    });

    // Update player table assignments
    for (const player of activePlayers) {
      player.tableId = 0;
    }

    // Replace tables array with just the final table
    this.tables = [finalTable];
    finalTable.init();

    // Print final table seating
    console.log(`Final Table Seating:`);
    const sorted = [...activePlayers].sort((a, b) => b.chips - a.chips);
    for (let i = 0; i < sorted.length; i++) {
      const p = sorted[i];
      console.log(`   Seat ${i + 1}: ${p.name.padEnd(20)} ${String(p.chips).padStart(8)} chips`);
    }
    console.log();
  }

  /**
   * Balance tables after eliminations
   */
  balanceTables() {
    const activeTables = this.getActiveTables();
    if (activeTables.length <= 1) return;

    // Get table sizes
    const tableSizes = activeTables.map(t => ({
      table: t,
      count: t.getPlayerCount()
    }));

    // Sort by size (descending)
    tableSizes.sort((a, b) => b.count - a.count);

    const largest = tableSizes[0];
    const smallest = tableSizes[tableSizes.length - 1];

    // Balance if difference > 1
    while (largest.count - smallest.count > 1) {
      // Find player to move from largest table
      const playersAtLargest = largest.table.getActivePlayers();

      // Select player who was most recently moved or random
      const playerToMove = playersAtLargest.reduce((best, p) =>
        !best || p.tablesMoved < best.tablesMoved ? p : best, null);

      if (!playerToMove) break;

      // Save chip count before removal
      const engineAgent = largest.table.getEngineAgent(playerToMove.name);
      if (engineAgent) {
        playerToMove.chips = engineAgent.resources.bankroll;
      }

      // Move player
      largest.table.removePlayer(playerToMove.name);
      smallest.table.addPlayer(playerToMove);
      playerToMove.tablesMoved++;

      this.balancingEvents.push({
        hand: this.globalHandNumber,
        player: playerToMove.name,
        fromTable: largest.table.tableId,
        toTable: smallest.table.tableId,
        chips: playerToMove.chips
      });

      if (this.options.showBalancing) {
        console.log(`\n🔄 TABLE BALANCE: ${playerToMove.name} moved from Table ${largest.table.tableId + 1} → Table ${smallest.table.tableId + 1}`);
      }

      // Recalculate
      largest.count = largest.table.getPlayerCount();
      smallest.count = smallest.table.getPlayerCount();

      // Resort
      tableSizes.sort((a, b) => b.count - a.count);
    }

    // Reinitialize tables that changed
    for (const table of activeTables) {
      if (table.getPlayerCount() >= 2) {
        table.reinit();
      }
    }

    // Check for tables that need to be collapsed
    this.collapseTables();
  }

  /**
   * Collapse tables with too few players
   */
  collapseTables() {
    const activeTables = this.getActiveTables();

    for (const table of this.tables) {
      if (table.getPlayerCount() < 2 && table.getPlayerCount() > 0) {
        // Move remaining player(s) to another table
        const playersToMove = table.getActivePlayers();

        for (const player of playersToMove) {
          // Save chips
          const engineAgent = table.getEngineAgent(player.name);
          if (engineAgent) {
            player.chips = engineAgent.resources.bankroll;
          }

          // Find smallest active table
          const targetTable = this.getActiveTables()
            .filter(t => t !== table)
            .sort((a, b) => a.getPlayerCount() - b.getPlayerCount())[0];

          if (targetTable) {
            table.removePlayer(player.name);
            targetTable.addPlayer(player);
            player.tablesMoved++;

            if (this.options.showBalancing) {
              console.log(`\n📦 TABLE COLLAPSE: ${player.name} moved to Table ${targetTable.tableId + 1} (Table ${table.tableId + 1} closed)`);
            }
          }
        }

        table.isActive = false;
      }
    }

    // Reinit affected tables
    for (const table of this.getActiveTables()) {
      table.reinit();
    }
  }

  /**
   * Build game state for an agent's decision
   */
  buildAgentGameState(player, table) {
    const engineAgent = table.getEngineAgent(player.name);
    if (!engineAgent) return null;

    const handZone = engineAgent.handZone;
    const agentCards = table.engine.space.zone(handZone).map(p => p.tokenSnapshot);
    const dealerCards = table.engine.space.zone("dealer-hand").map(p => p.tokenSnapshot);

    const dealerVisible = table.engine.space.zone("dealer-hand")
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
      blindLevel: this.levelIndex + 1,
      smallBlind: this.currentLevel.small,
      bigBlind: this.currentLevel.big,
      ante: this.currentLevel.ante,
      playersRemaining: this.getActivePlayers().length,
      tablesRemaining: this.getActiveTables().length,
      isFinalTable: this.isFinalTable
    };
  }

  /**
   * Calculate bet size for a player
   */
  calculateBet(player, table) {
    const engineAgent = table.getEngineAgent(player.name);
    if (!engineAgent) return this.currentLevel.big;

    const minBet = this.currentLevel.big;
    const maxBet = engineAgent.resources.bankroll;

    if (player.strategy.getBetSize) {
      const bet = player.strategy.getBetSize({
        bankroll: engineAgent.resources.bankroll,
        minBet,
        maxBet,
        blindLevel: this.levelIndex + 1,
        smallBlind: this.currentLevel.small,
        bigBlind: this.currentLevel.big
      });
      return Math.min(Math.max(bet, minBet), maxBet);
    }

    // Default betting
    const chipMultiple = engineAgent.resources.bankroll / this.currentLevel.big;
    if (chipMultiple < 10) return Math.min(minBet * 2, maxBet);
    return Math.min(minBet * 2.5, maxBet);
  }

  /**
   * Play a single hand at a specific table
   */
  async playTableHand(table) {
    table.handNumber++;
    const activePlayers = table.getActivePlayers();

    if (activePlayers.length < 2) {
      table.isActive = false;
      return { eliminations: [] };
    }

    const level = this.currentLevel;
    const sbPos = table.getSmallBlindPosition();
    const bbPos = table.getBigBlindPosition();

    const sbPlayer = activePlayers[sbPos];
    const bbPlayer = activePlayers[bbPos];

    const sbAgent = table.getEngineAgent(sbPlayer.name);
    const bbAgent = table.getEngineAgent(bbPlayer.name);

    // Post blinds
    const sbAmount = Math.min(level.small, sbAgent.resources.bankroll);
    sbAgent.resources.bankroll -= sbAmount;
    sbPlayer.stats.blindsPaid += sbAmount;
    sbPlayer.stats.totalWagered += sbAmount;

    const bbAmount = Math.min(level.big, bbAgent.resources.bankroll);
    bbAgent.resources.bankroll -= bbAmount;
    bbPlayer.stats.blindsPaid += bbAmount;
    bbPlayer.stats.totalWagered += bbAmount;

    sbAgent.resources.currentBet = sbAmount;
    bbAgent.resources.currentBet = bbAmount;

    // Post antes
    if (level.ante > 0) {
      for (const player of activePlayers) {
        const agent = table.getEngineAgent(player.name);
        if (agent && agent.resources.bankroll > 0) {
          const anteAmount = Math.min(level.ante, agent.resources.bankroll);
          agent.resources.bankroll -= anteAmount;
          player.stats.antesPaid += anteAmount;
          player.stats.totalWagered += anteAmount;
        }
      }
    }

    // Set bets for non-blind players
    for (const player of activePlayers) {
      if (player !== sbPlayer && player !== bbPlayer) {
        const agent = table.getEngineAgent(player.name);
        if (agent && agent.resources.bankroll > 0) {
          const bet = this.calculateBet(player, table);
          const actualBet = Math.min(bet, agent.resources.bankroll);
          agent.resources.bankroll -= actualBet;
          agent.resources.currentBet = actualBet;
          player.stats.totalWagered += actualBet;
        }
      }
    }

    // Deal cards
    table.game.deal();

    // Each player takes their turn
    for (const player of activePlayers) {
      const engineAgent = table.getEngineAgent(player.name);
      if (!engineAgent || engineAgent.resources.currentBet === 0) continue;

      const gameState = this.buildAgentGameState(player, table);
      if (!gameState || gameState.agentHand.busted || gameState.agentHand.blackjack) {
        if (gameState?.agentHand.blackjack) {
          player.stats.blackjacks++;
        }
        continue;
      }

      await this.playPlayerTurn(player, table);
    }

    // Dealer plays
    table.game.playDealer();

    // Record results
    const eliminations = this.recordTableResults(table);

    // Move button
    table.moveButton();

    // Reset for next hand
    table.engine.space.collectAllInto(table.engine.stack);
    if (table.engine.stack.size < 52) {
      table.engine.stack.shuffle();
    }

    return { eliminations };
  }

  /**
   * Play a player's turn
   */
  async playPlayerTurn(player, table) {
    const engineAgent = table.getEngineAgent(player.name);
    if (!engineAgent) return;

    let continuePlay = true;
    let actions = 0;

    while (continuePlay && actions < 10) {
      actions++;
      const gameState = this.buildAgentGameState(player, table);

      if (!gameState || gameState.agentHand.busted || gameState.agentHand.blackjack) {
        break;
      }

      const decision = player.strategy.decide(gameState);

      switch (decision.toLowerCase()) {
        case 'hit':
          const agentIdx = table.engine._agents.findIndex(a => a.name === player.name);
          table.engine.session.change("set active", doc => {
            doc.gameLoop.activeAgentIndex = agentIdx;
          });
          table.game.hit();

          const afterHit = this.buildAgentGameState(player, table);
          if (afterHit?.agentHand.busted) {
            continuePlay = false;
          }
          break;

        case 'stand':
          continuePlay = false;
          break;

        case 'double':
          if (gameState.canDouble) {
            const agentIdx = table.engine._agents.findIndex(a => a.name === player.name);
            table.engine.session.change("set active", doc => {
              doc.gameLoop.activeAgentIndex = agentIdx;
            });
            table.game.doubleDown();
            player.stats.doubles++;
            player.stats.totalWagered += engineAgent.resources.currentBet / 2;
          }
          continuePlay = false;
          break;

        case 'split':
          if (gameState.canSplit) {
            const agentIdx = table.engine._agents.findIndex(a => a.name === player.name);
            table.engine.session.change("set active", doc => {
              doc.gameLoop.activeAgentIndex = agentIdx;
            });
            table.game.split();
            player.stats.splits++;
            player.stats.totalWagered += engineAgent.resources.currentBet;
          }
          continuePlay = false;
          break;

        default:
          continuePlay = false;
      }
    }
  }

  /**
   * Record results after a hand
   */
  recordTableResults(table) {
    const dealerCards = table.engine.space.zone("dealer-hand").map(p => p.tokenSnapshot);
    const dealerValue = getBestHandValue(dealerCards);
    const dealerBusted = isBusted(dealerCards);
    const eliminations = [];

    for (const player of table.getActivePlayers()) {
      const engineAgent = table.getEngineAgent(player.name);
      if (!engineAgent) continue;

      const handZone = engineAgent.handZone;
      const agentCards = table.engine.space.zone(handZone).map(p => p.tokenSnapshot);
      const agentValue = getBestHandValue(agentCards);
      const agentBusted = isBusted(agentCards);
      const agentBlackjack = isBlackjack(agentCards);

      player.stats.handsPlayed++;
      player.chips = engineAgent.resources.bankroll;

      // Track peak chips
      if (player.chips > player.stats.peakChips) {
        player.stats.peakChips = player.chips;
      }

      // Determine result
      if (agentBusted) {
        player.stats.handsLost++;
      } else if (dealerBusted) {
        player.stats.handsWon++;
      } else if (agentBlackjack && !isBlackjack(dealerCards)) {
        player.stats.handsWon++;
      } else if (agentValue > dealerValue) {
        player.stats.handsWon++;
      } else if (agentValue < dealerValue) {
        player.stats.handsLost++;
      } else {
        player.stats.pushes++;
      }

      // Check for elimination
      if (player.chips < this.currentLevel.big) {
        player.isEliminated = true;
        player.eliminatedHand = this.globalHandNumber;
        player.eliminatedLevel = this.levelIndex + 1;
        this.eliminationOrder.push(player);
        eliminations.push(player);
      }
    }

    return eliminations;
  }

  /**
   * Play one round across all tables
   */
  async playRound() {
    this.globalHandNumber++;
    this.handsAtLevel++;

    // Check blind increase
    this.checkBlindIncrease();

    // Check for final table transition
    if (this.shouldTransitionToFinalTable()) {
      this.transitionToFinalTable();
    }

    const activeTables = this.getActiveTables();
    if (activeTables.length === 0) return false;

    const activeCount = this.getActivePlayers().length;
    if (activeCount <= 1) return false;

    // Play hand at each table
    let allEliminations = [];
    for (const table of activeTables) {
      const result = await this.playTableHand(table);
      allEliminations = allEliminations.concat(result.eliminations);
    }

    // Handle eliminations
    for (const player of allEliminations) {
      const rank = this.totalPlayers - this.eliminationOrder.length + 1;
      const inMoney = rank <= this.payoutStructure.paidPlaces;

      if (this.options.verbose || inMoney) {
        console.log(`\n💀 ${player.name} ELIMINATED!`);
        console.log(`   Hand ${this.globalHandNumber} | Level ${this.levelIndex + 1} | Table ${player.tableId + 1}`);
        console.log(`   Finish: ${this.getOrdinal(this.eliminationOrder.length)} of ${this.totalPlayers}`);

        if (inMoney) {
          const prize = Math.floor(this.prizePool * this.payoutStructure.payouts[rank - 1]);
          console.log(`   🎉 IN THE MONEY! Prize: $${prize}`);
        }
      }
    }

    // Balance tables after eliminations
    if (allEliminations.length > 0 && !this.isFinalTable) {
      this.balanceTables();
    }

    return true;
  }

  /**
   * Get ordinal suffix
   */
  getOrdinal(n) {
    const s = ["th", "st", "nd", "rd"];
    const v = n % 100;
    return n + (s[(v - 20) % 10] || s[v] || s[0]);
  }

  /**
   * Print tournament status
   */
  printStatus() {
    const activePlayers = this.getActivePlayers();
    const activeTables = this.getActiveTables();

    console.log(`\n${"─".repeat(60)}`);
    console.log(`Hand ${this.globalHandNumber} | Level ${this.levelIndex + 1} (${this.currentLevel.small}/${this.currentLevel.big}) | ${activePlayers.length} players | ${activeTables.length} tables`);

    for (const table of activeTables) {
      const players = table.getActivePlayers()
        .map(p => `${p.name}: $${p.chips}`)
        .join(' | ');
      console.log(`   Table ${table.tableId + 1}: ${players}`);
    }
  }

  /**
   * Calculate final payouts
   */
  calculatePayouts() {
    const activePlayers = this.getActivePlayers();
    let finishOrder;

    if (activePlayers.length > 0) {
      // Sort active players by chips
      activePlayers.sort((a, b) => b.chips - a.chips);
      finishOrder = [...activePlayers, ...this.eliminationOrder.slice().reverse()];
    } else {
      finishOrder = this.eliminationOrder.slice().reverse();
    }

    for (let i = 0; i < finishOrder.length; i++) {
      const player = finishOrder[i];
      if (!player) continue;

      player.finalRank = i + 1;

      if (i < this.payoutStructure.payouts.length) {
        player.prize = Math.floor(this.prizePool * this.payoutStructure.payouts[i]);
      }
    }
  }

  /**
   * Run the full tournament
   */
  async run() {
    console.log(`\n${"╔" + "═".repeat(58) + "╗"}`);
    console.log(`║${" ".repeat(12)}MULTI-TABLE TOURNAMENT${" ".repeat(24)}║`);
    console.log(`${"╚" + "═".repeat(58) + "╝"}\n`);

    console.log(`📋 Tournament Info:`);
    console.log(`   Players: ${this.totalPlayers}`);
    console.log(`   Buy-in: $${this.options.buyIn}`);
    console.log(`   Prize Pool: $${this.prizePool}`);
    console.log(`   Starting Chips: ${this.options.startingChips}`);
    console.log(`   Players per Table: ${this.options.playersPerTable}`);
    console.log(`   Final Table Size: ${this.options.finalTableSize}`);

    console.log(`\n💰 Payout Structure (${this.payoutStructure.paidPlaces} paid):`);
    for (let i = 0; i < this.payoutStructure.payouts.length; i++) {
      const prize = Math.floor(this.prizePool * this.payoutStructure.payouts[i]);
      console.log(`   ${this.getOrdinal(i + 1)}: $${prize} (${(this.payoutStructure.payouts[i] * 100).toFixed(1)}%)`);
    }

    // Create tables
    this.createTables();

    console.log(`\n🎰 Initial Table Assignments:`);
    for (const table of this.tables) {
      const names = table.players.map(p => p.name).join(', ');
      console.log(`   Table ${table.tableId + 1}: ${names}`);
    }

    console.log(`\n${"─".repeat(60)}`);
    console.log(`TOURNAMENT BEGINS!`);
    console.log(`${"─".repeat(60)}`);

    // Main tournament loop
    let continueGame = true;
    while (continueGame && this.globalHandNumber < this.options.maxRounds) {
      continueGame = await this.playRound();

      const remaining = this.getActivePlayers();
      if (remaining.length <= 1) {
        break;
      }

      // Status update every 10 hands
      if (this.options.verbose || this.globalHandNumber % 10 === 0) {
        this.printStatus();
      }
    }

    // Final results
    this.calculatePayouts();
    this.printResults();
  }

  /**
   * Print final results
   */
  printResults() {
    console.log(`\n${"╔" + "═".repeat(58) + "╗"}`);
    console.log(`║${" ".repeat(17)}TOURNAMENT RESULTS${" ".repeat(23)}║`);
    console.log(`${"╚" + "═".repeat(58) + "╝"}\n`);

    console.log(`📊 Tournament Summary:`);
    console.log(`   Total Hands: ${this.globalHandNumber}`);
    console.log(`   Final Level: ${this.levelIndex + 1} (${this.currentLevel.small}/${this.currentLevel.big})`);
    console.log(`   Prize Pool: $${this.prizePool}`);
    console.log(`   Entrants: ${this.totalPlayers}`);
    console.log(`   Tables Used: ${this.tables.length + this.balancingEvents.length > 0 ? ' (with balancing)' : ''}`);

    console.log(`\n${"─".repeat(60)}`);
    console.log(`🏆 FINAL STANDINGS & PAYOUTS`);
    console.log(`${"─".repeat(60)}\n`);

    const sorted = [...this.players].sort((a, b) => a.finalRank - b.finalRank);

    // Show paid places in detail
    for (let i = 0; i < Math.min(this.payoutStructure.paidPlaces, sorted.length); i++) {
      const player = sorted[i];
      const medal = i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : `${i + 1}.`;
      const prizeStr = player.prize > 0 ? `💰 $${player.prize}` : "";
      const status = player.isEliminated ? `(out hand ${player.eliminatedHand})` : `CHAMPION`;

      console.log(`${medal} ${player.name.padEnd(22)} ${status.padEnd(20)} ${prizeStr}`);
      console.log(`   Hands: ${player.stats.handsPlayed} | Won: ${player.stats.handsWon} | Lost: ${player.stats.handsLost}`);
      console.log(`   Peak Chips: $${player.stats.peakChips} | Tables Moved: ${player.tablesMoved}`);

      if (player.prize > 0) {
        const roi = ((player.prize - this.options.buyIn) / this.options.buyIn * 100).toFixed(0);
        console.log(`   ROI: ${roi}%`);
      }
      console.log();
    }

    // Summary of bubble and below
    if (sorted.length > this.payoutStructure.paidPlaces) {
      console.log(`${"─".repeat(40)}`);
      console.log(`Bubble and below (${sorted.length - this.payoutStructure.paidPlaces} players):`);

      for (let i = this.payoutStructure.paidPlaces; i < Math.min(sorted.length, this.payoutStructure.paidPlaces + 5); i++) {
        const player = sorted[i];
        console.log(`   ${player.finalRank}. ${player.name.padEnd(20)} (out hand ${player.eliminatedHand})`);
      }

      if (sorted.length > this.payoutStructure.paidPlaces + 5) {
        console.log(`   ... and ${sorted.length - this.payoutStructure.paidPlaces - 5} more`);
      }
    }

    // Winner announcement
    const winner = sorted[0];
    if (winner) {
      console.log(`\n${"═".repeat(60)}`);
      console.log(`🏆 CHAMPION: ${winner.name}`);
      console.log(`   Prize: $${winner.prize} (${(this.payoutStructure.payouts[0] * 100).toFixed(0)}% of pool)`);
      console.log(`   ROI: ${((winner.prize - this.options.buyIn) / this.options.buyIn * 100).toFixed(0)}%`);
      console.log(`${"═".repeat(60)}`);
    }
  }
}
