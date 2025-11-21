/*
 * examples/blackjack/client.js
 * Interactive Terminal Client
 * FIXED: Rendering stability and Prompt handling
 */
import { Engine } from '../../engine/Engine.js';
import { MultiplayerBlackjackGame } from './multiplayer-game.js';
import readline from 'readline';

const playerName = process.argv[2] || "Alice";

async function main() {
  const engine = new Engine();
  const game = new MultiplayerBlackjackGame(engine, { 
      isHost: false,
      numPlayers: 2, 
      playerNames: ["Alice", "Bob"] 
  });

  console.log(`🔌 Connecting as [${playerName}]...`);
  engine.connect("ws://localhost:9090");

  engine.on("state:updated", () => {
    const remotePlayers = engine.session.state.players;
    if (remotePlayers) {
        engine._players.forEach(p => {
            const remote = remotePlayers[p.name];
            if (remote) {
                p.resources.bankroll = remote.bankroll;
                p.resources.currentBet = remote.currentBet;
            }
        });
    }
    render(engine, game);
    checkTurn(engine, game, rl);
  });

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });

  await new Promise(r => setTimeout(r, 1000));
  render(engine, game);
}

// --- UI LOGIC ---

let lastRender = "";
let waitingForInput = false; // Track if we are stuck at a prompt

function render(engine, game) {
    // 1. Generate the View String
    let output = "";
    output += `🃏 HYPERTOKEN BLACKJACK | Player: ${playerName}\n`;
    output += `──────────────────────────────────────────────\n`;

    const dealerCards = engine.table.zone("dealer-hand") || [];
    const dealerStr = dealerCards.map(c => c.faceUp ? `[${c.tokenSnapshot.label}]` : `[🂠]`).join(" ");
    output += `\n🤖 DEALER:\n   ${dealerStr || "(waiting)"}\n`;

    engine._players.forEach(p => {
        const cards = engine.table.zone(p.handZone) || [];
        const cardStr = cards.map(c => `[${c.tokenSnapshot.label}]`).join(" ");
        const isActive = (engine.loop.activePlayer?.name === p.name && engine.loop.running);
        const activeMarker = isActive ? "👈 ACTIVE" : "";
        
        output += `\n👤 ${p.name} ($${p.resources.bankroll}) [Bet: $${p.resources.currentBet}] ${activeMarker}\n`;
        output += `   ${cardStr || "(empty)"}\n`;
    });

    output += `\n──────────────────────────────────────────────\n`;
    output += `Phase: ${engine.loop.phase} | Turn: ${engine.loop.turn}\n`;

    // 2. Dirty Check: Only clear/redraw if something changed
    if (output !== lastRender) {
        console.clear();
        console.log(output);
        lastRender = output;
        
        // If we were waiting for input, the clear() just wiped our prompt.
        // We need to reprint instructions, but we can't re-call rl.question easily.
        if (waitingForInput) {
            console.log("\n(Updated) 🔔 IT IS YOUR TURN! Action? (h)it / (s)tand / (b)et <amt>");
        }
    }
}

function checkTurn(engine, game, rl) {
    const active = engine.loop.activePlayer;
    
    // Check if it's our turn
    if (engine.loop.running && active && active.name === playerName) {
        
        // If we are already waiting for input, don't spawn another listener
        if (waitingForInput) return;

        waitingForInput = true;
        console.log("\n🔔 IT IS YOUR TURN!");
        
        rl.question("Action? (h)it / (s)tand / (b)et <amt>: ", (answer) => {
            waitingForInput = false; // Input received
            
            const cmd = answer.trim().toLowerCase();
            const [verb, arg] = cmd.split(" ");

            if (verb === 'h') {
                game.hit();
            } 
            else if (verb === 's') {
                game.stand();
            }
            else if (verb === 'b') {
                const amount = parseInt(arg) || 10;
                const p = engine._players.find(p => p.name === playerName);
                if (p) p.resources.currentBet = amount; 
                console.log(`Placed bet: $${amount}`);
            }
        });
    } else {
        // Not our turn
        waitingForInput = false;
    }
}

main();