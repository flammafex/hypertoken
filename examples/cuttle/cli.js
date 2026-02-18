#!/usr/bin/env node
/**
 * CLI Cuttle Game
 * Play Cuttle in your terminal using HyperToken
 *
 * Usage:
 *   node --loader ../../test/ts-esm-loader.js cli.js [--variant classic|standard|cutthroat]
 *
 * Options:
 *   --variant classic   Use original/classic 2-player rules (default)
 *   --variant standard  Use cuttle.cards Standard 2-player rules
 *   --variant cutthroat Play 3-player Cutthroat mode (you vs 2 AI)
 */

import readline from "readline/promises";
import { stdin as input, stdout as output } from "process";
import { CuttleGame } from "./CuttleGame.js";

// Parse command line arguments
const args = process.argv.slice(2);
let variant = "classic";

const variantIndex = args.indexOf("--variant");
if (variantIndex !== -1 && args[variantIndex + 1]) {
  const v = args[variantIndex + 1].toLowerCase();
  if (v === "standard" || v === "classic" || v === "cutthroat") {
    variant = v;
  }
}

const rl = readline.createInterface({ input, output });

// ANSI color codes
const colors = {
  red: "\x1b[91m",
  white: "\x1b[97m",
  dim: "\x1b[2m",
  reset: "\x1b[0m",
  bold: "\x1b[1m",
  yellow: "\x1b[93m",
  cyan: "\x1b[96m",
  green: "\x1b[92m",
};

// Game state for QoL features
let gameStartTime = null;
let moveHistory = [];
const MAX_HISTORY = 5;

function clearScreen() {
  console.log("\x1Bc");
}

function printBanner() {
  console.log("\n╔════════════════════════════════════════════════════╗");
  console.log("║            ⚔️  HYPERTOKEN CUTTLE ⚔️                 ║");
  if (variant === "cutthroat") {
    console.log("║         [Cutthroat - 3 Players]                   ║");
    console.log("║         First to 14 points wins!                   ║");
  } else if (variant === "standard") {
    console.log("║         [Standard Rules - cuttle.cards]            ║");
    console.log("║         First to 21 points wins!                   ║");
  } else {
    console.log("║         [Classic Rules]                            ║");
    console.log("║         First to 21 points wins!                   ║");
  }
  console.log("╚════════════════════════════════════════════════════╝\n");
}

function cardToDisplay(card, showColor = true) {
  if (card.isJoker) return `${colors.yellow}🃏${colors.reset}`;
  const suitSymbols = { clubs: "♣", diamonds: "♦", hearts: "♥", spades: "♠" };
  const cardStr = `${card.rank}${suitSymbols[card.suit]}`;
  if (!showColor) return cardStr;
  // Hearts and diamonds are red, clubs and spades are white
  if (card.suit === "hearts" || card.suit === "diamonds") {
    return `${colors.red}${cardStr}${colors.reset}`;
  }
  return `${colors.white}${cardStr}${colors.reset}`;
}

function formatElapsedTime(startTime) {
  if (!startTime) return "0:00";
  const elapsed = Math.floor((Date.now() - startTime) / 1000);
  const minutes = Math.floor(elapsed / 60);
  const seconds = elapsed % 60;
  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
}

function addToHistory(action, playerIndex) {
  moveHistory.push({ action, playerIndex, time: Date.now() });
  if (moveHistory.length > MAX_HISTORY) {
    moveHistory.shift();
  }
}

