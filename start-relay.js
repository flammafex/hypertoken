#!/usr/bin/env node
/**
 * Standalone HyperToken Relay Server
 *
 * Usage: node start-relay.js [port]
 * Default port: 8080
 */
 
import { RelayServer } from './dist/network/RelayServer.js';
 
const port = parseInt(process.argv[2]) || 3000;
 
console.log('Starting HyperToken Relay Server...');
console.log('Press Ctrl+C to stop');
 
const relay = new RelayServer(null, { port, verbose: true });
 
relay.start().then(() => {
  console.log(`✨ Ready! Scarcity can connect to: ws://localhost:${port}`);
  console.log('');
  console.log('To test from Scarcity:');
  console.log('  cd /home/user/scarcity');
  console.log('  npm test');
}).catch(err => {
  console.error('Failed to start relay:', err);
  process.exit(1);
});
 
// Graceful shutdown
process.on('SIGINT', () => {
  console.log('\n\nShutting down relay server...');
  relay.stop();
  process.exit(0);
});
 
process.on('SIGTERM', () => {
  relay.stop();
  process.exit(0);
});