/**
 * HyperToken MCP Server
 *
 * Exposes HyperToken games as MCP tools for LLM interaction.
 *
 * Usage:
 *   npx tsx mcp/server.ts
 *
 * Then configure in Claude Desktop:
 *   {
 *     "mcpServers": {
 *       "hypertoken": {
 *         "command": "npx",
 *         "args": ["tsx", "/path/to/hypertoken/mcp/server.ts"]
 *       }
 *     }
 *   }
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

import { Engine } from '../engine/Engine.js';
import { BlackjackGame } from './games/blackjack-mcp.js';
import { TicTacToeGame } from './games/tictactoe-mcp.js';

// === Game State ===
interface GameSession {
  type: string;
  game: BlackjackGame | TicTacToeGame;
  engine: Engine;
  history: string[];
}

const sessions: Map<string, GameSession> = new Map();
let activeSessionId: string | null = null;

// === Helper Functions ===
function getOrCreateSession(gameType: string): GameSession {
  if (activeSessionId && sessions.has(activeSessionId)) {
    const session = sessions.get(activeSessionId)!;
    if (session.type === gameType) {
      return session;
    }
  }

  // Create new session
  const sessionId = `session-${Date.now()}`;
  const engine = new Engine();

  let game: BlackjackGame | TicTacToeGame;
  switch (gameType) {
    case 'blackjack':
      game = new BlackjackGame(engine);
      break;
    case 'tictactoe':
      game = new TicTacToeGame(engine);
      break;
    default:
      throw new Error(`Unknown game type: ${gameType}`);
  }

  const session: GameSession = {
    type: gameType,
    game,
    engine,
    history: []
  };

  sessions.set(sessionId, session);
  activeSessionId = sessionId;

  return session;
}

function formatGameState(session: GameSession): string {
  return session.game.describe();
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
      // === Blackjack Tools ===
      {
        name: 'blackjack_new_game',
        description: 'Start a new game of Blackjack. Deals cards to player and dealer.',
        inputSchema: {
          type: 'object' as const,
          properties: {},
          required: []
        }
      },
      {
        name: 'blackjack_hit',
        description: 'Take another card in Blackjack. Risk busting if you go over 21.',
        inputSchema: {
          type: 'object' as const,
          properties: {},
          required: []
        }
      },
      {
        name: 'blackjack_stand',
        description: 'Keep your current hand in Blackjack. Dealer will then play.',
        inputSchema: {
          type: 'object' as const,
          properties: {},
          required: []
        }
      },
      {
        name: 'blackjack_state',
        description: 'Get the current state of the Blackjack game.',
        inputSchema: {
          type: 'object' as const,
          properties: {},
          required: []
        }
      },

      // === Tic-Tac-Toe Tools ===
      {
        name: 'tictactoe_new_game',
        description: 'Start a new game of Tic-Tac-Toe. You play as X.',
        inputSchema: {
          type: 'object' as const,
          properties: {},
          required: []
        }
      },
      {
        name: 'tictactoe_move',
        description: 'Make a move in Tic-Tac-Toe. Position is 0-8 (top-left to bottom-right).',
        inputSchema: {
          type: 'object' as const,
          properties: {
            position: {
              type: 'number',
              description: 'Board position (0-8). 0=top-left, 2=top-right, 6=bottom-left, 8=bottom-right.'
            }
          },
          required: ['position']
        }
      },
      {
        name: 'tictactoe_state',
        description: 'Get the current state of the Tic-Tac-Toe board.',
        inputSchema: {
          type: 'object' as const,
          properties: {},
          required: []
        }
      },

      // === General Tools ===
      {
        name: 'list_games',
        description: 'List available games to play.',
        inputSchema: {
          type: 'object' as const,
          properties: {},
          required: []
        }
      }
    ]
  };
});

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  try {
    switch (name) {
      // === Blackjack ===
      case 'blackjack_new_game': {
        const session = getOrCreateSession('blackjack');
        const bjGame = session.game as BlackjackGame;
        bjGame.deal();
        const state = formatGameState(session);
        session.history.push('New game started');
        return { content: [{ type: 'text', text: state }] };
      }

      case 'blackjack_hit': {
        const session = getOrCreateSession('blackjack');
        const bjGame = session.game as BlackjackGame;
        const result = bjGame.hit();
        const state = formatGameState(session);
        session.history.push('Player hit');
        return { content: [{ type: 'text', text: `${result}\n\n${state}` }] };
      }

      case 'blackjack_stand': {
        const session = getOrCreateSession('blackjack');
        const bjGame = session.game as BlackjackGame;
        const result = bjGame.stand();
        const state = formatGameState(session);
        session.history.push('Player stood');
        return { content: [{ type: 'text', text: `${result}\n\n${state}` }] };
      }

      case 'blackjack_state': {
        const session = getOrCreateSession('blackjack');
        return { content: [{ type: 'text', text: formatGameState(session) }] };
      }

      // === Tic-Tac-Toe ===
      case 'tictactoe_new_game': {
        const session = getOrCreateSession('tictactoe');
        const tttGame = session.game as TicTacToeGame;
        tttGame.reset();
        const state = formatGameState(session);
        session.history.push('New game started');
        return { content: [{ type: 'text', text: state }] };
      }

      case 'tictactoe_move': {
        const session = getOrCreateSession('tictactoe');
        const tttGame = session.game as TicTacToeGame;
        const position = (args as { position?: number })?.position;
        if (position === undefined) {
          return {
            content: [{ type: 'text', text: 'Error: position is required (0-8)' }],
            isError: true
          };
        }
        const result = tttGame.makeMove(position);
        const state = formatGameState(session);
        session.history.push(`Player moved to ${position}`);
        return { content: [{ type: 'text', text: `${result}\n\n${state}` }] };
      }

      case 'tictactoe_state': {
        const session = getOrCreateSession('tictactoe');
        return { content: [{ type: 'text', text: formatGameState(session) }] };
      }

      // === General ===
      case 'list_games': {
        return {
          content: [{
            type: 'text',
            text: `Available games:

1. **Blackjack** - Classic casino card game
   - Tools: blackjack_new_game, blackjack_hit, blackjack_stand, blackjack_state

2. **Tic-Tac-Toe** - Classic strategy game
   - Tools: tictactoe_new_game, tictactoe_move, tictactoe_state

Start a game by calling the appropriate new_game tool!`
          }]
        };
      }

      default:
        throw new Error(`Unknown tool: ${name}`);
    }
  } catch (error) {
    return {
      content: [{
        type: 'text',
        text: `Error: ${error instanceof Error ? error.message : 'Unknown error'}`
      }],
      isError: true
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
        mimeType: 'text/plain'
      },
      {
        uri: 'hypertoken://game/history',
        name: 'Game History',
        description: 'History of moves in the current game',
        mimeType: 'text/plain'
      }
    ]
  };
});

server.setRequestHandler(ReadResourceRequestSchema, async (request) => {
  const { uri } = request.params;

  if (!activeSessionId || !sessions.has(activeSessionId)) {
    return {
      contents: [{
        uri,
        mimeType: 'text/plain',
        text: 'No active game. Start a game first!'
      }]
    };
  }

  const session = sessions.get(activeSessionId)!;

  switch (uri) {
    case 'hypertoken://game/state':
      return {
        contents: [{
          uri,
          mimeType: 'text/plain',
          text: formatGameState(session)
        }]
      };

    case 'hypertoken://game/history':
      return {
        contents: [{
          uri,
          mimeType: 'text/plain',
          text: session.history.join('\n') || 'No moves yet.'
        }]
      };

    default:
      throw new Error(`Unknown resource: ${uri}`);
  }
});

// === Prompts ===
server.setRequestHandler(ListPromptsRequestSchema, async () => {
  return {
    prompts: [
      {
        name: 'play_blackjack',
        description: 'Play a game of Blackjack with strategic advice',
        arguments: []
      },
      {
        name: 'play_tictactoe',
        description: 'Play Tic-Tac-Toe with optimal strategy',
        arguments: []
      },
      {
        name: 'teach_game',
        description: 'Learn how to play a game',
        arguments: [
          {
            name: 'game',
            description: 'The game to learn (blackjack, tictactoe)',
            required: true
          }
        ]
      }
    ]
  };
});

server.setRequestHandler(GetPromptRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

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

Let's play!`
            }
          }
        ]
      };

    case 'play_tictactoe':
      return {
        messages: [
          {
            role: 'user',
            content: {
              type: 'text',
              text: `Let's play Tic-Tac-Toe! You play as X, and I want you to try to win.

Start a new game with tictactoe_new_game, then make moves with tictactoe_move.

The board positions are:
  0 | 1 | 2
  ---------
  3 | 4 | 5
  ---------
  6 | 7 | 8

Strategy tips:
- Take center (4) if available
- Take corners (0, 2, 6, 8) over edges
- Block opponent's winning moves
- Create forks when possible

Start the game and play to win!`
            }
          }
        ]
      };

    case 'teach_game': {
      const game = (args as { game?: string })?.game || 'blackjack';
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

I'm a beginner, so please be patient and explain everything!`
            }
          }
        ]
      };
    }

    default:
      throw new Error(`Unknown prompt: ${name}`);
  }
});

// === Start Server ===
async function main(): Promise<void> {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error('HyperToken MCP server running...');
}

main().catch(console.error);