function printGameState(game, playerIndex) {
  const obs = game.getObservation(playerIndex);
  const state = game.getState();
  const numPlayers = obs.numPlayers;

  console.log("─".repeat(60));
  const timerStr = gameStartTime ? `${colors.dim}⏱ ${formatElapsedTime(gameStartTime)}${colors.reset}` : "";
  console.log(`Turn: ${state.turnNumber} | Phase: ${state.phase} ${timerStr}`);
  console.log(`Deck: ${obs.deckSize} cards | Scrap: ${obs.scrap.length} cards`);
  console.log("─".repeat(60));

  if (numPlayers === 2) {
    // 2-player display
    const opponent = 1 - playerIndex;
    console.log(`\n👤 OPPONENT (Player ${opponent}):`);
    console.log(`   Points: ${obs.opponentPoints}/${obs.opponentGoal}`);
    console.log(`   Hand: ${obs.opponentHandSize} cards`);
    if (obs.opponentHand) {
      console.log(`   [Revealed by 8]: ${obs.opponentHand.map(cardToDisplay).join(" ")}`);
    }
    const oppPointDisplay = obs.opponentPointCards
      .filter((pc) => pc.controller === opponent)
      .map((pc) => {
        if (pc.attachedJacks.length > 0) {
          const jackStr = pc.attachedJacks.map((j) => cardToDisplay(j)).join(",");
          return `${cardToDisplay(pc.card)}${colors.dim}←${jackStr}${colors.reset}`;
        }
        return cardToDisplay(pc.card);
      })
      .join(" ");
    console.log(`   Point Cards: ${oppPointDisplay || "(none)"}`);
    const oppPermDisplay = obs.opponentPermanents.map((p) => cardToDisplay(p.card)).join(" ");
    console.log(`   Permanents: ${oppPermDisplay || "(none)"}`);
  } else {
    // 3+ player display
    for (const opp of obs.opponents) {
      const currentMarker = state.currentPlayer === opp.playerIndex ? " ← TURN" : "";
      const skipMarker = obs.skipTurnPlayers.includes(opp.playerIndex) ? " [SKIP]" : "";
      console.log(`\n👤 OPPONENT (Player ${opp.playerIndex})${currentMarker}${skipMarker}:`);
      console.log(`   Points: ${opp.points}/${opp.goal}`);
      console.log(`   Hand: ${opp.handSize} cards`);
      if (opp.hand) {
        console.log(`   [Revealed by 8]: ${opp.hand.map(cardToDisplay).join(" ")}`);
      }

      // Show ALL cards this opponent controls (including stolen ones)
      const oppControlledCards = [];
      // Helper to format point card with jacks
      const formatPointCard = (pc, suffix = "") => {
        if (pc.attachedJacks.length > 0) {
          const jackStr = pc.attachedJacks.map((j) => cardToDisplay(j)).join(",");
          return `${cardToDisplay(pc.card)}${colors.dim}←${jackStr}${colors.reset}${suffix}`;
        }
        return cardToDisplay(pc.card) + suffix;
      };
      // Cards from their own pointCards array
      for (const pc of opp.pointCards) {
        if (pc.controller === opp.playerIndex) {
          oppControlledCards.push(formatPointCard(pc));
        }
      }
      // Cards stolen from other opponents
      for (const other of obs.opponents) {
        if (other.playerIndex === opp.playerIndex) continue;
        for (const pc of other.pointCards) {
          if (pc.controller === opp.playerIndex) {
            oppControlledCards.push(formatPointCard(pc, `${colors.dim}[from P${other.playerIndex}]${colors.reset}`));
          }
        }
      }
      // Cards stolen from us
      for (const pc of obs.myPointCards) {
        if (pc.controller === opp.playerIndex) {
          oppControlledCards.push(formatPointCard(pc, `${colors.dim}[from P${playerIndex}]${colors.reset}`));
        }
      }
      console.log(`   Point Cards: ${oppControlledCards.join(" ") || "(none)"}`);

      const oppPermDisplay = opp.permanents.map((p) => cardToDisplay(p.card)).join(" ");
      console.log(`   Permanents: ${oppPermDisplay || "(none)"}`);

      // Show Jacks this opponent has in play (attached to other players' cards)
      const oppJacks = [];
      for (const other of obs.opponents) {
        for (const pc of other.pointCards) {
          if (pc.controller === opp.playerIndex) {
            for (const jack of pc.attachedJacks) {
              oppJacks.push(`${cardToDisplay(jack)} → ${cardToDisplay(pc.card)}`);
            }
          }
        }
      }
      for (const pc of obs.myPointCards) {
        if (pc.controller === opp.playerIndex) {
          for (const jack of pc.attachedJacks) {
            oppJacks.push(`${cardToDisplay(jack)} → ${cardToDisplay(pc.card)}`);
          }
        }
      }
      if (oppJacks.length > 0) {
        console.log(`   Jacks in play: ${oppJacks.join(", ")}`);
      }
    }
  }

  // Your info
  const yourTurnMarker = state.currentPlayer === playerIndex ? " ← YOUR TURN" : "";
  const yourSkipMarker = obs.skipTurnPlayers.includes(playerIndex) ? " [SKIP]" : "";
  console.log(`\n🎮 YOU (Player ${playerIndex})${yourTurnMarker}${yourSkipMarker}:`);
  console.log(`   Points: ${obs.myPoints}/${obs.myGoal}`);
  console.log(`   Hand: ${obs.myHand.map(cardToDisplay).join(" ")}`);

  // Helper to format point card with jacks
  const formatMyPointCard = (pc, suffix = "") => {
    if (pc.attachedJacks.length > 0) {
      const jackStr = pc.attachedJacks.map((j) => cardToDisplay(j)).join(",");
      return `${cardToDisplay(pc.card)}${colors.dim}←${jackStr}${colors.reset}${suffix}`;
    }
    return cardToDisplay(pc.card) + suffix;
  };

  // Show ALL point cards we control (including stolen ones from other players)
  const allControlledCards = [];
  // Cards from our own pointCards array
  for (const pc of obs.myPointCards) {
    if (pc.controller === playerIndex) {
      allControlledCards.push(formatMyPointCard(pc));
    }
  }
  // Cards stolen from opponents (cards in their array that we control)
  if (obs.opponents) {
    for (const opp of obs.opponents) {
      for (const pc of opp.pointCards) {
        if (pc.controller === playerIndex) {
          allControlledCards.push(formatMyPointCard(pc, `${colors.dim}[from P${opp.playerIndex}]${colors.reset}`));
        }
      }
    }
  } else if (obs.opponentPointCards) {
    // 2-player fallback
    for (const pc of obs.opponentPointCards) {
      if (pc.controller === playerIndex) {
        allControlledCards.push(formatMyPointCard(pc, `${colors.dim}[stolen]${colors.reset}`));
      }
    }
  }
  console.log(`   Point Cards: ${allControlledCards.join(" ") || "(none)"}`);
  const myPermDisplay = obs.myPermanents.map((p) => cardToDisplay(p.card)).join(" ");
  console.log(`   Permanents: ${myPermDisplay || "(none)"}`);

  // Also show Jacks we played (attached to opponent's cards we stole)
  const jacksPlayed = [];
  if (obs.opponents) {
    for (const opp of obs.opponents) {
      for (const pc of opp.pointCards) {
        for (const jack of pc.attachedJacks) {
          // Check if this Jack gave us control
          if (pc.controller === playerIndex) {
            jacksPlayed.push(`${cardToDisplay(jack)} → ${cardToDisplay(pc.card)}`);
          }
        }
      }
    }
  }
  if (jacksPlayed.length > 0) {
    console.log(`   Jacks in play: ${jacksPlayed.join(", ")}`);
  }

  // Show move history
  if (moveHistory.length > 0) {
    console.log(`\n📜 Recent moves:`);
    for (let i = 0; i < moveHistory.length; i++) {
      const entry = moveHistory[i];
      const isLatest = i === moveHistory.length - 1;
      const prefix = isLatest ? `${colors.bold}→${colors.reset}` : `${colors.dim} ${colors.reset}`;
      const playerLabel = entry.playerIndex === playerIndex ? "You" : `P${entry.playerIndex}`;
      const actionText = isLatest ? `${colors.bold}${entry.action}${colors.reset}` : `${colors.dim}${entry.action}${colors.reset}`;
      console.log(`   ${prefix} ${playerLabel}: ${actionText}`);
    }
  }

  console.log("─".repeat(60));
}

