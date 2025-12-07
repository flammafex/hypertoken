#!/usr/bin/env node
/**
 * HyperToken Universal Relay Server
 *
 * A unified relay server for HyperToken that supports two modes:
 * - Relay mode (default): Pure P2P signaling for WebRTC connections
 * - Authoritative mode: Game server with engine integration
 *
 * Usage:
 *   node start-relay.js [port]                    # Relay mode on specified port
 *   node start-relay.js --port 3000               # Explicit port
 *   node start-relay.js --mode authoritative      # Authoritative mode
 *   node start-relay.js --game ./path/to/game.js  # Load game module
 *   node start-relay.js --help                    # Show help
 *
 * Environment variables:
 *   PORT         - Server port (default: 3000)
 *   RELAY_MODE   - "relay" or "authoritative" (default: relay)
 *   GAME_MODULE  - Path to game module to load (enables authoritative mode)
 *   VERBOSE      - "true" for verbose logging
 */

import { UniversalRelayServer } from './dist/network/UniversalRelayServer.js';
import { Engine } from './dist/engine/Engine.js';

// Parse CLI arguments
function parseArgs() {
  const args = process.argv.slice(2);
  const config = {
    port: parseInt(process.env.PORT) || 3000,
    mode: process.env.RELAY_MODE || 'relay',
    gameModule: process.env.GAME_MODULE || null,
    verbose: process.env.VERBOSE === 'true',
    help: false
  };

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];

    if (arg === '--help' || arg === '-h') {
      config.help = true;
    } else if (arg === '--port' || arg === '-p') {
      config.port = parseInt(args[++i]) || 3000;
    } else if (arg === '--mode' || arg === '-m') {
      config.mode = args[++i] || 'relay';
    } else if (arg === '--game' || arg === '-g') {
      config.gameModule = args[++i];
    } else if (arg === '--verbose' || arg === '-v') {
      config.verbose = true;
    } else if (!isNaN(parseInt(arg))) {
      // Positional port argument for backwards compatibility
      config.port = parseInt(arg);
    }
  }

  // Game module implies authoritative mode
  if (config.gameModule) {
    config.mode = 'authoritative';
  }

  return config;
}

function showHelp() {
  console.log(`
HyperToken Universal Relay Server

USAGE:
  node start-relay.js [OPTIONS] [port]

OPTIONS:
  -p, --port <port>     Server port (default: 3000)
  -m, --mode <mode>     Server mode: "relay" or "authoritative"
  -g, --game <path>     Load game module (enables authoritative mode)
  -v, --verbose         Enable verbose logging
  -h, --help            Show this help message

ENVIRONMENT VARIABLES:
  PORT         Server port
  RELAY_MODE   Server mode
  GAME_MODULE  Path to game module
  VERBOSE      Enable verbose logging ("true")

MODES:
  relay (default)
    Pure P2P signaling relay for WebRTC connections.
    Routes messages between peers, handles WebRTC offer/answer/ICE.
    No game state management.

  authoritative
    Game server with engine integration.
    Handles 'describe' and 'dispatch' commands.
    Auto-broadcasts state changes to all clients.

EXAMPLES:
  # Start relay server on port 3000
  node start-relay.js

  # Start on custom port
  node start-relay.js 8080
  node start-relay.js --port 8080

  # Start authoritative server
  node start-relay.js --mode authoritative

  # Load a game module (tic-tac-toe example)
  node start-relay.js --game ./examples/network-tictactoe/game.js

DOCKER:
  docker run -p 3000:3000 hypertoken
  docker run -p 3000:3000 -e RELAY_MODE=authoritative hypertoken
`);
}

async function main() {
  const config = parseArgs();

  if (config.help) {
    showHelp();
    process.exit(0);
  }

  console.log('');
  console.log('╔══════════════════════════════════════════════════╗');
  console.log('║  HYPERTOKEN UNIVERSAL RELAY SERVER               ║');
  console.log('╚══════════════════════════════════════════════════╝');
  console.log('');

  let engine = null;

  // Set up engine for authoritative mode
  if (config.mode === 'authoritative') {
    engine = new Engine();

    // Add describe method if not present
    if (typeof engine.describe !== 'function') {
      engine.describe = function() {
        return {
          _gameState: this._gameState || null,
          history: this.history || []
        };
      };
    }

    // Load game module if specified
    if (config.gameModule) {
      console.log(`Loading game module: ${config.gameModule}`);
      try {
        await import(config.gameModule);
        console.log('Game module loaded successfully');
      } catch (err) {
        console.error(`Failed to load game module: ${err.message}`);
        process.exit(1);
      }
    }
  }

  // Create and start server
  const server = new UniversalRelayServer({
    port: config.port,
    mode: config.mode,
    engine,
    verbose: config.verbose
  });

  try {
    await server.start();

    console.log('');
    console.log(`Mode: ${config.mode.toUpperCase()}`);
    console.log(`Port: ${config.port}`);
    console.log(`URL:  ws://localhost:${config.port}`);
    console.log('');

    if (config.mode === 'relay') {
      console.log('Relay mode: Routing P2P messages and WebRTC signaling');
    } else {
      console.log('Authoritative mode: Handling describe/dispatch commands');
      if (config.gameModule) {
        console.log(`Game: ${config.gameModule}`);
      }
    }

    console.log('');
    console.log('Press Ctrl+C to stop');
    console.log('');

  } catch (err) {
    console.error('Failed to start server:', err.message);
    process.exit(1);
  }

  // Graceful shutdown
  process.on('SIGINT', () => {
    console.log('\n\nShutting down...');
    server.stop();
    process.exit(0);
  });

  process.on('SIGTERM', () => {
    server.stop();
    process.exit(0);
  });
}

main();
