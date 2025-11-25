import { ActionRegistry } from '../../engine/actions.js';
import { Token } from '../../core/Token.js';

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

// Extend ActionRegistry with dungeon-specific actions
Object.assign(ActionRegistry, {
  "dungeon:init": (engine) => {
    const { dungeon, rooms } = generateDungeon();
    const entities = placeEntities(rooms);

    engine._gameState = {
      dungeon,
      entities,
      players: {},
      messages: [],
      turn: 0,
      spawnRoom: rooms[0],
      status: 'waiting',
      maxPlayers: 4
    };

    engine.emit("dungeon:initialized", {
      width: DUNGEON_WIDTH,
      height: DUNGEON_HEIGHT
    });
  },

  "player:join": (engine, { clientId, name }) => {
    const state = engine._gameState;

    if (Object.keys(state.players).length >= state.maxPlayers) {
      throw new Error("Game is full");
    }

    if (state.players[clientId]) {
      throw new Error("Player already joined");
    }

    // Spawn player in first room
    const spawnX = state.spawnRoom.centerX + Math.floor(Math.random() * 3) - 1;
    const spawnY = state.spawnRoom.centerY + Math.floor(Math.random() * 3) - 1;

    state.players[clientId] = {
      id: clientId,
      name: name || `Player${Object.keys(state.players).length + 1}`,
      x: spawnX,
      y: spawnY,
      hp: 10,
      maxHp: 10,
      damage: 2,
      gold: 0,
      xp: 0,
      level: 1,
      alive: true
    };

    state.messages.push(`${state.players[clientId].name} has entered the dungeon!`);
    engine.emit("player:joined", { clientId, player: state.players[clientId] });

    if (state.status === 'waiting' && Object.keys(state.players).length >= 1) {
      state.status = 'playing';
      state.messages.push("The adventure begins!");
      engine.emit("game:started");
    }
  },

  "player:move": (engine, { clientId, direction }) => {
    const state = engine._gameState;
    const player = state.players[clientId];

    if (!player || !player.alive) {
      throw new Error("Invalid player or player is dead");
    }

    const moves = {
      'up': { dx: 0, dy: -1 },
      'down': { dx: 0, dy: 1 },
      'left': { dx: -1, dy: 0 },
      'right': { dx: 1, dy: 0 }
    };

    const move = moves[direction];
    if (!move) throw new Error("Invalid direction");

    const newX = player.x + move.dx;
    const newY = player.y + move.dy;

    // Check bounds
    if (newX < 0 || newX >= DUNGEON_WIDTH || newY < 0 || newY >= DUNGEON_HEIGHT) {
      throw new Error("Out of bounds");
    }

    // Check if walkable
    if (state.dungeon[newY][newX] === TILES.WALL) {
      throw new Error("Can't walk through walls");
    }

    // Check for monsters at new position
    const monster = state.entities.find(e =>
      e.type === 'monster' && e.x === newX && e.y === newY && e.hp > 0
    );

    if (monster) {
      // Attack monster
      monster.hp -= player.damage;
      state.messages.push(`${player.name} attacks ${monster.name} for ${player.damage} damage!`);

      if (monster.hp <= 0) {
        state.messages.push(`${player.name} defeated ${monster.name}! +${monster.xp} XP`);
        player.xp += monster.xp;
        player.gold += Math.floor(Math.random() * 10) + 5;

        // Level up check
        const xpNeeded = player.level * 50;
        if (player.xp >= xpNeeded) {
          player.level++;
          player.maxHp += 3;
          player.hp = player.maxHp;
          player.damage++;
          state.messages.push(`${player.name} reached level ${player.level}!`);
          engine.emit("player:levelup", { clientId, level: player.level });
        }
      } else {
        // Monster counterattacks
        player.hp -= monster.damage;
        state.messages.push(`${monster.name} hits ${player.name} for ${monster.damage} damage!`);

        if (player.hp <= 0) {
          player.alive = false;
          state.messages.push(`${player.name} has been defeated!`);
          engine.emit("player:died", { clientId });
        }
      }

      engine.emit("combat:occurred", { clientId, monsterId: monster.id });
    } else {
      // Move player
      player.x = newX;
      player.y = newY;

      // Check for treasure
      const treasure = state.entities.find(e =>
        e.type === 'treasure' && e.x === newX && e.y === newY
      );

      if (treasure) {
        player.gold += treasure.gold;
        state.messages.push(`${player.name} found ${treasure.gold} gold!`);
        // Remove treasure
        state.entities = state.entities.filter(e => e.id !== treasure.id);
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
          state.status = 'won';
          state.messages.push(`${player.name} found the exit! Victory!`);
          engine.emit("game:won", { winner: clientId });
        } else {
          state.messages.push(`The exit is blocked by monsters!`);
        }
      }

      engine.emit("player:moved", { clientId, x: newX, y: newY, direction });
    }

    state.turn++;
  },

  "player:leave": (engine, { clientId }) => {
    const state = engine._gameState;
    const player = state.players[clientId];

    if (player) {
      state.messages.push(`${player.name} has left the dungeon.`);
      delete state.players[clientId];
      engine.emit("player:left", { clientId });
    }
  },

  "dungeon:getMessages": (engine, { since = 0 }) => {
    const state = engine._gameState;
    return state.messages.slice(since);
  }
});

export { TILES, DUNGEON_WIDTH, DUNGEON_HEIGHT };
