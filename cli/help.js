#!/usr/bin/env node
/**
 * HyperToken CLI Help
 * Lists all available npm commands with descriptions
 */

const COMMANDS = {
  'Getting Started': {
    'build': 'Compile TypeScript and prepare examples',
    'clean': 'Remove build artifacts and reset',
  },

  'Play Games': {
    'blackjack': 'Play Blackjack vs AI with betting',
    'cuttle': 'Play Cuttle card combat game',
    'poker': 'Play Texas Hold\'em poker',
    'prisoners-dilemma': 'Run Prisoner\'s Dilemma simulation',
    'pd:tournament': 'Run full PD tournament with all strategies',
  },

  'Multiplayer': {
    'blackjack:server': 'Start Blackjack multiplayer server',
    'blackjack:client': 'Connect to Blackjack server as client',
    'cuttle:server': 'Start Cuttle multiplayer server',
    'cuttle:client': 'Connect to Cuttle server as client',
    'dungeon:server': 'Start Dungeon Raiders server',
    'dungeon:client': 'Connect to Dungeon Raiders server',
  },

  'Infrastructure': {
    'relay': 'Start P2P relay server for matchmaking',
    'bridge': 'Start Python/JSON-RPC bridge for ML training',
    'mcp': 'Start Model Context Protocol server for LLMs',
  },

  'Testing': {
    'test': 'Run full test suite (slow, ~2 min)',
    'test:quick': 'Run core tests only (fast, ~10 sec)',
    'test:unit': 'Run unit tests (core, engine, token, batch)',
    'test:network': 'Run network/sync tests',
    'test:wasm': 'Run WASM integration tests',
  },

  'Benchmarks': {
    'benchmark': 'Run performance benchmarks',
    'benchmark:memory': 'Run memory usage benchmarks',
    'benchmark:chronicle': 'Benchmark CRDT operations',
    'benchmark:all': 'Run all benchmarks',
  },

  'Rust/WASM': {
    'build:rust': 'Build Rust core to WASM (run before build)',
    'build:rust:dev': 'Build WASM in dev mode (faster, larger)',
    'build:rust:release': 'Build WASM in release mode (optimized)',
    'test:rust': 'Run Rust unit tests',
    'clean:rust': 'Clean Rust build artifacts',
  },
};

const COLORS = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  dim: '\x1b[2m',
  cyan: '\x1b[36m',
  yellow: '\x1b[33m',
  green: '\x1b[32m',
  blue: '\x1b[34m',
};

function printHelp(filter) {
  console.log(`
${COLORS.bright}${COLORS.cyan}⚡ HyperToken CLI${COLORS.reset}
${COLORS.dim}Distributed Simulation Engine${COLORS.reset}

${COLORS.yellow}Usage:${COLORS.reset} npm run <command>
`);

  for (const [category, commands] of Object.entries(COMMANDS)) {
    // Filter by category if specified
    if (filter && !category.toLowerCase().includes(filter.toLowerCase())) {
      const hasMatch = Object.keys(commands).some(cmd =>
        cmd.toLowerCase().includes(filter.toLowerCase())
      );
      if (!hasMatch) continue;
    }

    console.log(`${COLORS.bright}${COLORS.blue}${category}${COLORS.reset}`);

    for (const [cmd, desc] of Object.entries(commands)) {
      // Filter by command name if specified
      if (filter && !cmd.toLowerCase().includes(filter.toLowerCase()) &&
          !category.toLowerCase().includes(filter.toLowerCase())) {
        continue;
      }
      console.log(`  ${COLORS.green}${cmd.padEnd(22)}${COLORS.reset} ${desc}`);
    }
    console.log();
  }

  console.log(`${COLORS.dim}Tip: npm run help <keyword> to filter commands${COLORS.reset}`);
  console.log(`${COLORS.dim}Example: npm run help test${COLORS.reset}`);
  console.log();
}

// Get filter from command line args
const filter = process.argv[2];
printHelp(filter);
