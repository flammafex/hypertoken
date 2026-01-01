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
  apiToken?: string;
  maxConnections?: number;
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

      // Poker-specific options
      case '--small-blind':
      case '--sb':
        options.envOptions.smallBlind = parseInt(args[++i], 10);
        break;

      case '--big-blind':
      case '--bb':
        options.envOptions.bigBlind = parseInt(args[++i], 10);
        break;

      case '--chips':
      case '-c':
        options.envOptions.startingChips = parseInt(args[++i], 10);
        break;

      case '--rich':
      case '--rich-obs':
        options.envOptions.richObservations = true;
        break;

      case '--extended':
      case '--extended-actions':
        options.envOptions.extendedActions = true;
        break;

      case '--shaped':
      case '--reward-shaping':
        options.envOptions.rewardShaping = true;
        break;

      // Hanabi/Coup/Liar's Dice player count
      case '--players':
      case '-n':
        options.envOptions.numPlayers = parseInt(args[++i], 10);
        break;

      // Liar's Dice specific
      case '--dice':
        options.envOptions.startingDice = parseInt(args[++i], 10);
        break;

      case '--token':
      case '--api-token':
        options.apiToken = args[++i];
        break;

      case '--max-connections':
      case '--max-conn':
        options.maxConnections = parseInt(args[++i], 10);
        break;

      default:
        if (arg.startsWith('-')) {
          console.error(`Unknown option: ${arg}`);
          showHelp();
          process.exit(1);
        }
        // Positional argument: environment type
        if (!options.envType || options.envType === 'blackjack') {
          options.envType = arg;
        }
    }
  }

  return options;
}

function showHelp(): void {
  console.log(`
HyperToken Bridge Server (Gym/PettingZoo)

USAGE:
  hypertoken bridge [environment] [options]
  hypertoken bridge poker --rich --extended --shaped
  hypertoken bridge blackjack -a 4

OPTIONS:
  -p, --port <port>     Port to listen on (default: 9999)
  -e, --env <type>      Environment type (default: blackjack)
      --host <host>     Host to bind to (default: 0.0.0.0)
  -v, --verbose         Enable verbose logging
  -s, --seed <num>      Random seed
  -h, --help            Show this help message

SECURITY OPTIONS:
      --token, --api-token <key>  Require API token for connections
      --max-connections <num>     Max concurrent connections (default: 10)

  Set HYPERTOKEN_API_KEY env var as alternative to --token

BLACKJACK OPTIONS:
  -a, --agents <num>    Number of agents (default: 2)
  -d, --decks <num>     Number of decks (default: 6)

POKER OPTIONS:
      --sb, --small-blind <num>   Small blind (default: 1)
      --bb, --big-blind <num>     Big blind (default: 2)
  -c, --chips <num>               Starting chips (default: 100)
      --rich, --rich-obs          Use rich observations (73 features)
      --extended, --extended-actions   Use 10 bet sizes instead of 6
      --shaped, --reward-shaping  Enable reward shaping for training

HANABI OPTIONS:
  -n, --players <num>   Number of players (2-5, default: 2)

COUP OPTIONS:
  -n, --players <num>   Number of players (2-6, default: 2)

LIAR'S DICE OPTIONS:
  -n, --players <num>   Number of players (2-6, default: 2)
      --dice <num>      Starting dice per player (default: 5)

AVAILABLE ENVIRONMENTS:
  blackjack             Multi-agent blackjack (AEC)
  poker                 Heads-up Texas Hold'em (AEC)
  hanabi                Cooperative card game (AEC)
  coup                  Bluffing card game (AEC)
  liars-dice            Bluffing dice game (AEC)

EXAMPLES:
  hypertoken bridge                         # Default blackjack on 9999
  hypertoken bridge --env blackjack         # Explicit environment
  hypertoken bridge --env poker -p 8080     # Poker on custom port
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
    apiToken: options.apiToken,
    maxConnections: options.maxConnections,
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
