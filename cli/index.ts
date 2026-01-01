#!/usr/bin/env node
/**
 * HyperToken CLI
 *
 * Unified command-line interface for HyperToken services.
 *
 * Usage:
 *   hypertoken <command> [options]
 *
 * Commands:
 *   relay    Start the P2P relay server
 *   bridge   Start the Gym/PettingZoo bridge server
 *   mcp      Start the MCP server for LLM integration
 *
 * Examples:
 *   hypertoken relay --port 3000
 *   hypertoken bridge --env blackjack --port 9999
 *   hypertoken mcp
 */

import { runRelay } from './commands/relay.js';
import { runBridge } from './commands/bridge.js';
import { runMcp } from './commands/mcp.js';

const VERSION = '0.1.0';

function showHelp(): void {
  console.log(`
HyperToken CLI v${VERSION}

USAGE:
  hypertoken <command> [options]

COMMANDS:
  relay     Start the P2P relay server for WebRTC signaling
  bridge    Start the Gym/PettingZoo environment bridge server
  mcp       Start the MCP server for LLM integration

OPTIONS:
  -h, --help      Show this help message
  -v, --version   Show version number

EXAMPLES:
  hypertoken relay                          # Start relay on port 3000
  hypertoken relay --port 8080              # Start relay on custom port
  hypertoken relay --mode authoritative     # Start in authoritative mode

  hypertoken bridge                         # Start bridge with default env
  hypertoken bridge --env blackjack         # Start blackjack environment
  hypertoken bridge -e blackjack -p 9999    # Custom port

  hypertoken mcp                            # Start MCP server

For command-specific help:
  hypertoken <command> --help
`);
}

function showVersion(): void {
  console.log(`hypertoken v${VERSION}`);
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);

  if (args.length === 0 || args[0] === '--help' || args[0] === '-h') {
    showHelp();
    process.exit(0);
  }

  if (args[0] === '--version' || args[0] === '-v') {
    showVersion();
    process.exit(0);
  }

  const command = args[0];
  const commandArgs = args.slice(1);

  switch (command) {
    case 'relay':
      await runRelay(commandArgs);
      break;

    case 'bridge':
      await runBridge(commandArgs);
      break;

    case 'mcp':
      await runMcp(commandArgs);
      break;

    default:
      console.error(`Unknown command: ${command}`);
      console.error('Run "hypertoken --help" for usage information.');
      process.exit(1);
  }
}

main().catch((error) => {
  console.error('Fatal error:', error.message);
  process.exit(1);
});
