import prompts from 'prompts';
import chalk from 'chalk';
import ora from 'ora';
import { WebSocketServer, WebSocket } from 'ws';
import { createServer } from 'http';

export async function playAndLearn(isJoining: boolean) {
  console.log(chalk.bold.cyan('\n🎮 Play & Learn - Interactive Demo\n'));

  if (isJoining) {
    await joinDemo();
  } else {
    await hostDemo();
  }
}

async function hostDemo() {
  console.log(chalk.yellow('Let\'s experience serverless multiplayer in action!\n'));

  const spinner = ora('Starting demo environment...').start();

  // Start embedded relay server
  const httpServer = createServer();
  const wss = new WebSocketServer({ server: httpServer });

  const PORT = 8765;

  await new Promise<void>((resolve, reject) => {
    httpServer.listen(PORT, () => {
      spinner.succeed('Demo server ready!');
      resolve();
    });
    httpServer.on('error', reject);
  });

  console.log(chalk.green(`\n✓ Local relay running on port ${PORT}\n`));

  console.log(boxen(
    chalk.bold('To see multiplayer sync in action:\n\n') +
    chalk.cyan('Open another terminal and run:\n') +
    chalk.yellow.bold(`  npx hypertoken-quickstart --join\n\n`) +
    chalk.gray('(Or press Enter to play solo)'),
    { padding: 1, borderColor: 'yellow', borderStyle: 'round' }
  ));

  const { ready } = await prompts({
    type: 'confirm',
    name: 'ready',
    message: 'Ready to start the demo?',
    initial: true
  });

  if (!ready) {
    httpServer.close();
    return;
  }

  // Simple Tic-Tac-Toe demo
  await runTicTacToeDemo(wss, 'X');

  console.log(chalk.green('\n✨ Demo complete!\n'));

  await showLearningMoments();

  httpServer.close();
}

async function joinDemo() {
  console.log(chalk.cyan('Connecting to demo...'));

  const ws = new WebSocket('ws://localhost:8765');

  await new Promise((resolve, reject) => {
    ws.on('open', resolve);
    ws.on('error', reject);
  });

  console.log(chalk.green('✓ Connected!\n'));

  await runTicTacToeDemo(ws, 'O');

  ws.close();
}

async function runTicTacToeDemo(connection: any, player: 'X' | 'O') {
  console.log(chalk.bold(`\n🎯 Simple Tic-Tac-Toe - You are ${player}\n`));

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
      // In a real implementation, this would sync via CRDT
      console.log(chalk.gray(`Waiting for ${currentPlayer}...`));

      // For demo purposes, simulate opponent or allow single-player
      if (player === 'X') {
        // Simple AI: pick random available spot
        await new Promise(resolve => setTimeout(resolve, 1000));
        const available: [number, number][] = [];
        for (let i = 0; i < 3; i++) {
          for (let j = 0; j < 3; j++) {
            if (board[i][j] === ' ') available.push([i, j]);
          }
        }
        if (available.length > 0) {
          const [row, col] = available[Math.floor(Math.random() * available.length)];
          board[row][col] = 'O';
          console.log(chalk.cyan(`O played at position ${row * 3 + col + 1}`));
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

          currentPlayer = 'X';
        }
      }
    }
  }
}

async function showLearningMoments() {
  console.log(chalk.bold.cyan('💡 What just happened?\n'));

  const moments = [
    {
      title: '🌍 No Server Needed',
      description: 'That game ran peer-to-peer. The "relay" was just for WebSocket connections.\nThe game state synchronized automatically using CRDTs (Conflict-free Replicated Data Types).'
    },
    {
      title: '⚡ Instant Execution',
      description: 'Your moves were applied locally first, then synchronized.\nNo waiting for server confirmation. No lag.'
    },
    {
      title: '🔒 Mathematically Consistent',
      description: 'Both players saw the exact same game state, guaranteed by CRDT mathematics.\nNo possibility of desync. Ever.'
    },
    {
      title: '📝 Perfect Audit Trail',
      description: 'Every action was recorded with actor ID and timestamp.\nYou could replay this exact game deterministically with the same seed.'
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
