#!/usr/bin/env node
/**
 * Cuttle Multiplayer Server with Room Support
 *
 * Authoritative game server that manages multiple concurrent game rooms.
 * Players connect via WebSocket, create or join rooms, and play games.
 *
 * Usage:
 *   node --loader ../../test/ts-esm-loader.js server.js [port]
 *
 * Room Protocol:
 *   { cmd: "room:create", variant: "classic" }  → Creates room, returns code
 *   { cmd: "room:join", roomCode: "ABCD-1234" } → Joins existing room
 *   { cmd: "room:leave" }                       → Leaves current room
 *   { cmd: "room:list" }                        → Lists public rooms
 */
import { Engine } from "../../engine/Engine.js";
import { RoomAuthoritativeServer } from "../../network/RoomAuthoritativeServer.js";
import "./game-actions.js"; // Load Cuttle actions
import { getGameInstance } from "./game-actions.js";

// Parse command line arguments
const args = process.argv.slice(2);
let PORT = 8080;

for (let i = 0; i < args.length; i++) {
  if (!args[i].startsWith("--") && !isNaN(parseInt(args[i]))) {
    PORT = parseInt(args[i]);
  }
}

console.log("╔══════════════════════════════════════════════════════╗");
console.log("║      ⚔️  CUTTLE MULTIPLAYER SERVER (ROOMS) ⚔️         ║");
console.log("╚══════════════════════════════════════════════════════╝\n");

/**
 * Setup engine event listeners for logging
 */
function setupEngineListeners(engine, roomCode) {
  const prefix = `[${roomCode}]`;

  engine.on("player:registered", (evt) => {
    const { playerIndex, clientId } = evt.payload || evt;
    console.log(`${prefix} ✓ Player ${playerIndex} registered (${clientId.substring(0, 12)}...)`);
  });

  engine.on("game:started", (evt) => {
    const { numPlayers } = evt.payload || evt;
    console.log(`${prefix} 🎮 Game started! ${numPlayers} players connected.`);
  });

  engine.on("spectator:joined", (evt) => {
    const { clientId } = evt.payload || evt;
    console.log(`${prefix} 👁️  Spectator joined (${clientId.substring(0, 12)}...)`);
  });

  engine.on("action:executed", (evt) => {
    const { playerIndex, message } = evt.payload || evt;
    console.log(`${prefix} → Player ${playerIndex}: ${message}`);
  });

  engine.on("game:won", (evt) => {
    const { winner } = evt.payload || evt;
    console.log(`${prefix} 🏆 Game Over! Player ${winner} wins!`);
  });

  engine.on("game:draw", () => {
    console.log(`${prefix} 🤝 Game Over! It's a draw!`);
  });

  engine.on("player:ready", (evt) => {
    const { playerIndex } = evt.payload || evt;
    console.log(`${prefix} ✓ Player ${playerIndex} is ready for next game`);
  });

  engine.on("game:reset", () => {
    console.log(`${prefix} 🔄 Game reset. Ready for new game.`);
  });

  engine.on("player:left", (evt) => {
    const { playerIndex, clientId } = evt.payload || evt;
    console.log(`${prefix} ✗ Player ${playerIndex} left (${clientId.substring(0, 12)}...)`);
  });

  engine.on("player:disconnected", (evt) => {
    const { playerIndex, clientId } = evt.payload || evt;
    console.log(`${prefix} ⚠️  Player ${playerIndex} disconnected (${clientId.substring(0, 12)}...)`);
  });

  engine.on("player:reconnected", (evt) => {
    const { playerIndex, clientId } = evt.payload || evt;
    console.log(`${prefix} 🔄 Player ${playerIndex} reconnected (${clientId.substring(0, 12)}...)`);
  });
}

/**
 * CuttleRoomServer - Extends RoomAuthoritativeServer for Cuttle-specific logic
 */
class CuttleRoomServer extends RoomAuthoritativeServer {
  constructor(options) {
    super(options);

    // Map connection clientId -> player clientId (used for registration)
    this.connectionToPlayer = new Map();

    // Set up room engine factory
    // disableWasm: room engines only run TS actions (cuttle:*, game:setState),
    // which have no WASM counterpart.
    this.createRoomEngine = (roomCode, variant) => {
      const engine = new Engine({ disableWasm: true });
      setupEngineListeners(engine, roomCode);
      return engine;
    };

    // Set up room initialization
    this.initializeRoom = async (engine, roomCode, variant) => {
      await engine.dispatch("cuttle:init", { variant: variant || "classic" });
      console.log(`[${roomCode}] Room created (${variant || "classic"} variant)`);
    };
  }

  // Override getStateForRoom to include valid actions
  getStateForRoom(roomCode, clientId) {
    const roomInfo = this.rooms.get(roomCode);
    if (!roomInfo) return null;

    const engine = roomInfo.engine;
    const gameInstance = getGameInstance(engine);
    // cuttle:init writes room state to session.state.gameState (read by the
    // engine._gameState getter). Read it from the CRDT doc directly.
    const state = engine.session.state?.gameState;

    const validActions = {};
    if (gameInstance && state) {
      for (let i = 0; i < (state.numPlayers || 2); i++) {
        validActions[i] = gameInstance.getValidActions(i);
      }
    }

    return {
      _gameState: state || null,
      validActions,
      roomCode,
    };
  }

