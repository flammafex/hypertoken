/**
 * HyperToken Bridge Server Command
 *
 * Starts the Gym/PettingZoo environment bridge server.
 * Exposes HyperToken environments to Python clients via WebSocket.
 */

import { EnvServer, EnvServerOptions } from '../../bridge/server.js';

interface BridgeOptions {
  port: number;
  envType: string;
  host: string;
  verbose: boolean;
  envOptions: Record<string, unknown>;
}

function parseArgs(args: string[]): BridgeOptions | null {
  const options: BridgeOptions = {
    port: 9999,
    envType: 'blackjack',
    host: '0.0.0.0',
    verbose: false,
    envOptions: {},
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
        options.port = parseInt(args[++i], 10);
        break;

      case '--env':
      case '-e':
        options.envType = args[++i];
        break;

      case '--host':
        options.host = args[++i];
        break;

      case '--verbose':
      case '-v':
        options.verbose = true;
        break;

      case '--agents':
      case '-a':
        options.envOptions.numAgents = parseInt(args[++i], 10);
        break;

      case '--decks':
      case '-d':
        options.envOptions.numDecks = parseInt(args[++i], 10);
        break;

      case '--seed':
      case '-s':
        options.envOptions.seed = parseInt(args[++i], 10);
        break;

      default:
        if (arg.startsWith('-')) {
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
HyperToken Bridge Server (Gym/PettingZoo)

USAGE:
  hypertoken bridge [options]

OPTIONS:
  -p, --port <port>     Port to listen on (default: 9999)
  -e, --env <type>      Environment type (default: blackjack)
      --host <host>     Host to bind to (default: 0.0.0.0)
  -v, --verbose         Enable verbose logging
  -a, --agents <num>    Number of agents (blackjack)
  -d, --decks <num>     Number of decks (blackjack)
  -s, --seed <num>      Random seed
  -h, --help            Show this help message

AVAILABLE ENVIRONMENTS:
  blackjack             Multi-agent blackjack (AEC)

EXAMPLES:
  hypertoken bridge                         # Default blackjack on 9999
  hypertoken bridge --env blackjack         # Explicit environment
  hypertoken bridge -e blackjack -p 8080    # Custom port
  hypertoken bridge -a 3 -v                 # 3 agents, verbose

PYTHON CLIENT:
  from hypertoken import BlackjackEnv
  env = BlackjackEnv(host="localhost", port=9999)
  env.reset()
`);
}

export async function runBridge(args: string[]): Promise<void> {
  const parsedOptions = parseArgs(args);
  if (!parsedOptions) {
    process.exit(0);
  }

  const options = parsedOptions;

  console.log('');
  console.log('╔══════════════════════════════════════════════════╗');
  console.log('║        HYPERTOKEN BRIDGE SERVER                  ║');
  console.log('╚══════════════════════════════════════════════════╝');
  console.log('');

  const serverOptions: EnvServerOptions = {
    port: options.port,
    envType: options.envType,
    host: options.host,
    verbose: options.verbose,
    envOptions: options.envOptions,
  };

  const server = new EnvServer(serverOptions);

  // Graceful shutdown
  const shutdown = () => {
    console.log('\n[Bridge] Shutting down...');
    server.stop();
    process.exit(0);
  };

  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);

  try {
    await server.start();
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('[Bridge] Failed to start:', message);
    process.exit(1);
  }
}
