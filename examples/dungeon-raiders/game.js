import { ActionRegistry } from '../../engine/actions.js';

// Dungeon generation and game logic
const DUNGEON_WIDTH = 40;
const DUNGEON_HEIGHT = 20;

const TILES = {
  FLOOR: '.',
  WALL: '#',
  PLAYER: '@',
  MONSTER: 'M',
  TREASURE: '$',
  POTION: '♥',
  WEAPON: '†',
  EXIT: '▼',
  EXPLORED: '·'
};

const MONSTERS = [
  { name: 'Goblin', char: 'g', hp: 3, damage: 1, xp: 10 },
  { name: 'Orc', char: 'o', hp: 5, damage: 2, xp: 20 },
  { name: 'Troll', char: 'T', hp: 8, damage: 3, xp: 35 },
  { name: 'Dragon', char: 'D', hp: 15, damage: 5, xp: 100 }
];

function generateDungeon() {
  // Create a simple dungeon with rooms and corridors
  const dungeon = Array(DUNGEON_HEIGHT).fill(null).map(() =>
    Array(DUNGEON_WIDTH).fill(TILES.WALL)
  );

  // Generate rooms
  const rooms = [];
  const numRooms = 6 + Math.floor(Math.random() * 4);

  for (let i = 0; i < numRooms; i++) {
    const width = 5 + Math.floor(Math.random() * 6);
    const height = 4 + Math.floor(Math.random() * 5);
    const x = 1 + Math.floor(Math.random() * (DUNGEON_WIDTH - width - 2));
    const y = 1 + Math.floor(Math.random() * (DUNGEON_HEIGHT - height - 2));

    // Carve out room
    for (let dy = 0; dy < height; dy++) {
      for (let dx = 0; dx < width; dx++) {
        dungeon[y + dy][x + dx] = TILES.FLOOR;
      }
    }

    rooms.push({ x, y, width, height, centerX: x + Math.floor(width / 2), centerY: y + Math.floor(height / 2) });
  }

  // Connect rooms with corridors
  for (let i = 0; i < rooms.length - 1; i++) {
    const room1 = rooms[i];
    const room2 = rooms[i + 1];

    let x = room1.centerX;
    let y = room1.centerY;

    // Horizontal corridor
    while (x !== room2.centerX) {
      dungeon[y][x] = TILES.FLOOR;
      x += (x < room2.centerX) ? 1 : -1;
    }

    // Vertical corridor
    while (y !== room2.centerY) {
      dungeon[y][x] = TILES.FLOOR;
      y += (y < room2.centerY) ? 1 : -1;
    }
  }

  return { dungeon, rooms };
}

function placeEntities(rooms) {
  const entities = [];

  // Place monsters in random rooms (skip first room for players)
  for (let i = 1; i < rooms.length - 1; i++) {
    const room = rooms[i];
    const numMonsters = 1 + Math.floor(Math.random() * 3);

    for (let j = 0; j < numMonsters; j++) {
      const monsterType = MONSTERS[Math.floor(Math.random() * MONSTERS.length)];
      entities.push({
        type: 'monster',
        id: `monster-${i}-${j}`,
        ...monsterType,
        x: room.x + 1 + Math.floor(Math.random() * (room.width - 2)),
        y: room.y + 1 + Math.floor(Math.random() * (room.height - 2)),
        maxHp: monsterType.hp
      });
    }
  }

  // Place treasure
  for (let i = 1; i < rooms.length; i++) {
    if (Math.random() > 0.5) {
      const room = rooms[i];
      entities.push({
        type: 'treasure',
        id: `treasure-${i}`,
        x: room.x + 1 + Math.floor(Math.random() * (room.width - 2)),
        y: room.y + 1 + Math.floor(Math.random() * (room.height - 2)),
        gold: 10 + Math.floor(Math.random() * 40)
      });
    }
  }

  // Place exit in last room
  const lastRoom = rooms[rooms.length - 1];
  entities.push({
    type: 'exit',
    id: 'exit',
    x: lastRoom.centerX,
    y: lastRoom.centerY
  });

  return entities;
}