function formatAction(action, game, playerIndex) {
  const obs = game.getObservation(playerIndex);
  const parts = action.split(":");

  const findCard = (id) => {
    const cardId = parseInt(id);
    // Check hand
    for (const c of obs.myHand) {
      if (c.id === cardId) return cardToDisplay(c);
    }
    // Check point cards
    const allPointCards = [
      ...obs.myPointCards,
      ...(obs.opponentPointCards || []),
      ...(obs.opponents || []).flatMap((o) => o.pointCards),
    ];
    for (const pc of allPointCards) {
      if (pc.card.id === cardId) return cardToDisplay(pc.card);
      for (const j of pc.attachedJacks) {
        if (j.id === cardId) return cardToDisplay(j);
      }
    }
    // Check permanents
    const allPermanents = [
      ...obs.myPermanents,
      ...(obs.opponentPermanents || []),
      ...(obs.opponents || []).flatMap((o) => o.permanents),
    ];
    for (const p of allPermanents) {
      if (p.card.id === cardId) return cardToDisplay(p.card);
    }
    // Check scrap
    for (const c of obs.scrap) {
      if (c.id === cardId) return cardToDisplay(c);
    }
    return `card#${id}`;
  };

  switch (parts[0]) {
    case "draw":
      return "Draw a card";
    case "pass":
      return "Pass";
    case "point":
      return `Play ${findCard(parts[1])} as point card`;
    case "oneoff":
      if (parts[2] === "target") {
        return `Play ${findCard(parts[1])} one-off targeting Player ${parts[3]}`;
      }
      if (parts.length > 3) {
        return `Play ${findCard(parts[1])} one-off targeting ${findCard(parts[3])}`;
      }
      return `Play ${findCard(parts[1])} as one-off`;
    case "permanent":
      if (parts.length > 2) {
        return `Play ${findCard(parts[1])} (Jack) on ${findCard(parts[2])}`;
      }
      return `Play ${findCard(parts[1])} as permanent`;
    case "scuttle":
      return `Scuttle ${findCard(parts[2])} with ${findCard(parts[1])}`;
    case "counter":
      return `Counter with ${findCard(parts[1])}`;
    case "choose":
      return `Retrieve ${findCard(parts[1])} from scrap`;
    case "discard":
      return `Discard ${findCard(parts[1])}`;
    case "five_discard":
      return `Discard ${findCard(parts[1])} (then draw 3)`;
    case "scrap_seven":
      if (parts.length > 1) {
        return `Scrap ${findCard(parts[1])} (can't play it)`;
      }
      return "Cannot play drawn card - scrap it";
    case "joker":
      return `Use 🃏 Joker to steal ${findCard(parts[2])}`;
    default:
      if (parts[0].startsWith("seven_")) {
        const subAction = parts[0].replace("seven_", "");
        return `(From 7) ${formatAction(subAction + ":" + parts.slice(1).join(":"), game, playerIndex)}`;
      }
      return action;
  }
}

