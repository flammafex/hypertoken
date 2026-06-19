#!/usr/bin/env node
/**
 * Cuttle CRDT Client — Serverless multiplayer with encrypted hands
 *
 * Uses Engine + ConsensusCore for CRDT sync (no authoritative server).
 * Uses E2EEncryption for hidden hand information.
 *
 * Usage:
 *   node --loader ../../test/ts-esm-loader.js crdt-client.js [relay-url] [--host]
 *
 * Examples:
 *   # Terminal 1 (host):
 *   node --loader ../../test/ts-esm-loader.js crdt-client.js ws://localhost:9091 --host
 *
 *   # Terminal 2 (client):
 *   node --loader ../../test/ts-esm-loader.js crdt-client.js ws://localhost:9091
 */

import readline from "readline";
import { Engine } from "../../engine/Engine.js";
import { E2EEncryption } from "../../network/E2EEncryption.js";
import {
  getGameInstance,
  setupCuttleSync,
  configureEncryption,
} from "./crdt-actions.js";

// Parse args
const args = process.argv.slice(2);
const RELAY_URL = args.find((a) => a.startsWith("ws://")) || "ws://localhost:9091";
const IS_HOST = args.includes("--host");
const MY_PEER_ID = `cuttle-${IS_HOST ? "host" : "client"}-${Date.now().toString(36)}`;
const HOST_PEER_ID_PREFIX = "cuttle-host-";

console.log("╔══════════════════════════════════════════════════════╗");
console.log("║    ⚔️  CUTTLE CRDT CLIENT (Serverless) ⚔️            ║");
console.log("╚══════════════════════════════════════════════════════╝\n");
console.log(`Role: ${IS_HOST ? "HOST (Player 0)" : "CLIENT (Player 1)"}`);
console.log(`Peer ID: ${MY_PEER_ID}`);
console.log(`Relay: ${RELAY_URL}\n`);

// --- State ---
let engine: any = null;
let e2e: E2EEncryption | null = null;
let hostPeerId: string | null = null;
let keysExchanged = false;
let gameStarted = false;
let myPlayerIndex = IS_HOST ? 0 : 1;
let validActions: string[] = [];
let lastTurnNumber = -1;

// --- Readline ---
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

// --- Card display helpers (from network-client.js) ---
function cardToDisplay(card: any): string {
  if (card.isJoker) return "🃏";
  const suitSymbols: Record<string, string> = {
    clubs: "♣", diamonds: "♦", hearts: "♥", spades: "♠",
  };
  return `${card.rank}${suitSymbols[card.suit] || "?"}`;
}

function getPoints(game: any, playerIndex: number): number {
  let points = 0;
  for (const player of game.players) {
    for (const pc of player.pointCards) {
      if (pc.controller === playerIndex) {
        const rank = pc.card.rank;
        if (rank === "A") points += 1;
        else if (["J", "Q", "K"].includes(rank)) points += 0;
        else points += parseInt(rank);
      }
    }
  }
  return points;
}

function getPointGoal(game: any, playerIndex: number): number {
  const kingCount = game.players[playerIndex].permanents.filter(
    (p: any) => p.type === "king"
  ).length;
  const goals = [21, 14, 10, 7, 5];
  return goals[Math.min(kingCount, goals.length - 1)];
}

// --- Key exchange over relay ---
async function exchangeKeys(peerId: string): Promise<void> {
  if (!e2e || keysExchanged) return;

  console.log(`🔑 Exchanging keys with ${peerId}...`);

  // Send our public key to the peer
  const keyMsg = e2e.createKeyExchangeMessage();
  if (!keyMsg) {
    console.error("Failed to create key exchange message");
    return;
  }

  // Send via the network layer
  const network = engine?.network;
  if (network) {
    network.sendToPeer(peerId, keyMsg);
  }
}

