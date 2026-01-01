# HyperToken MCP Server

Play HyperToken games through any MCP-compatible LLM (Claude, etc.).

## What is MCP?

Model Context Protocol (MCP) is Anthropic's open standard for connecting AI models to tools and data sources. This server exposes HyperToken games as MCP tools, allowing LLMs to play games via tool calling.

```
+----------------+      MCP Protocol      +----------------+
|                | ---------------------> |                |
|   Claude/LLM   |   tools/resources/     |   HyperToken   |
|                | <--------------------- |   MCP Server   |
+----------------+        prompts         +----------------+
                                                 |
                                                 v
                                          +----------------+
                                          |   HyperToken   |
                                          |  Game Engine   |
                                          +----------------+
```

## Setup

### Install dependencies

```bash
npm install
```

This will install `@modelcontextprotocol/sdk` and other required dependencies.

### Configure Claude Desktop

Add to your Claude Desktop config:

**macOS:** `~/Library/Application Support/Claude/claude_desktop_config.json`
**Windows:** `%APPDATA%\Claude\claude_desktop_config.json`

```json
{
  "mcpServers": {
    "hypertoken": {
      "command": "npx",
      "args": ["tsx", "/path/to/hypertoken/mcp/server.ts"]
    }
  }
}
```

Replace `/path/to/hypertoken` with the actual path to your HyperToken installation.

Restart Claude Desktop after adding the configuration.

### Run Manually

You can also run the server directly:

```bash
npm run mcp:server
```

Or:

```bash
npx tsx mcp/server.ts
```

## Usage

In Claude, you can now:

- "Let's play blackjack!"
- "Start a tic-tac-toe game"
- "What games can we play?"

Claude will use the HyperToken tools to play games with you.

## Available Tools

### Blackjack

| Tool | Description |
|------|-------------|
| `blackjack_new_game` | Start a new hand |
| `blackjack_hit` | Take another card |
| `blackjack_stand` | Keep your hand, dealer plays |
| `blackjack_state` | See current game state |

### Tic-Tac-Toe

| Tool | Description |
|------|-------------|
| `tictactoe_new_game` | Start a new game |
| `tictactoe_move` | Make a move (position 0-8) |
| `tictactoe_state` | See the board |

### General

| Tool | Description |
|------|-------------|
| `list_games` | List available games |

## Resources

The server provides read-only resources:

| URI | Description |
|-----|-------------|
| `hypertoken://game/state` | Current game state |
| `hypertoken://game/history` | History of moves |

## Prompts

Pre-built conversation starters:

| Prompt | Description |
|--------|-------------|
| `play_blackjack` | Play with strategic advice |
| `play_tictactoe` | Play with optimal strategy |
| `teach_game` | Learn how to play (accepts `game` argument) |

## Game Rules

### Blackjack

- Goal: Get closer to 21 than the dealer without going over
- Number cards are worth their face value
- Face cards (J, Q, K) are worth 10
- Aces are worth 11 or 1 (automatically adjusted)
- Hit: Take another card
- Stand: Keep your hand, dealer must draw to 17

### Tic-Tac-Toe

- Goal: Get three in a row (horizontal, vertical, or diagonal)
- You play as X, AI plays as O
- Board positions:
  ```
    0 | 1 | 2
    ---------
    3 | 4 | 5
    ---------
    6 | 7 | 8
  ```

## Architecture

```
mcp/
├── server.ts           # Main MCP server
├── games/
│   ├── blackjack-mcp.ts    # Blackjack game wrapper
│   └── tictactoe-mcp.ts    # Tic-Tac-Toe game wrapper
└── README.md           # This file
```

## Development

### Testing with MCP Inspector

You can test the server using the MCP Inspector:

```bash
npx @anthropic-ai/mcp-inspector npx tsx mcp/server.ts
```

### Adding New Games

1. Create a new game wrapper in `mcp/games/`:

```typescript
import { Engine } from '../../engine/Engine.js';

export class MyGame {
  private engine: Engine;

  constructor(engine: Engine) {
    this.engine = engine;
  }

  // Implement game methods...
  reset(): string { /* ... */ }
  makeMove(/* params */): string { /* ... */ }
  describe(): string { /* ... */ }
}
```

2. Import and register in `server.ts`:
   - Add tools in `ListToolsRequestSchema` handler
   - Add tool handling in `CallToolRequestSchema` handler
   - Update `getOrCreateSession()` to support the new game type

3. Update this README with the new game's tools and rules

## Troubleshooting

### Server won't start

- Ensure all dependencies are installed: `npm install`
- Check that the path in Claude Desktop config is correct
- Try running manually to see error messages: `npx tsx mcp/server.ts`

### Tools not showing in Claude

- Restart Claude Desktop after config changes
- Verify the config JSON is valid
- Check Claude Desktop logs for MCP connection errors

### Game state resets unexpectedly

- Each tool call that specifies a different game type creates a new session
- Use `*_state` tools to check current state without affecting the game
