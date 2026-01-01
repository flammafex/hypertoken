import prompts from 'prompts';
import chalk from 'chalk';
import ora from 'ora';
import { WebSocketServer, WebSocket } from 'ws';
import { createServer } from 'http';

export async function playAndLearn(isJoining: boolean) {
  console.log(chalk.bold.cyan('\n🎮 Play & Learn - Interactive Demo\n'));

  if (isJoining) {
    await joinMultiplayerDemo();
  } else {
    await hostMultiplayerDemo();
  }
}

async function hostMultiplayerDemo() {
  console.log(chalk.yellow('Let\'s experience distributed multiplayer in action!\n'));

  const spinner = ora('Starting relay server...').start();

  // Start embedded relay server
  const httpServer = createServer();
  const wss = new WebSocketServer({ server: httpServer });

  const clients: WebSocket[] = [];

  wss.on('connection', (ws) => {
    clients.push(ws);

    // Broadcast messages to all clients
    ws.on('message', (data) => {
      const message = data.toString();
      clients.forEach(client => {
        if (client !== ws && client.readyState === WebSocket.OPEN) {
          client.send(message);
        }
      });
    });

    ws.on('close', () => {
      const index = clients.indexOf(ws);
      if (index > -1) clients.splice(index, 1);
    });
  });

  const PORT = 8765;

  await new Promise<void>((resolve, reject) => {
    httpServer.listen(PORT, () => {
      spinner.succeed('Relay server ready!');
      resolve();
    });
    httpServer.on('error', reject);
  });

  console.log(chalk.green(`\n✓ Relay running on port ${PORT}\n`));
  console.log(chalk.bold('To see P2P sync in action:\n'));
  console.log(chalk.cyan('  Open another terminal and run:'));
  console.log(chalk.yellow.bold('  npx hypertoken-quickstart --join\n'));
  console.log(chalk.gray('(Or press Enter to play with AI)\n'));

  const { ready } = await prompts({
    type: 'confirm',
    name: 'ready',
    message: 'Ready to start?',
    initial: true
  });

  if (!ready) {
    httpServer.close();
    return;
  }

  // Connect as host
  const hostWs = new WebSocket('ws://localhost:8765');
  await new Promise((resolve) => hostWs.on('open', resolve));

  await runNetworkedTicTacToe(hostWs, 'X', clients.length > 1);

  console.log(chalk.green('\n✨ Demo complete!\n'));
  await showLearningMoments();

  hostWs.close();
  httpServer.close();
}

async function joinMultiplayerDemo() {
  console.log(chalk.cyan('Connecting to host...\n'));

  const ws = new WebSocket('ws://localhost:8765');

  try {
    await new Promise((resolve, reject) => {
      ws.on('open', resolve);
      ws.on('error', reject);
      setTimeout(() => reject(new Error('Connection timeout')), 5000);
    });

    console.log(chalk.green('✓ Connected to multiplayer game!\n'));

    await runNetworkedTicTacToe(ws, 'O', true);

    console.log(chalk.green('\n✨ Demo complete!\n'));
    await showLearningMoments();

  } catch (error: any) {
    console.log(chalk.red('\n✗ Could not connect to host.'));
    console.log(chalk.gray('Make sure the host is running first.\n'));
    console.log(chalk.yellow('Falling back to single-player mode...\n'));

    await runSinglePlayerDemo();
  } finally {
    ws.close();
  }
}

async function runSinglePlayerDemo() {
  await runTicTacToeDemo('X', null, false);
  console.log(chalk.green('\n✨ Demo complete!\n'));
  await showLearningMoments();
}

async function runNetworkedTicTacToe(ws: WebSocket, player: 'X' | 'O', hasOpponent: boolean) {
  await runTicTacToeDemo(player, ws, hasOpponent);
}