// Check if an action is high-impact and needs confirmation
function isHighImpactAction(action, game, playerIndex) {
  const obs = game.getObservation(playerIndex);
  const parts = action.split(":");

  // Counter with a 2 - always confirm
  if (parts[0] === "counter") {
    return { needs: true, reason: "Use your 2 to counter?" };
  }

  // Playing your only Queen
  if (parts[0] === "permanent" && parts.length === 2) {
    const cardId = parseInt(parts[1]);
    const card = obs.myHand.find((c) => c.id === cardId);
    if (card && card.rank === "Q") {
      const queenCount = obs.myHand.filter((c) => c.rank === "Q").length;
      if (queenCount === 1) {
        return { needs: true, reason: "Play your only Queen?" };
      }
    }
  }

  // Using Ace to destroy all point cards when you have points too
  if (parts[0] === "oneoff" && obs.myPoints > 0) {
    const cardId = parseInt(parts[1]);
    const card = obs.myHand.find((c) => c.id === cardId);
    if (card && card.rank === "A") {
      return { needs: true, reason: `Use Ace? (You'll lose ${obs.myPoints} points too)` };
    }
  }

  // Using 6 to destroy all permanents when you have permanents
  if (parts[0] === "oneoff" && obs.myPermanents.length > 0) {
    const cardId = parseInt(parts[1]);
    const card = obs.myHand.find((c) => c.id === cardId);
    if (card && card.rank === "6") {
      return { needs: true, reason: `Use 6? (You'll lose your permanents too)` };
    }
  }

  return { needs: false };
}

