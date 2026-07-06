/*
 * examples/blackjack/client.js
 * Interactive Terminal Client
 * FIXED: Rendering stability and Prompt handling
 */
import { Engine } from '../../engine/Engine.js';
import { MultiagentBlackjackGame } from './multiagent-game.js';
import { canDoubleDown, canSplit, canTakeInsurance } from './blackjack-utils.js';
import readline from 'readline';

const agentName = process.argv[2] || "Alice";

async function main() {
  const engine = new Engine();
  const game = new MultiagentBlackjackGame(engine, { 
      isHost: false,
      numAgents: 2, 
      agentNames: ["Alice", "Bob"] 
  });

  console.log(`🔌 Connecting as [${agentName}]...`);
  engine.connect("ws://localhost:9090");

  engine.on("state:updated", () => {
    // Agent resources are loaded from the CRDT document by the game's
    // loadFromChronicle() hook (registered in the BlackjackGame constructor).
    // No manual mirroring required here — just re-render and check turn.
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
    output += `🃏 HYPERTOKEN BLACKJACK | Agent: ${agentName}\n`;
    output += `──────────────────────────────────────────────\n`;

    const dealerCards = engine.space.zone("dealer-hand") || [];
    const dealerStr = dealerCards.map(c => c.faceUp ? `[${c.tokenSnapshot.label}]` : `[🂠]`).join(" ");
    output += `\n🤖 DEALER:\n   ${dealerStr || "(waiting)"}\n`;

    engine._agents.forEach(p => {
        const cards = engine.space.zone(p.handZone) || [];
        const cardStr = cards.map(c => `[${c.tokenSnapshot.label}]`).join(" ");
        const isActive = (engine.loop.activeAgent?.name === p.name && engine.loop.running);
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
    const active = engine.loop.activeAgent;

    // Check if it's our turn
    if (engine.loop.running && active && active.name === agentName) {

        // If we are already waiting for input, don't spawn another listener
        if (waitingForInput) return;

        waitingForInput = true;

        // Get current hand and determine available actions
        const agent = engine._agents.find(p => p.name === agentName);
        const handZone = agent?.handZone;
        const cards = handZone ? engine.space.zone(handZone).map(p => p.tokenSnapshot) : [];
        const dealerCards = engine.space.zone("dealer-hand").map(p => p.tokenSnapshot);

        // Determine available actions
        const canDouble = canDoubleDown(cards) && agent.resources.bankroll >= agent.resources.currentBet;
        const canSplitHand = canSplit(cards) && agent.resources.bankroll >= agent.resources.currentBet;
        const canInsurance = canTakeInsurance(dealerCards) && agent.resources.bankroll >= agent.resources.currentBet / 2 && !agent.resources.insuranceBet;

        console.log("\n🔔 IT IS YOUR TURN!");

        // Build action prompt
        let actions = "(h)it / (s)tand";
        if (canDouble) actions += " / (d)ouble";
        if (canSplitHand) actions += " / sp(l)it";
        if (canInsurance) actions += " / (i)nsurance";
        actions += " / (b)et <amt>";

        rl.question(`Action? ${actions}: `, (answer) => {
            waitingForInput = false; // Input received

            const cmd = answer.trim().toLowerCase();
            const [verb, arg] = cmd.split(" ");

            if (verb === 'h') {
                game.hit();
            }
            else if (verb === 's') {
                game.stand();
            }
            else if (verb === 'd' && canDouble) {
                console.log("💎 Doubling down!");
                game.doubleDown();
            }
            else if (verb === 'l' && canSplitHand) {
                console.log("✂️ Splitting hand!");
                game.split();
            }
            else if (verb === 'i' && canInsurance) {
                console.log("🛡️ Taking insurance!");
                game.takeInsurance();
            }
            else if (verb === 'b') {
                const amount = parseInt(arg) || 10;
                const p = engine._agents.find(p => p.name === agentName);
                if (p) p.resources.currentBet = amount;
                game.syncToChronicle();
                console.log(`Placed bet: $${amount}`);
            }
            else {
                console.log("❌ Invalid action or action not available");
            }
        });
    } else {
        // Not our turn
        waitingForInput = false;
    }
}

main();