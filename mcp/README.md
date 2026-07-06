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
      "args": ["hypertoken", "mcp"]
    }
  }
}
```

Replace `/path/to/hypertoken` with the actual path to your HyperToken installation, or use `npm run mcp` to launch directly.

Restart Claude Desktop after adding the configuration.

### Run Manually

You can also run the server directly:

```bash
npm run mcp
```

## Usage

In Claude, you can now:

- "Let's play blackjack!"
- "Start a cuttle game"
- "What games can we play?"

Claude will use the HyperToken tools to play games with you.

## Available Tools

### Blackjack

Blackjack is backed by the real HyperToken engine — `examples/blackjack/game.js`
uses `Engine`, `Stack`, `Space`, and `Agent` under the hood. The MCP wrapper
(`mcp/games/blackjack-mcp.ts`) is a thin adapter that creates a
`BlackjackGame`, calls its methods, and formats the resulting state for the
LLM. The wrapper creates its own `BlackjackGame` (which creates its own
`Engine`); the `Engine` field on the MCP `GameSession` is kept for interface
symmetry but is not used by the blackjack wrapper.

| Tool | Description |
|------|-------------|
| `blackjack_new_game` | Start a new hand |
| `blackjack_hit` | Take another card |
| `blackjack_stand` | Keep your hand, dealer plays |
| `blackjack_state` | See current game state |

### Cuttle

Cuttle is exposed via an LLM-friendly index-picking interface: call
`cuttle_list_actions` to get a numbered menu of legal actions, then call
`cuttle_pick_action` with the index of the action you want. After you act,
the AI opponent (a simple random picker, matching `examples/cuttle/cli.js`'s
`getRandomAction`) plays its turn — including any counter chains and
resolution phases — before the state is returned.

Only the 2-player `classic` variant is supported in the MCP wrapper.

| Tool | Description |
|------|-------------|
| `cuttle_new_game` | Start a new game (optional `variant` arg; only `classic` supported) |
| `cuttle_list_actions` | List your available actions as a numbered menu |
| `cuttle_pick_action` | Take an action by index (takes `index`) |
| `cuttle_state` | See the current game state |

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
| `play_cuttle` | Play with strategy tips |
| `teach_game` | Learn how to play (accepts `game` argument: `blackjack` or `cuttle`) |

## Game Rules

### Blackjack

- Goal: Get closer to 21 than the dealer without going over
- Number cards are worth their face value
- Face cards (J, Q, K) are worth 10
- Aces are worth 11 or 1 (automatically adjusted)
- Hit: Take another card
- Stand: Keep your hand, dealer must draw to 17

### Cuttle (classic, 2-player)

- Goal: Be first to accumulate 21+ points in point cards (A=1, 2-10 face value)
- On your turn: draw a card, pass (only if deck empty), or play a card
- Cards can be played as: point card, one-off effect, permanent, or scuttle
- One-offs: A (wipe points), 2 (destroy permanent / counter), 3 (recur from scrap),
  4 (opponent discards 2), 5 (draw 2), 6 (wipe permanents), 7 (draw & must play),
  9 (bounce a permanent)
- Permanents: 8 (glasses — see opponent's hand), J (steal a point card),
  Q (protect your other cards), K (reduce your point goal: 21 → 14 → 10 → 7 → 5)
- Scuttle: use a higher card to destroy an opponent's point card (both go to scrap)
- 3 consecutive passes (when deck is empty) = draw

## Architecture

```
mcp/
├── games/
│   ├── blackjack-mcp.ts    # Blackjack adapter (wraps examples/blackjack/game.js)
│   └── cuttle-mcp.ts        # Cuttle adapter (wraps examples/cuttle/CuttleGame.ts)
└── README.md                # This file
```

The server entrypoint lives at `cli/commands/mcp.ts`, launched via `npm run mcp`.

Each game wrapper accepts an optional `Engine` argument (for interface
compatibility with the MCP server's `GameSession`) but the underlying game
implementations create their own engines/state as needed:

- `BlackjackMCPGame` delegates to `examples/blackjack/game.js`'s `BlackjackGame`,
  which constructs a real HyperToken `Engine` with `Stack`/`Space`/`Agent`.
- `CuttleMCPGame` delegates to `examples/cuttle/CuttleGame.ts`'s `CuttleGame`,
  a standalone implementation (documented; does not use the Engine internally).

## Development

### Testing with MCP Inspector

You can test the server using the MCP Inspector:

```bash
npx @anthropic-ai/mcp-inspector npm run mcp
```

### Adding New Games

1. Create a new game wrapper in `mcp/games/`:

```typescript
export class MyGame {
  constructor(_engine?: any) {}

  reset(): string { /* ... */ }
  makeMove(/* params */): string { /* ... */ }
  describe(): string { /* ... */ }
}
```

2. Import and register in `cli/commands/mcp.ts`:
   - Add tools in `ListToolsRequestSchema` handler
   - Add tool handling in `CallToolRequestSchema` handler
   - Update `getOrCreateSession()` to support the new game type
   - Update the `GameSession.game` type union

3. Update this README with the new game's tools and rules

## Troubleshooting

### Server won't start

- Ensure all dependencies are installed: `npm install`
- Check that the path in Claude Desktop config is correct
- Try running manually to see error messages: `npm run mcp`

### Tools not showing in Claude

- Restart Claude Desktop after config changes
- Verify the config JSON is valid
- Check Claude Desktop logs for MCP connection errors

### Game state resets unexpectedly

- Each tool call that specifies a different game type creates a new session
- Use `*_state` tools to check current state without affecting the game
