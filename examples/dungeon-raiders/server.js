#!/usr/bin/env node
/**
 * Dungeon Raiders Multiplayer Server
 *
 * Demonstrates extending AuthoritativeServer for a real-time
 * multiplayer game with server-authoritative state.
 */
import { Engine } from "../../engine/Engine.js";
import { AuthoritativeServer } from "../../network/AuthoritativeServer.js";
import "./game.js"; // Load custom actions

const PORT = process.env.PORT || 8080;

class DungeonRaidersServer extends AuthoritativeServer {
  constructor(engine, port) {
    super(engine, {
      port,
      verbose: true,
      broadcastOnAction: true,
    });

    // Set up game-specific event listeners
    this.setupGameEvents();
  }

  /**
   * Override to include full game state and recent history
   */
  getState() {
    return {
      gameState: this.engine._gameState,
      history: this.engine.history.slice(-50),
    };
  }

  /**
   * Handle player cleanup on disconnect
   */
  async onClientDisconnect(clientId) {
    console.log(`🔌 Client disconnected: ${clientId}`);

    // Remove player from game if they were playing
    try {
      await this.engine.dispatch("player:leave", { clientId });
    } catch (error) {
      // Player might not have joined yet - that's fine
    }
  }

  onClientConnect(clientId) {
    console.log(`🔌 Client connected: ${clientId}`);
  }

  /**
   * Set up game-specific event listeners for logging
   */
  setupGameEvents() {
    this.engine.on("dungeon:initialized", () => {
      console.log("🏰 Dungeon generated and ready for adventurers!");
    });

    this.engine.on("player:joined", (evt) => {
      console.log(`👤 ${evt.payload.player.name} joined the game`);
    });

    this.engine.on("player:levelup", (evt) => {
      console.log(`⬆️  Player leveled up to ${evt.payload.level}`);
    });

    this.engine.on("treasure:collected", (evt) => {
      console.log(`💰 Player collected ${evt.payload.gold} gold`);
    });

    this.engine.on("player:died", (evt) => {
      console.log(`💀 Player ${evt.payload.clientId} has died`);
    });

    this.engine.on("game:won", (evt) => {
      console.log(`🎉 Game won by ${evt.payload.winner}!`);
    });

    this.engine.on("player:left", (evt) => {
      console.log(`👋 Player ${evt.payload.clientId} left the game`);
    });
  }
}

// ─────────────────────────────────────────────────────────────
// Main
// ─────────────────────────────────────────────────────────────

async function main() {
  console.log("╔══════════════════════════════════════════════════════╗");
  console.log("║       🏰 DUNGEON RAIDERS MULTIPLAYER SERVER 🏰       ║");
  console.log("╚══════════════════════════════════════════════════════╝\n");

  // Create engine and initialize dungeon
  const engine = new Engine();

  console.log("🎮 Initializing dungeon...");
  await engine.dispatch("dungeon:init");

  // Create and start server
  const server = new DungeonRaidersServer(engine, PORT);
  await server.start();

  console.log(`\n📡 Waiting for adventurers to join...`);
  console.log(`   Connect with: npm run dungeon:client\n`);
}

main().catch(console.error);

// Graceful shutdown
process.on("SIGINT", () => {
  console.log("\n👋 Shutting down server...");
  process.exit(0);
});