async function handleKeyExchangeMessage(msg: any): Promise<void> {
  if (!e2e || keysExchanged) return;

  const success = await e2e.handleKeyExchange(msg);
  if (success) {
    hostPeerId = msg.peerId;
    keysExchanged = true;
    console.log(`✅ Encryption established with ${msg.peerId}`);

    // Send our key back if we haven't already (for the host receiving first)
    const network = engine?.network;
    if (network && e2e.hasSession(msg.peerId)) {
      const myKeyMsg = e2e.createKeyExchangeMessage();
      if (myKeyMsg && !e2e.hasSession(MY_PEER_ID)) {
        // Only send if the other side might not have our key yet
        network.sendToPeer(msg.peerId, myKeyMsg);
      }
    }

    // Configure encryption on the engine
    const peerIds = IS_HOST
      ? [MY_PEER_ID, hostPeerId] // host is player 0, client is player 1
      : [hostPeerId, MY_PEER_ID]; // host is player 0, client is player 1

    configureEncryption(engine, e2e, {
      myPlayerIndex,
      hostPeerId: IS_HOST ? MY_PEER_ID : hostPeerId!,
      peerIds,
      isHost: IS_HOST,
    });

    console.log(`🔐 Encryption configured. ${IS_HOST ? "Host" : "Client"} ready.`);

    // If host, initialize the game
    if (IS_HOST) {
      console.log("\n🎮 Initializing game...");
      await engine.dispatch("cuttle:init", { seed: Math.floor(Math.random() * 1000000), variant: "classic" });
      gameStarted = true;
      updateDisplay();
      showPrompt();
    }
  }
}

// --- Rendering ---
function updateDisplay(): void {
  const game = getGameInstance(engine);
  if (!game) {
    console.log("Waiting for game state...\n");
    return;
  }

  const state = game.getState();

  console.clear();
  console.log("╔══════════════════════════════════════════════════════╗");
  console.log("║    ⚔️  CUTTLE CRDT (Serverless + Encrypted) ⚔️       ║");
  console.log("╚══════════════════════════════════════════════════════╝\n");

  console.log(`You are: Player ${myPlayerIndex}${myPlayerIndex === 1 ? " (goes first)" : " (host/dealer)"}`);
  console.log(`Encryption: ${keysExchanged ? "✅ Active" : "⏳ Pending"}`);
  console.log(`Sync: ${engine?.network ? "✅ Connected" : "❌ Disconnected"}`);

  if (!gameStarted && state.turnNumber === 0) {
    console.log("\n⏳ Waiting for game to start...\n");
    return;
  }

  gameStarted = true;

  console.log("─".repeat(55));
  console.log(`Turn: ${state.turnNumber} | Phase: ${state.phase}`);
  console.log(`Deck: ${state.deck.length} cards | Scrap: ${state.scrap.length} cards`);
  console.log("─".repeat(55));

  // Show opponent
  for (let i = 0; i < state.players.length; i++) {
    if (i === myPlayerIndex) continue;

    const player = state.players[i];
    const isCurrentTurn = state.currentPlayer === i;
    const turnMarker = isCurrentTurn ? " ← TURN" : "";

    console.log(`\n👤 OPPONENT (Player ${i})${turnMarker}:`);
    console.log(`   Points: ${getPoints(state, i)}/${getPointGoal(state, i)}`);

    // Opponent hand — only show count (encrypted)
    const handCount = player.handCount ?? player.hand.length;
    console.log(`   Hand: ${handCount} cards (hidden)`);

    const pointDisplay = player.pointCards
      .filter((pc: any) => pc.controller === i)
      .map((pc: any) => {
        const jacks = pc.attachedJacks?.length > 0 ? `(J×${pc.attachedJacks.length})` : "";
        return cardToDisplay(pc.card) + jacks;
      })
      .join(" ");
    console.log(`   Point Cards: ${pointDisplay || "(none)"}`);

    const permDisplay = player.permanents.map((p: any) => cardToDisplay(p.card)).join(" ");
    console.log(`   Permanents: ${permDisplay || "(none)"}`);
  }

  // Your info
  const myPlayer = state.players[myPlayerIndex];
  const isMyTurn = state.currentPlayer === myPlayerIndex;
  const turnMarker = isMyTurn ? " ← YOUR TURN" : "";

  console.log(`\n🎮 YOU (Player ${myPlayerIndex})${turnMarker}:`);
  console.log(`   Points: ${getPoints(state, myPlayerIndex)}/${getPointGoal(state, myPlayerIndex)}`);

  // Your hand — show actual cards (decrypted)
  if (myPlayer.hand.length > 0) {
    console.log(`   Hand: ${myPlayer.hand.map(cardToDisplay).join(" ")}`);
  } else if (myPlayer.handCount) {
    console.log(`   Hand: ${myPlayer.handCount} cards (decrypting...)`);
  } else {
    console.log(`   Hand: (empty)`);
  }

  const myPointDisplay = myPlayer.pointCards
    .filter((pc: any) => pc.controller === myPlayerIndex)
    .map((pc: any) => {
      const jacks = pc.attachedJacks?.length > 0 ? `(J×${pc.attachedJacks.length})` : "";
      return cardToDisplay(pc.card) + jacks;
    })
    .join(" ");
  console.log(`   Point Cards: ${myPointDisplay || "(none)"}`);

  const myPermDisplay = myPlayer.permanents.map((p: any) => cardToDisplay(p.card)).join(" ");
  console.log(`   Permanents: ${myPermDisplay || "(none)"}`);

  if (state.lastAction) {
    console.log(`\n📢 Last: ${state.lastAction}`);
  }

  console.log("─".repeat(55));

  // Game over
  if (state.winner !== null) {
    if (state.winner === myPlayerIndex) {
      console.log("\n🎉 YOU WIN! 🎉");
    } else {
      console.log(`\n😔 Player ${state.winner} wins. Better luck next time!`);
    }
  } else if (state.isDraw) {
    console.log("\n🤝 It's a draw!");
  }

  // Update valid actions
  validActions = game.getValidActions(myPlayerIndex);
  lastTurnNumber = state.turnNumber;
}

