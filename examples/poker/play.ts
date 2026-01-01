#!/usr/bin/env npx tsx
/**
 * Interactive Texas Hold'em Poker CLI
 *
 * Play heads-up poker against a simple bot opponent.
 *
 * Usage:
 *   npx tsx examples/poker/play.ts
 *   npm run poker
 */

import * as readline from "readline";
import { PokerGame } from "./PokerGame.js";
import { formatCards } from "./HandEvaluator.js";

const ACTIONS = ["Fold", "Check", "Call", "Raise ½ Pot", "Raise Pot", "All-In"];

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

function prompt(question: string): Promise<string> {
  return new Promise((resolve) => {
    rl.question(question, resolve);
  });
}

function clearScreen(): void {
  console.clear();
}

function renderGame(game: PokerGame, showOpponentCards: boolean = false): void {
  const state = game.getState();

  console.log("\n╔════════════════════════════════════════════════════════╗");
  console.log("║              TEXAS HOLD'EM POKER                       ║");
  console.log("╚════════════════════════════════════════════════════════╝\n");

  // Community cards
  console.log("  ┌─────────────────────────────────────────┐");
  if (state.communityCards.length > 0) {
    console.log(`  │  Board: ${formatCards(state.communityCards).padEnd(30)}│`);
  } else {
    console.log("  │  Board: [Preflop - no cards yet]       │");
  }
  console.log(`  │  Pot: $${state.pot.toString().padEnd(32)}│`);
  console.log("  └─────────────────────────────────────────┘\n");

  // Players
  for (const player of state.players) {
    const isYou = player.name === "You";
    const isDealer = player.isDealer ? " (BTN)" : " (BB)";
    const status = player.folded ? " [FOLDED]" : player.allIn ? " [ALL-IN]" : "";
    const isCurrent = state.players[state.currentPlayerIndex].name === player.name;
    const arrow = isCurrent ? " ◄──" : "";

    // Show cards
    let cards: string;
    if (isYou) {
      cards = formatCards(player.holeCards);
    } else if (showOpponentCards || state.phase === "showdown" || state.phase === "complete") {
      cards = formatCards(player.holeCards);
    } else {
      cards = "[?] [?]";
    }

    console.log(`  ${player.name}${isDealer}${status}${arrow}`);
    console.log(`    Cards: ${cards}`);
    console.log(`    Chips: $${player.chips}  |  Bet: $${player.currentBet}`);
    console.log("");
  }

  // Phase
  console.log(`  Phase: ${state.phase.toUpperCase()}`);

  if (state.winner) {
    console.log(`\n  ★ Winner: ${state.winner} (${state.winningHand}) ★`);
  }
}

function getValidActionsDisplay(game: PokerGame): string[] {
  const validMask = game.getValidActions();
  const display: string[] = [];

  for (let i = 0; i < ACTIONS.length; i++) {
    if (validMask[i]) {
      display.push(`${i + 1}) ${ACTIONS[i]}`);
    }
  }

  return display;
}

// Simple bot that plays somewhat reasonably
function botAction(game: PokerGame): number {
  const validMask = game.getValidActions();
  const state = game.getState();

  // Get valid action indices
  const validActions = validMask
    .map((valid, idx) => valid ? idx : -1)
    .filter(idx => idx >= 0);

  if (validActions.length === 0) return 0;

  // Simple strategy:
  // - If can check, usually check (70%)
  // - If must call, call most of the time (60%), fold sometimes (30%), raise rarely (10%)
  // - Occasionally raise (20% when can check)

  const random = Math.random();

  // Can check?
  if (validMask[1]) {
    if (random < 0.7) return 1; // Check
    if (random < 0.9 && validMask[3]) return 3; // Raise half
    if (validMask[4]) return 4; // Raise pot
    return 1; // Default check
  }

  // Must call or fold
  if (validMask[2]) {
    if (random < 0.6) return 2; // Call
    if (random < 0.7 && validMask[3]) return 3; // Raise
    if (random < 0.9) return 2; // Call
    return 0; // Fold
  }

  // All-in situations
  if (validMask[5] && random < 0.3) return 5;

  // Default: first valid action
  return validActions[0];
}

async function playHand(game: PokerGame): Promise<void> {
  game.reset();

  while (!game.isComplete()) {
    clearScreen();
    renderGame(game);

    const currentPlayer = game.getCurrentPlayer();

    if (currentPlayer.name === "You") {
      // Human turn
      const validActions = getValidActionsDisplay(game);
      console.log("\n  Your turn! Choose an action:");
      console.log(`  ${validActions.join("  ")}`);

      let action = -1;
      while (action < 0 || action > 5 || !game.getValidActions()[action]) {
        const input = await prompt("\n  Enter action number: ");
        action = parseInt(input, 10) - 1;

        if (isNaN(action) || action < 0 || action > 5) {
          console.log("  Invalid input. Enter a number 1-6.");
          action = -1;
        } else if (!game.getValidActions()[action]) {
          console.log("  That action is not available. Try again.");
          action = -1;
        }
      }

      game.action(action);
    } else {
      // Bot turn
      console.log("\n  Bot is thinking...");
      await new Promise(resolve => setTimeout(resolve, 800));

      const action = botAction(game);
      console.log(`  Bot chose: ${ACTIONS[action]}`);
      await new Promise(resolve => setTimeout(resolve, 500));

      game.action(action);
    }
  }

  // Show final result
  clearScreen();
  renderGame(game, true);
}

async function main(): Promise<void> {
  console.clear();
  console.log("\n  Welcome to Texas Hold'em Poker!");
  console.log("  ================================\n");
  console.log("  You'll play heads-up against a bot opponent.");
  console.log("  Starting chips: $100 each");
  console.log("  Blinds: $1 / $2\n");

  await prompt("  Press Enter to start...");

  const game = new PokerGame({
    playerNames: ["You", "Bot"],
    startingChips: 100,
    smallBlind: 1,
    bigBlind: 2,
  });

  let playAgain = true;

  while (playAgain) {
    await playHand(game);

    // Check if anyone is busted
    const state = game.getState();
    const you = state.players.find(p => p.name === "You")!;
    const bot = state.players.find(p => p.name === "Bot")!;

    if (you.chips <= 0) {
      console.log("\n  You're out of chips! Game over.");
      playAgain = false;
    } else if (bot.chips <= 0) {
      console.log("\n  You busted the bot! Congratulations!");
      playAgain = false;
    } else {
      console.log(`\n  Your chips: $${you.chips}  |  Bot chips: $${bot.chips}`);
      const answer = await prompt("\n  Play another hand? (y/n): ");
      playAgain = answer.toLowerCase().startsWith("y");
    }
  }

  console.log("\n  Thanks for playing!\n");
  rl.close();
}

main().catch(console.error);
