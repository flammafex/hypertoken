import { WebSocketServer } from 'ws';
import { Engine } from '../../engine/Engine.js';
import './game.js'; // Load custom actions

const PORT = process.env.PORT || 8080;

class DungeonRaidersServer {
  constructor(port = PORT) {
    this.port = port;
    this.engine = new Engine();
    this.clients = new Map();
    this.wss = null;

    // Enhanced describe function for game state
    this.engine.describe = function() {
      return {
        gameState: this._gameState,
        history: this.history.slice(-50) // Last 50 actions
      };
    };

    // Set up event listeners
    this.setupEventListeners();
  }

  setupEventListeners() {
    // Log all game events
    this.engine.on('dungeon:initialized', () => {
      console.log('🏰 Dungeon generated and ready for adventurers!');
    });

    this.engine.on('player:joined', (evt) => {
      console.log(`👤 ${evt.payload.player.name} joined the game`);
      this.broadcast();
    });

    this.engine.on('player:moved', (evt) => {
      this.broadcast();
    });

    this.engine.on('combat:occurred', (evt) => {
      this.broadcast();
    });

    this.engine.on('player:levelup', (evt) => {
      console.log(`⬆️  Player leveled up to ${evt.payload.level}`);
      this.broadcast();
    });

    this.engine.on('treasure:collected', (evt) => {
      console.log(`💰 Player collected ${evt.payload.gold} gold`);
      this.broadcast();
    });

    this.engine.on('player:died', (evt) => {
      console.log(`💀 Player ${evt.payload.clientId} has died`);
      this.broadcast();
    });

    this.engine.on('game:won', (evt) => {
      console.log(`🎉 Game won by ${evt.payload.winner}!`);
      this.broadcast();
    });

    this.engine.on('player:left', (evt) => {
      console.log(`👋 Player ${evt.payload.clientId} left the game`);
      this.broadcast();
    });
  }

  broadcast() {
    const state = this.engine.describe();
    const message = JSON.stringify({
      cmd: 'describe',
      state
    });

    this.clients.forEach((ws) => {
      if (ws.readyState === 1) { // WebSocket.OPEN
        ws.send(message);
      }
    });
  }

  async start() {
    // Initialize the dungeon
    console.log('🎮 Initializing Dungeon Raiders server...');
    await this.engine.dispatch('dungeon:init');

    // Create WebSocket server
    this.wss = new WebSocketServer({ port: this.port });

    this.wss.on('connection', (ws) => {
      const clientId = `client-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      this.clients.set(clientId, ws);

      console.log(`🔌 Client connected: ${clientId}`);

      // Send initial state
      ws.send(JSON.stringify({
        cmd: 'welcome',
        clientId,
        state: this.engine.describe()
      }));

      ws.on('message', async (data) => {
        try {
          const msg = JSON.parse(data.toString());

          if (msg.cmd === 'describe') {
            // Send current state
            ws.send(JSON.stringify({
              cmd: 'describe',
              state: this.engine.describe()
            }));
          } else if (msg.cmd === 'dispatch') {
            // Dispatch action to engine
            await this.engine.dispatch(msg.type, msg.payload);
          }
        } catch (error) {
          console.error('❌ Error handling message:', error.message);
          ws.send(JSON.stringify({
            cmd: 'error',
            message: error.message
          }));
          // Still broadcast state even on error to keep clients in sync
          this.broadcast();
        }
      });

      ws.on('close', async () => {
        console.log(`🔌 Client disconnected: ${clientId}`);
        this.clients.delete(clientId);

        // Remove player from game if they were playing
        try {
          await this.engine.dispatch('player:leave', { clientId });
        } catch (error) {
          // Player might not have joined yet
        }
      });

      ws.on('error', (error) => {
        console.error('❌ WebSocket error:', error);
      });
    });

    console.log(`✅ Dungeon Raiders server running on ws://localhost:${this.port}`);
    console.log(`📡 Waiting for adventurers to join...`);
  }
}

// Start the server
const server = new DungeonRaidersServer(PORT);
server.start().catch(console.error);

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('\n👋 Shutting down server...');
  process.exit(0);
});
