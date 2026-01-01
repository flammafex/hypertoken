#!/usr/bin/env node
/*
 * Copyright 2025 The Carpocratian Church of Commonality and Equality, Inc.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *      http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

/**
 * Accordion Solitaire
 *
 * One of the hardest solitaire games to win (estimated 1 in 1000+ games).
 *
 * RULES:
 * - Deal all 52 cards in a row, face up
 * - A card can be moved onto the card 1 position to its left OR 3 positions to its left
 * - You can only move if the cards match in RANK or SUIT
 * - Goal: Collapse all cards into a single pile
 * - Almost impossible to win, making it perfect for probability studies!
 *
 * STRATEGY:
 * - Prefer moves that create more future opportunities
 * - Look ahead to avoid blocking positions
 * - Sometimes moving 3-left is better than 1-left
 */

import { Chronicle } from '../../core/Chronicle.js';
import { Stack } from '../../core/Stack.js';
import { Token } from '../../core/Token.js';

/**
 * Create a standard 52-card deck as Token objects
 */
function createStandardDeck() {
  const suits = ['♠', '♥', '♦', '♣'];
  const ranks = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];
  const cards = [];

  for (const suit of suits) {
    for (const rank of ranks) {
      cards.push({
        id: `${suit}${rank}`,
        label: `${rank}${suit}`,
        display: `${rank}${suit}`,
        suit,
        rank,
        value: ranks.indexOf(rank) + 1
      });
    }
  }

  return cards;
}

/**
 * Accordion Solitaire Game
 */
class AccordionSolitaire {
  constructor(seed = null) {
    this.session = new Chronicle();
    this.seed = seed;

    // Create and initialize the stack
    const cards = createStandardDeck();
    this.stack = new Stack(this.session, cards, { seed });

    // The "row" of cards - this is our game state
    this.row = [];

    // Statistics
    this.moveCount = 0;

    // History for undo
    this.history = [];
  }

  /**
   * Deal all 52 cards in a row
   */
  deal() {
    // Shuffle the stack with the seed
    this.stack.shuffle();

    // Draw all 52 cards into our row
    const allCards = this.stack.draw(52);
    this.row = Array.isArray(allCards) ? allCards : [allCards];

    console.log("\n🃏 Accordion Solitaire - Cards Dealt!\n");
    this.display();
  }

  /**
   * Display the current row of cards
   */
  display() {
    console.log("Current row:");
    console.log(this.row.map((card, i) => `[${i}:${card.label}]`).join(' '));
    console.log(`\nCards remaining: ${this.row.length} | Moves: ${this.moveCount}`);

    if (this.row.length === 1) {
      console.log("\n🎉 YOU WON! All cards collapsed into one pile!");
      console.log("This is incredibly rare - congratulations!");
    }
  }

  /**
   * Check if a move is legal
   */
  canMove(fromIndex, toIndex) {
    // Valid positions
    if (fromIndex < 0 || fromIndex >= this.row.length) return false;
    if (toIndex < 0 || toIndex >= this.row.length) return false;

    // Can only move left (to lower index)
    if (toIndex >= fromIndex) return false;

    // Can only move to position 1-left or 3-left
    const distance = fromIndex - toIndex;
    if (distance !== 1 && distance !== 3) return false;

    const fromCard = this.row[fromIndex];
    const toCard = this.row[toIndex];

    // Must match rank OR suit
    return fromCard.rank === toCard.rank ||
           fromCard.suit === toCard.suit;
  }

  /**
   * Get all legal moves from current position
   */
  getLegalMoves() {
    const moves = [];

    for (let i = 0; i < this.row.length; i++) {
      // Try moving 1-left
      if (this.canMove(i, i - 1)) {
        moves.push({ from: i, to: i - 1, distance: 1 });
      }

      // Try moving 3-left
      if (this.canMove(i, i - 3)) {
        moves.push({ from: i, to: i - 3, distance: 3 });
      }
    }

    return moves;
  }

