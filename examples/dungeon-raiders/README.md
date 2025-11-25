# 🏰 Terminal Dungeon Raiders ⚔️

A cooperative multiplayer roguelike dungeon crawler that runs in your terminal! Built with HyperToken's distributed simulation engine.

## 🎮 What is this?

Terminal Dungeon Raiders is a real-time multiplayer game where 1-4 players explore a procedurally generated dungeon together, fight monsters, collect treasure, and try to reach the exit. The game showcases HyperToken's networking capabilities with synchronized game state across all connected players.

## ✨ Features

- 🌐 **Real-time Multiplayer**: Play cooperatively with friends over the network
- 🎲 **Procedural Generation**: Each dungeon is randomly generated with rooms and corridors
- ⚔️ **Combat System**: Fight monsters (Goblins, Orcs, Trolls, Dragons) with RPG mechanics
- 📈 **Progression**: Gain XP, level up, increase stats
- 💰 **Loot**: Collect treasure scattered throughout the dungeon
- 🎯 **Cooperative Gameplay**: Work together to defeat all monsters and escape
- 🖥️ **ASCII Graphics**: Beautiful terminal-based interface
- 🔄 **CRDT Synchronization**: HyperToken's conflict-free state management ensures perfect sync

## 🚀 Quick Start

### Start the Server

From the HyperToken root directory:

```bash
./examples/dungeon-raiders/start-server.sh
```

Or manually with the TypeScript loader:

```bash
node --loader ./test/ts-esm-loader.js examples/dungeon-raiders/server.js
```

The server will start on `ws://localhost:8080` and generate a new dungeon.

### Join as a Player

Open separate terminal windows for each player:

```bash
# Player 1
./examples/dungeon-raiders/start-client.sh Alice

# Player 2
./examples/dungeon-raiders/start-client.sh Bob

# Player 3
./examples/dungeon-raiders/start-client.sh Charlie
```

If you don't provide a name, you'll get a random player name.

Or manually with the TypeScript loader:

```bash
node --loader ./test/ts-esm-loader.js examples/dungeon-raiders/client.js YourName
```

### Custom Server URL

Connect to a remote server:

```bash
SERVER_URL=ws://example.com:8080 node client.js YourName
```

## 🎯 How to Play

### Goal

Explore the dungeon, defeat all monsters, collect treasure, and find the exit!

### Controls

- **Arrow Keys** or **WASD**: Move your character
- **Q**: Quit the game

### Gameplay Mechanics

1. **Movement**: Use arrow keys or WASD to move through the dungeon
2. **Combat**: Walk into a monster to attack it
   - Deal damage based on your attack stat
   - Monster counterattacks if it survives
   - Gain XP and gold for defeating monsters
3. **Leveling**: Gain enough XP to level up
   - Increases max HP
   - Increases damage
   - Full HP restore
4. **Victory**: Once all monsters are defeated, reach the exit (▼) to win!

### Legend

- `★` - You (the current player)
- `@` - Other players
- `g` - Goblin (3 HP, 1 damage)
- `o` - Orc (5 HP, 2 damage)
- `T` - Troll (8 HP, 3 damage)
- `D` - Dragon (15 HP, 5 damage)
- `$` - Treasure
- `▼` - Exit
- `#` - Wall
- `.` - Floor

## 🏗️ Architecture

### HyperToken Components Used

This demo showcases several HyperToken features:

- **Engine**: Core game coordinator handling action dispatch and state
- **ActionRegistry**: Custom game actions for dungeon mechanics
- **Event System**: Real-time event emission for multiplayer sync
- **WebSocket Networking**: Server-client communication
- **State Synchronization**: Automatic state broadcast on actions

### Custom Actions

The game implements these custom actions:

- `dungeon:init` - Generate procedural dungeon with rooms and monsters
- `player:join` - Add a new player to the game
- `player:move` - Move player and handle combat/interactions
- `player:leave` - Remove player from game
- `dungeon:getMessages` - Retrieve game event log

### Project Structure

```
dungeon-raiders/
├── game.js        # Custom action definitions and game logic
├── server.js      # WebSocket server with Engine instance
├── client.js      # Terminal UI client
└── README.md      # This file
```

## 🔧 Technical Details

### Server Architecture

The server runs a HyperToken Engine instance with custom dungeon actions. It:

1. Initializes a procedurally generated dungeon
2. Manages WebSocket connections for each player
3. Processes player actions through the Engine
4. Broadcasts state updates to all connected clients
5. Handles player join/leave events

### Client Architecture

Each client:

1. Connects to the server via WebSocket
2. Renders the dungeon state in the terminal
3. Captures keyboard input for movement
4. Sends actions to the server
5. Updates display on state changes

### State Synchronization

The game uses HyperToken's event-driven architecture:

- All game actions flow through the Engine
- Engine emits events on state changes
- Server broadcasts updated state to all clients
- Clients re-render on receiving new state

This ensures all players see the same game state in real-time!

## 🎨 Customization Ideas

Want to extend the game? Try adding:

- **Special abilities**: Fireball spell, heal potion, teleport
- **Traps**: Hidden spike traps, teleport pads
- **Boss fights**: Special boss monster at the exit
- **Items**: Weapons and armor that boost stats
- **PvP mode**: Players can attack each other
- **Larger dungeons**: Increase dungeon size for longer games
- **Fog of war**: Only reveal rooms you've explored
- **Character classes**: Warrior, Mage, Rogue with different abilities

## 🐛 Troubleshooting

**Connection refused**
- Make sure the server is running first
- Check that the port (8080) is not blocked

**Controls not working**
- Ensure your terminal supports raw mode
- Try using WASD instead of arrow keys

**Game state not updating**
- Check your network connection
- Look for error messages in the server console

## 📝 License

Part of the HyperToken framework - see main repository for license.

## 🤝 Contributing

This is a demo showcasing HyperToken's capabilities. Feel free to use it as a template for your own multiplayer terminal games!

---

**Enjoy raiding dungeons with your friends! ⚔️🏰**
