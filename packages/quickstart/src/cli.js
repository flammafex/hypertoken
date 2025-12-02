#!/usr/bin/env node
import prompts from 'prompts';
import chalk from 'chalk';
import boxen from 'boxen';
import { playAndLearn } from './play-and-learn.js';
import { createNewGame } from './create-game.js';
import { exploreExamples } from './explore-examples.js';
async function main() {
    console.clear();
    // Welcome banner
    const banner = `
${chalk.bold.cyan('🧩 HyperToken')} ${chalk.gray('- Distributed Simulation Engine')}

Build multiplayer games with:
  ${chalk.green('✓')} No servers ${chalk.gray('(P2P with CRDTs)')}
  ${chalk.green('✓')} No blockchain ${chalk.gray('(but same guarantees)')}
  ${chalk.green('✓')} Built-in AI ${chalk.gray('(OpenAI Gym compatible)')}
  ${chalk.green('✓')} Perfect replay ${chalk.gray('(deterministic by default)')}
`;
    console.log(boxen(banner, {
        padding: 1,
        margin: 1,
        borderStyle: 'round',
        borderColor: 'cyan'
    }));
    // Check for command-line flags
    const args = process.argv.slice(2);
    if (args.includes('--join')) {
        // Quick join mode for multiplayer demo
        await playAndLearn(true);
        return;
    }
    // Main menu
    const response = await prompts({
        type: 'select',
        name: 'action',
        message: 'What would you like to do?',
        choices: [
            {
                title: '🎮 Play & Learn',
                description: 'Run a live multiplayer demo (30 seconds)',
                value: 'play'
            },
            {
                title: '🏗️  Create New Game',
                description: 'Scaffold a new HyperToken project',
                value: 'create'
            },
            {
                title: '📚 Explore Examples',
                description: 'Tour existing examples (Blackjack, Tic-Tac-Toe, etc.)',
                value: 'explore'
            },
            {
                title: '🚪 Exit',
                description: 'See you later!',
                value: 'exit'
            }
        ],
        initial: 0
    });
    if (!response.action || response.action === 'exit') {
        console.log(chalk.cyan('\n👋 Thanks for checking out HyperToken!\n'));
        console.log(chalk.gray('Learn more: https://hypertoken.ai'));
        console.log(chalk.gray('GitHub: https://github.com/flammafex/hypertoken\n'));
        process.exit(0);
    }
    switch (response.action) {
        case 'play':
            await playAndLearn(false);
            break;
        case 'create':
            await createNewGame();
            break;
        case 'explore':
            await exploreExamples();
            break;
    }
}
main().catch(error => {
    console.error(chalk.red('Error:'), error.message);
    process.exit(1);
});