async function getHumanAction(game, playerIndex) {
  const actions = game.getValidActions(playerIndex);

  if (actions.length === 0) {
    return null;
  }

  console.log("\n📋 Available actions:");
  actions.forEach((action, i) => {
    console.log(`   ${i + 1}. ${formatAction(action, game, playerIndex)}`);
  });
  console.log(`${colors.dim}   [q]uit  [h]elp/rules${colors.reset}`);

  while (true) {
    const answer = await rl.question("\nChoose action (number): ");
    const input = answer.trim().toLowerCase();

    // Keyboard shortcuts
    if (input === "q" || input === "quit") {
      console.log("\nGoodbye!\n");
      rl.close();
      process.exit(0);
    }
    if (input === "h" || input === "r" || input === "help" || input === "rules") {
      await showRules();
      await rl.question("\nPress Enter to continue...");
      return "@@REFRESH@@"; // Signal to refresh display
    }

    const choice = parseInt(answer) - 1;

    if (choice >= 0 && choice < actions.length) {
      const selectedAction = actions[choice];

      // Check for high-impact actions
      const impact = isHighImpactAction(selectedAction, game, playerIndex);
      if (impact.needs) {
        const confirm = await rl.question(`${colors.yellow}⚠ ${impact.reason} (y/n): ${colors.reset}`);
        if (confirm.trim().toLowerCase() !== "y") {
          console.log("Cancelled.");
          continue;
        }
      }

      return selectedAction;
    }
    console.log("Invalid choice, try again.");
  }
}

function getRandomAction(game, playerIndex) {
  const actions = game.getValidActions(playerIndex);
  const turnActions = actions.filter((a) => !a.startsWith("peek:"));
  const pool = turnActions.length > 0 ? turnActions : actions;
  if (pool.length === 0) return null;
  return pool[Math.floor(Math.random() * pool.length)];
}

// Check if player can counter (has a 2 in hand)
function canCounter(game, playerIndex) {
  const obs = game.getObservation(playerIndex);
  return obs.myHand.some((c) => c.rank === "2");
}

async function playGame2Player(humanPlayer = 1) {
  const game = new CuttleGame({ variant });
  const aiPlayer = 1 - humanPlayer;

  // Reset QoL state
  gameStartTime = Date.now();
  moveHistory = [];

  console.log(`\nYou are Player ${humanPlayer}. ${humanPlayer === 1 ? "You go first!" : "AI goes first."}`);
  await rl.question("Press Enter to start...");

  while (true) {
    const state = game.getState();

    if (state.winner !== null) {
      clearScreen();
      printBanner();
      printGameState(game, humanPlayer);
      const elapsed = formatElapsedTime(gameStartTime);
      if (state.winner === humanPlayer) {
        console.log(`\n🎉 YOU WIN! 🎉 (${elapsed})\n`);
      } else {
        console.log(`\n😔 You lost. Better luck next time! (${elapsed})\n`);
      }
      break;
    }

    if (state.isDraw) {
      clearScreen();
      printBanner();
      printGameState(game, humanPlayer);
      console.log("\n🤝 It's a draw!\n");
      break;
    }

    clearScreen();
    printBanner();
    printGameState(game, humanPlayer);

    // Determine who acts based on phase
    let actingPlayer = state.currentPlayer;

    // In counter phase, check who can counter
    if (state.phase === "counter" && state.pendingOneOff) {
      const counteringPlayer =
        state.pendingOneOff.counterChain.length % 2 === 0
          ? 1 - state.pendingOneOff.player
          : state.pendingOneOff.player;
      actingPlayer = counteringPlayer;
    }

    // In resolve_four phase, discardingPlayer discards
    if (state.phase === "resolve_four") {
      actingPlayer = state.discardingPlayer ?? (1 - state.currentPlayer);
    }

    if (actingPlayer === humanPlayer) {
      // Auto-pass in counter phase if no 2s
      if (state.phase === "counter" && !canCounter(game, humanPlayer)) {
        console.log(`\n${colors.dim}(Auto-passing - no 2s to counter with)${colors.reset}`);
        await new Promise((r) => setTimeout(r, 800));
        const result = game.action(humanPlayer, "pass");
        if (result.success) {
          addToHistory("Pass (auto)", humanPlayer);
        }
        continue;
      }

      const action = await getHumanAction(game, humanPlayer);
      if (action === "@@REFRESH@@") {
        continue; // Just refresh the display
      }
      if (action) {
        // Format BEFORE executing so we can find the card
        const actionStr = formatAction(action, game, humanPlayer);
        const result = game.action(humanPlayer, action);
        if (!result.success) {
          console.log(`Error: ${result.message}`);
          await rl.question("Press Enter to continue...");
        } else {
          addToHistory(actionStr, humanPlayer);
        }
      }
    } else {
      console.log("\n🤖 AI is thinking...");
      await new Promise((r) => setTimeout(r, 500));

      const action = getRandomAction(game, aiPlayer);
      if (action) {
        // Format BEFORE executing so we can find the card
        const actionStr = formatAction(action, game, aiPlayer);
        const result = game.action(aiPlayer, action);
        console.log(`AI plays: ${actionStr}`);
        addToHistory(actionStr, aiPlayer);
        await new Promise((r) => setTimeout(r, 800));
      }
    }
  }
}

