# WebRTC Test Example

This example demonstrates HyperToken's hybrid WebSocket + WebRTC networking capabilities.

## Features

- ✅ **Automatic WebRTC upgrade**: Starts with WebSocket, automatically upgrades to WebRTC for lower latency
- ✅ **TURN fallback**: Automatically retries with TURN servers if direct connection fails (NAT traversal)
- ✅ **Graceful fallback**: Falls back to WebSocket if WebRTC connection fails
- ✅ **Transparent routing**: Application code doesn't need to know which transport is used
- ✅ **Interactive CLI**: Test commands to see WebRTC in action
- ✅ **Connection monitoring**: Shows which peers are connected via WebRTC vs WebSocket

## Architecture

```
┌─────────────┐                    ┌─────────────┐
│  Client A   │                    │  Client B   │
│  (Alice)    │                    │  (Bob)      │
└──────┬──────┘                    └──────┬──────┘
       │                                   │
       │  1. WebSocket Connection          │
       │        (Signaling)                │
       ├──────────────┬───────────────────►│
       │              │                    │
       │              ▼                    │
       │         ┌──────────┐              │
       │         │RelayServer              │
       │         │(port 8080)│             │
       │         └──────────┘              │
       │              │                    │
       │  2. WebRTC Signaling (SDP/ICE)   │
       │◄─────────────┼────────────────────┤
       │              │                    │
       │              │                    │
       │  3. Direct WebRTC DataChannel    │
       │◄═════════════════════════════════►│
       │        (Low-latency P2P)          │
```

## How It Works

1. **Initial Connection**: Clients connect to RelayServer via WebSocket
2. **Peer Discovery**: Server broadcasts peer join/leave events
3. **Automatic Upgrade**: After a short delay, clients initiate WebRTC connection
4. **Signaling**: WebRTC SDP offers/answers and ICE candidates are exchanged via WebSocket
5. **Direct Connection**: Once WebRTC is established, data flows directly between peers
6. **TURN Fallback**: If direct connection fails (restrictive NAT), automatically retries with TURN relay
7. **Graceful Degradation**: If all WebRTC attempts fail, communication continues via WebSocket

## TURN Fallback (Phase 2)

HyperToken now includes intelligent connection retry with TURN server fallback:

### Connection Lifecycle

```
Attempt 1: STUN Only (Direct P2P)
    ↓
  Timeout (15s) or ICE Failed
    ↓
Attempt 2: STUN + TURN (Relayed P2P)
    ↓
  Success → WebRTC via TURN
    OR
  Failure → WebSocket Fallback
```

### What You'll See

**Successful Direct Connection:**
```
🚀 WebRTC connection established with peer-abc123 (Bob)
   Now using direct P2P DataChannel for low-latency communication!
```

**TURN Fallback (Restrictive NAT):**
```
⚠️  WebRTC connection attempt 0 failed with Bob
   Will retry with TURN relay servers...

🔄 Retrying WebRTC connection with Bob (attempt 1)
   Using TURN relay servers for NAT traversal...

🚀 WebRTC connection established with peer-abc123 (Bob)
   ⚡ Connected via TURN relay server
   🔄 Succeeded after 1 retry attempt(s)
   Now using direct P2P DataChannel for low-latency communication!
```

**Complete Failure (WebSocket Fallback):**
```
❌ WebRTC connection failed with Bob after 1 attempts
   Falling back to WebSocket relay
```

### Configuration

TURN fallback is enabled by default. You can configure it:

```javascript
const manager = new HybridPeerManager({
  url: 'ws://localhost:8080',
  rtcConfig: {
    enableTurnFallback: true,    // Enable TURN retry (default: true)
    connectionTimeout: 15000,     // Time before retry (default: 15s)
    maxRetries: 1,                // Number of retries (default: 1)
    iceServers: [
      // Your custom STUN/TURN servers
      { urls: 'stun:stun.l.google.com:19302' },
      {
        urls: 'turn:your-turn-server.com:3478',
        username: 'user',
        credential: 'password'
      }
    ]
  }
});
```

