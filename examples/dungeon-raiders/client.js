import WebSocket from 'ws';
import readline from 'readline';
import { TILES } from './game.js';

const SERVER_URL = process.env.SERVER_URL || 'ws://localhost:8080';

class DungeonRaidersClient {
  constructor(playerName) {
    this.playerName = playerName;
    this.socket = null;
    this.clientId = null;
    this.gameState = null;
    this.messageOffset = 0;
    this.connected = false;
    this.hasJoined = false;

    // Setup readline interface
    this.rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    });

    // Handle keypress for movement
    readline.emitKeypressEvents(process.stdin);
    if (process.stdin.isTTY) {
      process.stdin.setRawMode(true);
    }
  }

  connect() {
    console.log(`🔌 Connecting to ${SERVER_URL}...`);
    this.socket = new WebSocket(SERVER_URL);

    this.socket.on('open', () => {
      this.connected = true;
      console.log('✅ Connected to server!');
    });

    this.socket.on('message', (data) => {
      const msg = JSON.parse(data.toString());
      this.handleMessage(msg);
    });

    this.socket.on('close', () => {
      console.log('\n❌ Connection closed');
      this.cleanup();
      process.exit(0);
    });

    this.socket.on('error', (error) => {
      console.error('❌ Connection error:', error.message);
      this.cleanup();
      process.exit(1);
    });
  }

  handleMessage(msg) {
    switch (msg.cmd) {
      case 'welcome':
        this.clientId = msg.clientId;
        this.gameState = msg.state.gameState;
        this.showWelcomeScreen();
        this.joinGame();
        break;

      case 'state':
      case 'describe':  // backwards compatibility
        this.gameState = msg.state.gameState;
        if (this.hasJoined) {
          this.render();
        }
        break;

      case 'error':
        // Error already displayed in game log, just re-render
        if (this.hasJoined) {
          this.render();
        }
        break;
    }
  }

  showWelcomeScreen() {
    console.clear();
    console.log('╔═══════════════════════════════════════════════════════════╗');
    console.log('║                                                           ║');
    console.log('║         🏰  TERMINAL DUNGEON RAIDERS  ⚔️                  ║');
    console.log('║                                                           ║');
    console.log('║              A HyperToken Multiplayer Demo                ║');
    console.log('║                                                           ║');
    console.log('╚═══════════════════════════════════════════════════════════╝');
    console.log('');
    console.log('  🎮 Controls:');
    console.log('     Arrow Keys / WASD - Move');
    console.log('     Q - Quit');
    console.log('');
    console.log('  📜 Legend:');
    console.log(`     ${TILES.PLAYER} - You and other players`);
    console.log(`     M - Monsters (g=Goblin, o=Orc, T=Troll, D=Dragon)`);
    console.log(`     ${TILES.TREASURE} - Treasure`);
    console.log(`     ${TILES.EXIT} - Exit (defeat all monsters first!)`);
    console.log(`     ${TILES.WALL} - Wall`);
    console.log(`     ${TILES.FLOOR} - Floor`);
    console.log('');
    console.log('  🎯 Goal: Explore the dungeon, defeat monsters, collect');
    console.log('           treasure, and find the exit!');
    console.log('');
  }

  joinGame() {
    setTimeout(() => {
      this.dispatch('player:join', {
        clientId: this.clientId,
        name: this.playerName
      });
      this.hasJoined = true;
      this.setupControls();
      this.render();
    }, 1000);
  }

  setupControls() {
    process.stdin.on('keypress', (str, key) => {
      if (!this.gameState || !this.connected) return;

      const player = this.gameState.players[this.clientId];
      if (!player || !player.alive) return;

      let direction = null;

      // Map keys to directions
      if (key.name === 'up' || key.name === 'w') direction = 'up';
      else if (key.name === 'down' || key.name === 's') direction = 'down';
      else if (key.name === 'left' || key.name === 'a') direction = 'left';
      else if (key.name === 'right' || key.name === 'd') direction = 'right';
      else if (key.name === 'q' || (key.ctrl && key.name === 'c')) {
        this.quit();
        return;
      }

      if (direction) {
        this.dispatch('player:move', {
          clientId: this.clientId,
          direction
        });
      }
    });
  }

  dispatch(type, payload) {
    if (this.socket && this.connected) {
      this.socket.send(JSON.stringify({
        cmd: 'dispatch',
        type,
        payload
      }));
    }
  }

  render() {
    if (!this.gameState) return;

    console.clear();

    // Header
    console.log('╔═══════════════════════════════════════════════════════════╗');
    console.log('║         🏰  TERMINAL DUNGEON RAIDERS  ⚔️                  ║');
    console.log('╚═══════════════════════════════════════════════════════════╝');
    console.log('');

    // Render dungeon
    this.renderDungeon();

    console.log('');

    // Player stats
    this.renderPlayerStats();

    console.log('');

    // Recent messages (last 5)
    this.renderMessages();

    console.log('');
    console.log('─────────────────────────────────────────────────────────────');
    console.log('  Arrow Keys/WASD: Move  |  Q: Quit');
    console.log('─────────────────────────────────────────────────────────────');
  }

  renderDungeon() {
    const dungeon = this.gameState.dungeon;
    const entities = this.gameState.entities;
    const players = this.gameState.players;

    // Create display grid
    const display = dungeon.map(row => [...row]);

    // Place entities
    entities.forEach(entity => {
      if (entity.type === 'monster' && entity.hp > 0) {
        display[entity.y][entity.x] = entity.char;
      } else if (entity.type === 'treasure') {
        display[entity.y][entity.x] = TILES.TREASURE;
      } else if (entity.type === 'exit') {
        display[entity.y][entity.x] = TILES.EXIT;
      }
    });

    // Place players (on top of everything)
    Object.values(players).forEach(player => {
      if (player.alive) {
        // Highlight current player differently
        if (player.id === this.clientId) {
          display[player.y][player.x] = '★'; // Star for you
        } else {
          display[player.y][player.x] = TILES.PLAYER;
        }
      }
    });

    // Draw with border
    console.log('  ┌' + '─'.repeat(display[0].length) + '┐');
    display.forEach(row => {
      console.log('  │' + row.join('') + '│');
    });
    console.log('  └' + '─'.repeat(display[0].length) + '┘');
  }

  renderPlayerStats() {
    const players = Object.values(this.gameState.players);

    console.log('  👥 Players:');
    players.forEach(player => {
      const isYou = player.id === this.clientId;
      const status = player.alive ? '💚' : '💀';
      const marker = isYou ? '→' : ' ';

      const hpBar = this.createHealthBar(player.hp, player.maxHp);
      console.log(
        `  ${marker} ${status} ${player.name.padEnd(12)} ` +
        `Lv${player.level} ${hpBar} ` +
        `💰${player.gold} ⭐${player.xp}`
      );
    });
  }

  createHealthBar(current, max, width = 10) {
    const filled = Math.floor((current / max) * width);
    const empty = width - filled;
    return '[' + '█'.repeat(Math.max(0, filled)) + '░'.repeat(Math.max(0, empty)) + ']';
  }

  renderMessages() {
    const messages = this.gameState.messages.slice(-5);
    console.log('  📜 Recent Events:');

    if (messages.length === 0) {
      console.log('     (waiting for events...)');
    } else {
      messages.forEach(msg => {
        console.log(`     • ${msg}`);
      });
    }
  }

  quit() {
    console.log('\n👋 Thanks for playing Dungeon Raiders!');
    this.cleanup();
    process.exit(0);
  }

  cleanup() {
    if (this.socket) {
      this.socket.close();
    }
    if (this.rl) {
      this.rl.close();
    }
    if (process.stdin.isTTY) {
      process.stdin.setRawMode(false);
    }
  }
}

// Get player name from command line or use default
const playerName = process.argv[2] || `Player${Math.floor(Math.random() * 1000)}`;

console.log('🎮 Starting Dungeon Raiders client...');
const client = new DungeonRaidersClient(playerName);
client.connect();

// Handle process termination
process.on('SIGINT', () => {
  client.quit();
});

process.on('uncaughtException', (error) => {
  console.error('❌ Error:', error.message);
  client.cleanup();
  process.exit(1);
});
