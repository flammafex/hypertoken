#!/usr/bin/env node
/**
 * Cuttle Multiplayer Client
 *
 * Interactive command-line client for playing network Cuttle.
 *
 * Usage:
 *   node --loader ../../test/ts-esm-loader.js network-client.js [server-url]
 *
 * Examples:
 *   node --loader ../../test/ts-esm-loader.js network-client.js
 *   node --loader ../../test/ts-esm-loader.js network-client.js ws://192.168.1.5:8080
 */

import WebSocket from "ws";
import readline from "readline";

const SERVER_URL = process.argv[2] || "ws://localhost:8080";

console.log("╔══════════════════════════════════════════════════════╗");
console.log("║         ⚔️  CUTTLE MULTIPLAYER CLIENT ⚔️              ║");
console.log("╚══════════════════════════════════════════════════════╝\n");

// State
let socket = null;
let gameState = null;
let validActions = [];
let myPlayerIndex = null;
let clientId = null;
let connected = false;
let numPlayers = 2;

// Create readline interface
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

// Card display helpers
function cardToDisplay(card) {
  if (card.isJoker) return "🃏";
  const suitSymbols = { clubs: "♣", diamonds: "♦", hearts: "♥", spades: "♠" };
  return `${card.rank}${suitSymbols[card.suit]}`;
}