async function playCutthroat(humanPlayer = 0) {
  const game = new CuttleGame({ variant: "cutthroat" });
  const aiPlayers = [0, 1, 2].filter((p) => p !== humanPlayer);

  // Reset QoL state
  gameStartTime = Date.now();
  moveHistory = [];

  console.log(`\nYou are Player ${humanPlayer}. Playing against 2 AI opponents.`);
  console.log(`Turn order: Player 1 → Player 2 → Player 0 → ...`);
  await rl.question("Press Enter to start...");

  while (true) {
    const state = game.getState();

    if (state.winner !== null) {
      clearScreen();
      printBanner();
      printGameState(game, humanPlayer);
      const elapsed = formatElapsedTime(gameStartTime);
      if (state.winner === humanPlayer) {
        console.log(`\n🎉 YOU WIN! 🎉 (${elapsed})\n`);
      } else {
        console.log(`\n😔 Player ${state.winner} wins. Better luck next time! (${elapsed})\n`);
      }
      break;
    }

    if (state.isDraw) {
      clearScreen();
      printBanner();
      printGameState(game, humanPlayer);
      console.log("\n🤝 It's a draw!\n");
      break;
    }

    clearScreen();
    printBanner();
    printGameState(game, humanPlayer);

    // Find who can act by checking valid actions for each player
    let actingPlayer = -1;
    for (let p = 0; p < 3; p++) {
      const actions = game.getValidActions(p);
      const turnActions = actions.filter((a) => !a.startsWith("peek:"));
      if (turnActions.length > 0) {
        actingPlayer = p;
        break;
      }
    }

    // Safety check - if no one can act, something is wrong
    if (actingPlayer === -1) {
      console.log("\n⚠️  Error: No player has valid actions. Game state may be corrupted.");
      console.log(`Phase: ${state.phase}`);
      break;
    }

    // Cutthroat glasses support: allow out-of-turn peek selection when available.
    if (actingPlayer !== humanPlayer) {
      const peekActions = game.getValidActions(humanPlayer).filter((a) => a.startsWith("peek:"));
      if (peekActions.length > 0) {
        const peekTargets = peekActions.map((a) => parseInt(a.split(":")[1]));
        console.log(`\n${colors.cyan}👓 Peek available:${colors.reset} ${peekTargets.map((p) => `p${p}`).join("  ")}`);
        const peekInput = (await rl.question("Peek target (pN) or Enter to continue: ")).trim().toLowerCase();
        const peekMatch = peekInput.match(/^p(\d+)$/);
        if (peekMatch) {
          const target = parseInt(peekMatch[1]);
          const action = `peek:${target}`;
          if (peekActions.includes(action)) {
            const result = game.action(humanPlayer, action);
            if (result.success) {
              addToHistory(`Peek at Player ${target}`, humanPlayer);
              continue;
            }
          }
          console.log("Invalid peek target.");
        }
      }
    }

    if (actingPlayer === humanPlayer) {
      // Auto-pass in counter phase if no 2s
      if (state.phase === "counter" && !canCounter(game, humanPlayer)) {
        console.log(`\n${colors.dim}(Auto-passing - no 2s to counter with)${colors.reset}`);
        await new Promise((r) => setTimeout(r, 800));
        const result = game.action(humanPlayer, "pass");
        if (result.success) {
          addToHistory("Pass (auto)", humanPlayer);
        }
        continue;
      }

      const action = await getHumanAction(game, humanPlayer);
      if (action === "@@REFRESH@@") {
        continue; // Just refresh the display
      }
      if (action) {
        // Format BEFORE executing so we can find the card
        const actionStr = formatAction(action, game, humanPlayer);
        const result = game.action(humanPlayer, action);
        if (!result.success) {
          console.log(`Error: ${result.message}`);
          await rl.question("Press Enter to continue...");
        } else {
          addToHistory(actionStr, humanPlayer);
        }
      }
    } else {
      console.log(`\n🤖 AI Player ${actingPlayer} is thinking...`);
      await new Promise((r) => setTimeout(r, 500));

      const action = getRandomAction(game, actingPlayer);
      if (action) {
        // Format BEFORE executing so we can find the card
        const actionStr = formatAction(action, game, actingPlayer);
        const result = game.action(actingPlayer, action);
        console.log(`AI Player ${actingPlayer} plays: ${actionStr}`);
        addToHistory(actionStr, actingPlayer);
        await new Promise((r) => setTimeout(r, 800));
      } else {
        // This shouldn't happen - if actingPlayer was selected, they should have actions
        console.log(`\n⚠️  Error: AI Player ${actingPlayer} has no valid actions.`);
        console.log("Available actions per player:");
        for (let p = 0; p < 3; p++) {
          const acts = game.getValidActions(p);
          console.log(`  Player ${p}: ${acts.length > 0 ? acts.join(", ") : "(none)"}`);
        }
        await rl.question("Press Enter to continue...");
      }
    }
  }
}