  // Track player registration by intercepting dispatches
  afterDispatch(connectionId, type, payload, result) {
    if (type === "cuttle:register" && payload?.clientId) {
      this.connectionToPlayer.set(connectionId, payload.clientId);
    }
  }

  // Handle client disconnect - unregister from room
  onClientDisconnect(connectionId) {
    const roomCode = this.clientRooms.get(connectionId);
    const playerId = this.connectionToPlayer.get(connectionId);

    if (roomCode && playerId) {
      const roomInfo = this.rooms.get(roomCode);
      if (roomInfo) {
        try {
          roomInfo.engine.dispatch("cuttle:unregister", { clientId: playerId });
          this.broadcastToRoom(roomCode);
        } catch (e) {
          // Ignore errors during unregister
        }
      }
    }

    this.connectionToPlayer.delete(connectionId);
    super.onClientDisconnect(connectionId);
  }

  // Handle room protocol messages - override to register players BEFORE sending responses
  async handleRoomMessage(connectionId, msg) {
    // Use clientId from message if provided, otherwise fall back to connection ID
    const playerId = msg.clientId || connectionId;

    // Handle room:create - register creator before sending response
    if (msg.cmd === "room:create") {
      const createResult = await this.createRoom(connectionId, {
        variant: msg.variant,
        password: msg.password,
        maxMembers: msg.maxMembers,
        isPrivate: msg.isPrivate,
      });

      if (createResult.success) {
        const roomCode = createResult.roomCode;
        const roomInfo = this.rooms.get(roomCode);

        // Register the creator in the game using their playerId
        if (roomInfo) {
          try {
            await roomInfo.engine.dispatch("cuttle:register", { clientId: playerId });
            this.connectionToPlayer.set(connectionId, playerId);
          } catch (e) {
            console.error(`[${roomCode}] Registration error:`, e.message);
          }
        }

        // Now send response with updated state
        this.sendToClient(connectionId, {
          cmd: "room:created",
          roomCode,
          state: roomInfo ? this.getStateForRoom(roomCode, connectionId) : null,
        });
        this.broadcastToRoom(roomCode);
      } else {
        this.sendToClient(connectionId, {
          cmd: "room:error",
          message: createResult.error,
        });
      }
      return { handled: true };
    }

    // Handle room:join - register player before sending response
    if (msg.cmd === "room:join") {
      const roomCode = msg.roomCode?.toUpperCase().trim();
      const joinResult = this.joinRoom(connectionId, roomCode, {
        password: msg.password,
      });

      if (joinResult.success) {
        const roomInfo = this.rooms.get(roomCode);

        // Register the player in the game using their playerId
        if (roomInfo) {
          try {
            await roomInfo.engine.dispatch("cuttle:register", { clientId: playerId });
            this.connectionToPlayer.set(connectionId, playerId);
          } catch (e) {
            console.error(`[${roomCode}] Registration error:`, e.message);
          }
        }

        // Get player index AFTER registration (look for playerId, not connectionId)
        let playerIndex = -1;
        if (roomInfo) {
          const state = roomInfo.engine.session.state?.gameState;
          if (state?.players) {
            for (let i = 0; i < (state.numPlayers || 2); i++) {
              if (state.players[i] === playerId) {
                playerIndex = i;
                break;
              }
            }
          }
        }

        // Now send response with updated state
        this.sendToClient(connectionId, {
          cmd: "room:joined",
          roomCode,
          playerIndex,
          state: roomInfo ? this.getStateForRoom(roomCode, connectionId) : null,
        });

        // Broadcast to other room members so they see the new player
        this.broadcastToRoom(roomCode);
      } else {
        this.sendToClient(connectionId, {
          cmd: "room:error",
          message: joinResult.error,
        });
      }
      return { handled: true };
    }

    return super.handleRoomMessage(connectionId, msg);
  }
}

// Create and start the room server
const server = new CuttleRoomServer({
  port: PORT,
  verbose: true,
  maxRooms: 100,
});

// Log room events
server.on("room:created", (evt) => {
  const { roomCode, clientId, variant } = evt.payload;
  console.log(`\n📦 Room ${roomCode} created by ${clientId.substring(0, 12)}...`);
});

server.on("room:joined", (evt) => {
  const { roomCode, clientId } = evt.payload;
  console.log(`📥 Client ${clientId.substring(0, 12)}... joined room ${roomCode}`);
});

server.on("room:left", (evt) => {
  const { roomCode, clientId } = evt.payload;
  console.log(`📤 Client ${clientId.substring(0, 12)}... left room ${roomCode}`);
});

server.on("room:deleted", (evt) => {
  const { roomCode } = evt.payload;
  console.log(`🗑️  Room ${roomCode} deleted (empty)`);
});

await server.start();

console.log("\nServer ready! Players can connect to:");
console.log(`  ws://localhost:${PORT}`);
console.log(`  ws://<your-ip>:${PORT}  (for LAN play)\n`);
console.log("Room Commands:");
console.log('  { cmd: "room:create", variant: "classic" }');
console.log('  { cmd: "room:join", roomCode: "ABCD-1234" }');
console.log('  { cmd: "room:list" }\n');
console.log("Press Ctrl+C to stop the server.\n");

// Graceful shutdown
process.on("SIGINT", () => {
  console.log("\n\nShutting down server...");
  server.stop();
  process.exit(0);
});