function connect() {
  console.log(`Connecting to ${SERVER_URL}...`);

  socket = new WebSocket(SERVER_URL);

  socket.on("open", () => {
    connected = true;
    clientId = `player-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    console.log("✓ Connected to server!\n");

    // Request initial state
    send({ cmd: "describe" });
  });

  socket.on("message", (data) => {
    handleMessage(JSON.parse(data.toString()));
  });

  socket.on("close", () => {
    connected = false;
    console.log("\n❌ Disconnected from server");
    process.exit(0);
  });

  socket.on("error", (err) => {
    console.error("Connection error:", err.message);
    process.exit(1);
  });
}

function send(msg) {
  if (socket && connected) {
    socket.send(JSON.stringify(msg));
  }
}

function handleMessage(msg) {
  if (msg.cmd === "describe") {
    gameState = msg.state._gameState;
    validActions = msg.state.validActions || {};

    if (gameState) {
      numPlayers = gameState.numPlayers || 2;

      // Determine which player we are
      if (myPlayerIndex === null) {
        for (let i = 0; i < numPlayers; i++) {
          if (gameState.players[i] === clientId) {
            myPlayerIndex = i;
            break;
          }
        }
      }
    }

    updateDisplay();

    // Auto-register if not registered yet
    if (myPlayerIndex === null && gameState) {
      const hasEmptySlot = Object.values(gameState.players).some((p) => p === null);
      if (hasEmptySlot) {
        register();
      } else {
        console.log("⚠️  Game is full. Spectator mode.\n");
      }
    }

    showPrompt();
  } else if (msg.cmd === "error") {
    console.log(`\n❌ Error: ${msg.message}\n`);
    showPrompt();
  }
}

function register() {
  send({
    cmd: "dispatch",
    type: "cuttle:register",
    payload: { clientId },
  });
}

function makeMove(action) {
  if (!gameState) {
    console.log("⚠️  Game not initialized yet");
    return;
  }

  if (myPlayerIndex === null) {
    console.log("⚠️  You are not registered as a player");
    return;
  }

  send({
    cmd: "dispatch",
    type: "cuttle:action",
    payload: { action, clientId },
  });
}

function resetGame() {
  send({
    cmd: "dispatch",
    type: "cuttle:reset",
    payload: {},
  });
}

function updateDisplay() {
  console.clear();
  console.log("╔══════════════════════════════════════════════════════╗");
  if (gameState && gameState.variant === "cutthroat") {
    console.log("║         ⚔️  CUTTLE MULTIPLAYER (Cutthroat) ⚔️         ║");
  } else {
    console.log("║              ⚔️  CUTTLE MULTIPLAYER ⚔️                ║");
  }
  console.log("╚══════════════════════════════════════════════════════╝\n");

  if (!gameState) {
    console.log("Waiting for game state...\n");
    return;
  }

  const game = gameState.game;

  if (myPlayerIndex !== null) {
    console.log(`You are: Player ${myPlayerIndex}${myPlayerIndex === 1 ? " (goes first)" : ""}`);
  } else {
    console.log("You are: Spectator");
  }

  // Connection status
  const statusParts = [];
  for (let i = 0; i < numPlayers; i++) {
    const status = gameState.players[i] ? "✓" : "waiting...";
    statusParts.push(`P${i} ${status}`);
  }
  console.log(`Players: ${statusParts.join(" | ")}`);

  if (!gameState.gameStarted) {
    console.log(`\n⏳ Waiting for ${numPlayers} players to connect...\n`);
    return;
  }

  console.log("─".repeat(55));
  console.log(`Turn: ${game.turnNumber} | Phase: ${game.phase}`);
  console.log(`Deck: ${game.deck.length} cards | Scrap: ${game.scrap.length} cards`);
  console.log("─".repeat(55));

  // Show all other players
  for (let i = 0; i < numPlayers; i++) {
    if (i === myPlayerIndex) continue;

    const player = game.players[i];
    const isCurrentTurn = game.currentPlayer === i;
    const turnMarker = isCurrentTurn ? " ← TURN" : "";
    const skipMarker = game.skipTurnPlayers && game.skipTurnPlayers.includes(i) ? " [SKIP]" : "";

    console.log(`\n👤 OPPONENT (Player ${i})${turnMarker}${skipMarker}:`);
    console.log(`   Points: ${getPoints(game, i)}/${getPointGoal(game, i)}`);
    console.log(`   Hand: ${player.hand.length} cards`);

    const pointDisplay = player.pointCards
      .filter((pc) => pc.controller === i)
      .map((pc) => {
        const jacks = pc.attachedJacks.length > 0 ? `(J×${pc.attachedJacks.length})` : "";
        return cardToDisplay(pc.card) + jacks;
      })
      .join(" ");
    console.log(`   Point Cards: ${pointDisplay || "(none)"}`);

    const permDisplay = player.permanents.map((p) => cardToDisplay(p.card)).join(" ");
    console.log(`   Permanents: ${permDisplay || "(none)"}`);
  }

  // Your info
  if (myPlayerIndex !== null) {
    const myPlayer = game.players[myPlayerIndex];
    const isMyTurn = game.currentPlayer === myPlayerIndex;
    const turnMarker = isMyTurn ? " ← YOUR TURN" : "";
    const skipMarker = game.skipTurnPlayers && game.skipTurnPlayers.includes(myPlayerIndex) ? " [SKIP]" : "";

    console.log(`\n🎮 YOU (Player ${myPlayerIndex})${turnMarker}${skipMarker}:`);
    console.log(`   Points: ${getPoints(game, myPlayerIndex)}/${getPointGoal(game, myPlayerIndex)}`);
    console.log(`   Hand: ${myPlayer.hand.map(cardToDisplay).join(" ")}`);

    const myPointDisplay = myPlayer.pointCards
      .filter((pc) => pc.controller === myPlayerIndex)
      .map((pc) => {
        const jacks = pc.attachedJacks.length > 0 ? `(J×${pc.attachedJacks.length})` : "";
        return cardToDisplay(pc.card) + jacks;
      })
      .join(" ");
    console.log(`   Point Cards: ${myPointDisplay || "(none)"}`);

    const myPermDisplay = myPlayer.permanents.map((p) => cardToDisplay(p.card)).join(" ");
    console.log(`   Permanents: ${myPermDisplay || "(none)"}`);
  }

  if (game.lastAction) {
    console.log(`\n📢 Last: ${game.lastAction}`);
  }

  console.log("─".repeat(55));

  // Game over
  if (game.winner !== null) {
    if (game.winner === myPlayerIndex) {
      console.log("\n🎉 YOU WIN! 🎉");
    } else {
      console.log(`\n😔 Player ${game.winner} wins. Better luck next time!`);
    }
    console.log('Type "reset" to play again.\n');
  } else if (game.isDraw) {
    console.log("\n🤝 It's a draw!");
    console.log('Type "reset" to play again.\n');
  }
}

function getPoints(game, playerIndex) {
  let points = 0;
  for (const player of game.players) {
    for (const pc of player.pointCards) {
      if (pc.controller === playerIndex) {
        const rank = pc.card.rank;
        if (rank === "A") points += 1;
        else if (rank === "J" || rank === "Q" || rank === "K") points += 0;
        else points += parseInt(rank);
      }
    }
  }
  return points;
}

function getPointGoal(game, playerIndex) {
  const kingCount = game.players[playerIndex].permanents.filter((p) => p.type === "king").length;
  // Use cutthroat/standard goals if applicable
  const isCutthroat = game.players.length === 3;
  const goals = isCutthroat || gameState.variant === "cutthroat"
    ? [21, 14, 10, 5, 0]
    : [21, 14, 10, 7, 5];
  return goals[Math.min(kingCount, goals.length - 1)];
}

function formatAction(action) {
  if (!gameState || myPlayerIndex === null) return action;

  const game = gameState.game;
  const myPlayer = game.players[myPlayerIndex];
  const parts = action.split(":");

  const findCard = (id) => {
    const cardId = parseInt(id);
    for (const c of myPlayer.hand) {
      if (c.id === cardId) return cardToDisplay(c);
    }
    for (const p of game.players) {
      for (const pc of p.pointCards) {
        if (pc.card.id === cardId) return cardToDisplay(pc.card);
        for (const j of pc.attachedJacks) {
          if (j.id === cardId) return cardToDisplay(j);
        }
      }
      for (const perm of p.permanents) {
        if (perm.card.id === cardId) return cardToDisplay(perm.card);
      }
    }
    for (const c of game.scrap) {
      if (c.id === cardId) return cardToDisplay(c);
    }
    return `#${id}`;
  };

  switch (parts[0]) {
    case "draw":
      return "Draw a card";
    case "pass":
      return "Pass";
    case "point":
      return `Play ${findCard(parts[1])} for points`;
    case "oneoff":
      if (parts[2] === "target") {
        return `Play ${findCard(parts[1])} one-off → Player ${parts[3]}`;
      }
      if (parts.length > 3) {
        return `Play ${findCard(parts[1])} one-off → ${findCard(parts[3])}`;
      }
      return `Play ${findCard(parts[1])} one-off`;
    case "permanent":
      if (parts.length > 2) {
        return `Play ${findCard(parts[1])} (Jack) on ${findCard(parts[2])}`;
      }
      return `Play ${findCard(parts[1])} permanent`;
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
      return "Scrap the drawn card (can't play it)";
    case "joker":
      return `Use 🃏 Joker to steal ${findCard(parts[2])}`;
    default:
      if (parts[0].startsWith("seven_")) {
        const subType = parts[0].replace("seven_", "");
        return `(7) ${formatAction(subType + ":" + parts.slice(1).join(":"))}`;
      }
      return action;
  }
}

function showPrompt() {
  if (!connected) return;

  if (!gameState || !gameState.gameStarted) {
    rl.question("Waiting for players... (Ctrl+C to quit): ", handleInput);
    return;
  }

  const game = gameState.game;

  if (game.winner !== null || game.isDraw) {
    rl.question('Game over! Type "reset" or "quit": ', handleInput);
    return;
  }

  const myActions = validActions[myPlayerIndex] || [];

  if (myActions.length > 0) {
    console.log("\n📋 Your actions:");
    myActions.forEach((action, i) => {
      console.log(`   ${i + 1}. ${formatAction(action)}`);
    });
    rl.question("\nChoose action (number) or 'help': ", handleInput);
  } else {
    rl.question("Waiting for your turn... (type 'help'): ", handleInput);
  }
}

function handleInput(input) {
  const cmd = input.trim().toLowerCase();

  if (cmd === "help") {
    console.log("\nCommands:");
    console.log("  1-N     - Make a move (enter the action number)");
    console.log("  reset   - Reset the game");
    console.log("  rules   - Show game rules");
    console.log("  quit    - Exit the game");
    console.log("");
    showPrompt();
    return;
  }

  if (cmd === "rules") {
    showRules();
    showPrompt();
    return;
  }

  if (cmd === "quit" || cmd === "exit") {
    console.log("\nGoodbye! 👋\n");
    socket.close();
    process.exit(0);
    return;
  }

  if (cmd === "reset") {
    resetGame();
    return;
  }

  // Try to parse as action number
  const myActions = validActions[myPlayerIndex] || [];
  const choice = parseInt(cmd) - 1;

  if (!isNaN(choice) && choice >= 0 && choice < myActions.length) {
    makeMove(myActions[choice]);
  } else if (myActions.length > 0) {
    console.log("Invalid choice. Enter a number from the list.");
    showPrompt();
  } else {
    showPrompt();
  }
}

function showRules() {
  const isCutthroat = gameState && gameState.variant === "cutthroat";
  if (isCutthroat) {
    console.log(`
╔══════════════════════════════════════════════════════════════════╗
║               CUTTLE RULES (Cutthroat - 3 Players)               ║
╠══════════════════════════════════════════════════════════════════╣
║ OBJECTIVE: Be first to accumulate 14+ points in point cards.     ║
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
║   7  - Reveal top 2, choose 1 to play                            ║
║   9  - Return PERMANENT + owner SKIPS next turn                  ║
║                                                                  ║
║ PERMANENTS:                                                      ║
║   8  - "Glasses" - Peek one opponent's hand at any time                 ║
║   J  - Steal control of point card (adjacent only)               ║
║   Q  - Protect your other cards from targeting                   ║
║   K  - Reduce goal: 14 → 9 → 5 → 0                        ║
║   🃏  - JOKER: Steal a royal (J, Q, K)                    ║
║                                                                  ║
║ SCUTTLING: Use higher card to destroy opponent's point card.     ║
╚══════════════════════════════════════════════════════════════════╝
`);
  } else {
    console.log(`
╔══════════════════════════════════════════════════════════════════╗
║                        CUTTLE RULES                              ║
╠══════════════════════════════════════════════════════════════════╣
║ OBJECTIVE: Be first to accumulate 21+ points in point cards.     ║
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
║ SCUTTLING: Use a higher card to destroy opponent's point card.   ║
║   Suits break ties: ♣ < ♦ < ♥ < ♠                                ║
╚══════════════════════════════════════════════════════════════════╝
`);
  }
}

// Start
console.log("How to play:");
console.log("  • Enter action number to play");
console.log('  • Type "help" for commands');
console.log('  • Type "rules" for game rules');
console.log('  • Type "quit" to exit\n');

connect();

// Handle Ctrl+C
process.on("SIGINT", () => {
  console.log("\n\nGoodbye! 👋\n");
  if (socket) socket.close();
  process.exit(0);
});
