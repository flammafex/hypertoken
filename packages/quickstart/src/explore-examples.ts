import prompts from 'prompts';
import chalk from 'chalk';
import { readFile } from 'fs/promises';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export async function exploreExamples() {
  console.log(chalk.bold.cyan('\n📚 Explore Examples\n'));

  const examples = [
    {
      title: '🃏 Blackjack',
      description: 'Casino-grade card game with AI, betting, card counting',
      path: 'examples/blackjack',
      command: 'node --loader ../../test/ts-esm-loader.js cli.js',
      features: [
        'Complete casino features (Double Down, Split, Insurance)',
        'Card counting agents (Hi-Lo, Hi-Opt I, Omega II)',
        '6 betting strategies',
        'Multi-agent support (2-6 players)',
        'Network multiplayer'
      ]
    },
    {
      title: '🤝 Prisoner\'s Dilemma',
      description: 'Game theory tournament with 14 strategies',
      path: 'examples/prisoners-dilemma',
      command: 'node pd-cli.js',
      features: [
        '14 classic strategies',
        'Tournament mode',
        'Strategy evolution',
        'Payoff analysis'
      ]
    },
    {
      title: '🎴 Accordion Solitaire',
      description: '"Impossible" solitaire - AI challenge',
      path: 'examples/accordion',
      command: 'node accordion.js',
      features: [
        'Classic solitaire variant',
        'Deterministic replay',
        'Perfect for AI training',
        'Win rate analysis'
      ]
    }
  ];

  const { choice } = await prompts({
    type: 'select',
    name: 'choice',
    message: 'Which example would you like to explore?',
    choices: [
      ...examples.map((ex, idx) => ({
        title: ex.title,
        description: ex.description,
        value: idx
      })),
      {
        title: '🚪 Back to main menu',
        description: 'Return to main menu',
        value: -1
      }
    ]
  });

  if (choice === undefined || choice === -1) {
    return;
  }

  const example = examples[choice];

  await showExampleDetails(example);
}

async function showExampleDetails(example: any) {
  console.log();
  console.log(chalk.bold.yellow(example.title));
  console.log(chalk.gray(example.description));
  console.log();

  console.log(chalk.bold('Features:'));
  for (const feature of example.features) {
    console.log(chalk.green('  ✓'), feature);
  }
  console.log();

  console.log(chalk.bold('To run this example:\n'));
  console.log(chalk.cyan('  # From the hypertoken repo root:'));
  console.log(chalk.cyan(`  cd ${example.path}`));
  console.log(chalk.cyan(`  ${example.command}`));
  console.log();

  // Try to read the README if available
  try {
    const readmePath = join(process.cwd(), '..', '..', example.path, 'README.md');
    const readme = await readFile(readmePath, 'utf-8');

    const { viewReadme } = await prompts({
      type: 'confirm',
      name: 'viewReadme',
      message: 'Would you like to see more details from the README?',
      initial: false
    });

    if (viewReadme) {
      // Show first ~30 lines of README
      const lines = readme.split('\n').slice(0, 30);
      console.log();
      console.log(chalk.gray('─'.repeat(60)));
      console.log(lines.join('\n'));
      console.log(chalk.gray('─'.repeat(60)));
      console.log(chalk.gray('(See full README in the example directory)'));
      console.log();
    }
  } catch (error) {
    // README not found, skip
  }

  const { action } = await prompts({
    type: 'select',
    name: 'action',
    message: 'What would you like to do?',
    choices: [
      {
        title: 'View another example',
        value: 'explore'
      },
      {
        title: 'Create a similar game',
        value: 'create'
      },
      {
        title: 'Back to main menu',
        value: 'back'
      }
    ]
  });

  if (action === 'explore') {
    await exploreExamples();
  } else if (action === 'create') {
    const { createNewGame } = await import('./create-game.js');
    await createNewGame();
  }
}