async function runTicTacToeDemo(player: 'X' | 'O', ws: WebSocket | null, hasOpponent: boolean) {
  const opponentType = hasOpponent ? 'Network Opponent' : 'AI';
  console.log(chalk.bold(`\n🎯 Tic-Tac-Toe - You are ${player} vs ${opponentType}\n`));

  let board = [
    [' ', ' ', ' '],
    [' ', ' ', ' '],
    [' ', ' ', ' ']
  ];

  const printBoard = () => {
    console.log();
    for (let i = 0; i < 3; i++) {
      const row = board[i].map((cell, j) => {
        if (cell === 'X') return chalk.blue('X');
        if (cell === 'O') return chalk.red('O');
        return chalk.gray(String(i * 3 + j + 1));
      }).join(' | ');
      console.log('  ' + row);
      if (i < 2) console.log('  ' + chalk.gray('---------'));
    }
    console.log();
  };

  const checkWinner = (): string | null => {
    // Check rows, columns, diagonals
    for (let i = 0; i < 3; i++) {
      if (board[i][0] !== ' ' && board[i][0] === board[i][1] && board[i][1] === board[i][2]) {
        return board[i][0];
      }
      if (board[0][i] !== ' ' && board[0][i] === board[1][i] && board[1][i] === board[2][i]) {
        return board[0][i];
      }
    }
    if (board[0][0] !== ' ' && board[0][0] === board[1][1] && board[1][1] === board[2][2]) {
      return board[0][0];
    }
    if (board[0][2] !== ' ' && board[0][2] === board[1][1] && board[1][1] === board[2][0]) {
      return board[0][2];
    }

    // Check for tie
    if (board.every(row => row.every(cell => cell !== ' '))) {
      return 'tie';
    }

    return null;
  };

  printBoard();

  // Simple turn-based game loop
  let currentPlayer: 'X' | 'O' = 'X';
  let gameOver = false;

  while (!gameOver) {
    if (currentPlayer === player) {
      const { position } = await prompts({
        type: 'number',
        name: 'position',
        message: `Your turn (${player}). Choose position (1-9):`,
        validate: (value: number) => {
          if (value < 1 || value > 9) return 'Position must be between 1 and 9';
          const row = Math.floor((value - 1) / 3);
          const col = (value - 1) % 3;
          if (board[row][col] !== ' ') return 'Position already taken';
          return true;
        }
      });

      if (position === undefined) {
        gameOver = true;
        break;
      }

      const row = Math.floor((position - 1) / 3);
      const col = (position - 1) % 3;
      board[row][col] = player;

      // Send move to opponent if networked
      if (ws && hasOpponent) {
        ws.send(JSON.stringify({ type: 'move', position, player }));
      }

      printBoard();

      const winner = checkWinner();
      if (winner) {
        if (winner === 'tie') {
          console.log(chalk.yellow('🤝 It\'s a tie!'));
        } else {
          console.log(chalk.green(`🎉 ${winner} wins!`));
        }
        gameOver = true;
        break;
      }

      currentPlayer = currentPlayer === 'X' ? 'O' : 'X';
    } else {
      // Opponent's turn (network or AI)
      if (hasOpponent && ws) {
        // Wait for network opponent's move
        console.log(chalk.gray(`Waiting for ${currentPlayer}...`));

        const opponentMove = await new Promise<number>((resolve) => {
          const handler = (data: any) => {
            const msg = JSON.parse(data.toString());
            if (msg.type === 'move' && msg.player === currentPlayer) {
              ws.removeListener('message', handler);
              resolve(msg.position);
            }
          };
          ws.on('message', handler);
        });

        const row = Math.floor((opponentMove - 1) / 3);
        const col = (opponentMove - 1) % 3;
        board[row][col] = currentPlayer;
        console.log(chalk.cyan(`${currentPlayer} played at position ${opponentMove}`));
        printBoard();

        const winner = checkWinner();
        if (winner) {
          if (winner === 'tie') {
            console.log(chalk.yellow('🤝 It\'s a tie!'));
          } else {
            console.log(chalk.green(`🎉 ${winner} wins!`));
          }
          gameOver = true;
          break;
        }

        currentPlayer = currentPlayer === 'X' ? 'O' : 'X';
      } else {
        // AI opponent's turn
        console.log(chalk.gray(`AI (${currentPlayer}) is thinking...`));

        await new Promise(resolve => setTimeout(resolve, 800));
        const available: [number, number][] = [];
        for (let i = 0; i < 3; i++) {
          for (let j = 0; j < 3; j++) {
            if (board[i][j] === ' ') available.push([i, j]);
          }
        }

        if (available.length > 0) {
          const [row, col] = available[Math.floor(Math.random() * available.length)];
          board[row][col] = currentPlayer;
          console.log(chalk.cyan(`${currentPlayer} played at position ${row * 3 + col + 1}`));
          printBoard();

          const winner = checkWinner();
          if (winner) {
            if (winner === 'tie') {
              console.log(chalk.yellow('🤝 It\'s a tie!'));
            } else {
              console.log(chalk.green(`🎉 ${winner} wins!`));
            }
            gameOver = true;
            break;
          }

          currentPlayer = currentPlayer === 'X' ? 'O' : 'X';
        } else {
          gameOver = true;
        }
      }
    }
  }
}

async function showLearningMoments() {
  console.log(chalk.bold.cyan('💡 What Just Happened?\n'));

  const moments = [
    {
      title: '🌍 Distributed Game State',
      description: 'You just played across two separate processes that synced automatically.\nThis demo used simple WebSocket messages - HyperToken uses CRDTs for mathematical guarantees.'
    },
    {
      title: '⚡ No Central Server',
      description: 'The "relay" just passed messages. No game logic ran on it.\nEither player could host. No AWS bills. No server administration.'
    },
    {
      title: '🎮 Token-Based Architecture',
      description: 'In HyperToken, game pieces are Tokens in Stacks/Spaces.\nYour X\'s and O\'s would be Tokens that move between zones on the board.'
    },
    {
      title: '📝 Perfect Reproducibility',
      description: 'Every action can be recorded with actor ID and timestamp.\nReplay any game exactly with the same seed. Perfect for debugging and AI training.'
    },
    {
      title: '🤖 AI Training Ready',
      description: 'Any HyperToken game can become an OpenAI Gym environment.\nTrain reinforcement learning agents at 1000x real-time speed.'
    }
  ];

  for (const moment of moments) {
    console.log(chalk.bold.yellow(`\n${moment.title}`));
    console.log(chalk.gray(moment.description));
  }

  console.log(chalk.bold.green('\n\n🚀 Ready to build your own?\n'));

  const { next } = await prompts({
    type: 'select',
    name: 'next',
    message: 'What would you like to do next?',
    choices: [
      { title: 'Create a new game', value: 'create' },
      { title: 'Explore examples', value: 'explore' },
      { title: 'Exit', value: 'exit' }
    ]
  });

  if (next === 'create') {
    const { createNewGame } = await import('./create-game.js');
    await createNewGame();
  } else if (next === 'explore') {
    const { exploreExamples } = await import('./explore-examples.js');
    await exploreExamples();
  }
}

// Helper to create boxen (inline import workaround)
function boxen(text: string, options: any): string {
  // Simple fallback - in production we'd use actual boxen
  const lines = text.split('\n');
  const maxLen = Math.max(...lines.map(l => l.length));
  const border = '─'.repeat(maxLen + 2);
  return `╭${border}╮\n${lines.map(l => `│ ${l.padEnd(maxLen)} │`).join('\n')}\n╰${border}╯`;
}