// Helpers that read/write the CRDT-backed game state via session.change()
function getState(engine) {
  return engine._gameState;
}

function mergeState(engine, updates) {
  engine.session.change("dungeon:mergeState", (doc) => {
    if (!doc.gameState) doc.gameState = {};
    Object.assign(doc.gameState, updates);
  });
}

function mergePlayer(engine, clientId, updates) {
  engine.session.change("dungeon:mergePlayer", (doc) => {
    if (!doc.gameState?.players?.[clientId]) return;
    Object.assign(doc.gameState.players[clientId], updates);
  });
}

function mergeEntity(engine, entityId, updates) {
  engine.session.change("dungeon:mergeEntity", (doc) => {
    if (!doc.gameState?.entities) return;
    const entity = doc.gameState.entities.find(e => e.id === entityId);
    if (entity) Object.assign(entity, updates);
  });
}

function removeEntity(engine, entityId) {
  engine.session.change("dungeon:removeEntity", (doc) => {
    if (!doc.gameState?.entities) return;
    const idx = doc.gameState.entities.findIndex(e => e.id === entityId);
    if (idx !== -1) doc.gameState.entities.splice(idx, 1);
  });
}

function pushMessage(engine, message) {
  engine.session.change("dungeon:pushMessage", (doc) => {
    if (!doc.gameState?.messages) return;
    doc.gameState.messages.push(message);
  });
}

