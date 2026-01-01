/*
 * examples/blackjack/server.js
 * Fixed: Debounced round management
 */
import { Engine } from '../../engine/Engine.js';
import { UniversalRelayServer } from '../../network/UniversalRelayServer.js';
import { MultiagentBlackjackGame } from './multiagent-game.js';

async function main() {
  console.log("╔══════════════════════════════════════════╗");
  console.log("║  HYPERTOKEN BLACKJACK SERVER (HOST)      ║");
  console.log("╚══════════════════════════════════════════╝");

  // Start relay server for P2P sync
  const server = new UniversalRelayServer({ port: 9090, verbose: false });
  await server.start();

  // Host engine connects as a peer
  const engine = new Engine();
  engine.connect("ws://localhost:9090");

  const game = new MultiagentBlackjackGame(engine, {
    isHost: true,
    numAgents: 2,
    agentNames: ["Alice", "Bob"],
    initialBankroll: 1000
  });

  setInterval(() => {
    let hasChanges = false;
    const currentDoc = engine.session.state;
    
    engine._agents.forEach(p => {
      const remote = currentDoc.agents?.[p.name];
      if (!remote || 
          remote.bankroll !== p.resources.bankroll || 
          remote.currentBet !== p.resources.currentBet ||
          remote.active !== p.active) {
        hasChanges = true;
      }
    });

    if (hasChanges) {
      engine.session.change("sync agents", (doc) => {
        if (!doc.agents) doc.agents = {};
        engine._agents.forEach(p => {
          if (!doc.agents[p.name]) {
            doc.agents[p.name] = {
              bankroll: p.resources.bankroll,
              currentBet: p.resources.currentBet,
              active: p.active
            };
          } else {
            doc.agents[p.name].bankroll = p.resources.bankroll;
            doc.agents[p.name].currentBet = p.resources.currentBet;
            doc.agents[p.name].active = p.active;
          }
        });
      });
    }
  }, 500);

  console.log("\n⏳ Waiting for 2 agents to connect...");

  const checkConnections = setInterval(() => {
    if (server.clientCount >= 3) {
        clearInterval(checkConnections);
        startGameSequence(engine, game);
    } else {
        const joined = Math.max(0, server.clientCount - 1);
        process.stdout.write(`\r   Agents joined: ${joined}/2`);
    }
  }, 1000);
}

// Flag to prevent overlapping round logic
let roundTransitioning = false;

function startGameSequence(engine, game) {
    console.log("\n\n✅ All agents connected! Starting in 3 seconds...");

    setTimeout(() => {
        console.log("🎲 Placing initial bets (Auto-Ante $10)...");
        engine._agents.forEach(p => {
            p.resources.currentBet = 10;
        });

        setTimeout(() => {
            console.log("🚀 Initial Deal...");
            game.deal();
        }, 1000);

    }, 3000);

    engine.loop.on("loop:stop", async (e) => {
        // GUARD: If we are already transitioning, ignore this event
        if (roundTransitioning) return;

        const phase = e.payload.phase || engine.loop.phase;
        
        if (phase === "dealer" || e.payload.reason === "no_agents") {
            roundTransitioning = true; // LOCK
            
            console.log("\n🛑 All agents finished. Dealer's turn.");
            game.playDealer();
            
            console.log("⏳ Next round in 10 seconds...");
            
            setTimeout(() => {
                console.log("\n🎰 NEW ROUND - Place your bets!");
                
                engine._agents.forEach(p => p.resources.currentBet = 0);
                
                setTimeout(() => {
                    let autoBet = false;
                    engine._agents.forEach(p => {
                        if (p.resources.currentBet === 0 && p.resources.bankroll >= 10) {
                            p.resources.currentBet = 10;
                            autoBet = true;
                        }
                    });
                    if (autoBet) console.log("🎲 Auto-bets placed for slow agents.");
                    
                    console.log("🚀 Dealing...");
                    game.deal();
                    
                    roundTransitioning = false; // UNLOCK
                }, 5000);
            }, 5000);
        }
    });
}

main();