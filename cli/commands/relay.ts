/**
 * HyperToken Relay Server Command
 *
 * Starts the P2P relay server for WebRTC signaling and state synchronization.
 *
 * Modes:
 *   - relay (default): Pure P2P signaling for WebRTC connections
 *   - authoritative: Game server with engine integration
 */

import { UniversalRelayServer } from '../../network/UniversalRelayServer.js';
import { Engine } from '../../engine/Engine.js';

interface RelayOptions {
  port: number;
  mode: 'relay' | 'authoritative';
  gameModule: string | null;
  verbose: boolean;
}

function parseArgs(args: string[]): RelayOptions | null {
  const options: RelayOptions = {
    port: parseInt(process.env.PORT || '') || 3000,
    mode: (process.env.RELAY_MODE as 'relay' | 'authoritative') || 'relay',
    gameModule: process.env.GAME_MODULE || null,
    verbose: process.env.VERBOSE === 'true',
  };

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];

    switch (arg) {
      case '--help':
      case '-h':
        showHelp();
        return null;

      case '--port':
      case '-p':
        options.port = parseInt(args[++i]) || 3000;
        break;

      case '--mode':
      case '-m':
        options.mode = (args[++i] as 'relay' | 'authoritative') || 'relay';
        break;

      case '--game':
      case '-g':
        options.gameModule = args[++i];
        break;

      case '--verbose':
      case '-v':
        options.verbose = true;
        break;

      default:
        // Allow positional port for backwards compatibility
        if (!arg.startsWith('-') && !isNaN(parseInt(arg))) {
          options.port = parseInt(arg);
        } else if (arg.startsWith('-')) {
          console.error(`Unknown option: ${arg}`);
          showHelp();
          process.exit(1);
        }
    }
  }

  // Game module implies authoritative mode
  if (options.gameModule) {
    options.mode = 'authoritative';
  }

  return options;
}

function showHelp(): void {
  console.log(`
HyperToken Relay Server

USAGE:
  hypertoken relay [options]

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
  hypertoken relay                          # Default port 3000
  hypertoken relay --port 8080              # Custom port
  hypertoken relay --mode authoritative     # Game server mode
  hypertoken relay -g ./examples/game.js    # Load game module
`);
}

export async function runRelay(args: string[]): Promise<void> {
  const parsedOptions = parseArgs(args);
  if (!parsedOptions) {
    process.exit(0);
  }

  const options = parsedOptions;

  console.log('');
  console.log('╔══════════════════════════════════════════════════╗');
  console.log('║        HYPERTOKEN RELAY SERVER                   ║');
  console.log('╚══════════════════════════════════════════════════╝');
  console.log('');

  let engine: Engine | null = null;

  // Set up engine for authoritative mode
  if (options.mode === 'authoritative') {
    engine = new Engine();

    // Load game module if specified
    if (options.gameModule) {
      console.log(`Loading game module: ${options.gameModule}`);
      try {
        await import(options.gameModule);
        console.log('Game module loaded successfully');
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Unknown error';
        console.error(`Failed to load game module: ${message}`);
        process.exit(1);
      }
    }
  }

  // Create and start server
  const server = new UniversalRelayServer({
    port: options.port,
    mode: options.mode,
    engine,
    verbose: options.verbose,
  });

  try {
    await server.start();

    console.log(`Mode: ${options.mode.toUpperCase()}`);
    console.log(`Port: ${options.port}`);
    console.log(`URL:  ws://localhost:${options.port}`);
    console.log('');

    if (options.mode === 'relay') {
      console.log('Relay mode: Routing P2P messages and WebRTC signaling');
    } else {
      console.log('Authoritative mode: Handling describe/dispatch commands');
      if (options.gameModule) {
        console.log(`Game: ${options.gameModule}`);
      }
    }

    console.log('');
    console.log('Press Ctrl+C to stop');
    console.log('');
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    console.error('Failed to start server:', message);
    process.exit(1);
  }

  // Graceful shutdown
  const shutdown = () => {
    console.log('\nShutting down...');
    server.stop();
    process.exit(0);
  };

  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}