async function showRules() {
  if (variant === "cutthroat") {
    console.log(`
╔══════════════════════════════════════════════════════════════════╗
║                CUTTLE RULES (Cutthroat - 3 Players)              ║
╠══════════════════════════════════════════════════════════════════╣
║ OBJECTIVE: Be first to accumulate 14+ points in point cards.     ║
║                                                                  ║
║ SETUP: 54-card deck (with 2 Jokers), each player gets 5 cards.   ║
║ Hand limit is 7 cards. Player left of dealer goes first.         ║
║                                                                  ║
║ POINT CARDS (A-10): Play for points equal to rank (A=1)          ║
║                                                                  ║
║ ONE-OFF EFFECTS:                                                 ║
║   A  - Destroy ALL point cards                                   ║
║   2  - Destroy a permanent OR counter another one-off            ║
║   3  - Retrieve any card from the scrap pile                     ║
║   4  - Target ONE opponent to discard 2 cards                    ║
║   5  - Discard 1 card, then draw 3                               ║
║   6  - Destroy ALL permanents                                    ║
║   7  - Reveal top 2, choose 1 to play, other goes back           ║
║   9  - Return a PERMANENT + owner SKIPS next turn                ║
║                                                                  ║
║ PERMANENTS:                                                      ║
║   8  - "Glasses" - Peek one opponent's hand at any time             ║
║   J  - Steal control of any opponent's point card                ║
║   Q  - Protect your other cards from being targeted              ║
║   K  - Reduce goal: 14 → 9 → 5 → 0 (3 Kings = instant win)       ║
║   🃏  - JOKER: Steal a royal (J, Q, K) from any opponent          ║
║                                                                  ║
║ SCUTTLING: Use a higher card to destroy any opponent's point.    ║
╚══════════════════════════════════════════════════════════════════╝
`);
  } else if (variant === "standard") {
    console.log(`
╔══════════════════════════════════════════════════════════════════╗
║                 CUTTLE RULES (Standard Variant)                  ║
╠══════════════════════════════════════════════════════════════════╣
║ OBJECTIVE: Be first to accumulate 21+ points in point cards.     ║
║                                                                  ║
║ ON YOUR TURN, you may:                                           ║
║   • Draw a card (if deck not empty, max 8 cards in hand)         ║
║   • Pass (only if deck empty - 3 passes = draw)                  ║
║   • Play a card in one of four ways:                             ║
║                                                                  ║
║ POINT CARDS (A-10): Play for points equal to rank (A=1)          ║
║                                                                  ║
║ ONE-OFF EFFECTS:                                                 ║
║   A  - Destroy ALL point cards                                   ║
║   2  - Destroy a permanent OR counter another one-off            ║
║   3  - Retrieve any card from the scrap pile                     ║
║   4  - Opponent discards 2 cards from hand                       ║
║   5  - Discard 1 card, then draw 3 (skip discard if hand empty)  ║
║   6  - Destroy ALL permanents                                    ║
║   7  - Reveal top 2 cards, choose 1 to play, other goes back     ║
║   9  - Return a PERMANENT to hand (can't play it next turn)      ║
║                                                                  ║
║ PERMANENTS:                                                      ║
║   8  - "Glasses" - Opponent's hand is revealed to you            ║
║   J  - Steal control of a point card                             ║
║   Q  - Protect your other cards from being targeted              ║
║   K  - Reduce goal: 21 → 14 → 10 → 5 → 0 (4 Kings = instant win)║
║                                                                  ║
║ SCUTTLING: Use a higher card from hand to destroy opponent's     ║
║   point card. Both cards go to scrap. (Suits break ties:         ║
║   ♣ < ♦ < ♥ < ♠)                                                 ║
╚══════════════════════════════════════════════════════════════════╝
`);
  } else {
    console.log(`
╔══════════════════════════════════════════════════════════════════╗
║                  CUTTLE RULES (Classic Variant)                  ║
╠══════════════════════════════════════════════════════════════════╣
║ OBJECTIVE: Be first to accumulate 21+ points in point cards.     ║
║                                                                  ║
║ ON YOUR TURN, you may:                                           ║
║   • Draw a card (if deck not empty, max 8 cards in hand)         ║
║   • Pass (only if deck empty - 3 passes = draw)                  ║
║   • Play a card in one of four ways:                             ║
║                                                                  ║
║ POINT CARDS (A-10): Play for points equal to rank (A=1)          ║
║                                                                  ║
║ ONE-OFF EFFECTS:                                                 ║
║   A  - Destroy ALL point cards                                   ║
║   2  - Destroy a permanent OR counter another one-off            ║
║   3  - Retrieve any card from the scrap pile                     ║
║   4  - Opponent discards 2 cards from hand                       ║
║   5  - Draw 2 cards                                              ║
║   6  - Destroy ALL permanents                                    ║
║   7  - Draw a card and MUST play it immediately                  ║
║   9  - Return a PERMANENT to its owner's hand                    ║
║                                                                  ║
║ PERMANENTS:                                                      ║
║   8  - "Glasses" - Opponent's hand is revealed to you            ║
║   J  - Steal control of a point card                             ║
║   Q  - Protect your other cards from being targeted              ║
║   K  - Reduce your goal: 21 → 14 → 10 → 7 → 5                    ║
║                                                                  ║
║ SCUTTLING: Use a higher card from hand to destroy opponent's     ║
║   point card. Both cards go to scrap. (Suits break ties:         ║
║   ♣ < ♦ < ♥ < ♠)                                                 ║
╚══════════════════════════════════════════════════════════════════╝
`);
  }
}

