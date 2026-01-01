/**
 * HyperToken Relay Server Command
 *
 * Starts the P2P relay server for WebRTC signaling and message routing.
 * For authoritative game servers, use AuthoritativeServer directly.
 */

import { UniversalRelayServer } from '../../network/UniversalRelayServer.js';

interface RelayOptions {
  port: number;
  verbose: boolean;
}

function parseArgs(args: string[]): RelayOptions | null {
  const options: RelayOptions = {
    port: parseInt(process.env.PORT || '') || 3000,
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

  return options;
}

function showHelp(): void {
  console.log(`
HyperToken Relay Server

USAGE:
  hypertoken relay [options]

OPTIONS:
  -p, --port <port>     Server port (default: 3000)
  -v, --verbose         Enable verbose logging
  -h, --help            Show this help message

ENVIRONMENT VARIABLES:
  PORT         Server port
  VERBOSE      Enable verbose logging ("true")

DESCRIPTION:
  Starts a WebSocket relay server for P2P signaling and message routing.

  The relay server:
    - Routes messages between connected peers
    - Handles WebRTC signaling (offer, answer, ICE candidates)
    - Provides health check endpoint at /health
    - Includes rate limiting to prevent abuse

  For authoritative game servers (with server-side game logic),
  extend the AuthoritativeServer class instead.

EXAMPLES:
  hypertoken relay                    # Default port 3000
  hypertoken relay --port 8080        # Custom port
  hypertoken relay -v                 # Verbose logging
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

  // Create and start server
  const server = new UniversalRelayServer({
    port: options.port,
    verbose: options.verbose,
  });

  try {
    await server.start();

    console.log(`Port: ${options.port}`);
    console.log(`URL:  ws://localhost:${options.port}`);
    console.log('');
    console.log('Routing P2P messages and WebRTC signaling');
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
