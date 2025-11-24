import prompts from 'prompts';
import chalk from 'chalk';
import ora from 'ora';
import { writeFile, mkdir } from 'fs/promises';
import { join } from 'path';
import { existsSync } from 'fs';

export async function createNewGame() {
  console.log(chalk.bold.cyan('\n🏗️  Create New Game\n'));

  // Step 1: Choose template
  const { template } = await prompts({
    type: 'select',
    name: 'template',
    message: 'What kind of game would you like to create?',
    choices: [
      {
        title: '🃏 Card Game',
        description: 'Like Blackjack, Poker, or custom card games',
        value: 'card'
      },
      {
        title: '🎲 Board Game',
        description: 'Like Tic-Tac-Toe, Chess, or grid-based games',
        value: 'board'
      },
      {
        title: '💰 Resource Game',
        description: 'Trading, economy simulation, or resource management',
        value: 'resource'
      },
      {
        title: '⚡ Custom',
        description: 'Start from scratch with minimal boilerplate',
        value: 'custom'
      }
    ]
  });

  if (!template) {
    console.log(chalk.gray('Cancelled.'));
    return;
  }

  // Step 2: Get project details
  const { projectName, agentName } = await prompts([
    {
      type: 'text',
      name: 'projectName',
      message: 'Project name:',
      initial: 'my-hypertoken-game',
      validate: (value: string) => {
        if (!value) return 'Project name is required';
        if (!/^[a-z0-9-]+$/.test(value)) {
          return 'Use lowercase letters, numbers, and hyphens only';
        }
        if (existsSync(value)) {
          return `Directory "${value}" already exists`;
        }
        return true;
      }
    },
    {
      type: 'text',
      name: 'agentName',
      message: 'Default agent name:',
      initial: 'Player'
    }
  ]);

  if (!projectName) {
    console.log(chalk.gray('Cancelled.'));
    return;
  }

  // Step 3: Generate project
  const spinner = ora('Creating project...').start();

  try {
    await generateProject(projectName, template, agentName || 'Player');
    spinner.succeed('Project created!');

    // Success message
    console.log(chalk.green(`\n✓ ${projectName} is ready!\n`));

    printNextSteps(projectName, template);
  } catch (error: any) {
    spinner.fail('Failed to create project');
    console.error(chalk.red(error.message));
    throw error;
  }
}

async function generateProject(name: string, template: string, agentName: string) {
  // Create directory structure
  const dirs = [
    name,
    join(name, 'src'),
    join(name, 'demo'),
    join(name, 'tokens')
  ];

  for (const dir of dirs) {
    await mkdir(dir, { recursive: true });
  }

  // Generate files based on template
  await writeFile(
    join(name, 'package.json'),
    generatePackageJson(name)
  );

  await writeFile(
    join(name, 'tsconfig.json'),
    generateTsConfig()
  );

  await writeFile(
    join(name, 'README.md'),
    generateReadme(name, template)
  );

  await writeFile(
    join(name, 'src', 'game.ts'),
    generateGameFile(template, agentName)
  );

  await writeFile(
    join(name, 'demo', 'cli.ts'),
    generateCliFile(template)
  );

  await writeFile(
    join(name, 'tokens', 'tokens.json'),
    generateTokensFile(template)
  );

  await writeFile(
    join(name, '.gitignore'),
    'node_modules/\ndist/\n*.log\n.DS_Store\n'
  );
}

function generatePackageJson(name: string): string {
  return JSON.stringify({
    name,
    version: '0.1.0',
    type: 'module',
    scripts: {
      build: 'tsc',
      dev: 'tsc --watch',
      demo: 'npm run build && node dist/demo/cli.js',
      'demo:dev': 'tsc && node dist/demo/cli.js'
    },
    dependencies: {
      '@automerge/automerge': '^3.2.0',
      ws: '^8.18.3'
    },
    devDependencies: {
      '@types/node': '^24.10.1',
      '@types/ws': '^8.18.1',
      typescript: '^5.9.3'
    }
  }, null, 2);
}

function generateTsConfig(): string {
  return JSON.stringify({
    compilerOptions: {
      target: 'ES2022',
      module: 'ES2022',
      moduleResolution: 'node',
      outDir: './dist',
      rootDir: './',
      strict: true,
      esModuleInterop: true,
      skipLibCheck: true,
      forceConsistentCasingInFileNames: true,
      resolveJsonModule: true
    },
    include: ['src/**/*', 'demo/**/*'],
    exclude: ['node_modules', 'dist']
  }, null, 2);
}