  /**
   * Make a move
   */
  move(fromIndex, toIndex) {
    if (!this.canMove(fromIndex, toIndex)) {
      throw new Error(`Illegal move: ${fromIndex} -> ${toIndex}`);
    }

    // Save state for undo
    this.history.push([...this.row]);

    // Move the card
    const card = this.row[fromIndex];

    // Remove from current position
    this.row.splice(fromIndex, 1);

    // Note: toIndex is now different because we removed a card!
    // If fromIndex > toIndex, toIndex stays the same
    // The card lands "on top" of the target position

    this.moveCount++;

    console.log(`\nMove ${this.moveCount}: ${card.label} -> ${this.row[toIndex].label}`);
    console.log(`(moved ${fromIndex - toIndex} positions left)`);
  }

  /**
   * Undo last move
   */
  undo() {
    if (this.history.length === 0) {
      console.log("No moves to undo");
      return false;
    }

    this.row = this.history.pop();
    this.moveCount--;
    console.log("Undid last move");
    return true;
  }

  /**
   * Check if game is won
   */
  isWon() {
    return this.row.length === 1;
  }

  /**
   * Check if game is stuck (no legal moves)
   */
  isStuck() {
    return this.getLegalMoves().length === 0 && !this.isWon();
  }

  /**
   * Auto-play using a simple greedy strategy
   */
  autoPlay(strategy = 'greedy') {
    while (!this.isWon() && !this.isStuck()) {
      const moves = this.getLegalMoves();

      if (moves.length === 0) break;

      let chosenMove;

      if (strategy === 'greedy') {
        // Greedy: prefer 3-left moves (more compression)
        chosenMove = moves.find(m => m.distance === 3) || moves[0];
      } else if (strategy === 'random') {
        // Random
        chosenMove = moves[Math.floor(Math.random() * moves.length)];
      } else {
        // First available
        chosenMove = moves[0];
      }

      this.move(chosenMove.from, chosenMove.to);
    }

    return this.isWon();
  }

  /**
   * Run simulation to estimate win probability
   */
  static simulate(games = 1000, strategy = 'greedy') {
    console.log(`\n🎲 Simulating ${games} games of Accordion Solitaire...`);
    console.log(`Strategy: ${strategy}\n`);

    let wins = 0;
    let totalMoves = 0;
    let bestGame = null;
    let worstGame = null;

    const finalCounts = new Array(53).fill(0); // Count of how many cards left

    for (let i = 0; i < games; i++) {
      const game = new AccordionSolitaire(i); // Seeded for reproducibility
      game.deal();

      // Suppress output during simulation
      const originalLog = console.log;
      console.log = () => {};

      game.autoPlay(strategy);

      console.log = originalLog;

      // Record stats
      const cardsLeft = game.row.length;
      finalCounts[cardsLeft]++;
      totalMoves += game.moveCount;

      if (game.isWon()) {
        wins++;
        console.log(`✓ Game ${i + 1}: WON in ${game.moveCount} moves!`);
      }

      // Track best and worst
      if (!bestGame || cardsLeft < bestGame.cardsLeft) {
        bestGame = { seed: i, cardsLeft, moves: game.moveCount };
      }
      if (!worstGame || cardsLeft > worstGame.cardsLeft) {
        worstGame = { seed: i, cardsLeft, moves: game.moveCount };
      }

      // Progress indicator
      if ((i + 1) % 100 === 0) {
        console.log(`Progress: ${i + 1}/${games} games`);
      }
    }

    // Results
    console.log("\n" + "=".repeat(60));
    console.log("SIMULATION RESULTS");
    console.log("=".repeat(60));
    console.log(`Games played: ${games}`);
    console.log(`Wins: ${wins} (${(wins / games * 100).toFixed(2)}%)`);
    console.log(`Win rate: ~1 in ${Math.round(games / Math.max(wins, 1))}`);
    console.log(`Average moves per game: ${(totalMoves / games).toFixed(1)}`);
    console.log();
    console.log(`Best result: ${bestGame.cardsLeft} cards left (seed ${bestGame.seed})`);
    console.log(`Worst result: ${worstGame.cardsLeft} cards left (seed ${worstGame.seed})`);
    console.log();

    // Distribution
    console.log("Distribution of final card counts:");
    for (let i = 1; i <= 52; i++) {
      if (finalCounts[i] > 0) {
        const percentage = (finalCounts[i] / games * 100).toFixed(1);
        const bar = "█".repeat(Math.round(finalCounts[i] / games * 50));
        console.log(`${i.toString().padStart(2)} cards: ${finalCounts[i].toString().padStart(4)} (${percentage.padStart(5)}%) ${bar}`);
      }
    }

    if (wins > 0) {
      console.log(`\n🎉 Replay winning game with: node accordion.js --seed ${bestGame.seed}`);
    }

    return { wins, games, winRate: wins / games };
  }
}

