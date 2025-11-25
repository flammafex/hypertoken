import prompts from 'prompts';
import chalk from 'chalk';

export async function playAndLearn(isJoining: boolean) {
  console.log(chalk.bold.cyan('\n🎮 Play & Learn - Interactive Demo\n'));

  // For now, just run the demo (network sync would require actual HyperToken engine)
  if (isJoining) {
    console.log(chalk.yellow('Note: This demo runs locally with an AI opponent.'));
    console.log(chalk.gray('Full multiplayer sync requires the HyperToken engine.\n'));
  }

  await runSimpleDemo();
}

async function runSimpleDemo() {
  console.log(chalk.yellow('Let\'s see HyperToken concepts in action!\n'));
  console.log(chalk.gray('(Playing against AI opponent)\n'));

  const { ready } = await prompts({
    type: 'confirm',
    name: 'ready',
    message: 'Ready to start?',
    initial: true
  });

  if (!ready) {
    return;
  }

  // Simple Tic-Tac-Toe demo
  await runTicTacToeDemo();

  console.log(chalk.green('\n✨ Demo complete!\n'));

  await showLearningMoments();
}

async function runTicTacToeDemo() {
  const player: 'X' | 'O' = 'X';
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
      // AI opponent's turn
      console.log(chalk.gray(`AI (${currentPlayer}) is thinking...`));

      // Simple AI: pick random available spot
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

        currentPlayer = 'X'; // Back to player's turn
      } else {
        // No moves available
        gameOver = true;
      }
    }
  }
}

async function showLearningMoments() {
  console.log(chalk.bold.cyan('💡 Key HyperToken Concepts\n'));

  const moments = [
    {
      title: '🎮 Token-Based Game State',
      description: 'In HyperToken, everything is a Token (game pieces, cards, characters).\nTokens live in Stacks (ordered collections) or Spaces (positioned zones).'
    },
    {
      title: '🌍 Distributed by Default',
      description: 'With the full HyperToken engine, this game would sync across multiple clients\nusing CRDTs (Conflict-free Replicated Data Types) - no server required!'
    },
    {
      title: '⚡ Instant Execution',
      description: 'Moves are applied locally first, then synchronized.\nNo waiting for server confirmation. No lag. No server costs.'
    },
    {
      title: '📝 Perfect Determinism',
      description: 'Every action can be recorded with actor ID and timestamp.\nReplay any game exactly with the same seed. Perfect for AI training and debugging.'
    },
    {
      title: '🤖 AI-Ready',
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