function generateReadme(name: string, template: string): string {
  return `# ${name}

A HyperToken game built with ${template} template.

## Quick Start

\`\`\`bash
# Install dependencies
npm install

# Run the demo
npm run demo

# Or develop with auto-rebuild
npm run dev
# Then in another terminal:
node dist/demo/cli.js
\`\`\`

## Project Structure

\`\`\`
${name}/
├── src/
│   └── game.ts         # Your game logic
├── demo/
│   └── cli.ts          # Interactive demo
├── tokens/
│   └── tokens.json     # Your game pieces/entities
└── package.json
\`\`\`

## Next Steps

1. **Customize your game**: Edit \`src/game.ts\`
2. **Design your tokens**: Edit \`tokens/tokens.json\`
3. **Add rules**: Extend the RuleEngine in \`src/game.ts\`
4. **Add AI agents**: Create agent strategies
5. **Add multiplayer**: Use the network module

## Learn More

- [HyperToken Documentation](https://github.com/flammafex/hypertoken)
- [Examples](https://github.com/flammafex/hypertoken/tree/main/examples)
- [Action Reference](https://github.com/flammafex/hypertoken/blob/main/engine/ACTIONS.md)

## License

Apache 2.0
`;
}

function generateGameFile(template: string, agentName: string): string {
  if (template === 'card') {
    return generateCardGameTemplate(agentName);
  } else if (template === 'board') {
    return generateBoardGameTemplate(agentName);
  } else if (template === 'resource') {
    return generateResourceGameTemplate(agentName);
  } else {
    return generateCustomTemplate(agentName);
  }
}

function generateCardGameTemplate(agentName: string): string {
  return `// Card Game Template
// Based on HyperToken's Blackjack example

export class CardGame {
  constructor() {
    console.log("Card game initialized");
    console.log("Default player:", "${agentName}");
  }

  setup() {
    // TODO: Initialize deck, shuffle, deal cards
    console.log("Setting up card game...");
  }

  play() {
    // TODO: Implement game loop
    console.log("Starting game...");
  }
}

// Example: Using HyperToken Engine
// import { Engine } from 'hypertoken/engine/Engine.js';
// import { Source } from 'hypertoken/core/Source.js';
//
// const engine = new Engine();
// const deck = new Source();
//
// // Load cards from tokens.json
// // deck.addTokens(tokens);
// // deck.shuffle({ seed: 42 });
//
// // Deal cards
// // engine.dispatch('agent:drawCards', { agentId: '${agentName}', count: 5 });
`;
}

function generateBoardGameTemplate(agentName: string): string {
  return `// Board Game Template
// Based on HyperToken's Tic-Tac-Toe example

export class BoardGame {
  private board: string[][];

  constructor(rows: number = 3, cols: number = 3) {
    this.board = Array(rows).fill(null).map(() => Array(cols).fill(' '));
    console.log("Board game initialized");
    console.log("Board size:", rows, "x", cols);
    console.log("Default player:", "${agentName}");
  }

  makeMove(row: number, col: number, player: string): boolean {
    if (this.board[row][col] !== ' ') {
      return false; // Invalid move
    }
    this.board[row][col] = player;
    return true;
  }

  printBoard() {
    console.log();
    for (const row of this.board) {
      console.log(row.join(' | '));
    }
    console.log();
  }

  checkWinner(): string | null {
    // TODO: Implement win condition logic
    return null;
  }
}

// Example: Using HyperToken Engine
// import { Engine } from 'hypertoken/engine/Engine.js';
// import { Space } from 'hypertoken/core/Space.js';
//
// const engine = new Engine();
// const gameSpace = new Space();
//
// // Create zones for board positions
// // for (let i = 0; i < 9; i++) {
// //   gameSpace.createZone(\`position-\${i}\`);
// // }
//
// // Make moves
// // engine.dispatch('token:move', {
// //   tokenId: 'player-X',
// //   toZone: 'position-4'
// // });
`;
}