// Extend ActionRegistry with dungeon-specific actions
Object.assign(ActionRegistry, {
  "dungeon:init": (engine) => {
    const { dungeon, rooms } = generateDungeon();
    const entities = placeEntities(rooms);

    engine.session.change("dungeon:init", (doc) => {
      doc.gameState = {
        dungeon,
        entities,
        players: {},
        messages: [],
        turn: 0,
        spawnRoom: rooms[0],
        status: 'waiting',
        maxPlayers: 4,
      };
    });

    engine.emit("dungeon:initialized", {
      width: DUNGEON_WIDTH,
      height: DUNGEON_HEIGHT
    });
  },

  "player:join": (engine, { clientId, name }) => {
    const state = getState(engine);

    if (Object.keys(state.players ?? {}).length >= state.maxPlayers) {
      throw new Error("Game is full");
    }
    if (state.players?.[clientId]) {
      throw new Error("Player already joined");
    }

    const spawnX = state.spawnRoom.centerX + Math.floor(Math.random() * 3) - 1;
    const spawnY = state.spawnRoom.centerY + Math.floor(Math.random() * 3) - 1;
    const playerName = name || `Player${Object.keys(state.players ?? {}).length + 1}`;

    const player = {
      id: clientId,
      name: playerName,
      x: spawnX,
      y: spawnY,
      hp: 10,
      maxHp: 10,
      damage: 2,
      gold: 0,
      xp: 0,
      level: 1,
      alive: true,
    };

    engine.session.change("player:join", (doc) => {
      if (!doc.gameState.players) doc.gameState.players = {};
      doc.gameState.players[clientId] = player;
      doc.gameState.messages.push(`${playerName} has entered the dungeon!`);

      const playerCount = Object.keys(doc.gameState.players).length;
      if (doc.gameState.status === 'waiting' && playerCount >= 1) {
        doc.gameState.status = 'playing';
        doc.gameState.messages.push("The adventure begins!");
      }
    });

    engine.emit("player:joined", { clientId, player });

    if (getState(engine).status === 'playing') {
      engine.emit("game:started");
    }
  },

  "player:move": (engine, { clientId, direction }) => {
    const state = getState(engine);
    const player = state.players?.[clientId];

    if (!player || !player.alive) {
      throw new Error("Invalid player or player is dead");
    }

    const moves = {
      'up':    { dx: 0,  dy: -1 },
      'down':  { dx: 0,  dy:  1 },
      'left':  { dx: -1, dy:  0 },
      'right': { dx:  1, dy:  0 },
    };

    const move = moves[direction];
    if (!move) throw new Error("Invalid direction");

    const newX = player.x + move.dx;
    const newY = player.y + move.dy;

    if (newX < 0 || newX >= DUNGEON_WIDTH || newY < 0 || newY >= DUNGEON_HEIGHT) {
      throw new Error("Out of bounds");
    }
    if (state.dungeon[newY][newX] === TILES.WALL) {
      throw new Error("Can't walk through walls");
    }

    // Check for monster at new position
    const monster = state.entities.find(e =>
      e.type === 'monster' && e.x === newX && e.y === newY && e.hp > 0
    );

    if (monster) {
      const newHp = monster.hp - player.damage;
      mergeEntity(engine, monster.id, { hp: newHp });
      pushMessage(engine, `${player.name} attacks ${monster.name} for ${player.damage} damage!`);

      if (newHp <= 0) {
        pushMessage(engine, `${player.name} defeated ${monster.name}! +${monster.xp} XP`);
        const goldGain = Math.floor(Math.random() * 10) + 5;
        const newXp = player.xp + monster.xp;
        const newGold = player.gold + goldGain;
        const xpNeeded = player.level * 50;
        const leveled = newXp >= xpNeeded;
        const newLevel = leveled ? player.level + 1 : player.level;

        mergePlayer(engine, clientId, {
          xp: newXp,
          gold: newGold,
          ...(leveled ? {
            level: newLevel,
            maxHp: player.maxHp + 3,
            hp: player.maxHp + 3,
            damage: player.damage + 1,
          } : {}),
        });

        if (leveled) {
          pushMessage(engine, `${player.name} reached level ${newLevel}!`);
          engine.emit("player:levelup", { clientId, level: newLevel });
        }
      } else {
        // Monster counterattack
        const playerNewHp = player.hp - monster.damage;
        pushMessage(engine, `${monster.name} hits ${player.name} for ${monster.damage} damage!`);
        mergePlayer(engine, clientId, { hp: playerNewHp });

        if (playerNewHp <= 0) {
          mergePlayer(engine, clientId, { alive: false });
          pushMessage(engine, `${player.name} has been defeated!`);
          engine.emit("player:died", { clientId });
        }
      }

      engine.emit("combat:occurred", { clientId, monsterId: monster.id });
    } else {
      // Move player
      mergePlayer(engine, clientId, { x: newX, y: newY });

      // Check for treasure
      const treasure = state.entities.find(e =>
        e.type === 'treasure' && e.x === newX && e.y === newY
      );
      if (treasure) {
        mergePlayer(engine, clientId, { gold: player.gold + treasure.gold });
        pushMessage(engine, `${player.name} found ${treasure.gold} gold!`);
        removeEntity(engine, treasure.id);
        engine.emit("treasure:collected", { clientId, gold: treasure.gold });
      }

      // Check for exit
      const exit = state.entities.find(e =>
        e.type === 'exit' && e.x === newX && e.y === newY
      );
      if (exit) {
        const allMonstersDefeated = state.entities.every(e =>
          e.type !== 'monster' || e.hp <= 0
        );
        if (allMonstersDefeated) {
          mergeState(engine, { status: 'won' });
          pushMessage(engine, `${player.name} found the exit! Victory!`);
          engine.emit("game:won", { winner: clientId });
          engine.dispatch("game:end", { winner: clientId, reason: "exit_reached" });
        } else {
          pushMessage(engine, `The exit is blocked by monsters!`);
        }
      }

      engine.emit("player:moved", { clientId, x: newX, y: newY, direction });
    }

    // Increment turn counter in CRDT
    engine.session.change("dungeon:turn", (doc) => {
      if (doc.gameState) doc.gameState.turn = (doc.gameState.turn ?? 0) + 1;
    });
  },

  "player:leave": (engine, { clientId }) => {
    const player = getState(engine).players?.[clientId];
    if (player) {
      pushMessage(engine, `${player.name} has left the dungeon.`);
      engine.session.change("player:leave", (doc) => {
        if (doc.gameState?.players) delete doc.gameState.players[clientId];
      });
      engine.emit("player:left", { clientId });
    }
  },

  "dungeon:getMessages": (engine, { since = 0 }) => {
    return (getState(engine).messages ?? []).slice(since);
  },
});

export { TILES, DUNGEON_WIDTH, DUNGEON_HEIGHT };
