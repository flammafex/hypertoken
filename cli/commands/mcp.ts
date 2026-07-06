/**
 * HyperToken MCP Server Command
 *
 * Starts the Model Context Protocol server for LLM integration.
 * Exposes HyperToken games as tools that Claude and other LLMs can use.
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  ListResourcesRequestSchema,
  ReadResourceRequestSchema,
  ListPromptsRequestSchema,
  GetPromptRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';

import { Engine } from '../../engine/Engine.js';
import { BlackjackMCPGame } from '../../mcp/games/blackjack-mcp.js';
import { CuttleMCPGame } from '../../mcp/games/cuttle-mcp.js';

// === Game State ===
interface GameSession {
  type: string;
  game: BlackjackMCPGame | CuttleMCPGame;
  engine: Engine;
  history: string[];
}

const sessions: Map<string, GameSession> = new Map();
let activeSessionId: string | null = null;

function parseArgs(args: string[]): boolean {
  for (const arg of args) {
    if (arg === '--help' || arg === '-h') {
      showHelp();
      return false;
    }
  }
  return true;
}

function showHelp(): void {
  console.log(`
HyperToken MCP Server

USAGE:
  hypertoken mcp [options]

OPTIONS:
  -h, --help    Show this help message

DESCRIPTION:
  Starts the Model Context Protocol server for LLM integration.
  This server communicates via stdio and is designed to be launched
  by MCP-compatible clients like Claude Desktop.

AVAILABLE GAMES:
  - Blackjack (blackjack_new_game, blackjack_hit, blackjack_stand)
  - Cuttle (cuttle_new_game, cuttle_list_actions, cuttle_pick_action)

CLAUDE DESKTOP CONFIGURATION:
  Add to your Claude Desktop config file:

  {
    "mcpServers": {
      "hypertoken": {
        "command": "npx",
        "args": ["hypertoken", "mcp"]
      }
    }
  }

EXAMPLE:
  hypertoken mcp
`);
}

// === Helper Functions ===
function getOrCreateSession(gameType: string): GameSession {
  if (activeSessionId && sessions.has(activeSessionId)) {
    const session = sessions.get(activeSessionId)!;
    if (session.type === gameType) {
      return session;
    }
  }

  const sessionId = `session-${Date.now()}`;
  const engine = new Engine();

  let game: BlackjackMCPGame | CuttleMCPGame;
  switch (gameType) {
    case 'blackjack':
      game = new BlackjackMCPGame(engine);
      break;
    case 'cuttle':
      game = new CuttleMCPGame(engine);
      break;
    default:
      throw new Error(`Unknown game type: ${gameType}`);
  }

  const session: GameSession = {
    type: gameType,
    game,
    engine,
    history: [],
  };

  sessions.set(sessionId, session);
  activeSessionId = sessionId;

  return session;
}

function formatGameState(session: GameSession): string {
  return session.game.describe();
}

export async function runMcp(args: string[]): Promise<void> {
  if (!parseArgs(args)) {
    process.exit(0);
  }

  // === MCP Server Setup ===
  const server = new Server(
    {
      name: 'hypertoken',
      version: '1.0.0',
    },
    {
      capabilities: {
        tools: {},
        resources: {},
        prompts: {},
      },
    }
  );

  // === Tools ===
  server.setRequestHandler(ListToolsRequestSchema, async () => {
    return {
      tools: [
        // Blackjack
        {
          name: 'blackjack_new_game',
          description: 'Start a new game of Blackjack.',
          inputSchema: { type: 'object' as const, properties: {}, required: [] },
        },
        {
          name: 'blackjack_hit',
          description: 'Take another card in Blackjack.',
          inputSchema: { type: 'object' as const, properties: {}, required: [] },
        },
        {
          name: 'blackjack_stand',
          description: 'Keep your current hand in Blackjack.',
          inputSchema: { type: 'object' as const, properties: {}, required: [] },
        },
        {
          name: 'blackjack_state',
          description: 'Get the current Blackjack game state.',
          inputSchema: { type: 'object' as const, properties: {}, required: [] },
        },
        // Cuttle
        {
          name: 'cuttle_new_game',
          description: 'Start a new game of Cuttle (classic 2-player variant).',
          inputSchema: {
            type: 'object' as const,
            properties: {
              variant: {
                type: 'string',
                description: 'Cuttle variant. Only "classic" is supported (default).',
              },
            },
            required: [],
          },
        },
        {
          name: 'cuttle_list_actions',
          description: 'List the actions available to you in the current Cuttle game, as a numbered menu.',
          inputSchema: { type: 'object' as const, properties: {}, required: [] },
        },
        {
          name: 'cuttle_pick_action',
          description: 'Pick a Cuttle action by its index from the list returned by cuttle_list_actions.',
          inputSchema: {
            type: 'object' as const,
            properties: {
              index: { type: 'number', description: 'Index of the action to take (from cuttle_list_actions).' },
            },
            required: ['index'],
          },
        },
        {
          name: 'cuttle_state',
          description: 'Get the current Cuttle game state (your hand, points, opponent info, phase).',
          inputSchema: { type: 'object' as const, properties: {}, required: [] },
        },
        // General
        {
          name: 'list_games',
          description: 'List available games.',
          inputSchema: { type: 'object' as const, properties: {}, required: [] },
        },
      ],
    };
  });

  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: toolArgs } = request.params;

    try {
      switch (name) {
        case 'blackjack_new_game': {
          const session = getOrCreateSession('blackjack');
          const bjGame = session.game as BlackjackMCPGame;
          const result = bjGame.deal();
          session.history.push('New game started');
          return { content: [{ type: 'text', text: result }] };
        }

        case 'blackjack_hit': {
          const session = getOrCreateSession('blackjack');
          const bjGame = session.game as BlackjackMCPGame;
          const result = bjGame.hit();
          session.history.push('Player hit');
          return { content: [{ type: 'text', text: result }] };
        }

        case 'blackjack_stand': {
          const session = getOrCreateSession('blackjack');
          const bjGame = session.game as BlackjackMCPGame;
          const result = bjGame.stand();
          session.history.push('Player stood');
          return { content: [{ type: 'text', text: result }] };
        }

        case 'blackjack_state': {
          const session = getOrCreateSession('blackjack');
          return { content: [{ type: 'text', text: formatGameState(session) }] };
        }

        case 'cuttle_new_game': {
          const session = getOrCreateSession('cuttle');
          const cuttleGame = session.game as CuttleMCPGame;
          const variant = (toolArgs as { variant?: string })?.variant;
          const result = cuttleGame.newGame(variant);
          session.history.push('New cuttle game started');
          return { content: [{ type: 'text', text: result }] };
        }

        case 'cuttle_list_actions': {
          const session = getOrCreateSession('cuttle');
          const cuttleGame = session.game as CuttleMCPGame;
          return { content: [{ type: 'text', text: cuttleGame.listActions() }] };
        }

        case 'cuttle_pick_action': {
          const session = getOrCreateSession('cuttle');
          const cuttleGame = session.game as CuttleMCPGame;
          const index = (toolArgs as { index?: number })?.index;
          if (index === undefined) {
            return { content: [{ type: 'text', text: 'Error: index required' }], isError: true };
          }
          const result = cuttleGame.pickAction(index);
          session.history.push(`Player picked action ${index}`);
          return { content: [{ type: 'text', text: result }] };
        }

        case 'cuttle_state': {
          const session = getOrCreateSession('cuttle');
          return { content: [{ type: 'text', text: formatGameState(session) }] };
        }

        case 'list_games':
          return {
            content: [
              {
                type: 'text',
                text: `Available games:

1. **Blackjack** - Classic casino card game (Engine-backed)
   - Tools: blackjack_new_game, blackjack_hit, blackjack_stand, blackjack_state

2. **Cuttle** - Combat card game, classic 2-player variant
   - Tools: cuttle_new_game, cuttle_list_actions, cuttle_pick_action, cuttle_state

Start a game by calling the appropriate new_game tool!`,
              },
            ],
          };

        default:
          throw new Error(`Unknown tool: ${name}`);
      }
    } catch (error) {
      return {
        content: [{ type: 'text', text: `Error: ${error instanceof Error ? error.message : 'Unknown'}` }],
        isError: true,
      };
    }
  });

  // === Resources ===
  server.setRequestHandler(ListResourcesRequestSchema, async () => {
    return {
      resources: [
        {
          uri: 'hypertoken://game/state',
          name: 'Current Game State',
          description: 'The current state of the active game',
          mimeType: 'text/plain',
        },
        {
          uri: 'hypertoken://game/history',
          name: 'Game History',
          description: 'History of moves in the current game',
          mimeType: 'text/plain',
        },
      ],
    };
  });

  server.setRequestHandler(ReadResourceRequestSchema, async (request) => {
    const { uri } = request.params;

    if (!activeSessionId || !sessions.has(activeSessionId)) {
      return { contents: [{ uri, mimeType: 'text/plain', text: 'No active game.' }] };
    }

    const session = sessions.get(activeSessionId)!;

    switch (uri) {
      case 'hypertoken://game/state':
        return { contents: [{ uri, mimeType: 'text/plain', text: formatGameState(session) }] };
      case 'hypertoken://game/history':
        return { contents: [{ uri, mimeType: 'text/plain', text: session.history.join('\n') || 'No moves yet.' }] };
      default:
        throw new Error(`Unknown resource: ${uri}`);
    }
  });

  // === Prompts ===
  server.setRequestHandler(ListPromptsRequestSchema, async () => {
    return {
      prompts: [
        { name: 'play_blackjack', description: 'Play a game of Blackjack with strategic advice', arguments: [] },
        { name: 'play_cuttle', description: 'Play a game of Cuttle with strategy tips', arguments: [] },
        {
          name: 'teach_game',
          description: 'Learn how to play a game',
          arguments: [
            {
              name: 'game',
              description: 'The game to learn (blackjack, cuttle)',
              required: true,
            },
          ],
        },
      ],
    };
  });

  server.setRequestHandler(GetPromptRequestSchema, async (request) => {
    const { name, arguments: promptArgs } = request.params;

    switch (name) {
      case 'play_blackjack':
        return {
          messages: [
            {
              role: 'user',
              content: {
                type: 'text',
                text: `Let's play Blackjack! I'll be the player and you help me make optimal decisions.

First, start a new game using the blackjack_new_game tool.

Then, for each hand:
1. Look at my cards and the dealer's visible card
2. Recommend whether to hit or stand based on basic strategy
3. Execute my choice using blackjack_hit or blackjack_stand
4. Tell me the result

Basic strategy reminders:
- Always hit on 11 or less
- Stand on 17 or higher
- On 12-16, hit if dealer shows 7 or higher
- Double down on 10-11 when dealer is weak

Let's play!`,
              },
            },
          ],
        };
      case 'play_cuttle':
        return {
          messages: [
            {
              role: 'user',
              content: {
                type: 'text',
                text: `Let's play Cuttle! You are Player 0; the AI is Player 1.

Cuttle is a combat card game played with a standard 52-card deck. Goal: be
first to 21+ points in point cards (A=1, 2-10 face value). On your turn you
may draw, pass (only if deck empty), or play a card as a point card, a
one-off effect, a permanent, or to scuttle an opponent's point card.

Quick card-effect reference (classic variant):
- A: one-off — destroy ALL point cards
- 2: one-off — destroy a permanent, OR counter an opponent's one-off
- 3: one-off — retrieve a card from scrap
- 4: one-off — opponent discards 2 cards
- 5: one-off — draw 2 cards
- 6: one-off — destroy ALL permanents
- 7: one-off — draw a card and must play it immediately
- 8: permanent — opponent's hand is revealed to you ("glasses")
- 9: one-off — return a permanent to its owner's hand
- 10: point card only
- J: permanent — steal control of an opponent's point card
- Q: permanent — protect your other cards from targeting
- K: permanent — reduce your point goal (21 -> 14 -> 10 -> 7 -> 5)

Workflow:
1. Call cuttle_new_game to start.
2. Call cuttle_list_actions to see your numbered options.
3. Call cuttle_pick_action with the index of your chosen action.
4. The AI will play its turn automatically. Repeat until someone wins.

Strategy tips:
- Build points early, but watch for Aces (wipe all points).
- Queens protect your board; play one before committing to points.
- Scuttle aggressively when ahead; it removes opponent points.
- Save 2s to counter dangerous one-offs (especially A and 6).
- Kings snowball: each one lowers your goal.

Let's play!`,
              },
            },
          ],
        };
      case 'teach_game': {
        const game = (promptArgs as { game?: string })?.game || 'blackjack';
        return {
          messages: [
            {
              role: 'user',
              content: {
                type: 'text',
                text: `Teach me how to play ${game}!

Please:
1. Explain the basic rules
2. Start a practice game
3. Walk me through each decision, explaining the strategy
4. Let me make choices and give feedback

I'm a beginner, so please be patient and explain everything!`,
              },
            },
          ],
        };
      }
      default:
        throw new Error(`Unknown prompt: ${name}`);
    }
  });

  // === Start Server ===
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error('HyperToken MCP server running...');
}
