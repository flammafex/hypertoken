#!/usr/bin/env node

/*
 * Copyright 2025 The Carpocratian Church of Commonality and Equality, Inc.
 *
 * Tarot CLI - Interactive command-line interface for tarot readings
 */

import readline from 'readline';
import { TarotReader } from './tarot-reader.js';
import fs from 'fs/promises';

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

const reader = new TarotReader('./tarot-deck.json');

// ASCII Art banner
const BANNER = `
╔═══════════════════════════════════════════════════════════════════╗
║                                                                   ║
║                    🔮  TAROT READING SYSTEM  🔮                   ║
║                                                                   ║
║            A Philosophical Divination Tool for Insight           ║
║                  Built on the HyperToken Framework               ║
║                                                                   ║
╚═══════════════════════════════════════════════════════════════════╝
`;

/**
 * Prompt user for input
 */
function ask(question) {
  return new Promise(resolve => {
    rl.question(question, answer => resolve(answer.trim()));
  });
}

/**
 * Display menu
 */
function showMenu() {
  console.log('\n' + '─'.repeat(70));
  console.log('MENU OPTIONS:');
  console.log('  1. Single Card Reading');
  console.log('  2. Three Card Reading (Past/Present/Future)');
  console.log('  3. Celtic Cross Reading');
  console.log('  4. Relationship Reading');
  console.log('  5. Career Reading');
  console.log('  6. Decision Making Reading');
  console.log('  7. Year Ahead Reading');
  console.log('  8. Chakra Alignment Reading');
  console.log('  9. View Reading History');
  console.log('  0. Exit');
  console.log('─'.repeat(70) + '\n');
}

/**
 * Perform reading based on spread choice
 */
async function performReading(spreadChoice) {
  const spreadMap = {
    '1': 'single-card',
    '2': 'three-card',
    '3': 'celtic-cross',
    '4': 'relationship',
    '5': 'career',
    '6': 'decision',
    '7': 'year-ahead',
    '8': 'chakra'
  };

  const spreadName = spreadMap[spreadChoice];
  if (!spreadName) {
    console.log('Invalid choice.');
    return;
  }

  console.log(`\n🔮 Preparing ${spreadName.toUpperCase().replace('-', ' ')} reading...\n`);

  // Ask for question
  const question = await ask('What question or intention do you bring to this reading?\n(Press Enter to skip): ');

  // Ask about reversed cards
  const allowReversed = await ask('\nAllow reversed (upside-down) cards? (y/n, default=y): ');
  const options = {
    allowReversed: allowReversed.toLowerCase() !== 'n'
  };

  console.log('\n🎴 Shuffling the cards...\n');
  await delay(1000);
  console.log('✨ Drawing cards...\n');
  await delay(1000);

  // Perform the reading
  const reading = reader.performReading(spreadName, question || null, options);

  // Display the reading
  console.log(reader.formatReading(reading));

  // Ask if they want to save
  const save = await ask('\nWould you like to save this reading? (y/n): ');
  if (save.toLowerCase() === 'y') {
    await saveReading(reading);
  }
}

/**
 * Save reading to file
 */
async function saveReading(reading) {
  const filename = `tarot-reading-${Date.now()}.json`;
  try {
    await fs.writeFile(filename, reader.exportReading(reading));
    console.log(`✓ Reading saved to ${filename}`);
  } catch (error) {
    console.error('Error saving reading:', error.message);
  }
}

/**
 * View reading history
 */
function viewHistory() {
  const history = reader.getHistory();
  if (history.length === 0) {
    console.log('\nNo readings in history.');
    return;
  }

  console.log('\n' + '═'.repeat(70));
  console.log('READING HISTORY');
  console.log('═'.repeat(70));

  history.forEach((reading, idx) => {
    console.log(`\n${idx + 1}. ${reading.spread.toUpperCase()}`);
    console.log(`   Date: ${reading.timestamp.toLocaleDateString()} ${reading.timestamp.toLocaleTimeString()}`);
    if (reading.question) {
      console.log(`   Question: ${reading.question}`);
    }
    console.log(`   Cards drawn: ${reading.cards.length}`);
  });

  console.log('\n' + '═'.repeat(70));
}

/**
 * Delay helper
 */
function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Display philosophical introduction
 */
function showIntroduction() {
  console.log(`
The Tarot is a mirror of the soul, a symbolic language that speaks to the
deeper currents of our existence. Each card is an archetype, a living symbol
that embodies universal patterns of experience and consciousness.

The Fool begins the journey at zero, unburdened and full of potential.
Through the Major Arcana, we traverse the great initiations of life:
love and loss, power and surrender, death and rebirth.

The Minor Arcana speak to the everyday dance of elements:
  🔥 WANDS - The fire of will, creativity, and action
  💧 CUPS - The water of emotion, intuition, and connection
  ⚔️ SWORDS - The air of thought, communication, and truth
  💰 PENTACLES - The earth of manifestation, work, and abundance

This system does not predict a fixed future, for the future is fluid and
shaped by consciousness. Rather, it illuminates the present moment and the
energies at play, offering wisdom for navigating the path ahead.

Ask your questions with sincerity. Trust the wisdom that emerges. The cards
do not lie—they reflect what your deeper self already knows.
`);
}

/**
 * Main CLI loop
 */
async function main() {
  console.clear();
  console.log(BANNER);
  
  console.log('Initializing tarot deck...\n');
  await reader.initialize();
  console.log('✓ Tarot deck loaded (78 cards)\n');

  const showIntro = await ask('Would you like to read the philosophical introduction? (y/n): ');
  if (showIntro.toLowerCase() === 'y') {
    showIntroduction();
    await ask('\nPress Enter to continue...');
  }

  let running = true;
  while (running) {
    console.clear();
    console.log(BANNER);
    showMenu();

    const choice = await ask('Select an option (0-9): ');

    switch (choice) {
      case '1':
      case '2':
      case '3':
      case '4':
      case '5':
      case '6':
      case '7':
      case '8':
        await performReading(choice);
        await ask('\nPress Enter to continue...');
        break;
      
      case '9':
        viewHistory();
        await ask('\nPress Enter to continue...');
        break;
      
      case '0':
        console.log('\n🙏 Thank you for using the Tarot Reading System.');
        console.log('May the wisdom of the cards guide your path.\n');
        running = false;
        break;
      
      default:
        console.log('Invalid option. Please try again.');
        await delay(1500);
    }
  }

  rl.close();
  process.exit(0);
}

// Handle errors gracefully
process.on('uncaughtException', (error) => {
  console.error('\n❌ An error occurred:', error.message);
  rl.close();
  process.exit(1);
});

// Run the CLI
main().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});