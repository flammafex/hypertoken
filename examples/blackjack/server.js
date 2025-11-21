/*
 * examples/blackjack/server.js
 * Fixed: Debounced round management
 */
import { Engine } from '../../engine/Engine.js';
import { RelayServer } from '../../interface/RelayServer.js';
import { MultiplayerBlackjackGame } from './multiplayer-game.js';

async function main() {
  console.log("╔══════════════════════════════════════════╗");
  console.log("║  HYPERTOKEN BLACKJACK SERVER (HOST)      ║");
  console.log("╚══════════════════════════════════════════╝");

  const engine = new Engine();
  const server = new RelayServer(engine, { port: 9090, verbose: false });
  await server.start();
  
  engine.connect("ws://localhost:9090");

  const game = new MultiplayerBlackjackGame(engine, {
    isHost: true,
    numPlayers: 2,
    playerNames: ["Alice", "Bob"],
    initialBankroll: 1000
  });

  setInterval(() => {
    let hasChanges = false;
    const currentDoc = engine.session.state;
    
    engine._players.forEach(p => {
      const remote = currentDoc.players?.[p.name];
      if (!remote || 
          remote.bankroll !== p.resources.bankroll || 
          remote.currentBet !== p.resources.currentBet ||
          remote.active !== p.active) {
        hasChanges = true;
      }
    });

    if (hasChanges) {
      engine.session.change("sync players", (doc) => {
        if (!doc.players) doc.players = {};
        engine._players.forEach(p => {
          if (!doc.players[p.name]) {
            doc.players[p.name] = {
              bankroll: p.resources.bankroll,
              currentBet: p.resources.currentBet,
              active: p.active
            };
          } else {
            doc.players[p.name].bankroll = p.resources.bankroll;
            doc.players[p.name].currentBet = p.resources.currentBet;
            doc.players[p.name].active = p.active;
          }
        });
      });
    }
  }, 500);

  console.log("\n⏳ Waiting for 2 players to connect...");

  const checkConnections = setInterval(() => {
    if (server.clients.size >= 3) {
        clearInterval(checkConnections);
        startGameSequence(engine, game);
    } else {
        const joined = Math.max(0, server.clients.size - 1);
        process.stdout.write(`\r   Players joined: ${joined}/2`);
    }
  }, 1000);
}

// Flag to prevent overlapping round logic
let roundTransitioning = false;

function startGameSequence(engine, game) {
    console.log("\n\n✅ All players connected! Starting in 3 seconds...");

    setTimeout(() => {
        console.log("🎲 Placing initial bets (Auto-Ante $10)...");
        engine._players.forEach(p => {
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
        
        if (phase === "dealer" || e.payload.reason === "no_players") {
            roundTransitioning = true; // LOCK
            
            console.log("\n🛑 All players finished. Dealer's turn.");
            game.playDealer();
            
            console.log("⏳ Next round in 10 seconds...");
            
            setTimeout(() => {
                console.log("\n🎰 NEW ROUND - Place your bets!");
                
                engine._players.forEach(p => p.resources.currentBet = 0);
                
                setTimeout(() => {
                    let autoBet = false;
                    engine._players.forEach(p => {
                        if (p.resources.currentBet === 0 && p.resources.bankroll >= 10) {
                            p.resources.currentBet = 10;
                            autoBet = true;
                        }
                    });
                    if (autoBet) console.log("🎲 Auto-bets placed for slow players.");
                    
                    console.log("🚀 Dealing...");
                    game.deal();
                    
                    roundTransitioning = false; // UNLOCK
                }, 5000);
            }, 5000);
        }
    });
}

main();