// --- Action formatting (from network-client.js) ---
function formatAction(action: string): string {
  const game = getGameInstance(engine);
  if (!game) return action;

  const state = game.getState();
  const myPlayer = state.players[myPlayerIndex];
  const parts = action.split(":");

  const findCard = (id: string): string => {
    const cardId = parseInt(id);
    for (const c of myPlayer.hand) {
      if (c.id === cardId) return cardToDisplay(c);
    }
    for (const p of state.players) {
      for (const pc of p.pointCards) {
        if (pc.card.id === cardId) return cardToDisplay(pc.card);
        for (const j of pc.attachedJacks || []) {
          if (j.id === cardId) return cardToDisplay(j);
        }
      }
      for (const perm of p.permanents) {
        if (perm.card.id === cardId) return cardToDisplay(perm.card);
      }
    }
    for (const c of state.scrap) {
      if (c.id === cardId) return cardToDisplay(c);
    }
    return `#${id}`;
  };

  switch (parts[0]) {
    case "draw": return "Draw a card";
    case "pass": return "Pass";
    case "point": return `Play ${findCard(parts[1])} for points`;
    case "oneoff":
      if (parts[2] === "target") return `Play ${findCard(parts[1])} one-off → Player ${parts[3]}`;
      if (parts.length > 3) return `Play ${findCard(parts[1])} one-off → ${findCard(parts[3])}`;
      return `Play ${findCard(parts[1])} one-off`;
    case "permanent":
      if (parts.length > 2) return `Play ${findCard(parts[1])} (Jack) on ${findCard(parts[2])}`;
      return `Play ${findCard(parts[1])} permanent`;
    case "scuttle": return `Scuttle ${findCard(parts[2])} with ${findCard(parts[1])}`;
    case "counter": return `Counter with ${findCard(parts[1])}`;
    case "choose": return `Retrieve ${findCard(parts[1])} from scrap`;
    case "discard": return `Discard ${findCard(parts[1])}`;
    case "five_discard": return `Discard ${findCard(parts[1])} (then draw 3)`;
    case "scrap_seven":
      if (parts.length > 1) return `Scrap ${findCard(parts[1])} (can't play it)`;
      return "Scrap the drawn card (can't play it)";
    case "joker": return `Use 🃏 Joker to steal ${findCard(parts[2])}`;
    default:
      if (parts[0].startsWith("seven_")) {
        const subType = parts[0].replace("seven_", "");
        return `(7) ${formatAction(subType + ":" + parts.slice(1).join(":"))}`;
      }
      return action;
  }
}