async function main() {
  clearScreen();
  printBanner();

  console.log("Welcome to Cuttle!\n");
  if (variant === "cutthroat") {
    console.log("  1. Play Cutthroat (you are Player 0)");
    console.log("  2. Play Cutthroat (you are Player 1)");
    console.log("  3. Play Cutthroat (you are Player 2)");
    console.log("  4. View rules");
    console.log("  5. Quit\n");
  } else {
    const variantLabel = variant === "standard" ? "Standard" : "Classic";
    console.log(`  1. Play ${variantLabel} vs AI (you go first)`);
    console.log(`  2. Play ${variantLabel} vs AI (AI goes first)`);
    console.log("  3. View rules");
    console.log("  4. Quit\n");
  }

  const choice = await rl.question("Choose option: ");

  if (variant === "cutthroat") {
    switch (choice) {
      case "1":
        await playCutthroat(0);
        break;
      case "2":
        await playCutthroat(1);
        break;
      case "3":
        await playCutthroat(2);
        break;
      case "4":
        await showRules();
        await rl.question("\nPress Enter to continue...");
        await main();
        return;
      case "5":
        console.log("\nGoodbye!\n");
        rl.close();
        return;
      default:
        await main();
        return;
    }
  } else {
    switch (choice) {
      case "1":
        await playGame2Player(1);
        break;
      case "2":
        await playGame2Player(0);
        break;
      case "3":
        await showRules();
        await rl.question("\nPress Enter to continue...");
        await main();
        return;
      case "4":
        console.log("\nGoodbye!\n");
        rl.close();
        return;
      default:
        await main();
        return;
    }
  }

  const again = await rl.question("\nPlay again? (y/n): ");
  if (again.toLowerCase() === "y") {
    await main();
  } else {
    console.log("\nThanks for playing!\n");
    rl.close();
  }
}

main().catch(console.error);