/**
 * Interactive CLI
 */
async function playCLI() {
  const readline = await import('readline');

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });

  const question = (query) => new Promise((resolve) => rl.question(query, resolve));

  const game = new AccordionSolitaire();
  game.deal();

  console.log("\nCommands:");
  console.log("  m <from> <to>  - Move card from position <from> to position <to>");
  console.log("  h              - Show legal moves (hint)");
  console.log("  u              - Undo last move");
  console.log("  a              - Auto-play (greedy strategy)");
  console.log("  q              - Quit");
  console.log();

  while (!game.isWon() && !game.isStuck()) {
    const cmd = await question("> ");
    const parts = cmd.trim().split(/\s+/);

    if (parts[0] === 'q') {
      console.log("Thanks for playing!");
      break;
    }

    if (parts[0] === 'h') {
      const moves = game.getLegalMoves();
      if (moves.length === 0) {
        console.log("No legal moves - game is stuck!");
      } else {
        console.log("Legal moves:");
        moves.forEach(m => {
          const fromCard = game.row[m.from];
          const toCard = game.row[m.to];
          console.log(`  ${m.from} -> ${m.to}: ${fromCard.label} onto ${toCard.label} (${m.distance}-left)`);
        });
      }
      continue;
    }

    if (parts[0] === 'u') {
      game.undo();
      game.display();
      continue;
    }

    if (parts[0] === 'a') {
      console.log("Auto-playing with greedy strategy...");
      game.autoPlay('greedy');
      game.display();
      continue;
    }

    if (parts[0] === 'm' && parts.length === 3) {
      const from = parseInt(parts[1]);
      const to = parseInt(parts[2]);

      try {
        game.move(from, to);
        game.display();
      } catch (error) {
        console.log("Illegal move:", error.message);
      }
      continue;
    }

    console.log("Unknown command. Type 'h' for help.");
  }

  if (game.isWon()) {
    console.log("\n🎉🎉🎉 INCREDIBLE! YOU WON! 🎉🎉🎉");
    console.log(`This happened in only ${game.moveCount} moves!`);
    console.log("You've accomplished something truly rare!");
  } else if (game.isStuck()) {
    console.log("\n😞 Game stuck - no more legal moves");
    console.log(`Final result: ${game.row.length} cards remaining`);
  }

  rl.close();
}

/**
 * Command line interface
 */
if (import.meta.url === `file://${process.argv[1]}`) {
  const args = process.argv.slice(2);

  if (args.includes('--help') || args.includes('-h')) {
    console.log(`
Accordion Solitaire - The Nearly Impossible Game

Usage:
  node accordion.js              Interactive play
  node accordion.js --auto       Auto-play one game (greedy)
  node accordion.js --simulate <N>  Simulate N games
  node accordion.js --seed <N>   Play specific game (for replay)

Examples:
  node accordion.js --simulate 1000
  node accordion.js --seed 42 --auto
    `);
    process.exit(0);
  }

  if (args.includes('--simulate')) {
    const idx = args.indexOf('--simulate');
    const count = parseInt(args[idx + 1]) || 1000;
    AccordionSolitaire.simulate(count, 'greedy');
  } else if (args.includes('--auto')) {
    const seedIdx = args.indexOf('--seed');
    const seed = seedIdx >= 0 ? parseInt(args[seedIdx + 1]) : null;

    const game = new AccordionSolitaire(seed);
    game.deal();

    console.log("Auto-playing...\n");
    const won = game.autoPlay('greedy');

    game.display();

    if (won) {
      console.log("\n🎉 WON! This is incredibly rare!");
    } else {
      console.log(`\n😞 Stuck with ${game.row.length} cards`);
    }
  } else {
    playCLI();
  }
}

export { AccordionSolitaire };
