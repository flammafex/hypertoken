#!/usr/bin/env node
/*
 * WebRTC Test Server
 * Simple relay server for WebRTC signaling
 */
import { RelayServer } from 'hypertoken/network/RelayServer.js';

const PORT = process.env.PORT || 8080;

console.log('🚀 Starting WebRTC Test Server...\n');

const server = new RelayServer(null, { port: PORT, verbose: true });

await server.start();

console.log(`
✅ Server ready!

To test WebRTC connections:
1. Open a new terminal and run: node client.js Alice
2. Open another terminal and run: node client.js Bob
3. Watch the WebRTC connection establish between peers

Press Ctrl+C to stop the server.
`);

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('\n\n👋 Shutting down server...');
  server.stop();
  process.exit(0);
});