### Default TURN Servers

The example uses free public TURN servers for demonstration:
- `turn:openrelay.metered.ca:80` (username: openrelayproject)
- `turn:openrelay.metered.ca:443` (username: openrelayproject)

⚠️ **For production, use your own TURN servers:**
- [Twilio STUN/TURN](https://www.twilio.com/stun-turn)
- [coturn](https://github.com/coturn/coturn) (self-hosted)
- [Xirsys](https://xirsys.com/)

## Setup

1. Install dependencies:
```bash
cd examples/webrtc-test
npm install
```

2. Start the relay server:
```bash
npm run server
```

3. In a new terminal, start the first client (Alice):
```bash
npm run client Alice
```

4. In another terminal, start the second client (Bob):
```bash
npm run client Bob
```

## Usage

Once connected, you'll see:
```
✅ Connected to server via WebSocket
👤 Your peer ID: peer-abc123
📝 Your name: Alice

Available commands:
  /peers          - List connected peers
  /ping <peerId>  - Send ping to a peer
  /msg <peerId> <text> - Send message to a peer
  /broadcast <text>    - Send message to all peers
  /help           - Show this help
  /quit           - Disconnect and exit
```

### Testing WebRTC Connection

1. **List peers**:
   ```
   > /peers
   ```
   You'll see which peers are connected and their transport type (WebRTC 🚀 or WebSocket 📡)

2. **Send a ping**:
   ```
   > /ping peer-abc123
   ```
   Watch the latency difference between WebSocket and WebRTC!

3. **Send a message**:
   ```
   > /msg peer-abc123 Hello from WebRTC!
   ```
   The message will be sent via WebRTC if connected, otherwise via WebSocket

4. **Broadcast to all**:
   ```
   > /broadcast Hello everyone!
   ```

### Observing WebRTC Upgrade

Watch the console output to see the WebRTC connection lifecycle:

1. Initial WebSocket connection:
   ```
   ✅ Connected to server via WebSocket
   👋 New peer connected: peer-abc123
   ```

2. WebRTC negotiation (happens automatically after 1 second):
   ```
   [Signaling] Sent offer to peer-abc123
   [Signaling] Received answer from peer-abc123
   ```

3. WebRTC connection established:
   ```
   🚀 WebRTC connection established with peer-abc123 (Bob)
      Now using direct P2P DataChannel for low-latency communication!
   ```

4. Messages now use WebRTC:
   ```
   [🚀 WebRTC] Bob: Hello from the other side!
   ```

## What to Notice

### Latency Difference

Use `/ping <peerId>` to compare latency:
- **WebSocket (via relay)**: ~10-50ms (depends on server distance)
- **WebRTC (direct P2P)**: ~1-5ms (local network) or ~5-20ms (internet)

### Automatic Fallback

Try disconnecting and reconnecting a client. You'll see:
1. WebRTC disconnects when client leaves
2. On reconnect, starts with WebSocket
3. Automatically upgrades to WebRTC again

### Transparent Routing

The application code (client.js) doesn't care about the transport:
```javascript
// This uses WebRTC if available, otherwise WebSocket
manager.sendToPeer(peerId, { type: 'chat', text: 'Hello!' });
```

## Configuration

You can customize the behavior in `client.js`:

```javascript
const manager = new HybridPeerManager({
  url: SERVER_URL,
  autoUpgrade: true,     // Set to false to disable auto-upgrade
  upgradeDelay: 1000,    // Delay before attempting WebRTC (ms)
  rtcConfig: {           // Custom WebRTC configuration
    iceServers: [
      { urls: 'stun:stun.l.google.com:19302' }
    ]
  }
});
```

## Troubleshooting

### WebRTC Not Connecting

**Symptom**: Peers stay on WebSocket, never upgrade to WebRTC

**Possible causes**:
1. **Firewall/NAT**: Some networks block WebRTC. Try on a different network.
2. **Browser only**: This example uses Node.js. For browser testing, you'll need to import the modules differently.

**Solution**: Check the console logs for WebRTC errors. You may need to add TURN servers for NAT traversal.

### "Cannot find module" Error

**Solution**: Make sure you've run `npm install` in the `examples/webrtc-test` directory.

### Server Port Already in Use

**Solution**: Change the port:
```bash
PORT=8081 npm run server
```

Then update clients:
```bash
SERVER_URL=ws://localhost:8081 npm run client Alice
```

## CRDT Synchronization Demo (Phase 3)

The `crdt-sync.js` example demonstrates **real-time state synchronization** over WebRTC using Automerge CRDTs.

### What is CRDT?

**CRDT** (Conflict-free Replicated Data Type) ensures that all peers eventually reach the same state, even when they make concurrent changes. HyperToken uses [Automerge](https://automerge.org/) for automatic state merging.

### Running the CRDT Demo

1. **Terminal 1** - Start server and first player:
```bash
npm run crdt Alice --server
```

2. **Terminal 2** - Start second player:
```bash
npm run crdt Bob
```

3. **Terminal 3** - Start third player (optional):
```bash
npm run crdt Charlie
```

### CRDT Demo Commands

```
/state          - Show current shared state
/players        - List all connected players
/increment      - Increment shared counter
/set <key> <val>- Set a value in shared state
```

### What You'll See

**Player 1 (Alice) increments counter:**
```
> /increment
✅ Counter incremented to 1
   (Change will sync to all peers via CRDT)
```

**Player 2 (Bob) sees the update automatically:**
```
🚀 WebRTC connection established with Alice
   CRDT sync now using direct P2P DataChannel!

> /state
📊 Current shared state:
{
  "players": {
    "peer-abc123": { "name": "Alice", "joined": 1701234567890 },
    "peer-def456": { "name": "Bob", "joined": 1701234567891 }
  },
  "counter": 1
}
```

**Both players increment simultaneously (no conflicts!):**
```
Alice: /increment → counter = 2
Bob:   /increment → counter = 3  (Automerge merges both changes!)
```

### How It Works

1. **Engine** creates CRDT document (Automerge)
2. **ConsensusCore** manages sync state per peer
3. **HybridPeerManager** sends sync messages via WebRTC (or WebSocket fallback)
4. **Automerge** automatically merges concurrent changes
5. All peers converge to the same state

### Benefits of CRDT over WebRTC

✅ **Zero conflicts** - Concurrent edits merge automatically
✅ **Low latency** - Direct P2P reduces sync delay
✅ **Eventual consistency** - All peers reach same state
✅ **Offline-friendly** - Changes queue and sync when reconnected
✅ **No server logic** - State merging happens on peers

### Use Cases

- **Multiplayer games** - Sync game state (positions, scores, etc.)
- **Collaborative editing** - Real-time document editing
- **Shared whiteboards** - Drawing and annotations
- **Chat applications** - Message history sync
- **Distributed databases** - Local-first data sync

## Next Steps

1. **Add TURN server**: For production, add a TURN server for NAT traversal ✅ (Phase 2 complete)
2. **Integrate with CRDT**: Connect this to ConsensusCore for state synchronization ✅ (Phase 3 complete)
3. **Add encryption**: Implement end-to-end encryption for WebRTC DataChannels
4. **Browser support**: Create a web-based version using the same HybridPeerManager

## Technical Details

### Files

- `server.js`: Simple RelayServer for WebSocket signaling
- `client.js`: Interactive client using HybridPeerManager
- `package.json`: Dependencies and scripts

### Key Classes Used

- **HybridPeerManager**: Coordinates WebSocket and WebRTC connections
- **WebRTCConnection**: Manages individual WebRTC peer connections
- **SignalingService**: Handles WebRTC signaling over WebSocket
- **RelayServer**: Routes messages and signaling between peers
- **PeerConnection**: WebSocket client abstraction

### Message Flow

```
Application Layer
     ↓
HybridPeerManager (routing logic)
     ↓
  ┌──┴──┐
  ↓     ↓
WebRTC  WebSocket
(P2P)   (Relay)
```

## License

MIT