// --- Input handling ---
function showPrompt(): void {
  if (!gameStarted) {
    rl.question("Waiting for game... (Ctrl+C to quit): ", handleInput);
    return;
  }

  const game = getGameInstance(engine);
  if (!game) {
    rl.question("Waiting for state... (Ctrl+C to quit): ", handleInput);
    return;
  }

  const state = game.getState();

  if (state.winner !== null || state.isDraw) {
    rl.question('Game over! Type "quit": ', handleInput);
    return;
  }

  if (validActions.length > 0) {
    console.log("\n📋 Your actions:");
    validActions.forEach((action, i) => {
      console.log(`   ${i + 1}. ${formatAction(action)}`);
    });
    rl.question("\nChoose action (number) or 'help': ", handleInput);
  } else {
    rl.question("Waiting for your turn... (type 'help'): ", handleInput);
  }
}

async function handleInput(input: string): Promise<void> {
  const cmd = input.trim().toLowerCase();

  if (cmd === "help") {
    console.log("\nCommands:");
    console.log("  1-N     - Make a move (enter the action number)");
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
    engine?.disconnect();
    process.exit(0);
    return;
  }

  // Try to parse as action number
  const choice = parseInt(cmd) - 1;

  if (!isNaN(choice) && choice >= 0 && choice < validActions.length) {
    const action = validActions[choice];
    console.log(`\n📤 Sending action: ${formatAction(action)}`);

    try {
      await engine.dispatch("cuttle:action", {
        action,
        playerIndex: myPlayerIndex,
        expectedTurnNumber: lastTurnNumber,
      });
      // State update will trigger re-render via the state:updated listener
    } catch (err: any) {
      console.error(`\n❌ Action failed: ${err.message}\n`);
    }
    // Don't call showPrompt here — the state:updated event will trigger updateDisplay + showPrompt
  } else if (validActions.length > 0) {
    console.log("Invalid choice. Enter a number from the list.");
    showPrompt();
  } else {
    showPrompt();
  }
}

function showRules(): void {
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

// --- Main setup ---
async function main(): Promise<void> {
  console.log("How to play:");
  console.log("  • Enter action number to play");
  console.log('  • Type "help" for commands');
  console.log('  • Type "rules" for game rules');
  console.log('  • Type "quit" to exit\n');

  // Create engine with TS-only path (required for CRDT sync)
  engine = new Engine({ disableWasm: true });

  // Set up sync listener
  setupCuttleSync(engine);

  // Set up encryption
  e2e = new E2EEncryption();
  await e2e.initialize(MY_PEER_ID);

  // Listen for state updates to re-render
  engine.on("state:updated", () => {
    if (gameStarted || getGameInstance(engine)) {
      gameStarted = true;
      updateDisplay();
      showPrompt();
    }
  });

  // Listen for network messages (for key exchange)
  const network = engine.network;
  if (network) {
    network.on("net:message", async (evt: any) => {
      const payload = evt?.payload || evt;
      if (payload?.type === "key-exchange") {
        await handleKeyExchangeMessage(payload);
      }
    });

    // When a peer connects, exchange keys
    network.on("net:peer:connected", async (evt: any) => {
      const peerId = evt?.payload?.peerId || evt?.peerId;
      if (peerId) {
        console.log(`👋 Peer connected: ${peerId}`);
        // Wait a moment for connection to stabilize
        await new Promise((r) => setTimeout(r, 200));
        await exchangeKeys(peerId);
      }
    });
  }

  // Connect to relay
  console.log(`Connecting to ${RELAY_URL}...`);
  engine.connect(RELAY_URL);

  // For host: if no peer connects within 30 seconds, offer to play alone
  if (IS_HOST) {
    setTimeout(() => {
      if (!keysExchanged) {
        console.log("\n⏳ Still waiting for a peer to connect...");
        console.log("   Run this in another terminal:");
        console.log(`   node --loader ../../test/ts-esm-loader.js crdt-client.js ${RELAY_URL}\n`);
      }
    }, 5000);
  }
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});

// Handle Ctrl+C
process.on("SIGINT", () => {
  console.log("\n\nGoodbye! 👋\n");
  engine?.disconnect();
  process.exit(0);
});
