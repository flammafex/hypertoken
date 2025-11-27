// ledger-server.js
import { Chronicle, ConsensusCore, PeerConnection } from './dist/core/index.js';
import { createServer } from 'http';

// 1. Start HyperToken Node
const chronicle = new Chronicle({ nullifiers: {} });
const network = new PeerConnection("ws://localhost:8080"); // Connect to swarm
const consensus = new ConsensusCore(chronicle, network);
network.connect();

// 2. Start HTTP API for Freebird
createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);
  
  // CHECK Endpoint
  if (url.pathname === '/check') {
    const nullifier = url.searchParams.get('n');
    const isSpent = chronicle.state.nullifiers?.[nullifier];
    res.end(JSON.stringify({ spent: !!isSpent }));
    return;
  }

  // BURN Endpoint
  if (url.pathname === '/burn' && req.method === 'POST') {
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', () => {
      const { nullifier } = JSON.parse(body);
      
      // The Atomic Check-and-Set
      if (chronicle.state.nullifiers?.[nullifier]) {
        res.statusCode = 409; // Conflict
        res.end(JSON.stringify({ error: "Double Spend" }));
      } else {
        chronicle.change(doc => {
          if (!doc.nullifiers) doc.nullifiers = {};
          doc.nullifiers[nullifier] = Date.now();
        });
        res.end(JSON.stringify({ success: true }));
      }
    });
  }
}).listen(3000);

console.log("💰 Ledger Sidecar running on port 3000");