function generateResourceGameTemplate(agentName: string): string {
  return `// Resource Management Game Template

export class ResourceGame {
  private resources: Map<string, number>;

  constructor() {
    this.resources = new Map();
    console.log("Resource game initialized");
    console.log("Default player:", "${agentName}");
  }

  addResource(resource: string, amount: number) {
    const current = this.resources.get(resource) || 0;
    this.resources.set(resource, current + amount);
  }

  transfer(from: string, to: string, resource: string, amount: number): boolean {
    const fromAmount = this.resources.get(from + ':' + resource) || 0;
    if (fromAmount < amount) {
      return false; // Insufficient resources
    }

    this.resources.set(from + ':' + resource, fromAmount - amount);
    const toAmount = this.resources.get(to + ':' + resource) || 0;
    this.resources.set(to + ':' + resource, toAmount + amount);

    return true;
  }

  getResources(owner: string): Map<string, number> {
    const result = new Map<string, number>();
    for (const [key, value] of this.resources.entries()) {
      if (key.startsWith(owner + ':')) {
        const resource = key.split(':')[1];
        result.set(resource, value);
      }
    }
    return result;
  }
}

// Example: Using HyperToken Engine
// import { Engine } from 'hypertoken/engine/Engine.js';
//
// const engine = new Engine();
//
// // Transfer resources
// // engine.dispatch('agent:transfer', {
// //   from: '${agentName}',
// //   to: 'Bank',
// //   resource: 'gold',
// //   amount: 50
// // });
`;
}

function generateCustomTemplate(agentName: string): string {
  return `// Custom Game Template

export class CustomGame {
  constructor() {
    console.log("Game initialized");
    console.log("Default player:", "${agentName}");
  }

  setup() {
    // Initialize your game state
    console.log("Setting up game...");
  }

  play() {
    // Implement your game loop
    console.log("Starting game...");
  }
}

// HyperToken provides these core primitives:
//
// - Token: Universal entity (cards, pieces, resources, etc.)
// - Stack: Ordered collection (deck, hand, pile)
// - Space: Spatial zones (board positions, areas)
// - Source: Token factory (deck shoe, spawner)
// - Chronicle: CRDT state container
// - Engine: Event-driven coordinator
// - RuleEngine: Declarative game logic
//
// Example usage:
// import { Engine } from 'hypertoken/engine/Engine.js';
// import { Token } from 'hypertoken/core/Token.js';
//
// const engine = new Engine();
// const token = new Token({ id: 'my-token', label: 'My Token' });
`;
}

function generateCliFile(template: string): string {
  return `#!/usr/bin/env node
import { ${template === 'card' ? 'CardGame' : template === 'board' ? 'BoardGame' : template === 'resource' ? 'ResourceGame' : 'CustomGame'} } from '../src/game.js';

console.log('🎮 Welcome to your HyperToken game!\\n');

const game = new ${template === 'card' ? 'CardGame' : template === 'board' ? 'BoardGame' : template === 'resource' ? 'ResourceGame' : 'CustomGame'}();

game.setup?.();
game.play?.();

console.log('\\n✓ Demo complete!');
console.log('\\nNext steps:');
console.log('  1. Edit src/game.ts to customize your game');
console.log('  2. Edit tokens/tokens.json to add game entities');
console.log('  3. Add rules using the RuleEngine');
console.log('  4. Run npm run demo to test\\n');
`;
}

function generateTokensFile(template: string): string {
  if (template === 'card') {
    return JSON.stringify({
      tokens: [
        {
          id: 'card-1',
          label: 'Ace of Spades',
          group: 'cards',
          meta: { suit: 'spades', rank: 'A', value: 11 }
        }
      ]
    }, null, 2);
  } else if (template === 'board') {
    return JSON.stringify({
      tokens: [
        {
          id: 'piece-x',
          label: 'X',
          group: 'pieces',
          char: 'X'
        },
        {
          id: 'piece-o',
          label: 'O',
          group: 'pieces',
          char: 'O'
        }
      ]
    }, null, 2);
  } else {
    return JSON.stringify({
      tokens: [
        {
          id: 'token-1',
          label: 'Example Token',
          group: 'default',
          meta: {}
        }
      ]
    }, null, 2);
  }
}

function printNextSteps(projectName: string, template: string) {
  console.log(chalk.bold('Next steps:\n'));
  console.log(chalk.cyan(`  cd ${projectName}`));
  console.log(chalk.cyan('  npm install'));
  console.log(chalk.cyan('  npm run demo'));
  console.log();
  console.log(chalk.gray('To develop:'));
  console.log(chalk.gray('  npm run dev          # Watch for changes'));
  console.log(chalk.gray('  node dist/demo/cli.js  # Run demo'));
  console.log();
  console.log(chalk.bold.green('Happy building! 🚀\n'));
}
